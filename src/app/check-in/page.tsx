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
    activityTitle?: string;
    isDuplicate?: boolean;
    attendance?: any;
  } | null>(null);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchRegistrations();
  }, [user, fetchRegistrations]);

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

  // Direct auto-detect check-in from ANY scanned activity QR Code (no dropdown needed)
  const executeCheckIn = useCallback(
    async (scannedPayload: string) => {
      let targetActId: string | undefined;
      let secretToSend = scannedPayload.trim();

      if (secretToSend.startsWith('{')) {
        try {
          const parsed = JSON.parse(secretToSend);
          if (parsed.activityId) targetActId = parsed.activityId;
          if (parsed.secret) secretToSend = parsed.secret;
        } catch {
          // use raw string
        }
      }

      if (!secretToSend && !targetActId) {
        setResult({
          success: false,
          message: 'QR Code ไม่ถูกต้อง กรุณาสแกน QR Code จากผู้จัดกิจกรรมหน้างาน',
        });
        scanLockRef.current = false;
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
            activityTitle: data.activityTitle,
            attendance: data.attendance,
          });
          fetchRegistrations();
        } else {
          setResult({
            success: false,
            message: data.error || 'ไม่สามารถสแกนเข้าร่วมกิจกรรมได้',
            activityTitle: data.activityTitle,
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
    [fetchRegistrations]
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
        'เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้ Chrome/Safari ผ่าน HTTPS หรืออัปโหลดรูปภาพ QR Code แทน'
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(async () => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          try {
            await videoRef.current.play();
            rafRef.current = requestAnimationFrame(scanFrame);
          } catch {
            setCameraError('ไม่สามารถเริ่มภาพจากกล้องได้ กรุณากดเปิดกล้องอีกครั้ง');
            stopCamera();
          }
        }
      }, 100);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraError('ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากดอนุญาตสิทธิ์กล้องในแถบที่อยู่แล้วลองใหม่');
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

  const pendingCheckInRegs = registrations.filter(
    (r) => r.status !== 'checked_in' && !r.attendance && r.hourRecord?.status !== 'approved'
  );

  return (
    <RoleGuard allowedRoles={['student', 'admin']}>
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
        {/* Hidden canvas & file input for QR decoding */}
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
            ส่องกล้องสแกน QR Code ของกิจกรรมไหนก็ได้ที่ลงทะเบียนไว้ ระบบจะระบุกิจกรรมและเช็กชื่อให้อัตโนมัติทันที
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

        {/* Direct QR Scanner Card (No Dropdown!) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
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
                    กดปุ่ม &ldquo;เปิดกล้องสแกน QR Code&rdquo; แล้วส่องไปที่ QR ของกิจกรรมที่เข้าร่วม
                  </p>
                </>
              )}
            </div>

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
            </div>
          </div>
        </div>

        {/* Read-only overview of registered activities waiting for scan */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              กิจกรรมที่รอสแกนเข้าร่วม ({pendingCheckInRegs.length})
            </h2>
            <Link
              href="/my-hours"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">กำลังโหลดรายการ...</div>
          ) : pendingCheckInRegs.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-center space-y-2">
              <p className="text-xs text-slate-500">
                {registrations.length === 0
                  ? 'คุณยังไม่ได้สมัครกิจกรรมใด กรุณาสมัครกิจกรรมก่อนสแกนเข้าร่วม'
                  : 'คุณสแกนเข้าร่วมครบทุกกิจกรรมที่ลงทะเบียนไว้แล้ว'}
              </p>
              {registrations.length === 0 && (
                <Link
                  href="/activities"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                >
                  ไปหน้าสมัครกิจกรรม <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pendingCheckInRegs.map((reg) => (
                <div
                  key={reg.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {reg.activity?.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        {reg.activity?.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        +{reg.activity?.hours} ชม.
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        {reg.activity?.location}
                      </span>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold whitespace-nowrap">
                    รอสแกน QR
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
