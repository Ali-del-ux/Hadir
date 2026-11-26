import { mockServerPlugin } from './mockServerPlugin.ts';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

interface SimulatedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

function createMockReqRes(method: string, url: string, bodyData: any = null, headers: Record<string, string> = {}) {
  const reqListeners: Record<string, Function[]> = {};
  const req: any = {
    method,
    url,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    on(event: string, handler: Function) {
      if (!reqListeners[event]) reqListeners[event] = [];
      reqListeners[event].push(handler);
      return req;
    }
  };

  let resolvePromise: (value: SimulatedResponse) => void;
  const promise = new Promise<SimulatedResponse>((resolve) => {
    resolvePromise = resolve;
  });

  const res: any = {
    statusCode: 200,
    headers: {},
    setHeader(name: string, val: string) {
      this.headers[name.toLowerCase()] = val;
    },
    end(data: string) {
      let parsed = data;
      try {
        parsed = JSON.parse(data);
      } catch (e) {}
      resolvePromise({
        statusCode: this.statusCode,
        headers: this.headers,
        body: parsed
      });
    }
  };

  const dispatch = async (middleware: Function) => {
    middleware(req, res, () => {});
    if (bodyData !== null) {
      const chunk = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      (reqListeners['data'] || []).forEach(h => h(chunk));
    }
    (reqListeners['end'] || []).forEach(h => h());
    return promise;
  };

  return { req, res, dispatch };
}

async function runEmpiricalStressSuite() {
  console.log('========================================================================');
  console.log('🧪 HADIR LMS EMPIRICAL CHALLENGER TEST SUITE: R3 & R4 STRESS HARNESS');
  console.log('   (Schedule, Dynamic TOTP QR, Scan Propagation, Freeze & Persistence)');
  console.log('========================================================================');

  const plugin: any = mockServerPlugin();
  let middleware: Function | null = null;
  const fakeServer: any = {
    middlewares: {
      use(fn: Function) {
        middleware = fn;
      }
    }
  };
  plugin.configureServer(fakeServer);

  if (!middleware) {
    throw new Error('Plugin failed to register middleware');
  }

  let passed = 0;
  let failed = 0;
  const testResults: Array<{ id: string; name: string; pass: boolean; details: any }> = [];

  function record(id: string, name: string, condition: boolean, details: any = '') {
    if (condition) {
      console.log(`✅ [PASS] ${id}: ${name}`);
      passed++;
      testResults.push({ id, name, pass: true, details });
    } else {
      console.error(`❌ [FAIL] ${id}: ${name}`);
      console.error(`   Details:`, details);
      failed++;
      testResults.push({ id, name, pass: false, details });
    }
  }

  // ===========================================================================
  // SECTION 1: COURSE SCHEDULE TO SESSION LINKAGE
  // ===========================================================================
  console.log('\n--- Section 1: Course Schedule to Session Linkage ---');

  // Test 1.1: Verify course schedule slots exist in /courses
  {
    const { dispatch } = createMockReqRes('GET', '/api/courses');
    const res = await dispatch(middleware);
    const courses = res.body.data;
    const crs1 = courses.find((c: any) => c.id === 'crs-1');
    const crs2 = courses.find((c: any) => c.id === 'crs-2');
    const crs3 = courses.find((c: any) => c.id === 'crs-3');

    record(
      'SCH-1.1',
      'Course schedule slots (schedule_day, schedule_time, room) present in mockCoursesList',
      crs1 && crs1.schedule_day === 'الأحد - الثلاثاء' &&
      crs1.schedule_time === '10:00 - 11:30 صباحاً' &&
      crs1.room === 'قاعة إدوارد سنودن - مدرج 101' &&
      crs2 && crs2.room === 'مختبر المعالجات الدقيقة - معمل 2' &&
      crs3 && crs3.room === 'قاعة الخوارزمي - مبنى التقنية',
      { crs1, crs2, crs3 }
    );
  }

  // Test 1.2: Create session with explicit room & schedule data
  let sessionCrs1Id = '';
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-1',
      date: '2026-11-20',
      time: '10:00',
      room: 'قاعة إدوارد سنودن - مدرج 101'
    });
    const res = await dispatch(middleware);
    sessionCrs1Id = res.body.data?.id;

    record(
      'SCH-1.2',
      'POST /attendance/teacher/sessions stores room and course schedule metadata',
      res.statusCode === 200 &&
      res.body.success === true &&
      res.body.data.course_id === 'crs-1' &&
      res.body.data.room === 'قاعة إدوارد سنودن - مدرج 101' &&
      res.body.data.schedule_day === 'الأحد - الثلاثاء' &&
      res.body.data.schedule_time === '10:00 - 11:30 صباحاً' &&
      res.body.data.status === 'active' &&
      res.body.data.attendees_count === 0,
      res.body
    );
  }

  // Test 1.3: Create session WITHOUT room: verify it inherits room from course schedule
  let sessionCrs2Id = '';
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-2',
      date: '2026-11-21',
      time: '12:00'
    });
    const res = await dispatch(middleware);
    sessionCrs2Id = res.body.data?.id;

    record(
      'SCH-1.3',
      'POST /attendance/teacher/sessions without room automatically inherits course schedule room',
      res.statusCode === 200 &&
      res.body.data.course_id === 'crs-2' &&
      res.body.data.room === 'مختبر المعالجات الدقيقة - معمل 2' &&
      res.body.data.schedule_day === 'الإثنين - الأربعاء',
      res.body.data
    );
  }

  // Test 1.4: Create session with custom room override
  let sessionCrs3Id = '';
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-3',
      date: '2026-11-22',
      time: '09:00',
      room: 'مدرج ابن خلدون المطور - قاعة 5'
    });
    const res = await dispatch(middleware);
    sessionCrs3Id = res.body.data?.id;

    record(
      'SCH-1.4',
      'POST /attendance/teacher/sessions preserves explicit custom room override',
      res.statusCode === 200 &&
      res.body.data.room === 'مدرج ابن خلدون المطور - قاعة 5',
      res.body.data
    );
  }

  // Test 1.5: Course sessions query
  {
    const { dispatch } = createMockReqRes('GET', '/api/attendance/teacher/course/crs-1/sessions');
    const res = await dispatch(middleware);
    const found = res.body.data.some((s: any) => s.id === sessionCrs1Id);

    record(
      'SCH-1.5',
      'GET /attendance/teacher/course/:id/sessions returns newly created session in course session history',
      res.statusCode === 200 && Array.isArray(res.body.data) && found,
      { count: res.body.data.length, found }
    );
  }

  // Test 1.6: Boundary test: session creation with non-existent course_id falls back safely
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-nonexistent-999',
      date: '2026-11-25',
      time: '14:00'
    });
    const res = await dispatch(middleware);

    record(
      'SCH-1.6',
      'POST /attendance/teacher/sessions with invalid course_id degrades safely without throwing 500',
      res.statusCode === 200 && res.body.success === true && typeof res.body.data.id === 'string',
      res.body
    );
  }

  // ===========================================================================
  // SECTION 2: DYNAMIC TOTP QR GENERATION, EXPIRATION & ROTATION
  // ===========================================================================
  console.log('\n--- Section 2: Dynamic TOTP QR Generation & Rotation ---');

  // Test 2.1: TOTP format validation
  let liveQr1 = '';
  {
    const { dispatch } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const res = await dispatch(middleware);
    liveQr1 = res.body.data?.qrCode;

    const totpRegex = /^HADIR:[a-zA-Z0-9_-]+:[0-9]+:[0-9A-F]{8}$/;
    const isValidFormat = totpRegex.test(liveQr1);

    record(
      'TOTP-2.1',
      'GET /live-qr generates valid TOTP string matching HADIR:<sessionId>:<window>:<token>',
      res.statusCode === 200 && isValidFormat,
      { qrCode: liveQr1, match: isValidFormat }
    );
  }

  // Test 2.2: expiresIn validation
  {
    const { dispatch } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const res = await dispatch(middleware);
    const exp = res.body.data?.expiresIn;

    record(
      'TOTP-2.2',
      'GET /live-qr returns expiresIn within strict 20s window [1, 20]',
      typeof exp === 'number' && exp >= 1 && exp <= 20,
      { expiresIn: exp }
    );
  }

  // Test 2.3: Zero attendees initially reported on live-qr
  {
    const { dispatch } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const res = await dispatch(middleware);

    record(
      'TOTP-2.3',
      'GET /live-qr initially returns attendeesCount = 0 for fresh session',
      res.body.data?.attendeesCount === 0,
      res.body.data
    );
  }

  // Test 2.4: Determinism test: calling live-qr repeatedly in immediate succession yields consistent QR
  {
    const { dispatch: d1 } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const res1 = await d1(middleware);
    const { dispatch: d2 } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const res2 = await d2(middleware);

    record(
      'TOTP-2.4',
      'Immediate subsequent /live-qr queries within same interval return deterministic TOTP token',
      res1.body.data.qrCode === res2.body.data.qrCode,
      { qr1: res1.body.data.qrCode, qr2: res2.body.data.qrCode }
    );
  }

  // Test 2.5: POST /refresh-qr rotates/refreshes QR code
  {
    const { dispatch } = createMockReqRes('POST', `/api/attendance/teacher/sessions/${sessionCrs1Id}/refresh-qr`, {});
    const res = await dispatch(middleware);

    record(
      'TOTP-2.5',
      'POST /attendance/teacher/sessions/:id/refresh-qr refreshes and returns rotated QR token',
      res.statusCode === 200 &&
      res.body.success === true &&
      typeof res.body.data.qr_code === 'string' &&
      res.body.data.qr_code.startsWith(`HADIR:${sessionCrs1Id}:`),
      res.body
    );
  }

  // Test 2.6: POST /close session terminates active state
  {
    const { dispatch } = createMockReqRes('POST', `/api/attendance/teacher/sessions/${sessionCrs3Id}/close`, {});
    const res = await dispatch(middleware);

    record(
      'TOTP-2.6',
      'POST /attendance/teacher/sessions/:id/close sets session status to closed with timestamp',
      res.statusCode === 200 &&
      res.body.data.status === 'closed' &&
      typeof res.body.data.closed_at === 'string',
      res.body.data
    );
  }

  // ===========================================================================
  // SECTION 3: STUDENT SCAN, LIVE ATTENDEE INCREMENT & ACADEMIC PROPAGATION
  // ===========================================================================
  console.log('\n--- Section 3: Student Scan, Live Attendee Increment & Academic Propagation ---');

  // Test 3.1: Active student scan on sessionCrs1
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: liveQr1,
      device_fingerprint: 'device-test-challenger-mac'
    });
    const res = await dispatch(middleware);

    record(
      'SCAN-3.1',
      'POST /attendance/student/scan records check-in and responds with status present',
      res.statusCode === 200 &&
      res.body.success === true &&
      res.body.data.status === 'present' &&
      res.body.data.session_id === sessionCrs1Id,
      res.body
    );
  }

  // Test 3.2: Counter synchronization: /live-qr attendeesCount == 1 and /attendees.length == 1 (NO FLICKERING)
  {
    const { dispatch: dLive } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const resLive = await dLive(middleware);

    const { dispatch: dAtt } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/attendees`);
    const resAtt = await dAtt(middleware);

    record(
      'SCAN-3.2',
      'Live attendee counter strictly synchronized between /live-qr (1) and /attendees (1) with 0 discrepancy',
      resLive.body.data.attendeesCount === 1 &&
      Array.isArray(resAtt.body.data) &&
      resAtt.body.data.length === 1 &&
      resAtt.body.data[0].student_number === '2340033' &&
      resAtt.body.data[0].student_name === 'علي بن طاهر',
      { liveCount: resLive.body.data.attendeesCount, attendeesLength: resAtt.body.data.length }
    );
  }

  // Test 3.3: Idempotency & Duplicate Scan Stress
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: liveQr1,
      device_fingerprint: 'device-test-challenger-mac'
    });
    const res = await dispatch(middleware);

    const { dispatch: dCheck } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const resCheck = await dCheck(middleware);

    record(
      'SCAN-3.3',
      'Duplicate student scan is idempotent: attendeesCount remains strictly 1 and does not duplicate',
      res.statusCode === 200 && resCheck.body.data.attendeesCount === 1,
      { statusCode: res.statusCode, attendeesCount: resCheck.body.data.attendeesCount }
    );
  }

  // Test 3.4: Academic Gradebook Synchronization on crs-1
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/course/crs-1/gradebook');
    const res = await dispatch(middleware);

    const ali = res.body.data.students.find((s: any) => s.studentId === 'usr-1' || s.student_id === 'usr-1' || s.id === 'usr-1');
    const attItem = res.body.data.gradeItems.find((i: any) => i.category === 'attendance');
    const attScore = ali ? ali.scores[attItem.id] : null;

    record(
      'SCAN-3.4',
      'Scan attendance synchronizes Attendance grade item (category: attendance) to 100% in Gradebook',
      attScore === 100,
      { attendanceItemId: attItem?.id, studentScore: attScore }
    );
  }

  // Test 3.5: Dynamic Propagation to Student Reports & GPA
  {
    const { dispatch } = createMockReqRes('GET', '/api/reports/student');
    const res = await dispatch(middleware);

    const crs1Report = res.body.data.courses.find((c: any) => c.id === 'crs-1');

    record(
      'SCAN-3.5',
      'Student reports & GPA reflect synchronized attendance points and verified attendance percentage',
      res.statusCode === 200 &&
      typeof res.body.data.gpa === 'number' &&
      crs1Report &&
      crs1Report.attendancePercentage > 0,
      { gpa: res.body.data.gpa, crs1Report }
    );
  }

  // Test 3.6: Scan on second course (crs-2): verifies dynamic item mapping (id: 5)
  {
    // First, verify crs-2 live QR
    const { dispatch: dLive2 } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs2Id}/live-qr`);
    const resLive2 = await dLive2(middleware);
    const qr2 = resLive2.body.data.qrCode;

    // Scan for crs-2
    const { dispatch: dScan2 } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: qr2
    });
    const resScan2 = await dScan2(middleware);

    // Verify Gradebook for crs-2 has score 100 for item 5
    const { dispatch: dGb2 } = createMockReqRes('GET', '/api/grades/course/crs-2/gradebook');
    const resGb2 = await dGb2(middleware);
    const ali2 = resGb2.body.data.students.find((s: any) => s.studentId === 'usr-1' || s.student_id === 'usr-1' || s.id === 'usr-1');
    const attItem2 = resGb2.body.data.gradeItems.find((i: any) => i.category === 'attendance');

    record(
      'SCAN-3.6',
      'Scan dynamically synchronizes course-specific attendance item (crs-2, item 5) to 100%',
      resScan2.statusCode === 200 &&
      ali2 &&
      ali2.scores[attItem2.id] === 100,
      { attItem2Id: attItem2?.id, score: ali2?.scores[attItem2?.id] }
    );
  }

  // Test 3.7: High Concurrency Burst (25 simultaneous scan requests)
  {
    const burstPromises = Array.from({ length: 25 }, (_, i) => {
      const { dispatch } = createMockReqRes('POST', '/api/attendance/student/scan', {
        qr_code: liveQr1,
        device_fingerprint: `device-burst-challenger-${i}`
      });
      return dispatch(middleware);
    });

    const results = await Promise.all(burstPromises);
    const allSuccessful = results.every(r => r.statusCode === 200);

    const { dispatch: dLive } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const resLive = await dLive(middleware);

    record(
      'SCAN-3.7',
      'High concurrency burst (25 simultaneous scans) completes without race conditions or count corruption',
      allSuccessful && resLive.body.data.attendeesCount === 1,
      { allSuccessful, finalAttendeesCount: resLive.body.data.attendeesCount }
    );
  }

  // ===========================================================================
  // SECTION 4: ANTI-PROXY, SECURITY & FREEZE ENFORCEMENT
  // ===========================================================================
  console.log('\n--- Section 4: Anti-Proxy, Security & Freeze Enforcement ---');

  // Test 4.1: Freeze student account via admin financials
  {
    const { dispatch } = createMockReqRes('POST', '/api/admin/financials/freeze', {
      student_id: '2340033',
      reason: 'تجميد إداري ومالي لاختبار منظومة الحظر'
    });
    const res = await dispatch(middleware);

    record(
      'SEC-4.1',
      'POST /admin/financials/freeze successfully suspends student account and syncs across stores',
      res.statusCode === 200 && res.body.data.is_frozen === true,
      res.body
    );
  }

  // Test 4.2: Frozen student scan is strictly rejected with HTTP 403 Forbidden
  let sessionFrozenTestId = '';
  {
    // Create new session to test scan rejection cleanly
    const { dispatch: dSess } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-1',
      date: '2026-11-23',
      time: '11:00'
    });
    const resSess = await dSess(middleware);
    sessionFrozenTestId = resSess.body.data.id;
    const newQr = resSess.body.data.qrCode;

    // Scan attempt by frozen student
    const { dispatch } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: newQr,
      device_fingerprint: 'device-challenger-frozen'
    });
    const res = await dispatch(middleware);

    // Verify session attendee count remains 0
    const { dispatch: dAtt } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionFrozenTestId}/live-qr`);
    const resAtt = await dAtt(middleware);

    record(
      'SEC-4.2',
      'Frozen student scan attempt is strictly REJECTED with HTTP 403 Forbidden and attendee count remains 0',
      res.statusCode === 403 &&
      res.body.success === false &&
      res.body.message.includes('مجمد') &&
      resAtt.body.data.attendeesCount === 0,
      { statusCode: res.statusCode, message: res.body.message, attendeesCount: resAtt.body.data.attendeesCount }
    );
  }

  // Test 4.3: Unfreeze student account and verify scan succeeds
  {
    const { dispatch: dUnfreeze } = createMockReqRes('POST', '/api/admin/financials/unfreeze', {
      student_id: '2340033'
    });
    const resUnfreeze = await dUnfreeze(middleware);

    // Scan the same session after unfreeze
    const { dispatch: dLive } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionFrozenTestId}/live-qr`);
    const resLive = await dLive(middleware);
    const unfreezeQr = resLive.body.data.qrCode;

    const { dispatch: dScan } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: unfreezeQr
    });
    const resScan = await dScan(middleware);

    record(
      'SEC-4.3',
      'Unfreezing student immediately restores attendance check-in capability (HTTP 200)',
      resUnfreeze.statusCode === 200 &&
      resUnfreeze.body.data.is_frozen === false &&
      resScan.statusCode === 200 &&
      resScan.body.success === true,
      { resUnfreeze: resUnfreeze.body, resScan: resScan.body }
    );
  }

  // Test 4.4: Adversarial scan with malformed QR codes
  {
    // Empty QR code
    const { dispatch: dEmpty } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: ''
    });
    const resEmpty = await dEmpty(middleware);

    // Arbitrary non-TOTP text
    const { dispatch: dGarbage } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: 'MALFORMED_NON_TOTP_TEXT_12345'
    });
    const resGarbage = await dGarbage(middleware);

    record(
      'SEC-4.4',
      'Adversarial malformed QR tokens do not crash server and resolve safely',
      resEmpty.statusCode !== 500 && resGarbage.statusCode !== 500,
      { emptyStatus: resEmpty.statusCode, garbageStatus: resGarbage.statusCode }
    );
  }

  // Test 4.5: Anti-Proxy device fingerprint enforcement
  {
    const { dispatch: dLive } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${sessionCrs1Id}/live-qr`);
    const resLive = await dLive(middleware);
    const currentQr = resLive.body.data.qrCode;

    // Student Ali (usr-1) already checked in with 'device-test-challenger-mac' in Test 3.1
    // Attempt scan for different student (usr-2) using the exact same device fingerprint
    const { dispatch: dProxy } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: currentQr,
      student_id: 'usr-2',
      student_number: '2450191',
      device_fingerprint: 'device-test-challenger-mac'
    });
    const resProxy = await dProxy(middleware);

    record(
      'SEC-4.5',
      'Anti-Proxy check: Scanner rejects duplicate device fingerprint for different student with HTTP 400',
      resProxy.statusCode === 400 && resProxy.body.success === false && resProxy.body.message.includes('تم استخدام هذا الجهاز'),
      { statusCode: resProxy.statusCode, body: resProxy.body }
    );
  }

  // ===========================================================================
  // SECTION 5: CROSS-ROLE STATE SNAPSHOT PERSISTENCE
  // ===========================================================================
  console.log('\n--- Section 5: Cross-Role State Snapshot Persistence ---');

  const snapshotPath = '/Users/m.madi/development/Hadir/.agents/teamwork/mock_state_snapshot.json';

  // Test 5.1: File existence and structural integrity
  let snapshotData: any = null;
  {
    const fileExists = fs.existsSync(snapshotPath);
    let validJson = false;
    let hasAllStores = false;

    if (fileExists) {
      try {
        const content = fs.readFileSync(snapshotPath, 'utf-8');
        snapshotData = JSON.parse(content);
        validJson = true;
        hasAllStores = Boolean(
          snapshotData.mockGradeItemsStore &&
          snapshotData.mockStudentScoresStore &&
          snapshotData.mockAttendanceSessions &&
          snapshotData.mockFinancialStudents &&
          snapshotData.mockUsersList &&
          snapshotData.mockCoursesList &&
          snapshotData.mockEnrollmentsMap
        );
      } catch (e) {
        validJson = false;
      }
    }

    record(
      'PER-5.1',
      'Snapshot file exists on disk and contains valid JSON with all 7 authoritative system stores',
      fileExists && validJson && hasAllStores,
      { fileExists, validJson, hasAllStores, topKeys: snapshotData ? Object.keys(snapshotData) : [] }
    );
  }

  // Test 5.2: Verification that newly created sessions exist in the snapshot file on disk
  {
    const sessionFoundInSnapshot = snapshotData?.mockAttendanceSessions?.some(
      (s: any) => s.id === sessionCrs1Id
    );

    record(
      'PER-5.2',
      'Newly created attendance sessions are persisted directly into mock_state_snapshot.json',
      Boolean(sessionFoundInSnapshot),
      { sessionCrs1Id, found: sessionFoundInSnapshot }
    );
  }

  // Test 5.3: Verification that student attendance check-ins persist in the snapshot file
  {
    const targetSession = snapshotData?.mockAttendanceSessions?.find(
      (s: any) => s.id === sessionCrs1Id
    );
    const attendeeSaved = targetSession?.attendees?.some(
      (a: any) => a.student_number === '2340033'
    );

    record(
      'PER-5.3',
      'Student attendee records and counts persist in mockAttendanceSessions within snapshot file',
      Boolean(attendeeSaved && targetSession.attendees_count >= 1),
      { attendeesCount: targetSession?.attendees_count, attendeeSaved }
    );
  }

  // Test 5.4: Process restart simulation: Spawn an independent Node process to test cold hydration
  {
    const childVerificationCode = `
      const { mockServerPlugin } = require('./mockServerPlugin.ts');
      const plugin = mockServerPlugin();
      let middleware = null;
      plugin.configureServer({ middlewares: { use: fn => { middleware = fn; } } });

      const reqListeners = {};
      const req = {
        method: 'GET',
        url: '/api/attendance/teacher/sessions/${sessionCrs1Id}/attendees',
        headers: { 'content-type': 'application/json' },
        on(evt, fn) { (reqListeners[evt] = reqListeners[evt] || []).push(fn); return req; }
      };
      const res = {
        statusCode: 200,
        headers: {},
        setHeader() {},
        end(data) {
          const parsed = JSON.parse(data);
          const hasAli = parsed.data && parsed.data.some(a => a.student_number === '2340033');
          if (hasAli) {
            console.log('HYDRATION_SUCCESS');
            process.exit(0);
          } else {
            console.error('HYDRATION_FAILED', parsed);
            process.exit(2);
          }
        }
      };
      middleware(req, res, () => {});
      (reqListeners['end'] || []).forEach(h => h());
    `;

    const child = spawnSync('node', ['--experimental-strip-types', '-e', childVerificationCode], {
      cwd: path.resolve(process.cwd(), 'eduflow-portal-main'),
      encoding: 'utf-8'
    });

    const isHydrationSuccess = child.stdout.includes('HYDRATION_SUCCESS') && child.status === 0;

    record(
      'PER-5.4',
      'Cold process restart hydration: fresh Node instance correctly re-hydrates state from snapshot',
      isHydrationSuccess,
      { exitCode: child.status, stdout: child.stdout.trim(), stderr: child.stderr.trim() }
    );
  }

  // ===========================================================================
  // SECTION 6: ADVERSARIAL CHALLENGES & REMEDIATION VERIFICATION
  // ===========================================================================
  console.log('\n--- Section 6: Adversarial Challenges & Remediation Verification ---');

  // Challenge 6.1: Scanning a CLOSED session token
  {
    // Create dedicated session for crs-4, close it, and scan its QR code
    const { dispatch: dCreateCrs4 } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-4',
      date: '2026-11-20',
      time: '15:00'
    });
    const resCreateCrs4 = await dCreateCrs4(middleware);
    const crs4SessionId = resCreateCrs4.body.data.id;
    const crs4QrCode = resCreateCrs4.body.data.qrCode;

    // Explicitly close the session
    const { dispatch: dCloseCrs4 } = createMockReqRes('POST', `/api/attendance/teacher/sessions/${crs4SessionId}/close`, {});
    await dCloseCrs4(middleware);

    // Attempt scan on this closed session
    const { dispatch: dScanClosed } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: crs4QrCode
    });
    const resScanClosed = await dScanClosed(middleware);

    const closedSessionRejected = resScanClosed.statusCode === 400 &&
      resScanClosed.body.success === false &&
      resScanClosed.body.message === 'جلسة الحضور مغلقة';

    record(
      'ADV-6.1',
      'Remediation Verified: Scanning closed session QR is strictly rejected with HTTP 400',
      closedSessionRejected,
      {
        closedSessionAttempted: crs4SessionId,
        responseStatus: resScanClosed.statusCode,
        message: resScanClosed.body.message
      }
    );
  }

  // Challenge 6.2: Non-existent Session ID
  {
    const fakeSessionId = 'ses-fake-nonexistent-9999';
    const { dispatch: dFakeScan } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: `HADIR:${fakeSessionId}:WINDOW:HASH`
    });
    const resFakeScan = await dFakeScan(middleware);

    const nonExistentRejected = resFakeScan.statusCode === 404 &&
      resFakeScan.body.success === false &&
      resFakeScan.body.message === 'جلسة الحضور غير موجودة';

    record(
      'ADV-6.2',
      'Remediation Verified: Scanning QR token for non-existent session is strictly rejected with HTTP 404',
      nonExistentRejected,
      {
        fakeSessionId,
        responseStatus: resFakeScan.statusCode,
        message: resFakeScan.body.message
      }
    );
  }

  // Challenge 6.3: Session ID Collision Resistance
  {
    const ids = new Set<string>();
    let collisionDetected = false;
    for (let i = 0; i < 25; i++) {
      const { dispatch: dCreate } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
        course_id: 'crs-1',
        date: '2026-11-20',
        time: '10:00'
      });
      const resCreate = await dCreate(middleware);
      const id = resCreate.body?.data?.id;
      if (!id || ids.has(id)) {
        collisionDetected = true;
        break;
      }
      ids.add(id);
    }

    record(
      'ADV-6.3',
      'Remediation Verified: Session ID generation is collision-proof across rapid creations (zero collisions)',
      !collisionDetected && ids.size === 25,
      { generatedCount: ids.size, collisionDetected }
    );
  }

  // Challenge 6.4: Unverified HMAC / Token Signature Probe
  {
    const { dispatch: dForged } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: `HADIR:${sessionCrs1Id}:99999999:FORGED_FAKE_SIGNATURE`
    });
    const resForged = await dForged(middleware);

    const forgedTokenRejected = resForged.statusCode === 400 && resForged.body?.success === false;

    record(
      'ADV-6.4',
      'Remediation Verified: Scanner strictly rejects forged HMAC signatures and expired windows with HTTP 400',
      forgedTokenRejected,
      {
        statusCode: resForged.statusCode,
        forgedTokenRejected,
        message: resForged.body?.message
      }
    );
  }

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('\n========================================================================');
  console.log(`🏆 EMPIRICAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} TESTS`);
  console.log('========================================================================');

  return { passed, failed, total: passed + failed, testResults };
}

runEmpiricalStressSuite()
  .then(res => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Fatal stress suite execution error:', err);
    process.exit(1);
  });
