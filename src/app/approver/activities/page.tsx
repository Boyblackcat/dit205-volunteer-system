'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Activity } from '@/types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';

export default function ApproverActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleApproveActivity = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    setMsg(null);

    try {
      const res = await fetch(`/api/activities/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          comment: status === 'approved' ? 'อนุมัติเปิดรับสมัครกิจกรรม' : 'ไม่อนุมัติกิจกรรม',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg({ text: data.message, type: 'success' });
        fetchActivities();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาด', type: 'error' });
      }
    } catch (e) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <RoleGuard allowedRoles={['approver', 'officer', 'admin']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            พิจารณาและอนุมัติกิจกรรมจิตอาสา
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            ตรวจสอบรายละเอียด วัตถุประสงค์ และจำนวนชั่วโมงของกิจกรรมก่อนเปิดให้นักศึกษาสมัคร
          </p>
        </div>

        {msg && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-2 text-sm ${
              msg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Activity Cards */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-gray-500">กำลังโหลดรายการกิจกรรม...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">ไม่มีกิจกรรมในระบบ</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activities.map((act) => (
              <div
                key={act.id}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-purple-200">
                        {act.category}
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                        เทอม {act.semester || '1'}/{act.academicYear || '2569'}
                      </span>
                    </div>
                    <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      +{act.hours} ชม.
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base mb-1.5">
                    {act.title}
                  </h3>
                  <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                    {act.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{act.date} ({act.startTime} - {act.endTime} น.)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{act.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>เปิดรับ: {act.maxParticipants} คน • ผู้จัด: {act.organizerName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    {act.status === 'approved' && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ✓ อนุมัติแล้ว
                      </span>
                    )}
                    {act.status === 'pending_approval' && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        ⏳ รอการอนุมัติ
                      </span>
                    )}
                    {act.status === 'rejected' && (
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                        ✕ ไม่อนุมัติ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {act.status !== 'approved' && (
                      <button
                        onClick={() => handleApproveActivity(act.id, 'approved')}
                        disabled={actionLoading === act.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-sm transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> อนุมัติเปิดรับสมัคร
                      </button>
                    )}
                    {act.status !== 'rejected' && (
                      <button
                        onClick={() => handleApproveActivity(act.id, 'rejected')}
                        disabled={actionLoading === act.id}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rose-200 transition flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> ปฏิเสธ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

