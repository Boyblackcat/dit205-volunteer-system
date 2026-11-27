import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ensureDbReady } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const studentId = searchParams.get('studentId') || (user.role === 'student' ? user.id : undefined);

  const db = await ensureDbReady();
  let list = db.hourRecords.filter((hr) =>
    db.activities.some((a) => a.id === hr.activityId)
  );

  if (status) {
    list = list.filter((h) => h.status === status);
  }
  if (studentId) {
    list = list.filter((h) => h.studentId === studentId);
  }

  const defaultYear = '2569';
  const defaultSemester = '1';

  const enriched = list.map((hr) => {
    const rawAct = db.activities.find((a) => a.id === hr.activityId);
    const act = rawAct
      ? {
          ...rawAct,
          academicYear: rawAct.academicYear || defaultYear,
          semester: rawAct.semester || defaultSemester,
        }
      : null;
    const stu = db.users.find((u) => u.id === hr.studentId);
    const userSchIds = stu?.scholarshipTypeIds || (stu?.scholarshipTypeId ? [stu.scholarshipTypeId] : []);
    const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
    const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);
    const scholarshipName = scholarships.map((s) => s.name).join(', ') || 'ไม่ระบุ';
    const att = db.attendances.find(
      (a) => a.activityId === hr.activityId && a.studentId === hr.studentId
    );
    const evi = db.evidence.find(
      (e) => e.activityId === hr.activityId && e.studentId === hr.studentId
    );

    return {
      ...hr,
      activity: act || null,
      student: stu
        ? {
            id: stu.id,
            name: stu.name,
            studentId: stu.studentId,
            faculty: stu.faculty,
            email: stu.email,
            scholarshipName: scholarshipName,
            targetHours: targetHours,
          }
        : null,
      attendance: att || null,
      evidence: evi || null,
    };
  });

  return NextResponse.json({ hourRecords: enriched });
}

