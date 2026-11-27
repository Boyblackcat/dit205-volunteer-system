import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, splitFullName, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';
import { fetchAllUsersFromTiDB, upsertUserToTiDB } from '@/lib/tidb';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    let user = db.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      const tidbUsers = await fetchAllUsersFromTiDB();
      if (tidbUsers) {
        const foundInTidb = tidbUsers.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase()
        );
        if (foundInTidb) {
          user = foundInTidb;
          db.users.push(foundInTidb);
          await persistDatabase(db);
        }
      }
    }

    if (!user || user.password !== password) {
      // Log failed attempt
      logAudit(
        'anonymous',
        email,
        'student',
        'LOGIN_FAILED',
        `เข้าสู่ระบบล้มเหลวด้วยอีเมล ${email}`
      );
      await flushDatabaseToTiDB();
      return NextResponse.json(
        { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);

    logAudit(
      user.id,
      user.name,
      user.role,
      'LOGIN_SUCCESS',
      `เข้าสู่ระบบสำเร็จในบทบาท ${user.role}`
    );
    await flushDatabaseToTiDB();

    const userSchIds = user.scholarshipTypeIds || (user.scholarshipTypeId ? [user.scholarshipTypeId] : []);
    const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
    const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);

    const { firstName, lastName } = splitFullName(user.name, user.firstName, user.lastName);

    const response = NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: {
        id: user.id,
        name: user.name,
        firstName,
        lastName,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        scholarshipTypeId: userSchIds[0] || user.scholarshipTypeId,
        scholarshipTypeIds: userSchIds,
        scholarshipName: scholarships.map((s) => s.name).join(', ') || undefined,
        targetHours: targetHours > 0 ? targetHours : undefined,
        faculty: user.faculty,
        major: user.major,
      },
      token,
    });

    // Clear any legacy shared cookie so sessions remain strictly isolated per browser tab
    response.cookies.delete('user_session');

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' },
      { status: 500 }
    );
  }
}

