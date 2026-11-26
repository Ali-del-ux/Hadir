import { Router } from 'express';
import { login, verify2FALogin, getCurrentUser, changePassword, updateAdmin, generateToken, generateOpaqueToken, hashToken } from '../services/authService';
import { updateUser } from '../services/userService';
import { authenticate } from '../middleware/authenticate';
import { LoginRequest } from '../types';
import rateLimit from 'express-rate-limit';
import { pool } from '../config/database';
import { validateRequest } from '../middleware/validator';
import { loginSchema, verify2FALoginSchema, refreshSchema, logoutSchema, changePasswordSchema, updateProfileSchema } from '../schemas/auth.schema';
import { securityLogger } from '../logging/securityLogger';

const loginLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'تم تجاوز الحد الأقصى للمحاولات السريعة (5 محاولات في الثانية). يرجى الانتظار ثانية والمحاولة مجدداً.',
    error: 'TOO_MANY_REQUESTS'
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'تم تجاوز الحد الأقصى للمحاولات السريعة (5 محاولات في الثانية). يرجى الانتظار ثانية والمحاولة مجدداً.',
      error: 'TOO_MANY_REQUESTS',
    });
  },
});

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password, totp_code } = req.body as LoginRequest;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier and password are required.'
      });
    }

    const result = await login({ identifier, password, totp_code });

    if (!result.success) {
      securityLogger.loginFailed({ ip: req.ip ?? 'unknown', identifier, reason: result.error || 'Invalid credentials' });
      return res.status(401).json({ success: false, message: result.message || 'Invalid credentials.', error: result.error });
    }

    if (result.requires_2fa) {
      return res.json(result);
    }

    securityLogger.loginSuccess({
      ip: req.ip ?? 'unknown',
      userId: result.user?.id ?? identifier,
      role: result.user?.role ?? 'unknown',
      identifier,
    });
    res.json(result);
  } catch (error) {
    console.error('Login route error:', error);
    next(error);
  }
});

// POST /api/auth/login/2fa - Complete login with TOTP 2FA code
router.post('/login/2fa', loginLimiter, validateRequest(verify2FALoginSchema), async (req, res, next) => {
  try {
    const tempToken = req.body.temp_token;
    const code = req.body.totp_code || req.body.token || req.body.code;

    const result = await verify2FALogin(tempToken, code);
    if (!result.success) {
      securityLogger.loginFailed({ ip: req.ip ?? 'unknown', identifier: '2fa_challenge', reason: result.error || 'Invalid 2FA code' });
      return res.status(401).json(result);
    }

    securityLogger.loginSuccess({
      ip: req.ip ?? 'unknown',
      userId: result.user?.id ?? 'unknown',
      role: result.user?.role ?? 'unknown',
      identifier: result.user?.email ?? 'unknown',
    });
    res.json(result);
  } catch (error) {
    console.error('2FA Login route error:', error);
    next(error);
  }
});

// POST /api/auth/refresh - Refresh Access Token
router.post('/refresh', validateRequest(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    const tokenHash = hashToken(refreshToken);

    const [rows]: any = await pool.execute('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    const storedToken = rows[0];

    if (!storedToken) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const userId = storedToken.user_id;
    const familyId = storedToken.family_id;

    if (storedToken.is_revoked) {
      if (familyId) {
        await pool.execute('UPDATE refresh_tokens SET is_revoked = true WHERE family_id = ?', [familyId]);
      } else {
        await pool.execute('UPDATE refresh_tokens SET is_revoked = true WHERE user_id = ?', [userId]);
      }
      securityLogger.replayAttack({ ip: req.ip ?? 'unknown', userId });
      return res.status(401).json({ success: false, message: 'Token compromised. Please login again.' });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      await pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [storedToken.id]);
      securityLogger.expiredTokenUsed({ ip: req.ip ?? 'unknown', userId });
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    let role: string | undefined;
    let tokenVersion = 1;

    if (String(userId).startsWith('admin_')) {
      const dbId = String(userId).replace('admin_', '');
      const [adminRows]: any = await pool.execute(
        'SELECT username, token_version FROM admin_accounts WHERE id = ? AND is_active = 1',
        [dbId]
      );
      if (adminRows.length > 0) {
        role = 'admin';
        tokenVersion = adminRows[0].token_version || 1;
      }
    } else {
      const [userRows]: any = await pool.execute(
        'SELECT role, token_version FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1',
        [userId]
      );
      if (userRows.length > 0) {
        role = userRows[0].role;
        tokenVersion = userRows[0].token_version || 1;
      }
    }

    if (!role) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    await pool.execute('UPDATE refresh_tokens SET is_revoked = true WHERE id = ?', [storedToken.id]);

    const newAccessToken = generateToken({
      sub: userId,
      role,
      tokenVersion,
    });
    const newRefreshToken = generateOpaqueToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
      [userId, newTokenHash, familyId, expiresAt]
    );

    securityLogger.tokenRefreshed({ ip: req.ip ?? 'unknown', userId });
    res.json({ success: true, token: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    next(error);
  }
});

// POST /api/auth/logout - Logout and Revoke Session
router.post('/logout', authenticate, validateRequest(logoutSchema), async (req: any, res, next) => {
  try {
    const userId = req.user?.userId;
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await pool.execute('DELETE FROM refresh_tokens WHERE token_hash = ? AND user_id = ?', [tokenHash, userId]);
    } else {
      await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    }

    securityLogger.logout({ ip: req.ip ?? 'unknown', userId, globalRevoke: !refreshToken });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const user = await getCurrentUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Get current user error:', error);
    next(error);
  }
});

// POST /api/auth/verify - Verify token
router.post('/verify', authenticate, (req: any, res) => {
  res.json({
    success: true,
    message: 'Token is valid.',
    user: req.user
  });
});

// PUT /api/auth/password - Change password
router.put('/password', authenticate, validateRequest(changePasswordSchema), async (req: any, res, next) => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    await changePassword(userId, currentPassword, newPassword);

    securityLogger.passwordChanged({ ip: req.ip ?? 'unknown', userId });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    if (error.message === 'Incorrect current password') {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }
    console.error('Change password error:', error);
    next(error);
  }
});

// PUT /api/auth/profile - Update profile details
router.put('/profile', authenticate, validateRequest(updateProfileSchema), async (req: any, res, next) => {
  try {
    const userId = req.user?.userId;
    const updateData = { ...req.body };

    if (userId.startsWith('admin_')) {
      const updatedAdmin = await updateAdmin(userId, { username: updateData.email });
      return res.json({
        success: true,
        message: 'Admin profile updated successfully (Note: Only username/email is updatable for admins)',
        data: updatedAdmin
      });
    }

    delete updateData.id;
    delete updateData.role;
    delete updateData.password;
    delete updateData.is_active;

    const updatedUser = await updateUser(userId, updateData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    next(error);
  }
});

export default router;
