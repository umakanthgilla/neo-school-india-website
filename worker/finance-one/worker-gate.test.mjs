import test from 'node:test';
import assert from 'node:assert/strict';
import {financeOneWorkerGate} from './worker-gate.mjs';
const makeRequest=(path)=>new Request('https://worker.example'+path);
const route='/api/finance-one/v1/organizations/A/daily-ledger';
const db={prepare(sql){return{bind(...values){return{all:async()=>{
 if(sql.includes('neo_fin_memberships'))return{results:[{organization_id:'A',account_id:'school:A',role:'owner',active:1}].filter(x=>x.organization_id===values[0]&&x.account_id===values[1])};
 if(sql.includes('neo_fin_daily_ledger'))return{results:[{event_id:'C1',amount_paise:500}]};
 throw Error('SQL');
}}}}}};
const enabled={DB:db,FINANCE_ONE_READ_API_ENABLED:'true'};
test('unrelated routes pass through',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest('/api/portal/foo'),env:enabled});assert.equal(r,null);
});
test('default flag off returns safe not found without DB reads',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:{DB:db},getSchoolSession:()=>{throw Error('should never run')}});
 assert.equal(r.status,404);
});
test('disabled/unknown finance session cannot access records',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:enabled,getSchoolSession:async()=>null});
 assert.equal(r.status,401);
});
test('verified school session plus explicit membership can read ledger',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:enabled,getSchoolSession:async()=>({school_id:'A'}),corsHeaders:()=>({'Access-Control-Allow-Origin':'https://neoschoolindia.com'})});
 assert.equal(r.status,200);assert.equal((await r.json()).entries[0].event_id,'C1');
 assert.equal(r.headers.get('access-control-allow-origin'),'https://neoschoolindia.com');
});
test('HO school cannot impersonate Center A through token',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:enabled,getSchoolSession:async()=>({school_id:'HO'})});
 assert.equal(r.status,403);
});
test('missing D1 database returns unavailable',async()=>{
 const r=await financeOneWorkerGate({request:makeRequest(route),env:{FINANCE_ONE_READ_API_ENABLED:'true'}});
 assert.equal(r.status,503);
});
