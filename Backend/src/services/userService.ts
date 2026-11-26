import { pool } from '../config/database';
import { hashPassword } from './authService';
import { User } from '../types';

export interface CreateUserRequest {
  name: string;
  email: string;
  role: 'teacher' | 'student';
  student_id?: string | null;
  studentId?: string | null;
  teacher_code?: string | null;
  department?: string | null;
  academic_year?: string | null;
  password?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: 'teacher' | 'student';
  student_id?: string | null;
  studentId?: string | null;
  teacher_code?: string | null;
  department?: string | null;
  academic_year?: string | null;
  avatar?: string | null;
  is_active?: boolean;
}

// Get all users with filters
export const getAllUsers = async (filters?: {
  role?: 'teacher' | 'student' | 'all';
  search?: string;
}) => {
  try {
    let query = `
      SELECT id, name, email, role, student_id, teacher_code, department, academic_year,
             avatar, is_active, is_frozen, freeze_reason, created_at
      FROM users
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];

    if (filters?.role && filters.role !== 'all') {
      query += ` AND role = ?`;
      params.push(filters.role);
    }

    if (filters?.search) {
      query += ` AND (
        name LIKE ? OR 
        email LIKE ? OR 
        student_id LIKE ? OR
        teacher_code LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await pool.execute<any[]>(query, params);

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      student_id: row.student_id,
      studentId: row.student_id,
      teacher_code: row.teacher_code,
      department: row.department,
      academic_year: row.academic_year || null,
      avatar: row.avatar,
      is_active: Boolean(row.is_active),
      is_frozen: Boolean(row.is_frozen),
      freeze_reason: row.freeze_reason || null,
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT id, name, email, role, student_id, teacher_code, department, academic_year,
              avatar, is_active, is_frozen, freeze_reason, two_factor_enabled
       FROM users 
       WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      student_id: row.student_id,
      teacher_code: row.teacher_code,
      department: row.department,
      academic_year: row.academic_year || null,
      avatar: row.avatar,
      is_frozen: Boolean(row.is_frozen),
      freeze_reason: row.freeze_reason || null,
      two_factor_enabled: Boolean(row.two_factor_enabled),
    };
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Create user
export const createUser = async (userData: CreateUserRequest) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const normalizedStudentId = userData.student_id ?? userData.studentId ?? null;

    const [existing] = await connection.execute<any[]>(
      `SELECT id FROM users 
       WHERE (email = ? OR (student_id = ? AND student_id IS NOT NULL)) 
       AND deleted_at IS NULL`,
      [userData.email, normalizedStudentId || '']
    );

    if (existing.length > 0) {
      throw new Error('Email or student ID already exists');
    }

    if (!userData.password) {
      throw new Error('A secure password is required for new users');
    }
    const passwordHash = await hashPassword(userData.password);

    const userId = normalizedStudentId || `user_${Date.now()}`;
    const teacherCode = userData.role === 'teacher' ? (userData.teacher_code || userId) : null;

    await connection.execute(
      `INSERT INTO users (id, name, email, password_hash, role, student_id, teacher_code, department, academic_year, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userData.name,
        userData.email,
        passwordHash,
        userData.role,
        userData.role === 'student' ? normalizedStudentId : null,
        teacherCode,
        userData.department || null,
        userData.academic_year || null,
        true,
      ]
    );

    // Auto-create financial ledger record for new students
    if (userData.role === 'student') {
      await connection.execute(
        `INSERT INTO student_financials (student_id, student_name, student_number, total_tuition, paid_amount, discount, status, is_frozen)
         VALUES (?, ?, ?, 3500.00, 0.00, 0.00, 'unpaid', FALSE)
         ON DUPLICATE KEY UPDATE student_name = VALUES(student_name), student_number = VALUES(student_number)`,
        [userId, userData.name, normalizedStudentId || userId]
      );
    }

    await connection.commit();
    return await getUserById(userId);
  } catch (error: any) {
    await connection.rollback();
    console.error('Error creating user:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Update user
export const updateUser = async (userId: string, userData: UpdateUserRequest) => {
  try {
    const existing = await getUserById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    const normalizedStudentId =
      userData.student_id !== undefined ? userData.student_id : userData.studentId;

    if (userData.email || normalizedStudentId) {
      const [conflicts] = await pool.execute<any[]>(
        `SELECT id FROM users 
         WHERE id != ? 
         AND ((email = ? AND ? IS NOT NULL) OR (student_id = ? AND ? IS NOT NULL))
         AND deleted_at IS NULL`,
        [
          userId,
          userData.email || '',
          userData.email || null,
          normalizedStudentId || '',
          normalizedStudentId || null,
        ]
      );

      if (conflicts.length > 0) {
        throw new Error('Email or student ID already exists');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (userData.name !== undefined) {
      updates.push('name = ?');
      params.push(userData.name);
    }
    if (userData.email !== undefined) {
      updates.push('email = ?');
      params.push(userData.email);
    }
    if (userData.role !== undefined) {
      updates.push('role = ?');
      params.push(userData.role);
    }
    if (normalizedStudentId !== undefined) {
      updates.push('student_id = ?');
      params.push(normalizedStudentId || null);
    }
    if (userData.teacher_code !== undefined) {
      updates.push('teacher_code = ?');
      params.push(userData.teacher_code || null);
    }
    if (userData.department !== undefined) {
      updates.push('department = ?');
      params.push(userData.department || null);
    }
    if (userData.academic_year !== undefined) {
      updates.push('academic_year = ?');
      params.push(userData.academic_year || null);
    }
    if (userData.avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(userData.avatar || null);
    }
    if (userData.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(userData.is_active);
    }

    if (updates.length === 0) {
      return await getUserById(userId);
    }

    params.push(userId);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return await getUserById(userId);
  } catch (error: any) {
    console.error('Error updating user:', error);
    throw error;
  }
};

// Delete user (soft delete)
export const deleteUser = async (userId: string) => {
  try {
    const [result] = await pool.execute<any>(
      `UPDATE users SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (result.affectedRows === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Admin reset password
export const adminResetPassword = async (userId: string, newPassword: string) => {
  try {
    const existing = await getUserById(userId);
    if (!existing) {
      throw new Error('User not found');
    }
    const passwordHash = await hashPassword(newPassword);
    await pool.execute(
      `UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [passwordHash, userId]
    );
    return { success: true };
  } catch (error: any) {
    console.error('Error resetting password:', error);
    throw error;
  }
};
