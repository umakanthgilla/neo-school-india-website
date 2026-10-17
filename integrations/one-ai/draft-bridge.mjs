import {planAdmissionsFollowUp} from './follow-up-plan.mjs';

// Server-side orchestration for the authenticated, same-origin ONE AI gateway.
// No credentials, phone numbers, student data, or direct outbound delivery.
export async function prepareAdmissionsDraft({context, language='te', requestKey, api}) {
  const plan=planAdmissionsFollowUp(context,{language});
  if(plan.action==='none')return {plan,draft:null};
  if(typeof api!=='function' || typeof requestKey!=='string' ||
     !/^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/.test(requestKey))
    throw new TypeError('Authenticated API and idempotency key required');
  const response=await api('/api/one-ai/drafts/generate',{
    method:'POST',
    headers:{'content-type':'application/json','idempotency-key':requestKey},
    body:JSON.stringify({leadId:plan.leadId,language:plan.language})
  });
  if(!response || !response.ok)throw new Error('Draft generation unavailable');
  const draft=await response.json();
  if(!draft || draft.product!==plan.product || draft.tenantId!==plan.tenantId ||
     draft.leadId!==plan.leadId || draft.state!=='draft' || typeof draft.id!=='string')
    throw new Error('Unexpected draft scope or state');
  return {plan,draft};
}
