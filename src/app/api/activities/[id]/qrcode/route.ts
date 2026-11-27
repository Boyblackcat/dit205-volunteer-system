import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, ensureDbReady } from '@/lib/db';
import QRCode from 'qrcode';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const db = await ensureDbReady();
  const activity = db.activities.find((a) => a.id === id);

  if (!activity) {
    return NextResponse.json({ error: 'ไม่พบกิจกรรม' }, { status: 404 });
  }

  try {
    // Generate QR code containing the secret payload
    const qrPayload = JSON.stringify({
      activityId: activity.id,
      title: activity.title,
      secret: activity.qrCodeSecret,
      timestamp: Date.now(),
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#15803d',
        light: '#ffffff',
      },
    });

    return NextResponse.json({
      activityId: activity.id,
      activityTitle: activity.title,
      qrCodeSecret: activity.qrCodeSecret,
      qrDataUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'ไม่สามารถสร้าง QR Code ได้' },
      { status: 500 }
    );
  }
}

