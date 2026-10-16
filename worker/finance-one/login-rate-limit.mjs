/**
 * Finance ONE staging login abuse gate. Native Cloudflare rate-limit bindings.
 * Cloudflare counters are per-location: also configure perimeter WAF/Access.
 * Does not use client-provided X-Forwarded-For or account names in counters.
 */
const fail=(status,error,extra={})=>new Response(JSON.stringify({error}),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff',...extra
}});
async function limited(binding,key){
 if(typeof binding?.limit!=='function')throw Error('Missing native Finance login rate-limit binding');
 const result=await binding.limit({key});
 if(typeof result?.success!=='boolean')throw Error('Invalid native rate-limit response');
 return !result.success;
}
export async function checkFinanceLoginClientLimit({request,env}){
 if(typeof env?.FINANCE_ONE_LOGIN_CLIENT_LIMIT?.limit!=='function')return fail(503,'Finance login unavailable');
 // CF-Connecting-IP is populated by Cloudflare at the trusted edge. Do not
 // trust arbitrary forwarded-for headers. Missing IP falls in a restricted pool.
 const ip=request.headers.get('CF-Connecting-IP');
 const key=ip && /^(?:[0-9a-fA-F:.]{2,45}|[0-9.]{7,15})$/.test(ip) ? ip : 'unidentified-client';
 try{
  return await limited(env.FINANCE_ONE_LOGIN_CLIENT_LIMIT,'login:client:'+key)
   ?fail(429,'Too many login attempts',{'Retry-After':'60'}):null;
 }catch{return fail(503,'Finance login unavailable');}
}
export async function checkFinanceLoginAccountLimit({env,accountId}){
 if(typeof env?.FINANCE_ONE_LOGIN_ACCOUNT_LIMIT?.limit!=='function')return fail(503,'Finance login unavailable');
 try{
  // Hash the account ID so shared Cloudflare rate-limit keys do not contain
  // a visible account identifier. Bound input length is enforced upstream.
  const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accountId));
  const key=Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');
  return await limited(env.FINANCE_ONE_LOGIN_ACCOUNT_LIMIT,'login:account:'+key)
   ?fail(429,'Too many login attempts',{'Retry-After':'60'}):null;
 }catch{return fail(503,'Finance login unavailable');}
}
