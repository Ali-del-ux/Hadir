import { z } from 'zod';

const SAFE_STRING_REGEX = /^[\p{L}\p{N}\s.,@%/\-_]+$/u;
const SAFE_STRING_MSG = 'Input contains invalid symbols. Only letters, numbers, and (.,@%/-_) are allowed';

const safeString = z.string().regex(SAFE_STRING_REGEX, SAFE_STRING_MSG);

export const loginSchema = z.object({
  body: z.object({
    identifier: safeString.min(1, 'Identifier is required').max(120, 'Identifier is too long'),
    password: z.string().min(1, 'Password is required'),
    totp_code: z.string().trim().min(6).max(10).optional(),
  }).strict(),
});

export const verify2FALoginSchema = z.object({
  body: z.object({
    temp_token: z.string().min(1, 'Temporary 2FA token is required'),
    totp_code: z.string().trim().min(6).max(10).optional(),
    token: z.string().trim().min(6).max(10).optional(),
    code: z.string().trim().min(6).max(10).optional(),
  }).strict().refine((data) => Boolean(data.totp_code || data.token || data.code), {
    message: '2FA verification code is required',
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }).strict(),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }).strict(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100, 'Password is too long'),
  }).strict(),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: safeString.min(2, 'Name is required').max(100, 'Name is too long').optional(),
    email: safeString.email('Invalid email').max(120, 'Email is too long').optional(),
    department: safeString.max(100, 'Department name is too long').optional(),
    avatar: safeString.max(255).optional(),
  }).strict(),
});
