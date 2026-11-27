import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import { HourStatus } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['officer', 'approver', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการอนุมัติชั่วโมงกิจกรรม' },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const { status, comment, approvedHours } = await request.json();

    if (!['verified_by_officer', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'สถานะการอนุมัติไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    const record = db.hourRecords.find((h) => h.id === id);
    if (!record) {
      return NextResponse.json({ error: 'ไม่พบรายการชั่วโมง' }, { status: 404 });
    }

    const activity = db.activities.find((a) => a.id === record.activityId);
    const student = db.users.find((u) => u.id === record.studentId);

    record.status = status as HourStatus;
    if (approvedHours !== undefined) {
      const h = Number(approvedHours);
      if (!isNaN(h) && h >= 0) {
        record.hours = h;
      }
    }

    if (user.role === 'officer') {
      record.officerComment = comment || 'ตรวจสอบหลักฐานและความถูกต้องเรียบร้อยแล้ว';
      record.verifiedAt = new Date().toISOString();
    } else {
      record.approverComment = comment || 'อนุมัติรับรองชั่วโมงจิตอาสาเรียบร้อยแล้ว';
      record.approvedAt = new Date().toISOString();
    }
    record.updatedAt = new Date().toISOString();

    await persistDatabase(db);

    const actionName =
      status === 'approved'
        ? 'APPROVE_HOURS'
        : status === 'verified_by_officer'
        ? 'VERIFY_HOURS_OFFICER'
        : 'REJECT_HOURS';

    const thaiStatus =
      status === 'approved'
        ? 'อนุมัติเรียบร้อย'
        : status === 'verified_by_officer'
        ? 'เจ้าหน้าที่ตรวจสอบแล้ว'
        : 'ส่งกลับแก้ไข/ปฏิเสธ';

    logAudit(
      user.id,
      user.name,
      user.role,
      actionName,
      `${thaiStatus}: ${record.hours} ชม. สำหรับนักศึกษา ${student?.name || record.studentId} ในกิจกรรม "${activity?.title || record.activityId}"`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: `ดำเนินการ${thaiStatus}สำเร็จ`,
      hourRecord: record,
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 });
  }
}

