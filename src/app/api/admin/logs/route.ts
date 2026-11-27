import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ensureDbReady } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  // TC-13 check
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการตรวจสอบประวัติการใช้งาน' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const search = searchParams.get('search');

  const db = await ensureDbReady();
  let logs = [...db.auditLogs];

  if (action) {
    logs = logs.filter((l) => l.action === action);
  }

  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(
      (l) =>
        l.userName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    logs,
    total: logs.length,
    message: 'ดึงข้อมูลประวัติการใช้งานสำเร็จ',
  });
}

