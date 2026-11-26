import { z } from 'zod';

const SAFE_STRING_REGEX = /^[\p{L}\p{N}\s.,@%/\-_]+$/u;
const SAFE_STRING_MSG = 'Input contains invalid symbols. Only letters, numbers, and (.,@%/-_) are allowed';

const safeString = z.string().regex(SAFE_STRING_REGEX, SAFE_STRING_MSG);

export const createUserSchema = z.object({
  body: z.object({
    name: safeString.min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
    email: safeString.email('Invalid email address').max(120, 'Email is too long'),
    role: z.enum(['teacher', 'student']),
    student_id: safeString.max(50, 'Student ID is too long').optional().nullable(),
    studentId: safeString.max(50, 'Student ID is too long').optional().nullable(),
    teacher_code: safeString.max(20, 'Teacher code is too long').optional().nullable(),
    department: safeString.max(100, 'Department is too long').optional().nullable(),
    academic_year: safeString.max(50, 'Academic year is too long').optional().nullable(),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long').optional(),
  }).strip(),
});

export const updateUserSchema = z.object({
  body: z.object({
    id: z.string().optional(),
    name: safeString.min(2, 'Name must be at least 2 characters').max(100, 'Name is too long').optional(),
    email: safeString.email('Invalid email address').max(120, 'Email is too long').optional(),
    role: z.enum(['teacher', 'student']).optional(),
    student_id: safeString.max(50, 'Student ID is too long').optional().nullable(),
    studentId: safeString.max(50, 'Student ID is too long').optional().nullable(),
    teacher_code: safeString.max(20, 'Teacher code is too long').optional().nullable(),
    department: safeString.max(100, 'Department is too long').optional().nullable(),
    academic_year: safeString.max(50, 'Academic year is too long').optional().nullable(),
    is_active: z.boolean().optional(),
    is_frozen: z.boolean().optional(),
    freeze_reason: z.string().max(255).optional().nullable(),
    avatar: z.string().max(255).optional().nullable(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
  }).strip(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long').optional(),
    newPassword: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password is too long').optional(),
  }).refine((data) => Boolean(data.password || data.newPassword), {
    message: 'Password must be at least 6 characters',
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    role: z.enum(['teacher', 'student', 'all']).optional(),
    search: safeString.max(50, 'Search query is too long').optional(),
  }).strict(),
});
