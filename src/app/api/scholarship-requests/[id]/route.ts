import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase, saveDatabase, logAudit, validateScholarshipSelection, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { upsertUserToTiDBBackground } from '@/lib/tidb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser || (sessionUser.role !== 'officer' && sessionUser.role !== 'admin')) {
    return NextResponse.json(
      { error: 'เฉพาะเจ้าหน้าที่ดูแลทุนหรือผู้ดูแลระบบเท่านั้นที่สามารถอนุมัติคำขอเปลี่ยนทุนได้' },
      { status: 403 }
    );
  }

  try {
    const { action, officerComment } = await request.json();
    const db = await ensureDbReady();
    if (!Array.isArray(db.scholarshipRequests)) {
      db.scholarshipRequests = [];
    }

    const reqItem = db.scholarshipRequests.find((r) => r.id === params.id);
    if (!reqItem) {
      return NextResponse.json({ error: 'ไม่พบคำขอแก้ไขทุนที่ระบุ' }, { status: 404 });
    }

    const student = db.users.find((u) => u.id === reqItem.studentId);
    if (!student) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลนักศึกษาเจ้าของคำขอ' }, { status: 404 });
    }

    if (action === 'approve') {
      const validation = validateScholarshipSelection(
        reqItem.requestedScholarshipIds,
        db.scholarshipTypes
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'ประเภททุนในคำขอไม่ถูกต้อง' },
          { status: 400 }
        );
      }

      const finalIds = validation.validScholarships.map((s) => s.id);
      student.scholarshipTypeIds = finalIds;
      student.scholarshipTypeId = finalIds[0];

      reqItem.status = 'approved';
      reqItem.officerComment = officerComment?.trim() || 'อนุมัติและอัปเดตประเภททุนเรียบร้อยแล้ว';
      reqItem.reviewedBy = sessionUser.name;
      reqItem.reviewedAt = new Date().toISOString();

      await persistDatabase(db);
      await flushDatabaseToTiDB();
      upsertUserToTiDBBackground(student);

      const newNames = validation.validScholarships.map((s) => s.name).join(' + ');
      logAudit(
        sessionUser.id,
        sessionUser.name,
        sessionUser.role,
        'APPROVE_SCHOLARSHIP_REQUEST',
        `อนุมัติคำขอเปลี่ยนทุนของ ${student.name} (${student.studentId}) เป็น: ${newNames}`
      );
      await flushDatabaseToTiDB();

      return NextResponse.json({
        success: true,
        message: `อนุมัติและเปลี่ยนทุนของ ${student.name} เป็น "${newNames}" เรียบร้อยแล้ว`,
        request: reqItem,
      });
    }

    if (action === 'reject') {
      if (!officerComment || !String(officerComment).trim()) {
        return NextResponse.json(
          { error: 'กรุณาระบุเหตุผลในการไม่อนุมัติคำขอเปลี่ยนทุน' },
          { status: 400 }
        );
      }

      reqItem.status = 'rejected';
      reqItem.officerComment = String(officerComment).trim();
      reqItem.reviewedBy = sessionUser.name;
      reqItem.reviewedAt = new Date().toISOString();

      await persistDatabase(db);
      await flushDatabaseToTiDB();

      logAudit(
        sessionUser.id,
        sessionUser.name,
        sessionUser.role,
        'REJECT_SCHOLARSHIP_REQUEST',
        `ไม่อนุมัติคำขอเปลี่ยนทุนของ ${student.name} (${student.studentId}) เหตุผล: ${reqItem.officerComment}`
      );
      await flushDatabaseToTiDB();

      return NextResponse.json({
        success: true,
        message: `ปฏิเสธคำขอเปลี่ยนทุนของ ${student.name} เรียบร้อยแล้ว`,
        request: reqItem,
      });
    }

    return NextResponse.json({ error: 'action ไม่ถูกต้อง (ต้องเป็น approve หรือ reject)' }, { status: 400 });
  } catch (err) {
    console.error('PUT /api/scholarship-requests/[id] error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const db = await ensureDbReady();
  if (!Array.isArray(db.scholarshipRequests)) {
    return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });
  }

  const idx = db.scholarshipRequests.findIndex((r) => r.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ error: 'ไม่พบคำขอแก้ไขทุน' }, { status: 404 });
  }

  const target = db.scholarshipRequests[idx];
  if (
    target.studentId !== sessionUser.id &&
    sessionUser.role !== 'officer' &&
    sessionUser.role !== 'admin'
  ) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์ยกเลิกคำขอนี้' }, { status: 403 });
  }

  if (target.status !== 'pending') {
    return NextResponse.json({ error: 'ไม่สามารถยกเลิกคำขอที่พิจารณาแล้วได้' }, { status: 400 });
  }

  db.scholarshipRequests.splice(idx, 1);
  await persistDatabase(db);
  await flushDatabaseToTiDB();

  return NextResponse.json({ success: true, message: 'ยกเลิกคำขอแก้ไขทุนเรียบร้อยแล้ว' });
}
