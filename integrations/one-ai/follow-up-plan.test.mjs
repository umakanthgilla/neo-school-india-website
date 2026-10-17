import test from 'node:test';
import assert from 'node:assert/strict';
import {planAdmissionsFollowUp} from './follow-up-plan.mjs';
const base={product:'neo-school-india',tenantId:'school-a',leadId:'enquiry:E1',status:'New'};
test('active Neo enquiry creates review-only plan without sending',()=>{
 const plan=planAdmissionsFollowUp(base,{language:'te'});
 assert.equal(plan.action,'prepare-draft');
 assert.equal(plan.reviewRequired,true);
 assert.equal(plan.outboundEnabled,false);
 assert.equal(plan.language,'te');
 assert.equal(plan.tenantId,'school-a');
 assert.equal(Object.hasOwn(plan,'phone'),false);
});
test('closed leads do not schedule follow-ups',()=>{
 for(const status of ['Converted','Lost']) {
  const plan=planAdmissionsFollowUp({...base,status});
  assert.equal(plan.action,'none');
  assert.equal(plan.outboundEnabled,false);
 }
});
test('reject unscoped or foreign CRM data and unsupported language',()=>{
 for(const bad of [{...base,product:'usha-one'},{...base,tenantId:''},{...base,leadId:'other:1'},{...base,status:'Unknown'}])
  assert.throws(()=>planAdmissionsFollowUp(bad),TypeError);
 assert.throws(()=>planAdmissionsFollowUp(base,{language:'xx'}),TypeError);
});
