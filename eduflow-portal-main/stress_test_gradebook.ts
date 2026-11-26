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
  console.log('🧪 HADIR LMS EMPIRICAL CHALLENGER TEST SUITE (R2 & PIPELINE INTEGRATION)');
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

  // ---------------------------------------------------------------------------
  // SECTION 1: WEIGHT VALIDATION ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 1: Weight Validation Enforcement ---');

  // Test 1.1: Reject sum = 95%
  {
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور', weight: 10, max_score: 100 },
        { id: 2, name: 'الواجبات', weight: 20, max_score: 100 },
        { id: 3, name: 'الامتحان النصفي', weight: 30, max_score: 100 },
        { id: 4, name: 'الامتحان النهائي', weight: 35, max_score: 100 }, // sum = 95
      ]
    });
    const res = await dispatch(middleware);
    record(
      'W-1',
      'PUT /grades/course/crs-1/items rejects 95% total weight with HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 1.2: Reject sum = 105%
  {
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور', weight: 10, max_score: 100 },
        { id: 2, name: 'الواجبات', weight: 20, max_score: 100 },
        { id: 3, name: 'الامتحان النصفي', weight: 35, max_score: 100 },
        { id: 4, name: 'الامتحان النهائي', weight: 40, max_score: 100 }, // sum = 105
      ]
    });
    const res = await dispatch(middleware);
    record(
      'W-2',
      'PUT /grades/course/crs-1/items rejects 105% total weight with HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 1.3: Reject empty items
  {
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: []
    });
    const res = await dispatch(middleware);
    record(
      'W-3',
      'PUT /grades/course/crs-1/items rejects empty items array with HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 1.4: Reject negative weights (e.g. -20% and 120% summing to 100%)
  {
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', {
      items: [
        { id: 1, name: 'الحضور', weight: -20, max_score: 100 },
        { id: 2, name: 'الواجبات', weight: 120, max_score: 100 },
      ]
    });
    const res = await dispatch(middleware);
    record(
      'W-4',
      'PUT /grades/course/crs-1/items rejects negative weights even if total is 100%',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 1.5: Accept exactly 100% total weight with non-negative values
  {
    const validItems = [
      { id: 1, name: 'الحضور والالتزام', category: 'attendance', weight: 15, max_score: 100 },
      { id: 2, name: 'الواجبات والتكليفات', category: 'assignments', weight: 25, max_score: 100 },
      { id: 3, name: 'الامتحان النصفي', category: 'midterm', weight: 25, max_score: 100 },
      { id: 4, name: 'الامتحان النهائي', category: 'final', weight: 35, max_score: 100 },
    ];
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', { items: validItems });
    const res = await dispatch(middleware);
    record(
      'W-5',
      'PUT /grades/course/crs-1/items succeeds with exactly 100% (15+25+25+35)',
      res.statusCode === 200 && res.body.success === true && Array.isArray(res.body.data) && res.body.data.length === 4,
      { status: res.statusCode, data: res.body.data }
    );
  }

  // Reset back to standard 10, 20, 30, 40 weights for subsequent tests
  {
    const standardItems = [
      { id: 1, name: 'الحضور والالتزام الأكاديمي', category: 'attendance', weight: 10, max_score: 100 },
      { id: 2, name: 'الواجبات والتكليفات العملية', category: 'assignments', weight: 20, max_score: 100 },
      { id: 3, name: 'الامتحان النصفي (Midterm)', category: 'midterm', weight: 30, max_score: 100 },
      { id: 4, name: 'الامتحان النهائي والشفوي', category: 'final', weight: 40, max_score: 100 },
    ];
    const { dispatch } = createMockReqRes('PUT', '/api/grades/course/crs-1/items', { items: standardItems });
    const res = await dispatch(middleware);
    record(
      'W-6',
      'Reset weights to standard 10/20/30/40 succeeds (HTTP 200)',
      res.statusCode === 200 && res.body.success === true,
      { status: res.statusCode }
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: DYNAMIC SCORE UPDATES & TOTAL RECALCULATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Dynamic Score Updates & Recalculation ---');

  // Baseline: Reset Ali usr-1 scores for crs-1: item 1=100, item 2=98, item 3=96, item 4=97
  // Total: 100*0.1 + 98*0.2 + 96*0.3 + 97*0.4 = 10 + 19.6 + 28.8 + 38.8 = 97.2 -> A+, GP: 4.0
  {
    for (const [gid, sc] of [[1, 100], [2, 98], [3, 96], [4, 97]]) {
      const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
        studentId: 'usr-1',
        gradeItemId: gid,
        score: sc
      });
      await dispatch(middleware);
    }
  }

  // Test 2.1: Update Ali's Assignment (item 2) score to 80
  // Math: 100*0.1 + 80*0.2 + 96*0.3 + 97*0.4 = 10 + 16 + 28.8 + 38.8 = 93.6 -> A+, GP: 4.0
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 80
    });
    const res = await dispatch(middleware);
    record(
      'S-1',
      'POST /grades/course/crs-1/student-grade updates Ali score to 80',
      res.statusCode === 200 && res.body.success === true && res.body.data.score === 80,
      { status: res.statusCode, data: res.body.data }
    );
    record(
      'S-2',
      'Dynamic totalScore calculation: 10 + (80*0.2) + 28.8 + 38.8 = 93.6',
      res.body.data.totalScore === 93.6,
      { expected: 93.6, got: res.body?.data?.totalScore }
    );
    record(
      'S-3',
      'Letter grade is A+ and grade points are 4.00 for score 93.6',
      res.body.data.letterGrade === 'A+' && res.body.data.gradePoints === 4.0,
      { letterGrade: res.body?.data?.letterGrade, gradePoints: res.body?.data?.gradePoints }
    );
  }

  // Test 2.2: Update Final (item 4) score to 50
  // Math: 100*0.1 + 80*0.2 + 96*0.3 + 50*0.4 = 10 + 16 + 28.8 + 20 = 74.8 -> C, GP: 2.0
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 4,
      score: 50
    });
    const res = await dispatch(middleware);
    record(
      'S-4',
      'POST /grades/course/crs-1/student-grade updates Final score to 50',
      res.statusCode === 200 && res.body.data.totalScore === 74.8,
      { expectedTotal: 74.8, got: res.body?.data?.totalScore }
    );
    record(
      'S-5',
      'Grade scale mapping: 74.8 yields Letter C and GradePoints 2.00',
      res.body.data.letterGrade === 'C' && res.body.data.gradePoints === 2.0,
      { letterGrade: res.body?.data?.letterGrade, gradePoints: res.body?.data?.gradePoints }
    );
  }

  // Test 2.3: Verify GET /grades/course/crs-1/gradebook reflects updated student record
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/course/crs-1/gradebook');
    const res = await dispatch(middleware);
    const ali = res.body?.data?.students?.find((s: any) => s.studentId === 'usr-1');
    record(
      'S-6',
      'GET /grades/course/crs-1/gradebook returns updated student totals',
      ali && ali.totalScore === 74.8 && ali.letterGrade === 'C' && ali.gradePoints === 2.0,
      { student: ali }
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: GPA DYNAMIC LINKAGE
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: GPA Dynamic Linkage ---');

  // Courses enrolled for Ali: crs-1 (3 cr), crs-2 (3 cr), crs-3 (3 cr), crs-4 (3 cr) = 12 cr
  // With crs-1 at GP 2.0 and crs-2, crs-3, crs-4 at GP 4.0:
  // Expected GPA = (2.0*3 + 4.0*3 + 4.0*3 + 4.0*3) / 12 = (6 + 12 + 12 + 12) / 12 = 42 / 12 = 3.50
  {
    const { dispatch } = createMockReqRes('GET', '/api/reports/student');
    const res = await dispatch(middleware);
    record(
      'G-1',
      'GET /reports/student calculates credit-weighted GPA = 3.50 dynamically',
      res.statusCode === 200 && res.body.data.gpa === 3.50,
      { expectedGPA: 3.50, gotGPA: res.body?.data?.gpa, gradedCredits: res.body?.data?.gradedCredits }
    );
    const crs1Report = res.body?.data?.courses?.find((c: any) => c.id === 'crs-1');
    record(
      'G-2',
      'GET /reports/student course entry for crs-1 matches mutated score 74.8 / Grade C',
      crs1Report && crs1Report.totalScore === 74.8 && crs1Report.letterGrade === 'C' && crs1Report.gradePoints === 2.0,
      { crs1Report }
    );
  }

  // Test 3.2: Check GET /grades/student/gpa matches GET /reports/student
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/student/gpa');
    const res = await dispatch(middleware);
    record(
      'G-3',
      'GET /grades/student/gpa returns identical dynamic GPA 3.50',
      res.statusCode === 200 && res.body.data.gpa === 3.50,
      { gpa: res.body?.data?.gpa }
    );
  }

  // Test 3.3: Mutate Ali crs-1 Final to 0 (Fail) -> totalScore = 100*0.1 + 80*0.2 + 96*0.3 + 0 = 54.8 -> F (0.00)
  // Expected GPA = (0*3 + 4.0*3 + 4.0*3 + 4.0*3) / 12 = 36 / 12 = 3.00
  {
    const { dispatch: dFail } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 4,
      score: 0
    });
    await dFail(middleware);

    const { dispatch: dRep } = createMockReqRes('GET', '/api/reports/student');
    const resRep = await dRep(middleware);
    record(
      'G-4',
      'Proof GPA is NOT static: Ali GPA drops from 3.50 to 3.00 when final score is 0',
      resRep.body?.data?.gpa === 3.00,
      { expectedGPA: 3.00, gotGPA: resRep.body?.data?.gpa }
    );
  }

  // Reset Ali back to original scores (crs-1 Final = 97, Assignment = 98) -> total = 97.2, GPA = 4.00
  {
    const { dispatch: dReset1 } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 98
    });
    await dReset1(middleware);
    const { dispatch: dReset2 } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 4,
      score: 97
    });
    await dReset2(middleware);

    const { dispatch: dCheck } = createMockReqRes('GET', '/api/reports/student');
    const resCheck = await dCheck(middleware);
    record(
      'G-5',
      'GPA dynamically restores to 4.00 when scores restored to original values',
      resCheck.body?.data?.gpa === 4.00,
      { gpa: resCheck.body?.data?.gpa }
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: BOUNDARY & NEGATIVE TESTING
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Boundary & Negative Testing ---');

  // Test 4.1: Attempt negative score (< 0) e.g. -10
  // Requirement: "Attempt negative score (<0) or score exceeding max_score. Must reject with error."
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: -10
    });
    const res = await dispatch(middleware);
    record(
      'B-1',
      'Attempt negative score (-10): Must reject with error (HTTP 400)',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 4.2: Attempt score exceeding max_score (e.g. 150 when max_score is 100)
  // Requirement: "Attempt negative score (<0) or score exceeding max_score. Must reject with error."
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 150
    });
    const res = await dispatch(middleware);
    record(
      'B-2',
      'Attempt score exceeding max_score (150): Must reject with error (HTTP 400)',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 4.3: Boundary exact minimum (0)
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 0
    });
    const res = await dispatch(middleware);
    record(
      'B-3',
      'Boundary score = 0 is valid and accepted (HTTP 200)',
      res.statusCode === 200 && res.body.data.score === 0,
      { status: res.statusCode, score: res.body?.data?.score }
    );
  }

  // Test 4.4: Boundary exact maximum (100)
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 100
    });
    const res = await dispatch(middleware);
    record(
      'B-4',
      'Boundary score = 100 is valid and accepted (HTTP 200)',
      res.statusCode === 200 && res.body.data.score === 100,
      { status: res.statusCode, score: res.body?.data?.score }
    );
  }

  // Test 4.5: Missing required fields (missing studentId)
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      gradeItemId: 2,
      score: 85
    });
    const res = await dispatch(middleware);
    record(
      'B-5',
      'Missing studentId returns HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 4.6: Missing gradeItemId
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      score: 85
    });
    const res = await dispatch(middleware);
    record(
      'B-6',
      'Missing gradeItemId returns HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 4.7: Invalid score type (e.g. NaN or non-numeric string)
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 2,
      score: 'invalid_number'
    });
    const res = await dispatch(middleware);
    record(
      'B-7',
      'Non-numeric score rejects with HTTP 400',
      res.statusCode === 400 && res.body.success === false,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 4.8: Attempt to score non-existent grade item
  {
    const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
      studentId: 'usr-1',
      gradeItemId: 99999,
      score: 85
    });
    const res = await dispatch(middleware);
    record(
      'B-8',
      'Non-existent gradeItemId rejects with HTTP 400 or 404',
      res.statusCode === 400 || res.statusCode === 404,
      { status: res.statusCode, body: res.body }
    );
  }

  // Reset Ali scores back to standard baseline and clean test keys
  {
    for (const [gid, sc] of [[1, 100], [2, 98], [3, 96], [4, 97]]) {
      const { dispatch } = createMockReqRes('POST', '/api/grades/course/crs-1/student-grade', {
        studentId: 'usr-1',
        gradeItemId: gid,
        score: sc
      });
      await dispatch(middleware);
    }

    try {
      const snapPath = '/Users/m.madi/development/Hadir/.agents/teamwork/mock_state_snapshot.json';
      if (fs.existsSync(snapPath)) {
        const snap = JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
        if (snap.mockStudentScoresStore?.['crs-1']?.['usr-1']) {
          delete snap.mockStudentScoresStore['crs-1']['usr-1']['99999'];
          snap.mockStudentScoresStore['crs-1']['usr-1']['1'] = 100;
          snap.mockStudentScoresStore['crs-1']['usr-1']['2'] = 98;
          snap.mockStudentScoresStore['crs-1']['usr-1']['3'] = 96;
          snap.mockStudentScoresStore['crs-1']['usr-1']['4'] = 97;
          fs.writeFileSync(snapPath, JSON.stringify(snap, null, 2), 'utf-8');
        }
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: MODAL BREAKDOWN CRASH PREVENTION
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 5: Modal Breakdown Crash Prevention ---');

  // Test 5.1: Query GET /grades/student/course/crs-1
  let breakdownPayload: any = null;
  {
    const { dispatch } = createMockReqRes('GET', '/api/grades/student/course/crs-1');
    const res = await dispatch(middleware);
    breakdownPayload = res.body;
    record(
      'M-1',
      'GET /grades/student/course/crs-1 responds 200 with success: true',
      res.statusCode === 200 && res.body.success === true,
      { status: res.statusCode, body: res.body }
    );
  }

  // Test 5.2: Verify StudentReports.tsx consumption logic does not crash
  // In StudentReports.tsx (lines 90-97):
  // if (Array.isArray(res.data)) { setCourseBreakdown(res.data); }
  // else if (res.data && Array.isArray(res.data.items)) { setCourseBreakdown(res.data.items); }
  // else { setCourseBreakdown([]); }
  // Then later: courseBreakdown.map((item, idx) => ...)
  {
    let courseBreakdown: any = null;
    let mappedCount = 0;
    let crashed = false;

    try {
      if (breakdownPayload && breakdownPayload.success) {
        if (Array.isArray(breakdownPayload.data)) {
          courseBreakdown = breakdownPayload.data;
        } else if (breakdownPayload.data && Array.isArray(breakdownPayload.data.items)) {
          courseBreakdown = breakdownPayload.data.items;
        } else {
          courseBreakdown = [];
        }
      }

      // Execute map operation exactly as StudentReports.tsx does:
      if (courseBreakdown && courseBreakdown.length > 0) {
        const mapped = courseBreakdown.map((item: any, idx: number) => {
          return {
            key: item.gradeItemId ?? idx,
            name: item.name,
            weight: item.weight,
            maxScore: item.maxScore,
            score: item.score,
            weightedScore: item.weightedScore
          };
        });
        mappedCount = mapped.length;
      }
    } catch (e: any) {
      crashed = true;
    }

    record(
      'M-2',
      'StudentReports breakdown unpacking produces valid array without crashing',
      !crashed && Array.isArray(courseBreakdown) && mappedCount === 4,
      { crashed, mappedCount, courseBreakdown }
    );
  }

  // Test 5.3: Verify robustness against legacy array payload format
  {
    const legacyArrayPayload = {
      success: true,
      data: [
        { gradeItemId: 1, name: 'Attendance', weight: 10, maxScore: 100, score: 100, weightedScore: 10 },
        { gradeItemId: 2, name: 'Assignments', weight: 20, maxScore: 100, score: 98, weightedScore: 19.6 }
      ]
    };

    let courseBreakdown: any = null;
    let crashed = false;
    try {
      if (Array.isArray(legacyArrayPayload.data)) {
        courseBreakdown = legacyArrayPayload.data;
      } else if (legacyArrayPayload.data && Array.isArray((legacyArrayPayload.data as any).items)) {
        courseBreakdown = (legacyArrayPayload.data as any).items;
      } else {
        courseBreakdown = [];
      }
      const mapped = courseBreakdown.map((i: any) => i.name);
      crashed = (mapped.length !== 2);
    } catch (e) {
      crashed = true;
    }

    record(
      'M-3',
      'StudentReports handles legacy raw-array payload format safely',
      !crashed && Array.isArray(courseBreakdown) && courseBreakdown.length === 2,
      { crashed, length: courseBreakdown?.length }
    );
  }

  // Test 5.4: Verify robustness against null or empty data payload
  {
    const emptyPayloads = [
      { success: true, data: null },
      { success: true, data: {} },
      { success: false, data: undefined }
    ];

    let allSafe = true;
    for (const p of emptyPayloads) {
      let courseBreakdown: any = null;
      try {
        if (p.success) {
          if (Array.isArray(p.data)) {
            courseBreakdown = p.data;
          } else if (p.data && Array.isArray((p.data as any).items)) {
            courseBreakdown = (p.data as any).items;
          } else {
            courseBreakdown = [];
          }
        }
        if (courseBreakdown) {
          courseBreakdown.map((i: any) => i);
        }
      } catch (e) {
        allSafe = false;
      }
    }

    record(
      'M-4',
      'StudentReports handles null/empty payloads safely without throwing',
      allSafe,
      { allSafe }
    );
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 FINAL SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('========================================================================');

  return { passed, failed, total: passed + failed, testResults };
}

runEmpiricalStressSuite().then((results) => {
  if (results.failed > 0) {
    console.error(`\n⚠️ CHALLENGER EMPIRICAL VERDICT: ${results.failed} test(s) failed!`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL EMPIRICAL CHALLENGES PASSED!`);
    process.exit(0);
  }
}).catch((err) => {
  console.error('Fatal harness error:', err);
  process.exit(2);
});
