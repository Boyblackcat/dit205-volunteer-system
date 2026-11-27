'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Role } from '@/types';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">กำลังตรวจสอบสิทธิ์การใช้งาน...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-7 bg-white rounded-3xl shadow-sm border border-slate-200 text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">กรุณาเข้าสู่ระบบ</h2>
        <p className="text-sm text-slate-600 mb-5">
          ท่านจำเป็นต้องเข้าสู่ระบบก่อนเข้าถึงหน้านี้
        </p>
        <Link
          href="/login"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
        >
          ไปที่หน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  // Admin has full access to all role features
  if (user.role !== 'admin' && !allowedRoles.includes(user.role)) {
    const roleNames: Record<Role, string> = {
      student: 'นักศึกษาทุน',
      organizer: 'ผู้จัดกิจกรรม',
      officer: 'เจ้าหน้าที่ดูแลทุน',
      approver: 'ผู้อนุมัติ',
      admin: 'ผู้ดูแลระบบ',
    };

    const allowedNames = allowedRoles.map((r) => roleNames[r]).join(' หรือ ');

    return (
      <div className="max-w-lg mx-auto my-12 p-8 bg-white rounded-3xl shadow-sm border border-rose-200 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-4">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          ไม่มีสิทธิ์เข้าถึงหน้านี้
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          บัญชีปัจจุบันของคุณคือ <strong>{user.name}</strong> ({roleNames[user.role]})
        </p>
        <p className="text-xs text-slate-500 mb-6 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          หน้านี้อนุญาตเฉพาะผู้ใช้งานในบทบาท: <strong>{allowedNames}</strong> เท่านั้น
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> กลับสู่หน้าหลัก
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
