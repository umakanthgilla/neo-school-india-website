(()=>{
'use strict';
if(window.__neoGatePhotoUi)return;window.__neoGatePhotoUi=true;
const API='https://neo-lead-crm-api.umakanthgilla.workers.dev';
const cache=new Map();
const role=document.body.dataset.role||'';
const schoolToken=()=>{try{return typeof token==='string'&&token?token:(sessionStorage.getItem('neo_school_token')||sessionStorage.getItem('neo_crm_token')||'')}catch{return sessionStorage.getItem('neo_school_token')||sessionStorage.getItem('neo_crm_token')||''}};
const parentToken=()=>sessionStorage.getItem('neo_parent_token')||'';
function schoolId(){const a=document.querySelector('#neoVisitorGate a[href*="gate-checkin.html?school_id="]');if(!a)return'';try{return new URL(a.href,location.href).searchParams.get('school_id')||''}catch{return''}}
function avatar(url,alt){const wrap=document.createElement('div');wrap.className='neo-gate-photo-avatar';wrap.style.cssText='display:flex;justify-content:flex-start;margin:0 0 12px';const img=document.createElement('img');img.src=url;img.alt=alt;img.style.cssText='width:86px;height:86px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 4px 14px #00102b24;background:#eef4fb';wrap.append(img);return wrap}
async function blobUrl(key,url,headers){if(cache.has(key))return cache.get(key);try{const r=await fetch(url,{headers});if(!r.ok){cache.set(key,'');return''}const u=URL.createObjectURL(await r.blob());cache.set(key,u);return u}catch{cache.set(key,'');return''}}
async function decorateSchool(){const gate=document.getElementById('neoVisitorGate'),sid=schoolId(),auth=schoolToken();if(!gate||!sid||!auth)return;const jobs=[];gate.querySelectorAll('[data-visitor-action][data-id]').forEach(button=>{const card=button.closest('.portal-card'),id=button.dataset.id;if(!card||card.dataset.gatePhotoChecked)return;card.dataset.gatePhotoChecked='1';jobs.push((async()=>{const u=await blobUrl('school:visitor:'+id,API+'/api/gate-photo/school/'+encodeURIComponent(sid)+'/visitor/'+encodeURIComponent(id),{Authorization:'Bearer '+auth});if(u&&card.isConnected)card.insertBefore(avatar(u,'Visitor verification photo'),card.firstChild)})())});gate.querySelectorAll('[data-pickup-action][data-id]').forEach(button=>{const card=button.closest('.portal-card'),id=button.dataset.id;if(!card||card.dataset.gatePhotoChecked)return;card.dataset.gatePhotoChecked='1';jobs.push((async()=>{const u=await blobUrl('school:pickup:'+id,API+'/api/gate-photo/school/'+encodeURIComponent(sid)+'/pickup/'+encodeURIComponent(id),{Authorization:'Bearer '+auth});if(u&&card.isConnected)card.insertBefore(avatar(u,'Pickup person verification photo'),card.firstChild)})())});await Promise.allSettled(jobs)}
async function decorateParent(){const root=document.getElementById('neoPickupApproval'),auth=parentToken();if(!root||!auth)return;const jobs=[];root.querySelectorAll('[data-pickup-parent][data-id]').forEach(button=>{const article=button.closest('article'),id=button.dataset.id;if(!article||article.dataset.gatePhotoChecked)return;article.dataset.gatePhotoChecked='1';jobs.push((async()=>{const u=await blobUrl('parent:pickup:'+id,API+'/api/gate-photo/parent/'+encodeURIComponent(id),{Authorization:'Bearer '+auth});if(u&&article.isConnected)article.insertBefore(avatar(u,'Pickup person photo'),article.firstChild)})())});await Promise.allSettled(jobs)}
function run(){if(role==='parent')decorateParent();else decorateSchool()}
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-tab="visitor_gate"],#familyLoginForm button'))setTimeout(run,500)},true);
setInterval(run,5000);setTimeout(run,500);
window.addEventListener('beforeunload',()=>{for(const u of cache.values())if(u)URL.revokeObjectURL(u)});
})();
