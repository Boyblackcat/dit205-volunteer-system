import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { User, Role } from '@/types';

let poolInstance: mysql.Pool | null = null;
let lastConfigKey = '';
let tableInitialized = false;
let uploadsTableInitialized = false;
let appStateTableInitialized = false;

export interface TiDBConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export function getTiDBConfig(): TiDBConfig {
  // Re-read .env.local dynamically so changes take effect immediately without restart
  const envPath = path.join(process.cwd(), '.env.local');
  const envVars: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        envVars[k] = v;
      }
    }
  }

  return {
    host: envVars.DB_HOST || process.env.DB_HOST || '',
    port: Number(envVars.DB_PORT || process.env.DB_PORT || 4000),
    user: envVars.DB_USER || envVars.DB_USERNAME || process.env.DB_USER || '',
    password: envVars.DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    database: envVars.DB_NAME || envVars.DB_DATABASE || process.env.DB_NAME || 'dit205_db',
    ssl: (envVars.DB_SSL || process.env.DB_SSL || 'true') === 'true',
  };
}

export function saveTiDBConfigToEnv(partial: Partial<TiDBConfig>) {
  if (process.env.VERCEL) {
    // Vercel serverless filesystem is read-only; configure env vars in Vercel Dashboard
    poolInstance = null;
    tableInitialized = false;
    uploadsTableInitialized = false;
    appStateTableInitialized = false;
    return;
  }
  const current = getTiDBConfig();
  const updated: TiDBConfig = {
    ...current,
    ...partial,
  };
  const envPath = path.join(process.cwd(), '.env.local');
  let jwtSecret = process.env.JWT_SECRET || '';
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^JWT_SECRET=(.+)$/m);
    if (match) jwtSecret = match[1].trim();
  }

  const newContent = [
    `DB_HOST=${updated.host}`,
    `DB_PORT=${updated.port}`,
    `DB_USER=${updated.user}`,
    `DB_PASSWORD=${updated.password}`,
    `DB_NAME=${updated.database}`,
    `DB_SSL=${updated.ssl ? 'true' : 'false'}`,
    `JWT_SECRET=${jwtSecret}`,
    '',
  ].join('\n');

  fs.writeFileSync(envPath, newContent, 'utf-8');
  // Reset pool so next query uses new credentials
  poolInstance = null;
  tableInitialized = false;
  uploadsTableInitialized = false;
  appStateTableInitialized = false;
}

export function getTiDBPool(): mysql.Pool | null {
  const cfg = getTiDBConfig();
  if (!cfg.host || !cfg.password) return null;

  const configKey = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.password}:${cfg.database}`;
  if (!poolInstance || lastConfigKey !== configKey) {
    poolInstance = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 2500,
    });
    lastConfigKey = configKey;
    tableInitialized = false;
    uploadsTableInitialized = false;
  }
  return poolInstance;
}

export async function ensureTiDBUsersTable(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getTiDBConfig();
  if (!cfg.password) {
    return { ok: false, error: 'กรุณาใส่รหัสผ่าน (DB_PASSWORD) ของ TiDB User: ' + cfg.user };
  }
  const pool = getTiDBPool();
  if (!pool) return { ok: false, error: 'ไม่ได้ตั้งค่าการเชื่อมต่อ TiDB' };
  if (tableInitialized) return { ok: true };

  try {
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${dbName}\`.volunteer_users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NULL,
        last_name VARCHAR(255) NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        student_id VARCHAR(50) NULL,
        scholarship_type_id VARCHAR(64) NULL,
        scholarship_type_ids TEXT NULL,
        faculty VARCHAR(255) NULL,
        major VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        created_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // Ensure new columns exist on older tables
    for (const colDef of [
      'ADD COLUMN first_name VARCHAR(255) NULL',
      'ADD COLUMN last_name VARCHAR(255) NULL',
      'ADD COLUMN major VARCHAR(255) NULL',
    ]) {
      try {
        await pool.query(`ALTER TABLE \`${dbName}\`.volunteer_users ${colDef}`);
      } catch {
        // Column already exists
      }
    }
    tableInitialized = true;
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.warn('[TiDB] Could not initialize volunteer_users table:', msg);
    return { ok: false, error: msg };
  }
}

export async function upsertUserToTiDB(user: User): Promise<boolean> {
  const pool = getTiDBPool();
  if (!pool) return false;

  try {
    const ready = await ensureTiDBUsersTable();
    if (!ready.ok) return false;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    const schIds = user.scholarshipTypeIds || (user.scholarshipTypeId ? [user.scholarshipTypeId] : []);
    await pool.query(
      `INSERT INTO \`${dbName}\`.volunteer_users 
        (id, name, first_name, last_name, email, password, role, student_id, scholarship_type_id, scholarship_type_ids, faculty, major, phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        email = VALUES(email),
        password = VALUES(password),
        role = VALUES(role),
        student_id = VALUES(student_id),
        scholarship_type_id = VALUES(scholarship_type_id),
        scholarship_type_ids = VALUES(scholarship_type_ids),
        faculty = VALUES(faculty),
        major = VALUES(major),
        phone = VALUES(phone)`,
      [
        user.id,
        user.name,
        user.firstName || null,
        user.lastName || null,
        user.email,
        user.password,
        user.role,
        user.studentId || null,
        schIds[0] || user.scholarshipTypeId || null,
        JSON.stringify(schIds),
        user.faculty || null,
        user.major || null,
        user.phone || null,
        user.createdAt || new Date().toISOString(),
      ]
    );
    return true;
  } catch (err) {
    console.warn('[TiDB] Failed to upsert user:', (err as Error).message);
    return false;
  }
}

export async function deleteUserFromTiDB(userId: string): Promise<boolean> {
  const pool = getTiDBPool();
  if (!pool) return false;

  try {
    const ready = await ensureTiDBUsersTable();
    if (!ready.ok) return false;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(`DELETE FROM \`${dbName}\`.volunteer_users WHERE id = ?`, [userId]);
    return true;
  } catch (err) {
    console.warn('[TiDB] Failed to delete user:', (err as Error).message);
    return false;
  }
}

export async function fetchAllUsersFromTiDB(): Promise<User[] | null> {
  const pool = getTiDBPool();
  if (!pool) return null;

  try {
    const ready = await ensureTiDBUsersTable();
    if (!ready.ok) return null;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM \`${dbName}\`.volunteer_users ORDER BY created_at ASC`
    );

    return rows.map((row) => {
      let schIds: string[] = [];
      if (row.scholarship_type_ids) {
        try {
          schIds = JSON.parse(row.scholarship_type_ids);
        } catch {
          schIds = row.scholarship_type_id ? [row.scholarship_type_id] : [];
        }
      } else if (row.scholarship_type_id) {
        schIds = [row.scholarship_type_id];
      }

      return {
        id: String(row.id),
        name: String(row.name),
        firstName: row.first_name ? String(row.first_name) : undefined,
        lastName: row.last_name ? String(row.last_name) : undefined,
        email: String(row.email),
        password: String(row.password),
        role: (row.role as Role) || 'student',
        studentId: row.student_id ? String(row.student_id) : undefined,
        scholarshipTypeId: row.scholarship_type_id ? String(row.scholarship_type_id) : schIds[0],
        scholarshipTypeIds: schIds,
        faculty: row.faculty ? String(row.faculty) : undefined,
        major: row.major ? String(row.major) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('[TiDB] Failed to fetch users from TiDB:', (err as Error).message);
    return null;
  }
}

export async function syncUsersWithTiDB(localUsers: User[]): Promise<{
  connected: boolean;
  syncedCount: number;
  users: User[];
  host?: string;
  user?: string;
  database?: string;
  error?: string;
}> {
  const cfg = getTiDBConfig();
  const ready = await ensureTiDBUsersTable();
  if (!ready.ok) {
    return {
      connected: false,
      syncedCount: 0,
      users: localUsers,
      host: cfg.host,
      user: cfg.user,
      database: cfg.database,
      error: ready.error || 'ไม่สามารถเชื่อมต่อ TiDB Cloud ได้',
    };
  }

  try {
    for (const u of localUsers) {
      await upsertUserToTiDB(u);
    }

    const tidbUsers = await fetchAllUsersFromTiDB();
    return {
      connected: true,
      syncedCount: tidbUsers ? tidbUsers.length : localUsers.length,
      users: tidbUsers && tidbUsers.length > 0 ? tidbUsers : localUsers,
      host: cfg.host,
      user: cfg.user,
      database: cfg.database,
    };
  } catch (err) {
    return {
      connected: false,
      syncedCount: 0,
      users: localUsers,
      host: cfg.host,
      user: cfg.user,
      database: cfg.database,
      error: (err as Error).message,
    };
  }
}

// Non-blocking background sync helpers so API responses return immediately
export function upsertUserToTiDBBackground(user: User): void {
  upsertUserToTiDB(user).catch((err) => {
    console.warn('[TiDB] Background user upsert skipped:', (err as Error)?.message);
  });
}

export function deleteUserFromTiDBBackground(userId: string): void {
  deleteUserFromTiDB(userId).catch((err) => {
    console.warn('[TiDB] Background user delete skipped:', (err as Error)?.message);
  });
}

// Dedicated TiDB table for uploaded evidence images (separated from db.json)
export async function ensureTiDBUploadsTable(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getTiDBConfig();
  if (!cfg.password) {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่ารหัสผ่าน TiDB' };
  }
  const pool = getTiDBPool();
  if (!pool) return { ok: false, error: 'ไม่ได้ตั้งค่าการเชื่อมต่อ TiDB' };
  if (uploadsTableInitialized) return { ok: true };

  try {
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${dbName}\`.volunteer_uploads (
        id VARCHAR(80) PRIMARY KEY,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
        file_name VARCHAR(255) NULL,
        data LONGTEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    uploadsTableInitialized = true;
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.warn('[TiDB] Could not initialize volunteer_uploads table:', msg);
    return { ok: false, error: msg };
  }
}

export async function saveUploadToTiDB(
  id: string,
  mimeType: string,
  fileName: string,
  base64Data: string
): Promise<boolean> {
  const pool = getTiDBPool();
  if (!pool) return false;

  try {
    const ready = await ensureTiDBUploadsTable();
    if (!ready.ok) return false;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(
      `INSERT INTO \`${dbName}\`.volunteer_uploads (id, mime_type, file_name, data, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mime_type = VALUES(mime_type),
         file_name = VALUES(file_name),
         data = VALUES(data)`,
      [id, mimeType, fileName || 'image.jpg', base64Data, new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.warn('[TiDB] Failed to save upload:', (err as Error).message);
    return false;
  }
}

export async function getUploadFromTiDB(
  id: string
): Promise<{ mimeType: string; fileName: string; buffer: Buffer } | null> {
  const pool = getTiDBPool();
  if (!pool) return null;

  try {
    const ready = await ensureTiDBUploadsTable();
    if (!ready.ok) return null;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT mime_type, file_name, data FROM \`${dbName}\`.volunteer_uploads WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
      mimeType: String(row.mime_type || 'image/jpeg'),
      fileName: String(row.file_name || 'image.jpg'),
      buffer: Buffer.from(String(row.data), 'base64'),
    };
  } catch (err) {
    console.warn('[TiDB] Failed to fetch upload:', (err as Error).message);
    return null;
  }
}

// Full application database state table in TiDB Cloud (enables persistent storage on Vercel Serverless)
export async function ensureTiDBAppStateTable(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getTiDBConfig();
  if (!cfg.password) {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่ารหัสผ่าน TiDB' };
  }
  const pool = getTiDBPool();
  if (!pool) return { ok: false, error: 'ไม่ได้ตั้งค่าการเชื่อมต่อ TiDB' };
  if (appStateTableInitialized) return { ok: true };

  try {
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${dbName}\`.volunteer_app_state (
        state_key VARCHAR(64) PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        updated_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    appStateTableInitialized = true;
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.warn('[TiDB] Could not initialize volunteer_app_state table:', msg);
    return { ok: false, error: msg };
  }
}

export async function loadAppStateFromTiDB(): Promise<any | null> {
  const pool = getTiDBPool();
  if (!pool) return null;

  try {
    const ready = await ensureTiDBAppStateTable();
    if (!ready.ok) return null;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT payload FROM \`${dbName}\`.volunteer_app_state WHERE state_key = 'main' LIMIT 1`
    );
    if (!rows || rows.length === 0) return null;
    return JSON.parse(String(rows[0].payload));
  } catch (err) {
    console.warn('[TiDB] Failed to load app state:', (err as Error).message);
    return null;
  }
}

export async function saveAppStateToTiDB(data: any): Promise<boolean> {
  const pool = getTiDBPool();
  if (!pool) return false;

  try {
    const ready = await ensureTiDBAppStateTable();
    if (!ready.ok) return false;

    const cfg = getTiDBConfig();
    const dbName = cfg.database.replace(/[^a-zA-Z0-9_]/g, '') || 'test';
    await pool.query(
      `INSERT INTO \`${dbName}\`.volunteer_app_state (state_key, payload, updated_at)
       VALUES ('main', ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         updated_at = VALUES(updated_at)`,
      [JSON.stringify(data), new Date().toISOString()]
    );
    return true;
  } catch (err) {
    console.warn('[TiDB] Failed to save app state:', (err as Error).message);
    return false;
  }
}
