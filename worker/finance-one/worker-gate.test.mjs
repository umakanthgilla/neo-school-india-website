import test from 'node:test';
import assert from 'node:assert/strict';
import {financeOneWorkerGate} from './worker-gate.mjs';
import {issueFinanceOneToken} from './finance-session.mjs';
const secret='very-long-demo-secret-key-not-for-production-123456';
const makeRequest=(path,token)=>new Request('https://worker.example'+path,token?{headers:{Authorization:'Bearer '+token}}:{});
const route='/api/finance-one/v1/organizations/A/daily-ledger';
const db={prepare(sql){return{bind(...values){return{first:async()=>{if(sql.includes('neo_fin_auth_accounts'))return{active:1,credential_version:1,locked_until:null};throw Error('SQL');},all:async()=>{
 if(sql.includes('neo_fin_memberships'))return{results:[{organization_id:'A',account_id:'fin:alice',role:'owner',active:1}].filter(x=>x.organization_id===values[0]&&x.account_id===values[1])};
 if(sql.includes('neo_fin_daily_ledger'))return{results:[{event_id:'C1',amount_paise:500}]};
 throw Error('SQL');
}}}}}};
const enabled={DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:secret};
test('unrelated routes pass through',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest('/api/portal/foo'),env:enabled});assert.equal(r,null);
});
test('default flag off returns safe not found',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:{DB:db}});assert.equal(r.status,404);
});
test('legacy school token cannot access private finance',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route,'legacy.school.token'),env:enabled});assert.equal(r.status,401);
});
test('dedicated finance login and explicit business membership allows read',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 const r=await financeOneWorkerGate({request:makeRequest(route,token),env:enabled,corsHeaders:()=>({'Access-Control-Allow-Origin':'https://neoschoolindia.com'})});
 assert.equal(r.status,200);assert.equal((await r.json()).entries[0].event_id,'C1');
 assert.equal(r.headers.get('access-control-allow-origin'),'https://neoschoolindia.com');
});
test('valid Finance token without membership cannot read another Center',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:someone-else',credentialVersion:1,secret});
 const r=await financeOneWorkerGate({request:makeRequest(route,token),env:enabled});assert.equal(r.status,403);
});
test('missing D1 database returns unavailable',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:{FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true'}});assert.equal(r.status,503);
});

test('production Worker never serves Finance ONE even if flag and signed credentials exist',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 const response=await financeOneWorkerGate({request:makeRequest(route,token),env:{...enabled,FINANCE_ONE_ENVIRONMENT:'production'}});
 assert.equal(response.status,404);
});
