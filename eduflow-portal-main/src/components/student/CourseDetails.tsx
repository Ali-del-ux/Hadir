import { useState, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Course, Lecture } from '@/types';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

function formatFileSize(size: unknown): string {
  if (typeof size === 'number' && !isNaN(size) && size > 0) {
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  }
  if (typeof size === 'string' && size.trim()) {
    const asNum = Number(size);
    if (!isNaN(asNum) && asNum > 0) {
      return asNum >= 1024 * 1024
        ? `${(asNum / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(asNum / 1024))} KB`;
    }
    return size;
  }
  return 'PDF';
}

interface CourseDetailsProps {
  course: Course;
  onBack: () => void;
}

export function CourseDetails({ course, onBack }: CourseDetailsProps) {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadLectures = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/lectures/student/course/${course.id}`);
        const lecturesData = response.data || [];
        // Map fields safely with graceful date & file size handling
        const mappedLectures = lecturesData.map((l: any) => {
          const rawDate = l.date || l.created_at || l.createdAt;
          const parsedDate = rawDate && !isNaN(new Date(rawDate).getTime())
            ? new Date(rawDate).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—';
          return {
            ...l,
            date: parsedDate,
            fileSize: formatFileSize(l.file_size ?? l.fileSize),
            fileUrl: l.file_url || l.fileUrl || null
          };
        });
        setLectures(mappedLectures);
      } catch (error) {
        console.error('Error loading lectures:', error);
      } finally {
        setLoading(false);
      }
    };

    if (course.id) {
      loadLectures();
    }
  }, [course.id]);

  const handleDownload = async (lecture: Lecture & { fileUrl?: string }) => {
    try {
      const token = localStorage.getItem('hadir_token');
      const response = await fetch(`/api/lectures/student/${encodeURIComponent(lecture.id)}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('فشل تحميل ملف المحاضرة');
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = lecture.file_name || `${lecture.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch (err: any) {
      toast({
        title: 'خطأ في التحميل',
        description: err.message || 'تعذر تحميل ملف المحاضرة',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-5 animate-slideUp">
      <PageHeader
        title={course.name}
        subtitle={course.code}
        onBack={onBack}
      />

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">جاري تحميل المحاضرات...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lectures.length > 0 ? (
            lectures.map((lecture) => (
              <LectureCard
                key={lecture.id}
                lecture={lecture}
                onDownload={() => handleDownload(lecture as any)}
              />
            ))
          ) : (
            <EmptyState
              icon={FileText}
              title="لا توجد محاضرات"
              description="لم يتم رفع أي محاضرات لهذه المادة بعد"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface LectureCardProps {
  lecture: Lecture;
  onDownload: () => void;
}

function LectureCard({ lecture, onDownload }: LectureCardProps) {
  return (
    <div className="bg-card p-4 rounded-xl shadow-card border border-border/50 flex justify-between items-center group hover:border-primary/20 hover:shadow-card-hover transition-all">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center text-destructive">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
            {lecture.title}
          </h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{lecture.date}</span>
            <span>•</span>
            <span>{lecture.fileSize}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onDownload}
        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        <Download className="w-5 h-5" />
      </button>
    </div>
  );
}
