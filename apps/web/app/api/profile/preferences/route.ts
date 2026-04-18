import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const allowedFields: Record<string, unknown> = {};

    if (body.dietary_preferences !== undefined) {
      allowedFields.dietary_preferences = body.dietary_preferences;
    }
    if (body.notification_channels !== undefined) {
      allowedFields.notification_channels = body.notification_channels;
    }
    if (typeof body.leaderboard_opt_in === 'boolean') {
      allowedFields.leaderboard_opt_in = body.leaderboard_opt_in;
    }
    // public_display_name: only save when opt-in, else set to null
    if ('public_display_name' in body) {
      allowedFields.public_display_name =
        body.leaderboard_opt_in === true && body.public_display_name
          ? String(body.public_display_name).trim().slice(0, 40)
          : null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(allowedFields)
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
