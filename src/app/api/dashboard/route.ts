import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ensureDbReady } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const db = await ensureDbReady();
  const { searchParams } = new URL(request.url);
  const allTerms = searchParams.get('allTerms') === '1';
  const activeYear = db.settings?.academicYear || '2569';
  const activeSemester = db.settings?.semester || '1';

  const filterYear = allTerms
    ? ''
    : searchParams.has('academicYear')
    ? searchParams.get('academicYear') || ''
    : activeYear;
  const filterSemester = allTerms
    ? ''
    : searchParams.has('semester')
    ? searchParams.get('semester') || ''
    : activeSemester;

  const getActTerm = (activityId: string) => {
    const act = db.activities.find((a) => a.id === activityId);
    if (!act) return null;
    return {
      academicYear: act.academicYear || '2569',
      semester: act.semester || '1',
    };
  };

  const matchesTerm = (year: string, sem: string) => {
    if (filterYear && year !== filterYear) return false;
    if (filterSemester && sem !== filterSemester) return false;
    return true;
  };

  // Build sorted list of all available years from managed settings.academicYears + existing activities
  const managedYears =
    Array.isArray(db.settings?.academicYears) && db.settings.academicYears.length > 0
      ? db.settings.academicYears
      : ['2568', '2569', '2570'];
  const yearsSet = new Set<string>(managedYears);
  db.activities.forEach((a) => {
    if (a.academicYear) yearsSet.add(a.academicYear);
  });
  const availableYears = Array.from(yearsSet).sort();

  // If student: return personalized student metrics + term breakdown (per-term isolated)
  if (user.role === 'student') {
    const fullUser = db.users.find((u) => u.id === user.id);
    const userSchIds =
      fullUser?.scholarshipTypeIds && fullUser.scholarshipTypeIds.length > 0
        ? fullUser.scholarshipTypeIds
        : fullUser?.scholarshipTypeId
        ? [fullUser.scholarshipTypeId]
        : [];

    const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
    const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);
    const scholarshipName = scholarships.map((s) => s.name).join(' + ') || 'ไม่ได้ระบุ';

    // Only count hourRecords whose activity still exists
    const allStudentHours = db.hourRecords.filter(
      (h) => h.studentId === user.id && getActTerm(h.activityId) !== null
    );

    const filteredStudentHours = allStudentHours.filter((h) => {
      const t = getActTerm(h.activityId);
      return t ? matchesTerm(t.academicYear, t.semester) : false;
    });

    const approvedHours = filteredStudentHours
      .filter((h) => h.status === 'approved')
      .reduce((sum, h) => sum + h.hours, 0);

    const pendingHours = filteredStudentHours
      .filter((h) => h.status === 'pending' || h.status === 'verified_by_officer')
      .reduce((sum, h) => sum + h.hours, 0);

    const remainingHours = Math.max(0, targetHours - approvedHours);
    const percentComplete =
      targetHours > 0 ? Math.min(100, Math.round((approvedHours / targetHours) * 100)) : 0;

    // Build Term Breakdown strictly isolated per term
    const termKeys = new Set<string>();
    termKeys.add(`${activeYear}-1`);
    termKeys.add(`${activeYear}-2`);
    db.activities.forEach((a) => {
      termKeys.add(`${a.academicYear || '2569'}-${a.semester || '1'}`);
    });
    allStudentHours.forEach((h) => {
      const t = getActTerm(h.activityId);
      if (t) termKeys.add(`${t.academicYear}-${t.semester}`);
    });

    const termBreakdown = Array.from(termKeys)
      .sort()
      .map((key) => {
        const [yr, sem] = key.split('-');
        const termHrs = allStudentHours.filter((h) => {
          const t = getActTerm(h.activityId);
          return t !== null && t.academicYear === yr && t.semester === sem;
        });
        const termRegs = db.registrations.filter((r) => {
          if (r.studentId !== user.id) return false;
          const t = getActTerm(r.activityId);
          return t !== null && t.academicYear === yr && t.semester === sem;
        });
        const termApproved = termHrs
          .filter((h) => h.status === 'approved')
          .reduce((sum, h) => sum + h.hours, 0);
        const termPending = termHrs
          .filter((h) => h.status === 'pending' || h.status === 'verified_by_officer')
          .reduce((sum, h) => sum + h.hours, 0);

        return {
          key,
          academicYear: yr,
          semester: sem,
          label: `เทอม ${sem}/${yr}`,
          approvedHours: termApproved,
          pendingHours: termPending,
          targetHours,
          remainingHours: Math.max(0, targetHours - termApproved),
          registeredCount: termRegs.length,
          percentOfTarget:
            targetHours > 0 ? Math.min(100, Math.round((termApproved / targetHours) * 100)) : 0,
        };
      });

    const registrations = db.registrations.filter((r) => {
      if (r.studentId !== user.id) return false;
      const t = getActTerm(r.activityId);
      return t ? matchesTerm(t.academicYear, t.semester) : false;
    });

    return NextResponse.json({
      role: 'student',
      metrics: {
        scholarshipName,
        scholarships: scholarships.map((s) => ({
          id: s.id,
          name: s.name,
          targetHours: s.targetHours,
        })),
        targetHours,
        approvedHours,
        pendingHours,
        remainingHours,
        percentComplete,
        totalRegisteredActivities: registrations.length,
        selectedYear: filterYear,
        selectedSemester: filterSemester,
        isAllTerms: allTerms,
        termBreakdown,
        availableYears,
        settings: db.settings,
      },
    });
  }

  // For Officer, Approver, Admin, Organizer: Return institutional dashboard
  const totalStudents = db.users.filter((u) => u.role === 'student').length;
  const filteredActivities = db.activities.filter((a) =>
    matchesTerm(a.academicYear || '2569', a.semester || '1')
  );
  const totalActivities = filteredActivities.length;
  const approvedActivitiesCount = filteredActivities.filter((a) => a.status === 'approved').length;
  const pendingActivitiesCount = filteredActivities.filter((a) => a.status === 'pending_approval').length;

  const filteredHourRecords = db.hourRecords.filter((h) => {
    const t = getActTerm(h.activityId);
    return t ? matchesTerm(t.academicYear, t.semester) : false;
  });

  const allApprovedHours = filteredHourRecords
    .filter((h) => h.status === 'approved')
    .reduce((sum, h) => sum + h.hours, 0);

  const allPendingHours = filteredHourRecords
    .filter((h) => h.status === 'pending' || h.status === 'verified_by_officer')
    .reduce((sum, h) => sum + h.hours, 0);

  const pendingHoursList = filteredHourRecords.filter(
    (h) => h.status === 'pending' || h.status === 'verified_by_officer'
  );

  // Group by Scholarship Types
  const scholarshipSummary = db.scholarshipTypes.map((sch) => {
    const studentsInSch = db.users.filter(
      (u) =>
        u.role === 'student' &&
        (u.scholarshipTypeIds?.includes(sch.id) || u.scholarshipTypeId === sch.id)
    );
    const studentIds = new Set(studentsInSch.map((s) => s.id));

    const totalApproved = filteredHourRecords
      .filter((h) => studentIds.has(h.studentId) && h.status === 'approved')
      .reduce((sum, h) => sum + h.hours, 0);

    const totalTarget = sch.targetHours * studentsInSch.length;

    return {
      id: sch.id,
      name: sch.name,
      targetHoursPerStudent: sch.targetHours,
      studentCount: studentsInSch.length,
      totalTargetHours: totalTarget,
      totalApprovedHours: totalApproved,
      achievementRate:
        totalTarget > 0 ? Math.min(100, Math.round((totalApproved / totalTarget) * 100)) : 0,
    };
  });

  // Build 12-month statistics synchronized with the exact active Academic Year / Semester filter
  const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  const THAI_MONTHS_FULL = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  const filteredActivityMap = new Map(filteredActivities.map((a) => [a.id, a]));

  const extractMonth = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const match = dateStr.match(/^\d{4}-(\d{2})/);
    if (match) {
      const m = Number(match[1]);
      return m >= 1 && m <= 12 ? m : null;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.getMonth() + 1;
    }
    return null;
  };

  const monthlyStats = Array.from({ length: 12 }, (_, idx) => {
    const monthNum = idx + 1;

    const actsInMonth = filteredActivities.filter((a) => {
      const m = extractMonth(a.date || a.createdAt);
      return m === monthNum;
    });

    const regsInMonth = db.registrations.filter((r) => {
      if (r.status === 'cancelled') return false;
      const act = filteredActivityMap.get(r.activityId);
      if (!act) return false;
      const m = extractMonth(act.date || r.registeredAt);
      return m === monthNum;
    });

    const hoursInMonth = filteredHourRecords.filter((h) => {
      const act = filteredActivityMap.get(h.activityId);
      if (!act) return false;
      const m = extractMonth(act.date || h.approvedAt || h.updatedAt);
      return m === monthNum;
    });

    const approvedHours = hoursInMonth
      .filter((h) => h.status === 'approved')
      .reduce((sum, h) => sum + h.hours, 0);

    const pendingHours = hoursInMonth
      .filter((h) => h.status === 'pending' || h.status === 'verified_by_officer')
      .reduce((sum, h) => sum + h.hours, 0);

    const checkInsInMonth = db.attendances.filter((att) => {
      const act = filteredActivityMap.get(att.activityId);
      if (!act) return false;
      const m = extractMonth(act.date || att.checkInTime);
      return m === monthNum;
    }).length;

    return {
      month: monthNum,
      label: THAI_MONTHS_SHORT[idx],
      fullLabel: THAI_MONTHS_FULL[idx],
      approvedHours,
      pendingHours,
      activitiesCount: actsInMonth.length,
      registrationsCount: regsInMonth.length,
      checkInsCount: checkInsInMonth,
    };
  });

  // Build per-year statistics for all available academic years (used when "ทุกปีการศึกษา" is selected)
  const yearlyStats = availableYears.map((yr) => {
    const actsInYear = db.activities.filter((a) => {
      const aYear = a.academicYear || '2569';
      const aSem = a.semester || '1';
      if (aYear !== yr) return false;
      if (filterSemester && aSem !== filterSemester) return false;
      return true;
    });
    const yearActMap = new Map(actsInYear.map((a) => [a.id, a]));

    const regsInYear = db.registrations.filter(
      (r) => r.status !== 'cancelled' && yearActMap.has(r.activityId)
    );

    const hoursInYear = db.hourRecords.filter((h) => yearActMap.has(h.activityId));
    const approvedHours = hoursInYear
      .filter((h) => h.status === 'approved')
      .reduce((sum, h) => sum + h.hours, 0);
    const pendingHours = hoursInYear
      .filter((h) => h.status === 'pending' || h.status === 'verified_by_officer')
      .reduce((sum, h) => sum + h.hours, 0);

    const checkInsInYear = db.attendances.filter((att) => yearActMap.has(att.activityId)).length;

    return {
      year: yr,
      label: `ปี ${yr}`,
      fullLabel: `ปีการศึกษา ${yr}`,
      approvedHours,
      pendingHours,
      activitiesCount: actsInYear.length,
      registrationsCount: regsInYear.length,
      checkInsCount: checkInsInYear,
    };
  });

  const yearActivityCounts: Record<string, number> = {};
  availableYears.forEach((yr) => {
    yearActivityCounts[yr] = db.activities.filter((a) => (a.academicYear || '2569') === yr).length;
  });

  const chartMode: 'monthly' | 'yearly' = filterYear ? 'monthly' : 'yearly';

  const periodLabel = [
    filterYear ? `ปีการศึกษา ${filterYear}` : 'ทุกปีการศึกษา',
    filterSemester ? `เทอม ${filterSemester}` : 'ทุกเทอม',
  ].join(' • ');

  return NextResponse.json({
    role: user.role,
    metrics: {
      totalStudents,
      totalActivities,
      approvedActivitiesCount,
      pendingActivitiesCount,
      allApprovedHours,
      allPendingHours,
      pendingHourRecordsCount: pendingHoursList.length,
      scholarshipSummary,
      monthlyStats,
      yearlyStats,
      yearActivityCounts,
      chartMode,
      periodLabel,
      selectedYear: filterYear,
      selectedSemester: filterSemester,
      isAllTerms: !filterYear && !filterSemester,
      availableYears,
      settings: db.settings,
    },
  });
}
