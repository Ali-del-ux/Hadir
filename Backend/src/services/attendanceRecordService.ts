import { recalculateCourseGrade } from './gradeEngineService';
import { pool } from '../config/database';
import { computeAttendanceTOTP, QR_STEP_SECONDS } from './attendanceService';

export interface MarkAttendanceRequest {
  qr_code: string;
  method?: 'qr_scan' | 'manual';
}

export interface AttendanceRecord {
  id: number;
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_number: string | null;
  attendance_time: string;
  method: 'qr' | 'manual';
  course_name: string;
  course_code: string;
  date: string;
  time: string;
}

class AttendanceError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Mark attendance by QR code scan
export const markAttendanceByQR = async (
  studentId: string,
  qrCode: string,
  deviceFingerprint?: string
): Promise<AttendanceRecord> => {
  const connection = await pool.getConnection();
  let resolvedSessionId: string | null = null;
  let resolvedCourseId: string | null = null;

  try {
    await connection.beginTransaction();

    // 0. Enforce account freeze inside service as defense-in-depth
    const [userRows] = await connection.execute<any[]>(
      `SELECT is_frozen, freeze_reason FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [studentId]
    );
    if (userRows.length === 0) {
      throw new AttendanceError('المستخدم غير موجود', 404);
    }
    if (userRows[0].is_frozen) {
      throw new AttendanceError(
        userRows[0].freeze_reason || 'حسابك مجمد أكاديمياً، لا يمكنك تسجيل الحضور',
        403,
        'ACCOUNT_FROZEN'
      );
    }

    // 1. Check dynamic QR format: HADIR:sessionId:window:token
    if (qrCode.startsWith('HADIR:')) {
      const parts = qrCode.split(':');
      if (parts.length !== 4 || !/^\d+$/.test(parts[2])) {
        throw new AttendanceError('صيغة رمز الـ QR غير صالحة', 400);
      }

      const [_, sessId, winStr, token] = parts;
      const clientWindow = parseInt(winStr, 10);
      const now = Math.floor(Date.now() / 1000);
      const currentWindow = Math.floor(now / QR_STEP_SECONDS);

      if (Math.abs(currentWindow - clientWindow) > 1) {
        throw new AttendanceError(
          'رمز الـ QR منتهي الصلاحية (صالح لمدة 20 ثانية فقط). يرجى مسح الرمز الجديد المعروض حالياً',
          400
        );
      }

      const [sRows] = await connection.execute<any[]>(
        `SELECT id, course_id, status, qr_secret FROM attendance_sessions WHERE id = ? FOR UPDATE`,
        [sessId]
      );
      if (sRows.length === 0 || sRows[0].status !== 'active') {
        throw new AttendanceError('جلسة الحضور مغلقة أو غير متاحة', 400);
      }

      const secret = sRows[0].qr_secret;
      if (!secret) {
        throw new AttendanceError('الجلسة غير مهيأة برمز تحقق أمني (qr_secret)', 400);
      }

      const expectedToken = computeAttendanceTOTP(secret, sessId, clientWindow);
      if (token.toUpperCase() !== expectedToken) {
        throw new AttendanceError('رمز التحقق غير صحيح أو تم التلاعب به', 400);
      }

      resolvedSessionId = sRows[0].id;
      resolvedCourseId = sRows[0].course_id;
    }

    // 2. Legacy / static fallback (rejected whenever qr_secret is present)
    if (!resolvedSessionId) {
      const [legacyRows] = await connection.execute<any[]>(
        `SELECT id, course_id, status, qr_secret FROM attendance_sessions WHERE qr_code = ? FOR UPDATE`,
        [qrCode]
      );
      if (legacyRows.length === 0 || legacyRows[0].status !== 'active') {
        throw new AttendanceError('رمز QR غير صالح أو أن جلسة الحضور مغلقة', 400);
      }
      if (legacyRows[0].qr_secret) {
        throw new AttendanceError(
          'هذه الجلسة مؤمنة برمز QR ديناميكي متغير كل 20 ثانية. يُمنع استخدام الرمز القديم أو الثابت، يرجى مسح الرمز الجديد من الشاشة.',
          400
        );
      }
      resolvedSessionId = legacyRows[0].id;
      resolvedCourseId = legacyRows[0].course_id;
    }

    // 3. Verify active student enrollment in course
    const [enrollment] = await connection.execute<any[]>(
      `SELECT id FROM enrollments 
       WHERE course_id = ? AND student_id = ? AND status = 'active' FOR UPDATE`,
      [resolvedCourseId, studentId]
    );

    if (enrollment.length === 0) {
      throw new AttendanceError('أنت غير مسجل في هذا المقرر الدراسي', 403);
    }

    // 4. Anti-Proxy Single Device Protection
    if (deviceFingerprint) {
      const [peerRows] = await connection.execute<any[]>(
        `SELECT ar.student_id, u.name 
         FROM attendance_records ar
         JOIN users u ON ar.student_id = u.id
         WHERE ar.session_id = ? AND ar.device_fingerprint = ? AND ar.student_id != ?`,
        [resolvedSessionId, deviceFingerprint, studentId]
      );

      if (peerRows.length > 0) {
        throw new AttendanceError(
          `مرفوض أمنياً: تم استخدام هذا الهاتف/الجهاز لتسجيل حضور الطالب (${peerRows[0].name}) في نفس الجلسة. يُمنع تسجيل الحضور بالنيابة عن الزملاء.`,
          400
        );
      }
    }

    // 5. Mark attendance with INSERT IGNORE (idempotent for same student)
    await connection.execute(
      `INSERT IGNORE INTO attendance_records (session_id, student_id, method, attendance_time, device_fingerprint)
       VALUES (?, ?, 'qr', CURRENT_TIMESTAMP, ?)`,
      [resolvedSessionId, studentId, deviceFingerprint || null]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // 6. Sync Gradebook synchronously after attendance
  if (resolvedCourseId) {
    await recalculateCourseGrade(resolvedCourseId, studentId);
  }

  const [record] = await pool.execute<any[]>(
    `SELECT 
      ar.id,
      ar.session_id,
      ar.student_id,
      u.name AS student_name,
      u.email AS student_email,
      u.student_id AS student_number,
      ar.attendance_time,
      ar.method,
      c.name AS course_name,
      c.code AS course_code,
      as2.date,
      as2.time
     FROM attendance_records ar
     JOIN users u ON ar.student_id = u.id
     JOIN attendance_sessions as2 ON ar.session_id = as2.id
     JOIN courses c ON as2.course_id = c.id
     WHERE ar.session_id = ? AND ar.student_id = ?
     ORDER BY ar.attendance_time DESC
     LIMIT 1`,
    [resolvedSessionId, studentId]
  );

  if (record.length === 0) {
    throw new AttendanceError('فشل تسجيل الحضور', 500);
  }

  const row = record[0];
  return {
    id: row.id,
    session_id: row.session_id,
    student_id: row.student_id,
    student_name: row.student_name,
    student_email: row.student_email,
    student_number: row.student_number,
    attendance_time: row.attendance_time,
    method: row.method,
    course_name: row.course_name,
    course_code: row.course_code,
    date: row.date,
    time: row.time,
  };
};

// Mark attendance manually (by teacher or admin)
export const markAttendanceManually = async (
  sessionId: string,
  studentId: string,
  actorId: string,
  actorRole?: string
): Promise<AttendanceRecord> => {
  try {
    const [session] = await pool.execute<any[]>(
      `SELECT as2.id, as2.course_id, as2.created_by, as2.status, c.teacher_id
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       WHERE as2.id = ?`,
      [sessionId]
    );

    if (session.length === 0) {
      throw new Error('Session not found');
    }

    if (
      actorRole !== 'admin' &&
      session[0].teacher_id !== actorId &&
      session[0].created_by !== actorId
    ) {
      throw new Error('You are not authorized to mark attendance for this session');
    }

    if (session[0].status !== 'active') {
      throw new Error('Attendance session is closed');
    }

    const [enrollment] = await pool.execute<any[]>(
      `SELECT id FROM enrollments 
       WHERE course_id = ? AND student_id = ? AND status = 'active'`,
      [session[0].course_id, studentId]
    );

    if (enrollment.length === 0) {
      throw new Error('Student is not enrolled in this course');
    }

    const [existing] = await pool.execute<any[]>(
      `SELECT id FROM attendance_records 
       WHERE session_id = ? AND student_id = ?`,
      [sessionId, studentId]
    );

    if (existing.length > 0) {
      throw new Error('Attendance already marked for this student');
    }

    await pool.execute(
      `INSERT INTO attendance_records (session_id, student_id, method, attendance_time)
       VALUES (?, ?, 'manual', CURRENT_TIMESTAMP)`,
      [sessionId, studentId]
    );

    // Sync Gradebook immediately
    await recalculateCourseGrade(session[0].course_id, studentId);

    const [record] = await pool.execute<any[]>(
      `SELECT 
        ar.id,
        ar.session_id,
        ar.student_id,
        u.name AS student_name,
        u.email AS student_email,
        u.student_id AS student_number,
        ar.attendance_time,
        ar.method,
        c.name AS course_name,
        c.code AS course_code,
        as2.date,
        as2.time
       FROM attendance_records ar
       JOIN users u ON ar.student_id = u.id
       JOIN attendance_sessions as2 ON ar.session_id = as2.id
       JOIN courses c ON as2.course_id = c.id
       WHERE ar.session_id = ? AND ar.student_id = ?
       ORDER BY ar.attendance_time DESC
       LIMIT 1`,
      [sessionId, studentId]
    );

    if (record.length === 0) {
      throw new Error('Failed to create attendance record');
    }

    const row = record[0];
    return {
      id: row.id,
      session_id: row.session_id,
      student_id: row.student_id,
      student_name: row.student_name,
      student_email: row.student_email,
      student_number: row.student_number,
      attendance_time: row.attendance_time,
      method: row.method,
      course_name: row.course_name,
      course_code: row.course_code,
      date: row.date,
      time: row.time,
    };
  } catch (error: any) {
    console.error('Error marking attendance manually:', error);
    throw error;
  }
};

// Get student attendance records
export const getStudentAttendanceRecords = async (studentId: string, courseId?: string) => {
  try {
    let query = `
      SELECT 
        ar.id,
        ar.session_id,
        ar.student_id,
        ar.attendance_time,
        ar.method,
        as2.id AS session_id_full,
        as2.course_id,
        c.name AS course_name,
        c.code AS course_code,
        as2.date,
        as2.time
       FROM attendance_records ar
       JOIN attendance_sessions as2 ON ar.session_id = as2.id
       JOIN courses c ON as2.course_id = c.id
       WHERE ar.student_id = ?
    `;
    const params: any[] = [studentId];

    if (courseId) {
      query += ` AND as2.course_id = ?`;
      params.push(courseId);
    }

    query += ` ORDER BY as2.date DESC, as2.time DESC`;

    const [rows] = await pool.execute<any[]>(query, params);

    return rows.map((row: any) => ({
      id: row.id,
      session_id: row.session_id,
      student_id: row.student_id,
      attendance_time: row.attendance_time,
      method: row.method,
      course_id: row.course_id,
      course_name: row.course_name,
      course_code: row.course_code,
      date: row.date,
      time: row.time,
    }));
  } catch (error) {
    console.error('Error getting student attendance:', error);
    throw error;
  }
};

// Get attendance summary for a student in a course
export const getStudentAttendanceSummary = async (studentId: string, courseId: string) => {
  try {
    const [totalSessions] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM attendance_sessions WHERE course_id = ?`,
      [courseId]
    );

    const [attendedSessions] = await pool.execute<any[]>(
      `SELECT COUNT(DISTINCT ar.session_id) as count
       FROM attendance_records ar
       JOIN attendance_sessions as2 ON ar.session_id = as2.id
       WHERE ar.student_id = ? AND as2.course_id = ?`,
      [studentId, courseId]
    );

    const total = parseInt(totalSessions[0].count) || 0;
    const attended = parseInt(attendedSessions[0].count) || 0;
    const percentage = total > 0 ? Math.round((attended / total) * 100) : null;

    return {
      course_id: courseId,
      total_sessions: total,
      attended_sessions: attended,
      percentage,
    };
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    throw error;
  }
};
