import test from 'node:test';
import assert from 'node:assert/strict';
import {handleFinanceReadApi} from './finance-read-api.mjs';

const memberships=[
 {organization_id:'HO',account_id:'ho',role:'owner',active:1},
 {organization_id:'A',account_id:'alice',role:'owner',active:1},
 {organization_id:'B',account_id:'bob',role:'owner',active:1},
 {organization_id:'A',account_id:'teacher',role:'employee',active:1},
];
function fixture(){
 const queries=[];
 const db={
  prepare(sql){
   return {
    bind(...values){
     queries.push({sql,values});
     return {
      async all(){
       if(sql.includes('neo_fin_memberships'))return{results:memberships.filter(m=>m.organization_id===values[0]&&m.account_id===values[1]&&m.active===1)};
       if(sql.includes('neo_fin_documents'))return{results:[{id:'DOC_'+values[0],document_type:'sales_invoice',gross_paise:12345}]};
       if(sql.includes('GROUP BY a.id'))return{results:[{account_code:'1000',account_name:'Bank',account_type:'asset',debit_paise:500,credit_paise:0},{account_code:'4000',account_name:'Revenue',account_type:'income',debit_paise:0,credit_paise:500}]};
       if(sql.includes('GROUP BY direction'))return{results:[{direction:'money_in',amount_paise:500}]};
       if(sql.includes('neo_fin_daily_ledger'))return{results:[{event_id:'CASH_'+values[0],direction:'money_in',amount_paise:500}]};
       throw new Error('Unexpected database SQL');
      }
     };
    }
   };
  }
 };
 return {queries,db};
}
const req=(org,resource,opts={})=>new Request(`https://example.org/api/finance-one/v1/organizations/${org}/${resource}${opts.q||''}`,{method:opts.method||'GET'});
const call=(f,accountId,org,resource,opts={})=>handleFinanceReadApi({request:req(org,resource,opts),db:f.db,authenticatedAccountId:accountId});
test('Center A can read only its own Daily Ledger',async()=>{
 const f=fixture();const resp=await call(f,'alice','A','daily-ledger');
 assert.equal(resp.status,200);assert.equal(resp.headers.get('cache-control'),'no-store');
 assert.equal((await resp.json()).entries[0].event_id,'CASH_A');
 assert.equal(f.queries.at(-1).values[0],'A');
});
test('HO cannot read Center A private ledger or documents',async()=>{
 const f=fixture();assert.equal((await call(f,'ho','A','daily-ledger')).status,403);
 assert.equal((await call(f,'ho','A','documents')).status,403);
 assert.equal(f.queries.filter(q=>q.sql.includes('neo_fin_documents')).length,0);
});
test('other center and school employee cannot read private finance',async()=>{
 const f=fixture();assert.equal((await call(f,'bob','A','summary')).status,403);
 assert.equal((await call(f,'teacher','A','daily-ledger')).status,403);
});
test('Center owner can read only business documents',async()=>{
 const f=fixture();const resp=await call(f,'alice','A','documents',{q:'?limit=12'});
 assert.equal(resp.status,200);assert.equal((await resp.json()).documents[0].id,'DOC_A');
 assert.deepEqual(f.queries.at(-1).values,['A',12]);
});
test('Center owner gets balanced summary from journal and cash projection',async()=>{
 const f=fixture();const resp=await call(f,'alice','A','summary');
 assert.equal(resp.status,200);const report=await resp.json();
 assert.equal(report.organizationId,'A');assert.equal(report.balanced,true);
 assert.equal(report.moneyInPaise,500);assert.equal(report.profitPaise,500);
});
test('requires verified server identity, cannot spoof with query string',async()=>{
 const f=fixture();const response=await call(f,undefined,'A','documents',{q:'?accountId=alice'});
 assert.equal(response.status,401);assert.equal(f.queries.length,0);
});
test('non-GET methods refused even if identity valid',async()=>{
 const f=fixture();const response=await call(f,'alice','A','daily-ledger',{method:'POST'});
 assert.equal(response.status,405);assert.equal(f.queries.length,0);
});
test('pagination limit is strict and bounded',async()=>{
 const f=fixture();for(const q of ['?limit=0','?limit=101','?limit=-1','?limit=5.1','?limit=x']){
  const r=await call(f,'alice','A','documents',{q});assert.equal(r.status,400,q);
 }
});
test('unrelated URLs pass through to existing Worker',async()=>{
 const f=fixture();const response=await handleFinanceReadApi({request:new Request('https://example.org/api/schools'),db:f.db,authenticatedAccountId:'alice'});
 assert.equal(response,null);assert.equal(f.queries.length,0);
});
test('backend errors do not leak private database internals',async()=>{
 const db={prepare(){throw new Error('SQL PRIVATE TABLE NAME SECRET')}};
 const response=await handleFinanceReadApi({request:req('A','documents'),db,authenticatedAccountId:'alice'});
 assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Finance read failed'});
});
