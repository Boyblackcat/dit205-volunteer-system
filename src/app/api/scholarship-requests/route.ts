import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase, saveDatabase, logAudit, validateScholarshipSelection, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { upsertUserToTiDBBackground } from '@/lib/tidb';
import { storeDataUrlAsync } from '@/lib/mediaStore';
import { ScholarshipChangeRequest } from '@/types';

export async function GET(request: NextRequest) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const db = await ensureDbReady();
  const requests = db.scholarshipRequests || [];

  const enrichRequest = (req: ScholarshipChangeRequest) => {
    const student = db.users.find((u) => u.id === req.studentId);
    const currentScholarships = db.scholarshipTypes.filter((s) =>
      req.currentScholarshipIds.includes(s.id)
    );
    const requestedScholarships = db.scholarshipTypes.filter((s) =>
      req.requestedScholarshipIds.includes(s.id)
    );
    return {
      ...req,
      student: student
        ? {
            id: student.id,
            name: student.name,
            studentId: student.studentId,
            email: student.email,
            faculty: student.faculty,
          }
        : null,
      currentScholarships,
      requestedScholarships,
    };
  };

  if (sessionUser.role === 'officer' || sessionUser.role === 'admin') {
    const allRequests = requests
      .map(enrichRequest)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const students = db.users
      .filter((u) => u.role === 'student')
      .map((u) => {
        const schIds = u.scholarshipTypeIds || (u.scholarshipTypeId ? [u.scholarshipTypeId] : []);
        const scholarships = db.scholarshipTypes.filter((s) => schIds.includes(s.id));
        return {
          id: u.id,
          name: u.name,
          studentId: u.studentId,
          email: u.email,
          faculty: u.faculty,
          scholarshipTypeIds: schIds,
          scholarships,
          targetHours: scholarships.reduce((sum, s) => sum + s.targetHours, 0),
        };
      });

    return NextResponse.json({
      requests: allRequests,
      students,
      allScholarships: db.scholarshipTypes,
      pendingCount: allRequests.filter((r) => r.status === 'pending').length,
    });
  }

  // Student sees their own requests
  const myRequests = requests
    .filter((r) => r.studentId === sessionUser.id)
    .map(enrichRequest)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    requests: myRequests,
    allScholarships: db.scholarshipTypes,
  });
}

export async function POST(request: NextRequest) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      requestedScholarshipIds,
      reason,
      evidenceUrl,
      evidenceFileName,
      directUpdateStudentId,
    } = body;
    const db = await ensureDbReady();
    if (!Array.isArray(db.scholarshipRequests)) {
      db.scholarshipRequests = [];
    }

    // Direct update by officer or admin
    if (directUpdateStudentId && (sessionUser.role === 'officer' || sessionUser.role === 'admin')) {
      const targetUser = db.users.find((u) => u.id === directUpdateStudentId && u.role === 'student');
      if (!targetUser) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลนักศึกษา' }, { status: 404 });
      }
      const validation = validateScholarshipSelection(
        Array.isArray(requestedScholarshipIds) ? requestedScholarshipIds : [],
        db.scholarshipTypes
      );
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'การเลือกประเภททุนไม่ถูกต้อง' },
          { status: 400 }
        );
      }
      const finalIds = validation.validScholarships.map((s) => s.id);
      targetUser.scholarshipTypeIds = finalIds;
      targetUser.scholarshipTypeId = finalIds[0];

      await persistDatabase(db);
      await flushDatabaseToTiDB();
      upsertUserToTiDBBackground(targetUser);

      const newNames = validation.validScholarships.map((s) => s.name).join(' + ');
      logAudit(
        sessionUser.id,
        sessionUser.name,
        sessionUser.role,
        'OFFICER_UPDATE_STUDENT_SCHOLARSHIP',
        `เจ้าหน้าที่แก้ไขประเภททุนของ ${targetUser.name} (${targetUser.studentId}) เป็น: ${newNames}`
      );
      await flushDatabaseToTiDB();

      return NextResponse.json({
        success: true,
        message: `แก้ไขประเภททุนของ ${targetUser.name} เป็น "${newNames}" เรียบร้อยแล้ว`,
      });
    }

    // Student submitting a scholarship change request
    const student = db.users.find((u) => u.id === sessionUser.id);
    if (!student) {
      return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้งาน' }, { status: 404 });
    }

    if (!reason || !String(reason).trim()) {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการขอแก้ไขประเภททุนการศึกษา' },
        { status: 400 }
      );
    }

    const validation = validateScholarshipSelection(
      Array.isArray(requestedScholarshipIds) ? requestedScholarshipIds : [],
      db.scholarshipTypes
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'การเลือกประเภททุนไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const currentIds =
      student.scholarshipTypeIds || (student.scholarshipTypeId ? [student.scholarshipTypeId] : []);
    const finalRequestedIds = validation.validScholarships.map((s) => s.id);

    const sameSelection =
      finalRequestedIds.length === currentIds.length &&
      finalRequestedIds.every((id) => currentIds.includes(id));
    if (sameSelection) {
      return NextResponse.json(
        { error: 'ประเภททุนที่เลือกเหมือนกับทุนปัจจุบันของคุณ กรุณาเลือกทุนที่ต้องการเปลี่ยนแปลง' },
        { status: 400 }
      );
    }

    const existingPending = db.scholarshipRequests.find(
      (r) => r.studentId === student.id && r.status === 'pending'
    );
    if (existingPending) {
      return NextResponse.json(
        { error: 'คุณมีคำขอแก้ไขทุนที่อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบอยู่แล้ว กรุณารอผลการพิจารณาหรือยกเลิกคำขอเดิมก่อน' },
        { status: 400 }
      );
    }

    const storedEvidenceUrl = evidenceUrl
      ? await storeDataUrlAsync(evidenceUrl, evidenceFileName || 'scholarship-proof.jpg')
      : undefined;

    const newReq: ScholarshipChangeRequest = {
      id: `schreq-${Date.now()}`,
      studentId: student.id,
      currentScholarshipIds: currentIds,
      requestedScholarshipIds: finalRequestedIds,
      reason: String(reason).trim(),
      evidenceUrl: storedEvidenceUrl,
      evidenceFileName: evidenceFileName || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    db.scholarshipRequests.unshift(newReq);
    await persistDatabase(db);
    await flushDatabaseToTiDB();

    const reqNames = validation.validScholarships.map((s) => s.name).join(' + ');
    logAudit(
      student.id,
      student.name,
      student.role,
      'REQUEST_SCHOLARSHIP_CHANGE',
      `ส่งคำขอเปลี่ยนประเภททุนเป็น: ${reqNames} (เหตุผล: ${newReq.reason})`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอแก้ไขประเภททุนไปยังเจ้าหน้าที่ดูแลทุนเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบ',
      request: newReq,
    });
  } catch (err) {
    console.error('POST /api/scholarship-requests error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการส่งคำขอ' }, { status: 500 });
  }
}
