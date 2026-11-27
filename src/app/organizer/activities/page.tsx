'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Activity } from '@/types';
import {
  PlusCircle,
  QrCode,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  CalendarDays,
  UserCheck,
  Activity as ActivityIcon,
  Settings2,
  AlertTriangle,
} from 'lucide-react';

export default function OrganizerActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<
    (Activity & { checkedInCount?: number; allowedScholarshipNames?: string[] })[]
  >([]);
  const [scholarships, setScholarships] = useState<{ id: string; name: string; targetHours: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Academic Year & Semester management
  const [availableYears, setAvailableYears] = useState<string[]>(['2568', '2569', '2570']);
  const [yearActivityCounts, setYearActivityCounts] = useState<Record<string, number>>({});
  const [activeYear, setActiveYear] = useState('2569');
  const [activeSemester, setActiveSemester] = useState('1');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [showYearManager, setShowYearManager] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [savingTerm, setSavingTerm] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);
  const [deleteYearError, setDeleteYearError] = useState<string | null>(null);
  const [deletingYear, setDeletingYear] = useState(false);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'อนุรักษ์สิ่งแวดล้อม',
    location: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '16:00',
    hours: 4,
    maxParticipants: 30,
    academicYear: '2569',
    semester: '1',
    registrationDeadline: '',
    allowedScholarshipIds: [] as string[],
    status: 'approved',
  });
  const [savingLoading, setSavingLoading] = useState(false);

  // QR Code Modal
  const [selectedQrAct, setSelectedQrAct] = useState<Activity | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);

  // Participants Modal
  const [selectedActForParticipants, setSelectedActForParticipants] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchActivities = async () => {
    try {
      const params = new URLSearchParams();
      if (filterYear) params.set('academicYear', filterYear);
      if (filterSemester) params.set('semester', filterSemester);
      const res = await fetch(`/api/activities?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
        if (data.settings) {
          setActiveYear(data.settings.academicYear || '2569');
          setActiveSemester(data.settings.semester || '1');
        }
        if (Array.isArray(data.availableYears) && data.availableYears.length > 0) {
          setAvailableYears(data.availableYears);
        } else if (data.settings?.academicYears?.length > 0) {
          setAvailableYears([...data.settings.academicYears].sort());
        }
        if (data.yearActivityCounts) {
          setYearActivityCounts(data.yearActivityCounts);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [filterYear, filterSemester]);

  useEffect(() => {
    fetch('/api/scholarships')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.scholarships) setScholarships(d.scholarships);
      })
      .catch(() => {});
  }, []);

  const handleSaveTermSettings = async (year: string, semester: string) => {
    setSavingTerm(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYear: year,
          semester,
        }),
      });
      if (res.ok) {
        setActiveYear(year);
        setActiveSemester(semester);
        setMessage({
          text: `ตั้งค่าเทอมที่เปิดใช้งานปัจจุบันเป็น เทอม ${semester}/${year} เรียบร้อยแล้ว`,
          type: 'success',
        });
      }
    } catch {
      setMessage({ text: 'ไม่สามารถบันทึกการตั้งค่าปี/เทอมได้', type: 'error' });
    } finally {
      setSavingTerm(false);
    }
  };

  const addYearValue = async (yr: string) => {
    const trimmed = yr.trim();
    if (!trimmed || !/^\d{4}$/.test(trimmed)) {
      setMessage({ text: 'กรุณากรอกปีการศึกษาเป็นตัวเลข 4 หลัก (เช่น 2571)', type: 'error' });
      return;
    }
    setSavingTerm(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAcademicYear: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message || `เพิ่มปีการศึกษา ${trimmed} เรียบร้อยแล้ว`, type: 'success' });
        setNewYearInput(String(Number(trimmed) + 1));
        await fetchActivities();
      } else {
        setMessage({ text: data.error || 'ไม่สามารถเพิ่มปีการศึกษาได้', type: 'error' });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setSavingTerm(false);
    }
  };

  const handleAddYear = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await addYearValue(newYearInput);
  };

  const openDeleteYearModal = (yr: string) => {
    setDeleteYearError(null);
    setYearToDelete(yr);
  };

  const confirmDeleteAcademicYear = async () => {
    if (!yearToDelete) return;
    setDeletingYear(true);
    setDeleteYearError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeAcademicYear: yearToDelete }),
      });
      const data = await res.json();
      if (res.ok) {
        const removed = yearToDelete;
        setYearToDelete(null);
        setMessage({ text: data.message || `ลบปีการศึกษา ${removed} เรียบร้อยแล้ว`, type: 'success' });
        if (filterYear === removed) setFilterYear('');
        await fetchActivities();
      } else {
        setDeleteYearError(data.error || 'ไม่สามารถลบปีการศึกษาได้');
      }
    } catch {
      setDeleteYearError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setDeletingYear(false);
    }
  };

  const openCreateModal = () => {
    setEditingActivityId(null);
    setForm({
      title: '',
      description: '',
      category: 'อนุรักษ์สิ่งแวดล้อม',
      location: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '16:00',
      hours: 4,
      maxParticipants: 30,
      academicYear: filterYear || activeYear,
      semester: filterSemester || activeSemester,
      registrationDeadline: `${new Date().toISOString().split('T')[0]}T17:00`,
      allowedScholarshipIds: [],
      status: 'approved',
    });
    setShowModal(true);
  };

  const openEditModal = (act: Activity) => {
    setEditingActivityId(act.id);
    setForm({
      title: act.title,
      description: act.description,
      category: act.category || 'อนุรักษ์สิ่งแวดล้อม',
      location: act.location,
      date: act.date,
      startTime: act.startTime,
      endTime: act.endTime,
      hours: act.hours,
      maxParticipants: act.maxParticipants,
      academicYear: act.academicYear || activeYear,
      semester: act.semester || activeSemester,
      registrationDeadline: act.registrationDeadline || '',
      allowedScholarshipIds: Array.isArray(act.allowedScholarshipIds) ? act.allowedScholarshipIds : [],
      status: act.status,
    });
    setShowModal(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLoading(true);
    setMessage(null);

    try {
      const url = editingActivityId ? `/api/activities/${editingActivityId}` : '/api/activities';
      const method = editingActivityId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: editingActivityId
            ? `แก้ไขกิจกรรม "${form.title}" เรียบร้อยแล้ว`
            : data.message || 'สร้างกิจกรรมใหม่เรียบร้อยแล้ว',
          type: 'success',
        });
        setShowModal(false);
        fetchActivities();
      } else {
        setMessage({ text: data.error || 'เกิดข้อผิดพลาดในการบันทึกกิจกรรม', type: 'error' });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setSavingLoading(false);
    }
  };

  const handleDeleteActivity = async (act: Activity) => {
    if (!confirm(`ต้องการลบกิจกรรม "${act.title}" ใช่หรือไม่? (รายการลงทะเบียนของนักศึกษาในกิจกรรมนี้จะถูกลบออกด้วย)`))
      return;
    setMessage(null);

    try {
      const res = await fetch(`/api/activities/${act.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: `ลบกิจกรรม "${act.title}" และล้างรายการค้างในบัญชีนักศึกษาเรียบร้อยแล้ว`,
          type: 'success',
        });
        fetchActivities();
      } else {
        setMessage({ text: data.error || 'ไม่สามารถลบกิจกรรมได้', type: 'error' });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const openQrModal = async (act: Activity) => {
    setSelectedQrAct(act);
    setQrLoading(true);
    try {
      const res = await fetch(`/api/activities/${act.id}/qrcode`);
      if (res.ok) {
        const data = await res.json();
        setQrDataUrl(data.qrDataUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQrLoading(false);
    }
  };

  const openParticipantsModal = async (act: Activity) => {
    setSelectedActForParticipants(act);
    setPartsLoading(true);
    try {
      const res = await fetch(`/api/registrations?activityId=${act.id}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.registrations);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPartsLoading(false);
    }
  };

  const handleOrganizerCheckIn = async (studentId: string) => {
    if (!selectedActForParticipants) return;
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: selectedActForParticipants.id,
          studentId: studentId,
          byOrganizer: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        openParticipantsModal(selectedActForParticipants);
        fetchActivities();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการเช็กชื่อ');
      }
    } catch {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-300 whitespace-nowrap">
            เปิดรับสมัคร
          </span>
        );
      case 'pending_approval':
        return (
          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold border border-amber-300 whitespace-nowrap">
            รออนุมัติ
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-semibold border border-rose-300 whitespace-nowrap">
            ไม่อนุมัติ
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  const totalRegistered = activities.reduce((sum, a) => sum + (a.currentParticipants || 0), 0);
  const totalCheckedIn = activities.reduce((sum, a) => sum + (a.checkedInCount || 0), 0);

  return (
    <RoleGuard allowedRoles={['organizer', 'admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              จัดการกิจกรรมจิตอาสา &amp; ผู้เข้าร่วมกิจกรรม
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ดูจำนวนผู้เข้าร่วม ตั้งค่าปีการศึกษา/เทอม 1-2 สร้าง แก้ไข ลบกิจกรรม และแสดง QR Code
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" /> สร้างกิจกรรมใหม่
          </button>
        </div>

        {/* Participant & Activity Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <ActivityIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">กิจกรรมที่แสดงอยู่</p>
              <p className="text-2xl font-extrabold text-slate-900">
                {activities.length} <span className="text-xs font-normal text-slate-500">กิจกรรม</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">ผู้สมัครเข้าร่วมกิจกรรมรวม</p>
              <p className="text-2xl font-extrabold text-indigo-700">
                {totalRegistered} <span className="text-xs font-normal text-slate-500">คน</span>
              </p>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-800">เช็กชื่อเข้าร่วมงานแล้ว</p>
              <p className="text-2xl font-extrabold text-emerald-700">
                {totalCheckedIn} <span className="text-xs font-normal text-emerald-600">คน</span>
              </p>
            </div>
          </div>
        </div>

        {/* Clean Academic Year & Term Control Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Clean Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                กรองกิจกรรม:
              </span>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">ทุกปีการศึกษา</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    ปีการศึกษา {y}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { val: '', label: 'ทั้งหมด' },
                  { val: '1', label: 'เทอม 1' },
                  { val: '2', label: 'เทอม 2' },
                ].map((t) => (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setFilterSemester(t.val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterSemester === t.val
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Active Term Badge + Clean Toggle Button for Admin Year Manager */}
            {user?.role === 'admin' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold whitespace-nowrap">
                  เทอมปัจจุบัน: เทอม {activeSemester}/{activeYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!showYearManager) {
                      const maxYr =
                        availableYears.length > 0
                          ? Math.max(...availableYears.map((y) => Number(y) || 2570))
                          : 2570;
                      setNewYearInput(String(maxYr + 1));
                    }
                    setShowYearManager((prev) => !prev);
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                    showYearManager
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  {showYearManager ? 'ซ่อนจัดการปี / เทอม' : 'จัดการปี / เทอม'}
                </button>
              </div>
            )}
          </div>

          {/* Expandable Year & Active Term Manager (Admin) */}
          {user?.role === 'admin' && showYearManager && (() => {
            const maxYr =
              availableYears.length > 0
                ? Math.max(...availableYears.map((y) => Number(y) || 2570))
                : 2570;
            const nextYr = String(maxYr + 1);

            return (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                {/* Row 1: Set Active System Term */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">ตั้งค่าปีการศึกษาและเทอมที่เปิดใช้งานปัจจุบัน</p>
                    <p className="text-[11px] text-slate-500">
                      หน้าสมัครกิจกรรมและกิจกรรมของนักศึกษาจะแสดงปีและเทอมนี้เป็นค่าเริ่มต้นอัตโนมัติ
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={activeYear}
                      disabled={savingTerm}
                      onChange={(e) => handleSaveTermSettings(e.target.value, activeSemester)}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-900 text-xs font-bold"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={y}>
                          ปีการศึกษา {y}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {['1', '2'].map((sem) => (
                        <button
                          key={sem}
                          type="button"
                          disabled={savingTerm}
                          onClick={() => handleSaveTermSettings(activeYear, sem)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            activeSemester === sem
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          เทอม {sem}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2: Add / Delete Academic Years */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      ปีการศึกษาในระบบ ({availableYears.length} ปี):
                    </span>
                    {availableYears.map((y) => {
                      const actCount = yearActivityCounts[y] || 0;
                      const canDelete = availableYears.length > 1 && actCount === 0;
                      return (
                        <div
                          key={y}
                          className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                        >
                          <span>ปี {y}</span>
                          {actCount > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                              {actCount} กิจกรรม
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={savingTerm || availableYears.length <= 1}
                            onClick={() => openDeleteYearModal(y)}
                            title={canDelete ? `ลบปีการศึกษา ${y}` : `มีกิจกรรม ${actCount} รายการในปี้`}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition disabled:opacity-30 ${
                              canDelete
                                ? 'text-rose-500 hover:bg-rose-100 hover:text-rose-700'
                                : 'text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      disabled={savingTerm}
                      onClick={() => addYearValue(nextYr)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> เพิ่มปี {nextYr} ทันที
                    </button>

                    <form onSubmit={handleAddYear} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        maxLength={4}
                        value={newYearInput}
                        onChange={(e) => setNewYearInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="ระบุปี พ.ศ."
                        className="w-24 px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={savingTerm}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition disabled:opacity-50"
                      >
                        เพิ่มปีนี้
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Alert */}
        {message && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-2.5 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Activities Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">รายการกิจกรรมทั้งหมด</h2>
            <span className="text-xs text-slate-500 whitespace-nowrap">รวม {activities.length} กิจกรรม</span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">กำลังโหลดรายการกิจกรรม...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              ไม่พบกิจกรรมในปีการศึกษา / เทอมที่เลือก
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">ชื่อกิจกรรม / สถานที่</th>
                    <th className="py-3.5 px-4 text-center">ปี / เทอม</th>
                    <th className="py-3.5 px-4">วันและเวลา</th>
                    <th className="py-3.5 px-4 text-center">ชั่วโมง</th>
                    <th className="py-3.5 px-4 text-center">ผู้เข้าร่วม (สมัคร / เช็กชื่อ)</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs">
                        <div className="truncate">{act.title}</div>
                        <div className="text-xs text-slate-400 truncate mt-0.5 font-normal">
                          📍 {act.location}
                        </div>
                        <div className="mt-1">
                          {act.allowedScholarshipNames && act.allowedScholarshipNames.length > 0 ? (
                            <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                              🎯 เฉพาะ: {act.allowedScholarshipNames.join(', ')}
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                              🌐 เปิดรับทุกทุน
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                          เทอม {act.semester || '1'}/{act.academicYear || '2569'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <div>{act.date} ({act.startTime}-{act.endTime})</div>
                        {act.registrationDeadline && (
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              new Date() > new Date(act.registrationDeadline)
                                ? 'text-rose-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {new Date() > new Date(act.registrationDeadline)
                              ? 'ปิดรับสมัครแล้ว: '
                              : 'สมัครถึง: '}
                            {new Date(act.registrationDeadline).toLocaleString('th-TH', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-amber-700 whitespace-nowrap">
                        +{act.hours} ชม.
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => openParticipantsModal(act)}
                          className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition text-xs whitespace-nowrap"
                          title="คลิกเพื่อดูรายชื่อผู้เข้าร่วมทั้งหมด"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {act.currentParticipants}/{act.maxParticipants} คน
                          </span>
                          <span className="text-emerald-700 font-bold ml-1">
                            (มา {act.checkedInCount ?? 0})
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(act.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openQrModal(act)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-300 transition flex items-center gap-1 text-xs whitespace-nowrap"
                            title="แสดง QR Code สำหรับเช็กชื่อ"
                          >
                            <QrCode className="w-3.5 h-3.5" /> QR
                          </button>

                          <button
                            onClick={() => openEditModal(act)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-2.5 py-1.5 rounded-xl border border-blue-200 transition flex items-center gap-1 text-xs whitespace-nowrap"
                            title="แก้ไขข้อมูลกิจกรรม"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> แก้ไข
                          </button>

                          <button
                            onClick={() => handleDeleteActivity(act)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 transition flex items-center gap-1 text-xs whitespace-nowrap"
                            title="ลบกิจกรรม"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create / Edit Activity Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {editingActivityId ? (
                    <>
                      <Edit2 className="w-5 h-5 text-blue-600" />
                      แก้ไขข้อมูลกิจกรรมจิตอาสา
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-5 h-5 text-blue-600" />
                      สร้างกิจกรรมจิตอาสาใหม่
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveActivity} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อกิจกรรม *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="เช่น โครงการปลูกป่าชายเลนและเก็บขยะอนุรักษ์สิ่งแวดล้อม"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รายละเอียดกิจกรรม *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="อธิบายกิจกรรม สิ่งที่นักศึกษาต้องปฏิบัติ..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ปีการศึกษา *
                    </label>
                    <select
                      value={form.academicYear}
                      onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ภาคการศึกษา (เทอม) *
                    </label>
                    <select
                      value={form.semester}
                      onChange={(e) => setForm({ ...form, semester: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="1">เทอม 1</option>
                      <option value="2">เทอม 2</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      หมวดหมู่กิจกรรม
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
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
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      สถานที่จัดกิจกรรม *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="เช่น อาคาร 6 มหาวิทยาลัยรังสิต"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      วันที่จัดกิจกรรม *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เวลาเริ่ม
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เวลาสิ้นสุด
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    กำหนดวันและเวลาปิดรับสมัคร (หากเลยกำหนดนักศึกษาจะไม่สามารถสมัครได้)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 bg-white text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-amber-800/80 mt-1">
                    * เว้นว่างไว้หากต้องการเปิดรับสมัครจนกว่าจะเต็มจำนวน
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      จำนวนชั่วโมงจิตอาสา (ชม.) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={form.hours}
                      onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      จำนวนผู้รับสมัครสูงสุด (คน) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      required
                      value={form.maxParticipants}
                      onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Eligible Scholarships Selector */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    สิทธิ์ประเภททุนที่สามารถเข้าร่วมกิจกรรมนี้ได้
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, allowedScholarshipIds: [] })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        form.allowedScholarshipIds.length === 0
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      🌐 เปิดรับทุกประเภททุน
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (form.allowedScholarshipIds.length === 0 && scholarships.length > 0) {
                          setForm({ ...form, allowedScholarshipIds: [scholarships[0].id] });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        form.allowedScholarshipIds.length > 0
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      🎯 จำกัดเฉพาะบางประเภททุน
                    </button>
                  </div>

                  {form.allowedScholarshipIds.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {scholarships.map((sch) => {
                        const checked = form.allowedScholarshipIds.includes(sch.id);
                        return (
                          <label
                            key={sch.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                              checked
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-semibold'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...form.allowedScholarshipIds, sch.id]
                                  : form.allowedScholarshipIds.filter((id) => id !== sch.id);
                                setForm({ ...form, allowedScholarshipIds: next });
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{sch.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {editingActivityId && user?.role === 'admin' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      สถานะกิจกรรม (สำหรับ Admin)
                    </label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="approved">เปิดรับสมัคร (Approved)</option>
                      <option value="pending_approval">รอผู้อนุมัติตรวจสอบ (Pending)</option>
                      <option value="rejected">ไม่อนุมัติ (Rejected)</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingLoading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {savingLoading ? 'กำลังบันทึก...' : editingActivityId ? 'บันทึกการแก้ไข' : 'สร้างกิจกรรม'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {selectedQrAct && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  QR Code เช็กชื่อกิจกรรม
                </span>
                <button
                  onClick={() => setSelectedQrAct(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <h3 className="font-bold text-slate-900 text-base mb-1">
                {selectedQrAct.title}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                +{selectedQrAct.hours} ชั่วโมง • เทอม {selectedQrAct.semester || '1'}/{selectedQrAct.academicYear || '2569'}
              </p>

              {qrLoading ? (
                <div className="w-56 h-56 mx-auto flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200 mb-4">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : qrDataUrl ? (
                <div className="p-3 bg-white border-2 border-emerald-500 rounded-2xl shadow-inner inline-block mb-3">
                  <img
                    src={qrDataUrl}
                    alt="Activity QR Code"
                    className="w-56 h-56 mx-auto rounded-lg"
                  />
                </div>
              ) : (
                <p className="text-xs text-rose-500">ไม่สามารถสร้าง QR Code ได้</p>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs text-slate-600 mb-4 font-mono break-all">
                <span className="font-bold text-slate-700 block mb-0.5">รหัสเช็กชื่อ (PIN / Secret):</span>
                {selectedQrAct.qrCodeSecret}
              </div>

              <button
                onClick={() => setSelectedQrAct(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}

        {/* Participants Modal */}
        {selectedActForParticipants && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    รายชื่อผู้ลงทะเบียน: {selectedActForParticipants.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ผู้สมัคร {participants.length} / {selectedActForParticipants.maxParticipants} คน • เช็กชื่อแล้ว{' '}
                    {participants.filter((p) => p.attendance).length} คน
                  </p>
                </div>
                <button
                  onClick={() => setSelectedActForParticipants(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {partsLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">กำลังโหลด...</div>
              ) : participants.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">ยังไม่มีผู้สมัครกิจกรรมนี้</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                        <th className="py-2.5 px-3">รหัสนักศึกษา</th>
                        <th className="py-2.5 px-3">คณะ/วิทยาลัย</th>
                        <th className="py-2.5 px-3 text-center">สถานะเช็กชื่อ</th>
                        <th className="py-2.5 px-3 text-center">เช็กชื่อหน้างาน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participants.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {p.student?.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {p.student?.studentId || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.student?.faculty}</td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {p.attendance ? (
                              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                ✓ เช็กชื่อแล้ว
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                                รอเช็กชื่อ
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {p.attendance ? (
                              <span className="text-xs text-slate-400">
                                {new Date(p.attendance.checkInTime).toLocaleTimeString('th-TH')}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOrganizerCheckIn(p.studentId)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-semibold shadow-2xs transition"
                              >
                                ✓ ยืนยันเช็กชื่อ
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Delete Academic Year Confirmation Pop-up Modal */}
        {yearToDelete && (() => {
          const actCount = yearActivityCounts[yearToDelete] || 0;
          return (
            <div
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => !deletingYear && setYearToDelete(null)}
            >
              <div
                className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        ยืนยันการลบปีการศึกษา
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ตรวจสอบข้อมูลให้แน่ใจก่อนลบออกจากระบบ
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingYear}
                    onClick={() => setYearToDelete(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    ปีการศึกษาที่จะลบ
                  </span>
                  <div className="text-2xl font-extrabold text-rose-600">
                    ปีการศึกษา {yearToDelete}
                  </div>
                  <p className="text-xs text-slate-500">
                    {actCount > 0
                      ? `พบกิจกรรมอยู่ในปีการศึกษานี้ ${actCount} รายการ`
                      : 'ไม่มีกิจกรรมค้างอยู่ สามารถลบออกจากระบบและกราฟได้ทันที'}
                  </p>
                </div>

                {actCount > 0 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                    <strong>ไม่สามารถลบได้ในขณะนี้:</strong> ปีการศึกษา {yearToDelete} ยังมีกิจกรรมผูกอยู่จำนวน{' '}
                    <strong>{actCount} รายการ</strong> กรุณาลบหรือย้ายปีของกิจกรรมดังกล่าวก่อน
                  </div>
                )}

                {deleteYearError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{deleteYearError}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={deletingYear}
                    onClick={() => setYearToDelete(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={deletingYear || actCount > 0}
                    onClick={confirmDeleteAcademicYear}
                    className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {deletingYear ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        กำลังลบปีการศึกษา...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        ยืนยันลบปี {yearToDelete}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </RoleGuard>
  );
}
