// ONE Communication Hub V1 data layer
// Safe pilot adapter: demo mode works without credentials; Supabase can be enabled later.

export const ONE_CONFIG = {
  workspaceSlug: 'neo-school-india',
  mode: 'demo', // change to 'supabase' only after environment credentials are configured
  supabaseUrl: '',
  supabaseAnonKey: ''
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

export async function listInbox(){
  if(ONE_CONFIG.mode === 'demo') return demo.conversations.map(c=>({
    ...c,
    contact: demo.contacts.find(x=>x.id===c.contact_id),
    lead: demo.leads.find(x=>x.contact_id===c.contact_id)
  }));
  throw new Error('Supabase adapter not configured');
}

export async function getConversation(id){
  if(ONE_CONFIG.mode === 'demo') return demo.messages[id] || [];
  throw new Error('Supabase adapter not configured');
}

export async function createFollowUp({leadId,dueAt,note}){
  return {id:crypto.randomUUID(),lead_id:leadId,due_at:dueAt,note,status:'open'};
}

export async function createTask({leadId,title,dueAt}){
  return {id:crypto.randomUUID(),lead_id:leadId,title,due_at:dueAt,status:'open'};
}

export async function approveAiReply({conversationId,text}){
  // V1 deliberately does not auto-send. This creates an approved outbound action
  // for the WhatsApp adapter to execute once credentials/webhook are configured.
  return {id:crypto.randomUUID(),conversation_id:conversationId,text,approved:true,status:'queued'};
}
