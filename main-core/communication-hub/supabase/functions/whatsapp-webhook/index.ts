// USHA ONE Main Core — WhatsApp Cloud API webhook
// Deploy as a Supabase Edge Function. Secrets belong in Supabase secrets only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'content-type': 'application/json' };

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Meta webhook verification handshake.
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && expected && token === expected && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const payload = await req.json();
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contactMeta = value?.contacts?.[0];

    // Delivery/read status events contain no inbound message.
    if (!message) return new Response(JSON.stringify({ accepted: true, ignored: true }), { status: 200, headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const workspaceSlug = Deno.env.get('ONE_WORKSPACE_SLUG') || 'neo-school-india';
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase server configuration missing');

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: workspace, error: workspaceError } = await db
      .from('workspaces').select('id').eq('slug', workspaceSlug).single();
    if (workspaceError || !workspace) throw workspaceError || new Error('Workspace not found');

    const phone = message.from;
    const name = contactMeta?.profile?.name || null;

    let { data: contact, error: contactError } = await db
      .from('contacts').select('id').eq('workspace_id', workspace.id).eq('phone', phone).maybeSingle();

    if (contactError) throw contactError;
    if (!contact) {
      const inserted = await db.from('contacts').insert({
        workspace_id: workspace.id, phone, name, source: 'whatsapp'
      }).select('id').single();
      if (inserted.error) throw inserted.error;
      contact = inserted.data;
    }

    let { data: conversation, error: conversationError } = await db
      .from('conversations').select('id').eq('workspace_id', workspace.id)
      .eq('contact_id', contact.id).eq('channel', 'whatsapp').maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      const inserted = await db.from('conversations').insert({
        workspace_id: workspace.id, contact_id: contact.id, channel: 'whatsapp'
      }).select('id').single();
      if (inserted.error) throw inserted.error;
      conversation = inserted.data;
    }

    const body = message.text?.body || message.button?.text || '';
    const { error: messageError } = await db.from('messages').upsert({
      workspace_id: workspace.id,
      conversation_id: conversation.id,
      provider: 'whatsapp_cloud_api',
      external_message_id: message.id,
      direction: 'inbound',
      type: message.type,
      body,
      provider_timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : null
    }, { onConflict: 'provider,external_message_id', ignoreDuplicates: true });
    if (messageError) throw messageError;

    await db.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id);

    return new Response(JSON.stringify({ accepted: true }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('whatsapp-webhook', error);
    // Non-2xx lets Meta retry transient failures.
    return new Response(JSON.stringify({ accepted: false }), { status: 500, headers: corsHeaders });
  }
});
