'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileText,
  QrCode,
  Sparkles,
  Check,
  MapPin,
  ArrowRight,
  ImagePlus,
  X,
  ClipboardCheck,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { compressImageFile } from '@/lib/imageUtils';

export default function MyHoursPage() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'need_checkin' | 'need_evidence' | 'approved'>('all');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [availableYears, setAvailableYears] = useState<string[]>(['2568', '2569', '2570']);

  // Evidence modal state
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [evidencePreview, setEvidencePreview] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleClearImage = () => {
    setEvidencePreview('');
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fetchMyData = async () => {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        const regs = data.registrations || [];
        setRegistrations(regs);
        const yearsSet = new Set<string>(['2568', '2569', '2570']);
        if (data.settings?.academicYear) yearsSet.add(data.settings.academicYear);
        if (Array.isArray(data.settings?.academicYears)) {
          data.settings.academicYears.forEach((y: string) => yearsSet.add(y));
        }
        regs.forEach((r: any) => {
          if (r.activity?.academicYear) yearsSet.add(r.activity.academicYear);
        });
        setAvailableYears(Array.from(yearsSet).sort());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyData();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      try {
        const compressed = await compressImageFile(file);
        setEvidencePreview(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEvidencePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedActivity) return;

    if (!evidencePreview && !notes.trim()) {
      setModalError('กรุณาเพิ่มรูปภาพหลักฐาน และกรอกคำอธิบายรายละเอียดสิ่งที่ได้ทำก่อนส่ง');
      return;
    }
    if (!evidencePreview) {
      setModalError('กรุณาเพิ่มรูปภาพหลักฐานการทำกิจกรรมก่อนส่ง');
      return;
    }
    if (!notes.trim()) {
      setModalError('กรุณากรอกคำอธิบายหรือรายละเอียดสิ่งที่ได้ทำก่อนส่ง');
      return;
    }

    setUploading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: selectedActivity.id,
          fileUrl: evidencePreview,
          fileName: fileName || 'evidence.jpg',
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `ส่งหลักฐานกิจกรรม "${selectedActivity.title}" เรียบร้อยแล้ว!`, type: 'success' });
        setSelectedActivity(null);
        setEvidencePreview('');
        setNotes('');
        setFileName('');
        setModalError(null);
        fetchMyData();
      } else {
        setModalError(data.error || 'เกิดข้อผิดพลาดในการแนบหลักฐาน');
      }
    } catch {
      setModalError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setUploading(false);
    }
  };

  const termFilteredRegistrations = registrations.filter((reg) => {
    const actYear = reg.activity?.academicYear || '2569';
    const actSem = reg.activity?.semester || '1';
    if (filterYear && actYear !== filterYear) return false;
    if (filterSemester && actSem !== filterSemester) return false;
    return true;
  });

  const termApprovedHours = termFilteredRegistrations
    .filter((r) => r.hourRecord?.status === 'approved')
    .reduce((sum, r) => sum + (r.hourRecord?.hours || 0), 0);

  const termPendingHours = termFilteredRegistrations
    .filter((r) => r.hourRecord && (r.hourRecord.status === 'pending' || r.hourRecord.status === 'verified_by_officer'))
    .reduce((sum, r) => sum + (r.hourRecord?.hours || 0), 0);

  const filteredRegistrations = termFilteredRegistrations.filter((reg) => {
    if (filterTab === 'need_checkin') return !reg.attendance;
    if (filterTab === 'need_evidence') return reg.attendance && reg.hourRecord?.status !== 'approved';
    if (filterTab === 'approved') return reg.hourRecord?.status === 'approved';
    return true;
  });

  return (
    <RoleGuard allowedRoles={['student', 'admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              กิจกรรมของฉัน & ส่งหลักฐานรับชั่วโมง
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ติดตามสถานะการสมัคร สแกนเข้าร่วม แนบหลักฐาน และรับรองชั่วโมงจิตอาสาได้จากแถบไอคอนในแต่ละการ์ด
            </p>
          </div>
          <Link
            href="/activities"
            className="self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            + สมัครกิจกรรมเพิ่ม
          </Link>
        </div>

        {/* Term Filter & Hours Summary */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">📅 เลือกดูตามปี / เทอม:</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
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
                { val: '', label: 'ทุกเทอม' },
                { val: '1', label: 'เทอม 1' },
                { val: '2', label: 'เทอม 2' },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setFilterSemester(t.val)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    filterSemester === t.val
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              ✓ อนุมัติแล้ว: {termApprovedHours} ชม.
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              ⏳ รอตรวจสอบ: {termPendingHours} ชม.
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `ทั้งหมด (${termFilteredRegistrations.length})` },
            {
              id: 'need_checkin',
              label: `รอเช็กชื่อ (${termFilteredRegistrations.filter((r) => !r.attendance).length})`,
            },
            {
              id: 'need_evidence',
              label: `รอส่งหลักฐาน / รอตรวจ (${
                termFilteredRegistrations.filter((r) => r.attendance && r.hourRecord?.status !== 'approved').length
              })`,
            },
            {
              id: 'approved',
              label: `อนุมัติชั่วโมงแล้ว (${
                termFilteredRegistrations.filter((r) => r.hourRecord?.status === 'approved').length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                filterTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-2.5 text-sm font-medium ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">กำลังโหลดข้อมูลกิจกรรมของคุณ...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              ไม่มีรายการกิจกรรมในหมวดหมู่นี้
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              คุณสามารถเลือกค้นหาและสมัครกิจกรรมจิตอาสาที่เปิดรับได้ทันที
            </p>
            <Link
              href="/activities"
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition"
            >
              ไปที่หน้าค้นหากิจกรรม <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRegistrations.map((reg) => {
              const act = reg.activity;
              const evi = reg.evidence;
              const att = reg.attendance;
              const hr = reg.hourRecord;
              const isApproved = hr?.status === 'approved';
              const isVerifiedByOfficer = hr?.status === 'verified_by_officer';

              return (
                <div
                  key={reg.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-emerald-300 transition space-y-5"
                >
                  {/* Top Activity Info & Action Buttons */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
                          +{act?.hours} ชั่วโมงจิตอาสา
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                          เทอม {act?.semester || '1'}/{act?.academicYear || '2569'}
                        </span>
                        {isApproved ? (
                          <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> เข้าร่วมไปแล้ว (อนุมัติชั่วโมงแล้ว)
                          </span>
                        ) : hr?.status === 'rejected' ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs px-3 py-1 rounded-full font-bold">
                            ❌ ถูกส่งกลับแก้ไข
                          </span>
                        ) : isVerifiedByOfficer ? (
                          <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
                            เจ้าหน้าที่ตรวจแล้ว รอผู้อนุมัติรับรอง
                          </span>
                        ) : att ? (
                          <span className="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full font-semibold">
                            เช็กชื่อแล้ว • {evi ? 'ส่งหลักฐานแล้ว รอตรวจ' : 'กรุณาแนบรูปหลักฐาน'}
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-semibold">
                            ขั้นตอนต่อไป: กรุณาสแกนเข้าร่วมกิจกรรม
                          </span>
                        )}
                      </div>

                      {hr?.status === 'rejected' && (hr.officerComment || hr.approverComment) && (
                        <div className="mt-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <strong className="text-rose-900">เหตุผลที่ถูกส่งกลับแก้ไข:</strong>{' '}
                          {hr.officerComment || hr.approverComment} — กรุณากดปุ่ม &ldquo;ดู / แก้ไขรูปหลักฐาน&rdquo; เพื่อส่งใหม่
                        </div>
                      )}

                      <h3 className="text-lg font-bold text-slate-900 pt-1">
                        {act?.title || 'ไม่พบข้อมูลกิจกรรม'}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          {act?.date} ({act?.startTime} - {act?.endTime} น.)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-rose-500" />
                          {act?.location}
                        </span>
                      </div>
                    </div>

                    {/* Easy Primary Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                      {!att && (
                        <Link
                          href="/check-in"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <QrCode className="w-4 h-4" /> สแกนเข้าร่วมกิจกรรม
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedActivity(act);
                          setModalError(null);
                          if (evi) {
                            setEvidencePreview(evi.fileUrl);
                            setNotes(evi.notes || '');
                            setFileName(evi.fileName || '');
                          } else {
                            setEvidencePreview('');
                            setNotes('');
                            setFileName('');
                          }
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap ${
                          evi
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                        }`}
                      >
                        <UploadCloud className="w-4 h-4" />
                        {evi ? 'ดู / แก้ไขรูปหลักฐาน' : 'แนบรูปหลักฐาน'}
                      </button>
                    </div>
                  </div>

                  {/* 4-Step Icon Progress Stepper (Clean E-Commerce Style) */}
                  {(() => {
                    const isRejected = hr?.status === 'rejected';
                    const step1Done = true;
                    const step2Done = Boolean(att);
                    const step3Done = Boolean(evi);
                    const step4Done = isApproved;

                    const steps = [
                      {
                        key: 'register',
                        label: 'สมัครกิจกรรม',
                        sub: 'ลงทะเบียนแล้ว',
                        done: step1Done,
                        active: false,
                        rejected: false,
                        Icon: ClipboardCheck,
                      },
                      {
                        key: 'checkin',
                        label: 'สแกนเข้าร่วม',
                        sub: step2Done ? 'สแกนแล้ว' : 'รอสแกน',
                        done: step2Done,
                        active: !step2Done,
                        rejected: false,
                        Icon: QrCode,
                      },
                      {
                        key: 'evidence',
                        label: 'แนบหลักฐาน',
                        sub: step3Done ? 'แนบรูปแล้ว' : 'ยังไม่แนบ',
                        done: step3Done,
                        active: step2Done && !step3Done,
                        rejected: isRejected,
                        Icon: ImagePlus,
                      },
                      {
                        key: 'approve',
                        label: 'รับรองชั่วโมง',
                        sub: step4Done
                          ? `อนุมัติ +${hr.hours} ชม.`
                          : isRejected
                          ? 'ส่งกลับแก้ไข'
                          : isVerifiedByOfficer
                          ? 'รอผู้อนุมัติ'
                          : 'รอตรวจสอบ',
                        done: step4Done,
                        active: step3Done && !step4Done && !isRejected,
                        rejected: isRejected,
                        Icon: Award,
                      },
                    ];

                    return (
                      <div className="pt-5 border-t border-slate-100">
                        <div className="flex items-start justify-between">
                          {steps.map((step, idx) => {
                            const IconComp = step.Icon;
                            const nextStep = steps[idx + 1];
                            const lineActive =
                              idx < steps.length - 1 &&
                              step.done &&
                              (nextStep.done || nextStep.active || nextStep.rejected);

                            return (
                              <React.Fragment key={step.key}>
                                <div className="flex flex-col items-center text-center min-w-0 flex-1">
                                  <div
                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                                      step.rejected && step.key === 'approve'
                                        ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-300'
                                        : step.done
                                        ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-500/40'
                                        : step.active
                                        ? 'bg-amber-50 text-amber-500 ring-2 ring-amber-300'
                                        : 'bg-slate-50 text-slate-300 ring-1 ring-slate-200'
                                    }`}
                                  >
                                    <IconComp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
                                  </div>
                                  <span
                                    className={`mt-2 text-[11px] sm:text-xs font-bold leading-tight ${
                                      step.rejected && step.key === 'approve'
                                        ? 'text-rose-600'
                                        : step.done
                                        ? 'text-emerald-700'
                                        : step.active
                                        ? 'text-amber-600'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {step.label}
                                  </span>
                                  <span
                                    className={`mt-0.5 text-[10px] sm:text-[11px] leading-tight hidden xs:block sm:block ${
                                      step.rejected && step.key === 'approve'
                                        ? 'text-rose-500 font-medium'
                                        : step.done
                                        ? 'text-emerald-600/80'
                                        : step.active
                                        ? 'text-amber-500'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {step.sub}
                                  </span>
                                </div>

                                {idx < steps.length - 1 && (
                                  <div className="flex-1 flex items-center pt-5 sm:pt-6 -mx-2 sm:-mx-3">
                                    <div
                                      className={`h-1 w-full rounded-full transition-colors ${
                                        lineActive ? 'bg-emerald-500' : 'bg-slate-200'
                                      }`}
                                    />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {/* Evidence Upload Modal */}
        {selectedActivity && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  แนบรูปภาพหลักฐานการทำกิจกรรม
                </h3>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                กิจกรรม: <strong className="text-slate-900">{selectedActivity.title}</strong> (+{selectedActivity.hours} ชม.)
              </p>

              <form onSubmit={handleUploadEvidence} className="space-y-4">
                {modalError && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    1. รูปภาพหลักฐานการเข้าร่วมกิจกรรม <span className="text-rose-500">*</span>
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setModalError(null);
                      handleFileChange(e);
                    }}
                    className="hidden"
                  />

                  {!evidencePreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-8 px-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 transition flex flex-col items-center justify-center gap-2.5 group cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition shadow-xs">
                        <ImagePlus className="w-7 h-7" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition">
                          แตะเพื่อเพิ่มรูปภาพหลักฐาน
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          รองรับไฟล์ JPG, PNG, WEBP (บังคับแนบอย่างน้อย 1 รูป)
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-emerald-700 truncate">
                          ✓ {fileName || 'รูปภาพหลักฐานที่เลือก'}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition flex items-center gap-1"
                          >
                            <ImagePlus className="w-3.5 h-3.5" /> เปลี่ยนรูป
                          </button>
                          <button
                            type="button"
                            onClick={handleClearImage}
                            title="ลบรูปภาพนี้"
                            className="w-7 h-7 rounded-full bg-rose-100 hover:bg-rose-600 text-rose-600 hover:text-white flex items-center justify-center transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <img
                        src={evidencePreview}
                        alt="Evidence preview"
                        className="w-full max-h-52 object-contain rounded-xl bg-white border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    2. บันทึกรายละเอียดสิ่งที่ได้ทำ <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={notes}
                    onChange={(e) => {
                      setModalError(null);
                      setNotes(e.target.value);
                    }}
                    placeholder="กรุณาอธิบายรายละเอียดกิจกรรมหรือหน้าที่ที่ได้ทำ เช่น ช่วยจัดเตรียมสถานที่และดูแลผู้เข้าร่วมงาน..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  {!notes.trim() && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      * จำเป็นต้องกรอกคำอธิบายและแนบรูปภาพให้ครบทั้ง 2 ส่วนจึงจะส่งได้
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedActivity(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !evidencePreview || !notes.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'กำลังบันทึก...' : 'ส่งหลักฐานขอรับชั่วโมง'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
