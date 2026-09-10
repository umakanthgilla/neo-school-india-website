const cfg = () => window.ONE_RUNTIME_CONFIG || {};

function authHeaders(accessToken){
  const c = cfg();
  const headers = {
    apikey: c.supabasePublishableKey,
    'Content-Type': 'application/json'
  };
  if(accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export function getStoredSession(){
  try { return JSON.parse(localStorage.getItem('one_session') || 'null'); }
  catch { return null; }
}

export function clearStoredSession(){
  localStorage.removeItem('one_session');
}

export async function signInWithPassword(email,password){
  const c = cfg();
  if(!c.supabaseUrl || !c.supabasePublishableKey) throw new Error('Supabase runtime config missing');

  const res = await fetch(`${c.supabaseUrl.replace(/\/$/,'')}/auth/v1/token?grant_type=password`, {
    method:'POST',
    headers:authHeaders(),
    body:JSON.stringify({email,password})
  });
  if(!res.ok) throw new Error(await res.text());
  const session = await res.json();
  localStorage.setItem('one_session', JSON.stringify(session));
  return session;
}

export async function refreshSessionIfNeeded(){
  const session = getStoredSession();
  if(!session) return null;
  const expiresAt = session.expires_at || 0;
  if(expiresAt * 1000 > Date.now() + 60000) return session;
  if(!session.refresh_token) return null;

  const c = cfg();
  const res = await fetch(`${c.supabaseUrl.replace(/\/$/,'')}/auth/v1/token?grant_type=refresh_token`, {
    method:'POST',
    headers:authHeaders(),
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  if(!res.ok){ clearStoredSession(); return null; }
  const next = await res.json();
  localStorage.setItem('one_session', JSON.stringify(next));
  return next;
}
