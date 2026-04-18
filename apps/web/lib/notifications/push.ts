// Web Push VAPID stub
// Full implementation requires: npm install web-push + VAPID key generation
// Generate keys: npx web-push generate-vapid-keys

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

export async function sendPush(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    console.warn('[push] VAPID keys not configured — skipping push');
    return { ok: false, error: 'vapid_not_configured' };
  }

  try {
    // Stub: import webpush and call sendNotification when implementing
    // const webpush = await import('web-push');
    // webpush.setVapidDetails(
    //   process.env.VAPID_SUBJECT!,
    //   process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    //   process.env.VAPID_PRIVATE_KEY!
    // );
    // await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('[push] stub — would send to:', subscription.endpoint, payload);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    return { ok: false, error: message };
  }
}
