import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { checkSessionOwnership, checkCourseOwnership } from '../middleware/ownership';
import { ROLES } from '../utils/permissions';
import { validateRequest } from '../middleware/validator';
import { createSessionSchema, markAttendanceSchema, recordAttendanceByStudentSchema } from '../schemas/attendance.schema';
import * as attendanceService from '../services/attendanceService';
import * as attendanceRecordService from '../services/attendanceRecordService';

const router = Router();

// ==================== Teacher Routes ====================
const teacherRoutes = Router();
teacherRoutes.use(authenticate);
teacherRoutes.use(authorize(ROLES.TEACHER, ROLES.ADMIN));

// POST /api/attendance/teacher/sessions - Create attendance session
teacherRoutes.post('/sessions', checkCourseOwnership, validateRequest(createSessionSchema), async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    const { course_id, date, time, room } = req.body;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }

    const now = new Date();
    const resolvedDate = date || now.toISOString().split('T')[0];
    const resolvedTime = time || now.toTimeString().slice(0, 8);

    const session = await attendanceService.createAttendanceSession(
      actorId,
      {
        course_id,
        date: resolvedDate,
        time: resolvedTime,
        room,
      },
      actorRole
    );

    res.status(201).json({
      success: true,
      message: 'Attendance session created successfully',
      data: session,
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    if (error.message?.includes('already exists') || error.message?.includes('not found')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message?.includes('not assigned')) {
      return res.status(403).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// GET /api/attendance/teacher/sessions/active - Get active sessions for teacher (or all for admin)
teacherRoutes.get('/sessions/active', async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    const sessions = await attendanceService.getTeacherActiveSessions(actorId, actorRole);
    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    console.error('Get active sessions error:', error);
    next(error);
  }
});

// GET /api/attendance/teacher/course/:courseId/sessions - Get all sessions for a course
teacherRoutes.get('/course/:courseId/sessions', checkCourseOwnership, async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    const courseId = req.params.courseId;
    const sessions = await attendanceService.getCourseSessions(actorId, courseId, actorRole);
    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    console.error('Get course sessions error:', error);
    next(error);
  }
});

// GET /api/attendance/teacher/sessions/:id/live-qr - Get dynamic 20s rotating QR code
teacherRoutes.get('/sessions/:id/live-qr', checkSessionOwnership, async (req, res, next) => {
  try {
    const liveData = await attendanceService.getLiveDynamicQR(req.params.id as string);
    if (!liveData) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found or closed',
      });
    }
    res.json({
      success: true,
      data: liveData,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/attendance/teacher/sessions/:id - Get session details
teacherRoutes.get('/sessions/:id', checkSessionOwnership, async (req, res, next) => {
  try {
    const session = await attendanceService.getAttendanceSessionById(req.params.id as string);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }
    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    next(error);
  }
});

// POST /api/attendance/teacher/sessions/:id/refresh-qr - Rotate secret & return fresh TOTP QR
teacherRoutes.post('/sessions/:id/refresh-qr', checkSessionOwnership, async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    const qrCode = await attendanceService.refreshQRCode(req.params.id, actorId, actorRole);
    res.json({
      success: true,
      message: 'QR code refreshed successfully',
      data: { qr_code: qrCode, qrCode },
    });
  } catch (error: any) {
    console.error('Refresh QR error:', error);
    next(error);
  }
});

// POST /api/attendance/teacher/sessions/:id/close - Close attendance session
teacherRoutes.post('/sessions/:id/close', checkSessionOwnership, async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    await attendanceService.closeAttendanceSession(req.params.id, actorId, actorRole);
    res.json({
      success: true,
      message: 'Attendance session closed successfully',
    });
  } catch (error: any) {
    console.error('Close session error:', error);
    next(error);
  }
});

// GET /api/attendance/teacher/sessions/:id/attendees - Get session attendees
teacherRoutes.get('/sessions/:id/attendees', checkSessionOwnership, async (req, res, next) => {
  try {
    const attendees = await attendanceService.getSessionAttendees(req.params.id as string);
    res.json({
      success: true,
      data: attendees,
      count: attendees.length,
    });
  } catch (error: any) {
    console.error('Get attendees error:', error);
    next(error);
  }
});

// POST /api/attendance/teacher/sessions/:id/mark-manual - Mark attendance manually
teacherRoutes.post('/sessions/:id/mark-manual', checkSessionOwnership, async (req: any, res, next) => {
  try {
    const actorId = req.user?.userId;
    const actorRole = req.user?.role;
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required',
      });
    }

    const record = await attendanceRecordService.markAttendanceManually(
      req.params.id,
      student_id,
      actorId,
      actorRole
    );

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: record,
    });
  } catch (error: any) {
    console.error('Mark manual attendance error:', error);
    if (
      error.message?.includes('not enrolled') ||
      error.message?.includes('already marked') ||
      error.message?.includes('closed')
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// ==================== Student Routes ====================
const studentRoutes = Router();
studentRoutes.use(authenticate);
studentRoutes.use(authorize(ROLES.STUDENT));

// POST /api/attendance/student/scan - Scan QR code and mark attendance
studentRoutes.post('/scan', validateRequest(recordAttendanceByStudentSchema), async (req: any, res) => {
  try {
    const studentId = req.user?.userId;
    const { qr_code, device_fingerprint, device_id } = req.body;
    const clientFingerprint =
      (req.headers['x-device-fingerprint'] as string) ||
      device_fingerprint ||
      device_id ||
      undefined;

    if (!qr_code) {
      return res.status(400).json({
        success: false,
        message: 'QR code is required',
      });
    }

    const record = await attendanceRecordService.markAttendanceByQR(studentId, qr_code, clientFingerprint);

    res.json({
      success: true,
      message: 'تم تسجيل الحضور بنجاح',
      data: record,
    });
  } catch (error: any) {
    console.error('Scan QR error:', error);
    const status = error.status === 403 || error.status === 404 ? error.status : 400;
    res.status(status).json({
      success: false,
      ...(error.code ? { code: error.code } : {}),
      message: error.message || 'فشل في تسجيل الحضور',
    });
  }
});

// GET /api/attendance/student/sessions/active - Get active sessions for student
studentRoutes.get('/sessions/active', async (req: any, res, next) => {
  try {
    const studentId = req.user?.userId;
    const sessions = await attendanceService.getStudentActiveSessions(studentId);
    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    console.error('Get student active sessions error:', error);
    next(error);
  }
});

// GET /api/attendance/student/records - Get student attendance records
studentRoutes.get('/records', async (req: any, res, next) => {
  try {
    const studentId = req.user?.userId;
    const courseId = req.query.course_id as string | undefined;

    const records = await attendanceRecordService.getStudentAttendanceRecords(studentId, courseId);
    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error: any) {
    console.error('Get records error:', error);
    next(error);
  }
});

// GET /api/attendance/student/summary - Get attendance summary for student
studentRoutes.get('/summary', async (req: any, res, next) => {
  try {
    const studentId = req.user?.userId;
    const courseId = req.query.course_id as string;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }

    const summary = await attendanceRecordService.getStudentAttendanceSummary(studentId, courseId);
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Get summary error:', error);
    next(error);
  }
});

router.use('/teacher', teacherRoutes);
router.use('/student', studentRoutes);

export default router;
