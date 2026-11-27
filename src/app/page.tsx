'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminMonthlyChart } from '@/components/AdminMonthlyChart';
import { Role } from '@/types';
import {
  CheckCircle2,
  Clock,
  Target,
  Calendar,
  MapPin,
  Users,
  Award,
  ArrowRight,
  Sparkles,
  QrCode,
  FileCheck,
  ShieldCheck,
  PlusCircle,
  FileText,
  GraduationCap,
  ClipboardList,
  UploadCloud,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [myRegMap, setMyRegMap] = useState<Record<string, any>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [regLoading, setRegLoading] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string | null>(null);
  const [filterSemester, setFilterSemester] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [ineligiblePopup, setIneligiblePopup] = useState<{
    activityTitle: string;
    reason: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      if (user.role === 'student') {
        Promise.all([fetchActivities(), fetchMyRegistrations()]);
      }
    } else {
      setDataLoading(false);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchDashboard();
    }
  }, [user, filterYear, filterSemester]);

  const fetchDashboard = async () => {
    try {
      const params = new URLSearchParams();
      if (filterYear !== null) params.set('academicYear', filterYear);
      if (filterSemester !== null) params.set('semester', filterSemester);
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data.metrics);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activities?status=approved');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities.slice(0, 4));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMyRegistrations = async () => {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        (data.registrations || []).forEach((r: any) => {
          map[r.activityId] = r;
        });
        setMyRegMap(map);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickRegister = async (activityId: string) => {
    const targetAct = activities.find((a) => a.id === activityId);
    setRegLoading(activityId);
    setFeedback(null);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          text: 'ลงทะเบียนกิจกรรมสำเร็จ! คุณสามารถไปเช็กชื่อและแนบหลักฐานได้ที่เมนู "กิจกรรมของฉัน"',
          type: 'success',
        });
        fetchActivities();
        fetchMyRegistrations();
        fetchDashboard();
      } else {
        const errText = data.error || 'ไม่สามารถสมัครได้';
        if (errText.includes('เฉพาะนักศึกษาที่ได้รับทุน')) {
          setIneligiblePopup({
            activityTitle: targetAct?.title || 'กิจกรรมที่เลือก',
            reason: errText,
          });
        } else {
          setFeedback({ text: errText, type: 'error' });
        }
      }
    } catch {
      setFeedback({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setRegLoading(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // LOGGED-IN DASHBOARD
  return (
    <div className="space-y-6">
      {/* Top User Welcome Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold text-xl flex items-center justify-center shadow-sm flex-shrink-0">
            {user.name.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                สวัสดี, {user.name}
              </h1>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {user.role === 'student' && '🎓 นักศึกษาทุน'}
                {user.role === 'organizer' && '🏢 ผู้จัดกิจกรรม'}
                {user.role === 'officer' && '📋 เจ้าหน้าที่ดูแลทุน'}
                {user.role === 'approver' && '✍️ ผู้อนุมัติ'}
                {user.role === 'admin' && '⚙️ ผู้ดูแลระบบ'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {user.role === 'student' && (
                <>
                  รหัสนักศึกษา: <strong className="text-slate-700">{user.studentId || '-'}</strong> • ทุนปัจจุบัน:{' '}
                  <strong className="text-emerald-700">{dashboardData?.scholarshipName || user.scholarshipName || 'กำลังโหลด...'}</strong>
                </>
              )}
              {user.role === 'organizer' && 'จัดการกิจกรรม แสดง QR Code หน้างาน และเช็กชื่อนักศึกษาที่เข้าร่วม'}
              {user.role === 'officer' && 'จัดการประเภททุน/ชั่วโมงเป้าหมาย และตรวจสอบรูปหลักฐานของนักศึกษา'}
              {user.role === 'approver' && 'อนุมัติเปิดรับสมัครกิจกรรมใหม่ และรับรองชั่วโมงจิตอาสาขั้นสุดท้าย'}
              {user.role === 'admin' && 'จัดการบัญชีผู้ใช้งาน ซิงก์ฐานข้อมูล TiDB Cloud และตรวจสอบประวัติระบบ'}
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          {feedback.type === 'success' && user.role === 'student' && (
            <Link
              href="/my-hours"
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold whitespace-nowrap hover:bg-emerald-700"
            >
              ไปที่กิจกรรมของฉัน →
            </Link>
          )}
        </div>
      )}

      {dataLoading && !dashboardData && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-white border border-slate-200/80 p-5">
                <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
                <div className="h-8 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-3xl bg-white border border-slate-200/80" />
        </div>
      )}

      {/* STUDENT DASHBOARD */}
      {user.role === 'student' && dashboardData && (
        <div className="space-y-6">
          {/* 4-Step Easy Workflow Guide */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                ขั้นตอนการสะสมชั่วโมงจิตอาสา (คลิกที่ขั้นตอนเพื่อดำเนินการ)
              </h2>
              <span className="text-xs text-slate-400 hidden sm:inline">ใช้งานง่ายใน 4 ขั้นตอน</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/activities"
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition flex items-start gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">เลือกสมัครกิจกรรม</div>
                  <p className="text-xs text-slate-500 mt-0.5">เลือกกิจกรรมที่สนใจและกดสมัครเข้าร่วม</p>
                </div>
              </Link>

              <Link
                href="/check-in"
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition flex items-start gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">สแกนเข้าร่วมกิจกรรม</div>
                  <p className="text-xs text-slate-500 mt-0.5">เปิดกล้องสแกน QR Code หน้างาน</p>
                </div>
              </Link>

              <Link
                href="/my-hours"
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition flex items-start gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">แนบรูปหลักฐาน</div>
                  <p className="text-xs text-slate-500 mt-0.5">อัปโหลดภาพถ่ายกิจกรรมที่เมนู &ldquo;กิจกรรมของฉัน&rdquo;</p>
                </div>
              </Link>

              <Link
                href="/my-hours"
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition flex items-start gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">รับชั่วโมงจิตอาสา</div>
                  <p className="text-xs text-slate-500 mt-0.5">เมื่ออนุมัติแล้ว ชั่วโมงจะสะสมเข้าเป้าหมายทันที</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Progress & Metrics Summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  สรุปชั่วโมงจิตอาสาของคุณ
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  ทุนที่ได้รับ: {dashboardData.scholarshipName}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">เป้าหมายรวม</span>
                  <Target className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {dashboardData.targetHours} <span className="text-xs font-normal text-slate-500">ชม.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-xs font-semibold">อนุมัติแล้ว</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                  {dashboardData.approvedHours} <span className="text-xs font-normal text-emerald-600">ชม.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                <div className="flex items-center justify-between text-amber-700 mb-1">
                  <span className="text-xs font-semibold">รอตรวจสอบ</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">
                  {dashboardData.pendingHours} <span className="text-xs font-normal text-amber-600">ชม.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white">
                <div className="flex items-center justify-between text-slate-300 mb-1">
                  <span className="text-xs font-semibold">ยังขาดอีก</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {dashboardData.remainingHours} <span className="text-xs font-normal text-slate-400">ชม.</span>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div>
              <div className="flex justify-between items-center text-xs sm:text-sm mb-2">
                <span className="font-semibold text-slate-700">
                  ความคืบหน้าการสะสมชั่วโมงจิตอาสา{' '}
                  <span className="text-emerald-700 font-bold">
                    (เทอม {dashboardData.selectedSemester || '1'}/{dashboardData.selectedYear || '2569'})
                  </span>
                </span>
                <span className="font-bold text-emerald-600">
                  สะสมแล้ว {dashboardData.approvedHours} จาก {dashboardData.targetHours} ชั่วโมง ({dashboardData.percentComplete}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-0.5 border border-slate-200/60">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(dashboardData.percentComplete, 2))}%` }}
                />
              </div>
            </div>

            {/* Term-by-Term Breakdown for Students */}
            {Array.isArray(dashboardData.termBreakdown) && dashboardData.termBreakdown.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    📅 ชั่วโมงจิตอาสาแยกตามแต่ละเทอม (คลิกเลือกเทอมเพื่อดูรายละเอียด)
                  </h4>
                  <p className="text-xs text-slate-500">
                    แต่ละเทอมจะแยกชั่วโมงออกจากกันโดยอัตโนมัติ ไม่นำชั่วโมงของปีก่อนมาปนกัน
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {dashboardData.termBreakdown.map((t: any) => {
                    const isSelected =
                      dashboardData.selectedYear === t.academicYear &&
                      dashboardData.selectedSemester === t.semester;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          setFilterYear(t.academicYear);
                          setFilterSemester(t.semester);
                        }}
                        className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900">{t.label}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                            {t.registeredCount} กิจกรรม
                          </span>
                        </div>
                        <div className="text-xl font-extrabold text-emerald-700">
                          {t.approvedHours}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            / {t.targetHours} ชม.
                          </span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${t.percentOfTarget}%` }}
                          />
                        </div>
                        {t.pendingHours > 0 && (
                          <div className="text-[11px] text-amber-700 font-medium mt-1">
                            + รอตรวจ {t.pendingHours} ชม.
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Activities Section with Direct 1-Click Registration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  กิจกรรมจิตอาสาที่เปิดรับสมัคร
                </h2>
                <p className="text-xs text-slate-500">
                  กดปุ่ม &ldquo;สมัครเข้าร่วมทันที&rdquo; บนการ์ดเพื่อลงทะเบียนได้ในคลิกเดียว
                </p>
              </div>
              <Link
                href="/activities"
                className="text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                ดูกิจกรรมทั้งหมด <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.map((act) => {
                const reg = myRegMap[act.id];
                const isRegistered = Boolean(reg);
                const isApproved = reg?.hourRecord?.status === 'approved';
                const isCheckedIn = reg?.status === 'checked_in' || Boolean(reg?.attendance);
                const isFull = act.currentParticipants >= act.maxParticipants;
                const isDeadlinePassed = act.registrationDeadline
                  ? new Date() > new Date(act.registrationDeadline)
                  : Boolean(act.isRegistrationClosed);

                return (
                  <div
                    key={act.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-200">
                            {act.category}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                            เทอม {act.semester || '1'}/{act.academicYear || '2569'}
                          </span>
                        </div>
                        <span className="bg-amber-100 text-amber-900 text-xs px-3 py-1 rounded-full font-bold">
                          +{act.hours} ชั่วโมง
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mb-1.5">
                        {act.title}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                        {act.description}
                      </p>

                      <div className="space-y-1.5 text-xs text-slate-500 mb-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{act.date} ({act.startTime} - {act.endTime} น.)</span>
                        </div>
                        {act.registrationDeadline && (
                          <div className={`flex items-center gap-2 font-semibold ${isDeadlinePassed ? 'text-rose-600' : 'text-amber-700'}`}>
                            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>
                              {isDeadlinePassed ? 'ปิดรับสมัครแล้ว: ' : 'สมัครได้ถึง: '}
                              {new Date(act.registrationDeadline).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}{' '}
                              น.
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span className="truncate">{act.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-blue-500" />
                          <span>
                            ผู้สมัคร {act.currentParticipants} / {act.maxParticipants} คน
                          </span>
                        </div>
                      </div>
                    </div>

                    {isApproved ? (
                      <div className="w-full py-2.5 bg-emerald-600 text-white rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        เข้าร่วมไปแล้ว (อนุมัติชั่วโมงแล้ว)
                      </div>
                    ) : isCheckedIn ? (
                      <Link
                        href="/my-hours"
                        className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        เข้าร่วมไปแล้ว — ดูสถานะ / แนบหลักฐาน →
                      </Link>
                    ) : isRegistered ? (
                      <Link
                        href="/my-hours"
                        className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        สมัครแล้ว — ไปสแกนเข้าร่วม / แนบหลักฐาน →
                      </Link>
                    ) : isDeadlinePassed ? (
                      <div className="w-full py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-bold text-center">
                        หมดเวลารับสมัครแล้ว (ไม่สามารถเข้าร่วมได้)
                      </div>
                    ) : isFull ? (
                      <div className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-2xl text-xs font-semibold text-center">
                        ที่นั่งเต็มแล้ว ({act.currentParticipants}/{act.maxParticipants})
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickRegister(act.id)}
                        disabled={regLoading === act.id}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold text-center transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {regLoading === act.id ? 'กำลังลงทะเบียน...' : 'สมัครเข้าร่วมทันที'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STAFF / ADMIN / ORGANIZER DASHBOARD */}
      {user.role !== 'student' && dashboardData && (
        <div className="space-y-6">
          {/* Clean Unified Filter Bar for Staff / Admin */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs sm:text-sm font-bold text-slate-700">
              📅 กรองข้อมูลแดชบอร์ดตามปีการศึกษา / เทอม:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterYear !== null ? filterYear : dashboardData.selectedYear ?? ''}
                onChange={(e) => {
                  const nextYear = e.target.value;
                  const currentSem =
                    filterSemester !== null
                      ? filterSemester
                      : dashboardData.selectedSemester || '1';
                  setFilterYear(nextYear);
                  setFilterSemester(currentSem);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">ทุกปีการศึกษา</option>
                {(dashboardData.availableYears || ['2568', '2569', '2570']).map((y: string) => (
                  <option key={y} value={y}>
                    ปีการศึกษา {y}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { val: '1', label: 'เทอม 1' },
                  { val: '2', label: 'เทอม 2' },
                ].map((t) => {
                  const currentSem =
                    filterSemester !== null
                      ? filterSemester
                      : dashboardData.selectedSemester || '1';
                  return (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => {
                        const currentYr =
                          filterYear !== null
                            ? filterYear
                            : dashboardData.selectedYear ?? '';
                        setFilterYear(currentYr);
                        setFilterSemester(t.val);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        currentSem === t.val
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Action Cards for Staff Roles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">นักศึกษาทุนทั้งหมด</span>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {dashboardData.totalStudents} <span className="text-sm font-normal text-slate-500">คน</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">ในฐานข้อมูลระบบ & TiDB</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">กิจกรรมจิตอาสาทั้งหมด</span>
              <div className="text-3xl font-extrabold text-slate-900 mt-2">
                {dashboardData.totalActivities} <span className="text-sm font-normal text-slate-500">กิจกรรม</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                เปิดรับ {dashboardData.approvedActivitiesCount} • รออนุมัติ {dashboardData.pendingActivitiesCount}
              </p>
            </div>

            <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-200 shadow-xs">
              <span className="text-xs font-semibold text-emerald-700">ชั่วโมงที่อนุมัติสะสมรวม</span>
              <div className="text-3xl font-extrabold text-emerald-700 mt-2">
                {dashboardData.allApprovedHours} <span className="text-sm font-normal text-emerald-600">ชม.</span>
              </div>
              <p className="text-xs text-emerald-600 mt-1">รับรองผลเรียบร้อยแล้ว</p>
            </div>

            <div className="bg-amber-50/80 p-5 rounded-3xl border border-amber-200 shadow-xs">
              <span className="text-xs font-semibold text-amber-800">รายการชั่วโมงรอตรวจสอบ</span>
              <div className="text-3xl font-extrabold text-amber-700 mt-2">
                {dashboardData.pendingHourRecordsCount} <span className="text-sm font-normal text-amber-600">รายการ</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">รวม {dashboardData.allPendingHours} ชั่วโมงรออนุมัติ</p>
            </div>
          </div>

          {/* Admin Monthly / All-Years Analytics Charts */}
          {user.role === 'admin' && Array.isArray(dashboardData.monthlyStats) && (
            <AdminMonthlyChart
              data={dashboardData.monthlyStats}
              yearlyData={dashboardData.yearlyStats}
              chartMode={dashboardData.chartMode || 'monthly'}
              periodLabel={dashboardData.periodLabel || 'ปีการศึกษา 2569 • เทอม 1'}
            />
          )}

          {/* Scholarship Summary Table */}
          {dashboardData.scholarshipSummary && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    สรุปชั่วโมงจิตอาสาแยกตามประเภททุนการศึกษา
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    แสดงชั่วโมงเป้าหมายของทุนเรียนดี (25%, 50%, 100%) และทุน กยศ. (18 ชม.)
                  </p>
                </div>
                {(user.role === 'officer' || user.role === 'admin') && (
                  <Link
                    href="/officer/scholarships"
                    className="text-xs font-semibold text-amber-700 hover:bg-amber-100 bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-200 transition self-start sm:self-auto"
                  >
                    ⚙️ จัดการประเภททุนและชั่วโมง
                  </Link>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3.5 px-5">ประเภททุนการศึกษา</th>
                      <th className="py-3.5 px-4 text-center">เกณฑ์ชั่วโมง/คน</th>
                      <th className="py-3.5 px-4 text-center">จำนวนนักศึกษา</th>
                      <th className="py-3.5 px-4 text-center">ชั่วโมงอนุมัติรวม</th>
                      <th className="py-3.5 px-5 text-center">ความคืบหน้าเฉลี่ย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardData.scholarshipSummary.map((sch: any) => (
                      <tr key={sch.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">{sch.name}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                          {sch.targetHoursPerStudent} ชม.
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600">{sch.studentCount} คน</td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                          {sch.totalApprovedHours} ชม.
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-2.5">
                            <div className="w-24 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${sch.achievementRate}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-700 text-xs">{sch.achievementRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Ineligible Scholarship Pop-up */}
      {ineligiblePopup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">ไม่สามารถสมัครได้</h3>
                  <p className="text-xs text-slate-500">ประเภททุนการศึกษาของคุณไม่ตรงตามเงื่อนไข</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIneligiblePopup(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-900 space-y-1.5">
              <p className="font-bold">กิจกรรม: {ineligiblePopup.activityTitle}</p>
              <p className="text-rose-800 leading-relaxed">{ineligiblePopup.reason}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Link
                href="/profile"
                onClick={() => setIneligiblePopup(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                ตรวจสอบทุนของฉัน
              </Link>
              <button
                type="button"
                onClick={() => setIneligiblePopup(null)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                รับทราบ / ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
