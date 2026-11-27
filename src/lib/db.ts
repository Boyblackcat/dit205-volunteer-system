import fs from 'fs';
import path from 'path';
import os from 'os';
import { storeDataUrlSync } from '@/lib/mediaStore';
import { loadAppStateFromTiDB, saveAppStateToTiDB } from '@/lib/tidb';
import {
  User,
  ScholarshipType,
  Activity,
  Registration,
  Attendance,
  Evidence,
  HourRecord,
  AuditLog,
  SystemSettings,
  ScholarshipChangeRequest,
} from '@/types';

interface DatabaseSchema {
  users: User[];
  scholarshipTypes: ScholarshipType[];
  activities: Activity[];
  registrations: Registration[];
  attendances: Attendance[];
  evidence: Evidence[];
  hourRecords: HourRecord[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  scholarshipRequests?: ScholarshipChangeRequest[];
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const BUNDLED_DATA_DIR = path.join(process.cwd(), 'data');
const BUNDLED_DB_FILE = path.join(BUNDLED_DATA_DIR, 'db.json');
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'dit205-data') : BUNDLED_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cachedDb: DatabaseSchema | null = null;
let cachedMtimeMs = 0;
let lastTiDBSyncMs = 0;

const INITIAL_SCHOLARSHIPS: ScholarshipType[] = [
  {
    id: 'sch-1',
    name: 'ทุนเรียนดี 100%',
    description: 'ทุนการศึกษาผลการเรียนดีเด่นระดับร้อยละ 100% ตามเงื่อนไขของหน่วยงาน',
    targetHours: 100,
    academicYear: '2569',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sch-2',
    name: 'ทุนเรียนดี 50%',
    description: 'ทุนการศึกษาผลการเรียนดีระดับร้อยละ 50% ตามเงื่อนไขของหน่วยงาน',
    targetHours: 50,
    academicYear: '2569',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sch-3',
    name: 'ทุนเรียนดี 25%',
    description: 'ทุนการศึกษาผลการเรียนดีระดับร้อยละ 25% ตามเงื่อนไขของหน่วยงาน',
    targetHours: 25,
    academicYear: '2569',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sch-4',
    name: 'ทุน กยศ. (กองทุนเงินให้กู้ยืมเพื่อการศึกษา)',
    description: 'ทุนกู้ยืมเพื่อการศึกษา กยศ. เงื่อนไขสะสมชั่วโมงจิตอาสา 18 ชั่วโมง (สามารถเลือกควบคู่กับทุนอื่นได้)',
    targetHours: 18,
    academicYear: '2569',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function splitFullName(
  fullName?: string,
  firstName?: string,
  lastName?: string
): { firstName: string; lastName: string } {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  if (f || l) return { firstName: f, lastName: l };
  const raw = (fullName ?? '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function composeFullName(
  firstName?: string,
  lastName?: string,
  fallbackName?: string
): string {
  const f = (firstName ?? '').trim();
  const l = (lastName ?? '').trim();
  const joined = [f, l].filter(Boolean).join(' ').trim();
  return joined || (fallbackName ?? '').trim();
}

export function isGysScholarship(s: { id: string; name: string }): boolean {
  return s.id === 'sch-4' || s.name.includes('กยศ');
}

export function validateScholarshipSelection(
  selectedIds: string[],
  allScholarships: ScholarshipType[]
): { valid: boolean; error?: string; validScholarships: ScholarshipType[]; targetHours: number } {
  const uniqueIds = Array.from(new Set(selectedIds.filter(Boolean)));
  const validScholarships = allScholarships.filter((s) => uniqueIds.includes(s.id));

  if (validScholarships.length === 0) {
    return {
      valid: false,
      error: 'กรุณาเลือกประเภททุนการศึกษาอย่างน้อย 1 ทุน (ทุนหลัก หรือ ทุน กยศ.)',
      validScholarships: [],
      targetHours: 0,
    };
  }

  const mainScholarships = validScholarships.filter((s) => !isGysScholarship(s));
  if (mainScholarships.length > 1) {
    return {
      valid: false,
      error: 'ทุนการศึกษาหลักสามารถเลือกได้เพียงอย่างใดอย่างหนึ่ง (1 ทุน) เท่านั้น ส่วนทุน กยศ. สามารถเลือกเพิ่มเติมแยกต่างหากได้',
      validScholarships,
      targetHours: 0,
    };
  }

  const targetHours = validScholarships.reduce((sum, s) => sum + s.targetHours, 0);
  return {
    valid: true,
    validScholarships,
    targetHours,
  };
}

const INITIAL_USERS: User[] = [];

const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    title: 'โครงการปลูกป่าชายเลนและเก็บขยะอนุรักษ์สิ่งแวดล้อม',
    description: 'ร่วมฟื้นฟูระบบนิเวศป่าชายเลน ปลูกต้นโกงกาง 300 ต้น และเก็บขยะบริเวณชายฝั่ง เพื่ออนุรักษ์ธรรมชาติอย่างยั่งยืน',
    category: 'อนุรักษ์สิ่งแวดล้อม',
    location: 'ศูนย์ศึกษาธรรมชาติกองทัพบก บางปู จ.สมุทรปราการ',
    date: '2026-11-15',
    startTime: '08:30',
    endTime: '15:30',
    hours: 6,
    maxParticipants: 40,
    currentParticipants: 18,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'approved',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-1-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-2',
    title: 'พี่สอนน้อง: ติวเขียนโปรแกรมและคอมพิวเตอร์เบื้องต้น',
    description: 'จัดกิจกรรมเสริมทักษะทางเทคโนโลยีแก่นักเรียนประถมศึกษา สอนตรรกะการคิดและการใช้คอมพิวเตอร์อย่างปลอดภัย',
    category: 'การศึกษาและเยาวชน',
    location: 'โรงเรียนวัดนาวง ปทุมธานี',
    date: '2026-11-20',
    startTime: '09:00',
    endTime: '14:00',
    hours: 5,
    maxParticipants: 20,
    currentParticipants: 12,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'approved',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-2-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-3',
    title: 'จิตอาสา Open House นวัตกรรมดิจิทัล DIT 2026',
    description: 'ปฏิบัติหน้าที่ฝ่ายต้อนรับ แนะนำสาขาวิชา จัดซุ้มสาธิต AI และควบคุมสถานที่ในงานเปิดบ้านวิทยาลัยนวัตกรรมดิจิทัล',
    category: 'กิจกรรมมหาวิทยาลัย',
    location: 'อาคาร 15 มหาวิทยาลัยรังสิต',
    date: '2026-11-28',
    startTime: '08:00',
    endTime: '17:00',
    hours: 8,
    maxParticipants: 35,
    currentParticipants: 30,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'approved',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-3-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-4',
    title: 'บริจาคโลหิตต่อชีวิตเพื่อนมนุษย์ ครั้งที่ 4/2569',
    description: 'ร่วมบริจาคโลหิตหรือทำหน้าที่ฝ่ายบริการอำนวยความสะดวก ดูแลผู้บริจาคโลหิตร่วมกับสภากาชาดไทย',
    category: 'สาธารณสุขและชุมชน',
    location: 'ลานชั้น 1 อาคารอาทิตย์ อุไรรัตน์ (อาคาร 1)',
    date: '2026-12-05',
    startTime: '09:00',
    endTime: '12:30',
    hours: 3,
    maxParticipants: 50,
    currentParticipants: 25,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'approved',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-4-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-full',
    title: 'เวิร์กช็อปจิตอาสาซ่อมบำรุงห้องสมุดชุมชน (กิจกรรมเต็มสำหรับทดสอบ)',
    description: 'กิจกรรมทาสี ซ่อมบำรุงโต๊ะเก้าอี้ และจัดหมวดหมู่หนังสือในห้องสมุดชุมชน (โควตาจำกัด 2 ท่าน)',
    category: 'บำเพ็ญประโยชน์ชุมชน',
    location: 'ศูนย์การเรียนรู้ชุมชนหลักหก',
    date: '2026-11-12',
    startTime: '10:00',
    endTime: '14:00',
    hours: 4,
    maxParticipants: 2,
    currentParticipants: 2,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'approved',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-FULL-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'act-pending',
    title: 'โครงการอบรมปฐมพยาบาลเบื้องต้น CPR & AED',
    description: 'อบรมการช่วยฟื้นคืนชีพและการใช้เครื่องกระตุกหัวใจอัตโนมัติ (รอผู้อนุมัติตรวจสอบก่อนเปิดรับสมัคร)',
    category: 'สาธารณสุขและการอบรม',
    location: 'ห้องประชุม 1-301 อาคาร 1',
    date: '2026-12-18',
    startTime: '13:00',
    endTime: '17:00',
    hours: 4,
    maxParticipants: 30,
    currentParticipants: 0,
    organizerId: 'user-organizer',
    organizerName: 'สโมสรนักศึกษา DIT / หน่วยงานกิจกรรม',
    status: 'pending_approval',
    academicYear: '2569',
    semester: '1',
    qrCodeSecret: 'QR-VOLUNTEER-ACT-PENDING-SECRET-KEY',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_REGISTRATIONS: Registration[] = [
  // Student 1 (พจน์กฤษฎิ์) registered and checked in act-1
  {
    id: 'reg-1',
    activityId: 'act-1',
    studentId: 'user-student1',
    registeredAt: '2026-11-01T09:00:00.000Z',
    status: 'checked_in',
  },
  // Student 1 registered for act-2
  {
    id: 'reg-2',
    activityId: 'act-2',
    studentId: 'user-student1',
    registeredAt: '2026-11-02T10:00:00.000Z',
    status: 'registered',
  },
  // Full activity participants: student2 & student3
  {
    id: 'reg-full-1',
    activityId: 'act-full',
    studentId: 'user-student2',
    registeredAt: '2026-11-02T11:00:00.000Z',
    status: 'registered',
  },
  {
    id: 'reg-full-2',
    activityId: 'act-full',
    studentId: 'user-student3',
    registeredAt: '2026-11-02T11:30:00.000Z',
    status: 'registered',
  },
];

const INITIAL_ATTENDANCES: Attendance[] = [
  {
    id: 'att-1',
    activityId: 'act-1',
    studentId: 'user-student1',
    checkInTime: '2026-11-05T08:35:00.000Z',
    qrCodeUsed: 'QR-VOLUNTEER-ACT-1-SECRET-KEY',
  },
];

const INITIAL_EVIDENCE: Evidence[] = [
  {
    id: 'evi-1',
    activityId: 'act-1',
    studentId: 'user-student1',
    fileUrl: '/evidence-sample.svg',
    fileName: 'ภาพถ่ายร่วมกิจกรรมปลูกป่าชายเลน.jpg',
    fileType: 'image/jpeg',
    notes: 'เข้าร่วมตั้งแต่ 08:30 - 15:30 ปลูกต้นโกงกางและช่วยเก็บขยะครบตามเวลาครับ',
    uploadedAt: '2026-11-05T16:00:00.000Z',
  },
];

const INITIAL_HOUR_RECORDS: HourRecord[] = [
  {
    id: 'hr-1',
    activityId: 'act-1',
    studentId: 'user-student1',
    hours: 6,
    status: 'pending', // waiting for officer/approver to approve
    officerComment: 'ตรวจสอบการเช็กชื่อและรูปถ่ายแล้ว ถูกต้องตามเวลา',
    updatedAt: '2026-11-05T16:00:00.000Z',
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    userId: 'user-admin',
    userName: 'ผู้ดูแลระบบส่วนกลาง (Admin)',
    role: 'admin',
    action: 'INIT_SYSTEM',
    details: 'เริ่มต้นระบบบริหารจัดการชั่วโมงจิตอาสาสำหรับนักศึกษาทุน',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'log-2',
    userId: 'user-officer',
    userName: 'เจ้าหน้าที่ดูแลทุน',
    role: 'officer',
    action: 'CONFIG_SCHOLARSHIP',
    details: 'กำหนดเป้าหมายชั่วโมงทุนการศึกษา ภาคการศึกษา 1/2569',
    timestamp: new Date().toISOString(),
  },
];

const INITIAL_SETTINGS: SystemSettings = {
  systemName: 'ระบบบริหารจัดการชั่วโมงจิตอาสาสำหรับนักศึกษาทุน มหาวิทยาลัยรังสิต',
  academicYear: '2569',
  semester: '1',
  academicYears: ['2568', '2569', '2570'],
  allowSelfRegistration: true,
  announcement: 'ยินดีต้อนรับนักศึกษาทุนทุกท่าน กรุณาตรวจสอบชั่วโมงจิตอาสาให้ครบถ้วนก่อนสิ้นสุดภาคการศึกษา 1/2569',
};

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore read-only errors
  }
}

export function getDatabase(): DatabaseSchema {
  if (IS_VERCEL && cachedDb) {
    return cachedDb;
  }

  ensureDataDir();

  // On Vercel cold start before TiDB load, seed from bundled data/db.json if available
  const sourceFile = fs.existsSync(DB_FILE)
    ? DB_FILE
    : fs.existsSync(BUNDLED_DB_FILE)
    ? BUNDLED_DB_FILE
    : null;

  if (!sourceFile) {
    const initialData: DatabaseSchema = {
      users: INITIAL_USERS,
      scholarshipTypes: INITIAL_SCHOLARSHIPS,
      activities: INITIAL_ACTIVITIES,
      registrations: INITIAL_REGISTRATIONS,
      attendances: INITIAL_ATTENDANCES,
      evidence: INITIAL_EVIDENCE,
      hourRecords: INITIAL_HOUR_RECORDS,
      auditLogs: INITIAL_AUDIT_LOGS,
      settings: INITIAL_SETTINGS,
      scholarshipRequests: [],
    };
    saveDatabase(initialData);
    return initialData;
  }

  try {
    const stat = fs.statSync(sourceFile);
    if (cachedDb && sourceFile === DB_FILE && stat.mtimeMs === cachedMtimeMs) {
      return cachedDb;
    }

    const raw = fs.readFileSync(sourceFile, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    let changed = false;
    if (Array.isArray(parsed.scholarshipTypes)) {
      const gys = parsed.scholarshipTypes.find((s) => s.id === 'sch-4');
      if (gys && gys.targetHours === 36) {
        gys.targetHours = 18;
        gys.name = 'ทุน กยศ. (กองทุนเงินให้กู้ยืมเพื่อการศึกษา)';
        gys.description = 'ทุนกู้ยืมเพื่อการศึกษา กยศ. เงื่อนไขสะสมชั่วโมงจิตอาสา 18 ชั่วโมง (สามารถเลือกควบคู่กับทุนอื่นได้)';
        changed = true;
      }
      const beforeLen = parsed.scholarshipTypes.length;
      parsed.scholarshipTypes = parsed.scholarshipTypes.filter((s) => s.id !== 'sch-5');
      if (parsed.scholarshipTypes.length !== beforeLen) changed = true;
    }
    if (Array.isArray(parsed.activities)) {
      for (const act of parsed.activities) {
        if (!act.academicYear) {
          act.academicYear = '2569';
          changed = true;
        }
        if (!act.semester) {
          act.semester = '1';
          changed = true;
        }
      }
      const validActIds = new Set(parsed.activities.map((a) => a.id));
      const regLen = parsed.registrations?.length || 0;
      const attLen = parsed.attendances?.length || 0;
      const eviLen = parsed.evidence?.length || 0;
      const hrLen = parsed.hourRecords?.length || 0;
      if (Array.isArray(parsed.registrations)) {
        parsed.registrations = parsed.registrations.filter((r) => validActIds.has(r.activityId));
      }
      if (Array.isArray(parsed.attendances)) {
        parsed.attendances = parsed.attendances.filter((a) => validActIds.has(a.activityId));
      }
      if (Array.isArray(parsed.evidence)) {
        parsed.evidence = parsed.evidence.filter((e) => validActIds.has(e.activityId));
      }
      if (Array.isArray(parsed.hourRecords)) {
        parsed.hourRecords = parsed.hourRecords.filter((h) => validActIds.has(h.activityId));
      }
      if (
        (parsed.registrations?.length || 0) !== regLen ||
        (parsed.attendances?.length || 0) !== attLen ||
        (parsed.evidence?.length || 0) !== eviLen ||
        (parsed.hourRecords?.length || 0) !== hrLen
      ) {
        changed = true;
      }
    }
    if (!Array.isArray(parsed.scholarshipRequests)) {
      parsed.scholarshipRequests = [];
      changed = true;
    }
    if (!Array.isArray(parsed.settings?.academicYears) || parsed.settings.academicYears.length === 0) {
      const yrs = new Set<string>(['2568', '2569', '2570']);
      if (parsed.settings?.academicYear) yrs.add(parsed.settings.academicYear);
      (parsed.activities || []).forEach((a) => {
        if (a.academicYear) yrs.add(a.academicYear);
      });
      parsed.settings = {
        ...INITIAL_SETTINGS,
        ...(parsed.settings || {}),
        academicYears: Array.from(yrs).sort(),
      };
      changed = true;
    }

    // Auto-extract any large inline Base64 images out of db.json into TiDB + local media store
    if (Array.isArray(parsed.evidence)) {
      for (const ev of parsed.evidence) {
        if (ev.fileUrl && ev.fileUrl.startsWith('data:image/')) {
          ev.fileUrl = storeDataUrlSync(ev.fileUrl, ev.fileName || 'evidence.jpg');
          changed = true;
        }
      }
    }
    if (Array.isArray(parsed.scholarshipRequests)) {
      for (const req of parsed.scholarshipRequests) {
        if (req.evidenceUrl && req.evidenceUrl.startsWith('data:image/')) {
          req.evidenceUrl = storeDataUrlSync(req.evidenceUrl, req.evidenceFileName || 'scholarship-proof.jpg');
          changed = true;
        }
      }
    }

    if (changed) {
      saveDatabase(parsed);
    } else {
      cachedDb = parsed;
      cachedMtimeMs = stat.mtimeMs;
    }
    return parsed;
  } catch (err) {
    console.error('Error reading DB, re-initializing', err);
    const initialData: DatabaseSchema = {
      users: INITIAL_USERS,
      scholarshipTypes: INITIAL_SCHOLARSHIPS,
      activities: INITIAL_ACTIVITIES,
      registrations: INITIAL_REGISTRATIONS,
      attendances: INITIAL_ATTENDANCES,
      evidence: INITIAL_EVIDENCE,
      hourRecords: INITIAL_HOUR_RECORDS,
      auditLogs: INITIAL_AUDIT_LOGS,
      settings: INITIAL_SETTINGS,
    };
    saveDatabase(initialData);
    return initialData;
  }
}

export function saveDatabase(data: DatabaseSchema): void {
  cachedDb = data;
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(data), 'utf-8');
    cachedMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  } catch (err) {
    console.warn('[DB] Local file write skipped:', (err as Error)?.message);
  }
  // Keep TiDB app_state in sync asynchronously on local dev
  if (!IS_VERCEL) {
    saveAppStateToTiDB(data).catch(() => {});
  }
}

/**
 * Hydrates in-memory DB from TiDB Cloud on Vercel Serverless cold starts (or refreshes stale cache).
 * On localhost, returns immediately from fast local cache (< 0.5 ms).
 */
export async function ensureDbReady(): Promise<DatabaseSchema> {
  if (!IS_VERCEL) {
    return getDatabase();
  }
  const now = Date.now();
  if (cachedDb && now - lastTiDBSyncMs < 1500) {
    return cachedDb;
  }
  const remote = await loadAppStateFromTiDB();
  if (remote && Array.isArray(remote.users)) {
    cachedDb = remote as DatabaseSchema;
    lastTiDBSyncMs = now;
    try {
      ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(cachedDb), 'utf-8');
      cachedMtimeMs = fs.statSync(DB_FILE).mtimeMs;
    } catch {
      // Ignore /tmp write errors
    }
    return cachedDb;
  }
  const local = getDatabase();
  lastTiDBSyncMs = now;
  await saveAppStateToTiDB(local);
  return local;
}

/**
 * Persists database state both locally/tmp AND awaits TiDB Cloud commit on Vercel.
 */
export async function persistDatabase(data?: DatabaseSchema): Promise<void> {
  const target = data || cachedDb || getDatabase();
  saveDatabase(target);
  if (IS_VERCEL) {
    await saveAppStateToTiDB(target);
    lastTiDBSyncMs = Date.now();
  }
}

export const flushDatabaseToTiDB = persistDatabase;

export function logAudit(
  userId: string,
  userName: string,
  role: any,
  action: string,
  details: string
): void {
  const db = getDatabase();
  const log: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId,
    userName,
    role,
    action,
    details,
    timestamp: new Date().toISOString(),
  };
  db.auditLogs.unshift(log);
  // Keep last 500 logs
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDatabase(db);
}
