import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await ensureDbReady();
  return NextResponse.json({ settings: db.settings });
}

export async function PUT(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json(
      { error: 'ไม่มีสิทธิ์ในการตั้งค่าระบบ' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const db = await ensureDbReady();

    if (body.addAcademicYear) {
      const yr = String(body.addAcademicYear).trim();
      if (!/^\d{4}$/.test(yr)) {
        return NextResponse.json(
          { error: 'กรุณากรอกปีการศึกษาเป็นตัวเลข 4 หลัก (เช่น 2571)' },
          { status: 400 }
        );
      }
      const baseYears =
        Array.isArray(db.settings?.academicYears) && db.settings.academicYears.length > 0
          ? db.settings.academicYears
          : ['2568', '2569', '2570'];
      const existingSet = new Set<string>(baseYears);
      db.activities.forEach((a) => {
        if (a.academicYear) existingSet.add(a.academicYear);
      });
      if (existingSet.has(yr)) {
        return NextResponse.json(
          { error: `ปีการศึกษา ${yr} มีอยู่ในระบบแล้ว` },
          { status: 400 }
        );
      }
      existingSet.add(yr);
      db.settings = {
        ...db.settings,
        academicYears: Array.from(existingSet).sort(),
      };
      await persistDatabase(db);
      await flushDatabaseToTiDB();

      logAudit(
        user.id,
        user.name,
        user.role,
        'ADD_ACADEMIC_YEAR',
        `เพิ่มปีการศึกษาใหม่: ${yr}`
      );
      await flushDatabaseToTiDB();

      return NextResponse.json({
        success: true,
        message: `เพิ่มปีการศึกษา ${yr} เรียบร้อยแล้ว`,
        settings: db.settings,
        availableYears: db.settings.academicYears,
      });
    }

    if (body.removeAcademicYear) {
      const yr = String(body.removeAcademicYear).trim();
      const baseYears =
        Array.isArray(db.settings?.academicYears) && db.settings.academicYears.length > 0
          ? [...db.settings.academicYears]
          : ['2568', '2569', '2570'];

      const actsUsingYear = db.activities.filter((a) => (a.academicYear || '2569') === yr);
      if (actsUsingYear.length > 0) {
        return NextResponse.json(
          {
            error: `ไม่สามารถลบปีการศึกษา ${yr} ได้ เนื่องจากยังมีกิจกรรมอยู่ในปีการศึกษานี้ ${actsUsingYear.length} รายการ`,
          },
          { status: 400 }
        );
      }

      const nextYears = baseYears.filter((y) => y !== yr);
      if (nextYears.length === 0) {
        return NextResponse.json(
          { error: 'ต้องมีปีการศึกษาในระบบอย่างน้อย 1 ปีการศึกษา' },
          { status: 400 }
        );
      }

      db.settings = {
        ...db.settings,
        academicYears: nextYears.sort(),
        academicYear:
          db.settings.academicYear === yr ? nextYears[nextYears.length - 1] : db.settings.academicYear,
      };
      await persistDatabase(db);
      await flushDatabaseToTiDB();

      logAudit(
        user.id,
        user.name,
        user.role,
        'REMOVE_ACADEMIC_YEAR',
        `ลบปีการศึกษา: ${yr}`
      );
      await flushDatabaseToTiDB();

      return NextResponse.json({
        success: true,
        message: `ลบปีการศึกษา ${yr} เรียบร้อยแล้ว`,
        settings: db.settings,
        availableYears: db.settings.academicYears,
      });
    }

    db.settings = {
      ...db.settings,
      ...body,
    };
    await persistDatabase(db);
    await flushDatabaseToTiDB();

    logAudit(
      user.id,
      user.name,
      user.role,
      'UPDATE_SYSTEM_SETTINGS',
      'อัปเดตการตั้งค่าระบบส่วนกลาง'
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'อัปเดตการตั้งค่าระบบเรียบร้อยแล้ว',
      settings: db.settings,
    });
  } catch (err) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่า' }, { status: 500 });
  }
}

