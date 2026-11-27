'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Role } from '@/types';
import {
  HeartHandshake,
  Calendar,
  Award,
  CheckCircle2,
  Users,
  LogOut,
  ChevronDown,
  ClipboardList,
  BarChart3,
  UserPlus,
  LogIn,
  Menu,
  X,
  QrCode,
  FileCheck,
  ShieldCheck,
  FileText,
  User,
  Home,
  GraduationCap,
  Sun,
  Moon,
  LayoutGrid,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [adminMoreOpen, setAdminMoreOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const adminMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (adminMoreRef.current && !adminMoreRef.current.contains(event.target as Node)) {
        setAdminMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
    setAdminMoreOpen(false);
  }, [pathname]);

  const getRoleBadge = (role?: Role) => {
    switch (role) {
      case 'student':
        return { label: 'นักศึกษาทุน', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
      case 'organizer':
        return { label: 'ผู้จัดกิจกรรม', color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' };
      case 'officer':
        return { label: 'เจ้าหน้าที่ดูแลทุน', color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
      case 'approver':
        return { label: 'ผู้อนุมัติ', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' };
      case 'admin':
        return { label: 'ผู้ดูแลระบบ', color: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' };
      default:
        return { label: 'ผู้เยี่ยมชม', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' };
    }
  };

  const badge = getRoleBadge(user?.role);

  const navLinkClass = (active: boolean, activeBg = 'bg-emerald-600 text-white shadow-xs') =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
      active ? activeBg : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const isAdminMoreActive =
    pathname === '/approver/activities' ||
    pathname === '/approver/reports' ||
    pathname === '/admin/logs';

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-3">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <Link href="/" className="flex items-center gap-2 group min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors block leading-tight truncate">
                  ระบบหาชั่วโมงทุน
                </span>
                <span className="hidden sm:block text-[10px] text-slate-400 leading-none mt-0.5 truncate">
                  DIT มหาวิทยาลัยรังสิต
                </span>
              </div>
            </Link>

            {/* Desktop Menu by Role (No horizontal slide) */}
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                <Link href="/" className={navLinkClass(pathname === '/')}>
                  <Home className="w-4 h-4 flex-shrink-0" />
                  <span>หน้าหลัก</span>
                </Link>

              {user?.role === 'student' && (
                <>
                  <Link href="/activities" className={navLinkClass(pathname === '/activities')}>
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>สมัครกิจกรรม</span>
                  </Link>
                  <Link href="/my-hours" className={navLinkClass(pathname === '/my-hours')}>
                    <ClipboardList className="w-4 h-4 flex-shrink-0" />
                    <span>กิจกรรมของฉัน</span>
                  </Link>
                  <Link href="/check-in" className={navLinkClass(pathname === '/check-in')}>
                    <QrCode className="w-4 h-4 flex-shrink-0" />
                    <span>สแกนเข้าร่วม</span>
                  </Link>
                  <Link href="/profile" className={navLinkClass(pathname === '/profile')}>
                    <GraduationCap className="w-4 h-4 flex-shrink-0" />
                    <span>โปรไฟล์ & ทุน</span>
                  </Link>
                </>
              )}

              {user?.role === 'organizer' && (
                <Link
                  href="/organizer/activities"
                  className={navLinkClass(pathname.startsWith('/organizer'), 'bg-blue-600 text-white shadow-xs')}
                >
                  <QrCode className="w-4 h-4 flex-shrink-0" />
                  <span>จัดการกิจกรรม & QR</span>
                </Link>
              )}

              {user?.role === 'officer' && (
                <>
                  <Link
                    href="/officer/verify"
                    className={navLinkClass(pathname === '/officer/verify', 'bg-amber-600 text-white shadow-xs')}
                  >
                    <FileCheck className="w-4 h-4 flex-shrink-0" />
                    <span>ตรวจอนุมัติชั่วโมง</span>
                  </Link>
                  <Link
                    href="/officer/scholarships"
                    className={navLinkClass(pathname === '/officer/scholarships', 'bg-amber-600 text-white shadow-xs')}
                  >
                    <GraduationCap className="w-4 h-4 flex-shrink-0" />
                    <span>จัดการทุน & คำขอ</span>
                  </Link>
                  <Link
                    href="/approver/reports"
                    className={navLinkClass(pathname === '/approver/reports', 'bg-amber-600 text-white shadow-xs')}
                  >
                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                    <span>รายงาน</span>
                  </Link>
                </>
              )}

              {user?.role === 'approver' && (
                <>
                  <Link
                    href="/approver/activities"
                    className={navLinkClass(pathname === '/approver/activities', 'bg-purple-600 text-white shadow-xs')}
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span>อนุมัติกิจกรรม</span>
                  </Link>
                  <Link
                    href="/officer/verify"
                    className={navLinkClass(pathname === '/officer/verify', 'bg-purple-600 text-white shadow-xs')}
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>รับรองชั่วโมง</span>
                  </Link>
                  <Link
                    href="/approver/reports"
                    className={navLinkClass(pathname === '/approver/reports', 'bg-purple-600 text-white shadow-xs')}
                  >
                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                    <span>รายงาน</span>
                  </Link>
                </>
              )}

              {user?.role === 'admin' && (
                <>
                  <Link
                    href="/admin/users"
                    className={navLinkClass(pathname === '/admin/users', 'bg-rose-600 text-white shadow-xs')}
                  >
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>ผู้ใช้</span>
                  </Link>
                  <Link
                    href="/organizer/activities"
                    className={navLinkClass(pathname.startsWith('/organizer'), 'bg-rose-600 text-white shadow-xs')}
                  >
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>กิจกรรม</span>
                  </Link>
                  <Link
                    href="/officer/verify"
                    className={navLinkClass(pathname === '/officer/verify', 'bg-rose-600 text-white shadow-xs')}
                  >
                    <FileCheck className="w-4 h-4 flex-shrink-0" />
                    <span>ตรวจชม.</span>
                  </Link>
                  <Link
                    href="/officer/scholarships"
                    className={navLinkClass(pathname === '/officer/scholarships', 'bg-rose-600 text-white shadow-xs')}
                  >
                    <Award className="w-4 h-4 flex-shrink-0" />
                    <span>ทุน & คำขอ</span>
                  </Link>

                  {/* Clean Dropdown for Additional Admin Tools */}
                  <div className="relative" ref={adminMoreRef}>
                    <button
                      type="button"
                      onClick={() => setAdminMoreOpen(!adminMoreOpen)}
                      className={navLinkClass(isAdminMoreActive, 'bg-rose-600 text-white shadow-xs')}
                    >
                      <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                      <span>เพิ่มเติม</span>
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>

                    {adminMoreOpen && (
                      <div className="absolute left-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-1.5 z-50 text-xs space-y-1">
                        <Link
                          href="/approver/activities"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-rose-50 hover:text-rose-700 font-medium transition"
                        >
                          <ShieldCheck className="w-4 h-4 text-purple-600" />
                          <span>อนุมัติกิจกรรม</span>
                        </Link>
                        <Link
                          href="/approver/reports"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-rose-50 hover:text-rose-700 font-medium transition"
                        >
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          <span>รายงานสรุปผล</span>
                        </Link>
                        <Link
                          href="/admin/logs"
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-rose-50 hover:text-rose-700 font-medium transition"
                        >
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span>ประวัติระบบ (Logs)</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
              </nav>
            )}
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-300 transition flex items-center justify-center flex-shrink-0"
              title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
              aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Guest vs Logged-in Profile */}
            {!user ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4 flex-shrink-0" />
                  <span>เข้าสู่ระบบ</span>
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4 flex-shrink-0" />
                  <span>สมัครสมาชิก</span>
                </Link>
              </div>
            ) : (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-2xl hover:bg-slate-100 transition border border-slate-200/70 bg-white whitespace-nowrap"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-bold flex items-center justify-center text-xs shadow-2xs flex-shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-tight max-w-[130px] truncate">
                      {user.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dot}`} />
                      <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block flex-shrink-0" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                      <p className="font-bold text-sm text-slate-900 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{user.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.color}`}>
                          {badge.label}
                        </span>
                        {user.studentId && (
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-slate-200 font-mono text-slate-600 whitespace-nowrap">
                            รหัส: {user.studentId}
                          </span>
                        )}
                      </div>
                      {user.scholarshipName && (
                        <div className="text-[11px] text-emerald-800 font-medium mt-2 pt-2 border-t border-slate-200/60">
                          🎓 {user.scholarshipName}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition font-medium whitespace-nowrap"
                      >
                        <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>โปรไฟล์ & ขอแก้ไขประเภททุน</span>
                      </Link>

                      {user.role === 'student' && (
                        <>
                          <Link
                            href="/my-hours"
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition font-medium whitespace-nowrap"
                          >
                            <ClipboardList className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>กิจกรรมของฉัน & แนบหลักฐาน</span>
                          </Link>
                          <Link
                            href="/check-in"
                            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition font-medium whitespace-nowrap"
                          >
                            <QrCode className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span>สแกนเข้าร่วมกิจกรรม</span>
                          </Link>
                        </>
                      )}

                      <button
                        onClick={logout}
                        className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition font-medium flex items-center gap-2 pt-2 border-t border-slate-100 whitespace-nowrap"
                      >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          {user && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <p className="font-bold text-sm text-slate-900 truncate">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
              <Link
                href="/profile"
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-2xs whitespace-nowrap"
              >
                โปรไฟล์/ทุน
              </Link>
            </div>
          )}

          <div className="flex flex-col space-y-1 text-sm font-medium">
            {user && (
              <Link href="/" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                🏠 หน้าหลัก
              </Link>
            )}

            {!user && (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="w-full py-2.5 text-center bg-slate-100 text-slate-800 rounded-xl font-semibold"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/register"
                  className="w-full py-2.5 text-center bg-emerald-600 text-white rounded-xl font-semibold"
                >
                  สมัครสมาชิกนักศึกษาทุน
                </Link>
              </div>
            )}

            {user?.role === 'student' && (
              <>
                <Link href="/activities" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  🔍 สมัครกิจกรรม
                </Link>
                <Link href="/my-hours" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📋 กิจกรรมของฉัน
                </Link>
                <Link href="/check-in" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📷 สแกนเข้าร่วมกิจกรรม
                </Link>
                <Link href="/profile" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  🎓 โปรไฟล์ & ขอแก้ไขทุน
                </Link>
              </>
            )}

            {user?.role === 'organizer' && (
              <Link href="/organizer/activities" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                🏢 จัดการกิจกรรม & QR
              </Link>
            )}

            {user?.role === 'officer' && (
              <>
                <Link href="/officer/verify" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  ✅ ตรวจอนุมัติชั่วโมง
                </Link>
                <Link href="/officer/scholarships" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  🎓 จัดการทุน & คำขอเปลี่ยนทุน
                </Link>
                <Link href="/approver/reports" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📊 รายงาน
                </Link>
              </>
            )}

            {user?.role === 'approver' && (
              <>
                <Link href="/approver/activities" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  ✍️ อนุมัติกิจกรรม
                </Link>
                <Link href="/officer/verify" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  ✅ รับรองชั่วโมง
                </Link>
                <Link href="/approver/reports" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📊 รายงาน
                </Link>
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <Link href="/admin/users" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  👥 ผู้ใช้ & TiDB
                </Link>
                <Link href="/organizer/activities" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  🏢 จัดการกิจกรรม & QR
                </Link>
                <Link href="/approver/activities" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  ✍️ อนุมัติกิจกรรม
                </Link>
                <Link href="/officer/verify" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  ✅ ตรวจอนุมัติชั่วโมง
                </Link>
                <Link href="/officer/scholarships" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  🎓 จัดการทุน & คำขอเปลี่ยนทุน
                </Link>
                <Link href="/approver/reports" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📊 รายงานสรุปผล
                </Link>
                <Link href="/admin/logs" className="px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100">
                  📑 ประวัติระบบ (Audit Logs)
                </Link>
              </>
            )}

            {user && (
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2.5 text-rose-600 font-semibold hover:bg-rose-50 rounded-xl transition flex items-center gap-2 pt-3 border-t border-slate-100"
              >
                <LogOut className="w-4 h-4" /> ออกจากระบบ
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
