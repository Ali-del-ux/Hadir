import { mockServerPlugin } from './mockServerPlugin.ts';
import * as fs from 'fs';
import * as path from 'path';

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
    // emit body
    if (bodyData !== null) {
      const chunk = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      (reqListeners['data'] || []).forEach(h => h(chunk));
    }
    (reqListeners['end'] || []).forEach(h => h());
    return promise;
  };

  return { req, res, dispatch };
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 Running Hadir LMS Comprehensive Verification Test Suite');
  console.log('================================================================');

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

  function assert(condition: boolean, testName: string, detail: any = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail);
      failed++;
    }
  }

  // TEST 1: Initial GPA and student report
  {
    const { dispatch } = createMockReqRes('GET', '/api/reports/student');
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'GET /reports/student returns 200 success');
    assert(typeof res.body.data.gpa === 'number', 'Student GPA is a number');
    assert(Array.isArray(res.body.data.courses) && res.body.data.courses.length >= 4, 'Student courses array is populated');
  }

  // TEST 2: Gradebook load for crs-1
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/course/crs-1/gradebook');
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.data.course.code === 'SEC-401', 'GET /grades/course/crs-1/gradebook returns SEC-401');
    assert(res.body.data.gradeItems.length === 4, 'crs-1 has 4 grade items');
    const totalWeight = res.body.data.gradeItems.reduce((s: number, i: any) => s + i.weight, 0);
    assert(Math.abs(totalWeight - 100) < 0.01, 'Grade items initial weights sum strictly to 100%');
  }

  // TEST 3: Mutate student grade (Teacher modifies Ali Bin Taher's Assignment score)
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 50 // reduced from 98 to 50
    });
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'POST /grades/course/crs-1/student-grade responds 200');
    assert(res.body.data.score === 50, 'Student score updated to 50');
    // Total was: 10% (100) + 20% (50) + 30% (96) + 40% (97) = 10 + 10 + 28.8 + 38.8 = 87.6
    assert(res.body.data.totalScore === 87.6, `Recalculated totalScore is 87.6 (got ${res.body.data.totalScore})`);
    assert(res.body.data.letterGrade === 'B+', `Recalculated letterGrade is B+ (got ${res.body.data.letterGrade})`);
  }

  // TEST 4: Verify GPA and student reports reflect the updated grade dynamically
  {
    const { dispatch } = createMockReqRes('GET', '/api/reports/student');
    const res = await dispatch(middleware);
    const sec401 = res.body.data.courses.find((c: any) => c.code === 'SEC-401');
    assert(sec401 && sec401.totalScore === 87.6, 'Student report dynamically reflects updated totalScore 87.6');
    assert(sec401 && sec401.letterGrade === 'B+', 'Student report dynamically reflects updated letterGrade B+');
  }

  // TEST 5: Verify Student Course Breakdown contract unpacking
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/student/course/crs-1');
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'GET /grades/student/course/crs-1 responds 200');
    assert(Array.isArray(res.body.data.items), 'Breakdown data.items is an array');
    const asgItem = res.body.data.items.find((i: any) => i.gradeItemId === 2);
    assert(asgItem && asgItem.score === 50 && asgItem.weightedScore === 10, 'Breakdown item reflects score 50 and weightedScore 10.0');
  }

  // TEST 6: Category weight validation (must sum strictly to 100%)
  {
    // Try invalid sum = 90%
    const { dispatch: dispatchBad } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور', weight: 10, max_score: 100 },
        { id: 2, name: 'الواجبات', weight: 20, max_score: 100 },
        { id: 3, name: 'الامتحان النصفي', weight: 30, max_score: 100 },
        { id: 4, name: 'الامتحان النهائي', weight: 30, max_score: 100 }, // sum = 90
      ]
    });
    const resBad = await dispatchBad(middleware);
    assert(resBad.statusCode === 400 && resBad.body.success === false, 'PUT /grades/course/crs-1/items rejects sum != 100 with 400');

    // Valid sum = 100%
    const { dispatch: dispatchGood } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور والالتزام الأكاديمي', weight: 15, max_score: 100 },
        { id: 2, name: 'الواجبات والتكليفات العملية', weight: 15, max_score: 100 },
        { id: 3, name: 'الامتحان النصفي (Midterm)', weight: 30, max_score: 100 },
        { id: 4, name: 'الامتحان النهائي والشفوي', weight: 40, max_score: 100 },
      ]
    });
    const resGood = await dispatchGood(middleware);
    assert(resGood.statusCode === 200 && resGood.body.success === true, 'PUT /grades/course/crs-1/items accepts valid sum = 100%');
  }

  // Reset score back to 98
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 98
    });
    await dispatch(middleware);
    // Reset items back to 10, 20, 30, 40
    const { dispatch: dWeights } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور والالتزام الأكاديمي', category: 'attendance', weight: 10, max_score: 100 },
        { id: 2, name: 'الواجبات والتكليفات العملية', category: 'assignments', weight: 20, max_score: 100 },
        { id: 3, name: 'الامتحان النصفي (Midterm)', category: 'midterm', weight: 30, max_score: 100 },
        { id: 4, name: 'الامتحان النهائي والشفوي', category: 'final', weight: 40, max_score: 100 },
      ]
    });
    await dWeights(middleware);
  }

  // TEST 7: Teacher Attendance Session Creation
  let createdSessionId = '';
  let createdSessionQr = '';
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/teacher/sessions', {
      course_id: 'crs-1',
      date: '2026-11-17',
      time: '10:00',
      room: 'قاعة إدوارد سنودن - مدرج 101'
    });
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'POST /attendance/teacher/sessions creates session');
    assert(res.body.data.course_code === 'SEC-401', 'Session linked to SEC-401');
    assert(res.body.data.room === 'قاعة إدوارد سنودن - مدرج 101', 'Session records room correctly');
    assert(res.body.data.attendees_count === 0 && res.body.data.attendees.length === 0, 'New session starts with 0 attendees');
    assert(typeof res.body.data.qrCode === 'string' && res.body.data.qrCode.startsWith('HADIR:'), 'Dynamic TOTP QR code generated');
    createdSessionId = res.body.data.id;
    createdSessionQr = res.body.data.qrCode;
  }

  // TEST 8: Live QR polling and TOTP rotation
  {
    const { dispatch } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${createdSessionId}/live-qr`);
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'GET /live-qr responds 200');
    assert(res.body.data.attendeesCount === 0, 'Live QR reports 0 attendees');
    assert(res.body.data.expiresIn <= 20 && res.body.data.expiresIn > 0, 'expiresIn is valid 20s window');
    if (res.body?.data?.qrCode) {
      createdSessionQr = res.body.data.qrCode;
    }
  }

  // TEST 9: Student scan check-in
  {
    const { dispatch } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: createdSessionQr,
      device_fingerprint: 'dev_test_device_1'
    });
    const res = await dispatch(middleware);
    assert(res.statusCode === 200 && res.body.success === true, 'POST /attendance/student/scan registers check-in');
    assert(res.body.data.status === 'present', 'Status is present');
  }

  // TEST 10: Verify live attendee count incremented to 1
  {
    const { dispatch } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${createdSessionId}/live-qr`);
    const res = await dispatch(middleware);
    assert(res.body.data.attendeesCount === 1, 'Live QR counter immediately incremented from 0 to 1');

    const { dispatch: dAttendees } = createMockReqRes('GET', `/api/attendance/teacher/sessions/${createdSessionId}/attendees`);
    const resAtt = await dAttendees(middleware);
    assert(resAtt.body.data.length === 1, 'Attendees array length matches attendeesCount (1)');
    assert(resAtt.body.data[0].student_number === '2340033', 'Attendee student is Ali Bin Taher');
  }

  // TEST 11: Freeze gate verification
  {
    // Freeze student
    const { dispatch: dFreeze } = createMockReqRes('POST', '/api/admin/financials/freeze', {
      student_id: '2340033',
      reason: 'تجميد اختباري'
    });
    await dFreeze(middleware);

    // Try scan while frozen
    const { dispatch: dScanFrozen } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: createdSessionQr
    });
    const resScanFrozen = await dScanFrozen(middleware);
    assert(resScanFrozen.statusCode === 403, 'Frozen student scan is blocked with 403');

    // Unfreeze student
    const { dispatch: dUnfreeze } = createMockReqRes('POST', '/api/admin/financials/unfreeze', {
      student_id: '2340033'
    });
    await dUnfreeze(middleware);

    // Try scan after unfreeze
    const { dispatch: dScanUnfrozen } = createMockReqRes('POST', '/api/attendance/student/scan', {
      qr_code: createdSessionQr
    });
    const resScanUnfrozen = await dScanUnfrozen(middleware);
    assert(resScanUnfrozen.statusCode === 200, 'Unfrozen student scan succeeds with 200');
  }

  // TEST 12: Snapshot file persistence check
  {
    const snapshotPath = '/Users/m.madi/development/Hadir/.agents/teamwork/mock_state_snapshot.json';
    const exists = fs.existsSync(snapshotPath);
    assert(exists, `Snapshot JSON file exists at ${snapshotPath}`);
    if (exists) {
      const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
      assert(data.mockGradeItemsStore && data.mockGradeItemsStore['crs-1'], 'Snapshot has mockGradeItemsStore');
      assert(data.mockAttendanceSessions && data.mockAttendanceSessions.length > 0, 'Snapshot has mockAttendanceSessions');
      assert(data.mockFinancialStudents && data.mockFinancialStudents.length > 0, 'Snapshot has mockFinancialStudents');
    }
  }

  console.log('================================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
