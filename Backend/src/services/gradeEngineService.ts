import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface GradeItem {
  id: number;
  course_id: string;
  name: string;
  category: 'attendance' | 'assignments' | 'midterm' | 'final' | 'other';
  weight: number;
  max_score: number;
}

export interface CreateGradeItemInput {
  id?: number;
  name: string;
  category: 'attendance' | 'assignments' | 'midterm' | 'final' | 'other';
  weight: number;
  max_score: number;
}

export interface StudentGrade {
  id: number;
  course_id: string;
  student_id: string;
  grade_item_id: number;
  score: number | null;
  version: number;
  graded_by: string | null;
  graded_at: string | null;
}

export interface CourseGradeResult {
  courseId: string;
  studentId: string;
  totalScore: number | null;
  letterGrade: string | null;
  gradePoints: number | null;
}

export interface CourseGPAEntry {
  courseId: string;
  courseName: string;
  courseCode: string;
  creditHours: number;
  totalScore: number | null;
  letterGrade: string | null;
  finalGrade?: string | null;
  gradePoints: number | null;
  attendancePercentage: number | null;
}

export interface GPAResult {
  gpa: number | null;
  totalCredits: number;
  gradedCredits: number;
  courses: CourseGPAEntry[];
}

export interface StudentGradebookItem {
  gradeItemId: number;
  name: string;
  category: string;
  weight: number;
  maxScore: number;
  score: number | null;
  weightedScore: number | null;
}

export interface StudentCourseGradebook {
  courseId: string;
  courseName: string;
  totalScore: number | null;
  letterGrade: string | null;
  finalGrade?: string | null;
  gradePoints: number | null;
  attendancePercentage: number | null;
  items: StudentGradebookItem[];
}

const LETTER_GRADE_MAP: Record<string, { letterGrade: string; gradePoints: number }> = {
  'A+': { letterGrade: 'A', gradePoints: 4.00 },
  'A': { letterGrade: 'A', gradePoints: 4.00 },
  'B+': { letterGrade: 'B+', gradePoints: 3.50 },
  'B': { letterGrade: 'B', gradePoints: 3.00 },
  'C+': { letterGrade: 'C+', gradePoints: 2.50 },
  'C': { letterGrade: 'C', gradePoints: 2.00 },
  'D': { letterGrade: 'D', gradePoints: 1.00 },
  'F': { letterGrade: 'F', gradePoints: 0.00 },
};

export interface ResolvedGradeOverride {
  normalized: string;
  totalScore?: number;
  letterGrade: string;
  gradePoints: number;
}

export function resolveGradeOverride(raw: string | number | null | undefined): ResolvedGradeOverride | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (LETTER_GRADE_MAP[upper]) {
    const mapped = LETTER_GRADE_MAP[upper];
    return {
      normalized: mapped.letterGrade,
      letterGrade: mapped.letterGrade,
      gradePoints: mapped.gradePoints,
    };
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw new Error('الدرجة الرقمية يجب أن تكون بين 0 و 100');
    }
    const rounded = Math.round(num * 100) / 100;
    const mapped = scoreToLetterAndPoints(rounded);
    return {
      normalized: String(rounded),
      totalScore: rounded,
      letterGrade: mapped.letterGrade,
      gradePoints: mapped.gradePoints,
    };
  }

  throw new Error('قيمة التقدير غير صالحة. القيم المسموحة: A, B+, B, C+, C, D, F أو درجة من 0 إلى 100');
}

// Convert numeric percentage (0-100) to Letter Grade and 4.0 Scale
export function scoreToLetterAndPoints(score: number): { letterGrade: string; gradePoints: number } {
  if (score >= 90) return { letterGrade: 'A', gradePoints: 4.00 };
  if (score >= 85) return { letterGrade: 'B+', gradePoints: 3.50 };
  if (score >= 80) return { letterGrade: 'B', gradePoints: 3.00 };
  if (score >= 75) return { letterGrade: 'C+', gradePoints: 2.50 };
  if (score >= 70) return { letterGrade: 'C', gradePoints: 2.00 };
  if (score >= 60) return { letterGrade: 'D', gradePoints: 1.00 };
  return { letterGrade: 'F', gradePoints: 0.00 };
}

export function computeAttendancePercentage(
  totalSessions: number,
  attendedCount: number,
  attendanceOverride: number | null | undefined
): number | null {
  const override = attendanceOverride !== null && attendanceOverride !== undefined ? Number(attendanceOverride) : 0;
  if (totalSessions === 0) {
    if (override > 0) return 100;
    return null;
  }
  const effectiveAttended = Math.max(0, Math.min(totalSessions, attendedCount + override));
  return Math.min(100, Math.max(0, Math.round((effectiveAttended / totalSessions) * 100)));
}

async function getStudentCourseAttendance(courseId: string, studentId: string): Promise<number | null> {
  const [sessionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM attendance_sessions WHERE course_id = ?`,
    [courseId]
  );
  const totalSessions = Number(sessionRows[0]?.total) || 0;

  const [attendedRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT ar.session_id) as attended
     FROM attendance_records ar
     JOIN attendance_sessions s ON ar.session_id = s.id
     WHERE s.course_id = ? AND ar.student_id = ?`,
    [courseId, studentId]
  );
  const attendedCount = Number(attendedRows[0]?.attended) || 0;

  const [enrRows] = await pool.execute<RowDataPacket[]>(
    `SELECT attendance_override FROM enrollments WHERE course_id = ? AND student_id = ? LIMIT 1`,
    [courseId, studentId]
  );
  const override = enrRows[0]?.attendance_override ?? null;

  return computeAttendancePercentage(totalSessions, attendedCount, override);
}

/**
 * 1. جلب بنود التقييم لمقرر معين (Grade Items)
 * إذا لم تكن موجودة، يتم إنشاء التوزيع الافتراضي تلقائياً (10%, 20%, 30%, 40%).
 */
export async function getGradeItems(courseId: string): Promise<GradeItem[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, course_id, name, category, weight, max_score
     FROM course_grade_items
     WHERE course_id = ?
     ORDER BY FIELD(category, 'attendance', 'assignments', 'midterm', 'final', 'other'), id ASC`,
    [courseId]
  );

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      course_id: r.course_id,
      name: r.name,
      category: r.category,
      weight: parseFloat(r.weight),
      max_score: parseFloat(r.max_score),
    }));
  }

  const defaultItems: CreateGradeItemInput[] = [
    { name: 'الحضور والالتزام', category: 'attendance', weight: 10, max_score: 100 },
    { name: 'الواجبات والتكليفات', category: 'assignments', weight: 20, max_score: 100 },
    { name: 'الامتحان النصفي', category: 'midterm', weight: 30, max_score: 100 },
    { name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
  ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [recheck] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM course_grade_items WHERE course_id = ? FOR UPDATE`,
      [courseId]
    );
    if (recheck.length === 0) {
      for (const item of defaultItems) {
        await conn.execute(
          `INSERT INTO course_grade_items (course_id, name, category, weight, max_score)
           VALUES (?, ?, ?, ?, ?)`,
          [courseId, item.name, item.category, item.weight, item.max_score]
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [createdRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, course_id, name, category, weight, max_score
     FROM course_grade_items
     WHERE course_id = ?
     ORDER BY FIELD(category, 'attendance', 'assignments', 'midterm', 'final', 'other'), id ASC`,
    [courseId]
  );

  return createdRows.map((r) => ({
    id: r.id,
    course_id: r.course_id,
    name: r.name,
    category: r.category,
    weight: parseFloat(r.weight),
    max_score: parseFloat(r.max_score),
  }));
}

/**
 * 2. تخصيص وضبط أوزان الدرجات للمقرر عبر Diff-Based Upsert
 * يحافظ على درجات الطلاب المرصودة للبنود المستمرة دون مسحها.
 */
export async function setGradeItems(
  courseId: string,
  actorId: string,
  items: CreateGradeItemInput[],
  actorRole?: string
): Promise<GradeItem[]> {
  const [courseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );
  if (courseRows.length === 0 || (actorRole !== 'admin' && courseRows[0].teacher_id !== actorId)) {
    throw new Error('غير مصرح: هذا المقرر لا يتبع لك أو غير موجود');
  }

  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new Error(`مجموع أوزان الدرجات يجب أن يساوي 100% تماماً. المجموع الحالي هو: ${totalWeight}%`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM course_grade_items WHERE course_id = ? FOR UPDATE`,
      [courseId]
    );
    const existingIdSet = new Set<number>(existingRows.map((r) => Number(r.id)));

    const retainedIds = items
      .map((i) => (i.id !== undefined && i.id !== null ? Number(i.id) : NaN))
      .filter((id) => !isNaN(id) && existingIdSet.has(id));

    // Delete only items removed by the teacher
    const idsToDelete = [...existingIdSet].filter((id) => !retainedIds.includes(id));
    if (idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM course_grade_items WHERE course_id = ? AND id IN (${placeholders})`,
        [courseId, ...idsToDelete]
      );
    }

    // Update retained items in-place, insert new items
    for (const item of items) {
      const itemId = item.id !== undefined && item.id !== null ? Number(item.id) : NaN;
      const maxScore = Number(item.max_score) || 100;
      const weight = Number(item.weight);

      if (!isNaN(itemId) && existingIdSet.has(itemId)) {
        await conn.execute(
          `UPDATE course_grade_items
           SET name = ?, category = ?, weight = ?, max_score = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND course_id = ?`,
          [item.name, item.category, weight, maxScore, itemId, courseId]
        );
      } else {
        await conn.execute(
          `INSERT INTO course_grade_items (course_id, name, category, weight, max_score)
           VALUES (?, ?, ?, ?, ?)`,
          [courseId, item.name, item.category, weight, maxScore]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [enrolled] = await pool.execute<RowDataPacket[]>(
    `SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'active'`,
    [courseId]
  );
  for (const s of enrolled) {
    await recalculateCourseGrade(courseId, s.student_id);
  }

  return getGradeItems(courseId);
}

/**
 * 3. رصد درجة طالب في بند معين مع Optimistic Locking ومعاملة ذرية
 */
export async function setStudentGrade(params: {
  courseId: string;
  studentId: string;
  gradeItemId: number;
  score: number;
  gradedBy: string;
  actorRole?: string;
}): Promise<void> {
  const { courseId, studentId, gradeItemId, score, gradedBy, actorRole } = params;

  const [courseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );
  if (courseRows.length === 0 || (actorRole !== 'admin' && courseRows[0].teacher_id !== gradedBy)) {
    throw new Error('غير مصرح لك برصد درجات هذا المقرر');
  }

  const [itemRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, max_score FROM course_grade_items WHERE id = ? AND course_id = ?`,
    [gradeItemId, courseId]
  );
  if (itemRows.length === 0) {
    throw new Error('بند التقييم غير موجود في هذا المقرر');
  }

  const maxScore = parseFloat(itemRows[0].max_score);
  if (score < 0 || score > maxScore) {
    throw new Error(`الدرجة المرصودة (${score}) غير صالحة. الحد الأقصى للبند هو ${maxScore}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute<RowDataPacket[]>(
      `SELECT id, version FROM student_grades WHERE student_id = ? AND grade_item_id = ? FOR UPDATE`,
      [studentId, gradeItemId]
    );

    if (existing.length === 0) {
      await conn.execute(
        `INSERT INTO student_grades (course_id, student_id, grade_item_id, score, version, graded_by, graded_at)
         VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
        [courseId, studentId, gradeItemId, score, gradedBy]
      );
    } else {
      const currentVersion = existing[0].version;
      const [updateResult] = await conn.execute<ResultSetHeader>(
        `UPDATE student_grades
         SET score = ?, version = version + 1, graded_by = ?, graded_at = CURRENT_TIMESTAMP
         WHERE id = ? AND version = ?`,
        [score, gradedBy, existing[0].id, currentVersion]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error('تم تعديل هذه الدرجة بواسطة مستخدم آخر بالتزامن. يرجى تحديث الصفحة والمحاولة مجدداً.');
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await recalculateCourseGrade(courseId, studentId);
}

/**
 * 3b. رصد/تحديث مجموعة درجات دفعة واحدة (لطالب واحد أو لجميع الطلاب) في معاملة ذرية واحدة
 */
export async function setStudentGradesBatch(params: {
  courseId: string;
  entries: Array<{ studentId: string; gradeItemId: number; score: number }>;
  gradedBy: string;
  actorRole?: string;
}): Promise<{ updatedCount: number; affectedStudents: string[] }> {
  const { courseId, entries, gradedBy, actorRole } = params;

  const [courseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );
  if (courseRows.length === 0 || (actorRole !== 'admin' && courseRows[0].teacher_id !== gradedBy)) {
    throw new Error('غير مصرح لك برصد درجات هذا المقرر');
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('لا توجد درجات مرسلة للحفظ');
  }

  const items = await getGradeItems(courseId);
  const itemMaxScoreMap = new Map<number, number>();
  for (const it of items) {
    if (it.category !== 'attendance') {
      itemMaxScoreMap.set(it.id, it.max_score);
    }
  }

  const [enrolledRows] = await pool.execute<RowDataPacket[]>(
    `SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'active'`,
    [courseId]
  );
  const enrolledSet = new Set<string>(enrolledRows.map((r) => String(r.student_id)));

  for (const entry of entries) {
    const sid = String(entry.studentId || '').trim();
    const itemId = Number(entry.gradeItemId);
    const score = Number(entry.score);
    if (!sid || !enrolledSet.has(sid)) {
      throw new Error(`الطالب (${sid || 'غير معروف'}) غير مسجل في هذا المقرر`);
    }
    if (!itemMaxScoreMap.has(itemId)) {
      throw new Error(`بند التقييم (${itemId}) غير موجود أو محسوب تلقائياً`);
    }
    const maxScore = itemMaxScoreMap.get(itemId)!;
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      throw new Error(`الدرجة المرصودة (${entry.score}) غير صالحة. الحد الأقصى للبند هو ${maxScore}`);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const entry of entries) {
      const sid = String(entry.studentId).trim();
      const itemId = Number(entry.gradeItemId);
      const score = Number(entry.score);

      const [existing] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM student_grades WHERE student_id = ? AND grade_item_id = ? FOR UPDATE`,
        [sid, itemId]
      );

      if (existing.length === 0) {
        await conn.execute(
          `INSERT INTO student_grades (course_id, student_id, grade_item_id, score, version, graded_by, graded_at)
           VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
          [courseId, sid, itemId, score, gradedBy]
        );
      } else {
        await conn.execute(
          `UPDATE student_grades
           SET score = ?, version = version + 1, graded_by = ?, graded_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [score, gradedBy, existing[0].id]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const affectedStudents = [...new Set(entries.map((e) => String(e.studentId).trim()))];
  for (const sid of affectedStudents) {
    await recalculateCourseGrade(courseId, sid);
  }

  return {
    updatedCount: entries.length,
    affectedStudents,
  };
}

/**
 * 4. إعادة حساب الدرجة الإجمالية للطالب وفق معيار Exclude Empty Grades
 * (sum of (score/max_score)*weight for non-null items) / gradedWeightSum * 100
 */
export async function recalculateCourseGrade(courseId: string, studentId: string): Promise<CourseGradeResult> {
  const items = await getGradeItems(courseId);
  const attendancePercentage = await getStudentCourseAttendance(courseId, studentId);

  const [scoresRows] = await pool.execute<RowDataPacket[]>(
    `SELECT grade_item_id, score FROM student_grades WHERE student_id = ? AND course_id = ?`,
    [studentId, courseId]
  );
  const scoreMap = new Map<number, number>();
  for (const row of scoresRows) {
    if (row.score !== null) {
      scoreMap.set(row.grade_item_id, parseFloat(row.score));
    }
  }

  let weightedSum = 0;
  let gradedWeightSum = 0;

  for (const item of items) {
    let itemScore: number | null = null;

    if (item.category === 'attendance') {
      if (attendancePercentage !== null) {
        itemScore = (attendancePercentage / 100) * item.max_score;
      }
    } else if (scoreMap.has(item.id)) {
      itemScore = scoreMap.get(item.id)!;
    }

    if (itemScore !== null && item.max_score > 0) {
      weightedSum += (itemScore / item.max_score) * item.weight;
      gradedWeightSum += item.weight;
    }
  }

  const [enrRows] = await pool.execute<RowDataPacket[]>(
    `SELECT final_grade FROM enrollments WHERE course_id = ? AND student_id = ? LIMIT 1`,
    [courseId, studentId]
  );

  let override: ResolvedGradeOverride | null = null;
  try {
    override = resolveGradeOverride(enrRows[0]?.final_grade);
  } catch {
    override = null;
  }

  const computedTotalScore =
    gradedWeightSum > 0
      ? Math.min(100, Math.max(0, Math.round((weightedSum / gradedWeightSum) * 100 * 100) / 100))
      : null;

  let effectiveTotalScore: number | null = computedTotalScore;
  let effectiveLetterGrade: string | null = null;
  let effectiveGradePoints: number | null = null;

  if (computedTotalScore !== null) {
    const computed = scoreToLetterAndPoints(computedTotalScore);
    effectiveLetterGrade = computed.letterGrade;
    effectiveGradePoints = computed.gradePoints;
  }

  if (override) {
    if (override.totalScore !== undefined) {
      effectiveTotalScore = override.totalScore;
    }
    effectiveLetterGrade = override.letterGrade;
    effectiveGradePoints = override.gradePoints;
  }

  await pool.execute(
    `UPDATE enrollments 
     SET total_score = ?, letter_grade = ?, grade_points = ?
     WHERE course_id = ? AND student_id = ?`,
    [effectiveTotalScore, effectiveLetterGrade, effectiveGradePoints, courseId, studentId]
  );

  return {
    courseId,
    studentId,
    totalScore: effectiveTotalScore,
    letterGrade: effectiveLetterGrade,
    gradePoints: effectiveGradePoints,
  };
}

/**
 * 5. حساب المعدل التراكمي (GPA) الحقيقي للطالب عبر الساعات المعتمدة
 * يرجع gpa: null عندما gradedCredits === 0
 */
export async function calculateStudentGPA(studentId: string): Promise<GPAResult> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id as course_id, c.name as course_name, c.code as course_code,
            c.credit_hours, e.total_score, e.letter_grade, e.final_grade, e.grade_points, e.attendance_override,
            (SELECT COUNT(*) FROM attendance_sessions s WHERE s.course_id = c.id) as total_sessions,
            (SELECT COUNT(DISTINCT ar.session_id) FROM attendance_records ar 
             JOIN attendance_sessions s ON ar.session_id = s.id 
             WHERE s.course_id = c.id AND ar.student_id = ?) as attended_sessions
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     WHERE e.student_id = ? AND e.status = 'active' AND c.deleted_at IS NULL`,
    [studentId, studentId]
  );

  let totalPointsAccumulator = 0;
  let totalGradedCredits = 0;
  let totalAllCredits = 0;

  const courses: CourseGPAEntry[] = rows.map((r) => {
    const credits = parseInt(r.credit_hours) || 3;
    totalAllCredits += credits;

    const totalSessions = Number(r.total_sessions) || 0;
    const attendedSessions = Number(r.attended_sessions) || 0;
    const attendancePercentage = computeAttendancePercentage(totalSessions, attendedSessions, r.attendance_override);

    const score = r.total_score !== null ? parseFloat(r.total_score) : null;
    const gradePoints = r.grade_points !== null ? parseFloat(r.grade_points) : null;

    if (gradePoints !== null) {
      totalPointsAccumulator += gradePoints * credits;
      totalGradedCredits += credits;
    }

    const effectiveLetter = r.letter_grade || r.final_grade || null;
    return {
      courseId: r.course_id,
      courseName: r.course_name,
      courseCode: r.course_code,
      creditHours: credits,
      totalScore: score,
      letterGrade: effectiveLetter,
      finalGrade: r.final_grade || effectiveLetter,
      gradePoints,
      attendancePercentage,
    };
  });

  const cumulativeGpa = totalGradedCredits > 0
    ? Math.round((totalPointsAccumulator / totalGradedCredits) * 100) / 100
    : null;

  return {
    gpa: cumulativeGpa,
    totalCredits: totalAllCredits,
    gradedCredits: totalGradedCredits,
    courses,
  };
}

/**
 * 6. جلب كشف درجات الطالب لمقرر معين (تفصيل كل بند + الإجمالي)
 */
export async function getStudentGradebook(courseId: string, studentId: string): Promise<StudentCourseGradebook> {
  const [courseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.name, e.total_score, e.letter_grade, e.final_grade, e.grade_points
     FROM courses c
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
     WHERE c.id = ? AND c.deleted_at IS NULL`,
    [studentId, courseId]
  );

  if (courseRows.length === 0) {
    throw new Error('المقرر غير موجود أو أنك غير مسجل فيه');
  }

  const courseInfo = courseRows[0];
  const items = await getGradeItems(courseId);
  const attendancePercentage = await getStudentCourseAttendance(courseId, studentId);

  const [scores] = await pool.execute<RowDataPacket[]>(
    `SELECT grade_item_id, score FROM student_grades WHERE student_id = ? AND course_id = ?`,
    [studentId, courseId]
  );
  const scoreMap = new Map<number, number>();
  for (const s of scores) {
    if (s.score !== null) scoreMap.set(s.grade_item_id, parseFloat(s.score));
  }

  const mappedItems: StudentGradebookItem[] = items.map((item) => {
    let score: number | null = null;
    if (item.category === 'attendance') {
      if (attendancePercentage !== null) {
        score = Math.round((attendancePercentage / 100) * item.max_score * 10) / 10;
      }
    } else if (scoreMap.has(item.id)) {
      score = scoreMap.get(item.id)!;
    }

    const weightedScore = score !== null && item.max_score > 0
      ? Math.round((score / item.max_score) * item.weight * 10) / 10
      : null;

    return {
      gradeItemId: item.id,
      name: item.name,
      category: item.category,
      weight: item.weight,
      maxScore: item.max_score,
      score,
      weightedScore,
    };
  });

  const effectiveLetter = courseInfo.letter_grade || courseInfo.final_grade || null;
  return {
    courseId: courseInfo.id,
    courseName: courseInfo.name,
    totalScore: courseInfo.total_score !== null ? parseFloat(courseInfo.total_score) : null,
    letterGrade: effectiveLetter,
    finalGrade: courseInfo.final_grade || effectiveLetter,
    gradePoints: courseInfo.grade_points !== null ? parseFloat(courseInfo.grade_points) : null,
    attendancePercentage,
    items: mappedItems,
  };
}

/**
 * 7. دفتر الدرجات الكامل للمقرر للأستاذ (Moodle-Style Matrix)
 */
export async function getCourseGradebookMatrix(courseId: string, actorId: string, actorRole?: string) {
  const [courseRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, code, credit_hours, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL`,
    [courseId]
  );
  if (courseRows.length === 0 || (actorRole !== 'admin' && courseRows[0].teacher_id !== actorId)) {
    throw new Error('المقرر غير موجود أو لا تملك صلاحية الوصول إليه');
  }

  const items = await getGradeItems(courseId);

  const [students] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.name, u.email, u.student_id, e.total_score, e.letter_grade, e.final_grade, e.grade_points, e.attendance_override
     FROM enrollments e
     JOIN users u ON e.student_id = u.id
     WHERE e.course_id = ? AND e.status = 'active'
     ORDER BY u.name ASC`,
    [courseId]
  );

  const [allScores] = await pool.execute<RowDataPacket[]>(
    `SELECT student_id, grade_item_id, score FROM student_grades WHERE course_id = ?`,
    [courseId]
  );
  const studentScoresMap = new Map<string, Map<number, number>>();
  for (const row of allScores) {
    if (row.score === null) continue;
    if (!studentScoresMap.has(row.student_id)) {
      studentScoresMap.set(row.student_id, new Map());
    }
    studentScoresMap.get(row.student_id)!.set(row.grade_item_id, parseFloat(row.score));
  }

  const [sessionRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM attendance_sessions WHERE course_id = ?`,
    [courseId]
  );
  const totalSessions = Number(sessionRows[0]?.total) || 0;

  const [attendanceCounts] = await pool.execute<RowDataPacket[]>(
    `SELECT ar.student_id, COUNT(DISTINCT ar.session_id) as attended
     FROM attendance_records ar
     JOIN attendance_sessions s ON ar.session_id = s.id
     WHERE s.course_id = ?
     GROUP BY ar.student_id`,
    [courseId]
  );
  const attendanceMap = new Map<string, number>();
  for (const a of attendanceCounts) {
    attendanceMap.set(a.student_id, Number(a.attended) || 0);
  }

  const studentEntries = students.map((s) => {
    const attended = attendanceMap.get(s.id) || 0;
    const attendancePercentage = computeAttendancePercentage(totalSessions, attended, s.attendance_override);

    const scoresObj: Record<number, number | null> = {};
    for (const item of items) {
      if (item.category === 'attendance') {
        scoresObj[item.id] = attendancePercentage !== null
          ? Math.round((attendancePercentage / 100) * item.max_score * 10) / 10
          : null;
      } else {
        const studentMap = studentScoresMap.get(s.id);
        scoresObj[item.id] = studentMap && studentMap.has(item.id) ? studentMap.get(item.id)! : null;
      }
    }

    const effectiveLetter = s.letter_grade || s.final_grade || null;
    return {
      studentId: s.id,
      studentName: s.name,
      studentNumber: s.student_id || s.email,
      attendancePercentage,
      scores: scoresObj,
      totalScore: s.total_score !== null ? parseFloat(s.total_score) : null,
      letterGrade: effectiveLetter,
      finalGrade: s.final_grade || effectiveLetter,
      gradeOverride: s.final_grade || null,
      gradePoints: s.grade_points !== null ? parseFloat(s.grade_points) : null,
    };
  });

  return {
    course: {
      id: courseRows[0].id,
      name: courseRows[0].name,
      code: courseRows[0].code,
      credit_hours: courseRows[0].credit_hours,
    },
    gradeItems: items,
    totalSessions,
    students: studentEntries,
  };
}
