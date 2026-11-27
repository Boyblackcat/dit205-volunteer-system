import { NextRequest, NextResponse } from 'next/server';
import { readMediaById } from '@/lib/mediaStore';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const media = await readMediaById(params.id);
  if (!media) {
    return NextResponse.json({ error: 'ไม่พบรูปภาพหลักฐาน' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      'Content-Type': media.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
