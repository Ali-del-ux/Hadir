import { useState, useEffect } from 'react';
import { DollarSign, Search, Plus, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, Lock, Unlock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SecureInput } from '@/components/ui/SecureInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

interface StudentFinancial {
  id: number;
  student_id: string;
  student_name: string;
  student_email: string;
  student_number: string;
  total_tuition: number;
  paid_amount: number;
  remaining_amount: number;
  discount: number;
  status: 'paid' | 'partial' | 'unpaid';
  is_frozen: boolean;
  freeze_reason: string | null;
  last_payment_date: string | null;
}

interface FinancialSummary {
  totalExpected: number;
  totalCollected: number;
  totalDebt: number;
  totalStudents: number;
  frozenCount: number;
}

export function AdminFinancials({ onBack }: { onBack?: () => void }) {
  const [students, setStudents] = useState<StudentFinancial[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'debt' | 'frozen'>('all');

  // Payment Dialog state
  const [payingStudent, setPayingStudent] = useState<StudentFinancial | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [autoUnfreeze, setAutoUnfreeze] = useState(true);
  const [processingPay, setProcessingPay] = useState(false);

  // Receipts History Dialog state
  const [receiptsStudent, setReceiptsStudent] = useState<StudentFinancial | null>(null);
  const [studentTransactions, setStudentTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Freeze Dialog state
  const [freezingStudent, setFreezingStudent] = useState<StudentFinancial | null>(null);
  const [freezeReason, setFreezeReason] = useState('تجميد الحساب لمراجعة الأقساط المالية المتأخرة');
  const [processingFreeze, setProcessingFreeze] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadFinancials();
  }, []);

  const loadFinancials = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/financials');
      if (res.success && res.data) {
        setStudents(res.data.students || []);
        setSummary(res.data.summary || null);
      }
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل في تحميل البيانات المالية',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingStudent || !payAmount || Number(payAmount) <= 0) return;

    const remaining = Math.max(0, Number(payingStudent.remaining_amount));
    if (remaining <= 0) {
      toast({
        title: 'لا توجد مستحقات',
        description: 'هذا الطالب مسدد لكامل الرسوم الدراسية بالفعل.',
        variant: 'destructive',
      });
      return;
    }

    if (Number(payAmount) > remaining) {
      toast({
        title: 'تجاوز المبلغ المتبقي',
        description: `الحد الأقصى المتبقي على الطالب هو ${remaining.toLocaleString('ar-LY')} د.ل`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessingPay(true);
      const res = await api.post('/admin/financials/payment', {
        student_id: payingStudent.student_id,
        amount: Number(payAmount),
        receipt_number: receiptNumber,
        payment_method: paymentMethod,
        notes: paymentNotes,
        auto_unfreeze: autoUnfreeze,
      });

      if (res.success) {
        toast({
          title: 'تم تسجيل السداد بنجاح',
          description: res.message,
        });
        setPayingStudent(null);
        setPayAmount('');
        setReceiptNumber('');
        setPaymentNotes('');
        loadFinancials();
      }
    } catch (err: any) {
      toast({
        title: 'خطأ في السداد',
        description: err.message || 'فشلت عملية حفظ الدفعة المالية',
        variant: 'destructive',
      });
    } finally {
      setProcessingPay(false);
    }
  };

  const openReceiptsDialog = async (student: StudentFinancial) => {
    setReceiptsStudent(student);
    setStudentTransactions([]);
    try {
      setLoadingTransactions(true);
      const res = await api.get(`/admin/financials/${encodeURIComponent(student.student_id)}/transactions`);
      if (res.success) {
        setStudentTransactions(res.data || []);
      }
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'تعذر تحميل سجل الإيصالات',
        variant: 'destructive',
      });
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleToggleFreeze = async (student: StudentFinancial) => {
    if (student.is_frozen) {
      // Unfreeze
      try {
        const res = await api.post('/admin/financials/unfreeze', { student_id: student.student_id });
        if (res.success) {
          toast({
            title: 'تم فك التجميد',
            description: res.message,
          });
          loadFinancials();
        }
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      }
    } else {
      // Open freeze dialog
      setFreezingStudent(student);
    }
  };

  const confirmFreeze = async () => {
    if (!freezingStudent) return;
    try {
      setProcessingFreeze(true);
      const res = await api.post('/admin/financials/freeze', {
        student_id: freezingStudent.student_id,
        reason: freezeReason,
      });
      if (res.success) {
        toast({
          title: 'تم تجميد حساب الطالب',
          description: res.message,
        });
        setFreezingStudent(null);
        loadFinancials();
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setProcessingFreeze(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.student_name.toLowerCase().includes(search.toLowerCase()) ||
                        (s.student_number || '').includes(search) ||
                        s.student_email.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    if (filter === 'paid') return Number(s.remaining_amount) <= 0;
    if (filter === 'debt') return Number(s.remaining_amount) > 0;
    if (filter === 'frozen') return Boolean(s.is_frozen);
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="p-2 -mr-2">
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-black text-foreground">الشؤون المالية وأقساط الطلاب</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة تسديد الرسوم الدراسية، تسجيل الدفعات، والتحكم في تجميد حسابات الطلاب المتعثرين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadFinancials} variant="outline" size="sm" className="text-xs font-bold h-9">
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الرسوم المستحقة</span>
            <div className="text-2xl font-black text-foreground">
              {Number(summary.totalExpected).toLocaleString('ar-LY')} <span className="text-xs font-normal">د.ل</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">{summary.totalStudents} طالب مسجل</span>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-xs font-bold text-emerald-600">المبالغ المُحصّلة</span>
            <div className="text-2xl font-black text-emerald-600">
              {Number(summary.totalCollected).toLocaleString('ar-LY')} <span className="text-xs font-normal">د.ل</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">
              نسبة التحصيل: {summary.totalExpected > 0 ? ((summary.totalCollected / summary.totalExpected) * 100).toFixed(1) : 0}%
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-xs font-bold text-rose-500">المتبقي (ديون الطلاب)</span>
            <div className="text-2xl font-black text-rose-500">
              {Number(summary.totalDebt).toLocaleString('ar-LY')} <span className="text-xs font-normal">د.ل</span>
            </div>
            <span className="text-[10px] text-muted-foreground block">أقساط غير مسددة</span>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <span className="text-xs font-bold text-amber-500">الحسابات المجمدة</span>
            <div className="text-2xl font-black text-amber-500">{summary.frozenCount}</div>
            <span className="text-[10px] text-muted-foreground block">طالب موقوف أكاديمياً</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="البحث بالاسم، الرقم الجامعي، أو البريد الإلكتروني..."
            className="pr-9 h-11 rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border self-start sm:self-auto overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            الكل ({students.length})
          </button>
          <button
            onClick={() => setFilter('debt')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filter === 'debt' ? 'bg-rose-500/15 text-rose-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            عليهم متأخرات
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filter === 'paid' ? 'bg-emerald-500/15 text-emerald-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            مسددين بالكامل
          </button>
          <button
            onClick={() => setFilter('frozen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filter === 'frozen' ? 'bg-amber-500/15 text-amber-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            المجمدين
          </button>
        </div>
      </div>

      {/* Financial Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="p-3">الطالب</th>
                <th className="p-3">الرقم الجامعي</th>
                <th className="p-3">إجمالي الرسوم</th>
                <th className="p-3">المسدد</th>
                <th className="p-3">المتبقي</th>
                <th className="p-3">الحالة المالية</th>
                <th className="p-3">حالة الحساب</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-xs">جاري تحميل السجلات المالية...</p>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    لا توجد سجلات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const remaining = Math.max(0, Number(s.remaining_amount));
                  const paid = Number(s.paid_amount);
                  const hasDebt = remaining > 0;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-bold text-foreground">
                        <div>{s.student_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono font-normal truncate max-w-[160px]">{s.student_email}</div>
                      </td>

                      <td className="p-3 font-mono font-bold">{s.student_number || '—'}</td>

                      <td className="p-3 font-mono font-semibold whitespace-nowrap">
                        {Number(s.total_tuition).toLocaleString('ar-LY')} د.ل
                      </td>

                      <td className="p-3 font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {paid.toLocaleString('ar-LY')} د.ل
                      </td>

                      <td className="p-3 font-mono font-bold whitespace-nowrap">
                        {hasDebt ? (
                          <span className="text-rose-500">{remaining.toLocaleString('ar-LY')} د.ل</span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">0 د.ل (خالص)</span>
                        )}
                      </td>

                      <td className="p-3">
                        {!hasDebt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            مسدد
                          </span>
                        ) : paid > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 whitespace-nowrap">
                            مسدد جزئياً
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 whitespace-nowrap">
                            غير مسدد
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {s.is_frozen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30 whitespace-nowrap">
                            <Lock className="w-3 h-3" />
                            حساب مجمّد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 whitespace-nowrap">
                            نشط
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!hasDebt}
                            onClick={() => {
                              setPayingStudent(s);
                              setPayAmount(String(remaining));
                              setReceiptNumber(`REC-${Date.now().toString().slice(-6)}`);
                              setAutoUnfreeze(Boolean(s.is_frozen));
                            }}
                            className="h-8 px-2.5 text-xs font-bold rounded-lg"
                          >
                            <DollarSign className="w-3.5 h-3.5 ml-1 text-emerald-600" />
                            سداد
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openReceiptsDialog(s)}
                            className="h-8 px-2 text-xs font-bold rounded-lg text-primary hover:bg-primary/10"
                            title="عرض إيصالات الطالب"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant={s.is_frozen ? 'default' : 'ghost'}
                            onClick={() => handleToggleFreeze(s)}
                            className={`h-8 px-2.5 text-xs font-bold rounded-lg ${
                              s.is_frozen
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'text-rose-500 hover:bg-rose-500/10'
                            }`}
                          >
                            {s.is_frozen ? (
                              <>
                                <Unlock className="w-3.5 h-3.5 ml-1" />
                                فك التجميد
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 ml-1" />
                                تجميد
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!payingStudent} onOpenChange={(open) => !open && setPayingStudent(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground">
              تسجيل سداد قسط دراسي
            </DialogTitle>
          </DialogHeader>

          {payingStudent && (
            <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1 text-xs">
                <p><b>اسم الطالب:</b> {payingStudent.student_name}</p>
                <p><b>الرقم الجامعي:</b> {payingStudent.student_number || '—'}</p>
                <p><b>المتبقي بذمته:</b> <span className="font-bold text-rose-500">{Number(payingStudent.remaining_amount).toLocaleString('ar-LY')} د.ل</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">المبلغ المدفوع (د.ل)</label>
                <Input
                  type="number"
                  min="1"
                  max={Math.max(1, Number(payingStudent.remaining_amount))}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-11 rounded-xl font-mono text-left"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">رقم الإيصال أو الحوالة</label>
                <SecureInput
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="h-11 rounded-xl font-mono text-left"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-11 px-3 py-2 rounded-xl border border-border bg-background text-xs leading-normal"
                >
                  <option value="نقدي">نقدي (خزينة الكلية)</option>
                  <option value="بطاقة مصرفية">بطاقة مصرفية (POS)</option>
                  <option value="حوالة مصرفية">حوالة مصرفية مباشرة</option>
                  <option value="شيك مصدق">شيك مصدق</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">ملاحظات (اختياري)</label>
                <SecureInput
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="ملاحظات محاسبية إضافية..."
                  className="h-11 rounded-xl"
                  maxLen={200}
                />
              </div>

              {payingStudent.is_frozen && Number(payAmount) >= Number(payingStudent.remaining_amount) && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUnfreeze}
                    onChange={(e) => setAutoUnfreeze(e.target.checked)}
                    className="rounded border-emerald-500"
                  />
                  فك تجميد حساب الطالب تلقائياً عند سداد كامل المستحقات
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPayingStudent(null)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={processingPay} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  {processingPay ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : 'تأكيد السداد'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Freeze Confirmation Dialog */}
      <Dialog open={!!freezingStudent} onOpenChange={(open) => !open && setFreezingStudent(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-rose-500 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              تجميد حساب الطالب
            </DialogTitle>
          </DialogHeader>

          {freezingStudent && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                تجميد حساب الطالب <b>{freezingStudent.student_name}</b> سيمنعه فوراً من تسجيل الحضور في المحاضرات أو تسليم الواجبات لحين سداد المتأخرات المالية ({freezingStudent.remaining_amount} د.ل).
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">سبب التجميد الموجه للطالب:</label>
                <SecureInput
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="h-11 rounded-xl"
                  maxLen={200}
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setFreezingStudent(null)}>
                  إلغاء
                </Button>
                <Button type="button" disabled={processingFreeze} onClick={confirmFreeze} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  {processingFreeze ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : 'تأكيد التجميد'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Receipts Dialog */}
      <Dialog open={!!receiptsStudent} onOpenChange={(open) => !open && setReceiptsStudent(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              سجل إيصالات الطالب: {receiptsStudent?.student_name}
            </DialogTitle>
          </DialogHeader>

          {loadingTransactions ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              جاري تحميل الإيصالات...
            </div>
          ) : studentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
              لا توجد إيصالات مالية مسجلة لهذا الطالب
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              {studentTransactions.map((tx) => (
                <div key={tx.id} className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-foreground font-mono">{tx.receipt_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {tx.payment_method} • {new Date(tx.created_at).toLocaleDateString('ar-LY')}
                    </div>
                    {tx.notes && <div className="text-[10px] text-muted-foreground mt-0.5">{tx.notes}</div>}
                  </div>
                  <div className="text-left">
                    <div className="font-black text-emerald-600">+{Number(tx.amount).toLocaleString('ar-LY')} د.ل</div>
                    {tx.balance_after !== undefined && (
                      <div className="text-[10px] text-muted-foreground">
                        المتبقي: {Number(tx.balance_after).toLocaleString('ar-LY')} د.ل
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
