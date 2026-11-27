'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Role, User } from '@/types';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Key,
  Database,
  RefreshCw,
} from 'lucide-react';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [scholarships, setScholarships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tidbStatus, setTidbStatus] = useState<{
    connected: boolean;
    host?: string;
    user?: string;
    database?: string;
    hasPassword?: boolean;
    table?: string;
    count?: number;
    message?: string;
  } | null>(null);
  const [tidbPassword, setTidbPassword] = useState('');
  const [syncingTidb, setSyncingTidb] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'student' as Role,
    studentId: '',
    scholarshipTypeId: '',
    scholarshipTypeIds: [] as string[],
    faculty: '',
    major: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchScholarships = async () => {
    try {
      const res = await fetch('/api/scholarships');
      if (res.ok) {
        const data = await res.json();
        setScholarships(data.scholarships);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTidbStatus = async () => {
    try {
      const res = await fetch('/api/admin/tidb');
      if (res.ok) {
        const data = await res.json();
        setTidbStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncTidb = async () => {
    setSyncingTidb(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/tidb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tidbPassword ? { password: tidbPassword } : {}),
      });
      const data = await res.json();
      if (data.connected) {
        setMsg({
          text: `เชื่อมต่อและซิงก์ข้อมูลผู้ใช้งานกับ TiDB Cloud (${data.database}.volunteer_users) สำเร็จ จำนวน ${data.syncedCount} บัญชี`,
          type: 'success',
        });
        setTidbPassword('');
        fetchUsers();
        fetchTidbStatus();
      } else {
        setMsg({
          text: data.error || 'ไม่สามารถเชื่อมต่อ TiDB Cloud ได้ในขณะนี้ (บันทึกใน Local DB แทน)',
          type: 'error',
        });
      }
    } catch (e) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ TiDB Cloud', type: 'error' });
    } finally {
      setSyncingTidb(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchScholarships();
    fetchTidbStatus();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'student',
      studentId: '',
      scholarshipTypeId: scholarships[0]?.id || '',
      scholarshipTypeIds: scholarships[0]?.id ? [scholarships[0].id] : [],
      faculty: '',
      major: '',
      phone: '',
    });
    setShowModal(true);
  };

  const openEditModal = (u: any) => {
    setEditingId(u.id);
    const schIds = u.scholarshipTypeIds || (u.scholarshipTypeId ? [u.scholarshipTypeId] : []);
    const fallbackParts = (u.name || '').trim().split(/\s+/);
    const fName = u.firstName ?? fallbackParts[0] ?? '';
    const lName = u.lastName ?? (fallbackParts.length > 1 ? fallbackParts.slice(1).join(' ') : '');
    setForm({
      firstName: fName,
      lastName: lName,
      email: u.email,
      password: '',
      role: u.role,
      studentId: u.studentId || '',
      scholarshipTypeId: schIds[0] || '',
      scholarshipTypeIds: schIds,
      faculty: u.faculty || '',
      major: u.major || '',
      phone: u.phone || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const url = editingId ? `/api/admin/users/${editingId}` : '/api/admin/users';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        name: [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' '),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setMsg({
          text: data.message || 'บันทึกข้อมูลผู้ใช้งานและกำหนดบทบาทสำเร็จ',
          type: 'success',
        });
        setShowModal(false);
        fetchUsers();
      } else {
        setMsg({ text: data.error || 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบบัญชีผู้ใช้ "${name}" หรือไม่?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: 'ลบบัญชีผู้ใช้เรียบร้อยแล้ว', type: 'success' });
        fetchUsers();
      } else {
        setMsg({ text: data.error || 'ไม่สามารถลบบัญชีได้', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error' });
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'student':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">นักศึกษาทุน</span>;
      case 'organizer':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">ผู้จัดกิจกรรม</span>;
      case 'officer':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">เจ้าหน้าที่ทุน</span>;
      case 'approver':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">ผู้อนุมัติ</span>;
      case 'admin':
        return <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">Admin</span>;
    }
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              จัดการบัญชีผู้ใช้งานและการกำหนดสิทธิ์ (RBAC)
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              สร้าง แก้ไข กำหนดบทบาท และระบุประเภททุนสำหรับนักศึกษา
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleSyncTidb}
              disabled={syncingTidb}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingTidb ? 'animate-spin' : ''}`} />
              {syncingTidb ? 'กำลังซิงก์ TiDB...' : 'ซิงก์ผู้ใช้กับ TiDB Cloud'}
            </button>
            <button
              onClick={openCreateModal}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> เพิ่มผู้ใช้งานใหม่
            </button>
          </div>
        </div>

        {/* TiDB Cloud Status Card */}
        {tidbStatus && (
          <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-950 text-sm">
                      TiDB Cloud Cluster: FinalDIT205
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tidbStatus.connected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {tidbStatus.connected ? '● เชื่อมต่อแล้ว (Connected)' : '● รอตั้งค่ารหัสผ่าน / Local Fallback'}
                    </span>
                  </div>
                  <p className="text-indigo-800/80 mt-0.5 font-mono text-[11px]">
                    Host: {tidbStatus.host || '-'} | User:{' '}
                    {tidbStatus.user || '-'} | DB: {tidbStatus.database || 'dit205_db'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-indigo-900 font-semibold">
                  {tidbStatus.connected
                    ? `จัดเก็บใน TiDB แล้ว ${tidbStatus.count} บัญชี`
                    : tidbStatus.message}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-indigo-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="password"
                value={tidbPassword}
                onChange={(e) => setTidbPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน TiDB Cloud (จากปุ่ม Connect > Generate Password)"
                className="flex-1 px-3 py-2 rounded-xl border border-indigo-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSyncTidb}
                disabled={syncingTidb}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingTidb ? 'animate-spin' : ''}`} />
                {tidbPassword ? 'บันทึกรหัสผ่าน & ซิงก์ขึ้น TiDB' : 'ทดสอบเชื่อมต่อ & ซิงก์ TiDB'}
              </button>
            </div>
          </div>
        )}

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

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-base">บัญชีผู้ใช้งานทั้งหมด</h2>
            <span className="text-xs text-gray-500">รวม {users.length} บัญชี</span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-gray-500">กำลังโหลดรายการผู้ใช้งาน...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3 px-4">ชื่อ</th>
                    <th className="py-3 px-4">นามสกุล</th>
                    <th className="py-3 px-4">อีเมล</th>
                    <th className="py-3 px-4 text-center">บทบาท (RBAC)</th>
                    <th className="py-3 px-4">รหัสนักศึกษา / ทุน</th>
                    <th className="py-3 px-4">คณะ / สาขา</th>
                    <th className="py-3 px-4 text-center">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {u.firstName || u.name}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-700">
                        {u.lastName || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono">{u.email}</td>
                      <td className="py-3 px-4 text-center">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {u.role === 'student' ? (
                          <div>
                            <span className="font-mono font-medium">{u.studentId || '-'}</span>
                            <span className="text-[11px] text-gray-400 block truncate">
                              {(u as any).scholarshipName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div>{u.faculty || '-'}</div>
                        {u.major && <div className="text-[11px] text-gray-400">{u.major}</div>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="แก้ไขข้อมูลและบทบาท"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="ลบบัญชี"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Modal Create / Edit User */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-600" />
                  {editingId ? 'แก้ไขข้อมูลผู้ใช้และบทบาท' : 'เพิ่มบัญชีผู้ใช้ใหม่'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      ชื่อ *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      placeholder="กรอกชื่อ"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      นามสกุล *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      placeholder="กรอกนามสกุล"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      อีเมล *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="student@rsu.ac.th"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      รหัสผ่าน {editingId ? '(เว้นว่างหากไม่เปลี่ยน)' : '*'}
                    </label>
                    <input
                      type="password"
                      required={!editingId}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="กำหนดรหัสผ่าน"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      บทบาทผู้ใช้งาน (RBAC) *
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none font-semibold"
                    >
                      <option value="student">🎓 นักศึกษาทุน (Student)</option>
                      <option value="organizer">🏢 ผู้จัดกิจกรรม (Organizer)</option>
                      <option value="officer">📋 เจ้าหน้าที่ทุน (Officer)</option>
                      <option value="approver">✍️ ผู้อนุมัติ (Approver)</option>
                      <option value="admin">⚙️ ผู้ดูแลระบบ (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="08X-XXX-XXXX"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Additional fields for Student */}
                {form.role === 'student' && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                    <span className="text-xs font-bold text-emerald-900 block">
                      ข้อมูลเฉพาะสำหรับนักศึกษาทุน
                    </span>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        รหัสนักศึกษา (Student ID)
                      </label>
                      <input
                        type="text"
                        value={form.studentId}
                        onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                        placeholder="เช่น 6801457"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-semibold text-gray-700">
                          1. ทุนการศึกษาหลัก (เลือกได้อย่างใดอย่างหนึ่ง)
                        </label>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          รวมเป้าหมาย:{' '}
                          {scholarships
                            .filter((s) => (form.scholarshipTypeIds || []).includes(s.id))
                            .reduce((sum, s) => sum + s.targetHours, 0)}{' '}
                          ชม.
                        </span>
                      </div>
                      {(() => {
                        const isGys = (s: any) => s.id === 'sch-4' || (s.name && s.name.includes('กยศ'));
                        const mainList = scholarships.filter((s) => !isGys(s));
                        const gysItem = scholarships.find((s) => isGys(s));
                        const currentIds = form.scholarshipTypeIds || [];
                        const selectedMainId = mainList.find((s) => currentIds.includes(s.id))?.id || '';
                        const isGysSelected = gysItem ? currentIds.includes(gysItem.id) : false;

                        return (
                          <div className="space-y-3">
                            <select
                              value={selectedMainId}
                              onChange={(e) => {
                                const newMain = e.target.value;
                                const gysPart = gysItem && isGysSelected ? [gysItem.id] : [];
                                const next = newMain ? [newMain, ...gysPart] : [...gysPart];
                                setForm({
                                  ...form,
                                  scholarshipTypeIds: next,
                                  scholarshipTypeId: next[0] || '',
                                });
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">-- ไม่ได้รับทุนหลัก (เลือกเฉพาะ กยศ.) --</option>
                              {mainList.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.targetHours} ชม.)
                                </option>
                              ))}
                            </select>

                            {gysItem && (
                              <div>
                                <label className="block text-[11px] font-semibold text-indigo-900 mb-1">
                                  2. กองทุนเงินให้กู้ยืมเพื่อการศึกษา (กยศ.) — แยกเลือกเพิ่มเติมได้
                                </label>
                                <label
                                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                                    isGysSelected
                                      ? 'bg-indigo-100/80 border-indigo-500 text-indigo-950 font-medium shadow-xs'
                                      : 'bg-white border-gray-200 hover:border-indigo-300 text-gray-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isGysSelected}
                                    onChange={(e) => {
                                      const mainPart = selectedMainId ? [selectedMainId] : [];
                                      const next = e.target.checked
                                        ? [...mainPart, gysItem.id]
                                        : [...mainPart];
                                      setForm({
                                        ...form,
                                        scholarshipTypeIds: next,
                                        scholarshipTypeId: next[0] || '',
                                      });
                                    }}
                                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-semibold leading-tight">
                                      {gysItem.name} (+{gysItem.targetHours} ชม.)
                                    </div>
                                    <div className="text-[10px] text-indigo-700/80 mt-0.5">
                                      สามารถติ๊กเลือกควบคู่กับทุนหลักข้างต้น หรือเลือกเฉพาะ กยศ. ได้
                                    </div>
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      คณะ / วิทยาลัย / หน่วยงาน
                    </label>
                    <input
                      type="text"
                      value={form.faculty}
                      onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                      placeholder="กรอกคณะ / หน่วยงาน"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      สาขาวิชา
                    </label>
                    <input
                      type="text"
                      value={form.major}
                      onChange={(e) => setForm({ ...form, major: e.target.value })}
                      placeholder="กรอกสาขาวิชา"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {submitting ? 'กำลังบันทึก...' : 'บันทึกบัญชีผู้ใช้'}
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

