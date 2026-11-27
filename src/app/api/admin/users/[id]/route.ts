import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, validateScholarshipSelection, splitFullName, composeFullName, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import { upsertUserToTiDBBackground, deleteUserFromTiDBBackground } from '@/lib/tidb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการแก้ไขบัญชีผู้ใช้งาน' },
      { status: 403 }
    );
  }

  const { id } = params;
  const db = await ensureDbReady();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const u = db.users[index];

    if (body.firstName !== undefined || body.lastName !== undefined) {
      const f = String(body.firstName ?? '').trim();
      const l = String(body.lastName ?? '').trim();
      if (!f) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อ' }, { status: 400 });
      }
      u.firstName = f;
      u.lastName = l;
      u.name = composeFullName(f, l, u.name);
    } else if (body.name) {
      const split = splitFullName(body.name);
      u.firstName = split.firstName;
      u.lastName = split.lastName;
      u.name = body.name.trim();
    }
    if (body.email) u.email = body.email.trim().toLowerCase();
    if (body.role) u.role = body.role;
    if (body.studentId !== undefined) u.studentId = body.studentId;
    if (body.scholarshipTypeIds !== undefined && Array.isArray(body.scholarshipTypeIds)) {
      if (u.role === 'student' && body.scholarshipTypeIds.length > 0) {
        const validation = validateScholarshipSelection(body.scholarshipTypeIds, db.scholarshipTypes);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        const finalIds = validation.validScholarships.map((s) => s.id);
        u.scholarshipTypeIds = finalIds;
        u.scholarshipTypeId = finalIds[0] || undefined;
      } else {
        u.scholarshipTypeIds = body.scholarshipTypeIds;
        u.scholarshipTypeId = body.scholarshipTypeIds[0] || undefined;
      }
    } else if (body.scholarshipTypeId !== undefined) {
      u.scholarshipTypeId = body.scholarshipTypeId;
      u.scholarshipTypeIds = body.scholarshipTypeId ? [body.scholarshipTypeId] : [];
    }
    if (body.faculty !== undefined) u.faculty = body.faculty;
    if (body.major !== undefined) u.major = body.major;
    if (body.phone !== undefined) u.phone = body.phone;
    if (body.password) u.password = body.password;

    await persistDatabase(db);
    await flushDatabaseToTiDB();
    upsertUserToTiDBBackground(u);

    logAudit(
      user.id,
      user.name,
      user.role,
      'ADMIN_UPDATE_USER',
      `แก้ไขข้อมูลและบทบาทของ ${u.name} เป็น ${u.role}`
    );
    await flushDatabaseToTiDB();

    const { password: _, ...safeUser } = u;
    return NextResponse.json({
      success: true,
      message: 'อัปเดตข้อมูลบัญชีสำเร็จ',
      user: safeUser,
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
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการลบบัญชีผู้ใช้งาน' },
      { status: 403 }
    );
  }

  const { id } = params;
  if (id === user.id) {
    return NextResponse.json(
      { error: 'ไม่สามารถลบบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้' },
      { status: 400 }
    );
  }

  const db = await ensureDbReady();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
  }

  const removed = db.users.splice(index, 1)[0];
  await persistDatabase(db);
  await flushDatabaseToTiDB();
  deleteUserFromTiDBBackground(id);

  logAudit(
    user.id,
    user.name,
    user.role,
    'ADMIN_DELETE_USER',
    `ลบบัญชีผู้ใช้: ${removed.name} (${removed.email})`
  );
  await flushDatabaseToTiDB();

  return NextResponse.json({ success: true, message: 'ลบบัญชีผู้ใช้สำเร็จ' });
}

