import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import { ScholarshipType } from '@/types';

export async function GET() {
  const db = await ensureDbReady();
  return NextResponse.json({ scholarships: db.scholarshipTypes });
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['officer', 'admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการจัดการประเภททุน' },
      { status: 403 }
    );
  }

  try {
    const { name, description, targetHours, academicYear } = await request.json();

    if (!name || targetHours === undefined || targetHours === null) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่อทุนและจำนวนชั่วโมงเป้าหมาย' },
        { status: 400 }
      );
    }

    const parsedHours = Number(targetHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return NextResponse.json(
        { error: 'จำนวนชั่วโมงเป้าหมายต้องเป็นตัวเลขที่มากกว่า 0' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    const newScholarship: ScholarshipType = {
      id: `sch-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      targetHours: parsedHours,
      academicYear: academicYear || '2569',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.scholarshipTypes.push(newScholarship);
    await persistDatabase(db);
    await flushDatabaseToTiDB();

    logAudit(
      user.id,
      user.name,
      user.role,
      'CREATE_SCHOLARSHIP',
      `เพิ่มประเภททุนใหม่: ${newScholarship.name} (เป้าหมาย ${newScholarship.targetHours} ชม.)`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'บันทึกประเภททุนและชั่วโมงเป้าหมายสำเร็จ',
      scholarship: newScholarship,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 });
  }
}

