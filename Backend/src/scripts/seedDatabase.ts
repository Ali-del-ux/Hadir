import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

const DOMAIN = 'example.com';

const hash = async (pw: string) => bcrypt.hash(pw, 10);
const log  = (msg: string) => process.stdout.write(msg + '\n');

interface RawStudent {
  id: string;
  name: string;
  department: string;
  email?: string;
  academic_year?: string;
  is_frozen?: boolean;
  freeze_reason?: string;
  paid_amount?: number;
}

interface RawTeacher {
  code: string;
  name: string;
  subject: string;
  email?: string;
}

interface RawCourse {
  id: string;
  code: string;
  name: string;
  teacherCode: string;
  description?: string;
  credit_hours: number;
  room: string;
  schedule_day: string;
  schedule_time: string;
}

const STUDENTS: RawStudent[] = [
  { id: '2340033', name: 'علي بن طاهر', department: 'امن سيبراني', email: 'student1@test.com', academic_year: 'السنة الثالثة', paid_amount: 3500 },
  { id: '2450191', name: 'ابراهيم الزغيد', department: 'ذكاء اصطناعي', email: '2450191@student.edu', academic_year: 'السنة الثانية', paid_amount: 2000 },
  {
    id: '2450154',
    name: 'ابو القاسم الكوربو',
    department: 'امن سيبراني',
    email: '2450154@student.edu',
    academic_year: 'السنة الثانية',
    is_frozen: true,
    freeze_reason: 'تأخر سداد الأقساط الجامعية للفصل الحالي',
    paid_amount: 500,
  },
  { id: '2340068', name: 'احمد الثني', department: 'امن سيبراني', email: 'student2@test.com', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450076', name: 'احمد عريبي', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 3500 },
  { id: '2450051', name: 'ادم طالب', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2450124', name: 'امين شنبش', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340009', name: 'انس اللالي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 3500 },
  { id: '2450115', name: 'انس بن زيتون', department: 'ذكاء اصطناعي', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340013', name: 'سند لطيف', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340082', name: 'عبد الباري عبد الصمد', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 3500 },
  { id: '2340040', name: 'عبد الرحمن مازق', department: 'ذكاء اصطناعي', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340110', name: 'عبد المجيد المريض', department: 'ذكاء اصطناعي', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340033-B', name: 'فرج العربي', department: 'هندسة برمجيات', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450088', name: 'مراد سالم', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340004', name: 'مروان العمامي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450134', name: 'يزيد المداغي', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340035', name: 'عمر الجربي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340118', name: 'نفيسة ابورقيقة', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340045', name: 'ضياء المقهور', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340025', name: 'عبد الرحمن المجدوب', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340062', name: 'جاد الازرملى', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450136', name: 'روان الشكشوكي', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2450131', name: 'شهد المداغي', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340077', name: 'عبد الملك المرغني', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2230001', name: 'سيف الدين العريفي', department: 'امن سيبراني', academic_year: 'السنة الرابعة', paid_amount: 3500 },
  { id: '2450132', name: 'مريم السمراء', department: 'امن سيبراني', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340002', name: 'محمد القصبي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340056', name: 'حسن الكيب', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340093', name: 'يوسف البوعزي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340016', name: 'نادر البكوش', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340053', name: 'انس الجالي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450135', name: 'ريم الشكشوكي', department: 'هندسة برمجيات', academic_year: 'السنة الثانية', paid_amount: 1500 },
  { id: '2340112', name: 'انس فتحي', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2340088', name: 'اسامة القمبري', department: 'امن سيبراني', academic_year: 'السنة الثالثة', paid_amount: 1500 },
  { id: '2450185', name: 'تسنيم الخوجه', department: 'هندسة برمجيات', academic_year: 'السنة الثانية', paid_amount: 1500 },
];

const TEACHERS: RawTeacher[] = [
  { code: 'T0001', name: 'د. أحمد علي البشير', subject: 'أمن سيبراني وهندسة برمجيات', email: 'teacher@test.com' },
  { code: 'T0002', name: 'د. أسماء العصار', subject: 'شبكات وأمن معلومات', email: 'asmaa@university.edu' },
  { code: 'T0003', name: 'د. محمد الجهاني', subject: 'معمارية كمبيوتر', email: 'mohammedj@university.edu' },
  { code: 'T0004', name: 'حنان المركوس', subject: 'مقدمة في التشفير' },
  { code: 'T0005', name: 'الاء الزواوي', subject: 'علم بيانات' },
];

const COURSES: RawCourse[] = [
  {
    id: 'C001', code: 'CS-SWD', name: 'تصميم وهندسة برمجيات', teacherCode: 'T0001',
    description: 'مادة تصميم وهندسة البرمجيات', credit_hours: 3,
    room: 'قاعة الخوارزمي (204)', schedule_day: 'الأحد - الثلاثاء', schedule_time: '09:00 ص - 10:30 ص',
  },
  {
    id: 'C002', code: 'CS-NET', name: 'شبكات', teacherCode: 'T0002',
    description: 'أساسيات الشبكات والبروتوكولات', credit_hours: 3,
    room: 'قاعة 102', schedule_day: 'الاثنين - الأربعاء', schedule_time: '11:00 ص - 12:30 م',
  },
  {
    id: 'C003', code: 'CS-ARC', name: 'معمارية كمبيوتر', teacherCode: 'T0003',
    description: 'بنية وتنظيم الحاسوب', credit_hours: 3,
    room: 'مدرج 101', schedule_day: 'الأحد - الثلاثاء', schedule_time: '01:00 م - 02:30 م',
  },
  {
    id: 'C004', code: 'CS-CRY', name: 'مقدمة في التشفير', teacherCode: 'T0004',
    description: 'أساسيات التشفير وأمن المعلومات', credit_hours: 3,
    room: 'قاعة 205', schedule_day: 'الخميس', schedule_time: '10:00 ص - 01:00 م',
  },
  {
    id: 'C005', code: 'CS-DAT', name: 'علم بيانات', teacherCode: 'T0005',
    description: 'مقدمة في علم البيانات والإحصاء', credit_hours: 3,
    room: 'معمل البيانات (302)', schedule_day: 'الاثنين - الأربعاء', schedule_time: '02:00 م - 03:30 م',
  },
  {
    id: 'C006', code: 'SEC-400', name: 'أمن سيبراني', teacherCode: 'T0001',
    description: 'حماية الأنظمة والشبكات', credit_hours: 3,
    room: 'معمل الأمن السيبراني (301)', schedule_day: 'الثلاثاء - الخميس', schedule_time: '09:00 ص - 10:30 ص',
  },
  {
    id: 'C007', code: 'AI-ROB', name: 'أنظمة الروبوتات الذكية', teacherCode: 'T0005',
    description: 'مقدمة في الروبوتات والذكاء الاصطناعي', credit_hours: 3,
    room: 'معمل الذكاء الاصطناعي (401)', schedule_day: 'الأحد - الثلاثاء', schedule_time: '11:00 ص - 12:30 م',
  },
  {
    id: 'C008', code: 'SE-QA', name: 'اختبار البرمجيات وضمان الجودة', teacherCode: 'T0002',
    description: 'منهجيات اختبار البرمجيات وضمان الجودة', credit_hours: 3,
    room: 'قاعة 104', schedule_day: 'الأربعاء', schedule_time: '01:00 م - 04:00 م',
  },
];

const DEPT_COURSES: Record<string, string[]> = {
  'امن سيبراني':   ['C001', 'C002', 'C003', 'C004', 'C005', 'C006'],
  'ذكاء اصطناعي':  ['C001', 'C002', 'C003', 'C004', 'C005', 'C007'],
  'هندسة برمجيات': ['C001', 'C002', 'C003', 'C004', 'C005', 'C008'],
};

async function seedAdmins() {
  log('\n👑 Seeding admins…');
  const admins = [
    { username: 'admin', password: 'admin123' },
    { username: 'admin1', password: 'admin123' },
    { username: 'admin2', password: 'admin123' },
  ];
  for (const a of admins) {
    const pwHash = await hash(a.password);
    const [ex] = await pool.execute<any[]>('SELECT id FROM admin_accounts WHERE username=?', [a.username]);
    if (ex.length) {
      await pool.execute('UPDATE admin_accounts SET password_hash=?, is_active=1 WHERE id=?', [pwHash, ex[0].id]);
      log(`  🔄  updated admin: ${a.username}`);
    } else {
      await pool.execute(
        'INSERT INTO admin_accounts (username, password_hash, is_active) VALUES (?,?,1)',
        [a.username, pwHash]
      );
      log(`  ✅  admin: ${a.username}`);
    }
  }
}

async function seedTeachers() {
  log('\n🏫 Seeding teachers…');
  for (const t of TEACHERS) {
    const email = t.email || `${t.code}@${DOMAIN}`;
    const pw = 'password123';
    const pwHash = await hash(pw);

    const [ex] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE id=? OR email=?', [t.code, email]
    );
    if (ex.length) {
      await pool.execute(
        `UPDATE users SET name=?, email=?, password_hash=?, teacher_code=?, department=?, is_active=1 WHERE id=?`,
        [t.name, email, pwHash, t.code, t.subject, ex[0].id]
      );
      log(`  🔄  updated teacher: ${email}`);
    } else {
      await pool.execute(
        `INSERT INTO users (id, name, email, password_hash, role, teacher_code, department, is_active)
         VALUES (?,?,?,?,?,?,?,1)`,
        [t.code, t.name, email, pwHash, 'teacher', t.code, t.subject]
      );
      log(`  ✅  teacher: ${email} | pass: ${pw}`);
    }
  }
}

async function seedStudents() {
  log('\n🎓 Seeding students & financials…');
  const pwHash = await hash('password123');
  for (const s of STUDENTS) {
    const email = s.email || `${s.id}@${DOMAIN}`;
    const isFrozen = Boolean(s.is_frozen);
    const freezeReason = s.freeze_reason || null;

    const [ex] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE id=? OR email=?', [s.id, email]
    );
    if (ex.length) {
      await pool.execute(
        `UPDATE users SET name=?, email=?, password_hash=?, student_id=?, department=?, academic_year=?, is_active=1, is_frozen=?, freeze_reason=? WHERE id=?`,
        [s.name, email, pwHash, s.id, s.department, s.academic_year || 'السنة الثالثة', isFrozen, freezeReason, ex[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO users (id, name, email, password_hash, role, student_id, department, academic_year, is_active, is_frozen, freeze_reason)
         VALUES (?,?,?,?,?,?,?,?,1,?,?)`,
        [s.id, s.name, email, pwHash, 'student', s.id, s.department, s.academic_year || 'السنة الثالثة', isFrozen, freezeReason]
      );
      log(`  ✅  student: ${email} (${s.id}) | pass: password123${isFrozen ? ' [FROZEN]' : ''}`);
    }

    // Upsert student_financials row
    const totalTuition = 3500.00;
    const paidAmount = s.paid_amount !== undefined ? s.paid_amount : 1500.00;
    const finStatus = paidAmount >= totalTuition ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    await pool.execute(
      `INSERT INTO student_financials (student_id, student_name, student_number, total_tuition, paid_amount, discount, status, is_frozen, freeze_reason)
       VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         student_name = VALUES(student_name),
         student_number = VALUES(student_number),
         total_tuition = VALUES(total_tuition),
         paid_amount = VALUES(paid_amount),
         status = VALUES(status),
         is_frozen = VALUES(is_frozen),
         freeze_reason = VALUES(freeze_reason)`,
      [s.id, s.name, s.id, totalTuition, paidAmount, finStatus, isFrozen, freezeReason]
    );
  }
}

async function seedCoursesAndGradeItems() {
  log('\n📚 Seeding courses & grade items…');
  for (const c of COURSES) {
    const [ex] = await pool.execute<any[]>(
      'SELECT id FROM courses WHERE id=? OR code=?', [c.id, c.code]
    );
    if (ex.length) {
      await pool.execute(
        `UPDATE courses SET name=?, teacher_id=?, description=?, credit_hours=?, room=?, schedule_day=?, schedule_time=? WHERE id=?`,
        [c.name, c.teacherCode, c.description ?? null, c.credit_hours, c.room, c.schedule_day, c.schedule_time, ex[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO courses (id, code, name, teacher_id, description, credit_hours, room, schedule_day, schedule_time)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [c.id, c.code, c.name, c.teacherCode, c.description ?? null, c.credit_hours, c.room, c.schedule_day, c.schedule_time]
      );
      log(`  ✅  course: ${c.code} – ${c.name}`);
    }

    // Seed default grade items if course has none
    const [existingItems] = await pool.execute<any[]>(
      'SELECT id FROM course_grade_items WHERE course_id=?', [c.id]
    );
    if (existingItems.length === 0) {
      const defaults = [
        { name: 'الحضور والالتزام', category: 'attendance', weight: 10, max_score: 100 },
        { name: 'الواجبات والتكليفات', category: 'assignments', weight: 20, max_score: 100 },
        { name: 'الامتحان النصفي', category: 'midterm', weight: 30, max_score: 100 },
        { name: 'الامتحان النهائي', category: 'final', weight: 40, max_score: 100 },
      ];
      for (const item of defaults) {
        await pool.execute(
          `INSERT INTO course_grade_items (course_id, name, category, weight, max_score) VALUES (?,?,?,?,?)`,
          [c.id, item.name, item.category, item.weight, item.max_score]
        );
      }
    }
  }
}

async function seedEnrollments() {
  log('\n📝 Seeding enrollments…');
  let count = 0;
  for (const s of STUDENTS) {
    const courseIds = DEPT_COURSES[s.department] ?? [];
    for (const cid of courseIds) {
      const [ex] = await pool.execute<any[]>(
        'SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [cid, s.id]
      );
      if (ex.length) continue;

      const [courseEx] = await pool.execute<any[]>('SELECT id FROM courses WHERE id=?', [cid]);
      const [studentEx] = await pool.execute<any[]>('SELECT id FROM users WHERE id=?', [s.id]);
      if (!courseEx.length || !studentEx.length) continue;

      await pool.execute(
        "INSERT INTO enrollments (course_id, student_id, status) VALUES (?,?,'active')",
        [cid, s.id]
      );
      count++;
    }
  }
  log(`  ✅  ${count} enrollments created`);
}

export async function runSeed(): Promise<void> {
  log('🌱 Starting consolidated database seed…\n');
  await seedAdmins();
  await seedTeachers();
  await seedStudents();
  await seedCoursesAndGradeItems();
  await seedEnrollments();

  log('\n✅  Seed complete!\n');
  log('─────────────────────────────────────────');
  log('📋  Demo & Multi-User Login Credentials:');
  log('  Admin:    admin (or admin@hadir.edu) / admin123');
  log('  Teacher1: teacher@test.com (T0001) / password123');
  log('  Teacher2: asmaa@university.edu (T0002) / password123');
  log('  Teacher3: mohammedj@university.edu (T0003) / password123');
  log('  Student1: student1@test.com (2340033) / password123');
  log('  Student2: 2450191@student.edu (2450191) / password123');
  log('  Student3: 2450154@student.edu (2450154) / password123 [FROZEN]');
  log('─────────────────────────────────────────');
}

async function main() {
  try {
    await runSeed();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
