import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, flushDatabaseToTiDB, persistDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Attendance, HourRecord } from '@/types';

export async function POST(request: NextRequest) {
  const db = await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนทำการเช็กชื่อ' }, { status: 401 });
  }

  try {
    const body = await request.json();
    let { activityId, qrSecret: rawQrSecret, qrCodeSecret, studentId: customStudentId, byOrganizer } = body;
    let qrSecret = rawQrSecret || qrCodeSecret;
    const studentId = customStudentId || user.id;

    // Support scanning raw JSON QR payload from organizer QR code
    if (typeof qrSecret === 'string' && qrSecret.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(qrSecret);
        if (parsed.secret) qrSecret = parsed.secret;
        if (!activityId && parsed.activityId) activityId = parsed.activityId;
      } catch {
        // treat as plain string
      }
    }

    // Auto-resolve activity directly from scanned QR secret or activityId (no dropdown needed!)
    const trimmedSecret = typeof qrSecret === 'string' ? qrSecret.trim() : '';
    let activity = activityId
      ? db.activities.find((a) => a.id === activityId)
      : undefined;

    if (!activity && trimmedSecret) {
      activity = db.activities.find(
        (a) => a.qrCodeSecret === trimmedSecret || a.id === trimmedSecret
      );
      if (activity) {
        activityId = activity.id;
      }
    }

    if (!activityId || !activity) {
      return NextResponse.json(
        { error: 'ไม่พบกิจกรรมที่ตรงกับ QR Code นี้ กรุณาสแกน QR Code จากผู้จัดกิจกรรมหน้างาน' },
        { status: 404 }
      );
    }

    const isStaff = user.role === 'organizer' || user.role === 'admin' || user.role === 'officer';

    // Verify QR secret if student self-checks in
    if (!isStaff || (!byOrganizer && trimmedSecret)) {
      if (!trimmedSecret || (trimmedSecret !== activity.qrCodeSecret && trimmedSecret !== activity.id)) {
        return NextResponse.json(
          { error: 'รหัส QR Code กิจกรรมไม่ถูกต้อง' },
          { status: 400 }
        );
      }
    }

    // Check if student is registered
    const registration = db.registrations.find(
      (r) =>
        r.activityId === activityId &&
        r.studentId === studentId &&
        r.status !== 'cancelled'
    );
    if (!registration) {
      return NextResponse.json(
        { error: `คุณยังไม่ได้ลงทะเบียนกิจกรรม "${activity.title}" กรุณาสมัครกิจกรรมก่อนเช็กชื่อ` },
        { status: 400 }
      );
    }

    // Check duplicate check-in
    const existingAttendance = db.attendances.find(
      (att) => att.activityId === activityId && att.studentId === studentId
    );
    if (existingAttendance) {
      logAudit(
        user.id,
        user.name,
        user.role,
        'DUPLICATE_ATTENDANCE_BLOCKED',
        `พยายามเช็กชื่อซ้ำในกิจกรรม "${activity.title}"`
      );
      await persistDatabase();
      return NextResponse.json(
        {
          error: `คุณได้สแกนเข้าร่วมกิจกรรม "${activity.title}" ไปแล้ว`,
          alreadyCheckedIn: true,
          activityTitle: activity.title,
          activityHours: activity.hours,
          attendance: existingAttendance,
        },
        { status: 400 }
      );
    }

    // Record Attendance
    const newAttendance: Attendance = {
      id: `att-${Date.now()}`,
      activityId,
      studentId,
      checkInTime: new Date().toISOString(),
      qrCodeUsed: trimmedSecret || (byOrganizer ? 'ORGANIZER_MANUAL_VERIFIED' : activity.qrCodeSecret),
    };

    db.attendances.push(newAttendance);
    registration.status = 'checked_in';

    // Create or link HourRecord in pending state
    let hr = db.hourRecords.find(
      (h) => h.activityId === activityId && h.studentId === studentId
    );
    if (!hr) {
      hr = {
        id: `hr-${Date.now()}`,
        activityId,
        studentId,
        hours: activity.hours,
        status: 'pending',
        officerComment: byOrganizer
          ? 'ผู้จัดกิจกรรมเช็กชื่อยืนยันการเข้าร่วมหน้างานแล้ว'
          : 'เช็กชื่อผ่านระบบ QR Code สำเร็จ รอตรวจสอบหลักฐาน',
        updatedAt: new Date().toISOString(),
      };
      db.hourRecords.push(hr);
    }

    const studentUser = db.users.find((u) => u.id === studentId);
    logAudit(
      user.id,
      user.name,
      user.role,
      byOrganizer ? 'CHECK_IN_BY_ORGANIZER' : 'CHECK_IN_SUCCESS',
      `${byOrganizer ? 'ผู้จัดเช็กชื่อให้' : 'เช็กชื่อด้วย QR Code'}: กิจกรรม "${activity.title}" สำหรับ ${studentUser?.name || studentId} สำเร็จ`
    );
    await persistDatabase(db);

    return NextResponse.json({
      success: true,
      message: byOrganizer
        ? `บันทึกการเช็กชื่อให้นักศึกษา ${studentUser?.name || ''} สำเร็จ`
        : `เช็กชื่อกิจกรรม "${activity.title}" (+${activity.hours} ชม.) สำเร็จเรียบร้อยแล้ว`,
      activityTitle: activity.title,
      activityHours: activity.hours,
      attendance: newAttendance,
      hourRecord: hr,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเช็กชื่อ' }, { status: 500 });
  }
}
