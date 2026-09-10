// ONE Communication Hub V1 — Supabase REST persistence adapter
// Uses public anon key only for browser-safe reads/writes permitted by RLS.
// Never use service_role keys in browser code.

export class SupabaseAdapter {
  constructor({url, anonKey, workspaceId}) {
    if (!url || !anonKey || !workspaceId) throw new Error('Supabase url, anonKey and workspaceId are required');
    this.base = `${url.replace(/\/$/,'')}/rest/v1`;
    this.workspaceId = workspaceId;
    this.headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
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
    const q = `conversations?workspace_id=eq.${encodeURIComponent(this.workspaceId)}&select=*,contacts(*),leads(*)&order=updated_at.desc`;
    return this.request(q);
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
