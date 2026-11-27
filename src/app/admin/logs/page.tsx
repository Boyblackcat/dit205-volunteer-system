'use client';

import React, { useState, useEffect } from 'react';
import { RoleGuard } from '@/components/RoleGuard';
import { AuditLog } from '@/types';
import { Search, RefreshCw } from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.userName.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q)
    );
  });

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              ประวัติการใช้งานระบบ (Audit Logs)
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              ตรวจสอบประวัติการทำรายการย้อนหลัง ผู้ดำเนินการ บทบาท และวันเวลาที่เกิดรายการ
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="self-start sm:self-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> รีเฟรช
          </button>
        </div>

        {/* Search */}
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อผู้ดำเนินการ, Action หรือรายละเอียดในประวัติ..."
            className="w-full text-xs focus:outline-none"
          />
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-base">บันทึกเหตุการณ์ทั้งหมด</h2>
            <span className="text-xs text-gray-500">รวม {filteredLogs.length} รายการ</span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-gray-500">กำลังโหลดประวัติการใช้งาน...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">ไม่พบประวัติการใช้งาน</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">{log.userName}</span>
                      <span className="bg-gray-100 text-gray-700 text-[11px] px-2 py-0.5 rounded-full font-medium">
                        {log.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-indigo-700 break-all">{log.action}</span>
                      <span className="text-gray-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString('th-TH')}
                      </span>
                    </div>
                    <p className="text-gray-700 break-words leading-relaxed">{log.details}</p>
                  </div>
                ))}
              </div>

              {/* Desktop Fixed-Width Table View */}
              <div className="hidden md:block">
                <table className="w-full table-fixed text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b">
                    <tr>
                      <th className="py-3 px-3 w-[16%]">วันเวลา</th>
                      <th className="py-3 px-3 w-[16%]">ผู้ดำเนินการ</th>
                      <th className="py-3 px-2 w-[10%] text-center">บทบาท</th>
                      <th className="py-3 px-3 w-[20%] font-mono">ประเภท</th>
                      <th className="py-3 px-3 w-[38%]">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px] break-words">
                          {new Date(log.timestamp).toLocaleString('th-TH')}
                        </td>
                        <td className="py-3 px-3 font-semibold text-gray-900 break-words">
                          {log.userName}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="bg-gray-100 text-gray-700 text-[11px] px-2 py-0.5 rounded-full font-medium inline-block">
                            {log.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-indigo-700 break-all">
                          {log.action}
                        </td>
                        <td className="py-3 px-3 text-gray-700 break-words">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
