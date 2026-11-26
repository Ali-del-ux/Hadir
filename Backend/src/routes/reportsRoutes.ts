import { calculateStudentGPA, computeAttendancePercentage, recalculateCourseGrade, resolveGradeOverride } from '../services/gradeEngineService';
import { Router } from 'express';
import { pool } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { ROLES } from '../utils/permissions';

const router = Router();

// Admin Stats - strictly admin only
router.get('/admin', authenticate, authorize(ROLES.ADMIN), async (_req: any, res) => {
  try {
    const [users] = await pool.execute<any[]>('SELECT count(*) as count FROM users WHERE deleted_at IS NULL');
    const [admins] = await pool.execute<any[]>('SELECT count(*) as count FROM admin_accounts WHERE is_active = 1');
    const [courses] = await pool.execute<any[]>('SELECT count(*) as count FROM courses WHERE deleted_at IS NULL');
    const [students] = await pool.execute<any[]>('SELECT count(*) as count FROM users WHERE role = "student" AND deleted_at IS NULL');
    const [teachers] = await pool.execute<any[]>('SELECT count(*) as count FROM users WHERE role = "teacher" AND deleted_at IS NULL');

    res.json({
      success: true,
      data: {
        totalUsers: Number(users[0].count) + Number(admins[0].count),
        admins: Number(admins[0].count),
        staff: Number(teachers[0].count),
        students: Number(students[0].count),
        courses: Number(courses[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Teacher Stats - teacher and admin
router.get('/teacher', authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN), async (req: any, res) => {
  try {
    const actorId = req.user.userId;
    const isAdmin = req.user.role === ROLES.ADMIN;

    const [courses] = isAdmin
      ? await pool.execute<any[]>('SELECT id, name, code FROM courses WHERE deleted_at IS NULL')
      : await pool.execute<any[]>('SELECT id, name, code FROM courses WHERE teacher_id = ? AND deleted_at IS NULL', [actorId]);

    let totalStudents = 0;
    const courseIds = courses.map((c: any) => c.id);

    if (courseIds.length > 0) {
      const [studentsRow] = await pool.query<any[]>(
        `SELECT count(DISTINCT student_id) as count FROM enrollments WHERE course_id IN (?) AND status = 'active'`,
        [courseIds]
      );
      totalStudents = Number(studentsRow[0]?.count) || 0;
    }

    const attendanceRates: number[] = [];
    const enrichedCourses: any[] = [];

    for (const c of courses) {
      const [enrStudents] = await pool.execute<any[]>(
        `SELECT e.student_id, e.total_score, e.attendance_override,
                (SELECT count(*) FROM attendance_sessions WHERE course_id = ?) as total_lectures,
                (SELECT count(DISTINCT ar.session_id) FROM attendance_records ar
                 JOIN attendance_sessions as2 ON ar.session_id = as2.id
                 WHERE as2.course_id = ? AND ar.student_id = e.student_id) as attended_count
         FROM enrollments e
         WHERE e.course_id = ? AND e.status = 'active'`,
        [c.id, c.id, c.id]
      );

      const courseAttValues: number[] = [];
      const courseScoreValues: number[] = [];

      for (const s of enrStudents) {
        const pct = computeAttendancePercentage(
          Number(s.total_lectures) || 0,
          Number(s.attended_count) || 0,
          s.attendance_override
        );
        if (pct !== null) {
          courseAttValues.push(pct);
          attendanceRates.push(pct);
        }
        if (s.total_score !== null && s.total_score !== undefined) {
          courseScoreValues.push(parseFloat(s.total_score));
        }
      }

      const courseAvgAttendance = courseAttValues.length > 0
        ? Math.round(courseAttValues.reduce((a, b) => a + b, 0) / courseAttValues.length)
        : null;
      const courseAvgScore = courseScoreValues.length > 0
        ? Math.round((courseScoreValues.reduce((a, b) => a + b, 0) / courseScoreValues.length) * 10) / 10
        : null;

      enrichedCourses.push({
        id: c.id,
        name: c.name,
        code: c.code,
        studentsCount: enrStudents.length,
        averageAttendance: courseAvgAttendance,
        averageScore: courseAvgScore,
        averageGrade: courseAvgScore,
      });
    }

    const avgAttendance = attendanceRates.length > 0
      ? Math.round((attendanceRates.reduce((a, b) => a + b, 0) / attendanceRates.length) * 10) / 10
      : null;

    res.json({
      success: true,
      data: {
        totalCourses: courses.length,
        totalStudents,
        averageAttendance: avgAttendance,
        courses: enrichedCourses,
      }
    });
  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Student Stats - student and admin
router.get('/student', authenticate, authorize(ROLES.STUDENT, ROLES.ADMIN), async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const gpaResult = await calculateStudentGPA(userId);

    const [enrollments] = await pool.execute<any[]>(
      `SELECT c.id, c.name, c.code, c.credit_hours, e.total_score, e.letter_grade, e.grade_points, e.final_grade, e.attendance_override,
              (SELECT count(*) FROM attendance_sessions ats WHERE ats.course_id = c.id) as total_lectures,
              (SELECT count(DISTINCT ar.session_id) FROM attendance_records ar
               JOIN attendance_sessions ats ON ar.session_id = ats.id
               WHERE ats.course_id = c.id AND ar.student_id = ?) as attended_lectures
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = ? AND e.status = 'active' AND c.deleted_at IS NULL`,
      [userId, userId]
    );

    const [subCountRows] = await pool.execute<any[]>(
      `SELECT count(DISTINCT asub.assignment_id) as count
       FROM assignment_submissions asub
       JOIN assignments a ON asub.assignment_id = a.id
       JOIN enrollments e ON a.course_id = e.course_id AND e.student_id = asub.student_id
       WHERE asub.student_id = ? AND e.status = 'active' AND a.deleted_at IS NULL AND asub.status IN ('submitted', 'graded')`,
      [userId]
    );
    const assignmentsCompleted = Number(subCountRows[0]?.count) || 0;

    const coursesWithStats = enrollments.map((c: any) => {
      const total = Number(c.total_lectures) || 0;
      const baseAttended = Number(c.attended_lectures) || 0;
      const override = c.attendance_override !== null && c.attendance_override !== undefined ? Number(c.attendance_override) : 0;
      const effectiveAttended = total > 0
        ? Math.max(0, Math.min(total, baseAttended + override))
        : (override > 0 ? override : 0);
      const percentage = computeAttendancePercentage(total, baseAttended, c.attendance_override);

      const effectiveLetter = c.letter_grade || c.final_grade || null;
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        creditHours: parseInt(c.credit_hours) || 3,
        totalScore: c.total_score !== null ? parseFloat(c.total_score) : null,
        letterGrade: effectiveLetter,
        gradePoints: c.grade_points !== null ? parseFloat(c.grade_points) : null,
        total_lectures: total,
        attended_lectures: effectiveAttended,
        attendancePercentage: percentage,
        finalGrade: c.final_grade || effectiveLetter
      };
    });

    const gradedAttCourses = coursesWithStats.filter((c) => c.attendancePercentage !== null);
    const avgAttendance = gradedAttCourses.length > 0
      ? Math.min(100, Math.round(gradedAttCourses.reduce((acc: number, c: any) => acc + (c.attendancePercentage as number), 0) / gradedAttCourses.length))
      : null;

    res.json({
      success: true,
      data: {
        gpa: gpaResult.gpa,
        totalCredits: gpaResult.totalCredits,
        gradedCredits: gpaResult.gradedCredits,
        enrolledCourses: enrollments.length,
        attendanceRate: avgAttendance,
        assignmentsCompleted,
        courses: coursesWithStats
      }
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Teacher: Get specific course details (students & attendance & grades)
router.get('/teacher/course/:courseId', authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN), async (req: any, res) => {
  try {
    const { courseId } = req.params;

    const [courseRows] = await pool.execute<any[]>(
      'SELECT id, name, code, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL',
      [courseId]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const course = courseRows[0];

    if (req.user.role !== ROLES.ADMIN && course.teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not teach this course.' });
    }

    const [students] = await pool.execute<any[]>(
      `SELECT 
          u.id, 
          u.name, 
          u.student_id, 
          u.avatar,
          e.total_score,
          e.letter_grade,
          e.final_grade,
          e.attendance_override,
          (SELECT count(DISTINCT ar.session_id) FROM attendance_records ar 
           JOIN attendance_sessions as2 ON ar.session_id = as2.id 
           WHERE as2.course_id = ? AND ar.student_id = u.id) as attended_count,
          (SELECT count(*) FROM attendance_sessions WHERE course_id = ?) as total_lectures
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       WHERE e.course_id = ? AND e.status = 'active'
       ORDER BY u.name ASC`,
      [courseId, courseId, courseId]
    );

    const studentsWithStats = students.map(s => {
      const total = Number(s.total_lectures) || 0;
      const baseAttended = Number(s.attended_count) || 0;
      const override = s.attendance_override !== null && s.attendance_override !== undefined ? Number(s.attendance_override) : 0;
      const effectiveAttended = total > 0
        ? Math.max(0, Math.min(total, baseAttended + override))
        : (override > 0 ? override : 0);
      const percentage = computeAttendancePercentage(total, baseAttended, s.attendance_override);

      const effectiveLetter = s.letter_grade || s.final_grade || null;
      return {
        id: s.id,
        name: s.name,
        studentId: s.student_id,
        avatar: s.avatar,
        attendancePercentage: percentage,
        attendedLectures: effectiveAttended,
        totalLectures: total,
        totalScore: s.total_score !== null ? parseFloat(s.total_score) : null,
        letterGrade: effectiveLetter,
        finalGrade: s.final_grade || effectiveLetter,
        gradeOverride: s.final_grade || null,
        attendanceOverride: override
      };
    });

    res.json({
      success: true,
      data: {
        course: {
          id: course.id,
          name: course.name,
          code: course.code,
          teacher_id: course.teacher_id,
        },
        students: studentsWithStats
      }
    });
  } catch (error) {
    console.error('Error fetching course details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Teacher: Update grades and attendance override for a course & sync gradebook
router.put('/teacher/course/:courseId/update', authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN), async (req: any, res) => {
  try {
    const { courseId } = req.params;
    const { updates } = req.body;

    const [courseRows] = await pool.execute<any[]>(
      'SELECT id, teacher_id FROM courses WHERE id = ? AND deleted_at IS NULL',
      [courseId]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    const course = courseRows[0];

    if (req.user.role !== ROLES.ADMIN && course.teacher_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not teach this course.' });
    }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    for (const update of updates) {
      const { studentId, finalGrade, attendanceOverride } = update;
      if (!studentId) continue;

      let resolvedGrade = null;
      try {
        resolvedGrade = resolveGradeOverride(finalGrade);
      } catch (validationErr: any) {
        return res.status(400).json({ success: false, message: validationErr.message });
      }

      const parsedOverride = attendanceOverride !== undefined && attendanceOverride !== null && attendanceOverride !== ''
        ? parseInt(String(attendanceOverride), 10) || 0
        : null;

      await pool.execute(
        `UPDATE enrollments SET final_grade = ?, attendance_override = ? WHERE course_id = ? AND student_id = ?`,
        [resolvedGrade ? resolvedGrade.normalized : null, parsedOverride, courseId, studentId]
      );

      // Sync Gradebook & GPA with updated final_grade and attendance_override
      await recalculateCourseGrade(courseId, studentId);
    }

    res.json({ success: true, message: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating course details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
