'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Activity } from '@/types';
import {
  Calendar,
  MapPin,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Edit2,
  Trash2,
  PlusCircle,
  Clock,
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'อนุรักษ์สิ่งแวดล้อม', label: '🌱 อนุรักษ์สิ่งแวดล้อม' },
  { value: 'การศึกษาและเยาวชน', label: '📚 การศึกษาและเยาวชน' },
  { value: 'กิจกรรมมหาวิทยาลัย', label: '🏫 กิจกรรมมหาวิทยาลัย' },
  { value: 'สาธารณสุขและชุมชน', label: '🏥 สาธารณสุขและชุมชน' },
  { value: 'บำเพ็ญประโยชน์ชุมชน', label: '🤝 บำเพ็ญประโยชน์ชุมชน' },
];

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<
    (Activity & { allowedScholarshipNames?: string[]; isRegistrationClosed?: boolean })[]
  >([]);
  const [myRegMap, setMyRegMap] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [filterYear, setFilterYear] = useState<string | null>(null);
  const [filterSemester, setFilterSemester] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>(['2568', '2569', '2570']);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [ineligiblePopup, setIneligiblePopup] = useState<{
    activityTitle: string;
    reason: string;
  } | null>(null);

  // Admin / Organizer inline Edit & Delete Modals
  const [editingAct, setEditingAct] = useState<Activity | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'อนุรักษ์สิ่งแวดล้อม',
    location: '',
    date: '',
    startTime: '09:00',
    endTime: '16:00',
    hours: 4,
    maxParticipants: 30,
    academicYear: '2569',
    semester: '1',
    registrationDeadline: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'organizer';

  const fetchActivities = async () => {
    try {
      const params = new URLSearchParams({ status: 'approved' });
      if (category) params.set('category', category);
      if (filterYear) params.set('academicYear', filterYear);
      if (filterSemester) params.set('semester', filterSemester);
      const res = await fetch(`/api/activities?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const activeYr = data.settings?.academicYear || '2569';
        const activeSem = data.settings?.semester || '1';
        if (data.settings) {
          const baseYears =
            Array.isArray(data.settings.academicYears) && data.settings.academicYears.length > 0
              ? data.settings.academicYears
              : ['2568', '2569', '2570'];
          const years = new Set<string>(baseYears);
          if (activeYr) years.add(activeYr);
          setAvailableYears(Array.from(years).sort());
        }
        // Auto-lock student initial view to the currently active academic year & semester
        if (filterYear === null || filterSemester === null) {
          setFilterYear(activeYr);
          setFilterSemester(activeSem);
          const filteredInit = (data.activities || []).filter(
            (a: Activity) =>
              (a.academicYear || '2569') === activeYr && (a.semester || '1') === activeSem
          );
          setActivities(filteredInit);
        } else {
          setActivities(data.activities || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRegistrations = async () => {
    if (!user) return;
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

  useEffect(() => {
    fetchActivities();
    fetchMyRegistrations();
  }, [category, filterYear, filterSemester, user]);

  const handleRegister = async (activityId: string) => {
    if (!user) {
      setMessage({ text: 'กรุณาเข้าสู่ระบบก่อนสมัครกิจกรรม', type: 'error' });
      return;
    }
    const targetAct = activities.find((a) => a.id === activityId);
    setActionLoading(activityId);
    setMessage(null);

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          text: 'ลงทะเบียนกิจกรรมสำเร็จ! คุณสามารถเช็กชื่อและแนบหลักฐานได้ที่เมนู "กิจกรรมของฉัน"',
          type: 'success',
        });
        fetchActivities();
        fetchMyRegistrations();
      } else {
        const errText = data.error || 'ไม่สามารถสมัครกิจกรรมได้';
        if (errText.includes('เฉพาะนักศึกษาที่ได้รับทุน')) {
          setIneligiblePopup({
            activityTitle: targetAct?.title || 'กิจกรรมที่เลือก',
            reason: errText,
          });
        } else {
          setMessage({
            text: errText,
            type: 'error',
          });
        }
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (act: Activity) => {
    setEditingAct(act);
    setEditForm({
      title: act.title,
      description: act.description,
      category: act.category || 'อนุรักษ์สิ่งแวดล้อม',
      location: act.location,
      date: act.date,
      startTime: act.startTime,
      endTime: act.endTime,
      hours: act.hours,
      maxParticipants: act.maxParticipants,
      academicYear: act.academicYear || '2569',
      semester: act.semester || '1',
      registrationDeadline: act.registrationDeadline || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAct) return;
    setSavingEdit(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/activities/${editingAct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `แก้ไขกิจกรรม "${editForm.title}" เรียบร้อยแล้ว`, type: 'success' });
        setEditingAct(null);
        fetchActivities();
      } else {
        setMessage({ text: data.error || 'ไม่สามารถแก้ไขกิจกรรมได้', type: 'error' });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteActivity = (act: Activity) => {
    setActivityToDelete(act);
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;
    const target = activityToDelete;
    setDeletingActivity(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/activities/${target.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== target.id));
        setActivityToDelete(null);
        setMessage({ text: `ลบกิจกรรม "${target.title}" เรียบร้อยแล้ว`, type: 'success' });
        fetchActivities();
      } else {
        setActivityToDelete(null);
        setMessage({ text: data.error || 'ไม่สามารถลบกิจกรรมได้', type: 'error' });
      }
    } catch {
      setActivityToDelete(null);
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setDeletingActivity(false);
    }
  };

  const filtered = activities.filter((act) => {
    const q = search.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      act.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            ค้นหาและสมัครกิจกรรมจิตอาสา
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เลือกกิจกรรมที่ต้องการเข้าร่วมและกดปุ่ม &ldquo;สมัครเข้าร่วมกิจกรรม&rdquo; ได้ทันที
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {user?.role === 'student' && (
            <Link
              href="/my-hours"
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <ClipboardList className="w-4 h-4 text-emerald-600" />
              <span>กิจกรรมที่สมัครไว้ ({Object.keys(myRegMap).length})</span>
            </Link>
          )}
          {canManage && (
            <Link
              href="/organizer/activities"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>หน้าจัดการกิจกรรมทั้งหมด</span>
            </Link>
          )}
        </div>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          {message.type === 'success' && user?.role === 'student' && (
            <Link
              href="/my-hours"
              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold whitespace-nowrap hover:bg-emerald-700"
            >
              ไปเช็กชื่อ / ส่งหลักฐาน →
            </Link>
          )}
        </div>
      )}

      {/* Search, Year/Term & Category Pills */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อกิจกรรม, รายละเอียด หรือสถานที่จัดงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={filterYear ?? '2569'}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3.5 py-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                ปีการศึกษา {y}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
            {[
              { val: '1', label: 'เทอม 1' },
              { val: '2', label: 'เทอม 2' },
            ].map((t) => (
              <button
                key={t.val}
                type="button"
                onClick={() => setFilterSemester(t.val)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  (filterSemester ?? '1') === t.val
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                category === cat.value
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activities Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">กำลังโหลดรายการกิจกรรม...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold">ไม่พบกิจกรรมที่ตรงกับการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((act) => {
            const reg = myRegMap[act.id];
            const isRegistered = Boolean(reg);
            const isApproved = reg?.hourRecord?.status === 'approved';
            const isCheckedIn = reg?.status === 'checked_in' || Boolean(reg?.attendance);
            const isFull = act.currentParticipants >= act.maxParticipants;
            const isDeadlinePassed = act.registrationDeadline
              ? new Date() > new Date(act.registrationDeadline)
              : Boolean(act.isRegistrationClosed);
            const fillPct = Math.min(100, Math.round((act.currentParticipants / act.maxParticipants) * 100));

            return (
              <div
                key={act.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-200 whitespace-nowrap">
                        {act.category}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
                        เทอม {act.semester || '1'}/{act.academicYear || '2569'}
                      </span>
                    </div>
                    <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                      +{act.hours} ชม.
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-1.5 leading-snug">
                    {act.title}
                  </h3>
                  <div className="mb-2">
                    {act.allowedScholarshipNames && act.allowedScholarshipNames.length > 0 ? (
                      <span className="inline-block text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-semibold">
                        🎯 เฉพาะ: {act.allowedScholarshipNames.join(', ')}
                      </span>
                    ) : (
                      <span className="inline-block text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                        🌐 ทุกทุนเข้าร่วมได้
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                    {act.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3.5">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        {act.date} ({act.startTime} - {act.endTime} น.)
                      </span>
                    </div>
                    {act.registrationDeadline && (
                      <div
                        className={`flex items-center gap-2 font-semibold ${
                          isDeadlinePassed ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        <Clock className="w-4 h-4 flex-shrink-0" />
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
                      <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span className="truncate">{act.location}</span>
                    </div>
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Users className="w-4 h-4 text-blue-500" />
                          ที่นั่งผู้เข้าร่วม
                        </span>
                        <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-slate-700'}`}>
                          {act.currentParticipants} / {act.maxParticipants} คน
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-2">
                  {isApproved ? (
                    <div className="w-full py-2.5 bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>เข้าร่วมไปแล้ว (อนุมัติชั่วโมงแล้ว)</span>
                    </div>
                  ) : isCheckedIn ? (
                    <Link
                      href="/my-hours"
                      className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-2xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-1.5 border border-blue-200 transition whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span>เข้าร่วมไปแล้ว — ดูสถานะ / แนบหลักฐาน →</span>
                    </Link>
                  ) : isRegistered ? (
                    <Link
                      href="/my-hours"
                      className="w-full py-2.5 bg-emerald-100 hover:bg-emerald-200/80 text-emerald-900 rounded-2xl text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-1.5 border border-emerald-300 transition whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>สมัครแล้ว — ไปสแกนเข้าร่วม / แนบหลักฐาน →</span>
                    </Link>
                  ) : isDeadlinePassed ? (
                    <div className="w-full py-2.5 bg-rose-50 text-rose-700 rounded-2xl text-xs sm:text-sm font-bold text-center border border-rose-200 whitespace-nowrap">
                      หมดเวลารับสมัครแล้ว (ไม่สามารถเข้าร่วมได้)
                    </div>
                  ) : isFull ? (
                    <div className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-2xl text-xs sm:text-sm font-bold text-center border border-slate-200 whitespace-nowrap">
                      ที่นั่งเต็มแล้ว ({act.currentParticipants}/{act.maxParticipants})
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRegister(act.id)}
                      disabled={actionLoading === act.id || (Boolean(user) && user?.role !== 'student' && user?.role !== 'admin')}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-semibold text-center transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      {actionLoading === act.id ? (
                        <span>กำลังบันทึกการสมัคร...</span>
                      ) : (
                        <>
                          <span>สมัครเข้าร่วมกิจกรรม</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {/* Admin / Organizer Quick Edit & Delete Buttons */}
                  {canManage && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(act)}
                        className="flex-1 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> แก้ไขกิจกรรม
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(act)}
                        className="flex-1 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> ลบกิจกรรม
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Admin / Organizer Edit Modal */}
      {editingAct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                แก้ไขข้อมูลกิจกรรมจิตอาสา
              </h3>
              <button
                onClick={() => setEditingAct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อกิจกรรม *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">รายละเอียดกิจกรรม *</label>
                <textarea
                  rows={3}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ปีการศึกษา *</label>
                  <select
                    value={editForm.academicYear}
                    onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ภาคการศึกษา (เทอม) *</label>
                  <select
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="1">เทอม 1</option>
                    <option value="2">เทอม 2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="อนุรักษ์สิ่งแวดล้อม">อนุรักษ์สิ่งแวดล้อม</option>
                    <option value="การศึกษาและเยาวชน">การศึกษาและเยาวชน</option>
                    <option value="กิจกรรมมหาวิทยาลัย">กิจกรรมมหาวิทยาลัย</option>
                    <option value="สาธารณสุขและชุมชน">สาธารณสุขและชุมชน</option>
                    <option value="บำเพ็ญประโยชน์ชุมชน">บำเพ็ญประโยชน์ชุมชน</option>
                    <option value="จิตอาสาทั่วไป">จิตอาสาทั่วไป</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">สถานที่จัดกิจกรรม *</label>
                  <input
                    type="text"
                    required
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">วันที่ *</label>
                  <input
                    type="date"
                    required
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เวลาเริ่ม</label>
                  <input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เวลาสิ้นสุด</label>
                  <input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  กำหนดวันและเวลาปิดรับสมัคร (เลยกำหนดจะสมัครไม่ได้)
                </label>
                <input
                  type="datetime-local"
                  value={editForm.registrationDeadline}
                  onChange={(e) => setEditForm({ ...editForm, registrationDeadline: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-amber-300 bg-white text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">จำนวนชั่วโมง (ชม.) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={editForm.hours}
                    onChange={(e) => setEditForm({ ...editForm, hours: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">จำนวนรับสมัคร (คน) *</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={editForm.maxParticipants}
                    onChange={(e) => setEditForm({ ...editForm, maxParticipants: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAct(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {savingEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Activity Confirmation Modal */}
      {activityToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !deletingActivity && setActivityToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">ยืนยันการลบกิจกรรม</h3>
                  <p className="text-xs text-slate-500 mt-0.5">การลบกิจกรรมไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
              <button
                type="button"
                disabled={deletingActivity}
                onClick={() => setActivityToDelete(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-900 space-y-1">
              <p className="font-bold break-words">กิจกรรม: {activityToDelete.title}</p>
              <p className="text-rose-800">รายการลงทะเบียนและบันทึกชั่วโมงของนักศึกษาในกิจกรรมนี้จะถูกลบออกด้วย</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deletingActivity}
                onClick={() => setActivityToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deletingActivity}
                onClick={confirmDeleteActivity}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingActivity ? 'กำลังลบ...' : 'ยืนยันลบกิจกรรม'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
