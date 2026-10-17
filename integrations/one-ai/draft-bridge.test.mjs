import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAdmissionsDraft} from './draft-bridge.mjs';
const context={product:'neo-school-india',tenantId:'branch-1',leadId:'enquiry:E1',status:'New'};
test('generates a scoped draft through authenticated gateway, never sends',async()=>{
 let calls=0;
 const result=await prepareAdmissionsDraft({context,language:'te',requestKey:'request-1',api:async(path,options)=>{
  calls++;
  assert.equal(path,'/api/one-ai/drafts/generate');
  assert.equal(options.method,'POST');
  assert.equal(options.headers['idempotency-key'],'request-1');
  assert.deepEqual(JSON.parse(options.body),{leadId:'enquiry:E1',language:'te'});
  return {ok:true,json:async()=>({id:'d1',product:'neo-school-india',tenantId:'branch-1',leadId:'enquiry:E1',state:'draft'})};
 }});
 assert.equal(calls,1);
 assert.equal(result.draft.id,'d1');
 assert.equal(result.plan.outboundEnabled,false);
});
test('converted lead never invokes gateway',async()=>{
 const result=await prepareAdmissionsDraft({context:{...context,status:'Converted'},api:()=>{throw Error('unexpected')}});
 assert.equal(result.draft,null);
});
test('rejects cross-tenant and approved responses',async()=>{
 for(const override of [{tenantId:'branch-2'},{state:'approved'}]){
  await assert.rejects(prepareAdmissionsDraft({context,requestKey:'request-2',api:async()=>({
   ok:true,json:async()=>({id:'d1',product:'neo-school-india',tenantId:'branch-1',leadId:'enquiry:E1',state:'draft',...override})
  })}),/Unexpected draft/);
 }
});
test('requires idempotency and rejects gateway failures',async()=>{
 await assert.rejects(prepareAdmissionsDraft({context,requestKey:'bad key',api:async()=>({ok:true})}),TypeError);
 await assert.rejects(prepareAdmissionsDraft({context,requestKey:'good-key',api:async()=>({ok:false})}),/unavailable/);
});
