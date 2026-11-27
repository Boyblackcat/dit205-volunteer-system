import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['officer', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการแก้ไขประเภททุน' },
      { status: 403 }
    );
  }

  try {
    const { id } = params;
    const { name, description, targetHours, academicYear } = await request.json();

    const db = await ensureDbReady();
    const index = db.scholarshipTypes.findIndex((s) => s.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'ไม่พบประเภททุนที่ต้องการแก้ไข' }, { status: 404 });
    }

    if (name) db.scholarshipTypes[index].name = name.trim();
    if (description !== undefined) db.scholarshipTypes[index].description = description.trim();
    if (targetHours !== undefined) {
      const h = Number(targetHours);
      if (!isNaN(h) && h > 0) db.scholarshipTypes[index].targetHours = h;
    }
    if (academicYear) db.scholarshipTypes[index].academicYear = academicYear;
    db.scholarshipTypes[index].updatedAt = new Date().toISOString();

    await persistDatabase(db);
    await flushDatabaseToTiDB();

    logAudit(
      user.id,
      user.name,
      user.role,
      'UPDATE_SCHOLARSHIP',
      `แก้ไขประเภททุน: ${db.scholarshipTypes[index].name} (เป้าหมาย ${db.scholarshipTypes[index].targetHours} ชม.)`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'อัปเดตประเภททุนสำเร็จ',
      scholarship: db.scholarshipTypes[index],
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดต' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['officer', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการลบประเภททุน' },
      { status: 403 }
    );
  }

  const { id } = params;
  const db = await ensureDbReady();
  const index = db.scholarshipTypes.findIndex((s) => s.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'ไม่พบประเภททุนที่ต้องการลบ' }, { status: 404 });
  }

  const removed = db.scholarshipTypes.splice(index, 1)[0];
  await persistDatabase(db);
  await flushDatabaseToTiDB();

  logAudit(
    user.id,
    user.name,
    user.role,
    'DELETE_SCHOLARSHIP',
    `ลบประเภททุน: ${removed.name}`
  );
  await flushDatabaseToTiDB();

  return NextResponse.json({ success: true, message: 'ลบประเภททุนสำเร็จ' });
}

