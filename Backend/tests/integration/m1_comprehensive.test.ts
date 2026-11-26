import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { app, pool } from '../setup';
import { generateTOTP } from '../../src/utils/totp';

describe('Milestone M1 Comprehensive Integration & Algorithm Tests', () => {
  const teacher1 = { id: 'M1_T1', email: 'm1_t1@university.edu', password: 'password123', code: 'M1T1' };
  const student1 = { id: 'M1_S1', email: 'm1_s1@student.edu', password: 'password123', student_id: 'M1_S1' };
  const student2 = { id: 'M1_S2', email: 'm1_s2@student.edu', password: 'password123', student_id: 'M1_S2' };
  const studentFrozen = { id: 'M1_SF', email: 'm1_sf@student.edu', password: 'password123', student_id: 'M1_SF' };
  const adminCreds = { username: 'admin', password: 'admin123' };

  let adminToken = '';
  let teacherToken = '';
  let student1Token = '';
  let student2Token = '';
  let studentFrozenToken = '';
  let createdCourseId = '';
  let createdStudentId = '';

  beforeAll(async () => {
    const pwHash = await bcrypt.hash('password123', 10);
    const adminHash = await bcrypt.hash(adminCreds.password, 10);

    await pool.query('DELETE FROM attendance_records WHERE student_id IN (?, ?, ?)', [student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM attendance_sessions WHERE created_by = ?', [teacher1.id]);
    await pool.query('DELETE FROM student_grades WHERE student_id IN (?, ?, ?)', [student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM enrollments WHERE student_id IN (?, ?, ?)', [student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM courses WHERE teacher_id = ?', [teacher1.id]);
    await pool.query('DELETE FROM student_financials WHERE student_id IN (?, ?, ?)', [student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (?, ?, ?, ?, ?)', [teacher1.id, student1.id, student2.id, studentFrozen.id, 'admin_1']);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?, ?)', [teacher1.id, student1.id, student2.id, studentFrozen.id]);

    const [exAdmin]: any = await pool.query('SELECT id FROM admin_accounts WHERE username = ?', [adminCreds.username]);
    if (exAdmin.length === 0) {
      await pool.query('INSERT INTO admin_accounts (username, password_hash, is_active) VALUES (?, ?, 1)', [adminCreds.username, adminHash]);
    } else {
      await pool.query('UPDATE admin_accounts SET password_hash = ?, is_active = 1 WHERE id = ?', [adminHash, exAdmin[0].id]);
    }

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, teacher_code, department, is_active)
       VALUES (?, 'M1 Teacher', ?, ?, 'teacher', ?, 'Cyber Security', 1)`,
      [teacher1.id, teacher1.email, pwHash, teacher1.code]
    );

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, student_id, department, academic_year, is_active, is_frozen)
       VALUES (?, 'M1 Student One', ?, ?, 'student', ?, 'Cyber Security', 'Year 3', 1, 0)`,
      [student1.id, student1.email, pwHash, student1.student_id]
    );

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, student_id, department, academic_year, is_active, is_frozen)
       VALUES (?, 'M1 Student Two', ?, ?, 'student', ?, 'AI', 'Year 2', 1, 0)`,
      [student2.id, student2.email, pwHash, student2.student_id]
    );

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, student_id, department, academic_year, is_active, is_frozen, freeze_reason)
       VALUES (?, 'M1 Frozen Student', ?, ?, 'student', ?, 'Cyber Security', 'Year 2', 1, 1, 'Unpaid tuition')`,
      [studentFrozen.id, studentFrozen.email, pwHash, studentFrozen.student_id]
    );

    await pool.query(
      `INSERT INTO student_financials (student_id, student_name, student_number, total_tuition, paid_amount, status, is_frozen, freeze_reason)
       VALUES (?, 'M1 Student One', ?, 3500, 3500, 'paid', 0, NULL),
              (?, 'M1 Student Two', ?, 3500, 1500, 'partial', 0, NULL),
              (?, 'M1 Frozen Student', ?, 3500, 0, 'unpaid', 1, 'Unpaid tuition')`,
      [student1.id, student1.student_id, student2.id, student2.student_id, studentFrozen.id, studentFrozen.student_id]
    );
  });

  afterAll(async () => {
    if (createdStudentId) {
      await pool.query('DELETE FROM student_financials WHERE student_id = ?', [createdStudentId]);
      await pool.query('DELETE FROM users WHERE id = ?', [createdStudentId]);
    }
    if (createdCourseId) {
      await pool.query('DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = ?)', [createdCourseId]);
      await pool.query('DELETE FROM attendance_sessions WHERE course_id = ?', [createdCourseId]);
      await pool.query('DELETE FROM student_grades WHERE course_id = ?', [createdCourseId]);
      await pool.query('DELETE FROM course_grade_items WHERE course_id = ?', [createdCourseId]);
      await pool.query('DELETE FROM enrollments WHERE course_id = ?', [createdCourseId]);
      await pool.query('DELETE FROM courses WHERE id = ?', [createdCourseId]);
    }
    await pool.query('DELETE FROM student_financials WHERE student_id IN (?, ?, ?)', [student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (?, ?, ?, ?)', [teacher1.id, student1.id, student2.id, studentFrozen.id]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?, ?)', [teacher1.id, student1.id, student2.id, studentFrozen.id]);
  });

  test('1. Auth login returns is_frozen, two_factor_enabled, student_id and supports admin@hadir.edu & refresh tokenVersion', async () => {
    const adminRes = await request(app).post('/api/auth/login').send({
      identifier: 'admin@hadir.edu',
      password: adminCreds.password,
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.user.role).toBe('admin');
    expect(adminRes.body.token).toBeTruthy();
    adminToken = adminRes.body.token;

    const [rtRows]: any = await pool.query('SELECT family_id FROM refresh_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [adminRes.body.user.id]);
    expect(rtRows[0]?.family_id).toBeTruthy();

    const tRes = await request(app).post('/api/auth/login').send({ identifier: teacher1.email, password: teacher1.password });
    expect(tRes.status).toBe(200);
    expect(tRes.body.user.two_factor_enabled).toBe(false);
    teacherToken = tRes.body.token;

    const s1Res = await request(app).post('/api/auth/login').send({ identifier: student1.email, password: student1.password });
    expect(s1Res.status).toBe(200);
    expect(s1Res.body.user.is_frozen).toBe(false);
    expect(s1Res.body.user.student_id).toBe(student1.student_id);
    student1Token = s1Res.body.token;

    // Refresh preserves tokenVersion=1 and /auth/me still works
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken: s1Res.body.refreshToken });
    expect(refreshRes.status).toBe(200);
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshRes.body.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(student1.id);
    student1Token = refreshRes.body.token;

    const s2Res = await request(app).post('/api/auth/login').send({ identifier: student2.email, password: student2.password });
    student2Token = s2Res.body.token;

    const sfRes = await request(app).post('/api/auth/login').send({ identifier: studentFrozen.email, password: studentFrozen.password });
    expect(sfRes.status).toBe(200);
    expect(sfRes.body.user.is_frozen).toBe(true);
    expect(sfRes.body.user.freeze_reason).toBe('Unpaid tuition');
    studentFrozenToken = sfRes.body.token;
  });

  test('2. RFC 6238 2FA challenge is enforced during login when enabled', async () => {
    const genRes = await request(app).post('/api/security/2fa/generate').set('Authorization', `Bearer ${student2Token}`);
    expect(genRes.status).toBe(200);
    const secret = genRes.body.data.secret;
    const totp = generateTOTP(secret);

    const enableRes = await request(app)
      .post('/api/security/2fa/verify-and-enable')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ secret, token: totp });
    expect(enableRes.status).toBe(200);

    // Login without totp_code -> requires_2fa: true, NO access token issued yet
    const loginChallenge = await request(app).post('/api/auth/login').send({ identifier: student2.email, password: student2.password });
    expect(loginChallenge.status).toBe(200);
    expect(loginChallenge.body.requires_2fa).toBe(true);
    expect(loginChallenge.body.temp_token).toBeTruthy();
    expect(loginChallenge.body.token).toBeUndefined();

    // Wrong 2FA code -> 401
    const bad2fa = await request(app).post('/api/auth/login/2fa').send({ temp_token: loginChallenge.body.temp_token, code: '000000' });
    expect(bad2fa.status).toBe(401);

    // Valid 2FA code -> issues JWT
    const good2fa = await request(app).post('/api/auth/login/2fa').send({ temp_token: loginChallenge.body.temp_token, code: generateTOTP(secret) });
    expect(good2fa.status).toBe(200);
    expect(good2fa.body.token).toBeTruthy();
    student2Token = good2fa.body.token;

    // Disable 2FA cleanly
    const disableRes = await request(app)
      .post('/api/security/2fa/disable')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ password: student2.password });
    expect(disableRes.status).toBe(200);
  });

  test('3. Admin User, Course & Financials Summary CRUD works with full schema parity', async () => {
    // Summary endpoint
    const sumRes = await request(app).get('/api/financials/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(sumRes.status).toBe(200);
    expect(sumRes.body.data).toHaveProperty('totalExpected');
    expect(sumRes.body.data).toHaveProperty('frozenCount');

    // Create student -> auto-creates student_financials
    const uniqueNum = String(Date.now()).slice(-7);
    const createUserRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'M1 Created Student',
        email: `m1_created_${uniqueNum}@student.edu`,
        role: 'student',
        student_id: `ST_${uniqueNum}`,
        department: 'Software Engineering',
        password: 'password123',
      });
    expect(createUserRes.status).toBe(201);
    createdStudentId = createUserRes.body.data.id;

    const [finRows]: any = await pool.query('SELECT * FROM student_financials WHERE student_id = ?', [createdStudentId]);
    expect(finRows.length).toBe(1);

    // Update user with UI-style extra fields (id, studentId, is_frozen)
    const updateUserRes = await request(app)
      .put(`/api/admin/users/${createdStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: createdStudentId,
        name: 'M1 Updated Student',
        email: `m1_created_${uniqueNum}@student.edu`,
        role: 'student',
        studentId: `ST_${uniqueNum}`,
        is_frozen: false,
      });
    expect(updateUserRes.status).toBe(200);
    expect(updateUserRes.body.data.name).toBe('M1 Updated Student');

    // Create course with '&', credit_hours, room, schedule_day, schedule_time
    const courseRes = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `M1-${uniqueNum}`,
        name: 'Security & Cryptography',
        teacher_id: teacher1.id,
        credit_hours: 4,
        room: 'Hall 305',
        schedule_day: 'Mon - Wed',
        schedule_time: '11:00 - 12:30',
      });
    expect(courseRes.status).toBe(201);
    createdCourseId = courseRes.body.data.id;
    expect(courseRes.body.data.credit_hours).toBe(4);
    expect(courseRes.body.data.room).toBe('Hall 305');

    // Enroll student1 and studentFrozen (NOT student2)
    await request(app).post(`/api/admin/courses/${createdCourseId}/enroll`).set('Authorization', `Bearer ${adminToken}`).send({ student_id: student1.id });
    await request(app).post(`/api/admin/courses/${createdCourseId}/enroll`).set('Authorization', `Bearer ${adminToken}`).send({ student_id: studentFrozen.id });

    // Teacher fetches enrolled students (queries academic_year + enrolled_at/enrollment_date)
    const rosterRes = await request(app).get(`/api/courses/${createdCourseId}/students`).set('Authorization', `Bearer ${teacherToken}`);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data.length).toBe(2);
    expect(rosterRes.body.data[0]).toHaveProperty('enrollment_date');
  });

  test('4. Gradebook Exclude Empty Grades, Zero-Credits GPA null, Multi-Item Categories & Non-Destructive Weight Edit', async () => {
    // Initially 0 sessions and 0 grades -> attendancePercentage null, totalScore null, GPA null
    const matrix0 = await request(app).get(`/api/grades/course/${createdCourseId}/gradebook`).set('Authorization', `Bearer ${teacherToken}`);
    expect(matrix0.status).toBe(200);
    expect(matrix0.body.data.gradeItems.length).toBe(4);
    expect(matrix0.body.data.students[0].attendancePercentage).toBeNull();
    expect(matrix0.body.data.students[0].totalScore).toBeNull();

    const gpa0 = await request(app).get('/api/grades/student/gpa').set('Authorization', `Bearer ${student1Token}`);
    expect(gpa0.status).toBe(200);
    expect(gpa0.body.data.gradedCredits).toBe(0);
    expect(gpa0.body.data.gpa).toBeNull();

    // Add TWO 'assignments' items (no uq_grade_item crash!)
    const currentItems = matrix0.body.data.gradeItems;
    const attItem = currentItems.find((i: any) => i.category === 'attendance');
    const asgItem = currentItems.find((i: any) => i.category === 'assignments');
    const midItem = currentItems.find((i: any) => i.category === 'midterm');
    const finItem = currentItems.find((i: any) => i.category === 'final');

    const splitItems = [
      { id: attItem.id, name: attItem.name, category: 'attendance', weight: 10, max_score: 100 },
      { id: asgItem.id, name: 'Assignment 1', category: 'assignments', weight: 10, max_score: 100 },
      { name: 'Assignment 2', category: 'assignments', weight: 10, max_score: 100 },
      { id: midItem.id, name: midItem.name, category: 'midterm', weight: 30, max_score: 100 },
      { id: finItem.id, name: finItem.name, category: 'final', weight: 40, max_score: 100 },
    ];
    const setRes1 = await request(app).put(`/api/grades/course/${createdCourseId}/items`).set('Authorization', `Bearer ${teacherToken}`).send({ items: splitItems });
    expect(setRes1.status).toBe(200);
    expect(setRes1.body.data.length).toBe(5);

    // Grade Assignment 1 = 80
    const gradeRes = await request(app)
      .post(`/api/grades/course/${createdCourseId}/student-grade`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentId: student1.id, gradeItemId: asgItem.id, score: 80 });
    expect(gradeRes.status).toBe(200);

    // Edit weights (Assignment 1 -> 15%, Final -> 35%) keeping IDs -> student_grades MUST NOT be wiped!
    const updatedItems = setRes1.body.data.map((i: any) => {
      if (i.id === asgItem.id) return { ...i, weight: 15 };
      if (i.id === finItem.id) return { ...i, weight: 35 };
      return i;
    });
    const setRes2 = await request(app).put(`/api/grades/course/${createdCourseId}/items`).set('Authorization', `Bearer ${teacherToken}`).send({ items: updatedItems });
    expect(setRes2.status).toBe(200);

    // Verify student grade preserved and Exclude Empty Grades gives running score 80 (B, 3.00), NOT 12% F!
    const stuCourseGb = await request(app).get(`/api/grades/student/course/${createdCourseId}`).set('Authorization', `Bearer ${student1Token}`);
    expect(stuCourseGb.status).toBe(200);
    expect(stuCourseGb.body.data.courseId).toBe(createdCourseId);
    expect(stuCourseGb.body.data.totalScore).toBe(80);
    expect(stuCourseGb.body.data.letterGrade).toBe('B');
    expect(stuCourseGb.body.data.gradePoints).toBe(3);
    const preservedAsg1 = stuCourseGb.body.data.items.find((i: any) => i.gradeItemId === asgItem.id);
    expect(preservedAsg1.score).toBe(80);

    // GPA now reflects 4 graded credits = 3.00
    const gpa1 = await request(app).get('/api/grades/student/gpa').set('Authorization', `Bearer ${student1Token}`);
    expect(gpa1.status).toBe(200);
    expect(gpa1.body.data.gradedCredits).toBe(4);
    expect(gpa1.body.data.gpa).toBe(3);

    // Batch save grades for studentFrozen and student1 -> updates both without rate-limit/race issues
    const batchRes = await request(app)
      .post(`/api/grades/course/${createdCourseId}/student-grades/batch`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        entries: [
          { studentId: student1.id, gradeItemId: asgItem.id, score: 80 },
          { studentId: studentFrozen.id, gradeItemId: midItem.id, score: 90 },
        ],
      });
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.updatedCount).toBe(2);
  });

  test('5. Unified QR/TOTP Session, Immediate qr_secret, Enrollment & Freeze & Anti-Proxy & Reports Override Sync', async () => {
    const sessRes = await request(app)
      .post('/api/attendance/teacher/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        course_id: createdCourseId,
        date: new Date().toISOString().split('T')[0],
        time: '11:00:00',
        room: 'Hall 305',
      });
    expect(sessRes.status).toBe(201);
    const sessionId = sessRes.body.data.id;
    expect(sessRes.body.data.room).toBe('Hall 305');

    // Verify qr_secret is IMMEDIATELY populated in DB (never NULL)
    const [sRows]: any = await pool.query('SELECT qr_secret FROM attendance_sessions WHERE id = ?', [sessionId]);
    expect(sRows[0]?.qr_secret).toBeTruthy();

    // Fake HMAC must be rejected immediately
    const nowWin = Math.floor(Date.now() / 1000 / 20);
    const fakeRes = await request(app)
      .post('/api/attendance/student/scan')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ qr_code: `HADIR:${sessionId}:${nowWin}:FAKEHMAC`, device_fingerprint: 'fp-m1-1' });
    expect(fakeRes.status).toBe(400);

    // Live QR & Refresh QR
    const liveRes = await request(app).get(`/api/attendance/teacher/sessions/${sessionId}/live-qr`).set('Authorization', `Bearer ${teacherToken}`);
    expect(liveRes.status).toBe(200);
    const liveQr = liveRes.body.data.qrCode;

    // Unenrolled student2 cannot see active session and cannot scan
    const activeS2 = await request(app).get('/api/attendance/student/sessions/active').set('Authorization', `Bearer ${student2Token}`);
    expect(activeS2.status).toBe(200);
    expect(activeS2.body.data.some((s: any) => s.id === sessionId)).toBe(false);

    const unenrolledScan = await request(app)
      .post('/api/attendance/student/scan')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ qr_code: liveQr, device_fingerprint: 'fp-m1-2' });
    expect(unenrolledScan.status).toBe(403);

    // Frozen student CAN read Hero/courses/GPA/reports/active-sessions (C1), but CANNOT scan QR (403 ACCOUNT_FROZEN)
    const frozenCourses = await request(app).get('/api/courses/student').set('Authorization', `Bearer ${studentFrozenToken}`);
    expect(frozenCourses.status).toBe(200);
    expect(frozenCourses.body.data.length).toBe(1);

    const frozenGpa = await request(app).get('/api/grades/student/gpa').set('Authorization', `Bearer ${studentFrozenToken}`);
    expect(frozenGpa.status).toBe(200);

    const frozenReports = await request(app).get('/api/reports/student').set('Authorization', `Bearer ${studentFrozenToken}`);
    expect(frozenReports.status).toBe(200);
    expect(frozenReports.body.data.enrolledCourses).toBe(1);

    const frozenScan = await request(app)
      .post('/api/attendance/student/scan')
      .set('Authorization', `Bearer ${studentFrozenToken}`)
      .send({ qr_code: liveQr, device_fingerprint: 'fp-m1-f' });
    expect(frozenScan.status).toBe(403);
    expect(frozenScan.body.code).toBe('ACCOUNT_FROZEN');

    // C12: getTeacherActiveSessions exposes live_qr + expires_in (without qr_secret) usable directly for scan
    const activeTeacherSess = await request(app).get('/api/attendance/teacher/sessions/active').set('Authorization', `Bearer ${teacherToken}`);
    expect(activeTeacherSess.status).toBe(200);
    const activeCard = activeTeacherSess.body.data.find((s: any) => s.id === sessionId);
    expect(activeCard).toBeTruthy();
    expect(activeCard.live_qr).toMatch(/^HADIR:/);
    expect(activeCard.expires_in).toBeGreaterThan(0);
    expect(activeCard.qr_secret).toBeUndefined();

    // Enrolled active student1 scans live_qr from active session card successfully & idempotently
    const scan1 = await request(app)
      .post('/api/attendance/student/scan')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ qr_code: activeCard.live_qr, device_fingerprint: 'fp-m1-shared' });
    expect(scan1.status).toBe(200);

    const scan1Dup = await request(app)
      .post('/api/attendance/student/scan')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ qr_code: liveQr, device_fingerprint: 'fp-m1-shared' });
    expect(scan1Dup.status).toBe(200);

    // Gradebook synced attendance=100% -> weighted (100*10 + 80*15)/25 = 88.00 (B+)
    const gbAfterScan = await request(app).get(`/api/grades/student/course/${createdCourseId}`).set('Authorization', `Bearer ${student1Token}`);
    expect(gbAfterScan.body.data.attendancePercentage).toBe(100);
    expect(gbAfterScan.body.data.totalScore).toBe(88);

    // Refresh QR rotates secret & returns new valid HADIR token
    const refreshQrRes = await request(app).post(`/api/attendance/teacher/sessions/${sessionId}/refresh-qr`).set('Authorization', `Bearer ${teacherToken}`);
    expect(refreshQrRes.status).toBe(200);
    expect(refreshQrRes.body.data.qr_code).toMatch(/^HADIR:/);

    // Reports teacher stats & C2 unified finalGrade override sync
    const tRep = await request(app).get('/api/reports/teacher').set('Authorization', `Bearer ${teacherToken}`);
    expect(tRep.status).toBe(200);
    expect(tRep.body.data.averageAttendance).not.toBeNull();
    expect(tRep.body.data.courses[0]).toHaveProperty('averageGrade');

    // Apply attendance_override = -1 & finalGrade = 'B' -> attendance 0%, totalScore 48, letterGrade 'B', GPA 3.00
    const updRep = await request(app)
      .put(`/api/reports/teacher/course/${createdCourseId}/update`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ updates: [{ studentId: student1.id, finalGrade: 'B', attendanceOverride: -1 }] });
    expect(updRep.status).toBe(200);

    const gbAfterOverride = await request(app).get(`/api/grades/student/course/${createdCourseId}`).set('Authorization', `Bearer ${student1Token}`);
    expect(gbAfterOverride.body.data.attendancePercentage).toBe(0);
    expect(gbAfterOverride.body.data.totalScore).toBe(48); // (0*10 + 80*15)/25 = 48
    expect(gbAfterOverride.body.data.letterGrade).toBe('B');
    expect(gbAfterOverride.body.data.gradePoints).toBe(3);

    const stuRepAfterOverride = await request(app).get('/api/reports/student').set('Authorization', `Bearer ${student1Token}`);
    expect(stuRepAfterOverride.status).toBe(200);
    expect(stuRepAfterOverride.body.data.gpa).toBe(3);
    expect(stuRepAfterOverride.body.data.courses[0].letterGrade).toBe('B');

    // Clearing finalGrade reverts to computed grade ('F', 0.00)
    const clearRep = await request(app)
      .put(`/api/reports/teacher/course/${createdCourseId}/update`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ updates: [{ studentId: student1.id, finalGrade: '', attendanceOverride: -1 }] });
    expect(clearRep.status).toBe(200);

    const gbAfterClear = await request(app).get(`/api/grades/student/course/${createdCourseId}`).set('Authorization', `Bearer ${student1Token}`);
    expect(gbAfterClear.body.data.letterGrade).toBe('F');
    expect(gbAfterClear.body.data.gradePoints).toBe(0);
  });
});
