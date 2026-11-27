import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, saveDatabase, logAudit, ensureDbReady, persistDatabase } from '@/lib/db';
import { getCurrentUser, checkRolePermission } from '@/lib/auth';
import {
  syncUsersWithTiDB,
  fetchAllUsersFromTiDB,
  ensureTiDBUsersTable,
  getTiDBConfig,
  saveTiDBConfigToEnv,
  saveAppStateToTiDB,
} from '@/lib/tidb';
import { syncLocalUploadsToTiDB } from '@/lib/mediaStore';

export async function GET(request: NextRequest) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const cfg = getTiDBConfig();
  const ready = await ensureTiDBUsersTable();
  if (!ready.ok) {
    return NextResponse.json({
      connected: false,
      host: cfg.host,
      user: cfg.user,
      database: cfg.database,
      hasPassword: Boolean(cfg.password),
      table: 'volunteer_users',
      count: 0,
      message: ready.error || 'ยังไม่สามารถเชื่อมต่อ TiDB Cloud ได้',
    });
  }

  const tidbUsers = await fetchAllUsersFromTiDB();
  return NextResponse.json({
    connected: tidbUsers !== null,
    host: cfg.host,
    user: cfg.user,
    database: cfg.database,
    hasPassword: Boolean(cfg.password),
    table: 'volunteer_users',
    count: tidbUsers ? tidbUsers.length : 0,
    message: tidbUsers !== null ? 'เชื่อมต่อ TiDB Cloud (FinalDIT205) สำเร็จ' : 'เชื่อมต่อล้มเหลว',
  });
}

export async function POST(request: NextRequest) {
  await ensureDbReady();
  const user = getCurrentUser(request);
  if (!user || !checkRolePermission(user, ['admin'])) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body && (body.password !== undefined || body.user || body.host || body.database)) {
      const update: Record<string, any> = {};
      if (body.host) update.host = body.host.trim();
      if (body.user) update.user = body.user.trim();
      if (body.password !== undefined && body.password !== '') update.password = body.password.trim();
      if (body.database) update.database = body.database.trim();
      saveTiDBConfigToEnv(update);
    }
  } catch {
    // No body provided, proceed with sync
  }

  const db = await ensureDbReady();
  const result = await syncUsersWithTiDB(db.users);

  if (result.connected && result.users.length > 0) {
    db.users = result.users;
    await persistDatabase(db);
    const [uploadsSynced] = await Promise.all([
      syncLocalUploadsToTiDB(),
      saveAppStateToTiDB(db),
    ]);
    logAudit(
      user.id,
      user.name,
      user.role,
      'SYNC_TIDB_USERS',
      `ซิงก์ฐานข้อมูลทั้งหมด (${result.syncedCount} บัญชี, ${uploadsSynced} รูปหลักฐาน, และข้อมูลระบบทั้งหมด) กับ TiDB Cloud (${result.database})`
    );
    await saveAppStateToTiDB(getDatabase());
    return NextResponse.json({ ...result, uploadsSynced });
  }

  return NextResponse.json(result);
}
