/**
 * Finance ONE isolated Cloudflare Worker STAGING entrypoint.
 * Deploy as a separate Worker with an isolated D1 binding; never replace
 * Neo School India's live school API.
 * Cloudflare Static Assets must be routed worker-first to prevent direct
 * portal.html access while Finance ONE is disabled.
 */
import {financeOneWorkerGate} from './worker-gate.mjs';

function allowedOrigin(request,env){
 const origin=request.headers.get('Origin');
 if(!origin)return null;
 // Same-origin is necessary when the Finance portal is served from this
 // staging Worker. An external portal must match an explicitly configured
 // HTTPS origin; no wildcard CORS.
 if(origin===new URL(request.url).origin)return origin;
 const configured=env?.FINANCE_ONE_PORTAL_ORIGIN;
 if(typeof configured!=='string'||!/^https:\/\/[^/]+$/.test(configured))return null;
 return origin===configured?origin:null;
}
function corsFor(request,env){
 const origin=allowedOrigin(request,env);
 if(!origin)return {};
 return {'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'Authorization,Content-Type',
  'Vary':'Origin'};
}
function json(status,body,request,env){
 return new Response(JSON.stringify(body),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',...corsFor(request,env)
 }});
}
async function servePortal(request,env){
 if(env?.FINANCE_ONE_READ_API_ENABLED!=='true')return json(404,{error:'Not found'},request,env);
 if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')
  return json(503,{error:'Finance preview unavailable'},request,env);
 const assetUrl=new URL('/portal.html',request.url);
 let asset;
 try{asset=await env.ASSETS.fetch(new Request(assetUrl,{method:'GET'}));}
 catch{return json(503,{error:'Finance preview unavailable'},request,env);}
 if(!asset||asset.status!==200)return json(503,{error:'Finance preview unavailable'},request,env);
 const html=await asset.text();
 // The one-page preview intentionally includes a single inline stylesheet
 // and script. Per-request nonces prevent any other inline content.
 if(!/^<!doctype html>/i.test(html.trimStart())||
  (html.match(/<style(?:\s|>)/gi)||[]).length!==1||
  (html.match(/<script(?:\s|>)/gi)||[]).length!==1||
  /\s(?:style|on[a-z]+)\s*=/i.test(html))
  return json(503,{error:'Finance preview invalid'},request,env);
 const bytes=crypto.getRandomValues(new Uint8Array(18));
 const nonce=btoa(String.fromCharCode(...bytes));
 const secured=html.replace('<style>','<style nonce="'+nonce+'">')
   .replace('<script>','<script nonce="'+nonce+'">');
 if(secured===html)return json(503,{error:'Finance preview invalid'},request,env);
 return new Response(secured,{status:200,headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-frame-options':'DENY',
  'referrer-policy':'no-referrer',
  'permissions-policy':'camera=(),microphone=(),geolocation=()',
  'content-security-policy':"default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'"
 }});
}
export default {
 async fetch(request,env){
  if(env?.FINANCE_ONE_ENVIRONMENT!=='staging')return json(404,{error:'Not found'},request,env);
  const url=new URL(request.url);
  const isFinance=url.pathname.startsWith('/api/finance-one/v1/');
  const portalRoute=url.pathname==='/'||url.pathname==='/portal.html';
  if(!isFinance&&!portalRoute)return json(404,{error:'Not found'},request,env);
  const method=request.method;
  if(portalRoute){
   if(method!=='GET'&&method!=='HEAD')return json(405,{error:'Method not allowed'},request,env);
   if(method==='HEAD'){
    if(env?.FINANCE_ONE_READ_API_ENABLED!=='true')return json(404,{error:'Not found'},request,env);
    return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
   }
   return servePortal(request,env);
  }
  const origin=request.headers.get('Origin');
  if(origin&&!allowedOrigin(request,env))return json(403,{error:'Origin not allowed'},request,env);
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Cache-Control':'no-store',...corsFor(request,env)
  }});
  const result=await financeOneWorkerGate({request,env,corsHeaders:req=>corsFor(req,env)});
  return result||json(404,{error:'Not found'},request,env);
 }
};