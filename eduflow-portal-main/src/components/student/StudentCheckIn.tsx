function getDeviceFingerprint(): string {
  try {
    let fp = localStorage.getItem('hadir_device_fp');
    if (!fp) {
      fp = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('hadir_device_fp', fp);
    }
    return fp;
  } catch {
    return 'default_browser_device';
  }
}

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Keyboard, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface AttendanceRecord {
  id: number;
  session_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_number: string | null;
  attendance_time: string;
  method: 'qr' | 'manual';
  course_name: string;
  course_code: string;
  date: string;
  time: string;
}

export function StudentCheckIn() {
  const { user } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const scanningLockRef = useRef(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [attendanceRecord, setAttendanceRecord] = useState<AttendanceRecord | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (!isSuccess && !user?.is_frozen) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render(
        async (decodedText) => {
          if (scanningLockRef.current) return; // Prevent multiple rapid submissions (ref lock avoids stale closure)
          
          scanningLockRef.current = true;
          setIsScanning(true);
          try {
            // Stop scanning after successful read
            scanner?.clear().catch(() => {});
            
            const response = await api.post('/attendance/student/scan', { qr_code: decodedText.trim(), device_fingerprint: getDeviceFingerprint() });
            
            if (response.success) {
              setAttendanceRecord(response.data);
              setIsSuccess(true);
              toast({
                title: 'تم تسجيل الحضور بنجاح! ✓',
                description: `${response.data.course_name} - ${response.data.date} ${response.data.time}`,
              });
            } else {
              throw new Error(response.message || 'فشل في تسجيل الحضور');
            }
          } catch (error: any) {
            console.error('Scan error:', error);
            toast({
              title: 'خطأ في تسجيل الحضور',
              description: error.message || 'يرجى المحاولة مرة أخرى',
              variant: 'destructive',
            });
            scanningLockRef.current = false;
            setIsScanning(false);
            setScannerKey((k) => k + 1);
          }
        },
        () => {
          // Ignore frequent scan errors
        }
      );
    }

    return () => {
      scanner?.clear().catch(() => {});
    };
  }, [isSuccess, scannerKey, user?.is_frozen]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qrCode = manualCode.trim();
    if (!qrCode || scanningLockRef.current) return;

    scanningLockRef.current = true;
    setIsScanning(true);

    try {
      const response = await api.post('/attendance/student/scan', { qr_code: qrCode, device_fingerprint: getDeviceFingerprint() });

      if (response.success) {
        setAttendanceRecord(response.data);
        setIsSuccess(true);
        setShowManualInput(false);
        setManualCode('');
        toast({
          title: 'تم تسجيل الحضور بنجاح! ✓',
          description: `${response.data.course_name} - ${response.data.date} ${response.data.time}`,
        });
      } else {
        throw new Error(response.message || 'فشل في تسجيل الحضور');
      }
    } catch (error: any) {
      console.error('Manual entry error:', error);
      toast({
        title: 'خطأ في تسجيل الحضور',
        description: error.message || 'يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      scanningLockRef.current = false;
      setIsScanning(false);
    }
  };

  if (user?.is_frozen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-center space-y-4 animate-slideUp">
        <div className="w-20 h-20 rounded-full bg-destructive/15 border-2 border-destructive/30 flex items-center justify-center text-destructive">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-xl font-black text-destructive">تسجيل الحضور متوقف مؤقتاً</h2>
          <p className="text-sm text-foreground/90 font-medium">
            {user.freeze_reason || 'حسابك مجمد أكاديمياً لمراجعة الشؤون المالية، ولا يمكنك تسجيل الحضور حالياً.'}
          </p>
          <p className="text-xs text-muted-foreground">
            يمكنك الاطلاع على مقرراتك ودرجاتك وسجلك المالي، وسيتم تفعيل مسح رمز QR فور تسوية وضعك المالي.
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess && attendanceRecord) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-slideUp">
        <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center animate-pulse-glow">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">تم تسجيل حضورك</h2>
          <p className="text-muted-foreground">{attendanceRecord.course_name}</p>
          <p className="text-sm text-muted-foreground">{attendanceRecord.date} • {attendanceRecord.time}</p>
          <p className="text-xs text-muted-foreground">الرمز: {attendanceRecord.method === 'qr' ? 'مسح QR' : 'يدوي'}</p>
        </div>
        <Button variant="outline" onClick={() => { scanningLockRef.current = false; setIsSuccess(false); setAttendanceRecord(null); setIsScanning(false); }}>
          العودة للماسح
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-[60vh] animate-slideUp">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">امسح الكود للحضور</h2>
        <p className="text-muted-foreground text-sm">
          وجه الكاميرا نحو رمز QR الذي يعرضه أستاذ المادة
        </p>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-3xl shadow-lg border-4 border-primary">
        <div id="qr-reader" className="w-full bg-black/5" />
      </div>
      
      {isScanning && (
        <div className="text-primary font-bold animate-pulse">
          جاري التحقق من الرمز...
        </div>
      )}

      {!showManualInput ? (
        <Button variant="outline" onClick={() => setShowManualInput(true)} disabled={isScanning} className="w-full max-w-sm mt-4">
          <Keyboard className="w-4 h-4 ml-2" />
          إدخال الرمز يدوياً
        </Button>
      ) : (
        <form onSubmit={handleManualSubmit} className="w-full max-w-sm bg-card p-4 rounded-2xl border border-border space-y-3">
          <label className="text-xs font-bold text-foreground block">أدخل رمز الحضور (HADIR:...)</label>
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="HADIR:session:window:token"
            dir="ltr"
            className="font-mono text-xs"
            required
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 text-xs" onClick={() => { setShowManualInput(false); setManualCode(''); }}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isScanning || !manualCode.trim()} className="flex-1 text-xs gradient-primary text-primary-foreground font-bold">
              {isScanning ? 'جاري التحقق...' : 'تأكيد الحضور'}
            </Button>
          </div>
        </form>
      )}

      <div className="text-center space-y-2 max-w-sm">
        <p className="text-xs text-muted-foreground">
          خطوات الاستخدام:
        </p>
        <ol className="text-xs text-muted-foreground text-right space-y-1">
          <li>1. اسمح للمتصفح باستخدام الكاميرا</li>
          <li>2. وجه الكاميرا لرمز QR الخاص بالمحاضرة</li>
          <li>3. سيتم تسجيل الحضور تلقائياً</li>
        </ol>
      </div>
    </div>
  );
}
