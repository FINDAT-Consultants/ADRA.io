/*
 * ADRA Recovery Assurance Engine — browser formula engine
 * Recreates the workbook's operational logic in dependency-free JavaScript.
 * The uploaded workbook remains the source design; this engine is its application representation.
 */
(function (global) {
  'use strict';

  const EPS = 0.01;
  const RAW = global.ADRA_WORKBOOK_DATA || {};

  const FORMULA_CATALOG = [
    { sheet: 'Dashboard', field: 'Allocable payroll', excel: "=SUM('Monthly Engine'!G5:G10)", logic: 'Sum allocable payroll across the six monthly engine rows.' },
    { sheet: 'Dashboard', field: 'Direct project cost', excel: "=SUM('Monthly Engine'!I5:I10)", logic: 'Sum direct project cost across months.' },
    { sheet: 'Dashboard', field: 'Administration cost', excel: "=SUM('Monthly Engine'!J5:J10)", logic: 'Sum administration cost across months.' },
    { sheet: 'Dashboard', field: 'Unrecovered cost', excel: "=SUM('Monthly Engine'!K5:K10)", logic: 'Sum the remaining allocable cost after direct and admin allocations.' },
    { sheet: 'Dashboard', field: 'Average readiness', excel: "=AVERAGE('Monthly Engine'!Q5:Q10)", logic: 'Average monthly weighted readiness score.' },
    { sheet: 'Dashboard', field: 'Months ready to post', excel: "=COUNTIF('Monthly Engine'!S5:S10,\"READY TO POST\")", logic: 'Count months where the critical posting gate passes.' },

    { sheet: 'Time Entry', field: 'Month', excel: '=DATE(YEAR(B5),MONTH(B5),1)', logic: 'Normalize each entry date to the first day of its month.' },
    { sheet: 'Time Entry', field: 'Daily Total', excel: '=SUMIFS($H$5:$H$600,$B$5:$B$600,B5,$D$5:$D$600,D5,$J$5:$J$600,"Finance approved")', logic: 'Sum finance-approved hours for the same employee and date.' },
    { sheet: 'Time Entry', field: 'Daily Check', excel: '=IF(ABS(N5-SUMIFS(Calendar!$E$5:$E$200,Calendar!$A$5:$A$200,B5))<0.01,"PASS","REVIEW")', logic: 'Compare daily approved hours to standard hours from Calendar.' },
    { sheet: 'Time Entry', field: 'Project Eligibility', excel: '=IF(COUNTIFS(Projects!$A$5:$A$100,F5,Projects!$F$5:$F$100,"Active",Projects!$D$5:$D$100,"<="&B5,Projects!$E$5:$E$100,">="&B5,Projects!$I$5:$I$100,D5)>0,"PASS","BLOCK")', logic: 'Project must be active, date-valid, and assigned to the employee.' },
    { sheet: 'Time Entry', field: 'AI Coding Check', excel: '=IF(AND(K5=F5,M5="Accepted"),"PASS","REVIEW")', logic: 'AI suggestion must match selected project and be explicitly accepted.' },
    { sheet: 'Time Entry', field: 'Entry Assurance', excel: '=IF(AND(H5>0,H5<=24,MOD(H5,0.25)=0,O5="PASS",P5="PASS",Q5="PASS"),"PASS","REVIEW")', logic: 'Hours must be positive, <=24, quarter-hour aligned, and all entry-level controls must pass.' },

    { sheet: 'Payroll', field: 'Allocable Cost', excel: '=C5+D5+E5-F5', logic: 'Basic salary + benefits + statutory cost − exclusions.' },

    { sheet: 'Calendar', field: 'Recorded Hours', excel: '=SUMIFS(\'Time Entry\'!$H$5:$H$600,\'Time Entry\'!$B$5:$B$600,A5,\'Time Entry\'!$J$5:$J$600,"Finance approved")', logic: 'Sum finance-approved hours for the date.' },
    { sheet: 'Calendar', field: 'Variance', excel: '=F5-E5', logic: 'Recorded hours − standard hours.' },
    { sheet: 'Calendar', field: 'Daily Status', excel: '=IF(ABS(G5)<0.01,"PASS",IF(AND(E5=0,F5=0),"PASS","REVIEW"))', logic: 'Pass when variance is zero, including valid zero-hour non-working days; otherwise review.' },

    { sheet: 'Monthly Engine', field: 'Expected Hours', excel: '=SUMIFS(Calendar!$E$5:$E$200,Calendar!$B$5:$B$200,A5)', logic: 'Sum standard hours for the month.' },
    { sheet: 'Monthly Engine', field: 'Recorded Hours', excel: '=SUMIFS(\'Time Entry\'!$H$5:$H$600,\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$J$5:$J$600,"Finance approved")', logic: 'Sum finance-approved time for the month.' },
    { sheet: 'Monthly Engine', field: 'Direct Hours', excel: '=SUMIFS(\'Time Entry\'!$H$5:$H$600,\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$I$5:$I$600,"Direct project",\'Time Entry\'!$J$5:$J$600,"Finance approved")', logic: 'Monthly finance-approved direct-project hours.' },
    { sheet: 'Monthly Engine', field: 'Admin Hours', excel: '=SUMIFS(\'Time Entry\'!$H$5:$H$600,\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$I$5:$I$600,"Administration",\'Time Entry\'!$J$5:$J$600,"Finance approved")', logic: 'Monthly finance-approved administration hours.' },
    { sheet: 'Monthly Engine', field: 'Hours Variance', excel: '=C5-B5', logic: 'Recorded hours − expected hours.' },
    { sheet: 'Monthly Engine', field: 'Allocable Cost', excel: '=SUMIFS(Payroll!$G$5:$G$20,Payroll!$A$5:$A$20,A5,Payroll!$B$5:$B$20,"E001")', logic: 'Employee allocable payroll cost for the month.' },
    { sheet: 'Monthly Engine', field: 'Hourly Cost', excel: '=IFERROR(G5/B5,0)', logic: 'Allocable cost ÷ expected hours.' },
    { sheet: 'Monthly Engine', field: 'Direct Cost', excel: '=D5*H5', logic: 'Direct hours × hourly cost.' },
    { sheet: 'Monthly Engine', field: 'Admin Cost', excel: '=E5*H5', logic: 'Admin hours × hourly cost.' },
    { sheet: 'Monthly Engine', field: 'Unrecovered Cost', excel: '=G5-I5-J5', logic: 'Allocable cost − direct cost − admin cost.' },
    { sheet: 'Monthly Engine', field: 'Completeness', excel: '=IFERROR(MIN(1,C5/B5),0)', logic: 'Recorded ÷ expected, capped at 100%.' },
    { sheet: 'Monthly Engine', field: 'Daily Reconciliation', excel: '=IFERROR(COUNTIFS(Calendar!$B$5:$B$200,A5,Calendar!$E$5:$E$200,">0",Calendar!$H$5:$H$200,"PASS")/COUNTIFS(Calendar!$B$5:$B$200,A5,Calendar!$E$5:$E$200,">0"),0)', logic: 'Share of working days with a PASS daily reconciliation.' },
    { sheet: 'Monthly Engine', field: 'Eligibility', excel: '=IFERROR(COUNTIFS(\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$P$5:$P$600,"PASS")/COUNTIF(\'Time Entry\'!$C$5:$C$600,A5),0)', logic: 'Share of monthly entries passing project eligibility.' },
    { sheet: 'Monthly Engine', field: 'Timeliness', excel: '=1', logic: 'Live time evidence is required for timeliness credit; periods with no time evidence receive 0.' },
    { sheet: 'Monthly Engine', field: 'Approval', excel: '=IF(COUNTIFS(\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$J$5:$J$600,"<>Finance approved")=0,1,0)', logic: 'Pass only if every monthly entry is finance approved.' },
    { sheet: 'Monthly Engine', field: 'Readiness Score', excel: '=35%*L5+25%*M5+15%*N5+15%*O5+10%*P5', logic: 'Weighted score: 35% completeness + 25% daily reconciliation + 15% eligibility + 15% timeliness + 10% approval.' },
    { sheet: 'Monthly Engine', field: 'Critical Exceptions', excel: '=IF(ABS(F5)>0.01,1,0)+COUNTIFS(\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$P$5:$P$600,"BLOCK")+COUNTIFS(\'Time Entry\'!$C$5:$C$600,A5,\'Time Entry\'!$J$5:$J$600,"<>Finance approved")', logic: 'Count variance gate + eligibility blocks + unapproved entries.' },
    { sheet: 'Monthly Engine', field: 'Posting Status', excel: '=IF(AND(ABS(F5)<0.01,R5=0),"READY TO POST","BLOCKED")', logic: 'Posting allowed only when hours variance is zero and critical exceptions equal zero.' },
    { sheet: 'Monthly Engine', field: 'Source Hours', excel: '=SUMIFS(Checks!$C$5:$C$10,Checks!$A$5:$A$10,A5)', logic: 'Source timesheet hours brought from Checks for reconciliation.' },
    { sheet: 'Monthly Engine', field: 'Source Reconciliation', excel: '=C5-T5', logic: 'Recorded hours − source hours; must equal zero.' },
    { sheet: 'Monthly Engine', field: 'Recovery Rate', excel: '=IFERROR(I5/G5,0)', logic: 'Direct project cost ÷ allocable payroll cost.' },

    { sheet: 'Checks', field: 'Calculated', excel: "='Monthly Engine'!C5", logic: 'Pull calculated recorded hours from Monthly Engine.' },
    { sheet: 'Checks', field: 'Delta', excel: '=D5-C5', logic: 'Calculated hours − source target.' },
    { sheet: 'Checks', field: 'Result', excel: '=IF(ABS(E5)<0.01,"PASS","FAIL")', logic: 'Source reconciliation passes when delta is zero.' },
    { sheet: 'Checks', field: 'MODEL STATUS', excel: '=IF(AND(COUNTIF(G5:G10,"FAIL")=0,COUNTIF(\'Monthly Engine\'!S5:S10,"BLOCKED")=0),"PASS","FAIL")', logic: 'Overall model passes only when source checks pass and no month is blocked.' },
    { sheet: 'Checks', field: 'Blocked Months', excel: '=COUNTIF(\'Monthly Engine\'!S5:S10,"BLOCKED")', logic: 'Count blocked monthly engine rows.' },
    { sheet: 'Checks', field: 'Configuration Status', excel: '=IF(COUNTIF(Payroll!I5:I10,"REVIEW")=0,"COMPLETE","REVIEW")', logic: 'Payroll configuration must have no REVIEW statuses.' },

    { sheet: 'Voucher', field: 'Voucher Status', excel: '=INDEX(\'Monthly Engine\'!$S$5:$S$10,MATCH(B5,\'Monthly Engine\'!$A$5:$A$10,0))', logic: 'Use selected month posting status.' },
    { sheet: 'Voucher', field: 'Approved Project Hours', excel: '=SUMIFS(\'Time Entry\'!$H$5:$H$600,\'Time Entry\'!$C$5:$C$600,$B$5,\'Time Entry\'!$F$5:$F$600,$B$6,\'Time Entry\'!$J$5:$J$600,"Finance approved")', logic: 'Finance-approved hours for the selected project and month.' },
    { sheet: 'Voucher', field: 'Raw Cost', excel: '=C12*E12', logic: 'Approved project hours × monthly hourly cost.' },
    { sheet: 'Voucher', field: 'Recoverable Amount', excel: '=IF($B$8="READY TO POST",MIN(F12,G12),0)', logic: 'Recoverable amount is zero unless month is ready; then lower of raw cost and budget ceiling.' },
    { sheet: 'Voucher', field: 'Monthly hours variance control', excel: '=IF(ABS(B16)<0.01,"PASS","FAIL")', logic: 'Fail if selected month has non-zero hour variance.' },
    { sheet: 'Voucher', field: 'Critical exceptions control', excel: '=IF(B17=0,"PASS","FAIL")', logic: 'Fail if selected month has any critical exceptions.' },
    { sheet: 'Voucher', field: 'Source reconciliation control', excel: '=IF(ABS(B18)<0.01,"PASS","FAIL")', logic: 'Fail if source reconciliation is non-zero.' },
    { sheet: 'Voucher', field: 'Payroll configuration control', excel: '=IF(B19="COMPLETE","PASS","REVIEW")', logic: 'Review until payroll components are fully configured.' },
    { sheet: 'Voucher', field: 'Posting authorization', excel: '=IF(B20="READY TO POST","PASS","BLOCKED")', logic: 'Post only if selected monthly status is READY TO POST.' },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function excelDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    if (typeof value === 'number' && value > 30000 && value < 70000) {
      const epoch = Date.UTC(1899, 11, 30);
      return new Date(epoch + value * 86400000).toISOString().slice(0, 10);
    }
    return value == null ? null : String(value);
  }

  function monthKey(value) {
    const iso = excelDate(value);
    return iso ? iso.slice(0, 7) + '-01' : null;
  }

  function monthLabel(value) {
    const iso = monthKey(value);
    if (!iso) return '';
    return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  }

  const sum = (rows, pick) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
  const round = (n, p = 8) => Number(Number(n || 0).toFixed(p));

  function tableObjectsFrom(raw, sheetName, headerRowIndex) {
    const rows = clone((raw || {})[sheetName] || []);
    const headers = rows[headerRowIndex] || [];
    return rows.slice(headerRowIndex + 1)
      .filter((r) => r.some((v) => v !== null && v !== ''))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h || `Column ${i + 1}`, r[i] ?? null])));
  }

  function normalizeState(input = {}) {
    const arr = (v) => Array.isArray(v) ? clone(v) : [];
    return {
      employees: arr(input.employees),
      projects: arr(input.projects),
      payroll: arr(input.payroll),
      calendar: arr(input.calendar),
      timeEntries: arr(input.timeEntries),
      sources: arr(input.sources),
      sourceChecks: arr(input.sourceChecks),
      vacancies: arr(input.vacancies),
      candidates: arr(input.candidates),
      onboarding: arr(input.onboarding)
    };
  }

  function buildState(raw = RAW) {
    if (!raw || !Object.keys(raw).length) return normalizeState();
    const employees = tableObjectsFrom(raw, 'Employees', 3).map((r) => ({
      employeeId: r['Employee ID'], name: r['Employee Name'], position: r.Position, supervisor: r.Supervisor, profilePhoto: r['Profile Photo'] || '',
      hoursPerDay: Number(r['Hours / Day'] || 0), startDate: excelDate(r['Start Date']), endDate: excelDate(r['End Date']), active: r['Active?']
    }));
    const projects = tableObjectsFrom(raw, 'Projects', 3).map((r) => ({
      code: r['Project Code'], name: r['Project Name'], donor: r.Donor, startDate: excelDate(r['Start Date']), endDate: excelDate(r['End Date']),
      status: r.Status, adminAllowed: r['Admin Allowed?'], personnelBudget: Number(r['Personnel Budget (UGX)'] || 0), eligibleEmployeeId: r['Eligible Employee ID']
    }));
    const payroll = tableObjectsFrom(raw, 'Payroll', 3).map((r) => ({
      month: monthKey(r.Month), employeeId: r['Employee ID'], basicSalary: Number(r['Basic Salary (UGX)'] || 0), benefits: Number(r.Benefits || 0),
      statutoryCost: Number(r['Statutory Cost'] || 0), exclusions: Number(r.Exclusions || 0), source: r.Source,
      configurationStatus: r['Configuration Status'], notes: r.Notes
    }));
    const calendar = tableObjectsFrom(raw, 'Calendar', 3).map((r) => ({
      date: excelDate(r.Date), month: monthKey(r.Month), day: r.Day, dayType: r['Day Type'], standardHours: Number(r['Standard Hours'] || 0), holidaySource: r['Holiday Source']
    }));
    const timeEntries = tableObjectsFrom(raw, 'Time Entry', 3).map((r) => ({
      entryId: r['Entry ID'], date: excelDate(r.Date), month: monthKey(r.Month), employeeId: r['Employee ID'], employee: r.Employee,
      projectCode: r['Project Code'], activity: r['Activity / Evidence'], hours: Number(r.Hours || 0), timeType: r['Time Type'], status: r.Status,
      aiSuggestedProject: r['AI Suggested Project'], aiConfidence: Number(r['AI Confidence'] || 0), employeeDecision: r['Employee Decision'],
      sourceDailyTotal: Number(r['Daily Total'] || 0), sourceDailyCheck: r['Daily Check'], sourceProjectEligibility: r['Project Eligibility'],
      sourceAiCodingCheck: r['AI Coding Check'], sourceEntryAssurance: r['Entry Assurance']
    }));
    const sources = tableObjectsFrom(raw, 'Sources', 3);
    const sourceChecks = (raw.Checks || []).slice(4, 10).filter((r) => r[0]).map((r) => ({
      month: monthKey(r[0]), check: r[1], sourceTarget: Number(r[2] || 0), severity: r[5], whereToFix: r[7]
    }));
    return normalizeState({ employees, projects, payroll, calendar, timeEntries, sources, sourceChecks });
  }

  function createEngine(initialState = null) {
    const initial = initialState ? normalizeState(initialState) : buildState();
    const state = normalizeState(initial);

    function isFinanceApproved(entry) {
      return String(entry.status || '').toLowerCase() === 'finance approved' || String(entry.status || '').toLowerCase() === 'approved';
    }

    function projectFor(code) { return state.projects.find((p) => p.code === code); }
    function employeeFor(id) { return state.employees.find((e) => e.employeeId === id); }
    function calendarFor(date) { return state.calendar.find((d) => d.date === date); }

    function timeEntryAnalysis(entry) {
      const date = entry.date;
      const employeeId = entry.employeeId;
      const dailyTotal = sum(state.timeEntries.filter((x) => x.date === date && x.employeeId === employeeId && isFinanceApproved(x)), (x) => x.hours);
      const cal = calendarFor(date);
      const standard = Number(cal?.standardHours || 0);
      const dailyCheck = Math.abs(dailyTotal - standard) < EPS ? 'PASS' : 'REVIEW';
      const p = projectFor(entry.projectCode);
      const eligibleIds = String(p?.eligibleEmployeeId || '').split(',').map(x => x.trim()).filter(Boolean);
      const employeeAllowed = eligibleIds.length === 0 || eligibleIds.includes(employeeId);
      const eligible = !!p && String(p.status || 'Active').toLowerCase() === 'active' && (!p.startDate || p.startDate <= date) && (!p.endDate || p.endDate >= date) && employeeAllowed;
      const projectEligibility = eligible ? 'PASS' : 'BLOCK';
      const aiCodingCheck = entry.aiSuggestedProject === entry.projectCode && entry.employeeDecision === 'Accepted' ? 'PASS' : 'REVIEW';
      const quarterHour = Math.abs((entry.hours * 4) - Math.round(entry.hours * 4)) < 1e-8;
      const entryAssurance = entry.hours > 0 && entry.hours <= 24 && quarterHour && dailyCheck === 'PASS' && projectEligibility === 'PASS' && aiCodingCheck === 'PASS' ? 'PASS' : 'REVIEW';
      return { ...entry, dailyTotal: round(dailyTotal), dailyCheck, projectEligibility, aiCodingCheck, entryAssurance };
    }

    function calendarAnalysis() {
      return state.calendar.map((day) => {
        const recordedHours = sum(state.timeEntries.filter((x) => x.date === day.date && isFinanceApproved(x)), (x) => x.hours);
        const variance = recordedHours - day.standardHours;
        const dailyStatus = Math.abs(variance) < EPS || (day.standardHours === 0 && recordedHours === 0) ? 'PASS' : 'REVIEW';
        return { ...day, recordedHours: round(recordedHours), variance: round(variance), dailyStatus };
      });
    }

    function payrollAnalysis() {
      return state.payroll.map((p) => ({ ...p, allocableCost: round(p.basicSalary + p.benefits + p.statutoryCost - p.exclusions, 2) }));
    }

    function checks(monthlyRows) {
      const rows = state.sourceChecks.map((c) => {
        const month = monthlyRows.find((m) => m.month === c.month);
        const calculated = Number(month?.recordedHours || 0);
        const delta = calculated - c.sourceTarget;
        return { ...c, calculated: round(calculated), delta: round(delta), result: Math.abs(delta) < EPS ? 'PASS' : 'FAIL' };
      });
      const payroll = payrollAnalysis();
      const hasLiveControls = rows.length > 0 && monthlyRows.length > 0;
      return {
        rows,
        modelStatus: !hasLiveControls ? 'WAITING FOR DATA' : (rows.every((r) => r.result === 'PASS') && monthlyRows.every((m) => m.postingStatus !== 'BLOCKED') ? 'PASS' : 'FAIL'),
        formulaErrors: 0,
        blockedMonths: monthlyRows.filter((m) => m.postingStatus === 'BLOCKED').length,
        configurationStatus: payroll.length === 0 ? 'NOT CONFIGURED' : (payroll.every((p) => p.configurationStatus !== 'REVIEW') ? 'COMPLETE' : 'REVIEW')
      };
    }

    function monthlyEngine() {
      const cal = calendarAnalysis();
      const payroll = payrollAnalysis();
      const months = [...new Set([...state.calendar.map((d) => d.month), ...state.timeEntries.map((e) => e.month), ...state.payroll.map((p) => p.month), ...state.sourceChecks.map((c) => c.month)].filter(Boolean))].sort();

      let prelim = months.map((month) => {
        const monthCal = cal.filter((d) => d.month === month);
        const monthEntries = state.timeEntries.filter((e) => e.month === month);
        const approved = monthEntries.filter(isFinanceApproved);
        const expectedHours = sum(monthCal, (d) => d.standardHours);
        const recordedHours = sum(approved, (e) => e.hours);
        const directHours = sum(approved.filter((e) => e.timeType === 'Direct project'), (e) => e.hours);
        const adminHours = sum(approved.filter((e) => e.timeType === 'Administration'), (e) => e.hours);
        const hoursVariance = recordedHours - expectedHours;
        const allocableCost = sum(payroll.filter((p) => p.month === month), (p) => p.allocableCost);
        const hourlyCost = expectedHours ? allocableCost / expectedHours : 0;
        const directCost = directHours * hourlyCost;
        const adminCost = adminHours * hourlyCost;
        const unrecoveredCost = allocableCost - directCost - adminCost;
        const completeness = expectedHours ? Math.min(1, recordedHours / expectedHours) : 0;
        const workingDays = monthCal.filter((d) => d.standardHours > 0);
        const dailyReconciliation = workingDays.length ? workingDays.filter((d) => d.dailyStatus === 'PASS').length / workingDays.length : 0;
        const analyzedEntries = monthEntries.map(timeEntryAnalysis);
        const eligibility = monthEntries.length ? analyzedEntries.filter((e) => e.projectEligibility === 'PASS').length / monthEntries.length : 0;
        const timeliness = monthEntries.length > 0 ? 1 : 0;
        const approval = monthEntries.length > 0 && monthEntries.every(isFinanceApproved) ? 1 : 0;
        const readinessScore = 0.35 * completeness + 0.25 * dailyReconciliation + 0.15 * eligibility + 0.15 * timeliness + 0.10 * approval;
        const missingFoundation = expectedHours <= EPS || monthEntries.length === 0 ? 1 : 0;
        const criticalExceptions = missingFoundation + (Math.abs(hoursVariance) > EPS ? 1 : 0) + analyzedEntries.filter((e) => e.projectEligibility === 'BLOCK').length + monthEntries.filter((e) => !isFinanceApproved(e)).length;
        const postingStatus = expectedHours > EPS && monthEntries.length > 0 && Math.abs(hoursVariance) < EPS && criticalExceptions === 0 ? 'READY TO POST' : 'BLOCKED';
        return {
          month, monthLabel: monthLabel(month), expectedHours: round(expectedHours), recordedHours: round(recordedHours), directHours: round(directHours), adminHours: round(adminHours),
          hoursVariance: round(hoursVariance), allocableCost: round(allocableCost, 2), hourlyCost: round(hourlyCost, 8), directCost: round(directCost, 2), adminCost: round(adminCost, 2), unrecoveredCost: round(unrecoveredCost, 2),
          completeness: round(completeness, 10), dailyReconciliation: round(dailyReconciliation, 10), eligibility: round(eligibility, 10), timeliness, approval,
          readinessScore: round(readinessScore, 10), criticalExceptions, postingStatus
        };
      });

      const sourceMap = Object.fromEntries(state.sourceChecks.map((x) => [x.month, x.sourceTarget]));
      prelim = prelim.map((m) => ({
        ...m,
        sourceHours: Number(sourceMap[m.month] || 0),
        sourceReconciliation: round(m.recordedHours - Number(sourceMap[m.month] || 0)),
        recoveryRate: m.allocableCost ? round(m.directCost / m.allocableCost, 10) : 0
      }));
      return prelim;
    }

    function dashboard() {
      const monthly = monthlyEngine();
      return {
        allocablePayroll: round(sum(monthly, (m) => m.allocableCost), 2),
        directProjectCost: round(sum(monthly, (m) => m.directCost), 2),
        administrationCost: round(sum(monthly, (m) => m.adminCost), 2),
        unrecoveredCost: round(sum(monthly, (m) => m.unrecoveredCost), 2),
        averageReadiness: monthly.length ? round(sum(monthly, (m) => m.readinessScore) / monthly.length, 10) : 0,
        monthsReadyToPost: monthly.filter((m) => m.postingStatus === 'READY TO POST').length,
        monthly
      };
    }

    function voucher(month, projectCode) {
      const selectedMonth = monthKey(month);
      const m = monthlyEngine().find((x) => x.month === selectedMonth);
      const p = projectFor(projectCode);
      const eligibleIds = String(p?.eligibleEmployeeId || '').split(',').map((x) => x.trim()).filter(Boolean);
      const employee = eligibleIds.map(employeeFor).find(Boolean) || state.employees[0];
      if (!m || !p) return null;
      const projectHours = sum(state.timeEntries.filter((e) => e.month === selectedMonth && e.projectCode === projectCode && isFinanceApproved(e)), (e) => e.hours);
      const rawCost = projectHours * m.hourlyCost;
      const budgetLimit = p.personnelBudget;
      const recoverableAmount = m.postingStatus === 'READY TO POST' ? Math.min(rawCost, budgetLimit) : 0;
      const payrollConfig = payrollAnalysis().every((x) => x.configurationStatus !== 'REVIEW') ? 'COMPLETE' : 'REVIEW';
      const controls = [
        { control: 'Monthly hours variance', value: m.hoursVariance, result: Math.abs(m.hoursVariance) < EPS ? 'PASS' : 'FAIL', action: 'Resolve missing/excess time' },
        { control: 'Critical exceptions', value: m.criticalExceptions, result: m.criticalExceptions === 0 ? 'PASS' : 'FAIL', action: 'Review Monthly Engine and Time Entry' },
        { control: 'Source reconciliation', value: m.sourceReconciliation, result: Math.abs(m.sourceReconciliation) < EPS ? 'PASS' : 'FAIL', action: 'Must equal zero' },
        { control: 'Payroll configuration', value: payrollConfig, result: payrollConfig === 'COMPLETE' ? 'PASS' : 'REVIEW', action: 'Add benefits and statutory costs' },
        { control: 'Posting authorization', value: m.postingStatus, result: m.postingStatus === 'READY TO POST' ? 'PASS' : 'BLOCKED', action: 'Post only when READY TO POST' },
      ];
      return {
        reportingMonth: selectedMonth, projectCode, preparedBy: 'Finance', voucherStatus: m.postingStatus,
        employeeId: employee?.employeeId || '', employee: employee?.name || 'Live employee', position: employee?.position || '', approvedProjectHours: round(projectHours), expectedHours: m.expectedHours,
        hourlyCost: m.hourlyCost, rawCost: round(rawCost, 2), budgetLimit, recoverableAmount: round(recoverableAmount, 2), controls
      };
    }

    function recoveryPassport(month, projectCode) {
      const v = voucher(month, projectCode);
      if (!v) return null;
      const m = monthlyEngine().find((x) => x.month === v.reportingMonth);
      const entries = state.timeEntries.filter((e) => e.month === v.reportingMonth && e.projectCode === projectCode && isFinanceApproved(e));
      const evidence = entries.length > 0 ? 'PASS' : 'FAIL';
      const capacity = Math.abs(m.hoursVariance) < EPS ? 'PASS' : 'FAIL';
      const eligibility = entries.every((e) => timeEntryAnalysis(e).projectEligibility === 'PASS') ? 'PASS' : 'FAIL';
      const budget = v.rawCost <= v.budgetLimit ? 'PASS' : 'FAIL';
      const approval = m.approval === 1 ? 'PASS' : 'FAIL';
      const keys = { evidence, capacity, eligibility, budget, approval };
      const gate = Object.values(keys).every((x) => x === 'PASS') ? 1 : 0;
      const recoverableCost = gate ? Math.min(v.rawCost, v.budgetLimit) : 0;
      return { ...v, keys, recoveryGate: gate, recoverableCost: round(recoverableCost, 2), amountAtRisk: round(v.rawCost - recoverableCost, 2), finalStatus: gate ? 'RECOVERABLE' : 'BLOCKED' };
    }

    function projectSummary(month) {
      const selectedMonth = month ? monthKey(month) : null;
      return state.projects.map((p) => {
        const entries = state.timeEntries.filter((e) => (!selectedMonth || e.month === selectedMonth) && e.projectCode === p.code && isFinanceApproved(e));
        return { code: p.code, name: p.name, hours: round(sum(entries, (e) => e.hours)), entries: entries.length, budget: p.personnelBudget, donor: p.donor };
      }).filter((x) => x.entries > 0).sort((a, b) => b.hours - a.hours);
    }

    function rawSheet(sheetName) { return clone(RAW[sheetName] || []); }

    function replaceState(next) {
      const normalized = normalizeState(next);
      for (const key of Object.keys(state)) state[key] = normalized[key];
      return state;
    }

    function upsertBy(rows, keyFn, value) {
      const idx = rows.findIndex((row) => keyFn(row) === keyFn(value));
      if (idx >= 0) rows[idx] = { ...rows[idx], ...value };
      else rows.push(value);
      return idx >= 0 ? rows[idx] : rows[rows.length - 1];
    }

    function upsertEmployee(value) {
      const employeeId=String(value.employeeId||'').trim();
      const existing=state.employees.find(x=>x.employeeId===employeeId) || {};
      const pick=(key,fallback='') => value[key] !== undefined ? String(value[key]??'').trim() : String(existing[key]??fallback).trim();
      const row = {
        companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',
        employeeId, name:String(value.name??existing.name??'').trim(), position:pick('position'), supervisor:pick('supervisor'),
        department:pick('department'), team:pick('team'), email:pick('email'), phone:pick('phone'), skype:pick('skype'), profilePhoto:pick('profilePhoto'),
        employmentType:pick('employmentType','Full Time'), employmentStatus:pick('employmentStatus','Active'), location:pick('location'),
        teamLead:value.teamLead !== undefined ? Boolean(value.teamLead) : Boolean(existing.teamLead),
        hoursPerDay:Number(value.hoursPerDay??existing.hoursPerDay??8), startDate:excelDate(value.startDate??existing.startDate), endDate:excelDate(value.endDate??existing.endDate),
        active:value.active ?? existing.active ?? 'Yes', createdAt:existing.createdAt || value.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
      };
      if (!row.employeeId || !row.name) throw new Error('Employee ID and name are required.');
      return upsertBy(state.employees, x => x.employeeId, row);
    }

    function upsertProject(value) {
      const code=String(value.code||'').trim(),existing=state.projects.find(x=>x.code===code)||{};
      const row = { companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT', code, name:String(value.name??existing.name??value.code??'').trim(), donor:String(value.donor??existing.donor??'').trim(), startDate:excelDate(value.startDate??existing.startDate), endDate:excelDate(value.endDate??existing.endDate), status:value.status ?? existing.status ?? 'Active', adminAllowed:value.adminAllowed ?? existing.adminAllowed ?? 'No', personnelBudget:Number(value.personnelBudget??existing.personnelBudget??0), eligibleEmployeeId:String(value.eligibleEmployeeId??existing.eligibleEmployeeId??'').trim() };
      if (!row.code) throw new Error('Project code is required.');
      return upsertBy(state.projects, x => x.code, row);
    }

    function upsertPayroll(value) {
      const month=monthKey(value.month),employeeId=String(value.employeeId||'').trim(),existing=state.payroll.find(x=>x.month===month&&x.employeeId===employeeId)||{};
      const row = { companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT', month, employeeId, basicSalary:Number(value.basicSalary??existing.basicSalary??0), benefits:Number(value.benefits??existing.benefits??0), statutoryCost:Number(value.statutoryCost??existing.statutoryCost??0), exclusions:Number(value.exclusions??existing.exclusions??0), source:String(value.source??existing.source??'User input').trim(), configurationStatus:value.configurationStatus ?? existing.configurationStatus ?? 'COMPLETE', notes:String(value.notes??existing.notes??'').trim() };
      if (!row.month || !row.employeeId) throw new Error('Payroll month and employee are required.');
      return upsertBy(state.payroll, x => `${x.month}__${x.employeeId}`, row);
    }

    function upsertCalendar(value) {
      const date = excelDate(value.date),existing=state.calendar.find(x=>x.date===date)||{};
      const row = { companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT', date, month:monthKey(date), day:value.day ?? existing.day ?? (date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en',{weekday:'short',timeZone:'UTC'}) : ''), dayType:value.dayType ?? existing.dayType ?? 'Working Day', standardHours:Number(value.standardHours??existing.standardHours??0), holidaySource:String(value.holidaySource??existing.holidaySource??'').trim() };
      if (!row.date) throw new Error('Calendar date is required.');
      return upsertBy(state.calendar, x => x.date, row);
    }


    function upsertVacancy(value) {
      const existing=state.vacancies.find(x=>x.id===String(value.id||'').trim()) || {};
      const id=String(value.id||existing.id||`VAC-${Date.now()}`).trim();
      const row={...existing,id,companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',title:String(value.title??existing.title??'').trim(),department:String(value.department??existing.department??'').trim(),location:String(value.location??existing.location??'').trim(),employmentType:String(value.employmentType??existing.employmentType??'Full Time').trim(),status:String(value.status??existing.status??'Open').trim(),openDate:excelDate(value.openDate??existing.openDate??new Date().toISOString().slice(0,10)),closeDate:excelDate(value.closeDate??existing.closeDate),createdAt:existing.createdAt||value.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(!row.title) throw new Error('Vacancy title is required.');
      return upsertBy(state.vacancies,x=>x.id,row);
    }

    function upsertCandidate(value) {
      const existing=state.candidates.find(x=>x.id===String(value.id||'').trim()) || {};
      const id=String(value.id||existing.id||`CAN-${Date.now()}`).trim();
      const row={...existing,id,companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',name:String(value.name??existing.name??'').trim(),email:String(value.email??existing.email??'').trim(),phone:String(value.phone??existing.phone??'').trim(),vacancyId:String(value.vacancyId??existing.vacancyId??'').trim(),jobTitle:String(value.jobTitle??existing.jobTitle??'').trim(),department:String(value.department??existing.department??'').trim(),location:String(value.location??existing.location??'').trim(),employmentType:String(value.employmentType??existing.employmentType??'Full Time').trim(),stage:String(value.stage??existing.stage??'Applied').trim(),status:String(value.status??existing.status??'Active').trim(),profilePhoto:String(value.profilePhoto??existing.profilePhoto??'').trim(),appliedDate:excelDate(value.appliedDate??existing.appliedDate??new Date().toISOString().slice(0,10)),notes:String(value.notes??existing.notes??'').trim(),createdAt:existing.createdAt||value.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(!row.name) throw new Error('Candidate name is required.');
      return upsertBy(state.candidates,x=>x.id,row);
    }

    function upsertOnboarding(value) {
      const existing=state.onboarding.find(x=>x.id===String(value.id||'').trim()) || {};
      const id=String(value.id||existing.id||`ONB-${Date.now()}`).trim();
      const row={...existing,id,companyId:String(value.companyId??existing.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',candidateId:String(value.candidateId??existing.candidateId??'').trim(),employeeId:String(value.employeeId??existing.employeeId??'').trim(),name:String(value.name??existing.name??'').trim(),jobTitle:String(value.jobTitle??existing.jobTitle??'').trim(),department:String(value.department??existing.department??'').trim(),location:String(value.location??existing.location??'').trim(),employmentType:String(value.employmentType??existing.employmentType??'Full Time').trim(),hireDate:excelDate(value.hireDate??existing.hireDate),profilePhoto:String(value.profilePhoto??existing.profilePhoto??'').trim(),step:Math.max(1,Math.min(5,Number(value.step??existing.step??1))),status:String(value.status??existing.status??'In Progress').trim(),checklist:{...(existing.checklist||{}),...(value.checklist||{})},createdAt:existing.createdAt||value.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(!row.name) throw new Error('Onboarding employee name is required.');
      return upsertBy(state.onboarding,x=>x.id,row);
    }

    function upsertSourceCheck(value) {
      const row = { month:monthKey(value.month), check:value.check || 'Work Activity Hub completed hours', sourceTarget:Number(value.sourceTarget||0), severity:value.severity || 'Critical', whereToFix:value.whereToFix || 'Work Activity Hub / Recovery Time Entry' };
      if (!row.month) throw new Error('Source-check month is required.');
      return upsertBy(state.sourceChecks, x => x.month, row);
    }

    function addTimeEntry(entry) {
      const employee = employeeFor(entry.employeeId || 'E001') || state.employees[0];
      const project = projectFor(entry.projectCode);
      if (!employee || !project) throw new Error('Employee and project are required.');
      const date = excelDate(entry.date);
      const row = {
        companyId:String(entry.companyId??employee.companyId??project.companyId??'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',
        entryId: entry.entryId || `APP-${Date.now()}`, date, month: monthKey(date), employeeId: employee.employeeId, employee: employee.name,
        projectCode: project.code, activity: String(entry.activity || '').trim(), hours: Number(entry.hours || 0),
        timeType: project.code === 'ADMIN - Overhead' ? 'Administration' : 'Direct project', status: entry.status || 'Draft',
        aiSuggestedProject: entry.aiSuggestedProject || project.code, aiConfidence: Number(entry.aiConfidence ?? 1), employeeDecision: entry.employeeDecision || 'Accepted'
      };
      if (!row.activity || !(row.hours > 0 && row.hours <= 24)) throw new Error('A valid activity and hours between 0 and 24 are required.');
      state.timeEntries.push(row);
      return timeEntryAnalysis(row);
    }

    return {
      state, formulaCatalog: FORMULA_CATALOG, rawSheet, dashboard, monthlyEngine, calendarAnalysis, payrollAnalysis, timeEntryAnalysis,
      analyzedTimeEntries: () => state.timeEntries.map(timeEntryAnalysis), checks: () => checks(monthlyEngine()), voucher, recoveryPassport, projectSummary,
      addTimeEntry, replaceState, upsertEmployee, upsertProject, upsertPayroll, upsertCalendar, upsertSourceCheck, upsertVacancy, upsertCandidate, upsertOnboarding,
      reset: () => replaceState(initialState ? initial : buildState())
    };
  }

  global.ADRAEngine = { createEngine, formulaCatalog: FORMULA_CATALOG, excelDate, monthKey, monthLabel, tableObjects: tableObjectsFrom };
})(window);
