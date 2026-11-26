import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { PoolConnection } from 'mysql2/promise';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { pool } from '../config/database';

const router = Router();

interface RecordPaymentInput {
  studentId: string;
  amount: number;
  receiptNumber?: string;
  paymentMethod?: string;
  notes?: string | null;
  createdBy: string;
  autoUnfreeze?: boolean;
}

interface RecordPaymentResult {
  receiptNumber: string;
  newPaid: number;
  remainingAmount: number;
  newStatus: 'paid' | 'partial' | 'unpaid';
  unfrozen: boolean;
}

class PaymentValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Computes running remaining tuition balance (`balance_after`) on each
 * payment transaction returned from newest to oldest.
 */
function attachRunningBalance(transactions: any[], totalTuition: number): any[] {
  const chronological = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || Number(a.id) - Number(b.id)
  );
  let cumulativePaid = 0;
  const balancesById = new Map<number, number>();
  for (const tx of chronological) {
    cumulativePaid += Number(tx.amount || 0);
    balancesById.set(Number(tx.id), Math.max(0, Number((totalTuition - cumulativePaid).toFixed(2))));
  }
  return transactions.map((tx) => ({
    ...tx,
    amount: Number(tx.amount || 0),
    balance_after: balancesById.get(Number(tx.id)) ?? 0,
  }));
}

/**
 * Atomically records a tuition payment, updates student_financials, and
 * optionally lifts an account freeze once full tuition is settled.
 */
async function recordStudentPayment(
  connection: PoolConnection,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  const payAmount = Number(input.amount);
  if (!input.studentId || !Number.isFinite(payAmount) || payAmount <= 0) {
    throw new PaymentValidationError('رقم الطالب والمبلغ المطلوب سداده حقول إلزامية', 400);
  }

  const [finRows] = await connection.execute<any[]>(
    `SELECT sf.*
     FROM student_financials sf
     JOIN users u ON sf.student_id = u.id
     WHERE sf.student_id = ? AND u.deleted_at IS NULL
     FOR UPDATE`,
    [input.studentId]
  );

  if (finRows.length === 0) {
    throw new PaymentValidationError('سجل الطالب المالي غير موجود', 404);
  }

  const cur = finRows[0];
  const currentPaid = Number(cur.paid_amount || 0);
  const total = Number(cur.total_tuition || 3500);
  const currentRemaining = Math.max(0, Number((total - currentPaid).toFixed(2)));

  if (currentRemaining <= 0) {
    throw new PaymentValidationError('تم سداد كامل الرسوم الدراسية بالفعل، لا توجد مستحقات متبقية.', 400);
  }

  if (payAmount > currentRemaining + 0.001) {
    throw new PaymentValidationError(
      `المبلغ المدخل (${payAmount.toLocaleString('ar-LY')} د.ل) يتجاوز المتبقي للسداد (${currentRemaining.toLocaleString('ar-LY')} د.ل).`,
      400
    );
  }

  const receipt = (input.receiptNumber || '').trim() || `REC-${Date.now().toString().slice(-6)}`;
  const newPaid = Number((currentPaid + payAmount).toFixed(2));
  const remainingAmount = Math.max(0, Number((total - newPaid).toFixed(2)));
  const newStatus: 'paid' | 'partial' | 'unpaid' = remainingAmount <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

  await connection.execute(
    `INSERT INTO financial_transactions (student_id, amount, receipt_number, payment_method, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.studentId, payAmount, receipt, input.paymentMethod || 'نقدي', input.notes || null, input.createdBy]
  );

  let unfrozen = false;
  if (newStatus === 'paid' && input.autoUnfreeze && Boolean(cur.is_frozen)) {
    await connection.execute(
      `UPDATE users SET is_frozen = FALSE, freeze_reason = NULL WHERE id = ? AND deleted_at IS NULL`,
      [input.studentId]
    );
    await connection.execute(
      `UPDATE student_financials
       SET paid_amount = ?, status = ?, is_frozen = FALSE, freeze_reason = NULL, last_payment_date = NOW()
       WHERE student_id = ?`,
      [newPaid, newStatus, input.studentId]
    );
    unfrozen = true;
  } else {
    await connection.execute(
      `UPDATE student_financials
       SET paid_amount = ?, status = ?, last_payment_date = NOW()
       WHERE student_id = ?`,
      [newPaid, newStatus, input.studentId]
    );
  }

  return {
    receiptNumber: receipt,
    newPaid,
    remainingAmount,
    newStatus,
    unfrozen,
  };
}

// ============================================================================
// 1. Student endpoints (Read + Self-Service Dues Payment)
// ============================================================================
router.get('/my-status', authenticate, async (req: any, res) => {
  try {
    const studentId = req.user.userId;
    const [rows] = await pool.execute<any[]>(
      `SELECT sf.*, u.name as student_name, u.email as student_email, u.student_id as student_number
       FROM student_financials sf
       JOIN users u ON sf.student_id = u.id
       WHERE sf.student_id = ? AND u.deleted_at IS NULL`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          total_tuition: 3500,
          paid_amount: 3500,
          remaining_amount: 0,
          status: 'paid',
          is_frozen: false,
          transactions: [],
        }
      });
    }

    const fin = rows[0];
    const totalTuition = Number(fin.total_tuition || 3500);
    const paidAmount = Number(fin.paid_amount || 0);
    const [trans] = await pool.execute<any[]>(
      `SELECT * FROM financial_transactions WHERE student_id = ? ORDER BY created_at DESC, id DESC`,
      [studentId]
    );

    res.json({
      success: true,
      data: {
        ...fin,
        total_tuition: totalTuition,
        paid_amount: paidAmount,
        discount: Number(fin.discount || 0),
        is_frozen: Boolean(fin.is_frozen),
        remaining_amount: Math.max(0, Number((totalTuition - paidAmount).toFixed(2))),
        transactions: attachRunningBalance(trans, totalTuition),
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/financials/pay-dues - Student online dues settlement
router.post('/pay-dues', authenticate, authorize('student'), async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const studentId = req.user.userId;
    const { amount, payment_method, reference_number, notes } = req.body;

    const cleanMethod = (payment_method || 'دفع إلكتروني (بطاقة مصرفية)').trim();
    const refSuffix = (reference_number || '').trim();
    const combinedNotes = [notes?.trim(), refSuffix ? `مرجع العملية: ${refSuffix}` : '']
      .filter(Boolean)
      .join(' • ') || 'سداد إلكتروني للمستحقات عبر بوابة الطالب';

    const result = await recordStudentPayment(connection, {
      studentId,
      amount: Number(amount),
      receiptNumber: `PAY-${Date.now().toString().slice(-6)}`,
      paymentMethod: cleanMethod,
      notes: combinedNotes,
      createdBy: studentId,
      autoUnfreeze: true,
    });

    await connection.commit();
    res.json({
      success: true,
      message: result.unfrozen
        ? `تم سداد ${Number(amount).toLocaleString('ar-LY')} د.ل بالكامل وفك تجميد حسابك تلقائياً بموجب إيصال ${result.receiptNumber}`
        : `تم سداد ${Number(amount).toLocaleString('ar-LY')} د.ل بنجاح بموجب إيصال رقم ${result.receiptNumber}`,
      data: result,
    });
  } catch (error: any) {
    await connection.rollback();
    const status = error instanceof PaymentValidationError ? error.status : 500;
    res.status(status).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ============================================================================
// 2. Admin endpoints (Requires Admin Role)
// ============================================================================
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/financials/summary - Admin financial KPIs summary
router.get('/summary', async (_req, res) => {
  try {
    const [rows] = await pool.execute<any[]>(`
      SELECT
        COALESCE(SUM(sf.total_tuition), 0) AS totalExpected,
        COALESCE(SUM(sf.paid_amount), 0) AS totalCollected,
        COALESCE(SUM(GREATEST(0, sf.total_tuition - sf.paid_amount)), 0) AS totalDebt,
        COALESCE(SUM(CASE WHEN sf.is_frozen = 1 THEN 1 ELSE 0 END), 0) AS frozenCount
      FROM student_financials sf
      JOIN users u ON sf.student_id = u.id
      WHERE u.deleted_at IS NULL
    `);

    const r = rows[0] || {};
    res.json({
      success: true,
      data: {
        totalExpected: Number(r.totalExpected) || 0,
        totalCollected: Number(r.totalCollected) || 0,
        totalDebt: Number(r.totalDebt) || 0,
        frozenCount: Number(r.frozenCount) || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/financials - Summary + All active student financial records
router.get('/', async (_req, res) => {
  try {
    const [records] = await pool.execute<any[]>(`
      SELECT 
        sf.id,
        sf.student_id,
        u.name as student_name,
        u.email as student_email,
        u.student_id as student_number,
        sf.total_tuition,
        sf.paid_amount,
        GREATEST(0, sf.total_tuition - sf.paid_amount) as remaining_amount,
        sf.discount,
        sf.status,
        sf.is_frozen,
        sf.freeze_reason,
        sf.last_payment_date
      FROM student_financials sf
      JOIN users u ON sf.student_id = u.id
      WHERE u.deleted_at IS NULL
      ORDER BY sf.is_frozen DESC, remaining_amount DESC
    `);

    let totalExpected = 0;
    let totalCollected = 0;
    let totalDebt = 0;
    let frozenCount = 0;

    const normalizedStudents = records.map((r) => {
      const totalTuition = Number(r.total_tuition || 0);
      const paidAmount = Number(r.paid_amount || 0);
      const remainingAmount = Math.max(0, Number(r.remaining_amount ?? totalTuition - paidAmount));
      const isFrozen = Boolean(r.is_frozen);

      totalExpected += totalTuition;
      totalCollected += paidAmount;
      totalDebt += remainingAmount;
      if (isFrozen) frozenCount++;

      return {
        ...r,
        total_tuition: totalTuition,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        discount: Number(r.discount || 0),
        is_frozen: isFrozen,
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalExpected,
          totalCollected,
          totalDebt,
          totalStudents: normalizedStudents.length,
          frozenCount,
        },
        students: normalizedStudents,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/financials/:studentId/transactions - View receipts for a student
router.get('/:studentId/transactions', async (req, res) => {
  try {
    const { studentId } = req.params;
    const [finRows] = await pool.execute<any[]>(
      `SELECT total_tuition FROM student_financials WHERE student_id = ?`,
      [studentId]
    );
    const totalTuition = finRows.length > 0 ? Number(finRows[0].total_tuition || 3500) : 3500;
    const [trans] = await pool.execute<any[]>(
      `SELECT * FROM financial_transactions WHERE student_id = ? ORDER BY created_at DESC, id DESC`,
      [studentId]
    );
    res.json({
      success: true,
      data: attachRunningBalance(trans, totalTuition),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/financials/payment - Record payment
router.post('/payment', async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const adminId = req.user.userId;
    const { student_id, amount, receipt_number, payment_method, notes, auto_unfreeze } = req.body;

    const result = await recordStudentPayment(connection, {
      studentId: student_id,
      amount: Number(amount),
      receiptNumber: receipt_number,
      paymentMethod: payment_method || 'نقدي',
      notes: notes || null,
      createdBy: adminId,
      autoUnfreeze: auto_unfreeze !== false,
    });

    await connection.commit();

    res.json({
      success: true,
      message: result.unfrozen
        ? `تم تسجيل سداد مبلغ ${Number(amount)} د.ل بنجاح بموجب إيصال رقم ${result.receiptNumber} وفك تجميد الحساب تلقائياً`
        : `تم تسجيل سداد مبلغ ${Number(amount)} د.ل بنجاح بموجب إيصال رقم ${result.receiptNumber}`,
      data: result
    });
  } catch (error: any) {
    await connection.rollback();
    const status = error instanceof PaymentValidationError ? error.status : 500;
    res.status(status).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/admin/financials/freeze - Freeze student account
router.post('/freeze', async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { student_id, reason } = req.body;
    if (!student_id) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'student_id مطلوب' });
    }

    const freezeReason = reason || 'تجميد الحساب لمراجعة الأقساط المالية المتأخرة';

    const [userRes] = await connection.execute<any>(
      `UPDATE users SET is_frozen = TRUE, freeze_reason = ? WHERE id = ? AND deleted_at IS NULL`,
      [freezeReason, student_id]
    );
    if (userRes.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    await connection.execute(
      `UPDATE student_financials SET is_frozen = TRUE, freeze_reason = ? WHERE student_id = ?`,
      [freezeReason, student_id]
    );

    await connection.commit();
    res.json({
      success: true,
      message: 'تم تجميد حساب الطالب بنجاح؛ لن يتمكن من تسجيل الحضور حتى تسوية الرسوم.'
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/admin/financials/unfreeze - Unfreeze student account
router.post('/unfreeze', async (req: any, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { student_id } = req.body;
    if (!student_id) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'student_id مطلوب' });
    }

    const [userRes] = await connection.execute<any>(
      `UPDATE users SET is_frozen = FALSE, freeze_reason = NULL WHERE id = ? AND deleted_at IS NULL`,
      [student_id]
    );
    if (userRes.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    await connection.execute(
      `UPDATE student_financials SET is_frozen = FALSE, freeze_reason = NULL WHERE student_id = ?`,
      [student_id]
    );

    await connection.commit();
    res.json({
      success: true,
      message: 'تم فك تجميد حساب الطالب واستعادة كافة الصلاحيات الأكاديمية بنجاح.'
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/admin/financials/reset-password - Tech support reset password
router.post('/reset-password', async (req: any, res) => {
  try {
    const { user_id, custom_password, new_password } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id مطلوب' });

    const chosenPassword = (new_password || custom_password || '').trim();

    const tempPassword = chosenPassword.length >= 6
      ? chosenPassword
      : `Hadir@${crypto.randomInt(1000, 9999)}`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    await pool.execute(
      `UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? AND deleted_at IS NULL`,
      [hashedPassword, user_id]
    );

    const [uRows] = await pool.execute<any[]>(`SELECT name, email, role FROM users WHERE id = ?`, [user_id]);
    const user = uRows[0];

    res.json({
      success: true,
      message: `تم إعادة تعيين كلمة المرور بنجاح للمستخدم ${user?.name || ''}`,
      data: {
        userName: user?.name,
        userEmail: user?.email,
        role: user?.role,
        temporaryPassword: tempPassword,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
