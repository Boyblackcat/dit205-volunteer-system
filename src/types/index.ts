export type Role = 'student' | 'organizer' | 'officer' | 'approver' | 'admin';

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password?: string;
  role: Role;
  studentId?: string;
  scholarshipTypeId?: string;
  scholarshipTypeIds?: string[];
  faculty?: string;
  major?: string;
  phone?: string;
  createdAt: string;
}

export interface ScholarshipType {
  id: string;
  name: string;
  description: string;
  targetHours: number;
  academicYear?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed';

export interface Activity {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  maxParticipants: number;
  currentParticipants: number;
  organizerId: string;
  organizerName: string;
  status: ActivityStatus;
  academicYear?: string;
  semester?: string;
  registrationDeadline?: string; // ISO local datetime e.g. '2026-11-28T17:00'
  allowedScholarshipIds?: string[]; // empty or undefined = ทุกทุนเข้าร่วมได้
  qrCodeSecret: string;
  approvalComment?: string;
  createdAt: string;
}

export type RegistrationStatus = 'registered' | 'checked_in' | 'cancelled';

export interface Registration {
  id: string;
  activityId: string;
  studentId: string;
  registeredAt: string;
  status: RegistrationStatus;
}

export interface Attendance {
  id: string;
  activityId: string;
  studentId: string;
  checkInTime: string;
  qrCodeUsed: string;
}

export interface Evidence {
  id: string;
  activityId: string;
  studentId: string;
  fileUrl: string; // Base64 data URL or uploaded URL
  fileName: string;
  fileType: string;
  notes: string;
  uploadedAt: string;
}

export type HourStatus = 'pending' | 'verified_by_officer' | 'approved' | 'rejected';

export interface HourRecord {
  id: string;
  activityId: string;
  studentId: string;
  hours: number;
  status: HourStatus;
  officerComment?: string;
  approverComment?: string;
  verifiedAt?: string;
  approvedAt?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  systemName: string;
  academicYear: string;
  semester: string;
  academicYears?: string[];
  allowSelfRegistration: boolean;
  announcement: string;
}

export type ScholarshipRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ScholarshipChangeRequest {
  id: string;
  studentId: string; // user.id
  currentScholarshipIds: string[];
  requestedScholarshipIds: string[];
  reason: string;
  evidenceUrl?: string;
  evidenceFileName?: string;
  status: ScholarshipRequestStatus;
  officerComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

