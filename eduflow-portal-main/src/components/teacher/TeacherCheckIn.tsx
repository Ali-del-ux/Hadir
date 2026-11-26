import { Monitor, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Users, Wifi, Plus, X, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, getTeacherCourses } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function LocalQrImage({ value, size = 220, className = '' }: { value: string; size?: number; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl('');
      return;
    }
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-xl text-xs text-muted-foreground ${className}`}>
        جاري توليد QR...
      </div>
    );
  }

  return <img src={dataUrl} alt="QR Code" className={className} />;
}

interface AttendanceSession {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  date: string;
  time: string;
  qr_code: string;
  live_qr?: string;
  expires_in?: number;
  status: 'active' | 'closed';
  created_by: string;
  created_at: string;
  closed_at: string | null;
  attendees_count: number;
}

interface Course {
  id: string;
  code: string;
  name: string;
  teacher_id: string;
  schedule_day?: string;
  schedule_time?: string;
  room?: string;
}

export function TeacherCheckIn() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveProjectorSession, setLiveProjectorSession] = useState<AttendanceSession | null>(null);
  const [liveQrCode, setLiveQrCode] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(20);
  const [liveAttendeesCount, setLiveAttendeesCount] = useState<number>(0);
  const lastStepRef = useRef<number>(Math.floor(Date.now() / 1000 / 20));
  const fetchingLiveQrRef = useRef<boolean>(false);

  const { toast } = useToast();
  const { user } = useAuth();

  // Form state for creating new session
  const [formData, setFormData] = useState({
    course_id: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    room: '',
  });

  useEffect(() => {
    loadCourses();
    loadActiveSessions();
  }, []);

  // Keep active session card dynamic QR & attendees synced across 20s TOTP boundaries
  useEffect(() => {
    if (sessions.length === 0 || liveProjectorSession) return;
    lastStepRef.current = Math.floor(Date.now() / 1000 / 20);
    const stepWatcher = setInterval(() => {
      const currentStep = Math.floor(Date.now() / 1000 / 20);
      if (currentStep !== lastStepRef.current) {
        lastStepRef.current = currentStep;
        loadActiveSessions();
      }
    }, 1000);
    return () => clearInterval(stepWatcher);
  }, [sessions.length, liveProjectorSession]);

  // Dynamic 20s QR Projector Polling & Countdown
  useEffect(() => {
    if (!liveProjectorSession) return;

    let active = true;

    const fetchDynamicQR = async () => {
      if (fetchingLiveQrRef.current) return;
      fetchingLiveQrRef.current = true;
      try {
        const response = await api.get('/attendance/teacher/sessions/' + liveProjectorSession.id + '/live-qr');
        if (response.success && active && response.data) {
          setLiveQrCode(response.data.qrCode || response.data.qr_code);
          setCountdown(response.data.expiresIn || 20);
          if (response.data.attendeesCount !== undefined) {
            setLiveAttendeesCount(response.data.attendeesCount);
          }
        }
      } catch (err) {
        console.error('Failed to fetch live dynamic QR:', err);
      } finally {
        fetchingLiveQrRef.current = false;
      }
    };

    fetchDynamicQR();

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchDynamicQR();
          return 1;
        }
        return prev - 1;
      });
    }, 1000);

    const attendeesPoll = setInterval(async () => {
      try {
        const res = await api.get('/attendance/teacher/sessions/' + liveProjectorSession.id + '/attendees');
        if (res.success && active && Array.isArray(res.data)) {
          setLiveAttendeesCount(res.data.length);
        }
      } catch (e) {}
    }, 3000);

    return () => {
      active = false;
      clearInterval(countdownTimer);
      clearInterval(attendeesPoll);
    };
  }, [liveProjectorSession]);

  const loadCourses = async () => {
    try {
      let courses;
      if (user?.role === 'admin') {
        // Admin can see all courses
        const response = await api.get('/admin/courses');
        courses = response.data;
      } else {
        // Teacher sees only their courses
        courses = await getTeacherCourses();
      }
      setCourses(courses);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل المواد.',
        variant: 'destructive',
      });
    }
  };

  const loadActiveSessions = async () => {
    try {
      const response = await api.get('/attendance/teacher/sessions/active');
      if (response.success) {
        setSessions(response.data);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createSession = async () => {
    if (!formData.course_id || !formData.date || !formData.time) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const selectedCourse = courses.find((c) => c.id === formData.course_id);
      const sessionPayload = {
        ...formData,
        room: formData.room || selectedCourse?.room || 'قاعة المحاضرات الرئيسية',
      };
      const response = await api.post('/attendance/teacher/sessions', sessionPayload);
      if (response.success) {
        const createdQr = response.data.live_qr || response.data.qr_code || response.data.qrCode;
        toast({
          title: 'تم إنشاء الجلسة بنجاح',
          description: `رمز QR: ${createdQr}`,
        });
        setShowCreateForm(false);
        setFormData({
          course_id: '',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().slice(0, 5),
          room: '',
        });
        loadActiveSessions();
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في إنشاء الجلسة',
        description: error.message || 'يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshQR = async (sessionId: string) => {
    try {
      const response = await api.post(`/attendance/teacher/sessions/${sessionId}/refresh-qr`, {});
      if (response.success) {
        const refreshedQr = response.data.live_qr || response.data.qr_code || response.data.qrCode;
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, live_qr: refreshedQr } : s))
        );
        toast({
          title: 'تم تجديد الرمز',
          description: `الرمز الجديد: ${refreshedQr}`,
        });
        loadActiveSessions();
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في تجديد الرمز',
        description: error.message || 'يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    }
  };

  const closeSession = async (sessionId: string): Promise<boolean> => {
    try {
      await api.post(`/attendance/teacher/sessions/${sessionId}/close`, {});
      toast({
        title: 'تم إغلاق الجلسة',
        description: 'لم يعد بإمكان الطلاب التسجيل',
      });
      await loadActiveSessions();
      return true;
    } catch (error: any) {
      toast({
        title: 'خطأ في إغلاق الجلسة',
        description: error.message || 'يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
      return false;
    }
  };

  const viewAttendees = async (session: AttendanceSession) => {
    setLoading(true);
    try {
      const response = await api.get(`/attendance/teacher/sessions/${session.id}/attendees`);
      if (response.success) {
        setAttendees(response.data);
        setSelectedSession(session);
        setShowAttendeesModal(true);
      }
    } catch (error) {
      console.error('Error loading attendees:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل قائمة الحضور',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (showCreateForm) {
    const selectedCourseForForm = courses.find((c) => c.id === formData.course_id);

    return (
      <div className="space-y-6 animate-slideUp">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">إنشاء جلسة حضور</h2>
          <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">المادة</label>
            <select
              value={formData.course_id}
              onChange={(e) => {
                const cid = e.target.value;
                const c = courses.find((x) => x.id === cid);
                setFormData({
                  ...formData,
                  course_id: cid,
                  room: c?.room || '',
                });
              }}
              className="w-full p-3 border border-border rounded-xl bg-background"
            >
              <option value="">اختر المادة</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
            {selectedCourseForForm && (
              <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">الجدول الدراسي المعتمد:</span>
                  <span className="font-bold text-primary">
                    {selectedCourseForForm.schedule_day || 'الأحد - الثلاثاء'} • {selectedCourseForForm.schedule_time || '10:00 - 11:30'}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between pt-1 border-t border-primary/10">
                  <span>القاعة الدراسية:</span>
                  <span className="font-medium text-foreground">{selectedCourseForForm.room || 'المدرج 101'}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">التاريخ</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full p-3 border border-border rounded-xl bg-background"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">الوقت</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full p-3 border border-border rounded-xl bg-background"
            />
          </div>

          <Button
            onClick={createSession}
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء الجلسة'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">إدارة الحضور</h2>
          <p className="text-muted-foreground text-sm">إنشاء وإدارة جلسات الحضور</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="gradient-primary">
          <Plus className="w-4 h-4 ml-2" />
          جلسة جديدة
        </Button>
      </div>

      {/* Active Sessions */}
      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            لا توجد جلسات حضور نشطة
          </div>
        ) : (
          sessions.map((session) => {
            const activeCardQr = session.live_qr || session.qr_code;
            return (
            <div key={session.id} className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-foreground">{session.course_name}</h3>
                  <p className="text-sm text-muted-foreground">{session.course_code}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {session.date} • {session.time}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono bg-muted px-2 py-1 rounded max-w-[230px] truncate" title={activeCardQr}>
                    {activeCardQr}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {session.attendees_count} حاضر
                  </p>
                </div>
              </div>

              {/* Local Dynamic QR Code */}
              <div className="flex flex-col items-center gap-1.5 mb-3">
                <LocalQrImage
                  value={activeCardQr}
                  size={150}
                  className="w-32 h-32 rounded-lg border bg-white p-1"
                />
                {session.live_qr && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    رمز ديناميكي متجدد (20 ثانية)
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">

                <Button
                  size="sm"
                  onClick={() => {
                    setLiveProjectorSession(session);
                    setLiveQrCode(activeCardQr);
                    setLiveAttendeesCount(session.attendees_count ?? 0);
                    setCountdown(session.expires_in || 20);
                  }}
                  className="flex-1 bg-primary text-primary-foreground font-bold shadow-sm"
                >
                  <Monitor className="w-3.5 h-3.5 ml-1" />
                  عرض القاعة (ديناميكي)
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refreshQR(session.id)}
                  className="flex-1"
                >
                  <RefreshCw className="w-3 h-3 ml-1" />
                  تجديد
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => viewAttendees(session)}
                  className="flex-1"
                >
                  <Users className="w-3 h-3 ml-1" />
                  الحضور
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => closeSession(session.id)}
                  className="flex-1"
                >
                  <X className="w-3 h-3 ml-1" />
                  إغلاق
                </Button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Local QR Security Note */}
      <div className="pt-4 border-t border-border">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex justify-between items-center">
          <div>
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-500" />
              توليد محلي آمن لرموز الـ QR
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              يتم توليد الرموز محلياً داخل المتصفح دون إرسال رموز TOTP لأي خادم خارجي.
            </p>
          </div>
        </div>
      </div>


      {/* Live Projector Dynamic QR Dialog */}
      <Dialog
        open={!!liveProjectorSession}
        onOpenChange={(v) => {
          if (!v) {
            setLiveProjectorSession(null);
            loadActiveSessions();
          }
        }}
      >
        <DialogContent className="max-w-md text-center p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2 text-foreground">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              شاشة عرض الحضور بالقاعة
            </DialogTitle>
          </DialogHeader>

          {liveProjectorSession && (
            <div className="space-y-5 pt-2">
              <div className="bg-muted/40 p-3 rounded-xl border border-border">
                <div className="font-bold text-foreground text-base">{liveProjectorSession.course_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{liveProjectorSession.course_code}</div>
              </div>

              {/* Big Local Dynamic QR Code */}
              <div className="relative inline-block mx-auto p-4 bg-white rounded-3xl border-2 border-primary/20 shadow-xl">
                <LocalQrImage
                  value={liveQrCode || liveProjectorSession.live_qr || liveProjectorSession.qr_code}
                  size={260}
                  className="w-56 h-56 mx-auto rounded-xl"
                />
              </div>

              {/* 20s Countdown & Live Counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold px-2">
                  <span className="text-muted-foreground">صلاحية الرمز الحالي:</span>
                  <span className="text-primary font-bold text-sm">{countdown} ثوانٍ</span>
                </div>
                
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(countdown / 20) * 100}%` }}
                  />
                </div>
              </div>

              {/* Attendees Live Banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between text-emerald-600 font-bold text-sm">
                <span>الطلاب الحاضرون الآن:</span>
                <span className="text-lg bg-emerald-500/20 px-3 py-0.5 rounded-full">
                  {liveAttendeesCount} طالب
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50">
                🔒 هذا الرمز مشفر ويتغير تلقائياً كل <b>20 ثانية</b> لمنع تصوير الشاشة وتمرير الرمز للطلاب الغائبين.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setLiveProjectorSession(null);
                    loadActiveSessions();
                  }}
                >
                  إغلاق الشاشة
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    const closed = await closeSession(liveProjectorSession.id);
                    if (closed) {
                      setLiveProjectorSession(null);
                    }
                  }}
                >
                  إنهاء جلسة الحضور
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attendees Modal */}
      <Dialog open={showAttendeesModal} onOpenChange={setShowAttendeesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              قائمة الحضور - {selectedSession?.course_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {attendees.length === 0 ? (
              <p className="text-center text-muted-foreground">لا يوجد طلاب حاضرين بعد</p>
            ) : (
              <div className="space-y-2">
                {attendees.map((attendee, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div>
                      <p className="font-medium">{attendee.student_name}</p>
                      <p className="text-sm text-muted-foreground">{attendee.student_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{attendee.attendance_time}</p>
                      <p className="text-xs text-muted-foreground">{attendee.method === 'qr' ? 'مسح QR' : 'يدوي'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
