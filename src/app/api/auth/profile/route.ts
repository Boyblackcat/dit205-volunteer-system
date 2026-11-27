import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createSessionToken } from '@/lib/auth';
import { getDatabase, saveDatabase, logAudit, splitFullName, composeFullName, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { upsertUserToTiDBBackground } from '@/lib/tidb';

export async function GET(request: NextRequest) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const db = await ensureDbReady();
  const user = db.users.find((u) => u.id === sessionUser.id);
  if (!user) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' }, { status: 404 });
  }

  const userSchIds = user.scholarshipTypeIds || (user.scholarshipTypeId ? [user.scholarshipTypeId] : []);
  const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
  const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);
  const { firstName, lastName } = splitFullName(user.name, user.firstName, user.lastName);

  const { password: _, ...safeUser } = user;
  return NextResponse.json({
    user: {
      ...safeUser,
      firstName,
      lastName,
      scholarshipTypeIds: userSchIds,
      scholarships,
      scholarshipName: scholarships.map((s) => s.name).join(', ') || 'ไม่ได้ระบุ',
      targetHours,
    },
    allScholarships: db.scholarshipTypes,
  });
}

export async function PUT(request: NextRequest) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, firstName, lastName, phone, faculty, major, studentId, scholarshipTypeIds, password } = body;

    const db = await ensureDbReady();
    const userIndex = db.users.findIndex((u) => u.id === sessionUser.id);
    if (userIndex === -1) {
      return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
    }

    const u = db.users[userIndex];

    if (firstName !== undefined || lastName !== undefined) {
      const f = String(firstName ?? '').trim();
      const l = String(lastName ?? '').trim();
      if (!f) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อ' }, { status: 400 });
      }
      u.firstName = f;
      u.lastName = l;
      u.name = composeFullName(f, l, u.name);
    } else if (name) {
      const split = splitFullName(name);
      u.firstName = split.firstName;
      u.lastName = split.lastName;
      u.name = name.trim();
    }
    if (phone !== undefined) u.phone = phone.trim();
    if (faculty !== undefined) u.faculty = faculty.trim();
    if (major !== undefined) u.major = major.trim();
    if (studentId !== undefined && u.role === 'student') u.studentId = studentId.trim();
    if (password && password.trim().length >= 4) u.password = password.trim();

    if (u.role === 'student' && Array.isArray(scholarshipTypeIds)) {
      const currentIds = u.scholarshipTypeIds || (u.scholarshipTypeId ? [u.scholarshipTypeId] : []);
      const isChanging =
        scholarshipTypeIds.length !== currentIds.length ||
        scholarshipTypeIds.some((id: string) => !currentIds.includes(id));
      if (isChanging) {
        return NextResponse.json(
          { error: 'นักศึกษาไม่สามารถแก้ไขประเภททุนด้วยตนเองได้ กรุณาส่งคำขอแก้ไขทุนไปยังเจ้าหน้าที่ดูแลทุน' },
          { status: 403 }
        );
      }
    }

    await persistDatabase(db);
    await flushDatabaseToTiDB();
    upsertUserToTiDBBackground(u);

    const validScholarships = db.scholarshipTypes.filter((s) =>
      u.scholarshipTypeIds?.includes(s.id) || u.scholarshipTypeId === s.id
    );
    const combinedNames = validScholarships.map((s) => s.name).join(' + ');
    const totalTarget = validScholarships.reduce((sum, s) => sum + s.targetHours, 0);

    logAudit(
      u.id,
      u.name,
      u.role,
      'UPDATE_PROFILE',
      `ผู้ใช้แก้ไขข้อมูลส่วนตัว (ทุน: ${combinedNames || 'ไม่ระบุ'}, รวมเป้าหมาย ${totalTarget} ชม.)`
    );
    await flushDatabaseToTiDB();

    const token = createSessionToken(u);
    const response = NextResponse.json({
      success: true,
      message: 'อัปเดตข้อมูลส่วนตัวและทุนการศึกษาเรียบร้อยแล้ว',
      user: {
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        studentId: u.studentId,
        scholarshipTypeId: u.scholarshipTypeId,
        scholarshipTypeIds: u.scholarshipTypeIds,
        scholarships: validScholarships.map((s) => ({
          id: s.id,
          name: s.name,
          targetHours: s.targetHours,
        })),
        scholarshipName: combinedNames,
        targetHours: totalTarget,
        faculty: u.faculty,
        major: u.major,
        phone: u.phone,
      },
      token,
    });

    response.cookies.set({
      name: 'user_session',
      value: token,
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' }, { status: 500 });
  }
}

