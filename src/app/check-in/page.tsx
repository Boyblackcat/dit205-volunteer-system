'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Camera,
  CameraOff,
  Calendar,
  MapPin,
  ArrowRight,
  Clock,
  SwitchCamera,
  ImagePlus,
} from 'lucide-react';

export default function CheckInPage() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Real camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanLockRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    isDuplicate?: boolean;
    attendance?: any;
  } | null>(null);

  const fetchRegistrations = async () => {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        const regs = data.registrations || [];
        setRegistrations(regs);
        if (regs.length > 0 && !selectedActivityId) {
          const firstUnchecked = regs.find((r: any) => r.status !== 'checked_in');
          setSelectedActivityId((firstUnchecked || regs[0]).activityId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [user]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const executeCheckIn = useCallback(
    async (scannedPayload: string, overrideActivityId?: string) => {
      let targetActId = overrideActivityId || selectedActivityId;
      let secretToSend = scannedPayload;

      // Parse JSON QR Code from Organizer
      if (scannedPayload.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(scannedPayload);
          if (parsed.activityId) {
            targetActId = parsed.activityId;
            setSelectedActivityId(parsed.activityId);
          }
          if (parsed.secret) {
            secretToSend = parsed.secret;
          }
        } catch {
          // use raw string
        }
      }

      if (!targetActId) {
        setResult({ success: false, message: 'กรุณาเลือกกิจกรรมที่ต้องการสแกนเข้าร่วม' });
        return;
      }

      setSubmitting(true);
      setResult(null);

      try {
        const res = await fetch('/api/attendance/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: targetActId,
            qrSecret: secretToSend,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          setResult({
            success: true,
            message: data.message || 'สแกนเข้าร่วมกิจกรรมสำเร็จเรียบร้อยแล้ว',
            attendance: data.attendance,
          });
          fetchRegistrations();
        } else {
          setResult({
            success: false,
            message: data.error || 'ไม่สามารถสแกนเข้าร่วมกิจกรรมได้',
            isDuplicate: data.alreadyCheckedIn,
          });
        }
      } catch {
        setResult({ success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' });
      } finally {
        setSubmitting(false);
        scanLockRef.current = false;
      }
    },
    [selectedActivityId]
  );

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data && !scanLockRef.current) {
            scanLockRef.current = true;
            stopCamera();
            executeCheckIn(code.data);
            return;
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }, [executeCheckIn, stopCamera]);

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setResult(null);
    scanLockRef.current = false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง หรือไม่ได้เข้าผ่าน HTTPS/localhost กรุณาลองใช้ Chrome/Safari หรืออัปโหลดรูปภาพ QR Code แทน'
      );
      return;
    }

    stopCamera();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback to any available webcam (e.g. PC without rear camera)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);

      // Attach stream after render
      setTimeout(async () => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          try {
            await videoRef.current.play();
            rafRef.current = requestAnimationFrame(scanFrame);
          } catch (playErr) {
            console.error('Video play error:', playErr);
            setCameraError('ไม่สามารถเริ่มภาพจากกล้องได้ กรุณากดเปิดกล้องอีกครั้ง');
            stopCamera();
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดอนุญาตสิทธิ์กล้องในแถบที่อยู่ของเบราว์เซอร์แล้วลองใหม่');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setCameraError('ไม่พบอุปกรณ์กล้องบนเครื่องนี้ คุณสามารถใช้ปุ่ม "อัปโหลดรูปภาพ QR Code" ด้านล่างแทนได้');
      } else {
        setCameraError(`ไม่สามารถเปิดกล้องได้ (${err?.message || 'กรุณาตรวจสอบสิทธิ์กล้อง'})`);
      }
      setCameraActive(false);
    }
  };

  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, img.width, img.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          executeCheckIn(code.data);
        } else {
          setResult({
            success: false,
            message: 'ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาเลือกรูปภาพ QR Code กิจกรรมที่ชัดเจน',
          });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleActivitySelect = (actId: string) => {
    setSelectedActivityId(actId);
    setResult(null);
    setCameraError(null);
  };

  const selectedRegistration = registrations.find(
    (r) => r.activityId === selectedActivityId
  );
  const isApproved = selectedRegistration?.hourRecord?.status === 'approved';
  const isAlreadyCheckedIn = selectedRegistration?.status === 'checked_in' || Boolean(selectedRegistration?.attendance);

  return (
    <RoleGuard allowedRoles={['student', 'admin']}>
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
        {/* Hidden canvas for QR decoding */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleQrImageUpload}
          className="hidden"
        />

        {/* Header */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5" />
            </span>
            สแกนเข้าร่วมกิจกรรม
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
            เปิดกล้องสแกน QR Code จากผู้จัดกิจกรรมหน้างาน หรืออัปโหลดภาพ QR Code เพื่อบันทึกเวลาเข้าร่วมกิจกรรม
          </p>
        </div>

        {/* Status / Alert Result */}
        {result && (
          <div
            className={`p-4 sm:p-5 rounded-3xl border shadow-xs ${
              result.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : result.isDuplicate
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : result.isDuplicate ? (
                <ShieldCheck className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">
                  {result.success
                    ? 'สแกนเข้าร่วมกิจกรรมสำเร็จ!'
                    : result.isDuplicate
                    ? 'คุณได้สแกนเข้าร่วมกิจกรรมนี้ไปแล้ว'
                    : 'ไม่สามารถสแกนเข้าร่วมกิจกรรมได้'}
                </p>
                <p className="text-xs mt-1">{result.message}</p>
                {result.attendance && (
                  <p className="text-[11px] text-emerald-700 mt-2 font-mono">
                    เวลาบันทึก: {new Date(result.attendance.checkInTime).toLocaleString('th-TH')}
                  </p>
                )}
                {result.success && (
                  <Link
                    href="/my-hours"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    ไปแนบรูปหลักฐานรับชั่วโมง <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Camera Error */}
        {cameraError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Main Scanner Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Activity Picker Header */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-wider block mb-1">
                  กิจกรรมที่ลงทะเบียนไว้
                </span>
                <h2 className="text-base sm:text-lg font-bold leading-snug">
                  {selectedRegistration?.activity?.title || 'ยังไม่มีกิจกรรมที่สมัคร'}
                </h2>
              </div>
              {isApproved ? (
                <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto flex-shrink-0">
                  ✓ เข้าร่วมไปแล้ว (อนุมัติชั่วโมงแล้ว)
                </span>
              ) : isAlreadyCheckedIn ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto flex-shrink-0">
                  ✓ สแกนเข้าร่วมแล้ว
                </span>
              ) : null}
            </div>

            {selectedRegistration?.activity && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {selectedRegistration.activity.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  +{selectedRegistration.activity.hours} ชม.
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  {selectedRegistration.activity.location}
                </span>
              </div>
            )}

            {registrations.length > 0 && (
              <div>
                <select
                  value={selectedActivityId}
                  onChange={(e) => handleActivitySelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {registrations.map((reg) => {
                    const regApproved = reg.hourRecord?.status === 'approved';
                    const regChecked = reg.status === 'checked_in' || Boolean(reg.attendance);
                    return (
                      <option key={reg.activityId} value={reg.activityId}>
                        {reg.activity?.title} (+{reg.activity?.hours} ชม.) —{' '}
                        {regApproved
                          ? '✓ เข้าร่วมไปแล้ว (อนุมัติแล้ว)'
                          : regChecked
                          ? '✓ สแกนเข้าร่วมแล้ว'
                          : 'รอสแกนเข้าร่วม'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Scanner Body */}
          <div className="p-5 sm:p-8">
            {loading ? (
              <div className="text-center py-10">
                <div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
                <p className="text-xs text-slate-500">กำลังโหลดข้อมูลกิจกรรม...</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  คุณยังไม่ได้สมัครกิจกรรมใด
                </p>
                <p className="text-xs text-slate-500">
                  กรุณาสมัครกิจกรรมก่อนจึงจะสามารถสแกนเข้าร่วมกิจกรรมได้
                </p>
                <Link
                  href="/activities"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition"
                >
                  ไปหน้าสมัครกิจกรรม <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-5 text-center max-w-sm mx-auto">
                {/* Real Camera Viewfinder */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto bg-slate-950 rounded-3xl border-4 border-emerald-500/80 flex flex-col items-center justify-center overflow-hidden shadow-inner">
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                      {/* Scanning Reticle Overlay */}
                      <div className="absolute inset-6 border-2 border-emerald-400/90 rounded-2xl pointer-events-none">
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#22c55e] animate-pulse" />
                      </div>
                      <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/80 text-emerald-300 text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        กำลังสแกน QR Code...
                      </span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500/60 mb-2.5" />
                      <p className="text-xs text-emerald-300 font-semibold px-5 leading-relaxed">
                        {isApproved
                          ? 'เข้าร่วมและได้รับการอนุมัติชั่วโมงแล้ว'
                          : isAlreadyCheckedIn
                          ? 'บันทึกการสแกนเข้าร่วมเรียบร้อยแล้ว'
                          : 'กดปุ่ม "เปิดกล้องสแกน QR Code" เพื่อสแกนกล้องจริง'}
                      </p>
                    </>
                  )}
                </div>

                {isApproved ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold">
                    ✓ คุณเข้าร่วมกิจกรรมนี้และได้รับอนุมัติชั่วโมงเรียบร้อยแล้ว
                  </div>
                ) : isAlreadyCheckedIn ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold">
                      ✓ คุณได้สแกนเข้าร่วมกิจกรรมนี้เรียบร้อยแล้ว
                    </div>
                    <Link
                      href="/my-hours"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-4 rounded-2xl shadow-xs transition text-sm flex items-center justify-center gap-2"
                    >
                      ไปแนบรูปหลักฐานรับชั่วโมง <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {!cameraActive ? (
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        disabled={submitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-3.5 px-5 rounded-2xl shadow-md transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Camera className="w-5 h-5" />
                        {submitting ? 'กำลังบันทึกการเข้าร่วม...' : 'เปิดกล้องสแกน QR Code'}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={handleSwitchCamera}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-3 px-4 rounded-2xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5"
                        >
                          <SwitchCamera className="w-4 h-4" /> สลับกล้อง
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-3 px-4 rounded-2xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5"
                        >
                          <CameraOff className="w-4 h-4" /> ปิดกล้อง
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting}
                      className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold py-3 px-4 rounded-2xl transition text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ImagePlus className="w-4 h-4 text-emerald-600" />
                      อัปโหลดรูปภาพ QR Code จากเครื่อง
                    </button>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                      ส่องกล้องไปที่ QR Code ที่ผู้จัดกิจกรรมแสดงไว้ ระบบจะอ่านรหัสและบันทึกการเข้าร่วมให้อัตโนมัติทันที
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
