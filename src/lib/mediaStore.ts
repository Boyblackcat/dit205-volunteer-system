import fs from 'fs';
import path from 'path';
import { saveUploadToTiDB, getUploadFromTiDB } from '@/lib/tidb';

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

interface CachedMedia {
  mimeType: string;
  fileName: string;
  buffer: Buffer;
}

const MAX_MEMORY_CACHE = 60;
const mediaMemoryCache = new Map<string, CachedMedia>();

function putInCache(id: string, item: CachedMedia) {
  if (mediaMemoryCache.size >= MAX_MEMORY_CACHE) {
    const firstKey = mediaMemoryCache.keys().next().value;
    if (firstKey) mediaMemoryCache.delete(firstKey);
  }
  mediaMemoryCache.set(id, item);
}

function ensureUploadsDir() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch {
    // Ignore on read-only serverless filesystems
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/**
 * Extracts a data:image/... URL into dedicated TiDB `volunteer_uploads` table + local cache file,
 * returning a lightweight `/api/uploads/<id>` URL so db.json stays tiny (< 30 KB).
 */
export function storeDataUrlSync(dataUrl: string, fileName = 'image.jpg'): string {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const buffer = Buffer.from(parsed.base64, 'base64');

  // 1. Store in RAM cache immediately for instant reads
  putInCache(id, { mimeType: parsed.mimeType, fileName, buffer });

  // 2. Store in local data/uploads/ (fast local disk persistence)
  try {
    ensureUploadsDir();
    fs.writeFileSync(path.join(UPLOADS_DIR, `${id}.bin`), buffer);
    fs.writeFileSync(
      path.join(UPLOADS_DIR, `${id}.json`),
      JSON.stringify({ id, mimeType: parsed.mimeType, fileName, createdAt: new Date().toISOString() }),
      'utf-8'
    );
  } catch {
    // Ignore if filesystem is read-only
  }

  // 3. Push to TiDB volunteer_uploads table in background (non-blocking)
  saveUploadToTiDB(id, parsed.mimeType, fileName, parsed.base64).catch(() => {});

  return `/api/uploads/${id}`;
}

export async function storeDataUrlAsync(dataUrl: string, fileName = 'image.jpg'): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const buffer = Buffer.from(parsed.base64, 'base64');

  putInCache(id, { mimeType: parsed.mimeType, fileName, buffer });

  try {
    ensureUploadsDir();
    fs.writeFileSync(path.join(UPLOADS_DIR, `${id}.bin`), buffer);
    fs.writeFileSync(
      path.join(UPLOADS_DIR, `${id}.json`),
      JSON.stringify({ id, mimeType: parsed.mimeType, fileName, createdAt: new Date().toISOString() }),
      'utf-8'
    );
  } catch {
    // Ignore on read-only FS
  }

  // On Vercel/serverless wait for TiDB write; on localhost sync in background so UI responds instantly
  if (process.env.VERCEL) {
    await saveUploadToTiDB(id, parsed.mimeType, fileName, parsed.base64);
  } else {
    saveUploadToTiDB(id, parsed.mimeType, fileName, parsed.base64).catch(() => {});
  }

  return `/api/uploads/${id}`;
}

export async function readMediaById(id: string): Promise<CachedMedia | null> {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;

  // 1. RAM cache hit (0 ms)
  const cached = mediaMemoryCache.get(safeId);
  if (cached) return cached;

  // 2. Local disk hit (< 1 ms)
  try {
    const binPath = path.join(UPLOADS_DIR, `${safeId}.bin`);
    const metaPath = path.join(UPLOADS_DIR, `${safeId}.json`);
    if (fs.existsSync(binPath)) {
      const buffer = fs.readFileSync(binPath);
      let mimeType = 'image/jpeg';
      let fileName = 'image.jpg';
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        mimeType = meta.mimeType || mimeType;
        fileName = meta.fileName || fileName;
      }
      const item = { mimeType, fileName, buffer };
      putInCache(safeId, item);
      return item;
    }
  } catch {
    // Fallback to TiDB
  }

  // 3. TiDB Cloud volunteer_uploads fallback
  const fromTidb = await getUploadFromTiDB(safeId);
  if (fromTidb) {
    putInCache(safeId, fromTidb);
    return fromTidb;
  }

  return null;
}

export async function syncLocalUploadsToTiDB(): Promise<number> {
  let synced = 0;
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return 0;
    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.json'));
    for (const metaFile of files) {
      const meta = JSON.parse(fs.readFileSync(path.join(UPLOADS_DIR, metaFile), 'utf-8'));
      const binPath = path.join(UPLOADS_DIR, `${meta.id}.bin`);
      if (!fs.existsSync(binPath)) continue;
      const base64 = fs.readFileSync(binPath).toString('base64');
      const ok = await saveUploadToTiDB(
        meta.id,
        meta.mimeType || 'image/jpeg',
        meta.fileName || 'image.jpg',
        base64
      );
      if (ok) synced++;
    }
  } catch (err) {
    console.warn('[MediaStore] syncLocalUploadsToTiDB warning:', (err as Error)?.message);
  }
  return synced;
}
