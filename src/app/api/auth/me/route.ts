import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDatabase, splitFullName, ensureDbReady } from '@/lib/db';

export async function GET(request: NextRequest) {
  const sessionUser = getCurrentUser(request);
  if (!sessionUser) {
    return NextResponse.json({ user: null });
  }

  const db = await ensureDbReady();
  const fullUser = db.users.find((u) => u.id === sessionUser.id);
  if (!fullUser) {
    return NextResponse.json({ user: null });
  }

  // Support multiple scholarships
  const userSchIds = fullUser.scholarshipTypeIds && fullUser.scholarshipTypeIds.length > 0
    ? fullUser.scholarshipTypeIds
    : fullUser.scholarshipTypeId
    ? [fullUser.scholarshipTypeId]
    : [];

  const scholarships = db.scholarshipTypes.filter((s) => userSchIds.includes(s.id));
  const targetHours = scholarships.reduce((sum, s) => sum + s.targetHours, 0);
  const scholarshipNames = scholarships.map((s) => s.name).join(', ') || 'ไม่ได้ระบุ';

  const { firstName, lastName } = splitFullName(
    fullUser.name,
    fullUser.firstName,
    fullUser.lastName
  );

  return NextResponse.json({
    user: {
      id: fullUser.id,
      name: fullUser.name,
      firstName,
      lastName,
      email: fullUser.email,
      role: fullUser.role,
      studentId: fullUser.studentId,
      scholarshipTypeId: fullUser.scholarshipTypeId || userSchIds[0],
      scholarshipTypeIds: userSchIds,
      scholarships: scholarships.map((s) => ({
        id: s.id,
        name: s.name,
        targetHours: s.targetHours,
      })),
      scholarshipName: scholarshipNames,
      targetHours: targetHours,
      faculty: fullUser.faculty,
      major: fullUser.major,
      phone: fullUser.phone,
    },
  });
}
