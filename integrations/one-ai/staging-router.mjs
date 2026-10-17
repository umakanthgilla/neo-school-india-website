// Separate staging entrypoint. NEO_APP is the existing isolated Neo staging Worker.
// ONE_AI_GATEWAY verifies individual employee identity before calling the engine.
import {APIError,readJSON,timeout} from './errors.mjs';
const reply=(error,status)=>Response.json({error},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {async fetch(request,env) {
 const url=new URL(request.url);
 if(url.pathname!=='/api/one-ai' && !url.pathname.startsWith('/api/one-ai/')) {
  if(!env.NEO_APP?.fetch)return reply('Neo staging application unavailable',503);
  return env.NEO_APP.fetch(request);
 }
 try {
  if(env.ENABLE_ONE_AI!=='true')return reply('Not found',404);
  if(!/^\/api\/one-ai\/drafts(?:\/generate|\/[A-Za-z0-9-]+(?:\/(?:events|transition))?)?$/.test(url.pathname))
   return reply('Not found',404);
  if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
  if(!env.ONE_AI_GATEWAY?.fetch || !env.CRM_ORIGIN)return reply('ONE AI staging gateway unavailable',503);
  const origin=request.headers.get('origin');
  if(url.origin!==env.CRM_ORIGIN || (origin && origin!==env.CRM_ORIGIN))return reply('Origin not allowed',403);
  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization) || authorization.length>8192)
   return reply('Individual employee sign-in required',401);
  const headers=new Headers({authorization,origin:env.CRM_ORIGIN});
  const key=request.headers.get('idempotency-key');
  if(key)headers.set('idempotency-key',key);
  let body;
  if(request.method==='POST'){
   body=JSON.stringify(await readJSON(request));
   headers.set('content-type','application/json');
  }
  const upstream=await timeout(env.ONE_AI_GATEWAY.fetch(new Request(
   'https://one-ai-gateway.internal'+url.pathname+url.search,
   {method:request.method,headers,body,redirect:'error'})),25000);
  if(upstream.status>=300 && upstream.status<400)return reply('Unexpected gateway redirect',502);
  return new Response(upstream.body,{status:upstream.status,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff'
  }});
 }catch(e){return reply(e instanceof APIError?e.message:'ONE AI staging gateway unavailable',e instanceof APIError?e.status:503);}
}};
