import { listInbox, getConversation, createFollowUp, createTask, approveAiReply } from './data.js';
import { signInWithPassword } from './auth.js';

const state = { inbox: [], active: null };
const qs = s => document.querySelector(s);
function esc(v=''){ return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderInbox(){
  const root = qs('.threads'); if(!root) return;
  root.innerHTML = state.inbox.length ? state.inbox.map(item => `
    <article class="thread ${state.active?.id===item.id?'active':''}" data-id="${esc(item.id)}">
      <div class="thread-top"><span class="name">${esc(item.contacts?.name || item.contact?.name || 'Unknown')}</span><span class="time">${esc(item.channel)}</span></div>
      <div class="preview">${esc(item.leads?.interest || item.lead?.interest || item.leads?.type || 'Conversation')}</div>
      <div class="badges"><span class="badge">${esc(item.channel)}</span><span class="badge ai">AI Ready</span></div>
    </article>`).join('') : '<div style="padding:20px">No conversations yet.</div>';
  root.querySelectorAll('.thread').forEach(el=>el.addEventListener('click',()=>openConversation(el.dataset.id)));
}

async function openConversation(id){
  state.active = state.inbox.find(x=>x.id===id); renderInbox();
  const msgs = await getConversation(id);
  const root = qs('.messages'); if(!root) return;
  root.innerHTML = msgs.map(m=>`<div class="bubble ${m.direction==='outbound'?'outgoing':'incoming'}">${esc(m.body)}</div>`).join('');
  root.insertAdjacentHTML('beforeend', `<div class="ai-card"><b>ONE AI · Suggested Reply</b><p id="aiDraft">Yes. We can help you with the next step. Please share your preferred day and time.</p><button class="approve" id="approveAi">Approve & Queue</button><button class="edit" id="editAi">Edit</button><div class="status">Human approval required · V1 pilot mode</div></div>`);
  const contact = state.active?.contacts || state.active?.contact;
  const lead = state.active?.leads || state.active?.lead;
  qs('.chat-title b').textContent = contact?.name || 'Conversation';
  qs('.chat-title span').textContent = `${state.active?.channel || ''} · Linked Lead · ${lead?.interest || ''}`;
  qs('#approveAi')?.addEventListener('click', approveDraft);
  qs('#editAi')?.addEventListener('click', ()=>{ const p=qs('#aiDraft'); p.contentEditable='true'; p.focus(); });
}

async function approveDraft(){
  if(!state.active) return;
  const text = qs('#aiDraft')?.textContent?.trim(); if(!text) return;
  const action = await approveAiReply({conversationId:state.active.id,text});
  qs('#approveAi').textContent = action?.status === 'queued' ? 'Queued ✓' : 'Approved ✓';
  qs('#approveAi').disabled = true;
}

function bindActions(){
  const buttons=[...document.querySelectorAll('.actions button')];
  buttons.find(b=>b.textContent.trim()==='Follow-up')?.addEventListener('click', async()=>{
    const lead = state.active?.leads || state.active?.lead;
    if(!lead?.id) return alert('No linked lead');
    await createFollowUp({leadId:lead.id,dueAt:new Date(Date.now()+86400000).toISOString(),note:'Follow up from Communication Hub'});
    alert('Follow-up created for tomorrow');
  });
  buttons.find(b=>b.textContent.trim()==='Task')?.addEventListener('click', async()=>{
    const lead = state.active?.leads || state.active?.lead;
    if(!lead?.id) return alert('No linked lead');
    await createTask({leadId:lead.id,title:'Contact lead',dueAt:new Date(Date.now()+86400000).toISOString()});
    alert('Task created');
  });
  qs('.search')?.addEventListener('input',e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll('.thread').forEach(el=>el.style.display=el.textContent.toLowerCase().includes(q)?'':'none');
  });
}

function renderLogin(){
  const root = qs('.messages');
  qs('.threads').innerHTML = '<div style="padding:20px">Admin sign-in required.</div>';
  root.innerHTML = `<div class="login-card"><h3>Main Core Admin</h3><p>Sign in with the Supabase admin user created for this workspace.</p><form id="loginForm"><input id="loginEmail" type="email" autocomplete="username" placeholder="Email" required><input id="loginPassword" type="password" autocomplete="current-password" placeholder="Password" required><button type="submit">Sign in</button><div class="login-error" id="loginError"></div></form></div>`;
  qs('#loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const btn=e.currentTarget.querySelector('button'); btn.disabled=true; btn.textContent='Signing in…';
    try{
      await signInWithPassword(qs('#loginEmail').value.trim(), qs('#loginPassword').value);
      location.reload();
    }catch(err){
      qs('#loginError').textContent='Sign-in failed. Check email/password.';
      btn.disabled=false; btn.textContent='Sign in';
    }
  });
}

async function init(){
  try{
    state.inbox = await listInbox();
    state.active = state.inbox[0] || null;
    renderInbox(); bindActions();
    if(state.active) await openConversation(state.active.id);
    else qs('.messages').innerHTML='<div style="padding:24px">Connected to Main Core. No conversations yet.</div>';
  }catch(err){
    console.error(err);
    if(String(err?.message||err).includes('AUTH_REQUIRED')) return renderLogin();
    const root=qs('.threads'); if(root) root.innerHTML='<div style="padding:20px">Unable to load inbox.</div>';
    const msg=qs('.messages'); if(msg) msg.innerHTML='<div style="padding:24px">Connection error. Check Supabase configuration and RLS.</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
