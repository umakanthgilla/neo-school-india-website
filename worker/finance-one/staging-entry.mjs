/**
 * Finance ONE isolated Cloudflare Worker STAGING entrypoint.
 * Deploy as a separate Worker, NOT as a replacement for the live school API.
 */
import {financeOneWorkerGate} from './worker-gate.mjs';

function allowedOrigin(request,env) {
 const origin=request.headers.get('Origin');
 if(!origin)return null;
 const configured=env?.FINANCE_ONE_PORTAL_ORIGIN;
 if(typeof configured!=='string' || !/^https:\/\/[^/]+$/.test(configured))return null;
 return origin===configured?origin:null;
}
function corsFor(request,env) {
 const origin=allowedOrigin(request,env);
 if(!origin)return {};
 return {
   'Access-Control-Allow-Origin':origin,
   'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
   'Access-Control-Allow-Headers':'Authorization,Content-Type',
   'Vary':'Origin'
 };
}
function response(status,body,request,env) {
 return new Response(JSON.stringify(body),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',...corsFor(request,env)
 }});
}
export default {
 async fetch(request,env) {
  if(env?.FINANCE_ONE_ENVIRONMENT!=='staging')return response(404,{error:'Not found'},request,env);
  const url=new URL(request.url);
  const isFinance=url.pathname.startsWith('/api/finance-one/v1/');
  if(!isFinance)return response(404,{error:'Not found'},request,env);
  const requestOrigin=request.headers.get('Origin');
  if(requestOrigin && !allowedOrigin(request,env))return response(403,{error:'Origin not allowed'},request,env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Cache-Control':'no-store',...corsFor(request,env)}});
  const result=await financeOneWorkerGate({request,env,corsHeaders:req=>corsFor(req,env)});
  return result||response(404,{error:'Not found'},request,env);
 }
};
