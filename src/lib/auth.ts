import { NextRequest } from 'next/server';
import { getDatabase, logAudit } from './db';
import { Role, User } from '@/types';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  studentId?: string;
  scholarshipTypeId?: string;
  scholarshipTypeIds?: string[];
  faculty?: string;
}

export function getCurrentUser(request?: NextRequest): SessionUser | null {
  // Check cookie or authorization header
  let token: string | null = null;
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookie = request.cookies.get('user_session');
      if (cookie) token = cookie.value;
    }
  }

  if (!token) return null;

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    // Verify against DB to ensure user still exists and role is fresh
    const db = getDatabase();
    const user = db.users.find((u) => u.id === parsed.id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      scholarshipTypeId: user.scholarshipTypeId,
      scholarshipTypeIds: user.scholarshipTypeIds || (user.scholarshipTypeId ? [user.scholarshipTypeId] : []),
      faculty: user.faculty,
    };
  } catch (e) {
    return null;
  }
}

export function createSessionToken(user: User): string {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    scholarshipTypeId: user.scholarshipTypeId,
    scholarshipTypeIds: user.scholarshipTypeIds || (user.scholarshipTypeId ? [user.scholarshipTypeId] : []),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function checkRolePermission(user: SessionUser | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return allowedRoles.includes(user.role);
}

