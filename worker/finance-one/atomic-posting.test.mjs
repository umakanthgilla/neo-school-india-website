import test from 'node:test';
import assert from 'node:assert/strict';
import {postVerifiedSourceEvent} from './atomic-posting.mjs';
const actual={organizationId:'CENTER_A',sourceKind:'fee_receipt',sourceId:'R1',sourceEventId:'P1',amountPaise:1200,effectiveAt:'2026-10-09T10:00:00Z',verificationReference:'BNK1'};
function fakeDB(){
 const inserted=new Map();let calls=0;
 const db={prepare(sql){
   return {bind(...v){return{
     async run(){
       calls++;
       const key=JSON.stringify([v[0],v[2],v[3],v[4]]);
       if(inserted.has(key))return {success:true,meta:{changes:0}};
       inserted.set(key,v);
       return {success:true,meta:{changes:1}};
     },
     async first(){
       const key=JSON.stringify(v);
       const row=inserted.get(key);
       return row?{direction:row[5],amount_paise:row[6],effective_at:row[7],verification_reference:row[8]}:null;
     }
   }}};
 }};
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

test('duplicate identity with changed amount fails closed',async()=>{
 const f=fakeDB();
 await postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:verify});
 const altered=async (_db,keys)=>({...actual,...keys,amountPaise:9999});
 await assert.rejects(postVerifiedSourceEvent({db:f.db,organizationId:'CENTER_A',source:actual,verifySource:altered}),/Conflicting source event/);
});
