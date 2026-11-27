import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const db = await ensureDbReady();
  const activity = db.activities.find((a) => a.id === id);
  if (!activity) {
    return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 });
  }

  const regCount = db.registrations.filter(
    (r) => r.activityId === activity.id && r.status !== 'cancelled'
  ).length;

  return NextResponse.json({
    activity: {
      ...activity,
      currentParticipants: regCount,
      isFull: regCount >= activity.maxParticipants,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['organizer', 'admin'])) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ในการแก้ไขกิจกรรม' }, { status: 403 });
  }

  const { id } = params;
  const db = await ensureDbReady();
  const index = db.activities.findIndex((a) => a.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 });
  }

  // If organizer, ensure they own the activity
  if (user.role === 'organizer' && db.activities[index].organizerId !== user.id) {
    return NextResponse.json({ error: 'ท่านสามารถแก้ไขได้เฉพาะกิจกรรมที่ท่านสร้างเท่านั้น' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const act = db.activities[index];

    if (body.title) act.title = body.title.trim();
    if (body.description) act.description = body.description.trim();
    if (body.category) act.category = body.category.trim();
    if (body.location) act.location = body.location.trim();
    if (body.date) act.date = body.date;
    if (body.startTime) act.startTime = body.startTime;
    if (body.endTime) act.endTime = body.endTime;
    if (body.hours) act.hours = Number(body.hours);
    if (body.maxParticipants) act.maxParticipants = Number(body.maxParticipants);
    if (body.status) act.status = body.status;
    if (body.academicYear) act.academicYear = String(body.academicYear).trim();
    if (body.semester) act.semester = String(body.semester).trim();
    if (body.registrationDeadline !== undefined) {
      act.registrationDeadline = String(body.registrationDeadline || '').trim();
    }
    if (Array.isArray(body.allowedScholarshipIds)) {
      act.allowedScholarshipIds = body.allowedScholarshipIds;
    }

    await persistDatabase(db);
    await flushDatabaseToTiDB();

    logAudit(
      user.id,
      user.name,
      user.role,
      'UPDATE_ACTIVITY',
      `แก้ไขกิจกรรม: "${act.title}"`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'อัปเดตกิจกรรมสำเร็จ',
      activity: act,
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดต' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['organizer', 'admin'])) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ในการลบกิจกรรม' }, { status: 403 });
  }

  const { id } = params;
  const db = await ensureDbReady();
  const index = db.activities.findIndex((a) => a.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 });
  }

  const act = db.activities[index];
  if (user.role === 'organizer' && act.organizerId !== user.id) {
    return NextResponse.json({ error: 'ไม่สามารถลบกิจกรรมของผู้อื่นได้' }, { status: 403 });
  }

  db.activities.splice(index, 1);

  // Cascade delete related registrations, attendances, evidence, and hourRecords
  // so students won't see orphaned "ไม่พบข้อมูลกิจกรรม" entries
  db.registrations = db.registrations.filter((r) => r.activityId !== id);
  db.attendances = db.attendances.filter((a) => a.activityId !== id);
  db.evidence = db.evidence.filter((e) => e.activityId !== id);
  db.hourRecords = db.hourRecords.filter((h) => h.activityId !== id);

  await persistDatabase(db);
  await flushDatabaseToTiDB();

  logAudit(
    user.id,
    user.name,
    user.role,
    'DELETE_ACTIVITY',
    `ลบกิจกรรม: "${act.title}"`
  );
  await flushDatabaseToTiDB();

  return NextResponse.json({ success: true, message: 'ลบกิจกรรมสำเร็จ' });
}

