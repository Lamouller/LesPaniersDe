interface WhatsAppTemplateOpts {
  to: string; // E.164 format
  templateName: string;
  languageCode?: string;
  variables?: Record<string, string>;
  producerPhoneId?: string;
  producerAccessToken?: string;
}

interface WhatsAppResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

async function doSend(
  phoneId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string,
  variables: Record<string, string>
): Promise<WhatsAppResult> {
  const components =
    Object.keys(variables).length > 0
      ? [
          {
            type: 'body',
            parameters: Object.values(variables).map((value) => ({
              type: 'text',
              text: value,
            })),
          },
        ]
      : [];

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (res.ok) {
    const data = (await res.json()) as { messages?: Array<{ id: string }> };
    return { ok: true, messageId: data.messages?.[0]?.id };
  }

  // 5xx → eligible for retry
  if (res.status >= 500) {
    return { ok: false, error: `server_error:${res.status}` };
  }

  const errData = (await res.json()) as { error?: { message?: string } };
  return { ok: false, error: errData.error?.message ?? `http_${res.status}` };
}

export async function sendWhatsAppTemplate(
  opts: WhatsAppTemplateOpts
): Promise<WhatsAppResult> {
  const phoneId =
    opts.producerPhoneId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const accessToken =
    opts.producerAccessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  const languageCode = opts.languageCode ?? 'fr';
  const variables = opts.variables ?? {};

  if (!phoneId || !accessToken) {
    return { ok: false, error: 'missing_credentials' };
  }

  const result = await doSend(
    phoneId,
    accessToken,
    opts.to,
    opts.templateName,
    languageCode,
    variables
  );

  // 1 retry on 5xx
  if (!result.ok && result.error?.startsWith('server_error')) {
    await new Promise((r) => setTimeout(r, 1500));
    return doSend(phoneId, accessToken, opts.to, opts.templateName, languageCode, variables);
  }

  return result;
}
