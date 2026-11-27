'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import {
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  Send,
  Clock,
  Lock,
  XCircle,
  Trash2,
  ImagePlus,
  X,
} from 'lucide-react';
import { ScholarshipType } from '@/types';
import { compressImageFile } from '@/lib/imageUtils';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [currentSchIds, setCurrentSchIds] = useState<string[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [faculty, setFaculty] = useState('');
  const [major, setMajor] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const fullNameDisplay = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

  // Scholarship change request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqSchIds, setReqSchIds] = useState<string[]>([]);
  const [reqReason, setReqReason] = useState('');
  const [reqEvidenceUrl, setReqEvidenceUrl] = useState('');
  const [reqEvidenceName, setReqEvidenceName] = useState('');
  const reqFileInputRef = React.useRef<HTMLInputElement>(null);
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAllData = async () => {
    try {
      const [profileRes, reqRes] = await Promise.all([
        fetch('/api/auth/profile'),
        fetch('/api/scholarship-requests'),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        const u = data.user;
        setFirstName(u.firstName ?? u.name ?? '');
        setLastName(u.lastName ?? '');
        setStudentId(u.studentId || '');
        setFaculty(u.faculty || '');
        setMajor(u.major || '');
        setPhone(u.phone || '');
        setCurrentSchIds(u.scholarshipTypeIds || []);
        setScholarships(data.allScholarships || []);
      }

      if (reqRes.ok) {
        const rData = await reqRes.json();
        setMyRequests(rData.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const isGys = (s: ScholarshipType) => s.id === 'sch-4' || s.name.includes('กยศ');
  const mainScholarships = scholarships.filter((s) => !isGys(s));
  const gysScholarship = scholarships.find((s) => isGys(s));

  const currentScholarshipObjects = scholarships.filter((s) => currentSchIds.includes(s.id));
  const totalTargetHours = currentScholarshipObjects.reduce((sum, s) => sum + s.targetHours, 0);

  const hasPendingRequest = myRequests.some((r) => r.status === 'pending');

  const selectReqMainScholarship = (schId: string | null) => {
    setReqError(null);
    setReqSchIds((prev) => {
      const gysIds = prev.filter((id) => {
        const found = scholarships.find((s) => s.id === id);
        return found && isGys(found);
      });
      return schId ? [schId, ...gysIds] : [...gysIds];
    });
  };

  const toggleReqGysScholarship = (gysId: string) => {
    setReqError(null);
    setReqSchIds((prev) =>
      prev.includes(gysId) ? prev.filter((item) => item !== gysId) : [...prev, gysId]
    );
  };

  const openRequestModal = () => {
    setReqSchIds([...currentSchIds]);
    setReqReason('');
    setReqEvidenceUrl('');
    setReqEvidenceName('');
    if (reqFileInputRef.current) reqFileInputRef.current.value = '';
    setReqError(null);
    setShowRequestModal(true);
  };

  const handleReqFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReqEvidenceName(file.name);
      try {
        const compressed = await compressImageFile(file);
        setReqEvidenceUrl(compressed);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          setReqEvidenceUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleClearReqEvidence = () => {
    setReqEvidenceUrl('');
    setReqEvidenceName('');
    if (reqFileInputRef.current) reqFileInputRef.current.value = '';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: fullNameDisplay,
          studentId: user?.role === 'student' ? studentId : undefined,
          faculty,
          major,
          phone,
          password: password ? password : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: data.message || 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว',
          type: 'success',
        });
        setPassword('');
        await refreshUser();
      } else {
        setMessage({
          text: data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
          type: 'error',
        });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitScholarshipRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError(null);

    if (reqSchIds.length === 0) {
      setReqError('กรุณาเลือกประเภททุนการศึกษาที่ต้องการอย่างน้อย 1 ประเภท');
      return;
    }
    if (!reqReason.trim()) {
      setReqError('กรุณาระบุเหตุผลในการขอแก้ไขประเภททุน');
      return;
    }

    setSubmittingReq(true);
    try {
      const res = await fetch('/api/scholarship-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedScholarshipIds: reqSchIds,
          reason: reqReason.trim(),
          evidenceUrl: reqEvidenceUrl || undefined,
          evidenceFileName: reqEvidenceName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowRequestModal(false);
        setMessage({ text: data.message, type: 'success' });
        await fetchAllData();
      } else {
        setReqError(data.error || 'ไม่สามารถส่งคำขอได้');
      }
    } catch {
      setReqError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSubmittingReq(false);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    if (!confirm('ต้องการยกเลิกคำขอแก้ไขประเภททุนนี้หรือไม่?')) return;
    try {
      const res = await fetch(`/api/scholarship-requests/${reqId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: data.message, type: 'success' });
        await fetchAllData();
      } else {
        setMessage({ text: data.error || 'ไม่สามารถยกเลิกคำขอได้', type: 'error' });
      }
    } catch {
      setMessage({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const reqSelectedObjects = scholarships.filter((s) => reqSchIds.includes(s.id));
  const reqTotalTargetHours = reqSelectedObjects.reduce((sum, s) => sum + s.targetHours, 0);

  return (
    <RoleGuard allowedRoles={['student', 'organizer', 'officer', 'approver', 'admin']}>
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            ข้อมูลส่วนตัวและทุนการศึกษา
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            แก้ไขข้อมูลบัญชีผู้ใช้งาน หรือส่งคำขอแก้ไขประเภททุนไปยังเจ้าหน้าที่ดูแลทุน
          </p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">กำลังโหลดข้อมูลผู้ใช้...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Scholarship Status & Request Card (For Students) */}
            {user?.role === 'student' && (
              <div className="bg-white rounded-3xl p-5 sm:p-7 border border-emerald-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ทุนการศึกษาปัจจุบันของคุณ
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      การเปลี่ยนแปลงประเภททุนต้องดำเนินการโดยเจ้าหน้าที่ดูแลทุนเท่านั้น
                    </p>
                  </div>

                  {totalTargetHours > 0 && (
                    <span className="self-start sm:self-auto bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs">
                      เป้าหมายรวม: {totalTargetHours} ชม./ปี
                    </span>
                  )}
                </div>

                {/* Current Scholarships (Read-only) */}
                {currentScholarshipObjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentScholarshipObjects.map((sch) => (
                      <div
                        key={sch.id}
                        className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-emerald-700 block">
                            {isGys(sch) ? 'กองทุนกู้ยืม' : 'ทุนการศึกษาหลัก'}
                          </span>
                          <span className="font-bold text-sm text-slate-900 block truncate">
                            {sch.name}
                          </span>
                        </div>
                        <span className="bg-white text-emerald-700 border border-emerald-200 text-xs font-extrabold px-2.5 py-1 rounded-xl flex-shrink-0">
                          {sch.targetHours} ชม.
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    ยังไม่ได้ระบุประเภททุนการศึกษา กรุณาส่งคำขอไปยังเจ้าหน้าที่ดูแลทุน
                  </div>
                )}

                {/* Request Change Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-slate-500">
                    หากข้อมูลทุนไม่ถูกต้อง หรือได้รับทุนเพิ่มเติม สามารถส่งคำขอให้เจ้าหน้าที่ตรวจสอบและแก้ไขให้ได้
                  </p>
                  <button
                    type="button"
                    onClick={openRequestModal}
                    disabled={hasPendingRequest}
                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    {hasPendingRequest ? 'มีคำขอรอตรวจสอบแล้ว' : 'ส่งคำขอแก้ไขทุนถึงเจ้าหน้าที่'}
                  </button>
                </div>

                {/* Request History */}
                {myRequests.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ประวัติคำขอแก้ไขประเภททุน ({myRequests.length})
                    </h3>
                    <div className="space-y-2.5">
                      {myRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-slate-800">
                              ขอเปลี่ยนเป็น:{' '}
                              <span className="text-emerald-700">
                                {req.requestedScholarships?.map((s: any) => s.name).join(' + ') || '-'}
                              </span>
                            </span>
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                                <Clock className="w-3 h-3" /> รอเจ้าหน้าที่ตรวจสอบ
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                                <XCircle className="w-3 h-3" /> ไม่อนุมัติ
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600">
                            <strong>เหตุผลที่แจ้ง:</strong> {req.reason}
                          </p>
                          {req.evidenceUrl && (
                            <div className="pt-1">
                              <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                                📎 หลักฐานที่แนบมา ({req.evidenceFileName || 'รูปภาพหลักฐาน'}):
                              </span>
                              <img
                                src={req.evidenceUrl}
                                alt="หลักฐานประกอบคำขอ"
                                loading="lazy"
                                className="max-h-36 rounded-xl border border-slate-200 bg-white object-contain"
                              />
                            </div>
                          )}
                          {req.officerComment && (
                            <p
                              className={`p-2 rounded-xl border ${
                                req.status === 'rejected'
                                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              }`}
                            >
                              <strong>ความเห็นเจ้าหน้าที่:</strong> {req.officerComment}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>ส่งเมื่อ {new Date(req.createdAt).toLocaleString('th-TH')}</span>
                            {req.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleCancelRequest(req.id)}
                                className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> ยกเลิกคำขอ
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Account Form Card */}
            <form
              onSubmit={handleSaveProfile}
              className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-lg shadow-inner flex-shrink-0">
                  {fullNameDisplay ? fullNameDisplay.charAt(0) : 'U'}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 truncate">{fullNameDisplay}</h2>
                  <p className="text-xs text-slate-400 font-mono truncate">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ชื่อ *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="กรอกชื่อ"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="กรอกนามสกุล"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {user?.role === 'student' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    รหัสนักศึกษา *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="กรอกรหัสนักศึกษา"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    คณะ / วิทยาลัย
                  </label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="กรอกคณะ / วิทยาลัย"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    สาขาวิชา
                  </label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="กรอกสาขาวิชา"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เบอร์โทรศัพท์ติดต่อ
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เปลี่ยนรหัสผ่านใหม่ (เว้นว่างไว้หากไม่ต้องการเปลี่ยน)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลส่วนตัว'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scholarship Change Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    ส่งคำขอแก้ไขประเภททุนการศึกษา
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    เลือกประเภททุนที่ถูกต้องแล้วส่งให้เจ้าหน้าที่ดูแลทุนตรวจสอบและอนุมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {reqError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{reqError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitScholarshipRequest} className="space-y-4">
                {/* Main Scholarship Radio */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    1. ทุนการศึกษาหลักที่ต้องการ (เลือกได้อย่างใดอย่างหนึ่ง)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {mainScholarships.map((sch) => {
                      const isChecked = reqSchIds.includes(sch.id);
                      return (
                        <div
                          key={sch.id}
                          onClick={() => selectReqMainScholarship(isChecked ? null : sch.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition select-none flex items-center gap-2.5 ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isChecked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate">
                              {sch.name}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-semibold">
                              {sch.targetHours} ชม./ปี
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* No Main Scholarship */}
                    {(() => {
                      const hasMain = mainScholarships.some((s) => reqSchIds.includes(s.id));
                      return (
                        <div
                          onClick={() => selectReqMainScholarship(null)}
                          className={`p-3 rounded-2xl border cursor-pointer transition select-none flex items-center gap-2.5 ${
                            !hasMain
                              ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-400/20'
                              : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              !hasMain ? 'bg-slate-600 border-slate-600' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {!hasMain && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-slate-800 block">
                              ไม่รับทุนหลัก (เฉพาะ กยศ.)
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* GYS Checkbox */}
                {gysScholarship && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      2. กองทุน กยศ. (เลือกเพิ่มเติมแยกต่างหากได้)
                    </label>
                    {(() => {
                      const isGysChecked = reqSchIds.includes(gysScholarship.id);
                      return (
                        <div
                          onClick={() => toggleReqGysScholarship(gysScholarship.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition select-none flex items-center gap-3 ${
                            isGysChecked
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                              : 'bg-slate-50 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                              isGysChecked
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isGysChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-indigo-950 block">
                              {gysScholarship.name}
                            </span>
                            <span className="text-[11px] text-indigo-700">
                              +{gysScholarship.targetHours} ชม./ปี
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {reqSelectedObjects.length > 0 && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <strong>ทุนที่ขอเปลี่ยนเป็น:</strong>{' '}
                    {reqSelectedObjects.map((s) => s.name).join(' + ')} (เป้าหมายรวม{' '}
                    <strong>{reqTotalTargetHours} ชม.</strong>)
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    3. เหตุผลในการขอแก้ไขประเภททุน <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reqReason}
                    onChange={(e) => {
                      setReqError(null);
                      setReqReason(e.target.value);
                    }}
                    placeholder="เช่น เพิ่งได้รับอนุมัติกู้ยืม กยศ. เพิ่มเติมในภาคการศึกษานี้ หรือเลือกประเภททุนผิดตอนสมัคร..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Evidence Attachment */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    4. แนบรูปภาพหลักฐานประกอบคำขอ (เช่น หนังสือรับรองทุน / สัญญา กยศ.)
                  </label>
                  <input
                    ref={reqFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReqFileChange}
                    className="hidden"
                  />
                  {!reqEvidenceUrl ? (
                    <button
                      type="button"
                      onClick={() => reqFileInputRef.current?.click()}
                      className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-500 transition flex flex-col items-center justify-center gap-2 group cursor-pointer"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 group-hover:bg-amber-500 text-amber-600 group-hover:text-white flex items-center justify-center transition">
                        <ImagePlus className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          แตะเพื่อแนบรูปภาพหลักฐานการได้รับทุน
                        </p>
                        <p className="text-[11px] text-slate-500">รองรับไฟล์ JPG, PNG, WEBP</p>
                      </div>
                    </button>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-emerald-700 truncate">
                          ✓ {reqEvidenceName || 'หลักฐานประกอบคำขอ'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => reqFileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <ImagePlus className="w-3.5 h-3.5" /> เปลี่ยนรูป
                          </button>
                          <button
                            type="button"
                            onClick={handleClearReqEvidence}
                            title="ลบรูปภาพนี้"
                            className="w-7 h-7 rounded-full bg-rose-100 hover:bg-rose-600 text-rose-600 hover:text-white flex items-center justify-center transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <img
                        src={reqEvidenceUrl}
                        alt="Evidence preview"
                        className="w-full max-h-44 object-contain rounded-xl bg-white border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReq || reqSchIds.length === 0 || !reqReason.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {submittingReq ? 'กำลังส่งคำขอ...' : 'ส่งคำขอไปยังเจ้าหน้าที่'}
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
