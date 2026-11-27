import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, validateScholarshipSelection, composeFullName, splitFullName, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';
import { upsertUserToTiDBBackground } from '@/lib/tidb';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      firstName: rawFirstName,
      lastName: rawLastName,
      email,
      password,
      studentId,
      scholarshipTypeId,
      scholarshipTypeIds,
      faculty,
      major,
      phone,
    } = body;

    const { firstName, lastName } = splitFullName(name, rawFirstName, rawLastName);
    const fullName = composeFullName(firstName, lastName, name);

    // Collect array of scholarship IDs
    let selectedSchIds: string[] = [];
    if (Array.isArray(scholarshipTypeIds) && scholarshipTypeIds.length > 0) {
      selectedSchIds = scholarshipTypeIds;
    } else if (scholarshipTypeId) {
      selectedSchIds = [scholarshipTypeId];
    }

    if (!firstName || !lastName || !email || !password || !studentId || selectedSchIds.length === 0) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, นามสกุล, อีเมล, รหัสผ่าน, รหัสนักศึกษา, และเลือกประเภททุนอย่างน้อย 1 ทุน)' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedStudentId = studentId.trim();

    const db = await ensureDbReady();

    // Check if email already exists
    const existingEmail = db.users.find(
      (u) => u.email.toLowerCase() === trimmedEmail
    );
    if (existingEmail) {
      return NextResponse.json(
        { error: 'อีเมลนี้ถูกใช้งานแล้วในระบบ กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' },
        { status: 400 }
      );
    }

    // Check if studentId already exists
    const existingStudentId = db.users.find(
      (u) => u.studentId && u.studentId.trim() === trimmedStudentId
    );
    if (existingStudentId) {
      return NextResponse.json(
        { error: 'รหัสนักศึกษานี้มีบัญชีในระบบแล้ว' },
        { status: 400 }
      );
    }

    // Verify scholarship rule: max 1 main scholarship + optional กยศ.
    const validation = validateScholarshipSelection(selectedSchIds, db.scholarshipTypes);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'การเลือกประเภททุนไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const validScholarships = validation.validScholarships;
    const finalSchIds = validScholarships.map((s) => s.id);
    const totalTarget = validation.targetHours;
    const combinedNames = validScholarships.map((s) => s.name).join(' + ');

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: fullName,
      firstName,
      lastName,
      email: trimmedEmail,
      password: password,
      role: 'student',
      studentId: trimmedStudentId,
      scholarshipTypeId: finalSchIds[0], // for backwards compatibility
      scholarshipTypeIds: finalSchIds,
      faculty: faculty?.trim() || '',
      major: major?.trim() || '',
      phone: phone?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await persistDatabase(db);
    upsertUserToTiDBBackground(newUser);

    logAudit(
      newUser.id,
      newUser.name,
      newUser.role,
      'STUDENT_REGISTER',
      `นักศึกษาใหม่ลงทะเบียนบัญชี: ${newUser.name} (รหัส ${newUser.studentId}, ทุน: ${combinedNames}, รวมเป้าหมาย ${totalTarget} ชม.)`
    );
    await flushDatabaseToTiDB();

    const token = createSessionToken(newUser);

    const response = NextResponse.json({
      success: true,
      message: 'ลงทะเบียนนักศึกษาใหม่สำเร็จ ยินดีต้อนรับเข้าสู่ระบบ',
      user: {
        id: newUser.id,
        name: newUser.name,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        studentId: newUser.studentId,
        scholarshipTypeId: selectedSchIds[0],
        scholarshipTypeIds: selectedSchIds,
        scholarships: validScholarships.map((s) => ({
          id: s.id,
          name: s.name,
          targetHours: s.targetHours,
        })),
        scholarshipName: combinedNames,
        targetHours: totalTarget,
        faculty: newUser.faculty,
        major: newUser.major,
      },
      token,
    });

    // Clear any legacy shared cookie so sessions remain strictly isolated per browser tab
    response.cookies.delete('user_session');

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
