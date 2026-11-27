'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  HeartHandshake,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  ArrowRight,
  LogIn,
  Check,
} from 'lucide-react';
import { ScholarshipType } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [scholarships, setScholarships] = useState<ScholarshipType[]>([]);
  const [loadingScholarships, setLoadingScholarships] = useState(true);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    studentId: '',
    email: '',
    password: '',
    confirmPassword: '',
    scholarshipTypeIds: [] as string[],
    faculty: '',
    major: '',
    phone: '',
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchScholarships = async () => {
      try {
        const res = await fetch('/api/scholarships');
        if (res.ok) {
          const data = await res.json();
          setScholarships(data.scholarships || []);
          if (data.scholarships?.length > 0) {
            // Default select the first one
            setForm((prev) => ({
              ...prev,
              scholarshipTypeIds: [data.scholarships[0].id],
            }));
          }
        }
      } catch (e) {
        console.error('Failed to load scholarships', e);
      } finally {
        setLoadingScholarships(false);
      }
    };
    fetchScholarships();
  }, []);

  const isGys = (s: ScholarshipType) => s.id === 'sch-4' || s.name.includes('กยศ');
  const mainScholarships = scholarships.filter((s) => !isGys(s));
  const gysScholarship = scholarships.find((s) => isGys(s));

  const selectMainScholarship = (schId: string | null) => {
    setForm((prev) => {
      // Keep GYS if it was selected, replace main scholarship
      const gysIds = prev.scholarshipTypeIds.filter((id) => {
        const found = scholarships.find((s) => s.id === id);
        return found && isGys(found);
      });
      const updated = schId ? [schId, ...gysIds] : [...gysIds];
      return { ...prev, scholarshipTypeIds: updated };
    });
  };

  const toggleGysScholarship = (gysId: string) => {
    setForm((prev) => {
      const exists = prev.scholarshipTypeIds.includes(gysId);
      const updated = exists
        ? prev.scholarshipTypeIds.filter((id) => id !== gysId)
        : [...prev.scholarshipTypeIds, gysId];
      return { ...prev, scholarshipTypeIds: updated };
    });
  };

  const selectedScholarships = scholarships.filter((s) =>
    form.scholarshipTypeIds.includes(s.id)
  );
  const totalTargetHours = selectedScholarships.reduce((sum, s) => sum + s.targetHours, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (form.password.length < 4) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (form.scholarshipTypeIds.length === 0) {
      setError('กรุณาเลือกประเภททุนการศึกษาที่ได้รับอย่างน้อย 1 ทุน (สามารถเลือกได้มากกว่า 1)');
      return;
    }

    setLoading(true);

    const res = await register({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      studentId: form.studentId,
      email: form.email,
      password: form.password,
      scholarshipTypeIds: form.scholarshipTypeIds,
      scholarshipTypeId: form.scholarshipTypeIds[0],
      faculty: form.faculty,
      major: form.major,
      phone: form.phone,
    });

    setLoading(false);

    if (res.success) {
      setSuccessMsg('ลงทะเบียนสำเร็จ! กำลังนำท่านเข้าสู่ระบบนักศึกษาทุน...');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else {
      setError(res.error || 'การลงทะเบียนล้มเหลว');
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-6 sm:my-8">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700 p-6 sm:p-8 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-inner">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">สมัครสมาชิกนักศึกษาทุน</h1>
          <p className="text-xs text-emerald-100 mt-1 max-w-md mx-auto">
            ลงทะเบียนเพื่อเริ่มต้นติดตามและสะสมชั่วโมงจิตอาสา รองรับการเลือกทุนการศึกษาได้มากกว่า 1 ประเภท
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider">เกิดข้อผิดพลาด</p>
                <p className="text-xs mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
              <span className="text-xs font-semibold">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name and Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  ชื่อ *
                </label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="กรอกชื่อ"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  นามสกุล *
                </label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="กรอกนามสกุล"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>
            </div>

            {/* Student ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                รหัสนักศึกษา *
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                placeholder="กรอกรหัสนักศึกษา"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-mono transition"
              />
            </div>

            {/* Email and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  อีเมล (Email) *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="กรอกอีเมล"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  เบอร์โทรศัพท์ติดต่อ
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="กรอกเบอร์โทรศัพท์"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>
            </div>

            {/* Scholarship Selector: แยกทุนหลัก (เลือกได้ 1 ทุน) และ ทุน กยศ. (ติ๊กเลือกแยกได้) */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    1. เลือกประเภททุนการศึกษาหลัก (เลือกได้อย่างใดอย่างหนึ่ง)
                  </label>
                  <p className="text-[11px] text-emerald-700">
                    เลือกทุนเรียนดีหรือทุนหลักเพียง 1 ทุน (หากกู้เฉพาะ กยศ. ให้เลือก &ldquo;ไม่ได้รับทุนหลัก&rdquo;)
                  </p>
                </div>
                {totalTargetHours > 0 && (
                  <span className="self-start sm:self-auto text-xs bg-emerald-700 text-white font-bold px-3 py-1 rounded-full shadow-xs">
                    เป้าหมายรวม: {totalTargetHours} ชม./ปี
                  </span>
                )}
              </div>

              {loadingScholarships ? (
                <div className="text-xs text-gray-400 py-3 text-center">กำลังโหลดประเภททุน...</div>
              ) : (
                <>
                  {/* Main Scholarships (Radio - Single Choice) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {mainScholarships.map((sch) => {
                      const isSelected = form.scholarshipTypeIds.includes(sch.id);
                      return (
                        <div
                          key={sch.id}
                          onClick={() => selectMainScholarship(isSelected ? null : sch.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                            isSelected
                              ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white/70 border-gray-200 hover:bg-white hover:border-emerald-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-gray-900 truncate">
                                {sch.name}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-md">
                                {sch.targetHours} ชม.
                              </span>
                            </div>
                            {sch.description && (
                              <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                {sch.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Option: No Main Scholarship (GYS only) */}
                    {(() => {
                      const hasMainSelected = mainScholarships.some((s) =>
                        form.scholarshipTypeIds.includes(s.id)
                      );
                      return (
                        <div
                          onClick={() => selectMainScholarship(null)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                            !hasMainSelected
                              ? 'bg-white border-slate-500 ring-2 ring-slate-400/20 shadow-xs'
                              : 'bg-white/70 border-gray-200 hover:bg-white hover:border-gray-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                              !hasMainSelected
                                ? 'border-slate-600 bg-slate-600 text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {!hasMainSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-gray-700 block">
                              ไม่ได้รับทุนหลัก (เลือกเฉพาะ กยศ.)
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              สำหรับนักศึกษาที่กู้ยืม กยศ. เพียงอย่างเดียว
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Separated GYS Section (Checkbox - Can be combined with any main scholarship) */}
                  {gysScholarship && (
                    <div className="pt-3 border-t border-emerald-200/80">
                      <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider mb-1.5">
                        2. กองทุนเงินให้กู้ยืมเพื่อการศึกษา (กยศ.) — แยกเลือกเพิ่มเติมได้
                      </label>
                      {(() => {
                        const isGysSelected = form.scholarshipTypeIds.includes(gysScholarship.id);
                        return (
                          <div
                            onClick={() => toggleGysScholarship(gysScholarship.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 select-none ${
                              isGysSelected
                                ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white/80 border-indigo-200 hover:bg-white hover:border-indigo-400'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                                isGysSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isGysSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-indigo-950">
                                  {gysScholarship.name}
                                </span>
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                                  +{gysScholarship.targetHours} ชม.
                                </span>
                              </div>
                              <p className="text-[11px] text-indigo-700/80 mt-0.5">
                                ติ๊กเลือกช่องนี้หากท่านเป็นผู้กู้ยืม กยศ. (สามารถเลือกควบคู่กับทุนเรียนดีข้างต้น หรือเลือกเฉพาะ กยศ. อย่างเดียวได้)
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {selectedScholarships.length > 0 ? (
                <div className="text-[11px] text-emerald-800 bg-white/90 p-2.5 rounded-xl border border-emerald-200/80">
                  <span className="font-semibold">ทุนที่เลือก:</span>{' '}
                  {selectedScholarships.map((s) => `${s.name} (${s.targetHours} ชม.)`).join(' + ')}{' '}
                  = <strong>{totalTargetHours} ชั่วโมงเป้าหมาย</strong>
                </div>
              ) : (
                <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  ⚠️ กรุณาเลือกทุนการศึกษาหลัก 1 ทุน หรือติ๊กเลือกทุน กยศ. อย่างน้อย 1 รายการ
                </div>
              )}
            </div>

            {/* Faculty & Major */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  คณะ / วิทยาลัย *
                </label>
                <input
                  type="text"
                  required
                  value={form.faculty}
                  onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                  placeholder="กรอกคณะ / วิทยาลัย"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  สาขาวิชา *
                </label>
                <input
                  type="text"
                  required
                  value={form.major}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                  placeholder="กรอกสาขาวิชา"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm transition"
                />
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  รหัสผ่าน (Password) *
                </label>
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="กำหนดรหัสผ่าน"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  ยืนยันรหัสผ่านอีกครั้ง *
                </label>
                <input
                  type="password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="พิมพ์รหัสผ่านเดิมซ้ำ"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  กำลังลงทะเบียน...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> ยืนยันการลงทะเบียนนักศึกษาใหม่
                </>
              )}
            </button>
          </form>

          {/* Already have an account link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              มีบัญชีผู้ใช้งานอยู่ในระบบแล้วใช่หรือไม่?{' '}
              <Link
                href="/login"
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 ml-1"
              >
                เข้าสู่ระบบที่นี่ <ArrowRight className="w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
