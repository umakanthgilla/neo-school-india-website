// ONE Communication Hub V1 data layer

import { SupabaseAdapter } from './supabase-adapter.js';
import { refreshSessionIfNeeded } from './auth.js';

export const ONE_CONFIG = {
  workspaceSlug: window.ONE_RUNTIME_CONFIG?.workspaceSlug || 'neo-school-india',
  mode: window.ONE_RUNTIME_CONFIG?.mode || 'demo',
  supabaseUrl: window.ONE_RUNTIME_CONFIG?.supabaseUrl || '',
  supabasePublishableKey: window.ONE_RUNTIME_CONFIG?.supabasePublishableKey || ''
};

const demo = {
  contacts: [
    { id:'c1', name:'Parent Enquiry', phone:'+91XXXXXXXXXX', source:'whatsapp' },
    { id:'c2', name:'Franchise Enquiry', phone:'+91XXXXXXXXXX', source:'whatsapp' }
  ],
  leads: [
    { id:'l1', contact_id:'c1', type:'admission', stage:'new', interest:'Nursery', priority:'warm' },
    { id:'l2', contact_id:'c2', type:'franchise', stage:'new', interest:'Franchise', priority:'hot' }
  ],
  conversations: [
    { id:'cv1', contact_id:'c1', channel:'whatsapp', status:'open', unread:1, updated_at:'2026-09-10T11:42:00+05:30' },
    { id:'cv2', contact_id:'c2', channel:'whatsapp', status:'open', unread:0, updated_at:'2026-09-10T10:18:00+05:30' }
  ],
  messages: {
    cv1:[
      {id:'m1',direction:'inbound',body:'Hello, I want Nursery admission details for my child.',status:'received'},
      {id:'m2',direction:'outbound',body:'Welcome to Neo School India. I can help you with the admission information.',status:'delivered'},
      {id:'m3',direction:'inbound',body:'What are the timings and can I visit the school?',status:'received'}
    ]
  }
};

let adapterPromise = null;

async function getAdapter(){
  if(ONE_CONFIG.mode !== 'supabase') return null;
  if(adapterPromise) return adapterPromise;

  adapterPromise = (async()=>{
    const session = await refreshSessionIfNeeded();
    if(!session?.access_token) throw new Error('AUTH_REQUIRED');

    const base = `${ONE_CONFIG.supabaseUrl.replace(/\/$/,'')}/rest/v1`;
    const headers = {
      apikey: ONE_CONFIG.supabasePublishableKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type':'application/json'
    };

    const wsRes = await fetch(`${base}/workspaces?slug=eq.${encodeURIComponent(ONE_CONFIG.workspaceSlug)}&select=id&limit=1`, {headers});
    if(!wsRes.ok) throw new Error(await wsRes.text());
    const rows = await wsRes.json();
    if(!rows[0]?.id) throw new Error('Workspace not available for this user');

    return new SupabaseAdapter({
      url: ONE_CONFIG.supabaseUrl,
      anonKey: ONE_CONFIG.supabasePublishableKey,
      workspaceId: rows[0].id,
      accessToken: session.access_token
    });
  })();

  return adapterPromise;
}

export async function listInbox(){
  if(ONE_CONFIG.mode === 'demo') return demo.conversations.map(c=>({
    ...c,
    contact: demo.contacts.find(x=>x.id===c.contact_id),
    lead: demo.leads.find(x=>x.contact_id===c.contact_id)
  }));
  const db = await getAdapter();
  return db.listInbox();
}

export async function getConversation(id){
  if(ONE_CONFIG.mode === 'demo') return demo.messages[id] || [];
  const db = await getAdapter();
  return db.getMessages(id);
}

export async function createFollowUp({leadId,dueAt,note}){
  if(ONE_CONFIG.mode === 'demo') return {id:crypto.randomUUID(),lead_id:leadId,due_at:dueAt,note,status:'open'};
  const db = await getAdapter();
  return db.createTask({lead_id:leadId,title:'Follow-up',note,due_at:dueAt,status:'open'});
}

export async function createTask({leadId,title,dueAt}){
  if(ONE_CONFIG.mode === 'demo') return {id:crypto.randomUUID(),lead_id:leadId,title,due_at:dueAt,status:'open'};
  const db = await getAdapter();
  return db.createTask({lead_id:leadId,title,due_at:dueAt,status:'open'});
}

export async function approveAiReply({conversationId,text}){
  if(ONE_CONFIG.mode === 'demo') return {id:crypto.randomUUID(),conversation_id:conversationId,text,approved:true,status:'queued'};
  const db = await getAdapter();
  const rows = await db.queueApprovedReply({
    conversation_id: conversationId,
    action_type: 'outbound_reply',
    payload: {text},
    approved_at: new Date().toISOString()
  });
  return Array.isArray(rows) ? rows[0] : rows;
}
