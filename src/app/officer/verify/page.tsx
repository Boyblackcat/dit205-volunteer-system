'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  ShieldAlert,
} from 'lucide-react';

const REJECT_PRESETS = [
  'รูปภาพหลักฐานไม่ชัดเจน / มองไม่เห็นหน้าหรือกิจกรรม',
  'รูปภาพไม่ตรงกับกิจกรรมที่ลงทะเบียน',
  'ยังไม่ได้สแกนเข้าร่วมกิจกรรม',
  'หลักฐานหรือรายละเอียดกิจกรรมไม่ครบถ้วน',
];

export default function OfficerVerifyPage() {
  const { user } = useAuth();
  const [hourRecords, setHourRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [approvedHours, setApprovedHours] = useState<number>(0);

  // Confirm Approve Pop-up (requires typing "ยืนยัน")
  const [approvePopupRecord, setApprovePopupRecord] = useState<any | null>(null);
  const [confirmApproveText, setConfirmApproveText] = useState('');

  // Reject / Return Reason Pop-up (requires reason)
  const [rejectPopupRecord, setRejectPopupRecord] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/hours');
      if (res.ok) {
        const data = await res.json();
        setHourRecords(data.hourRecords || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const openReviewModal = (record: any) => {
    setSelectedRecord(record);
    setComment(record.officerComment || record.approverComment || '');
    setApprovedHours(record.hours);
  };

  const openApprovePopup = (record: any, hoursOverride?: number) => {
    setApprovePopupRecord({
      ...record,
      hoursToApprove: hoursOverride !== undefined ? hoursOverride : record.hours,
    });
    setConfirmApproveText('');
  };

  const openRejectPopup = (record: any) => {
    setRejectPopupRecord(record);
    setRejectReason('');
    setRejectError('');
  };

  const submitApproval = async () => {
    if (!approvePopupRecord) return;
    if (confirmApproveText.trim() !== 'ยืนยัน') return;

    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/hours/${approvePopupRecord.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          comment: comment.trim() || 'ตรวจสอบหลักฐานและอนุมัติชั่วโมงเรียบร้อยแล้ว',
          approvedHours: approvePopupRecord.hoursToApprove ?? approvePopupRecord.hours,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          text: `อนุมัติรับรองชั่วโมงให้ ${approvePopupRecord.student?.name} (+${approvePopupRecord.hoursToApprove ?? approvePopupRecord.hours} ชม.) เรียบร้อยแล้ว`,
          type: 'success',
        });
        setApprovePopupRecord(null);
        setSelectedRecord(null);
        setConfirmApproveText('');
        fetchRecords();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาดในการอนุมัติ', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const submitReject = async () => {
    if (!rejectPopupRecord) return;
    if (!rejectReason.trim()) {
      setRejectError('กรุณาระบุเหตุผลที่ส่งกลับแก้ไข / ตีกลับ');
      return;
    }

    setActionLoading(true);
    setMsg(null);
    setRejectError('');
    try {
      const res = await fetch(`/api/hours/${rejectPopupRecord.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          comment: rejectReason.trim(),
          approvedHours: rejectPopupRecord.hours,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({
          text: `ส่งกลับแก้ไขให้ ${rejectPopupRecord.student?.name} เรียบร้อยแล้ว (เหตุผล: ${rejectReason.trim()})`,
          type: 'success',
        });
        setRejectPopupRecord(null);
        setSelectedRecord(null);
        setRejectReason('');
        fetchRecords();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาดในการส่งกลับแก้ไข', type: 'error' });
      }
    } catch {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['officer', 'approver', 'admin']}>
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            ตรวจสอบหลักฐานและอนุมัติชั่วโมงทุน
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ตรวจสอบข้อมูลการสแกนเข้าร่วมและรูปหลักฐานของนักศึกษา ก่อนพิมพ์ &ldquo;ยืนยัน&rdquo; เพื่ออนุมัติ หรือระบุเหตุผลเพื่อส่งกลับแก้ไข
          </p>
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

        {/* Table of Hour Records */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base">
              รายการชั่วโมงจิตอาสาของนักศึกษา
            </h2>
            <span className="text-xs text-slate-500">รวม {hourRecords.length} รายการ</span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">กำลังโหลดรายการ...</p>
            </div>
          ) : hourRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              ไม่มีรายการชั่วโมงจิตอาสาในระบบ
            </div>
          ) : (
            <>
              {/* Mobile / Tablet Card View */}
              <div className="lg:hidden divide-y divide-slate-100">
                {hourRecords.map((hr) => (
                  <div key={hr.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          {hr.student?.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          รหัส: {hr.student?.studentId || '-'}
                        </div>
                      </div>
                      <span className="font-extrabold text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-xl flex-shrink-0">
                        {hr.hours} ชม.
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="font-semibold text-slate-800">{hr.activity?.title}</div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                          เทอม {hr.activity?.semester || '1'}/{hr.activity?.academicYear || '2569'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {hr.student?.scholarshipName}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {hr.attendance && (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          ✓ เช็กชื่อแล้ว
                        </span>
                      )}
                      {hr.evidence && (
                        <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">
                          📷 มีหลักฐาน
                        </span>
                      )}
                      {hr.status === 'approved' && (
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">
                          ✓ อนุมัติแล้ว
                        </span>
                      )}
                      {hr.status === 'verified_by_officer' && (
                        <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
                          จนท. ตรวจแล้ว
                        </span>
                      )}
                      {hr.status === 'pending' && (
                        <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
                          รอตรวจสอบ
                        </span>
                      )}
                      {hr.status === 'rejected' && (
                        <span className="bg-rose-100 text-rose-800 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
                          ส่งกลับแก้ไข
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openReviewModal(hr)}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold px-4 py-2.5 rounded-xl border border-amber-300 transition text-xs flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" /> ตรวจสอบหลักฐาน
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop Fixed-Width Table View */}
              <div className="hidden lg:block">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-3 w-[16%]">นักศึกษา</th>
                      <th className="py-3.5 px-2.5 w-[14%]">ประเภททุน</th>
                      <th className="py-3.5 px-2.5 w-[22%]">กิจกรรม</th>
                      <th className="py-3.5 px-2 w-[8%] text-center">ชั่วโมง</th>
                      <th className="py-3.5 px-2 w-[15%] text-center">เช็กชื่อ/หลักฐาน</th>
                      <th className="py-3.5 px-2 w-[13%] text-center">สถานะ</th>
                      <th className="py-3.5 px-2 w-[12%] text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hourRecords.map((hr) => (
                      <tr key={hr.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-semibold text-slate-900 break-words">
                          <div>{hr.student?.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            รหัส: {hr.student?.studentId || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-2.5 text-slate-600 break-words">
                          {hr.student?.scholarshipName}
                        </td>
                        <td className="py-3 px-2.5 font-medium text-slate-900 min-w-0">
                          <div className="truncate" title={hr.activity?.title}>{hr.activity?.title}</div>
                          <span className="inline-block mt-0.5 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            เทอม {hr.activity?.semester || '1'}/{hr.activity?.academicYear || '2569'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-600">
                          {hr.hours} ชม.
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {hr.attendance ? (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                ✓ เช็กชื่อแล้ว
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">ยังไม่เช็กชื่อ</span>
                            )}
                            {hr.evidence && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                                📷 มีหลักฐาน
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {hr.status === 'approved' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2 py-1 rounded-full font-bold inline-block">
                              ✓ อนุมัติแล้ว
                            </span>
                          )}
                          {hr.status === 'verified_by_officer' && (
                            <span className="bg-blue-100 text-blue-800 text-[11px] px-2 py-1 rounded-full font-semibold inline-block">
                              จนท. ตรวจแล้ว
                            </span>
                          )}
                          {hr.status === 'pending' && (
                            <span className="bg-amber-100 text-amber-800 text-[11px] px-2 py-1 rounded-full font-semibold inline-block">
                              รอตรวจสอบ
                            </span>
                          )}
                          {hr.status === 'rejected' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="bg-rose-100 text-rose-800 text-[11px] px-2 py-1 rounded-full font-semibold inline-block">
                                ส่งกลับแก้ไข
                              </span>
                              {(hr.officerComment || hr.approverComment) && (
                                <span
                                  className="text-[10px] text-rose-600 max-w-full truncate"
                                  title={hr.officerComment || hr.approverComment}
                                >
                                  {hr.officerComment || hr.approverComment}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => openReviewModal(hr)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold px-2.5 py-1.5 rounded-xl border border-amber-300 transition text-[11px] inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> ตรวจสอบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* 1. Review Detail Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-amber-600" />
                  ตรวจสอบหลักฐานและอนุมัติชั่วโมงทุน
                </h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs mb-4">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">นักศึกษา:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {selectedRecord.student?.name} (รหัส {selectedRecord.student?.studentId})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ประเภททุน:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {selectedRecord.student?.scholarshipName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">กิจกรรม:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {selectedRecord.activity?.title}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">เช็กชื่อเมื่อ:</span>
                  <span className="font-medium text-emerald-700 text-right">
                    {selectedRecord.attendance
                      ? new Date(selectedRecord.attendance.checkInTime).toLocaleString('th-TH')
                      : 'ยังไม่พบประวัติเช็กชื่อ'}
                  </span>
                </div>
              </div>

              {/* Evidence */}
              {selectedRecord.evidence ? (
                <div className="mb-4 border border-slate-200 rounded-2xl p-3 bg-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      📷 ภาพถ่ายหลักฐานที่นักศึกษาแนบมา:
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {selectedRecord.evidence.fileName}
                    </span>
                  </div>
                  <img
                    src={selectedRecord.evidence.fileUrl}
                    alt="หลักฐาน"
                    className="w-full max-h-56 object-contain rounded-xl bg-white border border-slate-200 mb-2"
                  />
                  {selectedRecord.evidence.notes && (
                    <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                      <strong className="text-slate-700">บันทึกของนักศึกษา:</strong>{' '}
                      {selectedRecord.evidence.notes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs">
                  ⚠️ นักศึกษายังไม่ได้แนบรูปถ่ายหลักฐานเพิ่มเติม
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    จำนวนชั่วโมงที่อนุมัติ (ชม.) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={approvedHours}
                    onChange={(e) => setApprovedHours(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="เช่น ตรวจสอบภาพถ่ายและเวลาเช็กชื่อแล้ว ถูกต้องตามข้อกำหนด"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => openRejectPopup(selectedRecord)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> ส่งกลับแก้ไข / ตีกลับ
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => openApprovePopup(selectedRecord, approvedHours)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> อนุมัติรับรองชั่วโมง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Confirm Approval Pop-up (Must type "ยืนยัน") */}
        {approvePopupRecord && (
          <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">ยืนยันการอนุมัติชั่วโมงทุน</h3>
                    <p className="text-xs text-slate-500">กรุณาตรวจสอบและพิมพ์คำว่า &ldquo;ยืนยัน&rdquo;</p>
                  </div>
                </div>
                <button
                  onClick={() => setApprovePopupRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">นักศึกษา:</span>
                  <span className="font-bold text-slate-900">{approvePopupRecord.student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">กิจกรรม:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">
                    {approvePopupRecord.activity?.title}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ชั่วโมงที่จะอนุมัติ:</span>
                  <span className="font-extrabold text-emerald-700">
                    +{approvePopupRecord.hoursToApprove ?? approvePopupRecord.hours} ชั่วโมง
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  พิมพ์คำว่า <span className="text-emerald-700 underline">ยืนยัน</span> เพื่ออนุมัติชั่วโมง *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={confirmApproveText}
                  onChange={(e) => setConfirmApproveText(e.target.value)}
                  placeholder="พิมพ์คำว่า ยืนยัน"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovePopupRecord(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={submitApproval}
                  disabled={confirmApproveText.trim() !== 'ยืนยัน' || actionLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {actionLoading ? 'กำลังบันทึก...' : 'ยืนยันอนุมัติชั่วโมง'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Reject / Return Reason Pop-up */}
        {rejectPopupRecord && (
          <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">ส่งกลับแก้ไข / ตีกลับหลักฐาน</h3>
                    <p className="text-xs text-slate-500">
                      กรุณาระบุเหตุผลให้นักศึกษาทราบว่าต้องแก้ไขอะไร
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRejectPopupRecord(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3 text-xs">
                <p className="font-bold text-rose-950">{rejectPopupRecord.student?.name}</p>
                <p className="text-rose-800 mt-0.5">กิจกรรม: {rejectPopupRecord.activity?.title}</p>
              </div>

              {/* Quick preset reasons */}
              <div>
                <p className="text-[11px] font-bold text-slate-600 mb-1.5">เลือกเหตุผลด่วน (คลิกเพื่อเติมข้อความ):</p>
                <div className="flex flex-wrap gap-1.5">
                  {REJECT_PRESETS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => {
                        setRejectReason(reason);
                        setRejectError('');
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-300 text-slate-700 transition text-left"
                    >
                      + {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ระบุเหตุผลที่ตีกลับ / ส่งกลับแก้ไข *
                </label>
                <textarea
                  rows={3}
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    setRejectError('');
                  }}
                  placeholder="อธิบายสาเหตุที่ตีกลับ เช่น ภาพถ่ายเบลอไม่เห็นตัวนักศึกษา กรุณาอัปโหลดรูปใหม่..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
                {rejectError && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">{rejectError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectPopupRecord(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={submitReject}
                  disabled={!rejectReason.trim() || actionLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  {actionLoading ? 'กำลังส่งกลับ...' : 'ยืนยันส่งกลับแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
