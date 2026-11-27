import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import { Activity } from '@/types';

export async function GET(request: NextRequest) {
  const db = await ensureDbReady();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const organizerId = searchParams.get('organizerId');
  const search = searchParams.get('search');
  const academicYear = searchParams.get('academicYear');
  const semester = searchParams.get('semester');

  const defaultYear = '2569';
  const defaultSemester = '1';

  let list = [...db.activities];

  if (status) {
    list = list.filter((a) => a.status === status);
  }
  if (category) {
    list = list.filter((a) => a.category === category);
  }
  if (organizerId) {
    list = list.filter((a) => a.organizerId === organizerId);
  }
  if (academicYear) {
    list = list.filter((a) => (a.academicYear || defaultYear) === academicYear);
  }
  if (semester) {
    list = list.filter((a) => (a.semester || defaultSemester) === semester);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q)
    );
  }

  // Calculate actual current registered count and checked-in count
  const enriched = list.map((a) => {
    const regCount = db.registrations.filter(
      (r) => r.activityId === a.id && r.status !== 'cancelled'
    ).length;
    const checkedInCount = db.attendances.filter(
      (att) => att.activityId === a.id
    ).length;
    const allowedIds = Array.isArray(a.allowedScholarshipIds) ? a.allowedScholarshipIds : [];
    const allowedScholarshipNames =
      allowedIds.length > 0
        ? db.scholarshipTypes.filter((s) => allowedIds.includes(s.id)).map((s) => s.name)
        : [];
    const isRegistrationClosed = a.registrationDeadline
      ? new Date() > new Date(a.registrationDeadline)
      : false;
    return {
      ...a,
      academicYear: a.academicYear || defaultYear,
      semester: a.semester || defaultSemester,
      registrationDeadline: a.registrationDeadline || '',
      isRegistrationClosed,
      allowedScholarshipIds: allowedIds,
      allowedScholarshipNames,
      currentParticipants: regCount,
      checkedInCount,
      isFull: regCount >= a.maxParticipants,
    };
  });

  const managedYears =
    Array.isArray(db.settings?.academicYears) && db.settings.academicYears.length > 0
      ? db.settings.academicYears
      : ['2568', '2569', '2570'];
  const yearsSet = new Set<string>(managedYears);
  db.activities.forEach((a) => {
    if (a.academicYear) yearsSet.add(a.academicYear);
  });
  const availableYears = Array.from(yearsSet).sort();
  const yearActivityCounts: Record<string, number> = {};
  availableYears.forEach((yr) => {
    yearActivityCounts[yr] = db.activities.filter((a) => (a.academicYear || '2569') === yr).length;
  });

  return NextResponse.json({
    activities: enriched,
    settings: db.settings,
    availableYears,
    yearActivityCounts,
  });
}

export async function POST(request: NextRequest) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['organizer', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการสร้างกิจกรรม' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      category,
      location,
      date,
      startTime,
      endTime,
      hours,
      maxParticipants,
      academicYear,
      semester,
      registrationDeadline,
      allowedScholarshipIds,
    } = body;

    if (!title || !description || !location || !date || !hours || !maxParticipants) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลกิจกรรมให้ครบถ้วนทุกช่อง' },
        { status: 400 }
      );
    }

    const parsedHours = Number(hours);
    const parsedMax = Number(maxParticipants);

    if (parsedHours <= 0 || parsedMax <= 0) {
      return NextResponse.json(
        { error: 'จำนวนชั่วโมงและจำนวนผู้รับสมัครต้องมากกว่า 0' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    const newId = `act-${Date.now()}`;
    const newActivity: Activity = {
      id: newId,
      title: title.trim(),
      description: description.trim(),
      category: category?.trim() || 'จิตอาสาทั่วไป',
      location: location.trim(),
      date,
      startTime: startTime || '09:00',
      endTime: endTime || '16:00',
      hours: parsedHours,
      maxParticipants: parsedMax,
      currentParticipants: 0,
      organizerId: user.id,
      organizerName: user.name,
      status: 'pending_approval', // Sent for approver review
      academicYear: academicYear || db.settings?.academicYear || '2569',
      semester: semester || db.settings?.semester || '1',
      registrationDeadline: registrationDeadline ? String(registrationDeadline).trim() : '',
      allowedScholarshipIds: Array.isArray(allowedScholarshipIds) ? allowedScholarshipIds : [],
      qrCodeSecret: `QR-RSU-${newId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    db.activities.push(newActivity);
    await persistDatabase(db);

    logAudit(
      user.id,
      user.name,
      user.role,
      'CREATE_ACTIVITY',
      `สร้างกิจกรรมใหม่: "${newActivity.title}" (${newActivity.hours} ชม., รับ ${newActivity.maxParticipants} คน) สถานะ: รอการอนุมัติ`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'บันทึกกิจกรรมเรียบร้อยแล้วและส่งต่อเพื่อรอการอนุมัติ',
      activity: newActivity,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างกิจกรรม' }, { status: 500 });
  }
}

