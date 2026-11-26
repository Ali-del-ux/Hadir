import type { Plugin, ViteDevServer } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import QRCode from 'qrcode';

// ============================================================================
// INTERFACES & AUTHORITATIVE IN-MEMORY STORES
// ============================================================================

export interface MockGradeItem {
  id: number;
  course_id: string;
  name: string;
  category: 'attendance' | 'assignments' | 'midterm' | 'final' | 'other';
  weight: number;
  max_score: number;
}

export interface MockAttendanceAttendee {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  student_email?: string;
  device_fingerprint?: string;
  check_in_time: string;
  attendance_time: string;
  timestamp?: string;
  method: 'qr' | 'manual';
  status: 'present' | 'late' | 'absent';
}

export interface MockAttendanceSession {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  date: string;
  time: string;
  room: string;
  schedule_day?: string;
  schedule_time?: string;
  qr_secret: string;
  qr_code: string;
  qrCode: string;
  status: 'active' | 'closed';
  created_by: string;
  created_at: string;
  closed_at: string | null;
  attendees: MockAttendanceAttendee[];
  attendees_count: number;
  attendeesCount: number;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  student_id?: string | null;
  studentId?: string | null;
  teacher_code?: string | null;
  department?: string | null;
  avatar?: string | null;
  is_active: number;
  is_frozen: number;
  freeze_reason: string | null;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  token_version: number;
}

interface MockLecture {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  date: string;
  created_at: string;
}

interface MockAssignment {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  title: string;
  description?: string;
  due_date: string;
  max_score: number;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

interface MockSubmission {
  id: number;
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  student_number: string;
  file_url: string;
  file_name: string;
  file_size: number;
  submitted_at: string;
  status: 'submitted' | 'graded';
  grade: number | null;
  feedback: string | null;
}

// ============================================================================
// INITIAL SEED DATA (Aligned with Backend seedDatabase.ts & SCOPE.md)
// ============================================================================

let mockFinancialStudents = [
  {
    id: 1,
    student_id: 'usr-1',
    student_name: 'علي بن طاهر',
    student_number: '2340033',
    student_email: 'student1@test.com',
    total_tuition: 3500.0,
    paid_amount: 3500.0,
    remaining_amount: 0.0,
    discount: 0.0,
    status: 'paid',
    is_frozen: false,
    freeze_reason: null as string | null,
    last_payment_date: '2026-10-25',
  },
  {
    id: 2,
    student_id: 'usr-2',
    student_name: 'إبراهيم الزغيد',
    student_number: '2450191',
    student_email: '2450191@student.edu',
    total_tuition: 3500.0,
    paid_amount: 2000.0,
    remaining_amount: 1500.0,
    discount: 0.0,
    status: 'partial',
    is_frozen: false,
    freeze_reason: null as string | null,
    last_payment_date: '2026-09-20',
  },
  {
    id: 3,
    student_id: 'usr-3',
    student_name: 'أبو القاسم الكوربو',
    student_number: '2450154',
    student_email: '2450154@student.edu',
    total_tuition: 3500.0,
    paid_amount: 0.0,
    remaining_amount: 3500.0,
    discount: 0.0,
    status: 'unpaid',
    is_frozen: true,
    freeze_reason: 'تأخر في سداد الرسوم الدراسية للفصل الحالي',
    last_payment_date: null as string | null,
  },
  {
    id: 4,
    student_id: 'usr-4',
    student_name: 'أحمد الثني',
    student_number: '2340068',
    student_email: '2340068@student.edu',
    total_tuition: 3500.0,
    paid_amount: 3500.0,
    remaining_amount: 0.0,
    discount: 0.0,
    status: 'paid',
    is_frozen: false,
    freeze_reason: null as string | null,
    last_payment_date: '2026-10-01',
  },
  {
    id: 5,
    student_id: 'usr-5',
    student_name: 'سارة محمود الشريف',
    student_number: '2340088',
    student_email: 'sara@student.edu',
    total_tuition: 3500.0,
    paid_amount: 1750.0,
    remaining_amount: 1750.0,
    discount: 0.0,
    status: 'partial',
    is_frozen: false,
    freeze_reason: null as string | null,
    last_payment_date: '2026-10-15',
  },
  {
    id: 6,
    student_id: 'usr-6',
    student_name: 'محمد طارق الفيتوري',
    student_number: '2340092',
    student_email: 'mtariq@student.edu',
    total_tuition: 3500.0,
    paid_amount: 0.0,
    remaining_amount: 3500.0,
    discount: 0.0,
    status: 'unpaid',
    is_frozen: true,
    freeze_reason: 'إيقاف إداري لعدم تجديد القيد واستيفاء الرسوم',
    last_payment_date: null as string | null,
  },
  {
    id: 7,
    student_id: 'usr-7',
    student_name: 'فاطمة عمر الورفلي',
    student_number: '2340105',
    student_email: 'fatima@student.edu',
    total_tuition: 3500.0,
    paid_amount: 3500.0,
    remaining_amount: 0.0,
    discount: 0.0,
    status: 'paid',
    is_frozen: false,
    freeze_reason: null as string | null,
    last_payment_date: '2026-10-20',
  },
];

let mockFinancialTransactions: Record<string, any[]> = {
  'usr-1': [
    {
      id: 101,
      amount: 2000.0,
      balance_after: 1500.0,
      receipt_number: 'REC-2026-0941',
      payment_method: 'حوالة مصرفية (مصرف الأمان)',
      created_at: '2026-09-10T09:30:00Z',
      notes: 'القسط الدراسي الأول - بداية العام',
    },
    {
      id: 102,
      amount: 1500.0,
      balance_after: 0.0,
      receipt_number: 'REC-2026-1185',
      payment_method: 'سداد نقدي مباشر للخزينة',
      created_at: '2026-10-25T11:00:00Z',
      notes: 'تسوية القسط الثاني وإغلاق الرصيد كاملاً',
    },
  ],
  'usr-2': [
    {
      id: 103,
      amount: 2000.0,
      balance_after: 1500.0,
      receipt_number: 'REC-2026-0988',
      payment_method: 'نقدي',
      created_at: '2026-09-20T10:15:00Z',
      notes: 'القسط الأول',
    },
  ],
};

let mockUsersList: MockUser[] = [
  { id: 'usr-1', name: 'علي بن طاهر', email: 'student1@test.com', password: 'password123', role: 'student', student_id: '2340033', studentId: '2340033', department: 'أمن سيبراني', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-2', name: 'إبراهيم الزغيد', email: '2450191@student.edu', password: 'password123', role: 'student', student_id: '2450191', studentId: '2450191', department: 'ذكاء اصطناعي', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-3', name: 'أبو القاسم الكوربو', email: '2450154@student.edu', password: 'password123', role: 'student', student_id: '2450154', studentId: '2450154', department: 'أمن سيبراني', is_active: 1, is_frozen: 1, freeze_reason: 'تأخر في سداد الرسوم الدراسية للفصل الحالي', two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-4', name: 'أحمد الثني', email: '2340068@student.edu', password: 'password123', role: 'student', student_id: '2340068', studentId: '2340068', department: 'هندسة برمجيات', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-5', name: 'سارة محمود الشريف', email: 'sara@student.edu', password: 'password123', role: 'student', student_id: '2340088', studentId: '2340088', department: 'علم بيانات', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-6', name: 'محمد طارق الفيتوري', email: 'mtariq@student.edu', password: 'password123', role: 'student', student_id: '2340092', studentId: '2340092', department: 'أمن سيبراني', is_active: 1, is_frozen: 1, freeze_reason: 'إيقاف إداري لعدم تجديد القيد واستيفاء الرسوم', two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-7', name: 'فاطمة عمر الورفلي', email: 'fatima@student.edu', password: 'password123', role: 'student', student_id: '2340105', studentId: '2340105', department: 'علوم حاسوب', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-8', name: 'د. أحمد علي البشير', email: 'teacher@test.com', password: 'password123', role: 'teacher', teacher_code: 'T0001', department: 'أمن المعلومات والحاسوب', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-9', name: 'د. أسماء العصار', email: 'asmaa@university.edu', password: 'password123', role: 'teacher', teacher_code: 'T0002', department: 'هندسة برمجيات', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-10', name: 'د. محمد الجهاني', email: 'mohammedj@university.edu', password: 'password123', role: 'teacher', teacher_code: 'T0003', department: 'علوم حاسوب', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-11', name: 'د. حذيفة غولة', email: 'huthaifa@university.edu', password: 'password123', role: 'teacher', teacher_code: 'T0004', department: 'شبكات', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-12', name: 'د. آلاء الزواوي', email: 'alaa@university.edu', password: 'password123', role: 'teacher', teacher_code: 'T0005', department: 'علم بيانات', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
  { id: 'usr-13', name: 'مدير النظام الأكاديمي', email: 'admin@hadir.edu', password: 'admin123', role: 'admin', department: 'عمادة القبول والتسجيل', is_active: 1, is_frozen: 0, freeze_reason: null, two_factor_enabled: false, two_factor_secret: null, token_version: 1 },
];

let mockCoursesList = [
  {
    id: 'crs-1',
    code: 'SEC-401',
    name: 'أمن الشبكات والتشفير المتقدم',
    teacher_id: 'usr-8',
    teacherId: 'usr-8',
    teacher_name: 'د. أحمد علي البشير',
    teacherName: 'د. أحمد علي البشير',
    teacher_department: 'أمن سيبراني',
    credit_hours: 3,
    creditHours: 3,
    students_count: 5,
    lectures_count: 2,
    schedule_day: 'الأحد - الثلاثاء',
    schedule_time: '10:00 - 11:30 صباحاً',
    room: 'قاعة إدوارد سنودن - مدرج 101',
    description: 'دراسة المعايير المتقدمة للأمن السيبراني، خوارزميات التشفير وفحص الاختراق الأخلاقي.',
  },
  {
    id: 'crs-2',
    code: 'CS-302',
    name: 'معمارية الحاسوب والأنظمة الموزعة',
    teacher_id: 'usr-10',
    teacherId: 'usr-10',
    teacher_name: 'د. محمد الجهاني',
    teacherName: 'د. محمد الجهاني',
    teacher_department: 'علوم حاسوب',
    credit_hours: 3,
    creditHours: 3,
    students_count: 2,
    lectures_count: 1,
    schedule_day: 'الإثنين - الأربعاء',
    schedule_time: '12:00 - 01:30 ظهراً',
    room: 'مختبر المعالجات الدقيقة - معمل 2',
    description: 'تحليل بنية المعالجات، الذاكرة المخبأة، وخطوط المعالجة الفائقة.',
  },
  {
    id: 'crs-3',
    code: 'SE-305',
    name: 'تصميم وهندسة البرمجيات الآمنة',
    teacher_id: 'usr-8',
    teacherId: 'usr-8',
    teacher_name: 'د. أحمد علي البشير',
    teacherName: 'د. أحمد علي البشير',
    teacher_department: 'هندسة برمجيات',
    credit_hours: 3,
    creditHours: 3,
    students_count: 3,
    lectures_count: 1,
    schedule_day: 'الخميس',
    schedule_time: '09:00 - 12:00 ظهراً',
    room: 'قاعة الخوارزمي - مبنى التقنية',
    description: 'أنماط التصميم المعماري، مراجعة الشيفرات البرمجية، وتطبيق ممارسات DevSecOps.',
  },
  {
    id: 'crs-4',
    code: 'AI-301',
    name: 'علم البيانات وتعلم الآلة التطبيقي',
    teacher_id: 'usr-12',
    teacherId: 'usr-12',
    teacher_name: 'د. آلاء الزواوي',
    teacherName: 'د. آلاء الزواوي',
    teacher_department: 'ذكاء اصطناعي',
    credit_hours: 3,
    creditHours: 3,
    students_count: 2,
    lectures_count: 1,
    schedule_day: 'الأحد - الثلاثاء',
    schedule_time: '01:30 - 03:00 مساءً',
    room: 'مختبر الذكاء الاصطناعي - قاعة 4',
    description: 'بناء النماذج الذكية التنبؤية باستخدام مكتبات Scikit-Learn و PyTorch.',
  },
];

let mockEnrollmentsMap: Record<string, any[]> = {
  'crs-1': [
    { id: 'usr-1', student_id: 'usr-1', studentId: 'usr-1', student_number: '2340033', name: 'علي بن طاهر', email: 'student1@test.com', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-2', student_id: 'usr-2', studentId: 'usr-2', student_number: '2450191', name: 'إبراهيم الزغيد', email: '2450191@student.edu', department: 'ذكاء اصطناعي', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-3', student_id: 'usr-3', studentId: 'usr-3', student_number: '2450154', name: 'أبو القاسم الكوربو', email: '2450154@student.edu', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-4', student_id: 'usr-4', studentId: 'usr-4', student_number: '2340068', name: 'أحمد الثني', email: '2340068@student.edu', department: 'هندسة برمجيات', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-5', student_id: 'usr-5', studentId: 'usr-5', student_number: '2340088', name: 'سارة محمود الشريف', email: 'sara@student.edu', department: 'علم بيانات', enrolled_at: '2026-09-02', enrollment_date: '2026-09-02' },
    { id: 'usr-7', student_id: 'usr-7', studentId: 'usr-7', student_number: '2340105', name: 'فاطمة عمر الورفلي', email: 'fatima@student.edu', department: 'علوم حاسوب', enrolled_at: '2026-09-03', enrollment_date: '2026-09-03' },
  ],
  'crs-2': [
    { id: 'usr-1', student_id: 'usr-1', studentId: 'usr-1', student_number: '2340033', name: 'علي بن طاهر', email: 'student1@test.com', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-4', student_id: 'usr-4', studentId: 'usr-4', student_number: '2340068', name: 'أحمد الثني', email: '2340068@student.edu', department: 'هندسة برمجيات', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
  ],
  'crs-3': [
    { id: 'usr-1', student_id: 'usr-1', studentId: 'usr-1', student_number: '2340033', name: 'علي بن طاهر', email: 'student1@test.com', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-2', student_id: 'usr-2', studentId: 'usr-2', student_number: '2450191', name: 'إبراهيم الزغيد', email: '2450191@student.edu', department: 'ذكاء اصطناعي', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-3', student_id: 'usr-3', studentId: 'usr-3', student_number: '2450154', name: 'أبو القاسم الكوربو', email: '2450154@student.edu', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-5', student_id: 'usr-5', studentId: 'usr-5', student_number: '2340088', name: 'سارة محمود الشريف', email: 'sara@student.edu', department: 'علم بيانات', enrolled_at: '2026-09-02', enrollment_date: '2026-09-02' },
  ],
  'crs-4': [
    { id: 'usr-1', student_id: 'usr-1', studentId: 'usr-1', student_number: '2340033', name: 'علي بن طاهر', email: 'student1@test.com', department: 'أمن سيبراني', enrolled_at: '2026-09-01', enrollment_date: '2026-09-01' },
    { id: 'usr-7', student_id: 'usr-7', studentId: 'usr-7', student_number: '2340105', name: 'فاطمة عمر الورفلي', email: 'fatima@student.edu', department: 'علوم حاسوب', enrolled_at: '2026-09-03', enrollment_date: '2026-09-03' },
  ],
};

let mockGradeItemsStore: Record<string, MockGradeItem[]> = {
  'crs-1': [
    { id: 1, course_id: 'crs-1', name: 'الحضور والالتزام الأكاديمي', category: 'attendance', weight: 10, max_score: 100 },
    { id: 2, course_id: 'crs-1', name: 'الواجبات والتكليفات العملية', category: 'assignments', weight: 20, max_score: 100 },
    { id: 3, course_id: 'crs-1', name: 'الامتحان النصفي (Midterm)', category: 'midterm', weight: 30, max_score: 100 },
    { id: 4, course_id: 'crs-1', name: 'الامتحان النهائي والشفوي', category: 'final', weight: 40, max_score: 100 },
  ],
  'crs-2': [
    { id: 5, course_id: 'crs-2', name: 'الحضور والمشاركة', category: 'attendance', weight: 10, max_score: 100 },
    { id: 6, course_id: 'crs-2', name: 'الواجبات والمختبرات', category: 'assignments', weight: 20, max_score: 100 },
    { id: 7, course_id: 'crs-2', name: 'الامتحان النصفي', category: 'midterm', weight: 30, max_score: 100 },
    { id: 8, course_id: 'crs-2', name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
  ],
  'crs-3': [
    { id: 9, course_id: 'crs-3', name: 'الحضور والالتزام', category: 'attendance', weight: 10, max_score: 100 },
    { id: 10, course_id: 'crs-3', name: 'مشروع البرمجيات الآمنة', category: 'assignments', weight: 25, max_score: 100 },
    { id: 11, course_id: 'crs-3', name: 'الامتحان النصفي', category: 'midterm', weight: 25, max_score: 100 },
    { id: 12, course_id: 'crs-3', name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
  ],
  'crs-4': [
    { id: 13, course_id: 'crs-4', name: 'الحضور والمتابعة', category: 'attendance', weight: 10, max_score: 100 },
    { id: 14, course_id: 'crs-4', name: 'تطبيقات تعلم الآلة', category: 'assignments', weight: 20, max_score: 100 },
    { id: 15, course_id: 'crs-4', name: 'الامتحان النصفي', category: 'midterm', weight: 30, max_score: 100 },
    { id: 16, course_id: 'crs-4', name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
  ],
};

// Only non-attendance graded scores live here (attendance is computed from mockAttendanceSessions + override)
let mockStudentScoresStore: Record<string, Record<string, Record<number, number>>> = {
  'crs-1': {
    'usr-1': { 2: 98, 3: 96, 4: 97 },
    'usr-2': { 2: 88, 3: 85, 4: 90 },
    'usr-3': { 2: 80, 3: 82 },
    'usr-4': { 2: 92, 3: 90, 4: 94 },
    'usr-5': { 2: 86, 3: 84, 4: 88 },
    'usr-7': { 2: 90, 3: 92, 4: 93 },
  },
  'crs-2': {
    'usr-1': { 6: 92, 7: 90, 8: 93 },
    'usr-4': { 6: 80, 7: 82, 8: 85 },
  },
  'crs-3': {
    'usr-1': { 10: 98, 11: 97, 12: 98 },
    'usr-2': { 10: 85, 11: 88, 12: 86 },
    'usr-3': { 10: 76 },
    'usr-5': { 10: 90, 11: 85, 12: 89 },
  },
  'crs-4': {
    'usr-1': { 14: 90, 15: 90, 16: 90 },
    'usr-7': { 14: 94, 15: 88, 16: 91 },
  },
};

let mockReportOverrides: Record<string, Record<string, { finalGrade: string | null; attendanceOverride: number }>> = {};

const SEED_SECRET_101 = crypto.createHash('sha256').update('seed-ses-101').digest('hex');
const SEED_SECRET_100 = crypto.createHash('sha256').update('seed-ses-100').digest('hex');
const SEED_SECRET_201 = crypto.createHash('sha256').update('seed-ses-201').digest('hex');
const SEED_SECRET_202 = crypto.createHash('sha256').update('seed-ses-202').digest('hex');
const SEED_SECRET_301 = crypto.createHash('sha256').update('seed-ses-301').digest('hex');
const SEED_SECRET_401 = crypto.createHash('sha256').update('seed-ses-401').digest('hex');

function computeTotpQr(sessionId: string, secret: string) {
  const interval = 20;
  const nowSec = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(nowSec / interval);
  const expiresIn = interval - (nowSec % interval);
  const token = crypto
    .createHmac('sha256', secret)
    .update(`${sessionId}:${currentWindow}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  const qrCode = `HADIR:${sessionId}:${currentWindow}:${token}`;
  return { qrCode, expiresIn, currentWindow };
}

function sanitizeMockSession(session: MockAttendanceSession) {
  const { qr_secret: _secret, ...safeSession } = session;
  if (session.status === 'active') {
    const qr = computeTotpQr(session.id, session.qr_secret);
    session.qr_code = qr.qrCode;
    session.qrCode = qr.qrCode;
    return {
      ...safeSession,
      qr_code: qr.qrCode,
      qrCode: qr.qrCode,
      live_qr: qr.qrCode,
      expires_in: qr.expiresIn,
    };
  }
  return safeSession;
}

let mockAttendanceSessions: MockAttendanceSession[] = [
  {
    id: 'ses-101',
    course_id: 'crs-1',
    course_name: 'أمن الشبكات والتشفير المتقدم',
    course_code: 'SEC-401',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    room: 'قاعة إدوارد سنودن - مدرج 101',
    schedule_day: 'الأحد - الثلاثاء',
    schedule_time: '10:00 - 11:30 صباحاً',
    qr_secret: SEED_SECRET_101,
    qr_code: computeTotpQr('ses-101', SEED_SECRET_101).qrCode,
    qrCode: computeTotpQr('ses-101', SEED_SECRET_101).qrCode,
    status: 'active',
    created_by: 'usr-8',
    created_at: new Date().toISOString(),
    closed_at: null,
    attendees: [
      { id: 'att-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '10:02:15', attendance_time: '10:02:15', method: 'qr', status: 'present' },
      { id: 'att-2', student_id: 'usr-2', student_name: 'إبراهيم الزغيد', student_number: '2450191', student_email: '2450191@student.edu', check_in_time: '10:03:40', attendance_time: '10:03:40', method: 'qr', status: 'present' },
      { id: 'att-4', student_id: 'usr-4', student_name: 'أحمد الثني', student_number: '2340068', student_email: '2340068@student.edu', check_in_time: '10:04:12', attendance_time: '10:04:12', method: 'qr', status: 'present' },
    ],
    attendees_count: 3,
    attendeesCount: 3,
  },
  {
    id: 'ses-100',
    course_id: 'crs-1',
    course_name: 'أمن الشبكات والتشفير المتقدم',
    course_code: 'SEC-401',
    date: '2026-11-03',
    time: '10:00',
    room: 'قاعة إدوارد سنودن - مدرج 101',
    schedule_day: 'الأحد - الثلاثاء',
    schedule_time: '10:00 - 11:30 صباحاً',
    qr_secret: SEED_SECRET_100,
    qr_code: 'CLOSED_QR_SESSION_100',
    qrCode: 'CLOSED_QR_SESSION_100',
    status: 'closed',
    created_by: 'usr-8',
    created_at: '2026-11-03T10:00:00Z',
    closed_at: '2026-11-03T11:30:00Z',
    attendees: [
      { id: 'att-100-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '10:01:00', attendance_time: '10:01:00', method: 'qr', status: 'present' },
      { id: 'att-100-2', student_id: 'usr-2', student_name: 'إبراهيم الزغيد', student_number: '2450191', student_email: '2450191@student.edu', check_in_time: '10:02:00', attendance_time: '10:02:00', method: 'qr', status: 'present' },
      { id: 'att-100-4', student_id: 'usr-4', student_name: 'أحمد الثني', student_number: '2340068', student_email: '2340068@student.edu', check_in_time: '10:03:00', attendance_time: '10:03:00', method: 'qr', status: 'present' },
      { id: 'att-100-5', student_id: 'usr-5', student_name: 'سارة محمود الشريف', student_number: '2340088', student_email: 'sara@student.edu', check_in_time: '10:04:00', attendance_time: '10:04:00', method: 'qr', status: 'present' },
      { id: 'att-100-7', student_id: 'usr-7', student_name: 'فاطمة عمر الورفلي', student_number: '2340105', student_email: 'fatima@student.edu', check_in_time: '10:05:00', attendance_time: '10:05:00', method: 'qr', status: 'present' },
    ],
    attendees_count: 5,
    attendeesCount: 5,
  },
  {
    id: 'ses-201',
    course_id: 'crs-2',
    course_name: 'معمارية الحاسوب والأنظمة الموزعة',
    course_code: 'CS-302',
    date: '2026-11-01',
    time: '12:00',
    room: 'مختبر المعالجات الدقيقة - معمل 2',
    qr_secret: SEED_SECRET_201,
    qr_code: 'CLOSED_QR_SESSION_201',
    qrCode: 'CLOSED_QR_SESSION_201',
    status: 'closed',
    created_by: 'usr-10',
    created_at: '2026-11-01T12:00:00Z',
    closed_at: '2026-11-01T13:30:00Z',
    attendees: [
      { id: 'att-201-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '12:02:00', attendance_time: '12:02:00', method: 'qr', status: 'present' },
      { id: 'att-201-4', student_id: 'usr-4', student_name: 'أحمد الثني', student_number: '2340068', student_email: '2340068@student.edu', check_in_time: '12:03:00', attendance_time: '12:03:00', method: 'qr', status: 'present' },
    ],
    attendees_count: 2,
    attendeesCount: 2,
  },
  {
    id: 'ses-202',
    course_id: 'crs-2',
    course_name: 'معمارية الحاسوب والأنظمة الموزعة',
    course_code: 'CS-302',
    date: '2026-11-04',
    time: '12:00',
    room: 'مختبر المعالجات الدقيقة - معمل 2',
    qr_secret: SEED_SECRET_202,
    qr_code: 'CLOSED_QR_SESSION_202',
    qrCode: 'CLOSED_QR_SESSION_202',
    status: 'closed',
    created_by: 'usr-10',
    created_at: '2026-11-04T12:00:00Z',
    closed_at: '2026-11-04T13:30:00Z',
    attendees: [
      { id: 'att-202-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '12:01:00', attendance_time: '12:01:00', method: 'qr', status: 'present' },
    ],
    attendees_count: 1,
    attendeesCount: 1,
  },
  {
    id: 'ses-301',
    course_id: 'crs-3',
    course_name: 'تصميم وهندسة البرمجيات الآمنة',
    course_code: 'SE-305',
    date: '2026-11-02',
    time: '09:00',
    room: 'قاعة الخوارزمي - مبنى التقنية',
    qr_secret: SEED_SECRET_301,
    qr_code: 'CLOSED_QR_SESSION_301',
    qrCode: 'CLOSED_QR_SESSION_301',
    status: 'closed',
    created_by: 'usr-8',
    created_at: '2026-11-02T09:00:00Z',
    closed_at: '2026-11-02T12:00:00Z',
    attendees: [
      { id: 'att-301-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '09:05:00', attendance_time: '09:05:00', method: 'qr', status: 'present' },
      { id: 'att-301-2', student_id: 'usr-2', student_name: 'إبراهيم الزغيد', student_number: '2450191', student_email: '2450191@student.edu', check_in_time: '09:06:00', attendance_time: '09:06:00', method: 'qr', status: 'present' },
      { id: 'att-301-5', student_id: 'usr-5', student_name: 'سارة محمود الشريف', student_number: '2340088', student_email: 'sara@student.edu', check_in_time: '09:07:00', attendance_time: '09:07:00', method: 'qr', status: 'present' },
    ],
    attendees_count: 3,
    attendeesCount: 3,
  },
  {
    id: 'ses-401',
    course_id: 'crs-4',
    course_name: 'علم البيانات وتعلم الآلة التطبيقي',
    course_code: 'AI-301',
    date: '2026-11-05',
    time: '13:30',
    room: 'مختبر الذكاء الاصطناعي - قاعة 4',
    qr_secret: SEED_SECRET_401,
    qr_code: 'CLOSED_QR_SESSION_401',
    qrCode: 'CLOSED_QR_SESSION_401',
    status: 'closed',
    created_by: 'usr-12',
    created_at: '2026-11-05T13:30:00Z',
    closed_at: '2026-11-05T15:00:00Z',
    attendees: [
      { id: 'att-401-1', student_id: 'usr-1', student_name: 'علي بن طاهر', student_number: '2340033', student_email: 'student1@test.com', check_in_time: '13:32:00', attendance_time: '13:32:00', method: 'qr', status: 'present' },
      { id: 'att-401-7', student_id: 'usr-7', student_name: 'فاطمة عمر الورفلي', student_number: '2340105', student_email: 'fatima@student.edu', check_in_time: '13:33:00', attendance_time: '13:33:00', method: 'qr', status: 'present' },
    ],
    attendees_count: 2,
    attendeesCount: 2,
  },
];

let mockLecturesList: MockLecture[] = [
  {
    id: 'lec-1',
    course_id: 'crs-1',
    title: 'المحاضرة 1: مقدمة في هندسة التشفير المتماثل وغير المتماثل',
    description: 'استعراض خوارزميات AES-256 و RSA-4096 والتحقق الرقمي.',
    file_url: 'lec-1-cryptography.pdf',
    file_name: 'lecture1-cryptography.pdf',
    file_size: 4404019,
    date: '2026-10-10',
    created_at: '2026-10-10T10:00:00Z',
  },
  {
    id: 'lec-2',
    course_id: 'crs-1',
    title: 'المحاضرة 2: بروتوكول TLS 1.3 وسلسلة الشهادات الرقمية PKI',
    description: 'آلية عمل Handshake وحماية حركة البيانات من هجمات MITM.',
    file_url: 'lec-2-tls-pki.pdf',
    file_name: 'lecture2-tls-pki.pdf',
    file_size: 3984588,
    date: '2026-10-18',
    created_at: '2026-10-18T10:00:00Z',
  },
  {
    id: 'lec-3',
    course_id: 'crs-2',
    title: 'المحاضرة 1: معمارية المعالجات المتعددة والذاكرة المخبأة (Cache Coherence)',
    description: 'بروتوكولات MESI والأنظمة الموزعة.',
    file_url: 'lec-3-cpu-cache.pdf',
    file_name: 'lecture1-cpu-architecture.pdf',
    file_size: 2726297,
    date: '2026-10-12',
    created_at: '2026-10-12T12:00:00Z',
  },
  {
    id: 'lec-4',
    course_id: 'crs-3',
    title: 'المحاضرة 1: تصميم البرمجيات الآمنة ومبادئ Clean Architecture',
    description: 'فصل الطبقات وتقليل سطح الهجوم في الأنظمة المؤسسية.',
    file_url: 'lec-4-secure-arch.pdf',
    file_name: 'lecture1-secure-architecture.pdf',
    file_size: 3145728,
    date: '2026-10-14',
    created_at: '2026-10-14T09:00:00Z',
  },
  {
    id: 'lec-5',
    course_id: 'crs-4',
    title: 'المحاضرة 1: أساسيات الانحدار وتقييم النماذج التنبؤية',
    description: 'مقاييس الدقة و Cross-Validation في تعلم الآلة.',
    file_url: 'lec-5-ml-intro.pdf',
    file_name: 'lecture1-ml-foundations.pdf',
    file_size: 2516582,
    date: '2026-10-15',
    created_at: '2026-10-15T13:30:00Z',
  },
];

let mockAssignmentsList: MockAssignment[] = [
  {
    id: 'asg-1',
    course_id: 'crs-1',
    course_name: 'أمن الشبكات والتشفير المتقدم',
    course_code: 'SEC-401',
    title: 'تحليل ثغرات واختبار حقن البيانات (SQLi & XSS Lab)',
    description: 'تطبيق عملي لاكتشاف وسد ثغرات التحقق وفحص كفاءة Sanitization في بيئة تجريبية.',
    due_date: '2026-11-20T23:59:00Z',
    max_score: 100,
    file_url: 'asg-1-sqli-lab.pdf',
    file_name: 'SEC401-SQLi-Lab-Instructions.pdf',
    created_at: '2026-11-01T10:00:00Z',
  },
  {
    id: 'asg-2',
    course_id: 'crs-3',
    course_name: 'تصميم وهندسة البرمجيات الآمنة',
    course_code: 'SE-305',
    title: 'مخطط بنية النظام وتطبيق مبادئ SOLID',
    description: 'إعداد وثيقة UML تفصيلية لمعمارية النظام مع الالتزام الصارم بمبادئ Clean Architecture.',
    due_date: '2026-11-28T23:59:00Z',
    max_score: 100,
    file_url: 'asg-2-solid-uml.pdf',
    file_name: 'SE305-SOLID-UML-Guide.pdf',
    created_at: '2026-11-05T09:00:00Z',
  },
];

let mockAssignmentSubmissions: MockSubmission[] = [
  {
    id: 501,
    assignment_id: 'asg-1',
    student_id: 'usr-1',
    student_name: 'علي بن طاهر',
    student_email: 'student1@test.com',
    student_number: '2340033',
    file_url: 'sub-501-ali.pdf',
    file_name: 'ali-bintaher-sqli-lab.pdf',
    file_size: 1240500,
    submitted_at: '2026-11-15T14:30:00Z',
    status: 'graded',
    grade: 98,
    feedback: 'تنفيذ ممتاز وتغطية شاملة لكافة محاور الدفاع المتقدم.',
  },
  {
    id: 502,
    assignment_id: 'asg-1',
    student_id: 'usr-2',
    student_name: 'إبراهيم الزغيد',
    student_email: '2450191@student.edu',
    student_number: '2450191',
    file_url: 'sub-502-ibrahim.pdf',
    file_name: 'ibrahim-sqli-lab.pdf',
    file_size: 980000,
    submitted_at: '2026-11-15T16:15:00Z',
    status: 'graded',
    grade: 88,
    feedback: 'عمل جيد جداً مع الحاجة لتعزيز جزئية الـ Prepared Statements.',
  },
  {
    id: 503,
    assignment_id: 'asg-1',
    student_id: 'usr-4',
    student_name: 'أحمد الثني',
    student_email: '2340068@student.edu',
    student_number: '2340068',
    file_url: 'sub-503-ahmed.pdf',
    file_name: 'ahmed-thani-sqli-lab.pdf',
    file_size: 1120000,
    submitted_at: '2026-11-15T18:00:00Z',
    status: 'submitted',
    grade: null,
    feedback: null,
  },
];

// In-memory store for uploaded file buffers (so private downloads return genuine uploaded bytes)
const mockUploadedFiles = new Map<string, { buffer: Buffer; mimeType: string; fileName: string }>();

// Ephemeral 2FA login challenge tokens: temp_token -> { userId, expiresAt }
const pending2faChallenges = new Map<string, { userId: string; expiresAt: number }>();

// ============================================================================
// SNAPSHOT PERSISTENCE (Inside eduflow-portal-main, *.local is gitignored)
// ============================================================================

function getSnapshotFilePath(): string {
  return path.resolve(__dirname, '.hadir_mock_state.local.json');
}

function syncCourseStudentCounts(): void {
  for (const c of mockCoursesList) {
    c.students_count = (mockEnrollmentsMap[c.id] || []).length;
  }
}

function saveSnapshot(): void {
  try {
    syncCourseStudentCounts();
    const filePath = getSnapshotFilePath();
    const data = {
      snapshotVersion: 3,
      mockGradeItemsStore,
      mockStudentScoresStore,
      mockReportOverrides,
      mockAttendanceSessions,
      mockFinancialStudents,
      mockFinancialTransactions,
      mockUsersList,
      mockCoursesList,
      mockEnrollmentsMap,
      mockLecturesList,
      mockAssignmentsList,
      mockAssignmentSubmissions,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Hadir State Snapshot] Save error:', err);
  }
}

function loadSnapshot(): void {
  try {
    const filePath = getSnapshotFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.snapshotVersion !== 3) return;
      if (data.mockGradeItemsStore) mockGradeItemsStore = data.mockGradeItemsStore;
      if (data.mockStudentScoresStore) mockStudentScoresStore = data.mockStudentScoresStore;
      if (data.mockReportOverrides) mockReportOverrides = data.mockReportOverrides;
      if (data.mockAttendanceSessions) mockAttendanceSessions = data.mockAttendanceSessions;
      if (data.mockFinancialStudents) mockFinancialStudents = data.mockFinancialStudents;
      if (data.mockFinancialTransactions) mockFinancialTransactions = data.mockFinancialTransactions;
      if (data.mockUsersList) mockUsersList = data.mockUsersList;
      if (data.mockCoursesList) mockCoursesList = data.mockCoursesList;
      if (data.mockEnrollmentsMap) mockEnrollmentsMap = data.mockEnrollmentsMap;
      if (data.mockLecturesList) mockLecturesList = data.mockLecturesList;
      if (data.mockAssignmentsList) mockAssignmentsList = data.mockAssignmentsList;
      if (data.mockAssignmentSubmissions) mockAssignmentSubmissions = data.mockAssignmentSubmissions;
    }
  } catch (err) {
    console.error('[Hadir State Snapshot] Load error:', err);
  } finally {
    syncCourseStudentCounts();
  }
}

loadSnapshot();

// ============================================================================
// RFC 6238 TOTP (2FA), QR TOTP, GRADEBOOK & GPA HELPERS
// ============================================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(base32Str: string): Buffer {
  const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function verifyTOTP(base32Secret: string, token: string): boolean {
  if (!base32Secret || !token) return false;
  const cleanedToken = token.trim();
  if (!/^\d{6}$/.test(cleanedToken)) return false;

  const window = 30;
  const now = Math.floor(Date.now() / 1000);
  const secretBuffer = base32Decode(base32Secret);

  for (let offset = -1; offset <= 1; offset++) {
    const timeSlice = Math.floor(now / window) + offset;
    const hmac = crypto.createHmac('sha1', secretBuffer);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeSlice));
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offsetByte = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offsetByte] & 0x7f) << 24) |
      ((hash[offsetByte + 1] & 0xff) << 16) |
      ((hash[offsetByte + 2] & 0xff) << 8) |
      (hash[offsetByte + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    if (otp === cleanedToken) return true;
  }
  return false;
}

function scoreToLetterAndPoints(score: number): { letterGrade: string; gradePoints: number } {
  if (score >= 90) return { letterGrade: 'A', gradePoints: 4.00 };
  if (score >= 85) return { letterGrade: 'B+', gradePoints: 3.50 };
  if (score >= 80) return { letterGrade: 'B', gradePoints: 3.00 };
  if (score >= 75) return { letterGrade: 'C+', gradePoints: 2.50 };
  if (score >= 70) return { letterGrade: 'C', gradePoints: 2.00 };
  if (score >= 60) return { letterGrade: 'D', gradePoints: 1.00 };
  return { letterGrade: 'F', gradePoints: 0.00 };
}

const LETTER_GRADE_MAP: Record<string, { letterGrade: string; gradePoints: number }> = {
  'A+': { letterGrade: 'A', gradePoints: 4.00 },
  'A': { letterGrade: 'A', gradePoints: 4.00 },
  'B+': { letterGrade: 'B+', gradePoints: 3.50 },
  'B': { letterGrade: 'B', gradePoints: 3.00 },
  'C+': { letterGrade: 'C+', gradePoints: 2.50 },
  'C': { letterGrade: 'C', gradePoints: 2.00 },
  'D': { letterGrade: 'D', gradePoints: 1.00 },
  'F': { letterGrade: 'F', gradePoints: 0.00 },
};

function resolveGradeOverride(raw: string | number | null | undefined): {
  normalized: string;
  totalScore?: number;
  letterGrade: string;
  gradePoints: number;
} | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (LETTER_GRADE_MAP[upper]) {
    const mapped = LETTER_GRADE_MAP[upper];
    return {
      normalized: mapped.letterGrade,
      letterGrade: mapped.letterGrade,
      gradePoints: mapped.gradePoints,
    };
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      throw new Error('الدرجة الرقمية يجب أن تكون بين 0 و 100');
    }
    const rounded = Math.round(num * 100) / 100;
    const mapped = scoreToLetterAndPoints(rounded);
    return {
      normalized: String(rounded),
      totalScore: rounded,
      letterGrade: mapped.letterGrade,
      gradePoints: mapped.gradePoints,
    };
  }

  throw new Error('قيمة التقدير غير صالحة. القيم المسموحة: A, B+, B, C+, C, D, F أو درجة من 0 إلى 100');
}

function ensureDefaultGradeItems(courseId: string): MockGradeItem[] {
  if (!mockGradeItemsStore[courseId]) {
    let nextId = Math.max(0, ...Object.values(mockGradeItemsStore).flat().map((i) => i.id)) + 1;
    mockGradeItemsStore[courseId] = [
      { id: nextId++, course_id: courseId, name: 'الحضور والالتزام الأكاديمي', category: 'attendance', weight: 10, max_score: 100 },
      { id: nextId++, course_id: courseId, name: 'الواجبات والتكليفات', category: 'assignments', weight: 20, max_score: 100 },
      { id: nextId++, course_id: courseId, name: 'الامتحان النصفي (Midterm)', category: 'midterm', weight: 30, max_score: 100 },
      { id: nextId++, course_id: courseId, name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
    ];
  }
  return mockGradeItemsStore[courseId];
}

function getCourseStudentAttendance(courseId: string, studentId: string) {
  const courseSessions = mockAttendanceSessions.filter((s) => s.course_id === courseId);
  const totalSessions = courseSessions.length;
  const baseAttended = courseSessions.filter((s) =>
    s.attendees.some((a) => a.student_id === studentId)
  ).length;
  const override = mockReportOverrides[courseId]?.[studentId]?.attendanceOverride || 0;
  const attendedCount = Math.max(0, baseAttended + override);

  let attendancePercentage: number | null = null;
  if (totalSessions > 0) {
    attendancePercentage = Math.min(100, Math.round((attendedCount / totalSessions) * 100));
  } else if (override > 0) {
    attendancePercentage = 100;
  }

  return {
    totalSessions,
    attendedCount,
    override,
    attendancePercentage,
  };
}

function calculateCourseStudentScore(courseId: string, studentId: string) {
  const items = mockGradeItemsStore[courseId] || ensureDefaultGradeItems(courseId);
  const rawScores = mockStudentScoresStore[courseId]?.[studentId] || {};
  const attInfo = getCourseStudentAttendance(courseId, studentId);

  const scores: Record<number, number | null> = {};
  let weightedSum = 0;
  let gradedWeightSum = 0;

  for (const item of items) {
    let score: number | null = null;
    if (item.category === 'attendance') {
      if (attInfo.attendancePercentage !== null) {
        score = Math.round(((attInfo.attendancePercentage / 100) * item.max_score) * 10) / 10;
      }
    } else if (rawScores[item.id] !== undefined && rawScores[item.id] !== null) {
      score = rawScores[item.id];
    }

    scores[item.id] = score;
    if (score !== null) {
      weightedSum += (score / item.max_score) * item.weight;
      gradedWeightSum += item.weight;
    }
  }

  const reportOverride = mockReportOverrides[courseId]?.[studentId];
  let parsedOverride: ReturnType<typeof resolveGradeOverride> = null;
  try {
    parsedOverride = resolveGradeOverride(reportOverride?.finalGrade);
  } catch {
    parsedOverride = null;
  }

  const computedTotalScore =
    gradedWeightSum > 0
      ? Math.min(100, Math.max(0, Math.round(((weightedSum / gradedWeightSum) * 100) * 10) / 10))
      : null;

  let effectiveTotalScore: number | null = computedTotalScore;
  let effectiveLetterGrade: string | null = null;
  let effectiveGradePoints: number | null = null;

  if (computedTotalScore !== null) {
    const computed = scoreToLetterAndPoints(computedTotalScore);
    effectiveLetterGrade = computed.letterGrade;
    effectiveGradePoints = computed.gradePoints;
  }

  if (parsedOverride) {
    if (parsedOverride.totalScore !== undefined) {
      effectiveTotalScore = parsedOverride.totalScore;
    }
    effectiveLetterGrade = parsedOverride.letterGrade;
    effectiveGradePoints = parsedOverride.gradePoints;
  }

  return {
    totalScore: effectiveTotalScore,
    letterGrade: effectiveLetterGrade,
    gradePoints: effectiveGradePoints,
    finalGrade: reportOverride?.finalGrade || effectiveLetterGrade,
    gradeOverride: reportOverride?.finalGrade || null,
    scores,
    attendancePercentage: attInfo.attendancePercentage,
    totalSessions: attInfo.totalSessions,
    attendedCount: attInfo.attendedCount,
    attendanceOverride: attInfo.override,
  };
}

function isStudentEnrolled(courseId: string, studentId: string): boolean {
  const roster = mockEnrollmentsMap[courseId] || [];
  return roster.some((st: any) => st.student_id === studentId || st.studentId === studentId || st.id === studentId);
}

function calculateStudentGPA(studentId: string) {
  const coursesEnrolled = mockCoursesList.filter((c) => isStudentEnrolled(c.id, studentId));

  let totalQualityPoints = 0;
  let totalCredits = 0;
  let totalGradedCredits = 0;
  let attendancePctSum = 0;
  let attendanceCourseCount = 0;

  const coursesData = coursesEnrolled.map((course) => {
    const credits = course.credit_hours || 3;
    totalCredits += credits;

    const scoreCalc = calculateCourseStudentScore(course.id, studentId);

    if (scoreCalc.gradePoints !== null) {
      totalQualityPoints += scoreCalc.gradePoints * credits;
      totalGradedCredits += credits;
    }

    if (scoreCalc.attendancePercentage !== null) {
      attendancePctSum += scoreCalc.attendancePercentage;
      attendanceCourseCount++;
    }

    return {
      id: course.id,
      name: course.name,
      code: course.code,
      creditHours: credits,
      attendancePercentage: scoreCalc.attendancePercentage,
      finalGrade: scoreCalc.finalGrade,
      totalScore: scoreCalc.totalScore,
      letterGrade: scoreCalc.letterGrade,
      gradePoints: scoreCalc.gradePoints,
      total_lectures: scoreCalc.totalSessions,
      attended_lectures: scoreCalc.attendedCount,
    };
  });

  const gpa =
    totalGradedCredits > 0
      ? Math.round((totalQualityPoints / totalGradedCredits) * 100) / 100
      : null;

  const avgAttendance =
    attendanceCourseCount > 0
      ? Math.round((attendancePctSum / attendanceCourseCount) * 10) / 10
      : null;

  const academicStatus =
    gpa === null
      ? 'لا توجد درجات مقيمة بعد'
      : gpa >= 3.75
      ? 'امتياز مع مرتبة الشرف'
      : gpa >= 3.5
      ? 'ممتاز'
      : gpa >= 3.0
      ? 'جيد جداً'
      : gpa >= 2.0
      ? 'جيد'
      : 'إنذار أكاديمي';

  return {
    gpa,
    totalCredits,
    gradedCredits: totalGradedCredits,
    enrolledCourses: coursesData.length,
    attendanceRate: avgAttendance,
    academic_status: academicStatus,
    courses: coursesData,
  };
}

function sanitizeUser(u: MockUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    student_id: u.student_id || null,
    studentId: u.student_id || null,
    teacher_code: u.teacher_code || null,
    department: u.department || null,
    avatar: u.avatar || null,
    is_active: u.is_active,
    is_frozen: Boolean(u.is_frozen),
    freeze_reason: u.freeze_reason || null,
    two_factor_enabled: Boolean(u.two_factor_enabled),
  };
}

function issueAuthToken(u: MockUser): string {
  return `mock-token-${u.id}::v${u.token_version || 1}`;
}

function resolveAuthUser(req: any): { user: MockUser | null; error?: string } {
  const authHeader = (req.headers['authorization'] || '') as string;
  if (!authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'NO_TOKEN' };
  }
  const token = authHeader.slice(7).trim();
  if (!token.startsWith('mock-token-')) {
    return { user: null, error: 'INVALID_TOKEN' };
  }

  const rest = token.slice('mock-token-'.length);
  const [userId, versionPart] = rest.split('::v');
  const user = mockUsersList.find((u) => u.id === userId && u.is_active);
  if (!user) {
    return { user: null, error: 'USER_NOT_FOUND' };
  }

  if (versionPart !== undefined) {
    const tokenVer = parseInt(versionPart, 10);
    if (isNaN(tokenVer) || tokenVer !== (user.token_version || 1)) {
      return { user: null, error: 'TOKEN_REVOKED' };
    }
  }

  // Sync freeze status from mockFinancialStudents if student
  if (user.role === 'student') {
    const fin = mockFinancialStudents.find((s) => s.student_id === user.id || s.student_number === user.student_id);
    if (fin) {
      user.is_frozen = fin.is_frozen ? 1 : 0;
      user.freeze_reason = fin.freeze_reason;
    }
  }

  return { user };
}

function parseMultipartFormData(rawBuffer: Buffer, contentType: string): { fields: Record<string, string>; file?: { fieldName: string; fileName: string; mimeType: string; buffer: Buffer } } {
  const fields: Record<string, string> = {};
  let file: { fieldName: string; fileName: string; mimeType: string; buffer: Buffer } | undefined;

  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) return { fields };
  const boundary = '--' + (match[1] || match[2]);
  const boundaryBuf = Buffer.from(boundary, 'latin1');

  let pos = rawBuffer.indexOf(boundaryBuf);
  if (pos === -1) return { fields };

  while (pos !== -1) {
    const start = pos + boundaryBuf.length;
    if (rawBuffer.subarray(start, start + 2).toString('latin1') === '--') break;

    const headerStart = start + 2; // skip \r\n
    const headerEnd = rawBuffer.indexOf(Buffer.from('\r\n\r\n', 'latin1'), headerStart);
    if (headerEnd === -1) break;

    const nextBoundary = rawBuffer.indexOf(boundaryBuf, headerEnd + 4);
    if (nextBoundary === -1) break;

    const headersStr = rawBuffer.subarray(headerStart, headerEnd).toString('utf8');
    const contentBuf = rawBuffer.subarray(headerEnd + 4, nextBoundary - 2); // strip trailing \r\n

    const nameMatch = headersStr.match(/name="([^"]+)"/i);
    const filenameMatch = headersStr.match(/filename="([^"]*)"/i);
    const typeMatch = headersStr.match(/Content-Type:\s*([^\r\n]+)/i);

    if (nameMatch) {
      const fieldName = nameMatch[1];
      if (filenameMatch && filenameMatch[1]) {
        file = {
          fieldName,
          fileName: path.basename(filenameMatch[1]),
          mimeType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
          buffer: Buffer.from(contentBuf),
        };
      } else {
        fields[fieldName] = contentBuf.toString('utf8');
      }
    }

    pos = nextBoundary;
  }

  return { fields, file };
}

function buildMinimalPdf(title: string): Buffer {
  const safeText = title.replace(/[^\x20-\x7E]/g, '?');
  const content = `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${44 + safeText.length} >> stream\nBT /F1 14 Tf 72 720 Td (Hadir Document: ${safeText}) Tj ET\nendstream endobj\nxref\n0 5\n0000000000 65535 f \ntrailer << /Size 5 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n`;
  return Buffer.from(content, 'utf8');
}

// ============================================================================
// VITE MOCK SERVER PLUGIN
// ============================================================================

export function mockServerPlugin(): Plugin {
  return {
    name: 'hadir-mock-server-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api')) {
          return next();
        }

        const sendJson = (status: number, data: any) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };

        const sendFileDownload = (fileName: string, buffer: Buffer, mimeType = 'application/pdf') => {
          res.statusCode = 200;
          res.setHeader('Content-Type', mimeType);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
          res.end(buffer);
        };

        const [pathname] = url.split('?');
        const apiPath = pathname.replace(/^\/api/, '');

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        req.on('end', async () => {
          const rawBuffer = Buffer.concat(chunks);
          const contentType = (req.headers['content-type'] || '') as string;

          let body: any = {};
          let uploadedFile: { fieldName: string; fileName: string; mimeType: string; buffer: Buffer } | undefined;

          if (contentType.includes('multipart/form-data')) {
            const parsed = parseMultipartFormData(rawBuffer, contentType);
            body = parsed.fields;
            uploadedFile = parsed.file;
          } else if (rawBuffer.length > 0) {
            try {
              body = JSON.parse(rawBuffer.toString('utf8'));
            } catch {
              body = {};
            }
          }

          // ------------------------------------------------------------------
          // 1. PUBLIC AUTH ENDPOINTS (login, login/2fa, refresh)
          // ------------------------------------------------------------------
          if (apiPath === '/auth/login' && req.method === 'POST') {
            const rawIdentifier = String(body.identifier || '').trim();
            const password = String(body.password || '');

            if (!rawIdentifier || !password) {
              return sendJson(400, { success: false, message: 'Identifier and password are required.' });
            }

            const idLower = rawIdentifier.toLowerCase();
            const matchedUser = mockUsersList.find((u) => {
              if (u.email.toLowerCase() === idLower) return true;
              if (u.id.toLowerCase() === idLower) return true;
              if (u.student_id && u.student_id.toLowerCase() === idLower) return true;
              if (u.teacher_code && u.teacher_code.toLowerCase() === idLower) return true;
              if (u.role === 'admin' && (idLower === 'admin' || idLower === 'admin@hadir.edu')) return true;
              if (u.id === 'usr-8' && idLower === 'tch-001') return true;
              return false;
            });

            if (!matchedUser) {
              return sendJson(401, { success: false, message: 'بيانات الدخول غير صحيحة.', error: 'INVALID_CREDENTIALS' });
            }

            if (!matchedUser.is_active) {
              return sendJson(401, { success: false, message: 'الحساب معطّل، تواصل مع المسؤول.', error: 'ACCOUNT_DEACTIVATED' });
            }

            if (matchedUser.password !== password) {
              return sendJson(401, { success: false, message: 'بيانات الدخول غير صحيحة.', error: 'INVALID_CREDENTIALS' });
            }

            // 2FA Challenge enforcement
            if (matchedUser.two_factor_enabled && matchedUser.two_factor_secret) {
              const totpFromBody = body.totp_code || body.totpCode;
              if (totpFromBody) {
                if (!verifyTOTP(matchedUser.two_factor_secret, String(totpFromBody))) {
                  return sendJson(401, { success: false, message: 'رمز التحقق الثنائي (2FA) غير صحيح' });
                }
              } else {
                const tempToken = `mock-2fa-${matchedUser.id}-${crypto.randomBytes(8).toString('hex')}`;
                pending2faChallenges.set(tempToken, {
                  userId: matchedUser.id,
                  expiresAt: Date.now() + 5 * 60 * 1000,
                });
                return sendJson(200, {
                  success: true,
                  requires_2fa: true,
                  temp_token: tempToken,
                  tempUserId: matchedUser.id,
                  message: 'يرجى إدخال رمز التحقق الثنائي (2FA)',
                });
              }
            }

            // Sync financial freeze flag before returning user
            if (matchedUser.role === 'student') {
              const fin = mockFinancialStudents.find((s) => s.student_id === matchedUser.id || s.student_number === matchedUser.student_id);
              if (fin) {
                matchedUser.is_frozen = fin.is_frozen ? 1 : 0;
                matchedUser.freeze_reason = fin.freeze_reason;
              }
            }

            return sendJson(200, {
              success: true,
              message: 'تم تسجيل الدخول بنجاح.',
              token: issueAuthToken(matchedUser),
              refreshToken: `mock-refresh-${matchedUser.id}`,
              user: sanitizeUser(matchedUser),
            });
          }

          if (apiPath === '/auth/login/2fa' && req.method === 'POST') {
            const tempToken = String(body.temp_token || body.tempToken || '');
            const totpCode = String(body.totp_code || body.totpCode || body.token || '').trim();

            const challenge = pending2faChallenges.get(tempToken);
            const userId = challenge?.userId || String(body.tempUserId || '');
            if (challenge && challenge.expiresAt < Date.now()) {
              pending2faChallenges.delete(tempToken);
              return sendJson(401, { success: false, message: 'انتهت صلاحية جلسة التحقق الثنائي، يرجى تسجيل الدخول مجدداً' });
            }

            const matchedUser = mockUsersList.find((u) => u.id === userId && u.is_active);
            if (!matchedUser || !matchedUser.two_factor_enabled || !matchedUser.two_factor_secret) {
              return sendJson(401, { success: false, message: 'جلسة التحقق الثنائي غير صالحة' });
            }

            if (!verifyTOTP(matchedUser.two_factor_secret, totpCode)) {
              return sendJson(401, { success: false, message: 'رمز التحقق الثنائي (2FA) غير صحيح أو منتهي الصلاحية' });
            }

            if (challenge) pending2faChallenges.delete(tempToken);

            return sendJson(200, {
              success: true,
              message: 'تم تسجيل الدخول بنجاح.',
              token: issueAuthToken(matchedUser),
              refreshToken: `mock-refresh-${matchedUser.id}`,
              user: sanitizeUser(matchedUser),
            });
          }

          // ------------------------------------------------------------------
          // AUTHENTICATED REQUEST RESOLUTION
          // ------------------------------------------------------------------
          const { user: authUser, error: authError } = resolveAuthUser(req);
          if (!authUser) {
            return sendJson(401, {
              success: false,
              message:
                authError === 'TOKEN_REVOKED'
                  ? 'تم إلغاء هذه الجلسة بسبب تسجيل الخروج من الأجهزة الأخرى. يرجى تسجيل الدخول مجدداً.'
                  : 'Unauthorized. Please provide a valid Bearer token.',
            });
          }

          // ------------------------------------------------------------------
          // 2. AUTH ME, PROFILE, PASSWORD, LOGOUT
          // ------------------------------------------------------------------
          if (apiPath === '/auth/me' && req.method === 'GET') {
            return sendJson(200, { success: true, user: sanitizeUser(authUser) });
          }

          if (apiPath === '/auth/logout' && req.method === 'POST') {
            return sendJson(200, { success: true, message: 'Logged out successfully.' });
          }

          if (apiPath === '/auth/profile' && req.method === 'PUT') {
            const newName = typeof body.name === 'string' ? body.name.trim() : authUser.name;
            const newEmail = typeof body.email === 'string' ? body.email.trim() : authUser.email;
            if (!newName || !newEmail) {
              return sendJson(400, { success: false, message: 'الاسم والبريد الإلكتروني مطلوبان' });
            }
            const conflict = mockUsersList.find((u) => u.id !== authUser.id && u.email.toLowerCase() === newEmail.toLowerCase());
            if (conflict) {
              return sendJson(400, { success: false, message: 'البريد الإلكتروني مستخدم مسبقاً' });
            }
            authUser.name = newName;
            authUser.email = newEmail;
            // Sync to enrollment records & financial records
            Object.values(mockEnrollmentsMap).forEach((roster) => {
              roster.forEach((st) => {
                if (st.student_id === authUser.id || st.id === authUser.id) {
                  st.name = newName;
                  st.email = newEmail;
                }
              });
            });
            const fin = mockFinancialStudents.find((s) => s.student_id === authUser.id);
            if (fin) {
              fin.student_name = newName;
              fin.student_email = newEmail;
            }
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم تحديث الملف الشخصي بنجاح',
              data: sanitizeUser(authUser),
            });
          }

          if (apiPath === '/auth/password' && req.method === 'PUT') {
            const currentPassword = String(body.currentPassword || '');
            const newPassword = String(body.newPassword || '');
            if (!currentPassword || newPassword.length < 6) {
              return sendJson(400, { success: false, message: 'كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف' });
            }
            if (authUser.password !== currentPassword) {
              return sendJson(400, { success: false, message: 'كلمة المرور الحالية غير صحيحة' });
            }
            authUser.password = newPassword;
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم تغيير كلمة المرور بنجاح' });
          }

          // ------------------------------------------------------------------
          // 3. COURSES (Student, Teacher, Roster)
          // ------------------------------------------------------------------
          if (apiPath === '/courses/student' && req.method === 'GET') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }
            syncCourseStudentCounts();
            const studentCourses = mockCoursesList.filter((c) => isStudentEnrolled(c.id, authUser.id));
            return sendJson(200, {
              success: true,
              data: studentCourses,
              count: studentCourses.length,
            });
          }

          if (apiPath === '/courses/teacher' && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            syncCourseStudentCounts();
            const teacherCourses =
              authUser.role === 'admin'
                ? mockCoursesList
                : mockCoursesList.filter((c) => c.teacher_id === authUser.id || c.teacherId === authUser.id);
            return sendJson(200, {
              success: true,
              data: teacherCourses,
              count: teacherCourses.length,
            });
          }

          if (apiPath.match(/^\/courses\/[^/]+\/students$/) && req.method === 'GET') {
            const courseId = decodeURIComponent(apiPath.split('/')[2]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'لا تملك صلاحية عرض طلاب هذا المقرر' });
            }
            const roster = (mockEnrollmentsMap[courseId] || []).map((st: any) => ({
              id: st.id || st.student_id,
              name: st.name,
              email: st.email,
              student_id: st.student_number || st.student_id,
              enrolled_at: st.enrolled_at || st.enrollment_date || '2026-09-01',
              enrollment_date: st.enrollment_date || st.enrolled_at || '2026-09-01',
              status: 'active',
            }));
            return sendJson(200, { success: true, data: roster, count: roster.length });
          }

          // ------------------------------------------------------------------
          // 4. REPORTS & GPA & GRADEBOOK
          // ------------------------------------------------------------------
          if ((apiPath === '/reports/student' || apiPath === '/grades/student/gpa') && req.method === 'GET') {
            if (authUser.role !== 'student' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const studentGpaData = calculateStudentGPA(authUser.id);
            return sendJson(200, {
              success: true,
              data: studentGpaData,
            });
          }

          if (apiPath === '/reports/teacher' && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const teacherCourses =
              authUser.role === 'admin'
                ? mockCoursesList
                : mockCoursesList.filter((c) => c.teacher_id === authUser.id);

            const distinctStudents = new Set<string>();
            let totalAttSum = 0;
            let totalAttCount = 0;

            const coursesSummary = teacherCourses.map((c) => {
              const roster = mockEnrollmentsMap[c.id] || [];
              let cAttSum = 0;
              let cAttN = 0;
              let cGradeSum = 0;
              let cGradeN = 0;

              roster.forEach((st: any) => {
                const sid = st.student_id || st.id;
                distinctStudents.add(sid);
                const calc = calculateCourseStudentScore(c.id, sid);
                if (calc.attendancePercentage !== null) {
                  cAttSum += calc.attendancePercentage;
                  cAttN++;
                  totalAttSum += calc.attendancePercentage;
                  totalAttCount++;
                }
                if (calc.totalScore !== null) {
                  cGradeSum += calc.totalScore;
                  cGradeN++;
                }
              });

              const avgGradeVal = cGradeN > 0 ? Math.round((cGradeSum / cGradeN) * 10) / 10 : null;
              return {
                id: c.id,
                name: c.name,
                code: c.code,
                studentsCount: roster.length,
                averageAttendance: cAttN > 0 ? Math.round((cAttSum / cAttN) * 10) / 10 : null,
                averageGrade: avgGradeVal,
                averageScore: avgGradeVal,
              };
            });

            return sendJson(200, {
              success: true,
              data: {
                totalCourses: teacherCourses.length,
                totalStudents: distinctStudents.size,
                averageAttendance: totalAttCount > 0 ? Math.round((totalAttSum / totalAttCount) * 10) / 10 : null,
                courses: coursesSummary,
              },
            });
          }

          // Exact match: PUT /api/reports/teacher/course/:courseId/update
          const reportUpdateMatch = apiPath.match(/^\/reports\/teacher\/course\/([^/]+)\/update$/);
          if (reportUpdateMatch && req.method === 'PUT') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const courseId = decodeURIComponent(reportUpdateMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح بتعديل هذا المقرر' });
            }
            const updates = Array.isArray(body.updates) ? body.updates : [];
            if (!mockReportOverrides[courseId]) mockReportOverrides[courseId] = {};
            for (const u of updates) {
              if (!u || !u.studentId) continue;
              let resolved = null;
              try {
                resolved = resolveGradeOverride(u.finalGrade);
              } catch (validationErr: any) {
                return sendJson(400, { success: false, message: validationErr.message });
              }
              mockReportOverrides[courseId][u.studentId] = {
                finalGrade: resolved ? resolved.normalized : null,
                attendanceOverride: Number(u.attendanceOverride) || 0,
              };
            }
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم حفظ التعديلات وتحديث الدرجات والحضور بنجاح' });
          }

          // Exact match: GET /api/reports/teacher/course/:courseId
          const reportCourseMatch = apiPath.match(/^\/reports\/teacher\/course\/([^/]+)$/);
          if (reportCourseMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const courseId = decodeURIComponent(reportCourseMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح بعرض هذا المقرر' });
            }
            const enrolled = mockEnrollmentsMap[course.id] || [];
            const studentsWithAttendance = enrolled.map((st: any) => {
              const sid = st.student_id || st.id;
              const calc = calculateCourseStudentScore(course.id, sid);
              return {
                id: sid,
                name: st.name,
                student_id: st.student_number || st.studentId || sid,
                studentId: st.student_number || st.studentId || sid,
                attended_count: calc.attendedCount,
                attendedLectures: calc.attendedCount,
                total_lectures: calc.totalSessions,
                totalLectures: calc.totalSessions,
                attendance_rate: calc.attendancePercentage,
                attendancePercentage: calc.attendancePercentage,
                totalScore: calc.totalScore,
                letterGrade: calc.letterGrade,
                finalGrade: calc.finalGrade,
                gradeOverride: calc.gradeOverride,
                attendanceOverride: calc.attendanceOverride,
              };
            });
            return sendJson(200, {
              success: true,
              data: {
                courseId: course.id,
                courseName: course.name,
                students: studentsWithAttendance,
              },
            });
          }

          // Student Course Gradebook Breakdown
          const studentCourseGradeMatch = apiPath.match(/^\/grades\/student\/course\/([^/]+)$/);
          if (studentCourseGradeMatch && req.method === 'GET') {
            const courseId = decodeURIComponent(studentCourseGradeMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'student' && !isStudentEnrolled(course.id, authUser.id)) {
              return sendJson(403, { success: false, message: 'أنت غير مسجل في هذا المقرر' });
            }

            const itemsDef = mockGradeItemsStore[course.id] || ensureDefaultGradeItems(course.id);
            const calc = calculateCourseStudentScore(course.id, authUser.id);

            const items = itemsDef.map((item) => {
              const score = calc.scores[item.id] ?? null;
              const weightedScore =
                score !== null ? Math.round(((score / item.max_score) * item.weight) * 10) / 10 : null;
              return {
                gradeItemId: item.id,
                id: item.id,
                name: item.name,
                category: item.category,
                weight: item.weight,
                maxScore: item.max_score,
                max_score: item.max_score,
                score,
                weightedScore,
              };
            });

            return sendJson(200, {
              success: true,
              data: {
                courseId: course.id,
                courseName: course.name,
                totalScore: calc.totalScore,
                letterGrade: calc.letterGrade,
                finalGrade: calc.finalGrade,
                gradePoints: calc.gradePoints,
                attendancePercentage: calc.attendancePercentage,
                items,
              },
            });
          }

          // POST /api/grades/course/:courseId/student-grade
          const postStudentGradeMatch = apiPath.match(/^\/grades\/course\/([^/]+)\/student-grade$/);
          if (postStudentGradeMatch && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const courseId = decodeURIComponent(postStudentGradeMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح لك برصد درجات هذا المقرر' });
            }

            const { studentId, gradeItemId, score } = body;
            if (!courseId || !studentId || gradeItemId === undefined || score === undefined) {
              return sendJson(400, { success: false, message: 'بيانات غير مكتملة' });
            }
            if (typeof score !== 'number' || isNaN(score) || score === null) {
              return sendJson(400, { success: false, message: 'قيمة الدرجة غير صالحة' });
            }

            const courseItems = mockGradeItemsStore[courseId] || ensureDefaultGradeItems(courseId);
            const item = courseItems.find((i) => i.id === Number(gradeItemId));
            if (!item) {
              return sendJson(404, { success: false, message: 'بند التقييم غير موجود' });
            }

            const enrolled = mockEnrollmentsMap[courseId] || [];
            const enrolledRecord = enrolled.find(
              (st: any) =>
                st.student_id === studentId ||
                st.studentId === studentId ||
                st.id === studentId ||
                st.student_number === studentId
            );
            if (!enrolledRecord) {
              return sendJson(404, { success: false, message: 'الطالب غير مسجل في هذا المقرر' });
            }
            const canonicalStudentId = enrolledRecord.student_id || enrolledRecord.id;

            if (score < 0 || score > item.max_score) {
              return sendJson(400, {
                success: false,
                message: `الدرجة المدخلة يجب أن تكون بين 0 و ${item.max_score}`,
              });
            }

            if (!mockStudentScoresStore[courseId]) mockStudentScoresStore[courseId] = {};
            if (!mockStudentScoresStore[courseId][canonicalStudentId]) mockStudentScoresStore[courseId][canonicalStudentId] = {};
            mockStudentScoresStore[courseId][canonicalStudentId][Number(gradeItemId)] = score;

            const scoreResult = calculateCourseStudentScore(courseId, canonicalStudentId);
            saveSnapshot();

            return sendJson(200, {
              success: true,
              message: 'تم حفظ الدرجة وإعادة حساب المجموع والتقدير تلقائياً.',
              data: {
                studentId: canonicalStudentId,
                gradeItemId: Number(gradeItemId),
                score,
                totalScore: scoreResult.totalScore,
                letterGrade: scoreResult.letterGrade,
                gradePoints: scoreResult.gradePoints,
              },
            });
          }

          // POST /api/grades/course/:courseId/student-grades/batch
          const postStudentGradesBatchMatch = apiPath.match(/^\/grades\/course\/([^/]+)\/student-grades\/batch$/);
          if (postStudentGradesBatchMatch && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const courseId = decodeURIComponent(postStudentGradesBatchMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح لك برصد درجات هذا المقرر' });
            }

            const entries = Array.isArray(body.entries) ? body.entries : [];
            if (entries.length === 0) {
              return sendJson(400, { success: false, message: 'لا توجد درجات مرسلة للحفظ' });
            }

            const courseItems = mockGradeItemsStore[courseId] || ensureDefaultGradeItems(courseId);
            const enrolled = mockEnrollmentsMap[courseId] || [];
            const resolvedUpdates: Array<{ canonicalStudentId: string; gradeItemId: number; score: number }> = [];

            for (const entry of entries) {
              const sid = String(entry?.studentId || '').trim();
              const itemId = Number(entry?.gradeItemId);
              const score = Number(entry?.score);
              const item = courseItems.find((i) => i.id === itemId && i.category !== 'attendance');
              if (!item) {
                return sendJson(404, { success: false, message: `بند التقييم (${itemId}) غير موجود` });
              }
              const enrolledRecord = enrolled.find(
                (st: any) =>
                  st.student_id === sid ||
                  st.studentId === sid ||
                  st.id === sid ||
                  st.student_number === sid
              );
              if (!enrolledRecord) {
                return sendJson(404, { success: false, message: `الطالب (${sid}) غير مسجل في هذا المقرر` });
              }
              if (!Number.isFinite(score) || score < 0 || score > item.max_score) {
                return sendJson(400, {
                  success: false,
                  message: `الدرجة المدخلة يجب أن تكون بين 0 و ${item.max_score}`,
                });
              }
              resolvedUpdates.push({
                canonicalStudentId: enrolledRecord.student_id || enrolledRecord.id,
                gradeItemId: itemId,
                score,
              });
            }

            if (!mockStudentScoresStore[courseId]) mockStudentScoresStore[courseId] = {};
            const affectedStudents = new Set<string>();
            for (const u of resolvedUpdates) {
              if (!mockStudentScoresStore[courseId][u.canonicalStudentId]) {
                mockStudentScoresStore[courseId][u.canonicalStudentId] = {};
              }
              mockStudentScoresStore[courseId][u.canonicalStudentId][u.gradeItemId] = u.score;
              affectedStudents.add(u.canonicalStudentId);
            }

            for (const sid of affectedStudents) {
              calculateCourseStudentScore(courseId, sid);
            }
            saveSnapshot();

            return sendJson(200, {
              success: true,
              message: `تم حفظ ${resolvedUpdates.length} درجة لـ ${affectedStudents.size} طالب بنجاح واحتساب المعدلات تلقائياً`,
              data: {
                updatedCount: resolvedUpdates.length,
                affectedStudents: [...affectedStudents],
              },
            });
          }

          // PUT /api/grades/course/:courseId/items
          const putGradeItemsMatch = apiPath.match(/^\/grades\/course\/([^/]+)\/items$/);
          if (putGradeItemsMatch && req.method === 'PUT') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const courseId = decodeURIComponent(putGradeItemsMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح لك بتعديل أوزان هذا المقرر' });
            }

            const rawItems = body.items;
            if (!Array.isArray(rawItems) || rawItems.length === 0) {
              return sendJson(400, { success: false, message: 'قائمة بنود التقييم غير صالحة أو فارغة' });
            }
            for (const it of rawItems) {
              if (typeof it.weight !== 'number' || isNaN(it.weight) || it.weight < 0) {
                return sendJson(400, { success: false, message: 'الأوزان يجب أن تكون موجبة' });
              }
            }
            const totalWeight = rawItems.reduce((sum: number, it: any) => sum + Number(it.weight || 0), 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
              return sendJson(400, {
                success: false,
                message: `مجموع أوزان الدرجات يجب أن يساوي 100% تماماً. المجموع الحالي: ${totalWeight}%`,
              });
            }

            let nextId = Math.max(0, ...Object.values(mockGradeItemsStore).flat().map((i) => i.id)) + 1;
            const sanitizedItems: MockGradeItem[] = rawItems.map((it: any) => ({
              id: it.id || nextId++,
              course_id: courseId,
              name: String(it.name || 'بند تقييم'),
              category: it.category || 'assignments',
              weight: Number(it.weight),
              max_score: Number(it.max_score || it.maxScore || 100),
            }));

            // Remove student scores only for items explicitly deleted
            const keptIds = new Set(sanitizedItems.map((i) => i.id));
            if (mockStudentScoresStore[courseId]) {
              for (const sid of Object.keys(mockStudentScoresStore[courseId])) {
                for (const itemIdStr of Object.keys(mockStudentScoresStore[courseId][sid])) {
                  if (!keptIds.has(Number(itemIdStr))) {
                    delete mockStudentScoresStore[courseId][sid][Number(itemIdStr)];
                  }
                }
              }
            }

            mockGradeItemsStore[courseId] = sanitizedItems;
            saveSnapshot();

            return sendJson(200, {
              success: true,
              message: 'تم تعديل أوزان الدرجات وتحديث تقييمات الطلاب.',
              data: sanitizedItems,
            });
          }

          // GET /api/grades/course/:courseId/items
          const getGradeItemsMatch = apiPath.match(/^\/grades\/course\/([^/]+)\/items$/);
          if (getGradeItemsMatch && req.method === 'GET') {
            const courseId = decodeURIComponent(getGradeItemsMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            const gradeItems = mockGradeItemsStore[course.id] || ensureDefaultGradeItems(course.id);
            return sendJson(200, { success: true, data: gradeItems });
          }

          // GET /api/grades/course/:courseId/gradebook
          const getGradebookMatch = apiPath.match(/^\/grades\/course\/([^/]+)\/gradebook$/);
          if (getGradebookMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const courseId = decodeURIComponent(getGradebookMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح بعرض دفتر درجات هذا المقرر' });
            }

            const gradeItems = mockGradeItemsStore[course.id] || ensureDefaultGradeItems(course.id);
            const enrolled = mockEnrollmentsMap[course.id] || [];
            const totalSessions = mockAttendanceSessions.filter((s) => s.course_id === course.id).length;

            const formattedStudents = enrolled.map((st: any) => {
              const sid = st.student_id || st.id;
              const calc = calculateCourseStudentScore(course.id, sid);
              return {
                studentId: sid,
                studentName: st.name,
                studentNumber: st.student_number || st.studentId || sid,
                attendancePercentage: calc.attendancePercentage,
                scores: calc.scores,
                totalScore: calc.totalScore,
                letterGrade: calc.letterGrade,
                finalGrade: calc.finalGrade,
                gradeOverride: calc.gradeOverride,
                gradePoints: calc.gradePoints,
              };
            });

            return sendJson(200, {
              success: true,
              data: {
                course: {
                  id: course.id,
                  name: course.name,
                  code: course.code,
                  credit_hours: course.credit_hours || 3,
                },
                totalSessions,
                gradeItems,
                students: formattedStudents,
              },
            });
          }

          // ------------------------------------------------------------------
          // 5. FINANCIALS (Student & Admin)
          // ------------------------------------------------------------------
          if (apiPath === '/financials/my-status' && req.method === 'GET') {
            const fin = mockFinancialStudents.find(
              (s) => s.student_id === authUser.id || s.student_number === authUser.student_id
            );
            if (!fin) {
              return sendJson(200, {
                success: true,
                data: {
                  student_id: authUser.student_id || authUser.id,
                  student_name: authUser.name,
                  total_tuition: 3500,
                  paid_amount: 0,
                  remaining_amount: 3500,
                  status: 'unpaid',
                  is_frozen: Boolean(authUser.is_frozen),
                  freeze_reason: authUser.freeze_reason,
                  last_payment_date: null,
                  transactions: [],
                },
              });
            }
            return sendJson(200, {
              success: true,
              data: {
                student_id: fin.student_number,
                student_name: fin.student_name,
                total_tuition: fin.total_tuition,
                paid_amount: fin.paid_amount,
                remaining_amount: fin.remaining_amount,
                status: fin.status,
                is_frozen: fin.is_frozen,
                freeze_reason: fin.freeze_reason,
                last_payment_date: fin.last_payment_date,
                transactions: mockFinancialTransactions[fin.student_id] || [],
              },
            });
          }

          if (apiPath === '/financials/summary' && req.method === 'GET') {
            if (authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية الإدارة فقط' });
            }
            const totalExpected = mockFinancialStudents.reduce((sum, s) => sum + s.total_tuition, 0);
            const totalCollected = mockFinancialStudents.reduce((sum, s) => sum + s.paid_amount, 0);
            const frozenCount = mockFinancialStudents.filter((s) => s.is_frozen).length;

            return sendJson(200, {
              success: true,
              data: {
                totalRevenue: totalExpected,
                collectedAmount: totalCollected,
                outstandingAmount: Math.max(0, totalExpected - totalCollected),
                collectionRate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : '0',
                totalExpected,
                totalCollected,
                totalDebt: Math.max(0, totalExpected - totalCollected),
                frozenCount,
              },
            });
          }

          if (apiPath.startsWith('/admin/financials')) {
            if (authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية الإدارة فقط' });
            }

            if (apiPath === '/admin/financials/freeze' && req.method === 'POST') {
              const studentId = body.student_id;
              const student = mockFinancialStudents.find((s) => s.student_id === studentId || s.student_number === studentId);
              const reason = body.reason || 'تجميد إداري ومالي لمراجعة الأقساط المتأخرة';
              if (student) {
                student.is_frozen = true;
                student.freeze_reason = reason;
              }
              const user = mockUsersList.find((u) => u.id === studentId || u.student_id === studentId);
              if (user) {
                user.is_frozen = 1;
                user.freeze_reason = reason;
              }
              saveSnapshot();
              return sendJson(200, {
                success: true,
                message: 'تم تجميد حساب الطالب بنجاح وحظر تسجيل الحضور',
                data: student,
              });
            }

            if (apiPath === '/admin/financials/unfreeze' && req.method === 'POST') {
              const studentId = body.student_id;
              const student = mockFinancialStudents.find((s) => s.student_id === studentId || s.student_number === studentId);
              if (student) {
                student.is_frozen = false;
                student.freeze_reason = null;
              }
              const user = mockUsersList.find((u) => u.id === studentId || u.student_id === studentId);
              if (user) {
                user.is_frozen = 0;
                user.freeze_reason = null;
              }
              saveSnapshot();
              return sendJson(200, {
                success: true,
                message: 'تم فك تجميد حساب الطالب بنجاح وإعادة تفعيل الصلاحيات',
                data: student,
              });
            }

            if (apiPath === '/admin/financials/payment' && req.method === 'POST') {
              const studentId = body.student_id;
              const student = mockFinancialStudents.find((s) => s.student_id === studentId || s.student_number === studentId);
              if (!student) {
                return sendJson(404, { success: false, message: 'سجل الطالب المالي غير موجود' });
              }
              const amount = Number(body.amount || 0);
              if (amount <= 0) {
                return sendJson(400, { success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' });
              }
              student.paid_amount += amount;
              student.remaining_amount = Math.max(0, student.total_tuition - student.paid_amount);
              student.status = student.remaining_amount <= 0 ? 'paid' : 'partial';
              student.last_payment_date = new Date().toISOString().split('T')[0];

              if (!mockFinancialTransactions[student.student_id]) mockFinancialTransactions[student.student_id] = [];
              const receipt = body.receipt_number || `REC-${Date.now().toString().slice(-6)}`;
              mockFinancialTransactions[student.student_id].unshift({
                id: Date.now(),
                amount,
                balance_after: student.remaining_amount,
                receipt_number: receipt,
                payment_method: body.payment_method || 'نقدي',
                created_at: new Date().toISOString(),
                notes: body.notes || 'سداد قسط دراسي',
              });

              saveSnapshot();
              return sendJson(200, {
                success: true,
                message: 'تم تسجيل إيصال القبض وسداد القسط المالي بنجاح',
                data: student,
              });
            }

            if (apiPath === '/admin/financials/reset-password' && req.method === 'POST') {
              const targetId = body.user_id;
              const targetUser = mockUsersList.find((u) => u.id === targetId);
              if (!targetUser) {
                return sendJson(404, { success: false, message: 'المستخدم غير موجود' });
              }
              const tempPassword = (body.new_password || body.custom_password || '').trim() || `Hadir@${Math.floor(1000 + Math.random() * 9000)}`;
              targetUser.password = tempPassword;
              targetUser.token_version = (targetUser.token_version || 1) + 1;
              saveSnapshot();
              return sendJson(200, {
                success: true,
                message: 'تمت إعادة تعيين كلمة المرور بنجاح للمستخدم',
                data: {
                  userName: targetUser.name,
                  userEmail: targetUser.email,
                  role: targetUser.role,
                  temporaryPassword: tempPassword,
                },
              });
            }

            if (apiPath === '/admin/financials' && req.method === 'GET') {
              const totalExpected = mockFinancialStudents.reduce((sum, s) => sum + s.total_tuition, 0);
              const totalCollected = mockFinancialStudents.reduce((sum, s) => sum + s.paid_amount, 0);
              const frozenCount = mockFinancialStudents.filter((s) => s.is_frozen).length;

              return sendJson(200, {
                success: true,
                data: {
                  summary: {
                    totalExpected,
                    totalCollected,
                    totalDebt: Math.max(0, totalExpected - totalCollected),
                    totalStudents: mockFinancialStudents.length,
                    frozenCount,
                  },
                  students: mockFinancialStudents,
                },
              });
            }
          }

          // ------------------------------------------------------------------
          // 6. ADMIN STATS, USERS, COURSES, ENROLLMENTS
          // ------------------------------------------------------------------
          if (apiPath === '/admin/stats' && req.method === 'GET') {
            if (authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية الإدارة فقط' });
            }
            const frozenCount = mockFinancialStudents.filter((s) => s.is_frozen).length;
            const studentsCount = mockUsersList.filter((u) => u.role === 'student').length;
            const teachersCount = mockUsersList.filter((u) => u.role === 'teacher').length;
            const adminsCount = mockUsersList.filter((u) => u.role === 'admin').length;
            const activeSessionsCount = mockAttendanceSessions.filter((s) => s.status === 'active').length;

            return sendJson(200, {
              success: true,
              data: {
                students: studentsCount,
                teachers: teachersCount,
                courses: mockCoursesList.length,
                admins: adminsCount,
                students_count: studentsCount,
                teachers_count: teachersCount,
                courses_count: mockCoursesList.length,
                admins_count: adminsCount,
                totalStudents: studentsCount,
                totalTeachers: teachersCount,
                totalCourses: mockCoursesList.length,
                activeSessionsCount,
                frozenAccountsCount: frozenCount,
              },
            });
          }

          if (apiPath.startsWith('/admin/users')) {
            if (authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية الإدارة فقط' });
            }
            const parsedUrl = new URL(url, 'http://localhost');
            const roleParam = parsedUrl.searchParams.get('role');
            const searchParam = parsedUrl.searchParams.get('search');
            const subPath = apiPath.replace('/admin/users', '').replace(/^\//, '');
            const userId = subPath.split('/')[0];

            if (req.method === 'POST') {
              if (subPath.endsWith('/password') && userId) {
                const target = mockUsersList.find((u) => u.id === userId);
                if (!target) return sendJson(404, { success: false, message: 'المستخدم غير موجود' });
                const pw = String(body.password || body.newPassword || '').trim();
                if (pw.length < 6) {
                  return sendJson(400, { success: false, message: 'كلمة المرور يجب أن لا تقل عن 6 أحرف' });
                }
                target.password = pw;
                target.token_version = (target.token_version || 1) + 1;
                saveSnapshot();
                return sendJson(200, { success: true, message: 'تم تغيير كلمة المرور بنجاح' });
              }

              const name = String(body.name || '').trim();
              const email = String(body.email || '').trim();
              const role = (body.role === 'teacher' ? 'teacher' : 'student') as 'teacher' | 'student';
              const password = String(body.password || '').trim();
              const studentNumber = body.student_id || body.studentId;

              if (!name || !email) {
                return sendJson(400, { success: false, message: 'الاسم والبريد الإلكتروني حقول مطلوبة' });
              }
              if (!password || password.length < 6) {
                return sendJson(400, { success: false, message: 'كلمة المرور مطلوبة (6 أحرف على الأقل)' });
              }
              if (role === 'student' && !studentNumber) {
                return sendJson(400, { success: false, message: 'الرقم الجامعي مطلوب للطلاب' });
              }
              if (mockUsersList.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
                return sendJson(400, { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
              }

              const newUser: MockUser = {
                id: `usr-${Date.now()}`,
                name,
                email,
                password,
                role,
                student_id: role === 'student' ? String(studentNumber) : null,
                studentId: role === 'student' ? String(studentNumber) : null,
                teacher_code: role === 'teacher' ? body.teacher_code || `T${Math.floor(1000 + Math.random() * 9000)}` : null,
                department: body.department || 'علوم الحاسوب',
                is_active: 1,
                is_frozen: 0,
                freeze_reason: null,
                two_factor_enabled: false,
                two_factor_secret: null,
                token_version: 1,
              };
              mockUsersList.unshift(newUser);

              if (role === 'student') {
                mockFinancialStudents.push({
                  id: mockFinancialStudents.length + 1,
                  student_id: newUser.id,
                  student_name: newUser.name,
                  student_number: newUser.student_id || '',
                  student_email: newUser.email,
                  total_tuition: 3500.0,
                  paid_amount: 0.0,
                  remaining_amount: 3500.0,
                  discount: 0.0,
                  status: 'unpaid',
                  is_frozen: false,
                  freeze_reason: null,
                  last_payment_date: null,
                });
              }

              saveSnapshot();
              return sendJson(201, {
                success: true,
                message: 'تم إنشاء المستخدم بنجاح',
                data: sanitizeUser(newUser),
              });
            }

            if (req.method === 'PUT' && userId) {
              const idx = mockUsersList.findIndex((u) => u.id === userId);
              if (idx === -1) {
                return sendJson(404, { success: false, message: 'المستخدم غير موجود' });
              }
              const target = mockUsersList[idx];
              if (body.name !== undefined) target.name = String(body.name).trim();
              if (body.email !== undefined) target.email = String(body.email).trim();
              if (body.role !== undefined && (body.role === 'student' || body.role === 'teacher')) target.role = body.role;
              if (body.department !== undefined) target.department = body.department;
              if (body.student_id !== undefined || body.studentId !== undefined) {
                const sid = body.student_id ?? body.studentId;
                target.student_id = sid || null;
                target.studentId = sid || null;
              }
              if (body.is_active !== undefined) {
                target.is_active = body.is_active ? 1 : 0;
              }
              const fin = mockFinancialStudents.find((s) => s.student_id === target.id);
              if (fin) {
                fin.student_name = target.name;
                fin.student_email = target.email;
                if (target.student_id) fin.student_number = target.student_id;
              }
              saveSnapshot();
              return sendJson(200, {
                success: true,
                message: 'تم تحديث بيانات المستخدم بنجاح',
                data: sanitizeUser(target),
              });
            }

            if (req.method === 'DELETE' && userId) {
              const existed = mockUsersList.some((u) => u.id === userId);
              if (!existed) return sendJson(404, { success: false, message: 'المستخدم غير موجود' });
              mockUsersList = mockUsersList.filter((u) => u.id !== userId);
              mockFinancialStudents = mockFinancialStudents.filter((s) => s.student_id !== userId);
              Object.keys(mockEnrollmentsMap).forEach((cid) => {
                mockEnrollmentsMap[cid] = mockEnrollmentsMap[cid].filter((e) => e.id !== userId && e.student_id !== userId);
              });
              saveSnapshot();
              return sendJson(200, { success: true, message: 'تم حذف المستخدم بنجاح' });
            }

            // GET /api/admin/users
            let filtered = mockUsersList.map(sanitizeUser);
            if (roleParam && roleParam !== 'all') {
              filtered = filtered.filter((u) => u.role === roleParam);
            }
            if (searchParam && searchParam.trim()) {
              const q = searchParam.trim().toLowerCase();
              filtered = filtered.filter(
                (u) =>
                  (u.name || '').toLowerCase().includes(q) ||
                  (u.email || '').toLowerCase().includes(q) ||
                  (u.student_id || '').toLowerCase().includes(q) ||
                  (u.teacher_code || '').toLowerCase().includes(q) ||
                  (u.department || '').toLowerCase().includes(q)
              );
            }

            return sendJson(200, {
              success: true,
              data: filtered,
              count: filtered.length,
            });
          }

          if (apiPath.startsWith('/admin/courses')) {
            if (authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية الإدارة فقط' });
            }
            const parsedUrl = new URL(url, 'http://localhost');
            const searchParam = parsedUrl.searchParams.get('search');
            const subPath = apiPath.replace('/admin/courses', '').replace(/^\//, '');
            const courseId = subPath.split('/')[0];

            if (apiPath.includes('/enrollments') && req.method === 'GET') {
              const enrollments = mockEnrollmentsMap[courseId] || [];
              return sendJson(200, { success: true, data: enrollments, count: enrollments.length });
            }

            if (apiPath.endsWith('/enroll') && req.method === 'POST') {
              const studentId = body.student_id;
              const studentUser = mockUsersList.find(
                (u) => (u.id === studentId || u.student_id === studentId) && u.role === 'student'
              );
              if (!studentUser) {
                return sendJson(404, { success: false, message: 'الطالب غير موجود' });
              }
              if (!mockEnrollmentsMap[courseId]) mockEnrollmentsMap[courseId] = [];
              if (!mockEnrollmentsMap[courseId].some((e) => e.id === studentUser.id)) {
                const today = new Date().toISOString().split('T')[0];
                mockEnrollmentsMap[courseId].push({
                  id: studentUser.id,
                  student_id: studentUser.id,
                  studentId: studentUser.id,
                  student_number: studentUser.student_id,
                  name: studentUser.name,
                  email: studentUser.email,
                  department: studentUser.department,
                  enrolled_at: today,
                  enrollment_date: today,
                });
              }
              syncCourseStudentCounts();
              saveSnapshot();
              return sendJson(200, { success: true, message: 'تم تسجيل الطالب في المقرر بنجاح' });
            }

            if (apiPath.includes('/enroll/') && req.method === 'DELETE') {
              const studentIdToDelete = decodeURIComponent(apiPath.split('/enroll/')[1]);
              if (mockEnrollmentsMap[courseId]) {
                mockEnrollmentsMap[courseId] = mockEnrollmentsMap[courseId].filter(
                  (e) => e.id !== studentIdToDelete && e.student_id !== studentIdToDelete
                );
              }
              syncCourseStudentCounts();
              saveSnapshot();
              return sendJson(200, { success: true, message: 'تم إلغاء تسجيل الطالب من المقرر بنجاح' });
            }

            if (apiPath.endsWith('/assign-teacher') && req.method === 'POST') {
              const teacherId = body.teacher_id;
              const teacherUser = mockUsersList.find((u) => u.id === teacherId && u.role === 'teacher');
              const course = mockCoursesList.find((c) => c.id === courseId);
              if (!course || !teacherUser) {
                return sendJson(404, { success: false, message: 'المقرر أو المحاضر غير موجود' });
              }
              course.teacher_id = teacherUser.id;
              course.teacherId = teacherUser.id;
              course.teacher_name = teacherUser.name;
              course.teacherName = teacherUser.name;
              course.teacher_department = teacherUser.department || course.teacher_department;
              saveSnapshot();
              return sendJson(200, { success: true, message: 'تم تعيين المحاضر للمقرر بنجاح', data: course });
            }

            if (req.method === 'POST') {
              if (!body.name || !body.code) {
                return sendJson(400, { success: false, message: 'اسم المقرر ورمزه حقول مطلوبة' });
              }
              const teacherObj = body.teacher_id
                ? mockUsersList.find((u) => u.id === body.teacher_id && u.role === 'teacher')
                : null;
              const newId = `crs-${Date.now()}`;
              const newCourse = {
                id: newId,
                code: String(body.code).trim().toUpperCase(),
                name: String(body.name).trim(),
                teacher_id: teacherObj ? teacherObj.id : body.teacher_id || '',
                teacherId: teacherObj ? teacherObj.id : body.teacher_id || '',
                teacher_name: teacherObj ? teacherObj.name : body.teacher_name || 'غير معين',
                teacherName: teacherObj ? teacherObj.name : body.teacher_name || 'غير معين',
                teacher_department: teacherObj?.department || body.teacher_department || 'علوم الحاسوب',
                credit_hours: Number(body.credit_hours || 3),
                creditHours: Number(body.credit_hours || 3),
                students_count: 0,
                lectures_count: 0,
                schedule_day: body.schedule_day || 'الأحد - الثلاثاء',
                schedule_time: body.schedule_time || '10:00 - 11:30',
                room: body.room || 'قاعة المحاضرات المركزية',
                description: body.description || '',
              };
              mockCoursesList.unshift(newCourse);
              mockEnrollmentsMap[newId] = [];
              ensureDefaultGradeItems(newId);
              saveSnapshot();
              return sendJson(201, { success: true, data: newCourse });
            }

            if (req.method === 'PUT' && courseId) {
              const idx = mockCoursesList.findIndex((c) => c.id === courseId);
              if (idx === -1) {
                return sendJson(404, { success: false, message: 'المقرر غير موجود' });
              }
              const existing = mockCoursesList[idx];
              const teacherId = body.teacher_id ?? existing.teacher_id;
              const teacherObj = teacherId ? mockUsersList.find((u) => u.id === teacherId && u.role === 'teacher') : null;
              mockCoursesList[idx] = {
                ...existing,
                code: body.code ? String(body.code).trim().toUpperCase() : existing.code,
                name: body.name ? String(body.name).trim() : existing.name,
                teacher_id: teacherId,
                teacherId: teacherId,
                teacher_name: teacherObj ? teacherObj.name : body.teacher_name || existing.teacher_name,
                teacherName: teacherObj ? teacherObj.name : body.teacher_name || existing.teacherName,
                credit_hours: Number(body.credit_hours ?? existing.credit_hours ?? 3),
                creditHours: Number(body.credit_hours ?? existing.credit_hours ?? 3),
                room: body.room ?? existing.room,
                schedule_day: body.schedule_day ?? existing.schedule_day,
                schedule_time: body.schedule_time ?? existing.schedule_time,
                description: body.description ?? existing.description,
              };
              syncCourseStudentCounts();
              saveSnapshot();
              return sendJson(200, { success: true, data: mockCoursesList[idx] });
            }

            if (req.method === 'DELETE' && courseId) {
              mockCoursesList = mockCoursesList.filter((c) => c.id !== courseId);
              delete mockEnrollmentsMap[courseId];
              delete mockGradeItemsStore[courseId];
              saveSnapshot();
              return sendJson(200, { success: true, message: 'تم حذف المقرر بنجاح' });
            }

            // GET /api/admin/courses
            syncCourseStudentCounts();
            let list = [...mockCoursesList];
            if (searchParam && searchParam.trim()) {
              const q = searchParam.trim().toLowerCase();
              list = list.filter(
                (c) =>
                  c.name.toLowerCase().includes(q) ||
                  c.code.toLowerCase().includes(q) ||
                  (c.room || '').toLowerCase().includes(q)
              );
            }
            return sendJson(200, { success: true, data: list, count: list.length });
          }

          // ------------------------------------------------------------------
          // 7. ATTENDANCE & UNIFIED TOTP QR FLOW
          // ------------------------------------------------------------------
          if ((apiPath === '/attendance/student/sessions/active' || apiPath === '/attendance/student/active') && req.method === 'GET') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }
            const active = mockAttendanceSessions.filter(
              (s) => s.status === 'active' && isStudentEnrolled(s.course_id, authUser.id)
            );
            const formatted = active.map((s) => {
              const course = mockCoursesList.find((c) => c.id === s.course_id);
              return {
                id: s.id,
                course_id: s.course_id,
                course_name: s.course_name,
                course_code: s.course_code,
                teacher_name: course?.teacher_name || 'أستاذ المقرر',
                room: s.room || course?.room || 'القاعة الرئيسية',
                date: s.date,
                time: s.time,
                status: s.status,
              };
            });
            return sendJson(200, { success: true, data: formatted });
          }

          if (apiPath === '/attendance/student/scan' && req.method === 'POST') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }

            // 1. Freeze enforcement (authenticated user)
            const fin = mockFinancialStudents.find(
              (s) => s.student_id === authUser.id || s.student_number === authUser.student_id
            );
            if (authUser.is_frozen || fin?.is_frozen) {
              return sendJson(403, {
                success: false,
                code: 'ACCOUNT_FROZEN',
                message: fin?.freeze_reason || authUser.freeze_reason || 'حسابك مجمد أكاديمياً، لا يمكنك تسجيل الحضور',
              });
            }

            // 2. Parse QR payload: HADIR:<sessionId>:<window>:<token>
            const qrCodeStr = typeof body.qr_code === 'string' ? body.qr_code.trim() : '';
            if (!qrCodeStr.startsWith('HADIR:')) {
              return sendJson(400, { success: false, message: 'رمز QR غير صالح أو غير مكتمل' });
            }
            const parts = qrCodeStr.split(':');
            if (parts.length !== 4) {
              return sendJson(400, { success: false, message: 'صيغة رمز QR غير صالحة' });
            }

            const [, sessionId, windowStr, clientToken] = parts;
            const targetSession = mockAttendanceSessions.find((s) => s.id === sessionId);
            if (!targetSession) {
              return sendJson(404, { success: false, message: 'جلسة الحضور غير موجودة' });
            }
            if (targetSession.status !== 'active') {
              return sendJson(400, { success: false, message: 'جلسة الحضور مغلقة' });
            }

            // 3. Active enrollment enforcement
            if (!isStudentEnrolled(targetSession.course_id, authUser.id)) {
              return sendJson(403, { success: false, message: 'أنت غير مسجل في هذا المقرر الدراسي' });
            }

            // 4. TOTP window & HMAC bound strictly to sessionId:clientWindow
            const interval = 20;
            const currentWindow = Math.floor(Math.floor(Date.now() / 1000) / interval);
            const clientWindow = parseInt(windowStr, 10);
            if (isNaN(clientWindow) || Math.abs(currentWindow - clientWindow) > 1) {
              return sendJson(400, { success: false, message: 'انتهت صلاحية رمز QR أو غير صالح' });
            }

            const expectedToken = crypto
              .createHmac('sha256', targetSession.qr_secret)
              .update(`${sessionId}:${clientWindow}`)
              .digest('hex')
              .slice(0, 8)
              .toUpperCase();

            if (clientToken !== expectedToken) {
              return sendJson(400, { success: false, message: 'رمز QR غير صالح أو تم التلاعب به' });
            }

            // 5. Anti-proxy device fingerprint check
            const deviceFingerprint = String(
              body.device_fingerprint || body.device_id || req.headers['x-device-fingerprint'] || ''
            ).trim();
            if (!deviceFingerprint) {
              return sendJson(400, { success: false, message: 'بصمة الجهاز مطلوبة لمنع التحضير بالنيابة' });
            }

            const proxyAttendee = targetSession.attendees.find(
              (a) => a.device_fingerprint === deviceFingerprint && a.student_id !== authUser.id
            );
            if (proxyAttendee) {
              return sendJson(400, {
                success: false,
                message: 'تم استخدام هذا الجهاز للتحضير لطالب آخر',
              });
            }

            // 6. Idempotent check-in
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 8);
            const alreadyCheckedIn = targetSession.attendees.some((a) => a.student_id === authUser.id);

            if (!alreadyCheckedIn) {
              const newAttendee: MockAttendanceAttendee = {
                id: 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                student_id: authUser.id,
                student_name: authUser.name,
                student_number: authUser.student_id || authUser.id,
                student_email: authUser.email,
                device_fingerprint: deviceFingerprint,
                check_in_time: timeStr,
                attendance_time: timeStr,
                timestamp: now.toISOString(),
                method: 'qr',
                status: 'present',
              };
              targetSession.attendees.unshift(newAttendee);
              targetSession.attendees_count = targetSession.attendees.length;
              targetSession.attendeesCount = targetSession.attendees.length;
              saveSnapshot();
            }

            return sendJson(200, {
              success: true,
              message: 'تم تسجيل الحضور بنجاح',
              data: {
                id: Date.now(),
                session_id: targetSession.id,
                course_id: targetSession.course_id,
                course_name: targetSession.course_name,
                course_code: targetSession.course_code,
                date: targetSession.date || now.toISOString().split('T')[0],
                time: targetSession.time || timeStr.slice(0, 5),
                method: 'qr',
                status: 'present',
              },
            });
          }

          if (apiPath === '/attendance/teacher/sessions/active' && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const active = mockAttendanceSessions
              .filter((s) => {
                if (s.status !== 'active') return false;
                if (authUser.role === 'admin') return true;
                const course = mockCoursesList.find((c) => c.id === s.course_id);
                return course?.teacher_id === authUser.id || s.created_by === authUser.id;
              })
              .map(sanitizeMockSession);
            return sendJson(200, { success: true, data: active });
          }

          const teacherCourseSessionsMatch = apiPath.match(/^\/attendance\/teacher\/course\/([^/]+)\/sessions$/);
          if (teacherCourseSessionsMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const courseId = decodeURIComponent(teacherCourseSessionsMatch[1]);
            const course = mockCoursesList.find((c) => c.id === courseId);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح بعرض جلسات هذا المقرر' });
            }
            const courseSessions = mockAttendanceSessions
              .filter((s) => s.course_id === courseId)
              .map(sanitizeMockSession);
            return sendJson(200, { success: true, data: courseSessions });
          }

          if (apiPath === '/attendance/teacher/sessions' && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const course = mockCoursesList.find((c) => c.id === body.course_id);
            if (!course) {
              return sendJson(404, { success: false, message: 'المقرر غير موجود' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'أنت غير مكلف بتدريس هذا المقرر' });
            }

            const now = new Date();
            const newId = 'ses-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            const qrSecret = crypto.randomBytes(32).toString('hex');
            const qr = computeTotpQr(newId, qrSecret);

            const newSession: MockAttendanceSession = {
              id: newId,
              course_id: course.id,
              course_name: course.name,
              course_code: course.code,
              date: body.date || now.toISOString().split('T')[0],
              time: body.time || now.toTimeString().slice(0, 5),
              room: body.room || course.room || 'قاعة المحاضرات',
              schedule_day: course.schedule_day,
              schedule_time: course.schedule_time,
              qr_secret: qrSecret,
              qr_code: qr.qrCode,
              qrCode: qr.qrCode,
              status: 'active',
              created_by: authUser.id,
              created_at: now.toISOString(),
              closed_at: null,
              attendees: [],
              attendees_count: 0,
              attendeesCount: 0,
            };

            mockAttendanceSessions.unshift(newSession);
            saveSnapshot();
            return sendJson(201, {
              success: true,
              message: 'تم إنشاء الجلسة بنجاح',
              data: sanitizeMockSession(newSession),
            });
          }

          const liveQrMatch = apiPath.match(/^\/attendance\/teacher\/sessions\/([^/]+)\/live-qr$/);
          if (liveQrMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const sessionId = decodeURIComponent(liveQrMatch[1]);
            const session = mockAttendanceSessions.find((s) => s.id === sessionId);
            if (!session || session.status !== 'active') {
              return sendJson(404, { success: false, message: 'الجلسة غير موجودة أو مغلقة' });
            }
            const course = mockCoursesList.find((c) => c.id === session.course_id);
            if (authUser.role === 'teacher' && course?.teacher_id !== authUser.id && session.created_by !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const qr = computeTotpQr(session.id, session.qr_secret);
            session.qr_code = qr.qrCode;
            session.qrCode = qr.qrCode;
            return sendJson(200, {
              success: true,
              data: {
                qrCode: qr.qrCode,
                qr_code: qr.qrCode,
                expiresIn: qr.expiresIn,
                remaining_seconds: qr.expiresIn,
                attendeesCount: session.attendees.length,
              },
            });
          }

          const attendeesMatch = apiPath.match(/^\/attendance\/teacher\/sessions\/([^/]+)\/attendees$/);
          if (attendeesMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const sessionId = decodeURIComponent(attendeesMatch[1]);
            const session = mockAttendanceSessions.find((s) => s.id === sessionId);
            if (!session) {
              return sendJson(404, { success: false, message: 'الجلسة غير موجودة' });
            }
            return sendJson(200, { success: true, data: session.attendees });
          }

          const refreshQrMatch = apiPath.match(/^\/attendance\/teacher\/sessions\/([^/]+)\/refresh-qr$/);
          if (refreshQrMatch && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const sessionId = decodeURIComponent(refreshQrMatch[1]);
            const session = mockAttendanceSessions.find((s) => s.id === sessionId && s.status === 'active');
            if (!session) {
              return sendJson(404, { success: false, message: 'الجلسة غير موجودة أو مغلقة' });
            }
            session.qr_secret = crypto.randomBytes(32).toString('hex');
            const qr = computeTotpQr(session.id, session.qr_secret);
            session.qr_code = qr.qrCode;
            session.qrCode = qr.qrCode;
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم تجديد الرمز بنجاح',
              data: sanitizeMockSession(session),
            });
          }

          const closeSessionMatch = apiPath.match(/^\/attendance\/teacher\/sessions\/([^/]+)\/close$/);
          if (closeSessionMatch && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const sessionId = decodeURIComponent(closeSessionMatch[1]);
            const session = mockAttendanceSessions.find((s) => s.id === sessionId);
            if (!session) {
              return sendJson(404, { success: false, message: 'الجلسة غير موجودة' });
            }
            session.status = 'closed';
            session.closed_at = new Date().toISOString();
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم إغلاق الجلسة بنجاح',
              data: sanitizeMockSession(session),
            });
          }

          // ------------------------------------------------------------------
          // 8. STATEFUL ASSIGNMENTS & SUBMISSIONS & DOWNLOADS
          // ------------------------------------------------------------------
          if (apiPath === '/assignments/teacher' && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const myCourseIds = new Set(
              mockCoursesList
                .filter((c) => authUser.role === 'admin' || c.teacher_id === authUser.id)
                .map((c) => c.id)
            );
            const list = mockAssignmentsList
              .filter((a) => myCourseIds.has(a.course_id))
              .map((a) => {
                const subs = mockAssignmentSubmissions.filter((s) => s.assignment_id === a.id);
                const graded = subs.filter((s) => s.status === 'graded').length;
                return {
                  ...a,
                  submitted_count: subs.length,
                  submissions_count: subs.length,
                  graded_count: graded,
                };
              });
            return sendJson(200, { success: true, data: list, count: list.length });
          }

          if (apiPath === '/assignments/teacher' && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const course = mockCoursesList.find((c) => c.id === body.course_id);
            if (!course || !body.title || !body.due_date) {
              return sendJson(400, { success: false, message: 'بيانات الواجب غير مكتملة' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح بإنشاء واجب لهذا المقرر' });
            }
            const newId = `asg-${Date.now()}`;
            let fileKey: string | null = null;
            let fileName: string | null = null;
            if (uploadedFile) {
              fileKey = `${newId}-${uploadedFile.fileName}`;
              fileName = uploadedFile.fileName;
              mockUploadedFiles.set(fileKey, {
                buffer: uploadedFile.buffer,
                mimeType: uploadedFile.mimeType,
                fileName: uploadedFile.fileName,
              });
            }
            const created: MockAssignment = {
              id: newId,
              course_id: course.id,
              course_name: course.name,
              course_code: course.code,
              title: String(body.title).trim(),
              description: body.description ? String(body.description).trim() : '',
              due_date: String(body.due_date),
              max_score: Number(body.max_score || 100),
              file_url: fileKey,
              file_name: fileName,
              created_at: new Date().toISOString(),
            };
            mockAssignmentsList.unshift(created);
            saveSnapshot();
            return sendJson(201, { success: true, message: 'تم إنشاء الواجب بنجاح', data: created });
          }

          const teacherAsgDeleteMatch = apiPath.match(/^\/assignments\/teacher\/([^/]+)$/);
          if (teacherAsgDeleteMatch && req.method === 'DELETE') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const asgId = decodeURIComponent(teacherAsgDeleteMatch[1]);
            const idx = mockAssignmentsList.findIndex((a) => a.id === asgId);
            if (idx === -1) return sendJson(404, { success: false, message: 'الواجب غير موجود' });
            mockAssignmentsList.splice(idx, 1);
            mockAssignmentSubmissions = mockAssignmentSubmissions.filter((s) => s.assignment_id !== asgId);
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم حذف الواجب بنجاح' });
          }

          const teacherAsgDownloadMatch = apiPath.match(/^\/assignments\/teacher\/([^/]+)\/download$/);
          if (teacherAsgDownloadMatch && req.method === 'GET') {
            const asgId = decodeURIComponent(teacherAsgDownloadMatch[1]);
            const asg = mockAssignmentsList.find((a) => a.id === asgId);
            if (!asg || !asg.file_url) {
              return sendJson(404, { success: false, message: 'الملف غير موجود' });
            }
            const stored = mockUploadedFiles.get(asg.file_url);
            const buf = stored?.buffer || buildMinimalPdf(asg.file_name || asg.title);
            return sendFileDownload(asg.file_name || `${asg.id}.pdf`, buf, stored?.mimeType || 'application/pdf');
          }

          const teacherAsgSubsMatch = apiPath.match(/^\/assignments\/teacher\/([^/]+)\/submissions$/);
          if (teacherAsgSubsMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const asgId = decodeURIComponent(teacherAsgSubsMatch[1]);
            const subs = mockAssignmentSubmissions.filter((s) => s.assignment_id === asgId);
            return sendJson(200, { success: true, data: subs, count: subs.length });
          }

          const gradeSubMatch = apiPath.match(/^\/assignments\/teacher\/submissions\/(\d+)\/grade$/);
          if (gradeSubMatch && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const subId = parseInt(gradeSubMatch[1], 10);
            const sub = mockAssignmentSubmissions.find((s) => s.id === subId);
            if (!sub) {
              return sendJson(404, { success: false, message: 'التسليم غير موجود' });
            }
            const gradeNum = Number(body.percentage ?? body.grade);
            if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
              return sendJson(400, { success: false, message: 'الدرجة يجب أن تكون بين 0 و 100' });
            }
            sub.grade = gradeNum;
            sub.feedback = body.feedback !== undefined ? String(body.feedback) : sub.feedback;
            sub.status = 'graded';
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم رصد الدرجة بنجاح', data: sub });
          }

          const downloadSubMatch = apiPath.match(/^\/assignments\/teacher\/submissions\/(\d+)\/download$/);
          if (downloadSubMatch && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const subId = parseInt(downloadSubMatch[1], 10);
            const sub = mockAssignmentSubmissions.find((s) => s.id === subId);
            if (!sub) return sendJson(404, { success: false, message: 'التسليم غير موجود' });
            const stored = mockUploadedFiles.get(sub.file_url);
            const buf = stored?.buffer || buildMinimalPdf(sub.file_name);
            return sendFileDownload(sub.file_name, buf, stored?.mimeType || 'application/pdf');
          }

          if (apiPath === '/assignments/student' && req.method === 'GET') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }
            const studentAssignments = mockAssignmentsList
              .filter((a) => isStudentEnrolled(a.course_id, authUser.id))
              .map((a) => {
                const sub = mockAssignmentSubmissions.find(
                  (s) => s.assignment_id === a.id && s.student_id === authUser.id
                );
                return {
                  ...a,
                  status: sub ? sub.status : 'pending',
                  grade: sub?.grade ?? null,
                  feedback: sub?.feedback ?? null,
                };
              });
            return sendJson(200, { success: true, data: studentAssignments, count: studentAssignments.length });
          }

          const studentAsgDownloadMatch = apiPath.match(/^\/assignments\/student\/([^/]+)\/download$/);
          if (studentAsgDownloadMatch && req.method === 'GET') {
            const asgId = decodeURIComponent(studentAsgDownloadMatch[1]);
            const asg = mockAssignmentsList.find((a) => a.id === asgId);
            if (!asg || !asg.file_url) return sendJson(404, { success: false, message: 'الملف غير موجود' });
            if (authUser.role === 'student' && !isStudentEnrolled(asg.course_id, authUser.id)) {
              return sendJson(403, { success: false, message: 'غير مصرح' });
            }
            const stored = mockUploadedFiles.get(asg.file_url);
            const buf = stored?.buffer || buildMinimalPdf(asg.file_name || asg.title);
            return sendFileDownload(asg.file_name || `${asg.id}.pdf`, buf, stored?.mimeType || 'application/pdf');
          }

          const studentAsgSubmitMatch = apiPath.match(/^\/assignments\/student\/([^/]+)\/submit$/);
          if (studentAsgSubmitMatch && req.method === 'POST') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }
            if (authUser.is_frozen) {
              return sendJson(403, {
                success: false,
                code: 'ACCOUNT_FROZEN',
                message: authUser.freeze_reason || 'حسابك مجمد أكاديمياً، لا يمكنك تسليم الواجبات',
              });
            }
            const asgId = decodeURIComponent(studentAsgSubmitMatch[1]);
            const asg = mockAssignmentsList.find((a) => a.id === asgId);
            if (!asg) return sendJson(404, { success: false, message: 'الواجب غير موجود' });
            if (!isStudentEnrolled(asg.course_id, authUser.id)) {
              return sendJson(403, { success: false, message: 'أنت غير مسجل في هذا المقرر' });
            }

            const newSubId = Math.max(500, ...mockAssignmentSubmissions.map((s) => s.id)) + 1;
            const fileName = uploadedFile?.fileName || body.file_name || `submission-${authUser.student_id || authUser.id}.pdf`;
            const fileKey = `sub-${newSubId}-${fileName}`;
            if (uploadedFile) {
              mockUploadedFiles.set(fileKey, {
                buffer: uploadedFile.buffer,
                mimeType: uploadedFile.mimeType,
                fileName,
              });
            }

            const existingIdx = mockAssignmentSubmissions.findIndex(
              (s) => s.assignment_id === asgId && s.student_id === authUser.id
            );
            const subRecord: MockSubmission = {
              id: existingIdx !== -1 ? mockAssignmentSubmissions[existingIdx].id : newSubId,
              assignment_id: asgId,
              student_id: authUser.id,
              student_name: authUser.name,
              student_email: authUser.email,
              student_number: authUser.student_id || authUser.id,
              file_url: fileKey,
              file_name: fileName,
              file_size: uploadedFile?.buffer.length || 1024,
              submitted_at: new Date().toISOString(),
              status: 'submitted',
              grade: null,
              feedback: null,
            };
            if (existingIdx !== -1) {
              mockAssignmentSubmissions[existingIdx] = subRecord;
            } else {
              mockAssignmentSubmissions.unshift(subRecord);
            }
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم تسليم الواجب بنجاح', data: subRecord });
          }

          // ------------------------------------------------------------------
          // 9. STATEFUL LECTURES & DOWNLOADS (Strictly course & enrollment scoped)
          // ------------------------------------------------------------------
          if (apiPath === '/lectures/teacher' && req.method === 'GET') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const myCourseIds = new Set(
              mockCoursesList
                .filter((c) => authUser.role === 'admin' || c.teacher_id === authUser.id)
                .map((c) => c.id)
            );
            const list = mockLecturesList.filter((l) => myCourseIds.has(l.course_id));
            return sendJson(200, { success: true, data: list, count: list.length });
          }

          if (apiPath === '/lectures/teacher' && req.method === 'POST') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const course = mockCoursesList.find((c) => c.id === body.course_id);
            if (!course || !body.title) {
              return sendJson(400, { success: false, message: 'بيانات المحاضرة غير مكتملة' });
            }
            if (authUser.role === 'teacher' && course.teacher_id !== authUser.id) {
              return sendJson(403, { success: false, message: 'غير مصرح برفع محاضرة لهذا المقرر' });
            }
            const newId = `lec-${Date.now()}`;
            const fileName = uploadedFile?.fileName || body.file_name || `${newId}.pdf`;
            const fileKey = `${newId}-${fileName}`;
            if (uploadedFile) {
              mockUploadedFiles.set(fileKey, {
                buffer: uploadedFile.buffer,
                mimeType: uploadedFile.mimeType,
                fileName,
              });
            }
            const created: MockLecture = {
              id: newId,
              course_id: course.id,
              title: String(body.title).trim(),
              description: body.description ? String(body.description).trim() : '',
              file_url: fileKey,
              file_name: fileName,
              file_size: uploadedFile?.buffer.length || Number(body.file_size) || 1048576,
              date: body.date || new Date().toISOString().split('T')[0],
              created_at: new Date().toISOString(),
            };
            mockLecturesList.unshift(created);
            saveSnapshot();
            return sendJson(201, { success: true, message: 'تم رفع المحاضرة بنجاح', data: created });
          }

          const teacherLecDeleteMatch = apiPath.match(/^\/lectures\/teacher\/([^/]+)$/);
          if (teacherLecDeleteMatch && req.method === 'DELETE') {
            if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
              return sendJson(403, { success: false, message: 'صلاحية المحاضرين فقط' });
            }
            const lecId = decodeURIComponent(teacherLecDeleteMatch[1]);
            const idx = mockLecturesList.findIndex((l) => l.id === lecId);
            if (idx === -1) return sendJson(404, { success: false, message: 'المحاضرة غير موجودة' });
            mockLecturesList.splice(idx, 1);
            saveSnapshot();
            return sendJson(200, { success: true, message: 'تم حذف المحاضرة بنجاح' });
          }

          const teacherLecDownloadMatch = apiPath.match(/^\/lectures\/teacher\/([^/]+)\/download$/);
          if (teacherLecDownloadMatch && req.method === 'GET') {
            const lecId = decodeURIComponent(teacherLecDownloadMatch[1]);
            const lec = mockLecturesList.find((l) => l.id === lecId);
            if (!lec || !lec.file_url) return sendJson(404, { success: false, message: 'الملف غير موجود' });
            const stored = mockUploadedFiles.get(lec.file_url);
            const buf = stored?.buffer || buildMinimalPdf(lec.file_name || lec.title);
            return sendFileDownload(lec.file_name || `${lec.id}.pdf`, buf, stored?.mimeType || 'application/pdf');
          }

          const studentCourseLecMatch = apiPath.match(/^\/lectures\/student\/course\/([^/]+)$/);
          if (studentCourseLecMatch && req.method === 'GET') {
            if (authUser.role !== 'student') {
              return sendJson(403, { success: false, message: 'صلاحية الطلاب فقط' });
            }
            const courseId = decodeURIComponent(studentCourseLecMatch[1]);
            if (!isStudentEnrolled(courseId, authUser.id)) {
              return sendJson(403, { success: false, message: 'أنت غير مسجل في هذا المقرر' });
            }
            const courseLectures = mockLecturesList.filter((l) => l.course_id === courseId);
            return sendJson(200, { success: true, data: courseLectures, count: courseLectures.length });
          }

          const studentLecDownloadMatch = apiPath.match(/^\/lectures\/student\/([^/]+)\/download$/);
          if (studentLecDownloadMatch && req.method === 'GET') {
            const lecId = decodeURIComponent(studentLecDownloadMatch[1]);
            const lec = mockLecturesList.find((l) => l.id === lecId);
            if (!lec || !lec.file_url) return sendJson(404, { success: false, message: 'الملف غير موجود' });
            if (authUser.role === 'student' && !isStudentEnrolled(lec.course_id, authUser.id)) {
              return sendJson(403, { success: false, message: 'غير مصرح بتحميل هذه المحاضرة' });
            }
            const stored = mockUploadedFiles.get(lec.file_url);
            const buf = stored?.buffer || buildMinimalPdf(lec.file_name || lec.title);
            return sendFileDownload(lec.file_name || `${lec.id}.pdf`, buf, stored?.mimeType || 'application/pdf');
          }

          // ------------------------------------------------------------------
          // 10. SECURITY, REAL RFC 6238 2FA & SESSION REVOCATION
          // ------------------------------------------------------------------
          if ((apiPath === '/security/status' || apiPath === '/security') && req.method === 'GET') {
            return sendJson(200, {
              success: true,
              data: {
                twoFactorEnabled: Boolean(authUser.two_factor_enabled),
                two_factor_enabled: Boolean(authUser.two_factor_enabled),
                tokenVersion: authUser.token_version || 1,
                active_sessions_count: 1,
                last_login: new Date().toISOString(),
              },
            });
          }

          if (apiPath === '/security/2fa/generate' && req.method === 'POST') {
            const secret = base32Encode(crypto.randomBytes(16));
            const otpauthUrl = `otpauth://totp/Hadir:${authUser.email}?secret=${secret}&issuer=Hadir%20LMS`;
            const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 1 });
            return sendJson(200, {
              success: true,
              data: {
                qrCodeUrl,
                secret,
                email: authUser.email,
              },
            });
          }

          if ((apiPath === '/security/2fa/verify-and-enable' || apiPath.startsWith('/security/2fa/verify')) && req.method === 'POST') {
            const secret = String(body.secret || '').trim();
            const token = String(body.token || '').trim();
            if (!secret || !token) {
              return sendJson(400, { success: false, message: 'المفتاح السري وكود التحقق حقول مطلوبة' });
            }
            if (!verifyTOTP(secret, token)) {
              return sendJson(400, { success: false, message: 'رمز التحقق غير صحيح أو انتهت صلاحيته' });
            }
            authUser.two_factor_secret = secret;
            authUser.two_factor_enabled = true;
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم تفعيل المصادقة الثنائية (2FA) بنجاح لحماية حسابك!',
            });
          }

          if (apiPath === '/security/2fa/disable' && req.method === 'POST') {
            const password = String(body.password || '');
            if (!password) {
              return sendJson(400, { success: false, message: 'كلمة المرور مطلوبة لإلغاء تفعيل 2FA' });
            }
            if (authUser.password !== password) {
              return sendJson(400, { success: false, message: 'كلمة المرور الحالية غير صحيحة' });
            }
            authUser.two_factor_enabled = false;
            authUser.two_factor_secret = null;
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم إلغاء تفعيل المصادقة الثنائية بنجاح',
            });
          }

          if (apiPath === '/security/revoke-all-sessions' && req.method === 'POST') {
            authUser.token_version = (authUser.token_version || 1) + 1;
            saveSnapshot();
            return sendJson(200, {
              success: true,
              message: 'تم تسجيل الخروج بنجاح من كافة الأجهزة والمتصفحات الأخرى.',
            });
          }

          // ------------------------------------------------------------------
          // STRICT 404 FOR UNKNOWN /API ROUTES (NO FAKE 200 FALLBACK!)
          // ------------------------------------------------------------------
          return sendJson(404, { success: false, message: 'Route not found' });
        });
      });
    },
  };
}
