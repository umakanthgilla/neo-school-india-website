/** Actual cloud access QA. Credentials stay on the operator's Mac. No accounting writes. */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const origin='https://neo-finance-one-staging.umakanthgilla.workers.dev';
const api='/api/finance-one/v1';
const organizations=['QA_FIN_20261014_A','QA_FIN_20261014_B','QA_FIN_20261014_HO'];
const expectedAccounts=['fin:qa20261014_a_maker','fin:qa20261014_a_checker','fin:qa20261014_a_reader','fin:qa20261014_b_owner','fin:qa20261014_ho_owner'];
let passed=0;
let accessToken;
function check(ok,label){if(!ok)throw Error(label);passed++;console.log('PASS '+label);}
async function request(path,{token,method='GET',body,requestOrigin=origin}={}){
 const response=await fetch(origin+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Origin:requestOrigin,...(accessToken?{'cf-access-token':accessToken}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(response.status>=300&&response.status<400)throw Error('Cloudflare Access redirected this request; authenticate using cloudflared and rerun with --cloudflare-access. No redirect was followed.');
 return response;
}
async function main(){
 if(process.argv.length<3||process.argv.length>4||(process.argv[3]&&process.argv[3]!=='--cloudflare-access'))throw Error('Pass the local private-logins-rotated.json path and optionally --cloudflare-access');
 if(process.argv[3]){
  try{accessToken=execFileSync('cloudflared',['access','token','--app='+origin],{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','ignore']}).trim();}
  catch{throw Error('Cloudflare Access token unavailable. Complete cloudflared access login for the staging URL first.');}
  if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken))throw Error('Cloudflare Access did not return a valid token format');
 }
 const identities=JSON.parse(readFileSync(process.argv[2],'utf8'));
 if(!Array.isArray(identities)||identities.length!==5||new Set(identities.map(i=>i.accountId)).size!==5||identities.some(i=>!expectedAccounts.includes(i.accountId)||!organizations.includes(i.organizationId)||typeof i.password!=='string'))throw Error('Expected the five dedicated synthetic QA identities');
 const portal=await request('/portal.html');
 check(portal.status===200,'staging portal available');
 check(portal.headers.get('cache-control')==='no-store','portal caching disabled');
 check(portal.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"),'portal frame protection');
 check((await request(api+'/organizations/'+organizations[0]+'/documents')).status===401,'anonymous financial read denied');
 for(const identity of identities){
  const login=await request(api+'/session',{method:'POST',body:{organizationId:identity.organizationId,accountId:identity.accountId,password:identity.password}});
  check(login.status===200,'login '+identity.accountId);
  const {token}=await login.json();
  if(typeof token!=='string'||!token)throw Error('Missing session token');
  let revoked=false;
  try{
   const base=api+'/organizations/'+identity.organizationId;
   for(const resource of ['summary','documents','daily-ledger']){
    const response=await request(base+'/'+resource,{token});
    check(response.status===200,identity.role+' own '+resource);
    check(response.headers.get('cache-control')==='no-store',identity.role+' '+resource+' privacy');
    if(resource==='summary'){
     const report=await response.json();
     check(report.balanced===true&&report.trialBalance?.length===16,identity.role+' balanced 16-account chart');
    }
   }
   for(const other of organizations.filter(o=>o!==identity.organizationId))check((await request(api+'/organizations/'+other+'/documents',{token})).status===403,identity.accountId+' denied '+other);
   check((await request(base+'/documents',{token,requestOrigin:'https://untrusted.example'})).status===403,identity.role+' foreign origin denied');
   for(const resource of ['source-operations','corrections']){
    const response=await request(base+'/'+resource,{token});
    check(response.status===404,identity.role+' '+resource+' remains disabled');
   }
   check((await request(api+'/session/logout',{token,method:'POST'})).status===204,identity.role+' server logout');
   revoked=true;
   check((await request(base+'/documents',{token})).status===401,identity.role+' logged-out token replay denied');
  }finally{
   if(!revoked)await request(api+'/session/logout',{token,method:'POST'}).catch(()=>{});
  }
 }
 console.log('CLOUD ACCESS QA COMPLETE: '+passed+' checks passed. No source imports or financial postings performed.');
}
main().catch(error=>{console.error('QA STOPPED: '+(error?.name==='SyntaxError'?'private login JSON could not be parsed':error?.name==='TimeoutError'?'network timeout':error?.name==='TypeError'?'network request failed':error.message));process.exitCode=1;});
