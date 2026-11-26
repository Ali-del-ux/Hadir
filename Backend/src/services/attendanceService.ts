import { pool } from '../config/database';
import crypto from 'crypto';

export const QR_STEP_SECONDS = 20;

export function computeAttendanceTOTP(qrSecret: string, sessionId: string, timeWindow: number): string {
  return crypto
    .createHmac('sha256', qrSecret)
    .update(`${sessionId}:${timeWindow}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

export function buildLiveQrPayload(sessionId: string, qrSecret: string): { live_qr: string; expires_in: number } {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / QR_STEP_SECONDS);
  const token = computeAttendanceTOTP(qrSecret, sessionId, currentWindow);
  const expires_in = QR_STEP_SECONDS - (now % QR_STEP_SECONDS);
  return {
    live_qr: `HADIR:${sessionId}:${currentWindow}:${token}`,
    expires_in,
  };
}

export interface CreateAttendanceSessionRequest {
  course_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  room?: string;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  date: string;
  time: string;
  room: string | null;
  qr_code: string;
  live_qr?: string;
  expires_in?: number;
  status: 'active' | 'closed';
  created_by: string;
  created_at: string;
  closed_at: string | null;
  attendees_count: number;
}

const generateStaticPlaceholderCode = (): string => {
  const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ATT-${randomString}`;
};

// Create attendance session (with immediate 32-byte qr_secret)
export const createAttendanceSession = async (
  actorId: string,
  sessionData: CreateAttendanceSessionRequest,
  actorRole?: string
): Promise<AttendanceSession & { live_qr?: string }> => {
  try {
    const [course] = await pool.execute<any[]>(
      `SELECT c.id, c.code, c.name, c.teacher_id, c.room
       FROM courses c
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [sessionData.course_id]
    );

    if (course.length === 0) {
      throw new Error('Course not found');
    }

    if (actorRole !== 'admin' && course[0].teacher_id !== actorId) {
      throw new Error('You are not assigned to this course');
    }

    const [existingSession] = await pool.execute<any[]>(
      `SELECT id FROM attendance_sessions
       WHERE course_id = ? AND date = ? AND status = 'active'`,
      [sessionData.course_id, sessionData.date]
    );

    if (existingSession.length > 0) {
      throw new Error('An active session already exists for this course today');
    }

    let qrCode = generateStaticPlaceholderCode();
    let attempts = 0;

    while (attempts < 10) {
      const [existing] = await pool.execute<any[]>(
        `SELECT id FROM attendance_sessions WHERE qr_code = ? AND status = 'active'`,
        [qrCode]
      );
      if (existing.length === 0) break;
      qrCode = generateStaticPlaceholderCode();
      attempts++;
    }

    const sessionId = `session_${Date.now()}`;
    const qrSecret = crypto.randomBytes(32).toString('hex');
    const room = sessionData.room || course[0].room || null;

    await pool.execute(
      `INSERT INTO attendance_sessions (id, course_id, date, time, room, qr_code, qr_secret, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        sessionId,
        sessionData.course_id,
        sessionData.date,
        sessionData.time,
        room,
        qrCode,
        qrSecret,
        actorId,
      ]
    );

    const created = (await getAttendanceSessionById(sessionId))!;
    const { live_qr, expires_in } = buildLiveQrPayload(sessionId, qrSecret);

    return {
      ...created,
      live_qr,
      expires_in,
    };
  } catch (error: any) {
    console.error('Error creating attendance session:', error);
    throw error;
  }
};

// Get attendance session by ID
export const getAttendanceSessionById = async (sessionId: string): Promise<AttendanceSession | null> => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT 
        as2.id,
        as2.course_id,
        c.code AS course_code,
        c.name AS course_name,
        as2.date,
        as2.time,
        COALESCE(as2.room, c.room) AS room,
        as2.qr_code,
        as2.qr_secret,
        as2.status,
        as2.created_by,
        u.name AS created_by_name,
        as2.created_at,
        as2.closed_at,
        COUNT(DISTINCT ar.student_id) AS attendees_count
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       LEFT JOIN users u ON as2.created_by = u.id
       LEFT JOIN attendance_records ar ON as2.id = ar.session_id
       WHERE as2.id = ?
       GROUP BY as2.id`,
      [sessionId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    let liveInfo: { live_qr?: string; expires_in?: number } = {};
    if (row.status === 'active') {
      let secret = row.qr_secret;
      if (!secret) {
        secret = crypto.randomBytes(32).toString('hex');
        await pool.execute(`UPDATE attendance_sessions SET qr_secret = ? WHERE id = ?`, [secret, row.id]);
      }
      liveInfo = buildLiveQrPayload(row.id, secret);
    }

    return {
      id: row.id,
      course_id: row.course_id,
      course_name: row.course_name,
      course_code: row.course_code,
      date: row.date,
      time: row.time,
      room: row.room || null,
      qr_code: row.qr_code,
      ...liveInfo,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      closed_at: row.closed_at,
      attendees_count: parseInt(row.attendees_count) || 0,
    };
  } catch (error) {
    console.error('Error getting attendance session:', error);
    throw error;
  }
};

// Get attendance session by QR code
export const getAttendanceSessionByQRCode = async (qrCode: string): Promise<AttendanceSession | null> => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT 
        as2.id,
        as2.course_id,
        c.code AS course_code,
        c.name AS course_name,
        as2.date,
        as2.time,
        COALESCE(as2.room, c.room) AS room,
        as2.qr_code,
        as2.status,
        as2.created_by,
        as2.created_at,
        as2.closed_at,
        COUNT(DISTINCT ar.student_id) AS attendees_count
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       LEFT JOIN attendance_records ar ON as2.id = ar.session_id
       WHERE as2.qr_code = ? AND as2.status = 'active'
       GROUP BY as2.id`,
      [qrCode]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      course_id: row.course_id,
      course_name: row.course_name,
      course_code: row.course_code,
      date: row.date,
      time: row.time,
      room: row.room || null,
      qr_code: row.qr_code,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      closed_at: row.closed_at,
      attendees_count: parseInt(row.attendees_count) || 0,
    };
  } catch (error) {
    console.error('Error getting attendance session by QR:', error);
    throw error;
  }
};

// Refresh/rotate QR secret and return fresh TOTP payload
export const refreshQRCode = async (
  sessionId: string,
  actorId: string,
  actorRole?: string
): Promise<string> => {
  try {
    const [session] = await pool.execute<any[]>(
      `SELECT as2.id, as2.created_by, c.teacher_id
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       WHERE as2.id = ? AND as2.status = 'active'`,
      [sessionId]
    );

    if (session.length === 0) {
      throw new Error('Session not found or already closed');
    }

    if (
      actorRole !== 'admin' &&
      session[0].teacher_id !== actorId &&
      session[0].created_by !== actorId
    ) {
      throw new Error('You are not authorized to refresh this session');
    }

    const newSecret = crypto.randomBytes(32).toString('hex');
    await pool.execute(
      `UPDATE attendance_sessions SET qr_secret = ? WHERE id = ?`,
      [newSecret, sessionId]
    );

    const currentWindow = Math.floor(Date.now() / 1000 / QR_STEP_SECONDS);
    const token = computeAttendanceTOTP(newSecret, sessionId, currentWindow);
    return `HADIR:${sessionId}:${currentWindow}:${token}`;
  } catch (error: any) {
    console.error('Error refreshing QR code:', error);
    throw error;
  }
};

// Close attendance session
export const closeAttendanceSession = async (
  sessionId: string,
  actorId: string,
  actorRole?: string
) => {
  try {
    const [session] = await pool.execute<any[]>(
      `SELECT as2.id, as2.created_by, c.teacher_id
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       WHERE as2.id = ? AND as2.status = 'active'`,
      [sessionId]
    );

    if (session.length === 0) {
      throw new Error('Session not found or already closed');
    }

    if (
      actorRole !== 'admin' &&
      session[0].teacher_id !== actorId &&
      session[0].created_by !== actorId
    ) {
      throw new Error('You are not authorized to close this session');
    }

    await pool.execute(
      `UPDATE attendance_sessions 
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [sessionId]
    );

    return { success: true };
  } catch (error: any) {
    console.error('Error closing session:', error);
    throw error;
  }
};

// Get active sessions for a teacher (matching courses.teacher_id, or all active for admin)
export const getTeacherActiveSessions = async (actorId: string, actorRole?: string) => {
  try {
    const query =
      actorRole === 'admin'
        ? `SELECT 
            as2.id,
            as2.course_id,
            c.code AS course_code,
            c.name AS course_name,
            as2.date,
            as2.time,
            COALESCE(as2.room, c.room) AS room,
            as2.qr_code,
            as2.qr_secret,
            as2.status,
            as2.created_at,
            COUNT(DISTINCT ar.student_id) AS attendees_count
           FROM attendance_sessions as2
           JOIN courses c ON as2.course_id = c.id
           LEFT JOIN attendance_records ar ON as2.id = ar.session_id
           WHERE as2.status = 'active' AND c.deleted_at IS NULL
           GROUP BY as2.id
           ORDER BY as2.created_at DESC`
        : `SELECT 
            as2.id,
            as2.course_id,
            c.code AS course_code,
            c.name AS course_name,
            as2.date,
            as2.time,
            COALESCE(as2.room, c.room) AS room,
            as2.qr_code,
            as2.qr_secret,
            as2.status,
            as2.created_at,
            COUNT(DISTINCT ar.student_id) AS attendees_count
           FROM attendance_sessions as2
           JOIN courses c ON as2.course_id = c.id
           LEFT JOIN attendance_records ar ON as2.id = ar.session_id
           WHERE c.teacher_id = ? AND as2.status = 'active' AND c.deleted_at IS NULL
           GROUP BY as2.id
           ORDER BY as2.created_at DESC`;

    const params = actorRole === 'admin' ? [] : [actorId];
    const [rows] = await pool.execute<any[]>(query, params);

    const mapped = [];
    for (const row of rows) {
      let secret = row.qr_secret;
      if (!secret) {
        secret = crypto.randomBytes(32).toString('hex');
        await pool.execute(`UPDATE attendance_sessions SET qr_secret = ? WHERE id = ?`, [secret, row.id]);
      }
      const { live_qr, expires_in } = buildLiveQrPayload(row.id, secret);
      mapped.push({
        id: row.id,
        course_id: row.course_id,
        course_name: row.course_name,
        course_code: row.course_code,
        date: row.date,
        time: row.time,
        room: row.room || null,
        qr_code: row.qr_code,
        live_qr,
        expires_in,
        status: row.status,
        created_at: row.created_at,
        attendees_count: parseInt(row.attendees_count) || 0,
      });
    }
    return mapped;
  } catch (error) {
    console.error('Error getting teacher sessions:', error);
    throw error;
  }
};

// Get all sessions for a specific course
export const getCourseSessions = async (actorId: string, courseId: string, actorRole?: string) => {
  try {
    const query =
      actorRole === 'admin'
        ? `SELECT 
            as2.id,
            as2.course_id,
            c.code AS course_code,
            c.name AS course_name,
            as2.date,
            as2.time,
            COALESCE(as2.room, c.room) AS room,
            as2.qr_code,
            as2.qr_secret,
            as2.status,
            as2.created_by,
            as2.created_at,
            as2.closed_at,
            COUNT(DISTINCT ar.student_id) AS attendees_count
           FROM attendance_sessions as2
           JOIN courses c ON as2.course_id = c.id
           LEFT JOIN attendance_records ar ON as2.id = ar.session_id
           WHERE as2.course_id = ?
           GROUP BY as2.id
           ORDER BY as2.created_at DESC`
        : `SELECT 
            as2.id,
            as2.course_id,
            c.code AS course_code,
            c.name AS course_name,
            as2.date,
            as2.time,
            COALESCE(as2.room, c.room) AS room,
            as2.qr_code,
            as2.qr_secret,
            as2.status,
            as2.created_by,
            as2.created_at,
            as2.closed_at,
            COUNT(DISTINCT ar.student_id) AS attendees_count
           FROM attendance_sessions as2
           JOIN courses c ON as2.course_id = c.id
           LEFT JOIN attendance_records ar ON as2.id = ar.session_id
           WHERE c.teacher_id = ? AND as2.course_id = ?
           GROUP BY as2.id
           ORDER BY as2.created_at DESC`;

    const params = actorRole === 'admin' ? [courseId] : [actorId, courseId];
    const [rows] = await pool.execute<any[]>(query, params);

    const mapped = [];
    for (const row of rows) {
      let liveInfo: { live_qr?: string; expires_in?: number } = {};
      if (row.status === 'active') {
        let secret = row.qr_secret;
        if (!secret) {
          secret = crypto.randomBytes(32).toString('hex');
          await pool.execute(`UPDATE attendance_sessions SET qr_secret = ? WHERE id = ?`, [secret, row.id]);
        }
        liveInfo = buildLiveQrPayload(row.id, secret);
      }
      mapped.push({
        id: row.id,
        course_id: row.course_id,
        course_name: row.course_name,
        course_code: row.course_code,
        date: row.date,
        time: row.time,
        room: row.room || null,
        qr_code: row.qr_code,
        ...liveInfo,
        status: row.status,
        created_by: row.created_by,
        created_at: row.created_at,
        closed_at: row.closed_at,
        attendees_count: parseInt(row.attendees_count) || 0,
      });
    }
    return mapped;
  } catch (error) {
    console.error('Error getting course sessions:', error);
    throw error;
  }
};

// Get session attendees
export const getSessionAttendees = async (sessionId: string) => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT 
        ar.id,
        ar.student_id,
        u.name AS student_name,
        u.email AS student_email,
        u.student_id AS student_number,
        ar.attendance_time,
        ar.method
       FROM attendance_records ar
       JOIN users u ON ar.student_id = u.id
       WHERE ar.session_id = ?
       ORDER BY ar.attendance_time DESC`,
      [sessionId]
    );

    return rows;
  } catch (error) {
    console.error('Error getting session attendees:', error);
    throw error;
  }
};

// Get active sessions for a student based on their enrolled courses
export const getStudentActiveSessions = async (studentId: string) => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT 
        as2.id,
        as2.course_id,
        c.code AS course_code,
        c.name AS course_name,
        u.name AS teacher_name,
        as2.date,
        as2.time,
        COALESCE(as2.room, c.room) AS room,
        as2.qr_code,
        as2.status,
        as2.created_at
       FROM attendance_sessions as2
       JOIN courses c ON as2.course_id = c.id
       LEFT JOIN users u ON c.teacher_id = u.id
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.student_id = ? AND as2.status = 'active' AND e.status = 'active' AND c.deleted_at IS NULL
       ORDER BY as2.created_at DESC`,
      [studentId]
    );
    return rows;
  } catch (error) {
    console.error('Error getting student active sessions:', error);
    throw error;
  }
};

/**
 * توليد رمز الـ QR الديناميكي المتغير كل 20 ثانية (TOTP)
 */
export const getLiveDynamicQR = async (
  sessionId: string
): Promise<{ qrCode: string; expiresIn: number; attendeesCount: number } | null> => {
  const [rows] = await pool.execute<any[]>(
    `SELECT as2.id, as2.qr_code, as2.qr_secret, as2.status, COUNT(DISTINCT ar.student_id) as attendees_count
     FROM attendance_sessions as2
     LEFT JOIN attendance_records ar ON as2.id = ar.session_id
     WHERE as2.id = ? AND as2.status = 'active'
     GROUP BY as2.id`,
    [sessionId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  let secret = row.qr_secret;
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    await pool.execute(`UPDATE attendance_sessions SET qr_secret = ? WHERE id = ?`, [secret, sessionId]);
  }

  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / QR_STEP_SECONDS);
  const token = computeAttendanceTOTP(secret, sessionId, currentWindow);
  const expiresIn = QR_STEP_SECONDS - (now % QR_STEP_SECONDS);

  return {
    qrCode: `HADIR:${sessionId}:${currentWindow}:${token}`,
    expiresIn,
    attendeesCount: parseInt(row.attendees_count) || 0,
  };
};
