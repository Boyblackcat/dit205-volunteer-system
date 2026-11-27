import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ensureDbReady, logAudit } from '@/lib/db';

export async function POST(request: NextRequest) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (user) {
    logAudit(user.id, user.name, user.role, 'LOGOUT', 'ออกจากระบบ');
  }

  const response = NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
  response.cookies.delete('user_session');
  return response;
}

