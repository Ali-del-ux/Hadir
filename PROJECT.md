# Project: Hadir LMS — Comprehensive Audit & Remediation Plan

## Architecture Overview
- **Frontend Portal**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite (Port `8091`).
  - Student Portal: `eduflow-portal-main/src/components/student/`
  - Teacher Portal: `eduflow-portal-main/src/components/teacher/`
  - Admin Portal: `eduflow-portal-main/src/components/admin/`
  - Shared Components: `eduflow-portal-main/src/components/shared/`, `src/components/layout/`
  - In-Memory Mock Server & Interceptors: `eduflow-portal-main/mockServerPlugin.ts`
- **Backend API Service**: Node.js, Express, TypeScript, MySQL2, JWT, Helmet, Zod (Port `3000`).
  - Routes: `Backend/src/routes/`
  - Services: `Backend/src/services/`
  - Security Middleware: `Backend/src/middleware/`

---

## Screen Inventory & Audit Coverage

### 1. Student Portal (`student1@test.com` — Ali Bin Taher / علي بن طاهر, ID: `2340033`)
| # | Screen Name | Component Path | Audit Status | Key Defects Found |
|---|---|---|---|---|
| S-01 | Main Shell & User Badge | `src/components/layout/AppShell.tsx` | Audited | Corrupted student name `'علي بي'` |
| S-02 | Student Dashboard (Home) | `src/components/student/StudentHome.tsx` | Audited | Hours show 18 instead of 12; double honorific `د. د.`; active session shows `undefined • undefined` |
| S-03 | Academic Transcript & GPA | `src/components/student/StudentReports.tsx` | Audited | 18/15 credits instead of 12/12; CS-302 92.5% vs 91.7%; AI-301 96% vs 90%; overall 97.4% vs 96.1%; modal empty; typo "التراكمي التراكمي" |
| S-04 | Dynamic QR Attendance Scanner | `src/components/student/StudentCheckIn.tsx` | Audited | Missing `/api/attendance/student/scan` endpoint; renders empty data; does not enforce account freeze |
| S-05 | Financial Record & Receipts | `src/components/student/StudentFinancialRecord.tsx` | Audited | Student name `'علي بي'`; historical receipt modal renders live 0 LYD balance instead of remaining balance at payment time |
| S-06 | Weekly Course Schedule | `src/components/student/StudentSchedule.tsx` | Audited | Double honorific prefix `المحاضر: د. د. أحمد علي البشير` |
| S-07 | Course Details & Lectures | `src/components/student/CourseDetails.tsx` | Audited | Lecture date renders `"Invalid Date"`; file size shows `"Unknown"`; hardcoded `ar-SA` locale |
| S-08 | Course Assignments | `src/components/student/StudentAssignments.tsx` | Audited | In-memory assignment state persistence; provisional status alignment |
| S-09 | Settings & 2FA Security | `src/components/shared/SettingsView.tsx` | Audited | Snake_case `two_factor_enabled` causes `undefined` in UI |
| S-10 | Student Profile | `src/components/shared/ProfileView.tsx` | Audited | Truncated name `'علي بي'` |
| S-11 | Course Syllabus & Attendance View | `src/components/student/CourseAttendanceView.tsx` | Audited | Cross-course attendance aggregation |

### 2. Teacher Portal (`teacher@test.com` — Dr. Ahmed Ali Al-Bashir / د. أحمد علي البشير, Code: `TCH-001`)
| # | Screen Name | Component Path | Audit Status | Key Defects Found |
|---|---|---|---|---|
| T-01 | Teacher Home & Overview | `src/components/teacher/TeacherHome.tsx` | Audited | SE-305 assigned to Dr. Ahmed shows Dr. Asmaa as instructor; student name `'علي بي'` |
| T-02 | Dynamic QR Attendance Session | `src/components/teacher/TeacherCheckIn.tsx` | Audited | Snake_case `qr_code` prevents dynamic QR rotation on projector (stuck on static string); attendees modal blank & "يدوي" badge |
| T-03 | Moodle 4.0 Gradebook Matrix | `src/components/teacher/TeacherGradebook.tsx` | Audited | Sum of weights/items mathematically inconsistent with total score (Ali 96.9% vs 97.2%); student `'علي بي'`; non-persistent edits |
| T-04 | Assignments & Submissions | `src/components/teacher/TeacherAssignments.tsx` | Audited | Submissions modal returns assignments list instead of submissions; displays `Invalid Date` and blank names |
| T-05 | Lectures & Course Files | `src/components/teacher/TeacherLectures.tsx` | Audited | Mock server lacks file upload persistence |
| T-06 | Attendance Reports & Analytics | `src/components/teacher/TeacherReports.tsx` | Audited | Course modal displays **`متوسط الحضور: NaN%`**; student ID blank; lectures `/ 14`; red `undefined%`; Excel export corrupted |
| T-07 | Course Details & Roster | `src/components/teacher/TeacherCourseDetails.tsx` | Audited | Triggers `alert('فشل في تحميل قائمة الطلاب')`; empty attendance sessions |
| T-08 | Teacher Academic Profile | `src/components/shared/ProfileView.tsx` | Audited | Displays instructor code `TCH-2026` instead of `TCH-001` |
| T-09 | Settings & Security Center | `src/components/shared/SettingsView.tsx` | Audited | `two_factor_enabled` snake_case prevents toggle recognition |

### 3. Admin Portal (`admin@hadir.edu` — Academic System Administrator / مدير النظام الأكاديمي)
| # | Screen Name | Component Path | Audit Status | Key Defects Found |
|---|---|---|---|---|
| A-01 | Admin Dashboard (Home) | `src/components/admin/AdminHome.tsx` | Audited | Ignores daily attendance rate (96.2%) and active sessions count (6) |
| A-02 | User Management | `src/components/admin/UserManagement.tsx` | Audited | Tech Support reset dialog dead click; Admin labeled as "طالب" with delete button; teacher cards lack code/dept; lacks freeze badge |
| A-03 | Academic Governance / Courses | `src/components/admin/CourseManagement.tsx` | Audited | Mock `/admin/courses` lacks mutable persistence; strips `teacher_id` and `credit_hours` causing blank edit dialogs |
| A-04 | Academic Enrollment Management | `src/components/admin/EnrollmentManagement.tsx` | Audited | Complete paralysis: 4 missing mock endpoints; 0 enrolled students; `teacherId` camelCase mismatch |
| A-05 | Admin Financials & Freezing | `src/components/admin/AdminFinancials.tsx` | Audited | Freezing student updates `mockFinancialStudents` but fails to sync `mockUsersList.is_frozen` or block QR scanning |
| A-06 | Admin Profile | `src/components/shared/ProfileView.tsx` | Audited | Profile updates fall through to empty data |
| A-07 | System Settings & Security | `src/components/shared/SettingsView.tsx` | Audited | `two_factor_enabled` snake_case; missing 2FA QR generator |

---

## Master Feature & Defect Inventory

| # | Defect ID | Feature / Area | Description | Portals Affected | Target File(s) |
|---|---|---|---|---|---|
| 1 | DEF-01 | Identity | Student name truncated to `'علي بي'` instead of `'علي بن طاهر'` | Student, Teacher, Admin | `mockServerPlugin.ts:209, 252, 422, 452, 491, 787` |
| 2 | DEF-02 | Identity | Teacher code displayed as `TCH-2026` instead of `TCH-001` | Teacher, Admin | `mockServerPlugin.ts:197, 243` |
| 3 | DEF-03 | Academic Math | Credit hours claim 18/15 instead of 12/12; GPA 3.88 quality point math ($46.5 / 12 = 3.875$) | Student, Admin | `mockServerPlugin.ts:337-339` |
| 4 | DEF-04 | Attendance Math | CS-302 shows 92.5% (actual: 91.7%); AI-301 shows 96% (actual: 90%); overall shows 97.4% (actual: 96.1%) | Student | `mockServerPlugin.ts:340, 361, 387` |
| 5 | DEF-05 | Gradebook Math | Moodle items sum does not equal total score (Ali 96.9% vs 97.2%; Ibrahim 88.1% vs 88.3%; Ahmed 93.0% vs 93.6%) | Teacher | `mockServerPlugin.ts:456, 466, 476` |
| 6 | DEF-06 | Cross-View Grades | Gradebook vs Course Reports discrepancies (Ibrahim B+ vs A; Ahmed A vs A+; Ahmed Oraibi missing in Gradebook) | Teacher | `mockServerPlugin.ts:421-426, 449-480` |
| 7 | DEF-07 | Dynamic QR | TOTP QR projector does not rotate (stuck on static string) due to snake_case `qr_code` vs camelCase `qrCode` | Teacher | `mockServerPlugin.ts:775-781`, `TeacherCheckIn.tsx:76` |
| 8 | DEF-08 | Dynamic QR | Active session attendees dialog renders blank rows and "يدوي" badge due to missing properties | Teacher | `mockServerPlugin.ts:784-791`, `TeacherCheckIn.tsx:523` |
| 9 | DEF-09 | Student Check-In | Missing `/api/attendance/student/scan` route causing `undefined` course name and timestamp | Student | `mockServerPlugin.ts:734-750`, `StudentCheckIn.tsx:61` |
| 10 | DEF-10 | Account Freezing | Freezing student does not sync `mockUsersList.is_frozen` or block active session/QR attendance | Student, Admin | `mockServerPlugin.ts:543, 735` |
| 11 | DEF-11 | UI Dead Click | Tech Support reset dialog in UserManagement missing from JSX tree (dead click on key button) | Admin | `UserManagement.tsx:143` |
| 12 | DEF-12 | Role Misattribution| Admin account displayed as "طالب" with graduation cap and delete button | Admin | `UserManagement.tsx:156-159` |
| 13 | DEF-13 | Teacher Card UI | UserManagement cards omit teacher code (`TCH-001`) and academic department | Admin | `UserManagement.tsx:172` |
| 14 | DEF-14 | Enrollment UI | EnrollmentManagement paralyzed (0 students, missing mock endpoints, `teacherId` camelCase mismatch) | Admin | `mockServerPlugin.ts:906`, `EnrollmentManagement.tsx:191` |
| 15 | DEF-15 | Course Governance | Course management lacks in-memory CRUD persistence; response omits `teacher_id` and `credit_hours` | Admin | `mockServerPlugin.ts:723-731` |
| 16 | DEF-16 | UI Rendering Crash | Teacher Reports course details renders **`متوسط الحضور: NaN%`** and `undefined%` in red badge | Teacher | `mockServerPlugin.ts:415-429`, `TeacherReports.tsx:295` |
| 17 | DEF-17 | UI Rendering Crash | Teacher Course Details triggers `alert('فشل في تحميل قائمة الطلاب')` and empty sessions | Teacher | `mockServerPlugin.ts:323, 750`, `TeacherCourseDetails.tsx:115` |
| 18 | DEF-18 | UI Rendering Crash | Assignments submissions modal renders assignments list with **`Invalid Date`** and blank student info | Teacher | `mockServerPlugin.ts:829`, `TeacherAssignments.tsx:164` |
| 19 | DEF-19 | UI Date Rendering | Lecture materials in CourseDetails render **`Invalid Date`**, **`Unknown`** size, and Saudi locale | Student | `mockServerPlugin.ts:870-888`, `CourseDetails.tsx:26` |
| 20 | DEF-20 | Honorific Prefix | Double prefix `د. د.` rendered before instructor names in StudentHome and StudentSchedule | Student | `StudentHome.tsx:250`, `StudentSchedule.tsx:162` |
| 21 | DEF-21 | Missing Endpoint | Missing `/api/grades/student/course/:courseId` causes Moodle gradebook breakdown modal to be empty | Student | `mockServerPlugin.ts:432`, `StudentReports.tsx:89` |
| 22 | DEF-22 | Financial Receipts | Student financial receipt modal displays live 0 LYD balance instead of remaining balance at payment time | Student | `StudentFinancialRecord.tsx:324` |
| 23 | DEF-23 | Typo | "المعدل التراكمي التراكمي" duplicated word in StudentReports header | Student | `StudentReports.tsx:147` |
| 24 | DEF-24 | 2FA Schema | Snake_case `two_factor_enabled` vs camelCase `twoFactorEnabled` across all portals | Student, Teacher, Admin | `mockServerPlugin.ts:897`, `SettingsView.tsx:70` |

---

## Planned Remediation Milestones (For User Approval)

| Milestone | Scope | Key Deliverables | Status |
|---|---|---|---|
| **M1: Data Engine & Mock Server Unification** | `mockServerPlugin.ts` | 1. Unify student name (`علي بن طاهر`) and teacher code (`TCH-001`).<br>2. Correct credit hours (12/12) and attendance math.<br>3. Fix dynamic QR TOTP payload (`qrCode`, `expiresIn`, `attendeesCount`).<br>4. Implement missing endpoints: `/attendance/student/scan`, `/grades/student/course/:id`, `/assignments/teacher/:id/submissions`, `/admin/courses/:id/enrollments`, `/courses/:id/students`.<br>5. Sync account freeze with user state and attendance blocking. | PLANNED (Pending Approval) |
| **M2: Student Portal UI & Mathematical Alignment** | `src/components/student/` | 1. Fix double honorific helper in `StudentHome` & `StudentSchedule`.<br>2. Remove typo in `StudentReports` header.<br>3. Fix date parsing in `CourseDetails` to eliminate `Invalid Date` and `Unknown`.<br>4. Fix historical balance calculation in `StudentFinancialRecord`. | PLANNED (Pending Approval) |
| **M3: Teacher Portal UI & Contract Fixes** | `src/components/teacher/` | 1. Fix Teacher Reports camelCase data mapping to eliminate `NaN%`.<br>2. Align Moodle Gradebook item scores to strictly sum to certified totals.<br>3. Connect assignment submissions handler and grading actions.<br>4. Connect course details sessions and students roster. | PLANNED (Pending Approval) |
| **M4: Admin Portal Governance & Bug Fixes** | `src/components/admin/` | 1. Insert `TechSupportResetDialog` into `UserManagement` JSX to fix dead click.<br>2. Add proper `admin` role badge (Shield icon, "مدير النظام") and disable delete button.<br>3. Show teacher code/dept and frozen badge in user cards.<br>4. Fix field mappings in `EnrollmentManagement` (`teacher_id` / `teacher_name`).<br>5. Add attendance KPI card to `AdminHome`. | PLANNED (Pending Approval) |
| **M5: Backend Parity & Shared 2FA Settings** | `Backend/` & `SettingsView.tsx` | 1. Unify `twoFactorEnabled` property in `SettingsView.tsx` and mock server.<br>2. Ensure `reportsRoutes.ts` and `gradeEngineService.ts` maintain exact parity with mock calculations.<br>3. Verify seed scripts (`init-db.cjs`, `seed.json`) reflect unified student and teacher data. | PLANNED (Pending Approval) |
