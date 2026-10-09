import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const page=readFileSync(new URL('../../finance-one/portal.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Finance Portal inline JavaScript required');

class FakeElement {
 constructor(){this.value='';this.hidden=false;this.textContent='';this.children=[];this.handlers={};this.className='';this.disabled=false;}
 addEventListener(type,fn){this.handlers[type]=fn;}
 appendChild(node){this.children.push(node);return node;}
 replaceChildren(){this.children=[];}
}
function mount(fetchImpl){
 const nodes=new Map();
 const document={
  getElementById(id){if(!nodes.has(id))nodes.set(id,new FakeElement());return nodes.get(id);},
  createElement(){return new FakeElement();}
 };
 document.getElementById('login-panel').hidden=false;
 document.getElementById('dashboard-panel').hidden=true;
 const context=vm.createContext({document,window:{},location:{origin:'https://finance.example.invalid'},
  fetch:fetchImpl,Intl,Error,String,Promise,encodeURIComponent});
 new vm.Script(script,{filename:'portal.html:inline-script'}).runInContext(context);
 const $=id=>document.getElementById(id);
 const login=(org,account='fin:alice')=>{
  $('org').value=org;$('account').value=account;$('password').value='ValidPassword1234!';
  return $('login-form').handlers.submit({preventDefault(){}});
 };
 return {$,login,signOut:()=>$('sign-out').handlers.click(),refresh:()=>$('refresh').handlers.click()};
}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const bodyFor=(url,organization)=>{
 const resource=new URL(url).pathname.split('/').pop();
 switch(resource){
  case 'summary':return {organizationId:organization,moneyInPaise:organization==='CENTER_B'?22000:10000,
   moneyOutPaise:0,netCashMovementPaise:organization==='CENTER_B'?22000:10000,
   profitPaise:5000,balanced:true};
  case 'daily-ledger':return {organizationId:organization,entries:[{source_kind:'fee_receipt',
   source_id:'RECEIPT_'+organization,direction:'money_in',amount_paise:10000,effective_at:'2026-10-09'}]};
  case 'documents':return {organizationId:organization,documents:[{id:'DOC_'+organization,
   document_type:'sales_invoice',status:'approved',gross_paise:10000}]};
  case 'settlements':return {organizationId:organization,entries:[]};
  case 'statutory-liabilities':return {organizationId:organization,items:[],requiresReview:false};
  case 'cash-reconciliation':return {organizationId:organization,ready:true,issueCount:0,findings:[]};
  default:throw Error('Unrecognized Finance request '+url);
 }
};
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
function setup(responseType='success'){
 const firstPending=[];
 const fetchImpl=async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session')){
   const {organizationId}=JSON.parse(options.body);
   return json({token:'TOKEN_'+organizationId,organizationId});
  }
  const org=url.includes('/CENTER_A/')?'CENTER_A':'CENTER_B';
  if(org==='CENTER_A'){
   return new Promise(resolve=>firstPending.push({resolve,url}));
  }
  return json(bodyFor(url,org));
 };
 const app=mount(fetchImpl);
 const flushA=(status=200)=>{
  for(const pending of firstPending.splice(0))
   pending.resolve(status===401?json({error:'Finance login required'},401):json(bodyFor(pending.url,'CENTER_A')));
 };
 return {...app,firstPending,flushA};
}
test('signing out immediately clears financial figures, documents and prevents delayed previous session render',async()=>{
 const app=setup();const pending=app.login('CENTER_A');
 await flush();
 assert.equal(app.firstPending.length,5);
 app.signOut();
 assert.equal(app.$('dashboard-panel').hidden,true);
 assert.equal(app.$('org-label').textContent,'');
 assert.equal(app.$('money-in').textContent,'—');
 const newLogin=app.login('CENTER_B','fin:bob');
 await newLogin;
 assert.equal(app.$('dashboard-panel').hidden,false);
 assert.equal(app.$('org-label').textContent,'CENTER_B');
 assert.equal(app.$('document-rows').children[0].children[0].textContent,'DOC_CENTER_B');
 const figure=app.$('money-in').textContent;
 app.flushA();
 await pending;
 assert.equal(app.$('org-label').textContent,'CENTER_B');
 assert.equal(app.$('money-in').textContent,figure);
 assert.equal(app.$('document-rows').children[0].children[0].textContent,'DOC_CENTER_B');
});
test('a delayed 401 response for an old session never signs out a newer Center session',async()=>{
 const app=setup();const old=app.login('CENTER_A');
 await flush();
 assert.equal(app.firstPending.length,5);
 app.signOut();
 await app.login('CENTER_B','fin:bob');
 app.flushA(401);
 await old;
 assert.equal(app.$('dashboard-panel').hidden,false);
 assert.equal(app.$('org-label').textContent,'CENTER_B');
 assert.equal(app.$('dash-error').textContent,'');
});
test('unbalanced accounting figures surface explicit Finance warning',async()=>{
 const app=mount(async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session'))return json({token:'T',organizationId:'CENTER_A'});
  const result=bodyFor(url,'CENTER_A');
  if(new URL(url).pathname.endsWith('/summary'))result.balanced=false;
  return json(result);
 });
 await app.login('CENTER_A');
 assert.equal(app.$('trial-warning').hidden,false);
});
test('login response cannot silently switch organization to another legal business',async()=>{
 const app=mount(async(url)=>json({token:'T',organizationId:'CENTER_B'}));
 await app.login('CENTER_A');
 assert.equal(app.$('dashboard-panel').hidden,true);
 assert.match(app.$('login-error').textContent,/organization mismatch/);
});

test('cash/journal reconciliation issue is shown and clears on sign-out',async()=>{
 const app=mount(async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session'))return json({token:'T',organizationId:'CENTER_A'});
  const result=bodyFor(url,'CENTER_A');
  if(new URL(url).pathname.endsWith('/cash-reconciliation'))result.ready=false;
  return json(result);
 });
 await app.login('CENTER_A');
 assert.equal(app.$('cash-reconciliation-warning').hidden,false);
 app.signOut();
 assert.equal(app.$('cash-reconciliation-warning').hidden,true);
});
