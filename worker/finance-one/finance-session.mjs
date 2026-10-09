/**
 * Dedicated Finance ONE session tokens. A legacy school/admin token is never
 * a Finance token. Issuance must occur ONLY after independent finance login.
 */
const encoder=new TextEncoder();
const decoder=new TextDecoder();
const ISSUER='neo-finance-one';
const AUDIENCE='finance-one-v1';
const encode=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function decode(part){
 if(typeof part!=='string'||!/^[A-Za-z0-9_-]+$/.test(part)||part.length>4096)throw Error('Invalid token');
 let s=part.replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);
 return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
async function key(secret){
 if(typeof secret!=='string'||secret.length<32)throw Error('Finance signing key unavailable');
 return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function issueFinanceOneToken({accountId,credentialVersion,secret,ttlMs=15*60*1000}){
 if(typeof accountId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(accountId))throw Error('Invalid finance account');
 if(!Number.isSafeInteger(credentialVersion)||credentialVersion<1)throw Error('Credential version required');
 if(!Number.isInteger(ttlMs)||ttlMs<60000||ttlMs>60*60*1000)throw Error('Invalid token lifetime');
 const payload={iss:ISSUER,aud:AUDIENCE,sub:accountId,scope:'finance',ver:credentialVersion,exp:Date.now()+ttlMs};
 const encoded=encode(encoder.encode(JSON.stringify(payload)));
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(encoded)));
 return encoded+'.'+encode(signature);
}
export async function readFinanceOneSession(request,env){
 try{
  const header=request.headers.get('Authorization')||'';
  if(!header.startsWith('Bearer '))return null;
  const token=header.slice(7).trim();
  if(token.length>4096)return null;
  const parts=token.split('.');if(parts.length!==2)return null;
  const secret=env?.FINANCE_ONE_SESSION_SECRET;
  const trusted=await key(secret);
  const valid=await crypto.subtle.verify('HMAC',trusted,decode(parts[1]),encoder.encode(parts[0]));
  if(!valid)return null;
  const p=JSON.parse(decoder.decode(decode(parts[0])));
  if(p.iss!==ISSUER||p.aud!==AUDIENCE||p.scope!=='finance'||
   !Number.isSafeInteger(p.exp)||p.exp<=Date.now()||p.exp>Date.now()+60*60*1000||
   !Number.isSafeInteger(p.ver)||p.ver<1||typeof p.sub!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(p.sub))return null;
  return Object.freeze({accountId:p.sub,credentialVersion:p.ver});
 }catch{return null;}
}
