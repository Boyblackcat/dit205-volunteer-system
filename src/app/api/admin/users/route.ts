import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, validateScholarshipSelection, splitFullName, composeFullName, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import { upsertUserToTiDBBackground } from '@/lib/tidb';
import { Role, User } from '@/types';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการเข้าถึงหน้าจัดการบัญชีผู้ใช้งาน' },
      { status: 403 }
    );
  }

  const db = await ensureDbReady();
  const safeUsers = db.users.map(({ password, ...u }) => {
    const userSchIds = u.scholarshipTypeIds || (u.scholarshipTypeId ? [u.scholarshipTypeId] : []);
    const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
    const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);
    const { firstName, lastName } = splitFullName(u.name, u.firstName, u.lastName);
    return {
      ...u,
      firstName,
      lastName,
      scholarshipTypeIds: userSchIds,
      scholarshipName: scholarships.map((s) => s.name).join(', ') || 'ไม่ได้ระบุ',
      targetHours,
    };
  });

  return NextResponse.json({ users: safeUsers });
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการจัดการบัญชีผู้ใช้งาน' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      firstName: rawFirstName,
      lastName: rawLastName,
      email,
      password,
      role,
      studentId,
      scholarshipTypeId,
      scholarshipTypeIds,
      faculty,
      major,
      phone,
    } = body;

    const { firstName, lastName } = splitFullName(name, rawFirstName, rawLastName);
    const fullName = composeFullName(firstName, lastName, name);

    if (!firstName || !lastName || !email || !password || !role) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, นามสกุล, อีเมล, รหัสผ่าน, บทบาท)' },
        { status: 400 }
      );
    }

    const validRoles: Role[] = ['student', 'organizer', 'officer', 'approver', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'บทบาทผู้ใช้ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await ensureDbReady();
    const existing = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return NextResponse.json({ error: 'อีเมลนี้มีอยู่ในระบบแล้ว' }, { status: 400 });
    }

    let selectedSchIds: string[] = [];
    if (role === 'student') {
      if (Array.isArray(scholarshipTypeIds) && scholarshipTypeIds.length > 0) {
        selectedSchIds = scholarshipTypeIds;
      } else if (scholarshipTypeId) {
        selectedSchIds = [scholarshipTypeId];
      }
      if (selectedSchIds.length > 0) {
        const validation = validateScholarshipSelection(selectedSchIds, db.scholarshipTypes);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        selectedSchIds = validation.validScholarships.map((s) => s.id);
      }
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: fullName,
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      password,
      role,
      studentId: role === 'student' ? studentId?.trim() : undefined,
      scholarshipTypeId: selectedSchIds[0],
      scholarshipTypeIds: selectedSchIds,
      faculty: faculty?.trim() || '',
      major: major?.trim() || '',
      phone: phone?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await persistDatabase(db);
    await flushDatabaseToTiDB();
    upsertUserToTiDBBackground(newUser);

    logAudit(
      user.id,
      user.name,
      user.role,
      'ADMIN_CREATE_USER',
      `สร้างบัญชีผู้ใช้ใหม่: ${newUser.name} (${newUser.email}) บทบาท: ${newUser.role}`
    );
    await flushDatabaseToTiDB();

    const { password: _, ...safeUser } = newUser;
    return NextResponse.json({
      success: true,
      message: `สร้างบัญชีผู้ใช้ ${newUser.name} บทบาท ${newUser.role} สำเร็จ`,
      user: safeUser,
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างบัญชี' }, { status: 500 });
  }
}
