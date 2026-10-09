import test from 'node:test';
import assert from 'node:assert/strict';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
const actual={organizationId:'CENTER_A',sourceKind:'fee_receipt',sourceId:'R1',sourceEventId:'P1',amountPaise:1200,effectiveAt:'2026-10-09T10:00:00Z',verificationReference:'BNK1'};
function fakeDB(){
 const inserted=new Map();let calls=0;
 const db={prepare(sql){assert.match(sql,/ON CONFLICT/);return{bind(...v){return{async run(){calls++;const key=JSON.stringify(v.slice(0,1).concat(v.slice(2,5)));if(inserted.has(key))return {success:true,meta:{changes:0}};inserted.set(key,v);return {success:true,meta:{changes:1}}}}}}}};
 return {db,inserted,get calls(){return calls}};
}
const verify=async (_db,keys)=>({...actual,...keys});
test('verified source posts once, retries are idempotent',async()=>{
 const f=fakeDB();
 assert.equal((await postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:verify})).created,true);
 assert.equal((await postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:verify})).created,false);
 assert.equal(f.inserted.size,1);
});
test('rejects cross-business event before database write',async()=>{
 const f=fakeDB();
 await assert.rejects(postVerifiedSourceEvent({db:f.db,organizationId:'HO',source:actual,verifySource:verify}),/Cross-business/);
 assert.equal(f.calls,0);
});
test('requires trusted source verifier',async()=>{
 await assert.rejects(postVerifiedSourceEvent({db:fakeDB().db,organizationId:'CENTER_A',source:actual}),/verifier/);
});
test('fails closed on rejected verification',async()=>{
 const f=fakeDB();
 await assert.rejects(postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:async()=>null}),/verification failed/);
 assert.equal(f.calls,0);
});
test('rejects tampered source identity',async()=>{
 const f=fakeDB();
 await assert.rejects(postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:async()=>({...actual,sourceId:'other'})}),/verification failed/);
});
