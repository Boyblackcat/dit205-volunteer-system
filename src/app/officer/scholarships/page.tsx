'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { ScholarshipType } from '@/types';
import {
  Award,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Target,
  Inbox,
  Users,
  Check,
  XCircle,
  Clock,
  Search,
  ArrowRight,
} from 'lucide-react';

export default function ScholarshipsManagePage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'students' | 'types'>('requests');
  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Create / Edit Scholarship Type modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    targetHours: 50,
    academicYear: '2569',
  });

  // Reject Request Modal
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Direct Edit Student Scholarship Modal
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editStudentSchIds, setEditStudentSchIds] = useState<string[]>([]);

  // Zoom Evidence Preview Modal
  const [previewEvidence, setPreviewEvidence] = useState<{ url: string; title: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchAll = async () => {
    try {
      const [schRes, reqRes] = await Promise.all([
        fetch('/api/scholarships'),
        fetch('/api/scholarship-requests'),
      ]);
      if (schRes.ok) {
        const sData = await schRes.json();
        setScholarships(sData.scholarships || []);
      }
      if (reqRes.ok) {
        const rData = await reqRes.json();
        setRequests(rData.requests || []);
        setStudents(rData.students || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const isGys = (s: ScholarshipType) => s.id === 'sch-4' || s.name.includes('กยศ');
  const mainScholarships = scholarships.filter((s) => !isGys(s));
  const gysScholarship = scholarships.find((s) => isGys(s));

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ name: '', description: '', targetHours: 50, academicYear: '2569' });
    setShowModal(true);
  };

  const openEditModal = (sch: ScholarshipType) => {
    setEditingId(sch.id);
    setForm({
      name: sch.name,
      description: sch.description,
      targetHours: sch.targetHours,
      academicYear: sch.academicYear || '2569',
    });
    setShowModal(true);
  };

  const handleSubmitType = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const url = editingId ? `/api/scholarships/${editingId}` : '/api/scholarships';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: data.message || 'บันทึกประเภททุนสำเร็จ', type: 'success' });
        setShowModal(false);
        fetchAll();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteType = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบประเภททุน "${name}" หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/scholarships/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: 'ลบประเภททุนเรียบร้อยแล้ว', type: 'success' });
        fetchAll();
      } else {
        setMsg({ text: data.error || 'ไม่สามารถลบประเภททุนได้', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const handleApproveRequest = async (reqItem: any) => {
    const targetNames = reqItem.requestedScholarships?.map((s: any) => s.name).join(' + ');
    if (
      !confirm(
        `ยืนยันอนุมัติเปลี่ยนทุนของ ${reqItem.student?.name} เป็น "${targetNames}" หรือไม่?`
      )
    ) {
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/scholarship-requests/${reqItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: data.message, type: 'success' });
        fetchAll();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq || !rejectReason.trim()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/scholarship-requests/${rejectingReq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', officerComment: rejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: data.message, type: 'success' });
        setRejectingReq(null);
        setRejectReason('');
        fetchAll();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditStudentModal = (st: any) => {
    setEditingStudent(st);
    setEditStudentSchIds(st.scholarshipTypeIds || []);
  };

  const selectStudentMainSch = (schId: string | null) => {
    setEditStudentSchIds((prev) => {
      const gysIds = prev.filter((id) => {
        const found = scholarships.find((s) => s.id === id);
        return found && isGys(found);
      });
      return schId ? [schId, ...gysIds] : [...gysIds];
    });
  };

  const toggleStudentGysSch = (gysId: string) => {
    setEditStudentSchIds((prev) =>
      prev.includes(gysId) ? prev.filter((id) => id !== gysId) : [...prev, gysId]
    );
  };

  const handleSaveStudentScholarship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || editStudentSchIds.length === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/scholarship-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUpdateStudentId: editingStudent.id,
          requestedScholarshipIds: editStudentSchIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: data.message, type: 'success' });
        setEditingStudent(null);
        fetchAll();
      } else {
        setMsg({ text: data.error || 'ไม่สามารถแก้ไขทุนได้', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter((st) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      st.name?.toLowerCase().includes(q) ||
      st.studentId?.toLowerCase().includes(q) ||
      st.faculty?.toLowerCase().includes(q)
    );
  });

  return (
    <RoleGuard allowedRoles={['officer', 'admin']}>
      <div className="space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              จัดการทุนการศึกษาและคำขอเปลี่ยนทุน
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              พิจารณาคำขอเปลี่ยนประเภททุนของนักศึกษา แก้ไขทุนให้นักศึกษา และกำหนดชั่วโมงเป้าหมายแต่ละประเภททุน
            </p>
          </div>
          {activeTab === 'types' && (
            <button
              onClick={openCreateModal}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" /> เพิ่มประเภททุนใหม่
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Inbox className="w-4 h-4 flex-shrink-0" />
            <span>คำขอแก้ไขทุน</span>
            {pendingCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  activeTab === 'requests'
                    ? 'bg-white text-amber-700'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'students'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>แก้ไขทุนนักศึกษา ({students.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('types')}
            className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'types'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4 flex-shrink-0" />
            <span>ประเภททุน ({scholarships.length})</span>
          </button>
        </div>

        {msg && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-medium ${
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
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: Scholarship Change Requests */}
            {activeTab === 'requests' && (
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-slate-200/80 shadow-xs">
                    <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-800">
                      ยังไม่มีคำขอแก้ไขประเภททุนจากนักศึกษา
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      เมื่อนักศึกษาส่งคำขอเปลี่ยนทุนจากหน้าโปรไฟล์ รายการจะปรากฏที่นี่เพื่อให้เจ้าหน้าที่พิจารณา
                    </p>
                  </div>
                ) : (
                  requests.map((req) => (
                    <div
                      key={req.id}
                      className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-xs space-y-4 ${
                        req.status === 'pending' ? 'border-amber-300' : 'border-slate-200/80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-base text-slate-900">
                              {req.student?.name || 'ไม่พบชื่อนักศึกษา'}
                            </h3>
                            <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                              รหัส: {req.student?.studentId || '-'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {req.student?.faculty || '-'} • ส่งคำขอเมื่อ{' '}
                            {new Date(req.createdAt).toLocaleString('th-TH')}
                          </p>
                        </div>

                        {req.status === 'pending' && (
                          <span className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
                            <Clock className="w-3.5 h-3.5" /> รอพิจารณา
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> อนุมัติแล้ว
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-xs">
                            <XCircle className="w-3.5 h-3.5" /> ไม่อนุมัติ
                          </span>
                        )}
                      </div>

                      {/* Change Comparison */}
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block mb-1">
                            ทุนปัจจุบัน
                          </span>
                          <p className="font-semibold text-slate-800">
                            {req.currentScholarships?.map((s: any) => s.name).join(' + ') || 'ไม่ระบุ'}
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center justify-center text-amber-600">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                            ทุนที่ขอเปลี่ยนเป็น
                          </span>
                          <p className="font-bold text-emerald-800">
                            {req.requestedScholarships?.map((s: any) => s.name).join(' + ') || '-'}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700">
                        <strong className="text-amber-900">เหตุผลของนักศึกษา:</strong> {req.reason}
                      </div>

                      {req.evidenceUrl && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-700">
                              📎 หลักฐานประกอบคำขอ ({req.evidenceFileName || 'รูปภาพหลักฐาน'})
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewEvidence({
                                  url: req.evidenceUrl,
                                  title: `หลักฐานคำขอเปลี่ยนทุน — ${req.student?.name || ''}`,
                                })
                              }
                              className="text-amber-700 hover:underline font-semibold"
                            >
                              คลิกเพื่อขยายดูภาพใหญ่
                            </button>
                          </div>
                          <img
                            src={req.evidenceUrl}
                            alt="หลักฐานประกอบคำขอเปลี่ยนทุน"
                            onClick={() =>
                              setPreviewEvidence({
                                url: req.evidenceUrl,
                                title: `หลักฐานคำขอเปลี่ยนทุน — ${req.student?.name || ''}`,
                              })
                            }
                            className="max-h-48 rounded-xl border border-slate-200 bg-white object-contain cursor-zoom-in"
                          />
                        </div>
                      )}

                      {req.officerComment && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                          <strong>ผลการพิจารณา ({req.reviewedBy || 'เจ้าหน้าที่'}):</strong>{' '}
                          {req.officerComment}
                        </div>
                      )}

                      {req.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setRejectingReq(req);
                              setRejectReason('');
                            }}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" /> ไม่อนุมัติ
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleApproveRequest(req)}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> อนุมัติเปลี่ยนทุนให้ทันที
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: Direct Student Scholarship Editor */}
            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="ค้นหานักศึกษาด้วยชื่อ รหัสนักศึกษา หรือคณะ..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStudents.map((st) => (
                    <div
                      key={st.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm sm:text-base text-slate-900">
                              {st.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">
                              รหัส: {st.studentId || '-'} • {st.faculty || '-'}
                            </p>
                          </div>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-xl flex-shrink-0">
                            {st.targetHours} ชม.
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {st.scholarships?.length > 0 ? (
                            st.scholarships.map((s: any) => (
                              <span
                                key={s.id}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"
                              >
                                🎓 {s.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">ยังไม่ได้ระบุทุน</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditStudentModal(st)}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-4 h-4" /> แก้ไขประเภททุนให้นักศึกษาคนนี้
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Scholarship Types CRUD */}
            {activeTab === 'types' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {scholarships.map((sch) => (
                  <div
                    key={sch.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                          ปีการศึกษา {sch.academicYear || '2569'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(sch)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                            title="แก้ไข"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteType(sch.id, sch.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mb-1.5">{sch.name}</h3>
                      <p className="text-xs text-slate-600 mb-4 line-clamp-2">
                        {sch.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                      </p>
                    </div>

                    <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-semibold">เป้าหมายชั่วโมง:</span>
                      </div>
                      <span className="text-base font-extrabold text-amber-900">
                        {sch.targetHours} ชั่วโมง
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Modal: Reject Scholarship Request */}
        {rejectingReq && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> ไม่อนุมัติคำขอเปลี่ยนทุน
                </h3>
                <button
                  onClick={() => setRejectingReq(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                นักศึกษา: <strong>{rejectingReq.student?.name}</strong>
              </p>
              <form onSubmit={handleRejectRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ระบุเหตุผลที่ไม่อนุมัติ *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="เช่น ไม่พบรายชื่อในระบบผู้กู้ยืม กยศ. ประจำปีการศึกษานี้ กรุณาติดต่อสำนักงานทุน..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectingReq(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !rejectReason.trim()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'ยืนยันไม่อนุมัติ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Direct Edit Student Scholarship */}
        {editingStudent && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    แก้ไขประเภททุนให้นักศึกษา
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingStudent.name} (รหัส {editingStudent.studentId})
                  </p>
                </div>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStudentScholarship} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    1. ทุนหลัก (เลือกได้อย่างใดอย่างหนึ่ง)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {mainScholarships.map((sch) => {
                      const isChecked = editStudentSchIds.includes(sch.id);
                      return (
                        <div
                          key={sch.id}
                          onClick={() => selectStudentMainSch(isChecked ? null : sch.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition select-none flex items-center gap-2.5 ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isChecked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate">
                              {sch.name}
                            </span>
                            <span className="text-[11px] text-emerald-700">{sch.targetHours} ชม.</span>
                          </div>
                        </div>
                      );
                    })}
                    <div
                      onClick={() => selectStudentMainSch(null)}
                      className={`p-3 rounded-2xl border cursor-pointer transition select-none flex items-center gap-2.5 ${
                        !mainScholarships.some((s) => editStudentSchIds.includes(s.id))
                          ? 'bg-slate-100 border-slate-500'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          !mainScholarships.some((s) => editStudentSchIds.includes(s.id))
                            ? 'bg-slate-600 border-slate-600'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {!mainScholarships.some((s) => editStudentSchIds.includes(s.id)) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-bold text-xs text-slate-800">ไม่รับทุนหลัก</span>
                    </div>
                  </div>
                </div>

                {gysScholarship && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      2. กองทุน กยศ. (เลือกเพิ่มเติมได้)
                    </label>
                    <div
                      onClick={() => toggleStudentGysSch(gysScholarship.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition select-none flex items-center gap-3 ${
                        editStudentSchIds.includes(gysScholarship.id)
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                          editStudentSchIds.includes(gysScholarship.id)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {editStudentSchIds.includes(gysScholarship.id) && (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-indigo-950 block">
                          {gysScholarship.name}
                        </span>
                        <span className="text-[11px] text-indigo-700">
                          +{gysScholarship.targetHours} ชม.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || editStudentSchIds.length === 0}
                    className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนทุน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Scholarship Type */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  {editingId ? 'แก้ไขประเภททุน' : 'เพิ่มประเภททุนใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitType} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อประเภททุนการศึกษา *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น ทุนเรียนดี 50% หรือ ทุน กยศ."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    คำอธิบายและเงื่อนไข
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="รายละเอียดเงื่อนไขและหลักเกณฑ์ของทุน..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ชั่วโมงเป้าหมาย (ชม.) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      required
                      value={form.targetHours}
                      onChange={(e) => setForm({ ...form, targetHours: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ปีการศึกษา
                    </label>
                    <input
                      type="text"
                      value={form.academicYear}
                      onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                      placeholder="2569"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'บันทึกประเภททุน'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal: Zoom Evidence Preview */}
        {previewEvidence && (
          <div
            onClick={() => setPreviewEvidence(null)}
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-3xl w-full p-5 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {previewEvidence.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewEvidence(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
              <img
                src={previewEvidence.url}
                alt={previewEvidence.title}
                className="w-full max-h-[75vh] object-contain rounded-2xl bg-slate-50 border border-slate-200"
              />
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
