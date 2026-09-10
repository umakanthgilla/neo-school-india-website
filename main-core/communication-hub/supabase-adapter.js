// ONE Communication Hub V1 — Supabase REST persistence adapter
// Publishable key identifies the client; authenticated access token enforces RLS.
// Never use service_role keys in browser code.

export class SupabaseAdapter {
  constructor({url, anonKey, workspaceId, accessToken}) {
    if (!url || !anonKey || !workspaceId || !accessToken) throw new Error('Supabase url, publishable key, workspaceId and accessToken are required');
    this.base = `${url.replace(/\/$/,'')}/rest/v1`;
    this.workspaceId = workspaceId;
    this.headers = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async request(path, options={}) {
    const res = await fetch(`${this.base}/${path}`, {...options, headers:{...this.headers,...options.headers}});
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    if (res.status === 204) return null;
    return res.json();
  }

  async listInbox() {
    // conversations -> contacts is a direct FK; leads are linked through contact_id,
    // so fetch them separately instead of asking PostgREST for a non-existent
    // direct conversations -> leads relationship.
    const conversations = await this.request(
      `conversations?workspace_id=eq.${encodeURIComponent(this.workspaceId)}&select=*,contacts(*)&order=updated_at.desc`
    );

    if (!conversations?.length) return [];

    const contactIds = [...new Set(conversations.map(c => c.contact_id).filter(Boolean))];
    let leadByContact = new Map();

    if (contactIds.length) {
      const inList = contactIds.map(id => `"${id}"`).join(',');
      const leads = await this.request(
        `leads?workspace_id=eq.${encodeURIComponent(this.workspaceId)}&contact_id=in.(${encodeURIComponent(inList)})&select=*&order=updated_at.desc`
      );
      for (const lead of leads || []) {
        if (!leadByContact.has(lead.contact_id)) leadByContact.set(lead.contact_id, lead);
      }
    }

    return conversations.map(c => ({
      ...c,
      leads: leadByContact.get(c.contact_id) || null
    }));
  }

  async getMessages(conversationId) {
    const q = `messages?workspace_id=eq.${encodeURIComponent(this.workspaceId)}&conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.asc`;
    return this.request(q);
  }

  async createTask(task) {
    return this.request('tasks', {
      method:'POST', headers:{Prefer:'return=representation'},
      body:JSON.stringify({...task, workspace_id:this.workspaceId})
    });
  }

  async saveInboundMessage(message) {
    return this.request('messages', {
      method:'POST', headers:{Prefer:'return=representation'},
      body:JSON.stringify({...message, workspace_id:this.workspaceId, direction:'inbound'})
    });
  }

  async queueApprovedReply(action) {
    return this.request('action_log', {
      method:'POST', headers:{Prefer:'return=representation'},
      body:JSON.stringify({...action, workspace_id:this.workspaceId, status:'approved'})
    });
  }
}
