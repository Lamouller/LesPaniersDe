import { type NextRequest, NextResponse } from 'next/server';

// GET — verify challenge from Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

// POST — receive delivery receipts and status updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    // TODO: process delivery receipts, read receipts, etc.
    console.log('[whatsapp webhook]', JSON.stringify(body).slice(0, 200));
  } catch {
    // ignore parse errors
  }

  // Always respond 200 to Meta
  return NextResponse.json({ ok: true });
}
