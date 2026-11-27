'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import {
  BarChart3,
  Download,
  Printer,
  Users,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
} from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json.metrics);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <RoleGuard allowedRoles={['approver', 'officer', 'admin']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              รายงานภาพรวมชั่วโมงจิตอาสานักศึกษาทุน
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              สรุปข้อมูลการสะสมชั่วโมงและผลการดำเนินงานระดับหน่วยงาน/มหาวิทยาลัย
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> พิมพ์รายงาน
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-gray-500">กำลังประมวลผลรายงาน...</p>
          </div>
        ) : data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  นักศึกษาทุนทั้งหมด
                </span>
                <div className="text-3xl font-extrabold text-gray-900 mt-2">
                  {data.totalStudents} <span className="text-sm font-normal text-gray-500">คน</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  กิจกรรมเปิดรับสมัคร
                </span>
                <div className="text-3xl font-extrabold text-gray-900 mt-2">
                  {data.approvedActivitiesCount}{' '}
                  <span className="text-sm font-normal text-gray-500">โครงการ</span>
                </div>
              </div>

              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  ชั่วโมงสะสมที่อนุมัติแล้ว
                </span>
                <div className="text-3xl font-extrabold text-emerald-700 mt-2">
                  {data.allApprovedHours}{' '}
                  <span className="text-sm font-normal text-emerald-600">ชม.</span>
                </div>
              </div>

              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  ชั่วโมงรออนุมัติ
                </span>
                <div className="text-3xl font-extrabold text-amber-700 mt-2">
                  {data.allPendingHours}{' '}
                  <span className="text-sm font-normal text-amber-600">ชม.</span>
                </div>
              </div>
            </div>

            {/* Table of scholarships summary */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900 text-base">
                  สถิติการสะสมชั่วโมงแยกตามประเภททุนการศึกษา (ปีการศึกษา 2569)
                </h3>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {data.scholarshipSummary?.map((sch: any) => (
                  <div key={sch.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{sch.name}</span>
                      <span className="font-bold text-emerald-600">{sch.achievementRate}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-gray-600">
                      <span>เกณฑ์/คน: <strong>{sch.targetHoursPerStudent} ชม.</strong></span>
                      <span>นักศึกษา: <strong>{sch.studentCount} คน</strong></span>
                      <span>เป้าหมายรวม: <strong>{sch.totalTargetHours} ชม.</strong></span>
                      <span>อนุมัติแล้ว: <strong className="text-emerald-600">{sch.totalApprovedHours} ชม.</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Fixed-Width Table View */}
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3 w-[30%]">ประเภททุน</th>
                      <th className="py-3 px-2 w-[14%] text-center">เกณฑ์/คน</th>
                      <th className="py-3 px-2 w-[14%] text-center">นักศึกษา</th>
                      <th className="py-3 px-2 w-[14%] text-center">เป้าหมายรวม</th>
                      <th className="py-3 px-2 w-[14%] text-center">อนุมัติแล้ว</th>
                      <th className="py-3 px-2 w-[14%] text-center">อัตราสำเร็จ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.scholarshipSummary?.map((sch: any) => (
                      <tr key={sch.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-3 font-semibold text-gray-900 break-words">{sch.name}</td>
                        <td className="py-3 px-2 text-center">{sch.targetHoursPerStudent} ชม.</td>
                        <td className="py-3 px-2 text-center">{sch.studentCount} คน</td>
                        <td className="py-3 px-2 text-center">{sch.totalTargetHours} ชม.</td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-600">
                          {sch.totalApprovedHours} ชม.
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-gray-800">
                          {sch.achievementRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}

