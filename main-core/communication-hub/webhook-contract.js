// Server-side webhook contract for ONE Communication Hub V1.
// Framework-neutral reference for a serverless/API route.

import { normalizeWhatsAppWebhook } from './whatsapp-adapter.js';

export function verifyWebhook({mode, token, challenge, expectedToken}) {
  if (mode === 'subscribe' && token && token === expectedToken) return challenge;
  return null;
}

export async function ingestWhatsAppWebhook({payload, db}) {
  const normalized = normalizeWhatsAppWebhook(payload);
  if (!normalized) return {accepted:true, ignored:true};

  // Idempotency must be enforced by a UNIQUE provider/external_message_id constraint.
  const contact = await db.upsertContactByPhone({
    phone: normalized.from,
    name: normalized.contactName,
    source: 'whatsapp'
  });

  const conversation = await db.findOrCreateConversation({
    contactId: contact.id,
    channel: 'whatsapp'
  });

  await db.insertMessageIfNew({
    conversationId: conversation.id,
    externalMessageId: normalized.externalMessageId,
    provider: normalized.provider,
    type: normalized.type,
    body: normalized.text,
    direction: 'inbound',
    providerTimestamp: normalized.timestamp
  });

  return {accepted:true, conversationId:conversation.id};
}

export const SECURITY_NOTES = Object.freeze([
  'Verify Meta webhook challenge token server-side.',
  'Validate webhook authenticity before production processing.',
  'Keep access tokens and service-role database keys server-side only.',
  'Make external message IDs unique to prevent duplicate ingestion.',
  'Return webhook acknowledgements quickly; run slower AI work asynchronously.',
  'Do not auto-send AI replies during V1 pilot; require explicit human approval.'
]);
