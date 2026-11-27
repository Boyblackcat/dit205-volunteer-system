import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['approver', 'officer', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการอนุมัติกิจกรรม' },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const { status, comment } = await request.json(); // status: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'สถานะการอนุมัติไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    const activity = db.activities.find((a) => a.id === id);
    if (!activity) {
      return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 });
    }

    activity.status = status;
    activity.approvalComment = comment || (status === 'approved' ? 'อนุมัติเปิดรับสมัครกิจกรรม' : 'ไม่อนุมัติกิจกรรม');
    await persistDatabase(db);

    logAudit(
      user.id,
      user.name,
      user.role,
      status === 'approved' ? 'APPROVE_ACTIVITY' : 'REJECT_ACTIVITY',
      `${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}กิจกรรม "${activity.title}" ความเห็น: ${activity.approvalComment}`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: `${status === 'approved' ? 'อนุมัติกิจกรรมและเปิดรับสมัครเรียบร้อยแล้ว' : 'ปฏิเสธกิจกรรมเรียบร้อยแล้ว'}`,
      activity,
    });
  } catch (err) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 });
  }
}

