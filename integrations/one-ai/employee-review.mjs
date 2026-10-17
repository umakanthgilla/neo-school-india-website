import {mountReviewPanel} from './review-panel.mjs';
// The existing Employee Portal owns the session. Never persist a second token.
export function createEmployeeReviewAPI({getToken,fetcher=fetch}) {
 return async(path,{method='GET',body,idempotencyKey}={})=>{
  if(!/^\/api\/drafts(?:\/generate|\/[A-Za-z0-9-]+(?:\/(?:events|transition))?)?(?:\?[^#]*)?$/.test(path))
   throw Error('Unsupported review route.');
  if(!['GET','POST'].includes(method))throw Error('Unsupported review method.');
  const token=getToken();
  if(typeof token!=='string'||!token)throw Error('Employee sign in required.');
  const headers={authorization:'Bearer '+token};
  if(body!==undefined)headers['content-type']='application/json';
  if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
  const response=await fetcher(path.replace('/api/','/api/one-ai/'),{
   method,headers,credentials:'omit',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(25000),
   ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  if(getToken()!==token)throw Error('Session changed. Reopen the review workspace.');
  const result=await response.json();
  if(getToken()!==token)throw Error('Session changed. Reopen the review workspace.');
  if(!response.ok)throw Error(result.error||'Review service unavailable.');
  return result;
 };
}
export function mountEmployeeReview(root,{getToken}) {
 root.replaceChildren();
 const heading=document.createElement('h3');heading.textContent='ONE AI · Admissions review (staging)';
 const hint=document.createElement('p');hint.textContent='Enter the selected CRM enquiry or growth lead ID. Your school access is checked by the server. Sending is disabled.';
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),button=document.createElement('button');
 label.textContent='CRM lead reference';input.required=true;input.placeholder='enquiry:E1 or growth:L1';input.maxLength=128;
 input.pattern='(growth|enquiry):[A-Za-z0-9][A-Za-z0-9_.@\\-]{0,119}';
 label.append(input);button.type='submit';button.textContent='Open draft review';form.append(label,button);
 const panel=document.createElement('div');
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  mountReviewPanel(panel,{api:createEmployeeReviewAPI({getToken}),leadId:input.value});
 });
 root.append(heading,hint,form,panel);
}
