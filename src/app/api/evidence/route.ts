import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { storeDataUrlAsync } from '@/lib/mediaStore';
import { Evidence } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('activityId');
  const studentId = searchParams.get('studentId');

  const db = await ensureDbReady();
  let list = db.evidence;

  if (activityId) {
    list = list.filter((e) => e.activityId === activityId);
  }
  if (studentId) {
    list = list.filter((e) => e.studentId === studentId);
  }

  return NextResponse.json({ evidence: list });
}

export async function POST(request: NextRequest) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  try {
    const { activityId, fileUrl, fileName, notes, studentId: customStudentId } = await request.json();
    const studentId = customStudentId || user.id;

    if (!activityId || !fileUrl) {
      return NextResponse.json(
        { error: 'กรุณาเพิ่มรูปภาพหลักฐานการทำกิจกรรมก่อนส่ง' },
        { status: 400 }
      );
    }

    if (!notes || !String(notes).trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกคำอธิบายหรือรายละเอียดสิ่งที่ได้ทำก่อนส่ง' },
        { status: 400 }
      );
    }

    const db = await ensureDbReady();
    const activity = db.activities.find((a) => a.id === activityId);

    // Remove old evidence if exists or update
    const existingIndex = db.evidence.findIndex(
      (e) => e.activityId === activityId && e.studentId === studentId
    );

    const storedFileUrl = await storeDataUrlAsync(fileUrl, fileName || 'evidence-file.jpg');

    const newEvidence: Evidence = {
      id: `evi-${Date.now()}`,
      activityId,
      studentId,
      fileUrl: storedFileUrl,
      fileName: fileName || 'evidence-file.jpg',
      fileType: 'image/jpeg',
      notes: notes || '',
      uploadedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      db.evidence[existingIndex] = newEvidence;
    } else {
      db.evidence.push(newEvidence);
    }

    await persistDatabase(db);

    logAudit(
      user.id,
      user.name,
      user.role,
      'UPLOAD_EVIDENCE',
      `แนบหลักฐานสำหรับกิจกรรม "${activity?.title || activityId}"`
    );
    await flushDatabaseToTiDB();

    return NextResponse.json({
      success: true,
      message: 'แนบหลักฐานประกอบการเข้าร่วมกิจกรรมเรียบร้อยแล้ว',
      evidence: newEvidence,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแนบหลักฐาน' }, { status: 500 });
  }
}

