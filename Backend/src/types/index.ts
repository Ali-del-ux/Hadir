export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  student_id?: string | null;
  teacher_code?: string | null;
  department?: string | null;
  academic_year?: string | null;
  avatar?: string | null;
  is_frozen?: boolean;
  freeze_reason?: string | null;
  two_factor_enabled?: boolean;
}

export interface UserWithPassword extends User {
  password_hash: string;
  is_active?: boolean;
  token_version?: number;
  two_factor_secret?: string | null;
}

export interface LoginRequest {
  identifier: string; // email, username (admin), student_id, or teacher_code
  password: string;
  totp_code?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
  user?: User;
  requires_2fa?: boolean;
  temp_token?: string;
  error?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'student';
  student_id?: string;
  teacher_code?: string;
  department?: string;
}

export interface JwtPayload {
  sub: string;
  role: string;
  tokenVersion: number;
  purpose?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}
