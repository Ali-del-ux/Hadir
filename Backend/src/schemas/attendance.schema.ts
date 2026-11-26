import { z } from 'zod';

export const createSessionSchema = z.object({
  body: z.object({
    course_id: z.string().min(1, 'Course ID is required'),
    date: z.string().optional(),
    time: z.string().optional(),
    room: z.string().max(100).optional(),
    duration_minutes: z.number().min(1).optional(),
  }),
});

export const getSessionsSchema = z.object({
  query: z.object({
    course_id: z.string().optional(),
  }),
});

export const markAttendanceSchema = z.object({
  body: z.object({
    session_id: z.string().min(1, 'Session ID is required'),
    student_id: z.string().min(1, 'Student ID is required'),
    status: z.enum(['present', 'absent', 'late']),
    device_fingerprint: z.string().max(128).optional(),
    device_id: z.string().max(128).optional(),
    ip_address: z.string().optional(),
  }),
});

export const recordAttendanceByStudentSchema = z.object({
  body: z.object({
    qr_code: z.string().min(1, 'QR code is required'),
    device_fingerprint: z.string().max(128).optional(),
    device_id: z.string().max(128).optional(),
  }),
});
