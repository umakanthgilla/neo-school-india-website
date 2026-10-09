/**
 * Finance ONE Worker integration boundary (development branch only).
 * Disabled by default. Never authorizes finance from generic HO admin privileges.
 * Uses verified school session + explicit finance organization membership.
 */
import {handleFinanceReadApi} from './finance-read-api.mjs';
function errorResponse(message,status,headers={}) {
 return new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
}
export async function financeOneWorkerGate({request,env,getSchoolSession,corsHeaders}){
 const pathname=new URL(request.url).pathname;
 if(!pathname.startsWith('/api/finance-one/v1/'))return null;
 const headers=typeof corsHeaders==='function'?corsHeaders(request):{};
 if(env?.FINANCE_ONE_READ_API_ENABLED!=='true')return errorResponse('Not found',404,headers);
 if(!env?.DB)return errorResponse('Finance service unavailable',503,headers);
 if(typeof getSchoolSession!=='function')return errorResponse('Finance authentication unavailable',503,headers);
 let session;
 try{session=await getSchoolSession(request,env);}catch{return errorResponse('Login required',401,headers);}
 if(!session || typeof session.school_id!=='string' || !session.school_id.trim())return errorResponse('Login required',401,headers);
 // Finance memberships must be provisioned explicitly. The legacy school login
 // does NOT automatically give either owner or HO finance authorization.
 const accountId='school:'+session.school_id;
 const result=await handleFinanceReadApi({request,db:env.DB,authenticatedAccountId:accountId});
 if(!result)return errorResponse('Not found',404,headers);
 const responseHeaders=new Headers(result.headers);
 for(const [key,value] of Object.entries(headers))responseHeaders.set(key,value);
 responseHeaders.set('Cache-Control','no-store');
 return new Response(result.body,{status:result.status,headers:responseHeaders});
}
