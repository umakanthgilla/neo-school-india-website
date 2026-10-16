import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySettlementSource} from './settlement-source-verifier.mjs';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
const request={organizationId:'CENTER_A',sourceKind:'payroll_payment',sourceId:'RUN-01',sourceEventId:'SETTLE-01'};
function database(row){
 let posted=0;
 return {get posted(){return posted},prepare(sql){
   return {bind(...args){return{
     async first(){assert.deepEqual(args,['CENTER_A','SETTLE-01','RUN-01']);return row;},
     async run(){posted++;return {success:true,meta:{changes:1}};}
   }}};
 }};
}
const good={id:'SETTLE-01',organization_id:'CENTER_A',document_id:'DOC-1',amount_paise:100000,bank_reference:'BANK123',verified_at:'2026-10-09T10:00:00Z',status:'verified',document_type:'payment',source_kind:'payroll_payment',source_id:'RUN-01'};
test('only matching verified settlement can produce cash event',async()=>{
 const db=database(good);
 const res=await postVerifiedSourceEvent({db,organizationId:'CENTER_A',source:request,verifySource:verifySettlementSource});
 assert.equal(res.created,true);assert.equal(db.posted,1);
});
test('unverified bank event rejected',async()=>{
 const db=database({...good,status:'pending'});
 await assert.rejects(postVerifiedSourceEvent({db,organizationId:'CENTER_A',source:request,verifySource:verifySettlementSource}),/verification failed/);
 assert.equal(db.posted,0);
});
test('different company settlement rejected',async()=>{
 const db=database({...good,organization_id:'CENTER_B'});
 await assert.rejects(postVerifiedSourceEvent({db,organizationId:'CENTER_A',source:request,verifySource:verifySettlementSource}),/verification failed/);
 assert.equal(db.posted,0);
});
test('wrong source mapping rejected',async()=>{
 const db=database({...good,source_id:'OTHER'});
 await assert.rejects(postVerifiedSourceEvent({db,organizationId:'CENTER_A',source:request,verifySource:verifySettlementSource}),/verification failed/);
 assert.equal(db.posted,0);
});
test('receipt cannot be posted by payout verifier',async()=>{
 const db=database(good);
 assert.equal(await verifySettlementSource(db,{...request,sourceKind:'fee_receipt'}),null);
 assert.equal(db.posted,0);
});
