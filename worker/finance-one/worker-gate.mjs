/**
 * Finance ONE Worker integration boundary (development branch only).
 * Disabled by default. Never authorizes finance from generic HO admin privileges.
 * Uses a dedicated signed finance session + explicit finance organization membership.
 */
import {handleFinanceReadApi} from './finance-read-api.mjs';
import {readFinanceOneSession} from './finance-session.mjs';
function errorResponse(message,status,headers={}) {
 return new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
}
export async function financeOneWorkerGate({request,env,corsHeaders}){
 const pathname=new URL(request.url).pathname;
 if(!pathname.startsWith('/api/finance-one/v1/'))return null;
 const headers=typeof corsHeaders==='function'?corsHeaders(request):{};
 if(env?.FINANCE_ONE_READ_API_ENABLED!=='true')return errorResponse('Not found',404,headers);
 if(!env?.DB)return errorResponse('Finance service unavailable',503,headers);
 const session=await readFinanceOneSession(request,env);
 if(!session)return errorResponse('Finance login required',401,headers);
 // Dedicated personal finance identity; legacy school and HO admin tokens
 // cannot grant access. Active memberships are checked for every request.
 const accountId=session.accountId;
 const result=await handleFinanceReadApi({request,db:env.DB,authenticatedAccountId:accountId});
 if(!result)return errorResponse('Not found',404,headers);
 const responseHeaders=new Headers(result.headers);
 for(const [key,value] of Object.entries(headers))responseHeaders.set(key,value);
 responseHeaders.set('Cache-Control','no-store');
 return new Response(result.body,{status:result.status,headers:responseHeaders});
}
