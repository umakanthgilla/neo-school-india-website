// ONE Communication Hub — WhatsApp Cloud API adapter contract
// Official Meta API only. Never place access tokens in client-side code or GitHub.

export function normalizeWhatsAppWebhook(payload){
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  if(!msg) return null;
  return {
    provider:'whatsapp_cloud_api',
    externalMessageId:msg.id,
    from:msg.from,
    contactName:contact?.profile?.name || null,
    type:msg.type,
    text:msg.text?.body || '',
    timestamp:msg.timestamp,
    raw:payload
  };
}

export function buildTextMessage({to,text}){
  if(!to || !text) throw new Error('to and text are required');
  return {
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to,
    type:'text',
    text:{preview_url:false,body:text}
  };
}

export function buildTemplateMessage({to,templateName,languageCode='en'}){
  if(!to || !templateName) throw new Error('to and templateName are required');
  return {
    messaging_product:'whatsapp',
    to,
    type:'template',
    template:{name:templateName,language:{code:languageCode}}
  };
}

// Server-side implementation target:
// POST https://graph.facebook.com/<API_VERSION>/<PHONE_NUMBER_ID>/messages
// Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>
// Secrets must live in server/environment configuration, never this repository's browser bundle.
