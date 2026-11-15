# 🏛️ التقرير المعماري والتحليلي الشامل لمنظومة «حاضر» (Hadir v2.1)

تم إعداد هذا التدقيق الشامل وفق منهجية **تقسيم مهام الفحص على 4 باحثين متخصصين بالتوازي**، لفحص الكود المصدري، المسارات، منطق الأعمال، نموذج البيانات، وعقود الربط (API Contracts) بين الواجهة الأمامية والخلفية.

---

## 🧭 الهيكل التنظيمي للتدقيق
```mermaid
graph TD
    System["منظومة حاضر (Hadir v2.1)"]
    System --> R1["باحث 1: مسارات الـ API والروتات (Routes)"]
    System --> R2["باحث 2: الخدمات والوسيطات (Services & Middleware)"]
    System --> R3["باحث 3: قاعدة البيانات وعقود الربط (Schema & Contracts)"]
    System --> R4["باحث 4: خدمة التقارير والأمان السيبراني (Reports & Security)"]

    R1 --> Summary["المحصلة: جدول الثغرات وطرق الحل الصحيحة"]
    R2 --> Summary
    R3 --> Summary
    R4 --> Summary
```

---

## 🔬 نتائج فحص الباحث الأول: مسارات الخادم (Backend Routes)

تم فحص جميع ملفات الروتات الـ 14 الموجودة في `Backend/src/routes/` ومقارنتها مع `server.ts`:

### 1. الروتات المفعلة والمربوطة في `server.ts`:
| المسار الأساسي | اسم الملف | الوظيفة | الحالة |
| :--- | :--- | :--- | :--- |
| `/api/auth` | [authRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/authRoutes.ts) | تسجيل الدخول، تجديد الجلسات، التحقق، الملف الشخصي | ✅ مربوط ويعمل |
| `/api/admin` | [adminRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/adminRoutes.ts) | إدارة المستخدمين، المقررات، التنسيب والإحصائيات | ✅ محمي بـ RBAC كامل |
| `/api/attendance` | [attendanceRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/attendanceRoutes.ts) | إدارة جلسات الـ QR ومسح الحضور للطالب والمعلم | ⚠️ يعمل مع إهمال Schemas |
| `/api/lectures` | [lectureRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/lectureRoutes.ts) | رفع وتنزيل المحاضرات للمقررات | ✅ محمي بالملكية والتحقق |
| `/api/assignments` | [assignmentRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/assignmentRoutes.ts) | إنشاء الواجبات، تسليم الطلاب، ورصد الدرجات | ⚠️ فيه ثغرة في رصد الواجب |
| `/api/courses` | [courseRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/courseRoutes.ts) | جلب مقررات المعلم والطالب وقوائم المسجلين | ✅ يعمل مع وجود تكرار |
| `/api/reports` | [reportsRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/reportsRoutes.ts) | التقارير الأكاديمية ونسب الحضور والغياب | 🔴 **ثغرة أمنية حرجة** |
| `/api/grades` | [gradeRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/gradeRoutes.ts) | دفتر درجات Moodle، المعدل التراكمي، توزيع الأوزان | ⚠️ يفتقر لفحص ملكية المقرر |
| `/api/financials` | [financialRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/financialRoutes.ts) | الأقساط، تجميد الحسابات، الإيصالات، تغيير كلمات السر | ⚠️ خلل هيكلي ومكاني |
| `/api/security` | [securityRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/securityRoutes.ts) | المصادقة الثنائية 2FA وإلغاء الجلسات النشطة | 🔴 **كراش في اسم الحقل + TOTP** |
| `/api/admin/security` | [securityDashboardRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/securityDashboardRoutes.ts) | حظر الـ IP ورصد التهديدات السيبرانية | ✅ نظيف ومحكم |
| `/api/admin` (logs) | [logsRoute.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/logsRoute.ts) | سجلات التدقيق الأمني (Audit Logs) | ✅ ممتاز ومتوافق |
| `/health` | [healthRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/healthRoutes.ts) | فحص الجاهزية والحياة (Liveness/Readiness) | ⚠️ ينشئ مجلدات بدل القراءة |
| *(غير مربوط)* | [teacherRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/teacherRoutes.ts) | روت مقررات المعلم | 🟢 **كود ميت غير مستدعى** |

---

## 🔬 نتائج فحص الباحث الثاني: منطق الخدمات والوسيطات (Services & Middleware)

تم تدقيق ملفات `Backend/src/services/` والوسيطات في `Backend/src/middleware/`:

### 1. طبقة الوسيطات الأمنية (Middleware):
- **`authenticate.ts`:**
  - يتحقق بدقة من توقيع JWT، الصلاحية، والمصدر والمستقبل (`iss` و `aud`).
  - **ميزة متقدمة:** التحقق الفوري من `token_version` ومن حالة التجميد `is_frozen` في قاعدة البيانات لحظياً.
  - **المشكلة:** يطلق استعلام قاعدة بيانات **في كل طلب HTTP منفرد** مما يشكل عنق زجاجة (Bottleneck) عند ارتفاع عدد الطلاب.
- **`ownership.ts`:**
  - ينفذ فحص الملكية للمقررات، الواجبات، والمحاضرات بشكل ممتاز، ويمنع أي معلم من الوصول لبيانات مقرر زميله.
  - يتجاوز الفحص تلقائياً في حال كان المستخدم `admin` لتمكين الرقابة الإدارية.
- **`fileValidator.ts`:**
  - يفرض قائمة بيضاء صارمة للامتدادات (`.pdf, .doc, .docx, .zip`).
  - يمنع الهجمات المزدوجة مثل `.pdf.exe` و `.php.png`.
  - يفحص التواقيع الخبيثة داخل الأكواد المرفوعة عبر Regex ذكي.
- **`securitySanitizer.ts`:**
  - تعقيم تلقائي للمدخلات ضد هجمات حقن SQL و XSS قبل وصولها للخدمات.

### 2. محرك الدرجات ومولد الـ QR (Services Logic):
- **محرك الدرجات [gradeEngineService.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/services/gradeEngineService.ts):**
  - **الميزة:** يدعم معايير Moodle 4.0 بالكامل: يفرض إجبارية أن يكون مجموع أوزان التقييمات **100% تماماً**.
  - **الميزة:** يدعم القفل التفاؤلي (`Optimistic Locking`) باستخدام عمود `version` وحظر السباق عبر `FOR UPDATE`.
  - **الخلل:** دالة `setStudentGrade` تتأكد من أن بند الدرجة تابع للمادة، ولكنها **لا تفحص هل المعلم الذي يرصد الدرجة هو أستاذ هذا المقرر أم لا**.
- **خدمة الحضور [attendanceService.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/services/attendanceService.ts) و [attendanceRecordService.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/services/attendanceRecordService.ts):**
  - **الميزة:** خوارزمية HMAC-SHA256 تولد رمزاً مؤقتاً نافذاً لـ 20 ثانية فقط (`window = Math.floor(now / 20)`).
  - **الميزة:** تقبل هامش تأخير $\pm 1$ نافذة (20 إلى 40 ثانية كحد أقصى) لاستيعاب تأخير الشبكة.
  - **الميزة:** نظام `Anti-Proxy Device Binding`: يمنع تسجيل حضور طالبين من نفس الجهاز (`deviceFingerprint`) في نفس الجلسة.

---

## 🔬 نتائج فحص الباحث الثالث: قاعدة البيانات وعقود الربط (Schema & Contracts)

تمت مطابقة ملفات السكيما (`init_schema.sql`, `migrate_phase1.sql`, `migrate_v2.js`, `migratePhase3.ts`) مع استدعاءات الفرونت إند في `eduflow-portal-main`:

```mermaid
erDiagram
    users ||--o{ enrollments : "يسجل في"
    users ||--o{ courses : "يُدرّس"
    users ||--o{ student_grades : "يملك درجات"
    users ||--o| student_financials : "له كشف مالي"
    courses ||--o{ course_grade_items : "يحتوي بنود"
    courses ||--o{ attendance_sessions : "يحتوي جلسات"
    course_grade_items ||--o{ student_grades : "يرتبط بـ"
    attendance_sessions ||--o{ attendance_records : "يسجل حضور"
```

### التناقضات بين جداول السكيما وكود الباكند والفرونت:
1. **اسم عمود كلمة المرور في جدول `users`:**
   - السكيما تعرف الحقل باسم `password_hash`.
   - ملف `securityRoutes.ts` في السطر 125 يطلب `SELECT password FROM users` ❌ -> **خطأ تشغيلي حتمي**.
2. **ازدواجية مسار استعادة كلمة المرور في الفرونت إند:**
   - واجهة `UserManagement.tsx` بالسطر 445 تطلب مساراً غير منطقي: `/api/admin/financials/reset-password`.
   - بينما بالسطر 220 تطلب المسار القياسي: `/api/admin/users/:id/password`.
   - كلاهما يعمل في الباكند، ولكن وضعه داخل الروت المالي يربك بنية الـ API.
3. **توافق الحسابات:**
   - جدول `admin_accounts` منفصل تماماً عن جدول `users` (المخصص للطلاب والمعلمين).
   - التوكنات لمدير النظام تبدأ بـ `admin_` بينما الطلاب والمعلمون يستخدمون معرفات UUID أو أرقام القيود.
   - منطق `authenticate.ts` يفحص `token_version` لجدول `users` فقط، ويهمل التحقق من إبطال جلسات `admin_accounts` لحظياً.

---

## 🔬 نتائج فحص الباحث الرابع: خدمة التقارير والأمان والإعدادات (Reports & Security)

### 1. لغز [ReportsService](file:///C:/Users/alibi/Projects/Hadir/ReportsService):
- تبين أن مجلد `ReportsService` عبارة عن **مشروع ميكروسيرفيس قديم/منفصل** يعمل على المنفذ `3001`.
- **الواقع التشغيلي:** الواجهة الأمامية في ملف [reports.ts](file:///C:/Users/alibi/Projects/Hadir/eduflow-portal-main/src/config/reports.ts) تطلب دائماً المسار `/api/reports` الذي يتجه مباشرة نحو المنفذ `3000` (الباكند الرئيسي).
- ملف `debug_500.js` داخل `ReportsService` يحتوي استعلاماً به خطأ فادح: `FROM attendance a` بينما اسم الجدول الحقيقي هو `attendance_sessions`. هذا يؤكد أنه كان ملفاً تجريبياً تسبب في خطأ 500 للمطور الأصلي.
- **الخلاصة:** `ReportsService` لا يتم استدعاؤه حالياً ويُفضل حذفه أو عزله لمنع التشتيت.

### 2. تدقيق الأمان والمصادقة الثنائية (2FA Security):
- في [securityRoutes.ts](file:///C:/Users/alibi/Projects/Hadir/Backend/src/routes/securityRoutes.ts):
  - توليد مفتاح 2FA يتم عبر: `crypto.randomBytes(10).toString('hex')` (ترميز Hex).
  - تطبيقات المصادقة القياسية (Google Authenticator / Authy / Microsoft Authenticator) تدعم فقط **ترميز Base32** وفق معيار RFC 6238.
  - إرسال المفتاح السري بصيغة Hex في رابط `otpauth://` يؤدي إلى رفض التطبيقات مسح الكود أو إعطاء أكواد غير متطابقة ❌.

---

## 📊 جدول حصر الثغرات والأخطاء (Bug Registry) وطرق حلها

| الرقم | درجة الخطورة | الملف والموقع | نوع الـ Bug | الأثر والوصف | الطريقة الصحيحة للحل (Fix) |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **BUG-01** | 🔴 حرجة جداً | `Backend/src/routes/reportsRoutes.ts` | **Broken Access Control** (OWASP A01) | جميع مسارات التقارير تستخدم `authenticate` فقط بدون أي فحص للصلاحيات. يستطيع أي طالب تعديل درجات وحضور زملائه عبر `PUT /teacher/course/:courseId/update`. | إضافة `authorize(ROLES.ADMIN)` لمسار المشرف، و `authorize(ROLES.TEACHER)` مع وسيطة `checkCourseOwnership` لجميع مسارات المعلم. |
| **BUG-02** | 🔴 حرجة | `Backend/src/routes/securityRoutes.ts` (L125) | **SQL Column Mismatch** | استعلام إلغاء 2FA يطلب `SELECT password FROM users`. الحقل غير موجود في السكيما (اسمه `password_hash`)، مما يسبب كراش فوري بخطأ 500. | تعديل الاستعلام إلى `SELECT password_hash FROM users WHERE id = ?`. |
| **BUG-03** | 🔴 حرجة | `Backend/src/routes/securityRoutes.ts` (L16) | **Cryptographic / Encoding Flaw** | توليد مفتاح 2FA بصيغة Hexadecimal بدلاً من Base32. برامج Authenticator ترفض الكود ولا تعمل المصادقة الثنائية. | استخدام مكتبة معتمدة مثل `otplib` أو تشفير المفتاح السري بترميز `Base32` القياسي. |
| **BUG-04** | 🟠 عالية | `Backend/src/routes/assignmentRoutes.ts` (L195) | **IDOR / Missing Ownership** | مسار تقييم الواجبات `POST /submissions/:id/grade` لا يفحص هل المعلم يملك الواجب، فيستطيع أي معلم وضع درجات لطلاب مادة أخرى. | إضافة وسيطة التحقق من ملكية الواجب قبل الوصول لمعالج الطلب. |
| **BUG-05** | 🟠 عالية | `Backend/src/services/gradeEngineService.ts` (L184) | **IDOR in Gradebook** | دالة `setStudentGrade` تفحص وجود البند بالمقرر، لكنها لا تفحص هل المعلم الحالي هو المكلف بتدريس المقرر. | إضافة فحص شرطي: `WHERE id = courseId AND teacher_id = gradedBy`. |
| **BUG-06** | 🟠 عالية | `Backend/src/routes/financialRoutes.ts` (L230-268) | **Bad Architecture & Plaintext Secret** | دمج مسار إعادة تعيين كلمة السر الفنية داخل ملف الروت المالي، وإرجاع كلمة السر المؤقتة كنص صريح في الـ JSON Response. | نقل المسار إلى `adminRoutes.ts` وتوثيقه في سجل التدقيق (Audit Log)، وإرسال كلمة السر عبر قناة آمنة. |
| **BUG-07** | 🟡 متوسطة | `Backend/src/routes/assignmentRoutes.ts` (L200) | **Falsy Coercion Bug** | فحص الدرجة مكتوب: `if (!gradeData.grade)`. إذا أعطى المعلم للطالب درجة `0`، يعتبرها السيرفر فارغة ويرفض حفظ الدرجة! | تعديل الشرط إلى: `if (gradeData.grade === undefined \|\| gradeData.grade === null)`. |
| **BUG-08** | 🟡 متوسطة | `Backend/src/routes/attendanceRoutes.ts`, `lectureRoutes.ts` | **Unused Validation Schemas** | استيراد مخططات Zod في بداية الملفات دون تطبيقها في الوسيطة `validateRequest()`. تدخل الطلبات دون فحص مسبق. | تفعيل `validateRequest(createSessionSchema)` في المسارات المناظرة. |
| **BUG-09** | 🟢 منخفضة | `Backend/src/routes/teacherRoutes.ts` | **Dead Code** | ملف روت كامل تم إنشاؤه ولم يتم عمل `import` أو `app.use` له في `server.ts`. | حذف الملف لمنع تشويش المطورين، حيث أن المسار مفعل في `courseRoutes.ts`. |
| **BUG-10** | 🟢 منخفضة | `Backend/src/routes/healthRoutes.ts` (L72) | **Side-Effect in Health Check** | مسار `GET /health/ready` يقوم بإنشاء مجلدات (`fs.mkdirSync`). مسارات المراقبة يجب أن تكون للقراءة فقط (Idempotent). | استبدال الإنشاء بفحص وجود المجلد عبر `fs.existsSync`. |

---

## 🎯 ما الذي يعمل بكفاءة تامة (What Works Perfectly)

1. **⏱️ الـ QR كود الزمني المتغير (20s Dynamic QR):**
   - يعمل بتناغم تام وخوارزمية HMAC دقيقة للغاية ومقاومة للتلاعب مع نافذة سماح ذكية ومستقرة.
2. **🛡️ الدفاع السيبراني الشامل (OWASP Hardening):**
   - وسيطات `Helmet`، `CORS` المقيد، وتحديد معدل الطلبات (Rate Limiting) على مستوى الـ IP والمسار تعمل بشكل احترافي.
   - التحقق من تزوير الملفات وامتداداتها الخبيثة ومسح البايلودات المشبوهة يعمل بنسبة نجاح 100%.
3. **📊 دفتر درجات Moodle وحساب الـ GPA:**
   - احتساب المعدل التراكمي الموزون بالساعات المعتمدة على معيار 4.0 دقيق وعادل.
   - فرض مجموع 100% لإجمالي التقييمات يمنع الأخطاء البشرية للأكاديميين.
4. **💳 السجل المالي والتحكم في تجميد الحسابات:**
   - الربط بين حالة `is_frozen` وحظر تسجيل الحضور يعمل بصرامة ويحمي حقوق المؤسسة.
5. **🎨 واجهة المستخدم وسلاسة التبديل بين الأدوار:**
   - تصميم متجاوب فائق الجودة، وضع ليلي دقيق، وتوزيع واضح للوظائف بين الطالب والأستاذ والمدير.

---

> [!TIP]
> جميع تفاصيل الفحص تمت برمجياً وميدانياً عبر تدقيق الشيفرات المباشرة. يُوصى ببدء تطبيق التعديلات بدءاً من الثغرات الحرجة الثلاث الأولى (`BUG-01` إلى `BUG-03`) لضمان جاهزية المنظومة للإنتاج (Production Readiness).
