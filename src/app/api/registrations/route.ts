import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Registration } from '@/types';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('activityId');
  const studentId = searchParams.get('studentId') || (user.role === 'student' ? user.id : undefined);

  const db = await ensureDbReady();
  // Only include registrations whose activity still exists
  let list = db.registrations.filter((r) =>
    db.activities.some((a) => a.id === r.activityId)
  );

  if (activityId) {
    list = list.filter((r) => r.activityId === activityId);
  }
  if (studentId) {
    list = list.filter((r) => r.studentId === studentId);
  }

  const defaultYear = '2569';
  const defaultSemester = '1';

  // Enrich with activity details and student details
  const enriched = list.map((reg) => {
    const rawAct = db.activities.find((a) => a.id === reg.activityId);
    const act = rawAct
      ? {
          ...rawAct,
          academicYear: rawAct.academicYear || defaultYear,
          semester: rawAct.semester || defaultSemester,
        }
      : null;
    const stu = db.users.find((u) => u.id === reg.studentId);
    const att = db.attendances.find(
      (a) => a.activityId === reg.activityId && a.studentId === reg.studentId
    );
    const hr = db.hourRecords.find(
      (h) => h.activityId === reg.activityId && h.studentId === reg.studentId
    );
    const evi = db.evidence.find(
      (e) => e.activityId === reg.activityId && e.studentId === reg.studentId
    );

    return {
      ...reg,
      activity: act,
      student: stu
        ? {
            id: stu.id,
            name: stu.name,
            studentId: stu.studentId,
            faculty: stu.faculty,
            email: stu.email,
          }
        : null,
      attendance: att || null,
      evidence: evi || null,
      hourRecord: hr || null,
    };
  });

  return NextResponse.json({ registrations: enriched, settings: db.settings });
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนสมัครกิจกรรม' }, { status: 401 });
  }

  if (user.role !== 'student' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'เฉพาะนักศึกษาทุนเท่านั้นที่สามารถสมัครกิจกรรมจิตอาสาได้' },
      { status: 403 }
    );
  }

  try {
    const { activityId, studentId: customStudentId } = await request.json();
    const targetStudentId = customStudentId || user.id;

    if (!activityId) {
      return NextResponse.json({ error: 'กรุณาระบุรหัสกิจกรรม' }, { status: 400 });
    }

    const db = await ensureDbReady();
    const activity = db.activities.find((a) => a.id === activityId);
    if (!activity) {
      return NextResponse.json({ error: 'ไม่พบกิจกรรมที่ระบุ' }, { status: 404 });
    }

    if (activity.status !== 'approved') {
      return NextResponse.json(
        { error: 'กิจกรรมนี้ยังไม่เปิดรับสมัคร หรือยังไม่ได้รับการอนุมัติ' },
        { status: 400 }
      );
    }

    // Check registration deadline
    if (activity.registrationDeadline) {
      const deadlineDate = new Date(activity.registrationDeadline);
      if (!isNaN(deadlineDate.getTime()) && new Date() > deadlineDate) {
        const formatted = deadlineDate.toLocaleString('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        return NextResponse.json(
          {
            error: `หมดเวลารับสมัครสำหรับกิจกรรมนี้แล้ว (ปิดรับสมัครเมื่อ ${formatted})`,
            isDeadlinePassed: true,
          },
          { status: 400 }
        );
      }
    }

    // Check scholarship eligibility if activity restricts allowed scholarships
    if (
      user.role === 'student' &&
      Array.isArray(activity.allowedScholarshipIds) &&
      activity.allowedScholarshipIds.length > 0
    ) {
      const studentObj = db.users.find((u) => u.id === targetStudentId);
      const stuSchIds =
        studentObj?.scholarshipTypeIds && studentObj.scholarshipTypeIds.length > 0
          ? studentObj.scholarshipTypeIds
          : studentObj?.scholarshipTypeId
          ? [studentObj.scholarshipTypeId]
          : [];
      const isEligible = stuSchIds.some((id) => activity.allowedScholarshipIds!.includes(id));
      if (!isEligible) {
        const allowedNames = db.scholarshipTypes
          .filter((s) => activity.allowedScholarshipIds!.includes(s.id))
          .map((s) => s.name)
          .join(', ');
        return NextResponse.json(
          { error: `กิจกรรมนี้เปิดรับเฉพาะนักศึกษาที่ได้รับทุน: ${allowedNames} เท่านั้น` },
          { status: 400 }
        );
      }
    }

    // Check duplicate registration
    const existing = db.registrations.find(
      (r) =>
        r.activityId === activityId &&
        r.studentId === targetStudentId &&
        r.status !== 'cancelled'
    );
    if (existing) {
      return NextResponse.json(
        { error: 'ท่านได้ลงทะเบียนกิจกรรมนี้ไว้แล้ว ไม่สามารถสมัครซ้ำได้' },
        { status: 400 }
      );
    }

    // TC-06: Check Quota (กิจกรรมเต็ม)
    const currentCount = db.registrations.filter(
      (r) => r.activityId === activityId && r.status !== 'cancelled'
    ).length;

    if (currentCount >= activity.maxParticipants) {
      logAudit(
        user.id,
        user.name,
        user.role,
        'REGISTRATION_REJECTED_FULL',
        `พยายามสมัครกิจกรรม "${activity.title}" แต่ที่นั่งเต็มแล้ว (${currentCount}/${activity.maxParticipants})`
      );
      await flushDatabaseToTiDB();
      return NextResponse.json(
        {
          error: `ไม่สามารถสมัครได้ เนื่องจากกิจกรรมมีผู้สมัครครบตามจำนวนแล้ว (${currentCount}/${activity.maxParticipants})`,
          isFull: true,
        },
        { status: 400 }
      );
    }

    // Register successfully
    const newRegistration: Registration = {
      id: `reg-${Date.now()}`,
      activityId,
      studentId: targetStudentId,
      registeredAt: new Date().toISOString(),
      status: 'registered',
    };

    db.registrations.push(newRegistration);
    await persistDatabase(db);
    await flushDatabaseToTiDB();

    logAudit(
      user.id,
      user.name,
      user.role,
      'REGISTER_ACTIVITY',
      `นักศึกษาสมัครกิจกรรม "${activity.title}" สำเร็จ (ที่นั่งลำดับที่ ${currentCount + 1}/${activity.maxParticipants})`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: `สมัครเข้าร่วมกิจกรรม "${activity.title}" สำเร็จ`,
      registration: newRegistration,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสมัครกิจกรรม' }, { status: 500 });
  }
}

