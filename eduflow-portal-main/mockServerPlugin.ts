import type { Plugin, ViteDevServer } from 'vite';

// In-memory stateful store for academic users and financial records
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
    freeze_reason: null,
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
    freeze_reason: null,
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
    last_payment_date: null,
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
    freeze_reason: null,
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
    freeze_reason: null,
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
    last_payment_date: null,
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
    freeze_reason: null,
    last_payment_date: '2026-10-20',
  }
];

let mockUsersList = [
  { id: 'usr-1', name: 'علي بن طاهر', email: 'student1@test.com', role: 'student', student_id: '2340033', studentId: '2340033', department: 'أمن سيبراني', is_active: 1, is_frozen: 0 },
  { id: 'usr-2', name: 'إبراهيم الزغيد', email: '2450191@student.edu', role: 'student', student_id: '2450191', studentId: '2450191', department: 'ذكاء اصطناعي', is_active: 1, is_frozen: 0 },
  { id: 'usr-3', name: 'أبو القاسم الكوربو', email: '2450154@student.edu', role: 'student', student_id: '2450154', studentId: '2450154', department: 'أمن سيبراني', is_active: 1, is_frozen: 1, freeze_reason: 'تأخر مالي' },
  { id: 'usr-4', name: 'أحمد الثني', email: '2340068@student.edu', role: 'student', student_id: '2340068', studentId: '2340068', department: 'هندسة برمجيات', is_active: 1, is_frozen: 0 },
  { id: 'usr-5', name: 'سارة محمود الشريف', email: 'sara@student.edu', role: 'student', student_id: '2340088', studentId: '2340088', department: 'علم بيانات', is_active: 1, is_frozen: 0 },
  { id: 'usr-6', name: 'محمد طارق الفيتوري', email: 'mtariq@student.edu', role: 'student', student_id: '2340092', studentId: '2340092', department: 'أمن سيبراني', is_active: 1, is_frozen: 1, freeze_reason: 'إيقاف إداري' },
  { id: 'usr-7', name: 'فاطمة عمر الورفلي', email: 'fatima@student.edu', role: 'student', student_id: '2340105', studentId: '2340105', department: 'علوم حاسوب', is_active: 1, is_frozen: 0 },
  { id: 'usr-8', name: 'د. أحمد علي البشير', email: 'teacher@test.com', role: 'teacher', teacher_code: 'TCH-001', department: 'أمن سيبراني', is_active: 1 },
  { id: 'usr-9', name: 'د. أسماء العصار', email: 'asmaa@university.edu', role: 'teacher', teacher_code: 'TCH-002', department: 'هندسة برمجيات', is_active: 1 },
  { id: 'usr-10', name: 'د. محمد الجهاني', email: 'mohammedj@university.edu', role: 'teacher', teacher_code: 'TCH-003', department: 'علوم حاسوب', is_active: 1 },
  { id: 'usr-11', name: 'د. حذيفة غولة', email: 'huthaifa@university.edu', role: 'teacher', teacher_code: 'TCH-004', department: 'شبكات', is_active: 1 },
  { id: 'usr-12', name: 'د. آلاء الزواوي', email: 'alaa@university.edu', role: 'teacher', teacher_code: 'TCH-005', department: 'علم بيانات', is_active: 1 },
  { id: 'usr-13', name: 'مدير النظام الأكاديمي', email: 'admin@hadir.edu', role: 'admin', department: 'عمادة القبول والتسجيل', is_active: 1 }
];

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

        const [pathname] = url.split('?');
        const apiPath = pathname.replace(/^\/api/, '');

        let bodyBuffer = '';
        req.on('data', chunk => {
          bodyBuffer += chunk;
        });

        req.on('end', () => {
          let body: any = {};
          if (bodyBuffer) {
            try {
              body = JSON.parse(bodyBuffer);
            } catch (e) {
              body = {};
            }
          }

          const authHeader = req.headers['authorization'] || '';
          let currentRole = 'student';
          if (authHeader.includes('admin')) {
            currentRole = 'admin';
          } else if (authHeader.includes('teacher')) {
            currentRole = 'teacher';
          }

          // 1. AUTH LOGIN
          if (apiPath === '/auth/login' && req.method === 'POST') {
            const id = (body.identifier || '').toLowerCase();
            if (id.includes('admin')) {
              return sendJson(200, {
                success: true,
                token: 'mock-token-admin-jwt-2026',
                refreshToken: 'mock-refresh-token',
                user: {
                  id: 'admin_1',
                  name: 'مدير النظام الأكاديمي',
                  email: 'admin@hadir.edu',
                  role: 'admin',
                  department: 'عمادة القبول والتسجيل',
                  avatar: null,
                }
              });
            } else if (id.includes('teacher') || id.includes('ahmed') || id.includes('0001')) {
              return sendJson(200, {
                success: true,
                token: 'mock-token-teacher-jwt-2026',
                refreshToken: 'mock-refresh-token',
                user: {
                  id: 'teacher_1',
                  name: 'د. أحمد علي البشير',
                  email: 'teacher@test.com',
                  role: 'teacher',
                  teacher_code: 'TCH-2026',
                  department: 'أمن المعلومات والحاسوب',
                  avatar: null,
                }
              });
            } else {
              return sendJson(200, {
                success: true,
                token: 'mock-token-student-jwt-2026',
                refreshToken: 'mock-refresh-token',
                user: {
                  id: 'student_2340033',
                  name: 'علي بي',
                  email: 'student1@test.com',
                  role: 'student',
                  student_id: '2340033',
                  department: 'أمن سيبراني',
                  avatar: null,
                  is_frozen: false,
                  freeze_reason: null,
                }
              });
            }
          }

          // 2. AUTH ME
          if (apiPath === '/auth/me') {
            if (currentRole === 'admin') {
              return sendJson(200, {
                success: true,
                user: {
                  id: 'admin_1',
                  name: 'مدير النظام الأكاديمي',
                  email: 'admin@hadir.edu',
                  role: 'admin',
                  department: 'عمادة القبول والتسجيل',
                }
              });
            } else if (currentRole === 'teacher') {
              return sendJson(200, {
                success: true,
                user: {
                  id: 'teacher_1',
                  name: 'د. أحمد علي البشير',
                  email: 'teacher@test.com',
                  role: 'teacher',
                  teacher_code: 'TCH-2026',
                  department: 'أمن المعلومات والحاسوب',
                }
              });
            } else {
              return sendJson(200, {
                success: true,
                user: {
                  id: 'student_2340033',
                  name: 'علي بي',
                  email: 'student1@test.com',
                  role: 'student',
                  student_id: '2340033',
                  department: 'أمن سيبراني',
                  is_frozen: false,
                }
              });
            }
          }

          // 3. COURSES (Student & Teacher)
          const allCourses = [
            {
              id: 'crs-1',
              code: 'SEC-401',
              name: 'أمن الشبكات والتشفير المتقدم',
              teacher_name: 'د. أحمد علي البشير',
              teacher_department: 'أمن سيبراني',
              credit_hours: 3,
              students_count: 38,
              lectures_count: 14,
              schedule_day: 'الأحد - الثلاثاء',
              schedule_time: '10:00 - 11:30 صباحاً',
              room: 'قاعة إدوارد سنودن - مدرج 101',
              description: 'دراسة المعايير المتقدمة للأمن السيبراني، خوارزميات التشفير وفحص الاختراق الأخلاقي.'
            },
            {
              id: 'crs-2',
              code: 'CS-302',
              name: 'معمارية الحاسوب والأنظمة الموزعة',
              teacher_name: 'د. محمد الجهاني',
              teacher_department: 'علوم حاسوب',
              credit_hours: 3,
              students_count: 42,
              lectures_count: 12,
              schedule_day: 'الإثنين - الأربعاء',
              schedule_time: '12:00 - 01:30 ظهراً',
              room: 'مختبر المعالجات الدقيقة - معمل 2',
              description: 'تحليل بنية المعالجات، الذاكرة المخبأة، وخطوط المعالجة الفائقة.'
            },
            {
              id: 'crs-3',
              code: 'SE-305',
              name: 'تصميم وهندسة البرمجيات الآمنة',
              teacher_name: 'د. أسماء العصار',
              teacher_department: 'هندسة برمجيات',
              credit_hours: 3,
              students_count: 35,
              lectures_count: 15,
              schedule_day: 'الخميس',
              schedule_time: '09:00 - 12:00 ظهراً',
              room: 'قاعة الخوارزمي - مبنى التقنية',
              description: 'أنماط التصميم المعماري، مراجعة الشيفرات البرمجية، وتطبيق ممارسات DevSecOps.'
            },
            {
              id: 'crs-4',
              code: 'AI-301',
              name: 'علم البيانات وتعلم الآلة التطبيقي',
              teacher_name: 'د. آلاء الزواوي',
              teacher_department: 'ذكاء اصطناعي',
              credit_hours: 3,
              students_count: 40,
              lectures_count: 10,
              schedule_day: 'الأحد - الثلاثاء',
              schedule_time: '01:30 - 03:00 مساءً',
              room: 'مختبر الذكاء الاصطناعي - قاعة 4',
              description: 'بناء النماذج الذكية التنبؤية باستخدام مكتبات Scikit-Learn و PyTorch.'
            }
          ];

          if (apiPath === '/courses/student' || apiPath === '/courses') {
            return sendJson(200, { success: true, data: allCourses });
          }

          if (apiPath === '/courses/teacher') {
            return sendJson(200, { success: true, data: [allCourses[0], allCourses[2]] });
          }

          // 4. REPORTS & GPA
          if (apiPath === '/reports/student' || apiPath === '/grades/student/gpa') {
            return sendJson(200, {
              success: true,
              data: {
                gpa: 3.88,
                totalCredits: 18,
                gradedCredits: 15,
                enrolledCourses: 4,
                attendanceRate: 97.4,
                academic_status: 'ممتاز مع مرتبة الشرف (الأول على الدفعة)',
                courses: [
                  {
                    id: 'crs-1',
                    name: 'أمن الشبكات والتشفير المتقدم',
                    code: 'SEC-401',
                    creditHours: 3,
                    attendancePercentage: 100,
                    finalGrade: 'A+',
                    totalScore: 97,
                    letterGrade: 'A+',
                    gradePoints: 4.0,
                    total_lectures: 14,
                    attended_lectures: 14,
                  },
                  {
                    id: 'crs-2',
                    name: 'معمارية الحاسوب والأنظمة الموزعة',
                    code: 'CS-302',
                    creditHours: 3,
                    attendancePercentage: 92.5,
                    finalGrade: 'A',
                    totalScore: 92,
                    letterGrade: 'A',
                    gradePoints: 3.75,
                    total_lectures: 12,
                    attended_lectures: 11,
                  },
                  {
                    id: 'crs-3',
                    name: 'تصميم وهندسة البرمجيات الآمنة',
                    code: 'SE-305',
                    creditHours: 3,
                    attendancePercentage: 100,
                    finalGrade: 'A+',
                    totalScore: 98,
                    letterGrade: 'A+',
                    gradePoints: 4.0,
                    total_lectures: 15,
                    attended_lectures: 15,
                  },
                  {
                    id: 'crs-4',
                    name: 'علم البيانات وتعلم الآلة التطبيقي',
                    code: 'AI-301',
                    creditHours: 3,
                    attendancePercentage: 96.0,
                    finalGrade: 'A',
                    totalScore: 90,
                    letterGrade: 'A',
                    gradePoints: 3.75,
                    total_lectures: 10,
                    attended_lectures: 9,
                  }
                ]
              }
            });
          }

          if (apiPath === '/reports/teacher') {
            return sendJson(200, {
              success: true,
              data: {
                totalCourses: 2,
                totalStudents: 73,
                averageAttendance: 96.4,
                courses: [
                  { id: 'crs-1', name: 'أمن الشبكات والتشفير المتقدم', code: 'SEC-401' },
                  { id: 'crs-3', name: 'تصميم وهندسة البرمجيات الآمنة', code: 'SE-305' }
                ]
              }
            });
          }

          if (apiPath.startsWith('/reports/teacher/course/')) {
            return sendJson(200, {
              success: true,
              data: {
                courseId: 'crs-1',
                courseName: 'أمن الشبكات والتشفير المتقدم',
                students: [
                  { id: 'usr-1', name: 'علي بي', student_id: '2340033', attended_count: 14, total_lectures: 14, attendance_rate: 100, finalGrade: 'A+', attendanceOverride: 0 },
                  { id: 'usr-2', name: 'إبراهيم الزغيد', student_id: '2450191', attended_count: 13, total_lectures: 14, attendance_rate: 92.8, finalGrade: 'A', attendanceOverride: 0 },
                  { id: 'usr-3', name: 'أحمد الثني', student_id: '2340068', attended_count: 14, total_lectures: 14, attendance_rate: 100, finalGrade: 'A+', attendanceOverride: 0 },
                  { id: 'usr-4', name: 'أحمد عريبي', student_id: '2450076', attended_count: 12, total_lectures: 14, attendance_rate: 85.7, finalGrade: 'B+', attendanceOverride: 0 }
                ]
              }
            });
          }

          // 5. GRADEBOOK (Teacher Moodle 4.0 standard)
          if (apiPath.includes('/gradebook') || apiPath.startsWith('/grades/course/')) {
            return sendJson(200, {
              success: true,
              data: {
                course: {
                  id: 'crs-1',
                  name: 'أمن الشبكات والتشفير المتقدم',
                  code: 'SEC-401',
                  credit_hours: 3,
                },
                totalSessions: 14,
                gradeItems: [
                  { id: 1, course_id: 'crs-1', name: 'الحضور والالتزام الأكاديمي', category: 'attendance', weight: 10, max_score: 100 },
                  { id: 2, course_id: 'crs-1', name: 'الواجبات والتكليفات العملية', category: 'assignments', weight: 20, max_score: 100 },
                  { id: 3, course_id: 'crs-1', name: 'الامتحان النصفي (Midterm)', category: 'midterm', weight: 30, max_score: 100 },
                  { id: 4, course_id: 'crs-1', name: 'الامتحان النهائي والشفوي', category: 'final', weight: 40, max_score: 100 },
                ],
                students: [
                  {
                    studentId: 'usr-1',
                    studentName: 'علي بي',
                    studentNumber: '2340033',
                    attendancePercentage: 100,
                    scores: { 1: 100, 2: 98, 3: 95, 4: 97 },
                    totalScore: 97.2,
                    letterGrade: 'A+',
                    gradePoints: 4.0,
                  },
                  {
                    studentId: 'usr-2',
                    studentName: 'إبراهيم الزغيد',
                    studentNumber: '2450191',
                    attendancePercentage: 92.8,
                    scores: { 1: 90, 2: 88, 3: 85, 4: 90 },
                    totalScore: 88.3,
                    letterGrade: 'B+',
                    gradePoints: 3.5,
                  },
                  {
                    studentId: 'usr-3',
                    studentName: 'أحمد الثني',
                    studentNumber: '2340068',
                    attendancePercentage: 100,
                    scores: { 1: 100, 2: 92, 3: 90, 4: 94 },
                    totalScore: 93.6,
                    letterGrade: 'A',
                    gradePoints: 3.75,
                  }
                ]
              }
            });
          }

          // 6. FINANCIALS (Student & Admin)
          if (apiPath === '/financials/my-status') {
            return sendJson(200, {
              success: true,
              data: {
                student_id: '2340033',
                student_name: 'علي بي',
                total_tuition: 3500.0,
                paid_amount: 3500.0,
                remaining_amount: 0.0,
                status: 'paid',
                is_frozen: false,
                freeze_reason: null,
                last_payment_date: '2026-10-25T11:00:00Z',
                transactions: [
                  {
                    id: 101,
                    amount: 2000.0,
                    receipt_number: 'REC-2026-0941',
                    payment_method: 'حوالة مصرفية (مصرف الأمان)',
                    created_at: '2026-09-10T09:30:00Z',
                    notes: 'القسط الدراسي الأول - بداية العام'
                  },
                  {
                    id: 102,
                    amount: 1500.0,
                    receipt_number: 'REC-2026-1185',
                    payment_method: 'سداد نقدي مباشر للخزينة',
                    created_at: '2026-10-25T11:00:00Z',
                    notes: 'تسوية القسط الثاني وإغلاق الرصيد كاملاً'
                  }
                ]
              }
            });
          }

          // 6.2 FINANCIAL SUMMARY
          if (apiPath === '/financials/summary') {
            const totalExpected = mockFinancialStudents.reduce((sum, s) => sum + s.total_tuition, 0);
            const totalCollected = mockFinancialStudents.reduce((sum, s) => sum + s.paid_amount, 0);
            const frozenCount = mockFinancialStudents.filter(s => s.is_frozen).length;

            return sendJson(200, {
              success: true,
              data: {
                totalRevenue: totalExpected,
                collectedAmount: totalCollected,
                outstandingAmount: Math.max(0, totalExpected - totalCollected),
                collectionRate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0,
                totalExpected,
                totalCollected,
                totalDebt: Math.max(0, totalExpected - totalCollected),
                frozenCount
              }
            });
          }

          // 6.3 ADMIN FINANCIALS ACTIONS & LIST
          if (apiPath === '/admin/financials/freeze' && req.method === 'POST') {
            const studentId = body.student_id;
            const student = mockFinancialStudents.find(s => s.student_id === studentId || s.student_number === studentId);
            if (student) {
              student.is_frozen = true;
              student.freeze_reason = body.reason || 'تجميد إداري ومالي لمراجعة الأقساط المتأخرة';
            }
            return sendJson(200, {
              success: true,
              message: 'تم تجميد حساب الطالب بنجاح وحظر تسجيل الحضور',
              data: student
            });
          }

          if (apiPath === '/admin/financials/unfreeze' && req.method === 'POST') {
            const studentId = body.student_id;
            const student = mockFinancialStudents.find(s => s.student_id === studentId || s.student_number === studentId);
            if (student) {
              student.is_frozen = false;
              student.freeze_reason = null;
            }
            return sendJson(200, {
              success: true,
              message: 'تم فك تجميد حساب الطالب بنجاح وإعادة تفعيل الصلاحيات',
              data: student
            });
          }

          if (apiPath === '/admin/financials/payment' && req.method === 'POST') {
            const studentId = body.student_id;
            const student = mockFinancialStudents.find(s => s.student_id === studentId || s.student_number === studentId);
            if (student) {
              const amount = Number(body.amount || 0);
              student.paid_amount += amount;
              student.remaining_amount = Math.max(0, student.total_tuition - student.paid_amount);
              student.status = student.remaining_amount <= 0 ? 'paid' : 'partial';
              student.last_payment_date = new Date().toISOString().split('T')[0];
            }
            return sendJson(200, {
              success: true,
              message: 'تم تسجيل إيصال القبض وسداد القسط المالي بنجاح',
              data: student
            });
          }

          if (apiPath === '/admin/financials/reset-password' && req.method === 'POST') {
            const tempPassword = body.new_password || `Hadir@${Math.floor(1000 + Math.random() * 9000)}`;
            return sendJson(200, {
              success: true,
              message: 'تمت إعادة تعيين كلمة المرور بنجاح للمستخدم',
              data: {
                temporaryPassword: tempPassword
              }
            });
          }

          if (apiPath === '/admin/financials') {
            const totalExpected = mockFinancialStudents.reduce((sum, s) => sum + s.total_tuition, 0);
            const totalCollected = mockFinancialStudents.reduce((sum, s) => sum + s.paid_amount, 0);
            const frozenCount = mockFinancialStudents.filter(s => s.is_frozen).length;

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
              }
            });
          }

          // 7. ADMIN STATS
          if (apiPath === '/admin/stats') {
            const frozenCount = mockFinancialStudents.filter(s => s.is_frozen).length;
            const studentsCount = mockUsersList.filter(u => u.role === 'student').length;
            const teachersCount = mockUsersList.filter(u => u.role === 'teacher').length;
            const adminsCount = mockUsersList.filter(u => u.role === 'admin').length;

            return sendJson(200, {
              success: true,
              data: {
                students: studentsCount,
                teachers: teachersCount,
                courses: 4,
                admins: adminsCount,
                totalStudents: studentsCount,
                totalTeachers: teachersCount,
                totalCourses: 4,
                todayAttendanceRate: 96.2,
                activeSessionsCount: 6,
                frozenAccountsCount: frozenCount,
                weeklyRegistrations: [45, 60, 75, 90, 85, 70, 95]
              }
            });
          }

          // 8. ADMIN USERS (With search & role filtering & CRUD)
          if (apiPath.startsWith('/admin/users')) {
            const parsedUrl = new URL(url, 'http://localhost');
            const roleParam = parsedUrl.searchParams.get('role');
            const searchParam = parsedUrl.searchParams.get('search');
            const userId = apiPath.replace('/admin/users', '').replace(/^\//, '').split('/')[0];

            if (req.method === 'POST') {
              if (apiPath.includes('/password')) {
                return sendJson(200, {
                  success: true,
                  message: 'تم تغيير كلمة المرور بنجاح'
                });
              }
              const newUser = {
                id: `usr-${Date.now()}`,
                name: body.name || 'مستخدم جديد',
                email: body.email || `user${Date.now()}@hadir.edu`,
                role: body.role || 'student',
                student_id: body.student_id || body.studentId || (body.role === 'student' ? `2340${Math.floor(100 + Math.random() * 900)}` : undefined),
                studentId: body.student_id || body.studentId,
                teacher_code: body.teacher_code || (body.role === 'teacher' ? `TCH-${Math.floor(100 + Math.random() * 900)}` : undefined),
                department: body.department || 'علوم الحاسوب',
                is_active: 1,
                is_frozen: 0,
              };
              mockUsersList.unshift(newUser);
              return sendJson(201, {
                success: true,
                message: 'تم إنشاء المستخدم بنجاح',
                data: newUser
              });
            }

            if (req.method === 'PUT' && userId) {
              const idx = mockUsersList.findIndex(u => u.id === userId);
              if (idx !== -1) {
                mockUsersList[idx] = { ...mockUsersList[idx], ...body };
              }
              return sendJson(200, {
                success: true,
                message: 'تم تحديث بيانات المستخدم بنجاح',
                data: mockUsersList[idx] || body
              });
            }

            if (req.method === 'DELETE' && userId) {
              mockUsersList = mockUsersList.filter(u => u.id !== userId);
              return sendJson(200, {
                success: true,
                message: 'تم حذف المستخدم بنجاح'
              });
            }

            // GET list with filtering
            let filtered = [...mockUsersList];
            if (roleParam && roleParam !== 'all') {
              filtered = filtered.filter(u => u.role === roleParam);
            }
            if (searchParam && searchParam.trim()) {
              const q = searchParam.trim().toLowerCase();
              filtered = filtered.filter(u =>
                (u.name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.student_id || u.studentId || '').includes(q) ||
                (u.teacher_code || '').toLowerCase().includes(q) ||
                (u.department || '').toLowerCase().includes(q)
              );
            }

            return sendJson(200, {
              success: true,
              data: filtered,
              count: filtered.length
            });
          }

          // 9. ADMIN COURSES
          if (apiPath.startsWith('/admin/courses')) {
            return sendJson(200, {
              success: true,
              data: [
                { id: 'crs-1', code: 'SEC-401', name: 'أمن الشبكات والتشفير المتقدم', teacher_name: 'د. أحمد علي البشير', room: 'قاعة إدوارد سنودن - مدرج 101', schedule_day: 'الأحد - الثلاثاء', schedule_time: '10:00 - 11:30', students_count: 38 },
                { id: 'crs-2', code: 'CS-302', name: 'معمارية الحاسوب والأنظمة الموزعة', teacher_name: 'د. محمد الجهاني', room: 'مختبر المعالجات الدقيقة - معمل 2', schedule_day: 'الإثنين - الأربعاء', schedule_time: '12:00 - 01:30', students_count: 42 },
                { id: 'crs-3', code: 'SE-305', name: 'تصميم وهندسة البرمجيات الآمنة', teacher_name: 'د. أسماء العصار', room: 'قاعة الخوارزمي - مبنى التقنية', schedule_day: 'الخميس', schedule_time: '09:00 - 12:00', students_count: 35 },
                { id: 'crs-4', code: 'AI-301', name: 'علم البيانات وتعلم الآلة التطبيقي', teacher_name: 'د. آلاء الزواوي', room: 'مختبر الذكاء الاصطناعي - قاعة 4', schedule_day: 'الأحد - الثلاثاء', schedule_time: '01:30 - 03:00', students_count: 40 }
              ]
            });
          }

          // 10. ATTENDANCE SESSIONS & TEACHER/STUDENT CHECK-IN
          if (apiPath.startsWith('/attendance/student/sessions/active') || apiPath.startsWith('/attendance/student/active')) {
            return sendJson(200, {
              success: true,
              data: [
                {
                  id: 'ses-101',
                  course_name: 'أمن الشبكات والتشفير المتقدم',
                  course_code: 'SEC-401',
                  teacher_name: 'د. أحمد علي البشير',
                  room: 'قاعة إدوارد سنودن - مدرج 101',
                  status: 'active'
                }
              ]
            });
          }

          if (apiPath === '/attendance/teacher/sessions/active') {
            return sendJson(200, {
              success: true,
              data: [
                {
                  id: 'ses-101',
                  course_id: 'crs-1',
                  course_name: 'أمن الشبكات والتشفير المتقدم',
                  course_code: 'SEC-401',
                  date: new Date().toISOString().split('T')[0],
                  time: '10:00',
                  qr_code: 'HADIR-AUTH-QR-SEC401-20SEC-TOKEN-V2.1',
                  status: 'active',
                  created_by: 'teacher_1',
                  created_at: new Date().toISOString(),
                  closed_at: null,
                  attendees_count: 31
                }
              ]
            });
          }

          if (apiPath.startsWith('/attendance/teacher/sessions')) {
            if (apiPath.includes('/live-qr')) {
              return sendJson(200, {
                success: true,
                data: {
                  qr_code: 'HADIR-DYNAMIC-HMAC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                  remaining_seconds: 20
                }
              });
            }
            if (apiPath.includes('/attendees')) {
              return sendJson(200, {
                success: true,
                data: [
                  { student_id: '2340033', name: 'علي بي', check_in_time: '10:02:15', status: 'present' },
                  { student_id: '2450191', name: 'إبراهيم الزغيد', check_in_time: '10:03:40', status: 'present' },
                  { student_id: '2340068', name: 'أحمد الثني', check_in_time: '10:04:12', status: 'present' }
                ]
              });
            }
            return sendJson(200, {
              success: true,
              data: [
                {
                  id: 'ses-101',
                  course_id: 'crs-1',
                  course_name: 'أمن الشبكات والتشفير المتقدم',
                  course_code: 'SEC-401',
                  date: new Date().toISOString().split('T')[0],
                  time: '10:00',
                  qr_code: 'HADIR-AUTH-QR-SEC401-20SEC-TOKEN-V2.1',
                  status: 'active',
                  created_by: 'teacher_1',
                  created_at: new Date().toISOString(),
                  closed_at: null,
                  attendees_count: 31
                },
                {
                  id: 'ses-100',
                  course_id: 'crs-1',
                  course_name: 'أمن الشبكات والتشفير المتقدم',
                  course_code: 'SEC-401',
                  date: '2026-11-03',
                  time: '10:00',
                  qr_code: 'CLOSED_QR_SESSION_100',
                  status: 'closed',
                  created_by: 'teacher_1',
                  created_at: '2026-11-03T10:00:00Z',
                  closed_at: '2026-11-03T11:30:00Z',
                  attendees_count: 36
                }
              ]
            });
          }

          // 11. ASSIGNMENTS
          if (apiPath.startsWith('/assignments')) {
            return sendJson(200, {
              success: true,
              data: [
                {
                  id: 'asg-1',
                  course_id: 'crs-1',
                  course_name: 'أمن الشبكات والتشفير المتقدم',
                  course_code: 'SEC-401',
                  title: 'تحليل ثغرات واختبار حقن البيانات (SQLi & XSS Lab)',
                  description: 'تطبيق عملي لاكتشاف وسد ثغرات التحقق وفحص كفاءة Sanitization في بيئة تجريبية.',
                  due_date: '2026-11-20T23:59:00Z',
                  max_score: 100,
                  submissions_count: 34,
                  status: 'submitted',
                  grade: 98,
                  feedback: 'تنفيذ ممتاز وتغطية شاملة لكافة محاور الدفاع المتقدم.'
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
                  submissions_count: 28,
                  status: 'pending',
                  grade: null,
                  feedback: null
                }
              ]
            });
          }

          // 12. LECTURES
          if (apiPath.startsWith('/lectures')) {
            return sendJson(200, {
              success: true,
              data: [
                {
                  id: 'lec-1',
                  course_id: 'crs-1',
                  title: 'المحاضرة 1: مقدمة في هندسة التشفير المتماثل وغير المتماثل',
                  description: 'استعراض خوارزميات AES-256 و RSA-4096 والتحقق الرقمي.',
                  file_url: '/uploads/lecture1-cryptography.pdf',
                  file_name: 'lecture1-cryptography.pdf',
                  created_at: '2026-10-10'
                },
                {
                  id: 'lec-2',
                  course_id: 'crs-1',
                  title: 'المحاضرة 2: بروتوكول TLS 1.3 وسلسلة الشهادات الرقمية PKI',
                  description: 'آلية عمل Handshake وحماية حركة البيانات من هجمات MITM.',
                  file_url: '/uploads/lecture2-tls-pki.pdf',
                  file_name: 'lecture2-tls-pki.pdf',
                  created_at: '2026-10-18'
                }
              ]
            });
          }

          // 13. SECURITY STATUS
          if (apiPath.startsWith('/security')) {
            return sendJson(200, {
              success: true,
              data: {
                two_factor_enabled: false,
                active_sessions_count: 2,
                last_login: new Date().toISOString(),
                audit_score: 'A+ (100% OWASP Compliance)'
              }
            });
          }

          // Default fallback
          return sendJson(200, { success: true, message: 'نجاح العملية', data: [] });
        });
      });
    }
  };
}
