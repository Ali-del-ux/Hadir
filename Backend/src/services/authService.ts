import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { pool } from '../config/database';
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_ISSUER, JWT_AUDIENCE } from '../config/jwt';
import { LoginRequest, LoginResponse, User, UserWithPassword, JwtPayload } from '../types';
import { verifyTOTP } from '../utils/totp';

// ─────────────────────────────────────────────────────────────
//  Password utilities
// ─────────────────────────────────────────────────────────────
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (plain: string, hashed: string): Promise<boolean> =>
  bcrypt.compare(plain, hashed);

// ─────────────────────────────────────────────────────────────
//  JWT
// ─────────────────────────────────────────────────────────────
export const generateToken = (payload: Pick<JwtPayload, 'sub' | 'role' | 'tokenVersion'>): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const generate2FATempToken = (payload: Pick<JwtPayload, 'sub' | 'role' | 'tokenVersion'>): string => {
  return jwt.sign(
    { ...payload, purpose: '2fa_challenge' },
    JWT_SECRET,
    {
      expiresIn: '5m',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

export const generateOpaqueToken = (): string => {
  return crypto.randomBytes(64).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// ─────────────────────────────────────────────────────────────
//  Find user
//  Accepts: email, student_id, teacher_code, or users.id
// ─────────────────────────────────────────────────────────────
export const findUserByIdentifier = async (identifier: string): Promise<UserWithPassword | null> => {
  const [rows] = await pool.execute<any[]>(
    `SELECT id, name, email, password_hash, role,
            student_id, teacher_code, department, academic_year, avatar, is_active,
            is_frozen, freeze_reason, two_factor_enabled, two_factor_secret, token_version
     FROM users
     WHERE (
       email        = ? OR
       student_id   = ? OR
       teacher_code = ? OR
       id           = ?
     )
     AND deleted_at IS NULL
     LIMIT 1`,
    [identifier, identifier, identifier, identifier]
  );
  if (!rows.length) return null;
  const u = rows[0];
  return {
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    password_hash:      u.password_hash,
    role:               u.role,
    student_id:         u.student_id,
    teacher_code:       u.teacher_code,
    department:         u.department,
    academic_year:      u.academic_year || null,
    avatar:             u.avatar,
    is_active:          Boolean(u.is_active),
    is_frozen:          Boolean(u.is_frozen),
    freeze_reason:      u.freeze_reason || null,
    two_factor_enabled: Boolean(u.two_factor_enabled),
    two_factor_secret:  u.two_factor_secret || null,
    token_version:      u.token_version || 1,
  };
};

// ─────────────────────────────────────────────────────────────
//  Find admin by username (supports 'admin' and 'admin@hadir.edu')
// ─────────────────────────────────────────────────────────────
export const findAdminByUsername = async (identifier: string): Promise<any | null> => {
  const normalized = identifier === 'admin@hadir.edu' ? 'admin' : identifier;
  const [rows] = await pool.execute<any[]>(
    `SELECT * FROM admin_accounts WHERE (username = ? OR username = ?) AND is_active = 1 LIMIT 1`,
    [identifier, normalized]
  );
  return rows.length ? rows[0] : null;
};

async function issueUserSessionTokens(userRow: UserWithPassword): Promise<LoginResponse> {
  const user: User = {
    id:                 userRow.id,
    name:               userRow.name,
    email:              userRow.email,
    role:               userRow.role,
    student_id:         userRow.student_id ?? null,
    teacher_code:       userRow.teacher_code ?? null,
    department:         userRow.department ?? null,
    academic_year:      userRow.academic_year ?? null,
    avatar:             userRow.avatar ?? null,
    is_frozen:          Boolean(userRow.is_frozen),
    freeze_reason:      userRow.freeze_reason ?? null,
    two_factor_enabled: Boolean(userRow.two_factor_enabled),
  };

  const token = generateToken({
    sub: user.id,
    role: user.role,
    tokenVersion: userRow.token_version || 1,
  });
  const refreshToken = generateOpaqueToken();
  const tokenHash = hashToken(refreshToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.execute(
    'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
    [user.id, tokenHash, familyId, expiresAt]
  );

  return { success: true, message: 'تم تسجيل الدخول بنجاح.', token, refreshToken, user };
}

// ─────────────────────────────────────────────────────────────
//  Login
// ─────────────────────────────────────────────────────────────
export const login = async (loginData: LoginRequest): Promise<LoginResponse> => {
  try {
    const { identifier, password, totp_code } = loginData;

    // ── 1. Try admin table first ──────────────────────────────
    const admin = await findAdminByUsername(identifier);
    if (admin) {
      const ok = await comparePassword(password, admin.password_hash);
      if (!ok) return { success: false, message: 'بيانات الدخول غير صحيحة.', error: 'INVALID_CREDENTIALS' };

      const user: User = {
        id:                 `admin_${admin.id}`,
        name:               'مدير النظام',
        email:              admin.username === 'admin' ? 'admin@hadir.edu' : admin.username,
        role:               'admin',
        student_id:         null,
        department:         null,
        avatar:             null,
        is_frozen:          false,
        freeze_reason:      null,
        two_factor_enabled: false,
      };
      const token = generateToken({ sub: user.id, role: user.role, tokenVersion: admin.token_version || 1 });
      const refreshToken = generateOpaqueToken();
      const tokenHash = hashToken(refreshToken);
      const familyId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.execute(
        'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, tokenHash, familyId, expiresAt]
      );
      return { success: true, message: 'تم تسجيل الدخول بنجاح.', token, refreshToken, user };
    }

    // ── 2. Try users table ────────────────────────────────────
    const userRow = await findUserByIdentifier(identifier);
    if (!userRow) {
      return { success: false, message: 'المستخدم غير موجود.', error: 'USER_NOT_FOUND' };
    }

    if (!userRow.is_active) {
      return { success: false, message: 'الحساب معطّل، تواصل مع المسؤول.', error: 'ACCOUNT_DEACTIVATED' };
    }

    // Check password
    const passwordOk = await comparePassword(password, userRow.password_hash);
    if (!passwordOk) {
      return { success: false, message: 'بيانات الدخول غير صحيحة.', error: 'INVALID_CREDENTIALS' };
    }

    // ── 3. Enforce RFC 6238 TOTP 2FA if enabled ───────────────
    if (userRow.two_factor_enabled && userRow.two_factor_secret) {
      if (totp_code) {
        const totpOk = verifyTOTP(userRow.two_factor_secret, totp_code);
        if (!totpOk) {
          return { success: false, message: 'رمز التحقق الثنائي (2FA) غير صحيح.', error: 'INVALID_2FA_CODE' };
        }
        return await issueUserSessionTokens(userRow);
      }

      const tempToken = generate2FATempToken({
        sub: userRow.id,
        role: userRow.role,
        tokenVersion: userRow.token_version || 1,
      });

      return {
        success: true,
        requires_2fa: true,
        temp_token: tempToken,
        message: 'يرجى إدخال رمز التحقق الثنائي (2FA) لإكمال تسجيل الدخول.',
      };
    }

    return await issueUserSessionTokens(userRow);
  } catch (err: any) {
    console.error('LOGIN ERROR:', err);
    return { success: false, message: 'حدث خطأ داخلي أثناء تسجيل الدخول.', error: 'INTERNAL_ERROR' };
  }
};

// ─────────────────────────────────────────────────────────────
//  Verify 2FA Challenge & Issue Session Tokens
// ─────────────────────────────────────────────────────────────
export const verify2FALogin = async (tempToken: string, code: string): Promise<LoginResponse> => {
  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;

    if (decoded.purpose !== '2fa_challenge' || !decoded.sub) {
      return { success: false, message: 'رمز المصادقة المؤقت غير صالح.', error: 'INVALID_2FA_TOKEN' };
    }

    const userRow = await findUserByIdentifier(decoded.sub);
    if (!userRow || !userRow.is_active) {
      return { success: false, message: 'المستخدم غير موجود أو معطّل.', error: 'USER_NOT_FOUND' };
    }

    if (decoded.tokenVersion !== undefined && userRow.token_version !== decoded.tokenVersion) {
      return { success: false, message: 'تم إلغاء الجلسة، يرجى إعادة المحاولة.', error: 'SESSION_REVOKED' };
    }

    if (!userRow.two_factor_enabled || !userRow.two_factor_secret) {
      return { success: false, message: 'المصادقة الثنائية غير مفعلة لهذا الحساب.', error: '2FA_NOT_ENABLED' };
    }

    const isValid = verifyTOTP(userRow.two_factor_secret, code);
    if (!isValid) {
      return { success: false, message: 'رمز التحقق الثنائي (2FA) غير صحيح أو منتهي الصلاحية.', error: 'INVALID_2FA_CODE' };
    }

    return await issueUserSessionTokens(userRow);
  } catch (err: any) {
    return { success: false, message: 'انتهت صلاحية جلسة التحقق الثنائي، يرجى تسجيل الدخول مجدداً.', error: 'INVALID_2FA_TOKEN' };
  }
};

// ─────────────────────────────────────────────────────────────
//  Get current user (by JWT userId)
// ─────────────────────────────────────────────────────────────
export const getCurrentUser = async (userId: string): Promise<User | null> => {
  if (userId.startsWith('admin_')) {
    const dbId = userId.replace('admin_', '');
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM admin_accounts WHERE id = ? AND is_active = 1', [dbId]
    );
    if (!rows.length) return null;
    return {
      id: userId,
      name: 'مدير النظام',
      email: rows[0].username === 'admin' ? 'admin@hadir.edu' : rows[0].username,
      role: 'admin',
      student_id: null,
      department: null,
      avatar: null,
      is_frozen: false,
      freeze_reason: null,
      two_factor_enabled: false,
    };
  }

  const [rows] = await pool.execute<any[]>(
    `SELECT id, name, email, role, student_id, teacher_code, department, academic_year, avatar, is_frozen, freeze_reason, two_factor_enabled
     FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1`,
    [userId]
  );
  if (!rows.length) return null;
  const u = rows[0];
  return {
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    role:               u.role,
    student_id:         u.student_id ?? null,
    teacher_code:       u.teacher_code ?? null,
    department:         u.department ?? null,
    academic_year:      u.academic_year ?? null,
    avatar:             u.avatar ?? null,
    is_frozen:          Boolean(u.is_frozen),
    freeze_reason:      u.freeze_reason ?? null,
    two_factor_enabled: Boolean(u.two_factor_enabled),
  };
};

// ─────────────────────────────────────────────────────────────
//  Change password
// ─────────────────────────────────────────────────────────────
export const changePassword = async (userId: string, currentPw: string, newPw: string): Promise<void> => {
  if (userId.startsWith('admin_')) {
    const dbId = userId.replace('admin_', '');
    const [rows] = await pool.execute<any[]>('SELECT password_hash FROM admin_accounts WHERE id=?', [dbId]);
    if (!rows.length) throw new Error('User not found');
    if (!(await comparePassword(currentPw, rows[0].password_hash))) throw new Error('Incorrect current password');
    await pool.execute('UPDATE admin_accounts SET password_hash=? WHERE id=?', [await hashPassword(newPw), dbId]);
  } else {
    const [rows] = await pool.execute<any[]>('SELECT password_hash FROM users WHERE id=?', [userId]);
    if (!rows.length) throw new Error('User not found');
    if (!(await comparePassword(currentPw, rows[0].password_hash))) throw new Error('Incorrect current password');
    await pool.execute('UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [await hashPassword(newPw), userId]);
  }
};

// ─────────────────────────────────────────────────────────────
//  Update admin username
// ─────────────────────────────────────────────────────────────
export const updateAdmin = async (adminId: string, updates: { username?: string }): Promise<any> => {
  const dbId = adminId.replace('admin_', '');
  if (updates.username) {
    const [ex] = await pool.execute<any[]>('SELECT id FROM admin_accounts WHERE username=? AND id!=?', [updates.username, dbId]);
    if (ex.length) throw new Error('اسم المستخدم محجوز مسبقاً');
    await pool.execute('UPDATE admin_accounts SET username=? WHERE id=?', [updates.username, dbId]);
  }
  const [rows] = await pool.execute<any[]>('SELECT * FROM admin_accounts WHERE id=?', [dbId]);
  if (!rows.length) return null;
  return { id: `admin_${rows[0].id}`, name: 'مدير النظام', email: rows[0].username, role: 'admin', department: null };
};
