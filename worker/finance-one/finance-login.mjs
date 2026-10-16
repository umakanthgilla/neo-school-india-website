/** Internal Finance ONE login route, isolated from school/admin authentication. */
import {verifyFinancePassword} from './finance-password.mjs';
import {issueFinanceOneToken} from './finance-session.mjs';
import {checkFinanceLoginClientLimit,checkFinanceLoginAccountLimit} from './login-rate-limit.mjs';
import {accessConfiguration,verifyAccessIdentity,accessFailure} from './access-identity.mjs';
import {activeFinanceCredential} from './finance-password.mjs';
const route='/api/finance-one/v1/session';
const json=(body,status,extra={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
async function smallJson(request){
 const body=request.body;if(!body)throw Error('Missing body');
 const reader=body.getReader();let chunks=[],size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('Body too large');chunks.push(value);}}
 finally{reader.releaseLock();}
 const merged=new Uint8Array(size);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(merged));
}
export async function handleFinanceLogin({request,env}){
 const path=new URL(request.url).pathname,access=path===route+'/access';
 if(path!==route&&!access)return null;
 if(access&&env?.FINANCE_ONE_ACCESS_LOGIN_ENABLED!=='true')return json({error:'Not found'},404);
 if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
 if(env?.FINANCE_ONE_ENVIRONMENT!=='staging' || env?.FINANCE_ONE_READ_API_ENABLED!=='true')return json({error:'Not found'},404);
 if(!env.DB||typeof env.FINANCE_ONE_SESSION_SECRET!=='string'||env.FINANCE_ONE_SESSION_SECRET.length<32)return json({error:'Finance login unavailable'},503);
 const clientLimit=await checkFinanceLoginClientLimit({request,env});
 if(clientLimit)return clientLimit;
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return json({error:'Expected JSON'},415);
 let input;try{input=await smallJson(request);}catch{return json({error:'Invalid request'},400);}
 let {accountId,password,organizationId}=input||{};
 let accessIdentity;
 if(access){
  let config;try{config=accessConfiguration(env);}catch{return json({error:'Finance Access login unavailable'},503);}
  try{accessIdentity=await verifyAccessIdentity(request,config);accountId=accessIdentity.accountId;}
  catch(error){const failure=accessFailure(error);return json({error:failure.status===503?'Finance Access verification temporarily unavailable':'Finance Access identity could not be verified',code:failure.code},failure.status);}
 }
 if(typeof accountId!=='string'||!accountId.startsWith('fin:')||accountId.length>128||(!access&&(typeof password!=='string'||password.length>256))||
  typeof organizationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(organizationId))return json({error:'Invalid credentials'},401);
 const accountLimit=await checkFinanceLoginAccountLimit({env,accountId});
 if(accountLimit)return accountLimit;
 try{
  let identity;
  if(access){
   const row=await env.DB.prepare('SELECT credential_version FROM neo_fin_auth_accounts WHERE account_id=?').bind(accountId).first();
   if(row&&await activeFinanceCredential(env.DB,accountId,row.credential_version))identity={credentialVersion:row.credential_version};
  }else identity=await verifyFinancePassword({db:env.DB,accountId,password});
  if(!identity)return json({error:'Invalid credentials'},401);
  // A separate active Finance membership is required for the selected legal business.
  const membership=await env.DB.prepare(`SELECT 1 AS allowed FROM neo_fin_memberships m
   JOIN neo_fin_organizations o ON o.id=m.organization_id
   WHERE m.account_id=? AND m.organization_id=? AND m.active=1
     AND m.role IN ('owner','finance_admin','accountant','auditor','payroll_admin') AND o.status='active' LIMIT 1`).bind(accountId,organizationId).first();
  if(!membership)return json({error:'Invalid credentials'},401);
  const ttlMs=access?Math.min(900000,accessIdentity.expiresAt-Date.now()):900000;
  if(ttlMs<60000)return json({error:'Refresh Cloudflare Access login'},401);
  const token=await issueFinanceOneToken({accountId,credentialVersion:identity.credentialVersion,secret:env.FINANCE_ONE_SESSION_SECRET,ttlMs});
  return json({token,tokenType:'Bearer',expiresInSeconds:Math.floor(ttlMs/1000),organizationId},200);
 }catch{return json({error:'Finance login unavailable'},503);}
}
