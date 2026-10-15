/** Operator-only rollout to the fixed isolated staging Worker. Never runs on import. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const SOURCE_SHA='bda278e7e5272bacd37ef53b7e92d60cef581c5a';
const TREE_SHA='105ca2c45e089649076271f058a25f77534847c9';
const repo='umakanthgilla/neo-school-india-website';
const https=host=>'https:'+'//'+host;
const origin=https('neo-finance-one-staging.umakanthgilla.workers.dev');
const issuer=https('lingering-bird-11ec.cloudflareaccess.com');
const accountId='fin:qa20261014_a_checker',organizationId='QA_FIN_20261014_A';
export function rolloutInputs({audience,subject,email}){
 if(typeof audience!=='string'||!/^[a-f0-9]{64}$/.test(audience)||typeof subject!=='string'||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(subject)||
  typeof email!=='string'||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid reviewed Access identity');
 return {audience,subject,email};
}
export function stagingConfig(input){
 const {audience,subject}=rolloutInputs(input);
 return `name = "neo-finance-one-staging"
account_id = "9e116ff1df56f3e8aa0da63f21e9ba97"
main = "worker/finance-one/staging-entry.mjs"
compatibility_date = "2026-10-09"
workers_dev = true
[vars]
FINANCE_ONE_ENVIRONMENT = "staging"
FINANCE_ONE_READ_API_ENABLED = "true"
FINANCE_ONE_OPERATIONS_ENABLED = "false"
FINANCE_ONE_SOURCE_OPERATIONS_ENABLED = "false"
FINANCE_ONE_SEPARATE_SOURCE_ENABLED = "false"
FINANCE_ONE_ACCESS_LOGIN_ENABLED = "true"
FINANCE_ONE_ACCESS_ISSUER = ${JSON.stringify(issuer)}
FINANCE_ONE_ACCESS_AUDIENCE = ${JSON.stringify(audience)}
FINANCE_ONE_ACCESS_IDENTITIES = '${JSON.stringify([{subject,accountId}])}'
[[d1_databases]]
binding = "DB"
database_name = "neo-finance-one-staging"
database_id = "17c1d0d7-aab1-4e4a-9afe-6b36554b8f93"
[assets]
directory = "./finance-one"
binding = "ASSETS"
run_worker_first = true
not_found_handling = "none"
[[ratelimits]]
name = "FINANCE_ONE_LOGIN_CLIENT_LIMIT"
namespace_id = "1791554520"
simple = { limit = 20, period = 60 }
[[ratelimits]]
name = "FINANCE_ONE_LOGIN_ACCOUNT_LIMIT"
namespace_id = "1791554521"
simple = { limit = 8, period = 60 }
`;
}
export function releaseFiles(tree){
 if(tree?.truncated!==false||tree.sha!==TREE_SHA||!Array.isArray(tree.tree))throw Error('Pinned source tree unavailable');
 const selected=tree.tree.filter(e=>typeof e.path==='string'&&(
  /^worker\/finance-one\/[a-z0-9-]+\.mjs$/.test(e.path)&&!e.path.endsWith('.test.mjs')||
  ['finance-one/portal.html','package.json','package-lock.json'].includes(e.path)));
 if(selected.length<25||selected.length>100||new Set(selected.map(e=>e.path)).size!==selected.length||
  selected.some(e=>e.type!=='blob'||e.mode!=='100644'||!/^[a-f0-9]{40}$/.test(e.sha)))throw Error('Unexpected source inventory');
 for(const path of ['finance-one/portal.html','package.json','package-lock.json','worker/finance-one/staging-entry.mjs','worker/finance-one/access-identity.mjs'])
  if(!selected.some(e=>e.path===path))throw Error('Missing required source');
 return selected;
}
export function validBlob(bytes,sha){return createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')===sha;}
export async function stagingAccessSmoke(accessToken,{request=fetch}={}){
 let passed=0;
 const check=async(path,expected,{method='GET',token,body,requestOrigin=origin}={})=>{
  const r=await request(origin+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Origin:requestOrigin,'cf-access-token':accessToken,
   ...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(r.status!==expected){const error=Error('Staging smoke check failed');error.smoke={path,status:r.status,expected,cfRay:r.headers.get('cf-ray')};throw error;}
  passed++;return r;
 };
 const api='/api/finance-one/v1',base=api+'/organizations/'+organizationId;
 const portal=await check('/portal.html',200);const html=await portal.text();
 if(portal.headers.get('cache-control')!=='no-store'||!html.includes('id="access-sign-in"')||html.includes('id="access-sign-in" hidden'))throw Error('Access portal unavailable');
 await check(base+'/documents',401);
 for(let attempt=0;attempt<3;attempt++){
  const response=await check(api+'/session/access',200,{method:'POST',body:{organizationId}});
  const login=await response.json();const token=login.token;
  if(typeof token!=='string'||!token||login.organizationId!==organizationId)throw Error('Finance session unavailable');
  let revoked=false;
  try{
   const summary=await(await check(base+'/summary',200,{token})).json();
   if(summary.organizationId!==organizationId||summary.balanced!==true||summary.trialBalance?.length!==16)throw Error('QA chart or summary mismatch');
   for(const other of ['QA_FIN_20261014_B','QA_FIN_20261014_HO'])await check(api+'/organizations/'+other+'/documents',403,{token});
   await check(base+'/documents',403,{token,requestOrigin:'https:'+'//'+'untrusted.invalid'});
   for(const operation of ['source-operations','corrections'])await check(base+'/'+operation,404,{token});
   await check(api+'/session/logout',204,{method:'POST',token});revoked=true;
   await check(base+'/documents',401,{token});
  }finally{if(!revoked)await check(api+'/session/logout',204,{method:'POST',token}).catch(()=>{});}
 }
 return {passed,sessions:3,organizationId};
}
export async function executeStagingAccessRollout(input){
 rolloutInputs(input);let phase='prepare',root;
 const checked=async(url)=>{const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Download HTTP '+r.status);return r;};
 try{
  root=mkdtempSync(join(homedir(),'neo-finance-access-release.'));console.log('Staging release folder: '+root);
  const api=https('api.github.com')+'/repos/'+repo;
  phase='verify-pinned-ci';
  const ci=await(await checked(api+'/actions/runs/38686960687')).json();
  if(ci.head_sha!==SOURCE_SHA||ci.status!=='completed'||ci.conclusion!=='success')throw Error('Pinned CI not passing');
  phase='download-verified-source';
  const files=releaseFiles(await(await checked(api+'/git/trees/'+TREE_SHA+'?recursive=1')).json());
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<files.length){const entry=files[cursor++];
   const bytes=Buffer.from(await(await checked(https('raw.githubusercontent.com')+'/'+repo+'/'+SOURCE_SHA+'/'+entry.path)).arrayBuffer());
   if(!validBlob(bytes,entry.sha))throw Error('Source checksum mismatch');
   const path=join(root,entry.path);mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,bytes,{mode:0o600,flag:'wx'});
  }}));
  writeFileSync(join(root,'SOURCE_SHA.txt'),SOURCE_SHA+'\n',{mode:0o600,flag:'wx'});
  const config=join(root,'wrangler.access.staging.toml');writeFileSync(config,stagingConfig(input),{mode:0o600,flag:'wx'});
  const run=(binary,args,capture=false)=>execFileSync(binary,args,{cwd:root,timeout:300000,maxBuffer:4*1024*1024,
   env:{...process.env,CI:'true'},encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit'});
  const wrangler=(args,capture=false)=>run('npx',['--yes','wrangler@4.129.1',...args,'--config',config],capture);
  phase='verify-cloudflare-identity';
  const binary=join(homedir(),'neo-finance-backup.9LrtWd/tools/cloudflared-2026.10.0/cloudflared');
  const accessToken=run(binary,['access','token','--app='+origin],true).trim();
  if(!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken))throw Error('Access token unavailable');
  const {accessConfiguration,verifyAccessIdentity}=await import(pathToFileURL(join(root,'worker/finance-one/access-identity.mjs')).href);
  const accessEnv={FINANCE_ONE_ACCESS_ISSUER:issuer,FINANCE_ONE_ACCESS_AUDIENCE:input.audience,
   FINANCE_ONE_ACCESS_IDENTITIES:JSON.stringify([{subject:input.subject,accountId}])};
  await verifyAccessIdentity(new Request(origin,{headers:{'Cf-Access-Jwt-Assertion':accessToken}}),accessConfiguration(accessEnv));
  const claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));
  if(claims.email!==input.email)throw Error('Reviewed email mismatch');
  phase='verify-existing-staging-account';
  const sql=`SELECT a.active,a.credential_version,a.locked_until,m.role,m.active AS membership_active,o.status FROM neo_fin_auth_accounts a JOIN neo_fin_memberships m ON m.account_id=a.account_id JOIN neo_fin_organizations o ON o.id=m.organization_id WHERE a.account_id='fin:qa20261014_a_checker' AND m.organization_id='QA_FIN_20261014_A'`;
  const checks=JSON.parse(wrangler(['d1','execute','neo-finance-one-staging','--remote','--json','--command',sql],true));
  const row=checks?.[0]?.results?.[0];
  if(checks.length!==1||checks[0].success!==true||checks[0].results.length!==1||row?.active!==1||row.membership_active!==1||row.role!=='owner'||row.status!=='active'||
   !Number.isSafeInteger(row.credential_version)||row.credential_version<1||Number(row.locked_until||0)>Date.now())throw Error('QA Finance account unavailable');
  phase='record-staging-rollback';
  writeFileSync(join(root,'before-deployments.txt'),wrangler(['deployments','list'],true),{mode:0o600,flag:'wx'});
  const secrets=JSON.parse(wrangler(['secret','list'],true));
  if(!Array.isArray(secrets)||!secrets.some(s=>s.name==='FINANCE_ONE_SESSION_SECRET'))throw Error('Existing Finance signing secret unavailable');
  phase='install-pinned-dependency';run('npm',['ci','--omit=dev','--no-audit','--no-fund']);
  phase='bundle-dry-run';wrangler(['deploy','--dry-run']);
  phase='deploy-isolated-staging';const deployment=wrangler(['deploy'],true);console.log(deployment);
  const versionId=deployment.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]||null;
  writeFileSync(join(root,'deployment-evidence.json'),JSON.stringify({sourceSha:SOURCE_SHA,versionId,organizationId,operationsEnabled:false,sourceOperationsEnabled:false},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('STAGING DEPLOYMENT COMPLETE. Source '+SOURCE_SHA+'. No migrations or financial postings executed.');
  phase='cloud-login-isolation-logout-smoke';
  const result=await stagingAccessSmoke(accessToken);
  writeFileSync(join(root,'cloud-access-smoke.json'),JSON.stringify({...result,sourceSha:SOURCE_SHA,versionId,completedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('PASS STAGING ACCESS: '+result.passed+' checks; three login/logout sessions; Center B/HO isolation; operations OFF. Version '+(versionId||'see deployment output'));
  console.log('Open the existing staging portal, enter '+organizationId+' and choose Continue with authorized Cloudflare login.');
  console.log('Corrections/imports remain OFF. This is not production acceptance.');
  return {sourceSha:SOURCE_SHA,root};
 }catch(error){
  console.error('STAGING STOPPED: '+phase+'. No secrets printed. Release folder: '+(root||'not created'));
  if(error.smoke)console.error('Safe smoke diagnostic: '+JSON.stringify(error.smoke));
  if(phase==='deploy-isolated-staging')console.error('Deployment outcome unconfirmed: inspect staging deployments before retrying.');
  if(phase==='cloud-login-isolation-logout-smoke')console.error('Worker deployed; cloud acceptance incomplete. Do not enable operations.');
  throw Error('Staging rollout stopped');
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [flag,audience,subject,email,...extra]=process.argv.slice(2);
 if(flag!=='--execute-staging'||extra.length){console.error('Explicit --execute-staging AUD SUBJECT EMAIL required');process.exitCode=1;}
 else executeStagingAccessRollout({audience,subject,email}).catch(()=>{process.exitCode=1;});
}
