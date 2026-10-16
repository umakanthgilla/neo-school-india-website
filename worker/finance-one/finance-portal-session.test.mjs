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
 setAttribute(name,value){this[name]=value;}
 click(){}
}
function mount(fetchImpl){
 const nodes=new Map();
 const document={
  getElementById(id){if(!nodes.has(id))nodes.set(id,new FakeElement());return nodes.get(id);},
  createElement(){return new FakeElement();}
 };
 document.getElementById('login-panel').hidden=false;
 document.getElementById('dashboard-panel').hidden=true;
 const prints=[],downloads=[];
 const context=vm.createContext({document,window:{print(){prints.push({organization:document.getElementById('trial-context').textContent,rows:document.getElementById('trial-rows').children.length});}},location:{origin:'https://finance.example.invalid'},
  fetch:fetchImpl,Intl,Error,String,Promise,encodeURIComponent,crypto,Blob,URL:{createObjectURL(blob){downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},setTimeout(fn){fn();}});
 new vm.Script(script,{filename:'portal.html:inline-script'}).runInContext(context);
 const $=id=>document.getElementById(id);
 const login=(org,account='fin:alice')=>{
  $('org').value=org;$('account').value=account;$('password').value='ValidPassword1234!';
  return $('login-form').handlers.submit({preventDefault(){}});
 };
 return {$,login,prints,downloads,signOut:()=>$('sign-out').handlers.click(),refresh:()=>$('refresh').handlers.click()};
}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
test('Cloudflare Finance sign-in sends only organization, then uses the existing private dashboard and sign-out',async()=>{
 const seen=[];
 const app=mount(async(url,options)=>{
  if(url.endsWith('/session/access')){seen.push(JSON.parse(options.body));return json({token:'access-finance-token',organizationId:'CENTER_A'});}
  if(url.endsWith('/session/logout'))return new Response(null,{status:204});
  return json(bodyFor(url,'CENTER_A'));
 });
 app.$('org').value='CENTER_A';app.$('password').value='must-never-be-sent';app.$('account').value='fin:cannot-select-checker';
 await app.$('access-sign-in').handlers.click();
 assert.deepEqual(seen,[{organizationId:'CENTER_A'}]);assert.equal(app.$('dashboard-panel').hidden,false);
 assert.equal(app.$('password').value,'');await app.signOut();assert.equal(app.$('dashboard-panel').hidden,true);
});
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
  case 'accrual-reconciliation':return {organizationId:organization,ready:true,issueCount:0,findings:[]};
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
 assert.equal(app.firstPending.length,7);
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
 assert.equal(app.firstPending.length,7);
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

test('trial balance printing includes the entire report, review warning and clears on logout or failed refresh',async()=>{
 let fail=false;
 const app=mount(async(url)=>{
  if(url.endsWith('/session'))return json({token:'TOKEN_A',organizationId:'CENTER_A'});
  if(fail)return json({error:'Service unavailable'},503);
  const result=bodyFor(url,'CENTER_A');
  if(url.endsWith('/summary'))Object.assign(result,{balanced:false,trialBalance:Array.from({length:75},(_,i)=>({code:String(i),name:'<script>unsafe</script>',debitPaise:100,creditPaise:0})),totalDebitPaise:7500,totalCreditPaise:0});
  return json(result);
 });
 app.$('trial-print').handlers.click();assert.equal(app.prints.length,0);
 await app.login('CENTER_A');
 app.$('trial-print').handlers.click();
 assert.equal(app.prints[0].rows,76);
 assert.match(app.prints[0].organization,/CENTER_A.*FINANCE REVIEW REQUIRED/);
 assert.equal(app.$('trial-rows').children[0].children[1].textContent,'<script>unsafe</script>');
 fail=true;await app.refresh();app.$('trial-print').handlers.click();
 assert.equal(app.prints.length,1);assert.equal(app.$('trial-rows').children.length,0);
 app.signOut();assert.equal(app.$('trial-print').disabled,true);assert.equal(app.$('trial-context').textContent,'');
 app.$('trial-print').handlers.click();assert.equal(app.prints.length,1);
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

test('approved document/journal reconciliation warning is cleared on sign out',async()=>{
 const app=mount(async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session'))return json({token:'T',organizationId:'CENTER_A'});
  const result=bodyFor(url,'CENTER_A');
  if(new URL(url).pathname.endsWith('/accrual-reconciliation'))result.ready=false;
  return json(result);
 });
 await app.login('CENTER_A');
 assert.equal(app.$('accrual-reconciliation-warning').hidden,false);
 app.signOut();
 assert.equal(app.$('accrual-reconciliation-warning').hidden,true);
});

test('delayed correction queue cannot repopulate confidential data after sign out',async()=>{
 let pending=[];
 const app=mount(async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session'))return json({token:'TOKEN_A',organizationId:'CENTER_A'});
  if(url.endsWith('/corrections')||url.endsWith('/correction-journals'))return new Promise(resolve=>pending.push({url,resolve}));
  return json(bodyFor(url,'CENTER_A'));
 });
 await app.login('CENTER_A');const load=app.$('corrections-open').handlers.click();await flush();
 assert.equal(pending.length,2);app.signOut();
 for(const item of pending)item.resolve(json(item.url.endsWith('/corrections')?{requests:[{id:'PRIVATE',reason:'private financial reason'}]}:{journals:[]}));
 await load;
 assert.equal(app.$('corrections-panel').hidden,true);
 assert.equal(app.$('correction-requests').children.length,0);
 assert.equal(app.$('corrections-message').textContent,'');
});

test('delayed source audit response cannot restore private history after logout or another Center login',async()=>{
 let finish;
 const app=mount(async(url,options)=>{
  if(new URL(url).pathname.endsWith('/session')){const {organizationId}=JSON.parse(options.body);return json({token:'TOKEN_'+organizationId,organizationId});}
  if(new URL(url).pathname.endsWith('/session/logout'))return new Response(null,{status:204});
  if(new URL(url).pathname.endsWith('/source-operations'))return new Promise(resolve=>{finish=resolve;});
  return json(bodyFor(url,url.includes('/CENTER_A/')?'CENTER_A':'CENTER_B'));
 });
 await app.login('CENTER_A');const pending=app.$('source-open').handlers.click();await flush();
 await app.signOut();await app.login('CENTER_B','fin:bob');
 finish(json({entries:[{action:'receipt',status:'succeeded',source_json:'PRIVATE_CENTER_A_SOURCE',requested_by:'fin:alice'}]}));
 await pending;assert.equal(app.$('source-history').children.length,0);assert.equal(app.$('source-panel').hidden,true);
 assert.equal(app.$('org-label').textContent,'CENTER_B');
});

test('full ledger CSV consumes all pages and neutralizes formula references',async()=>{
 let pages=0;
 const entry=id=>({event_id:id,effective_at:'2026-10-16',source_kind:'receipt',source_id:id,direction:'money_in',amount_paise:100,verification_reference:'=HYPERLINK("private")'});
 const app=mount(async(url)=>{
  if(url.endsWith('/session'))return json({token:'TEST',organizationId:'CENTER_A'});
  if(url.includes('/ledger-export')){pages++;return json({organizationId:'CENTER_A',snapshot:'2',totalEntries:2,entries:[entry(pages===1?'ONE':'TWO')],nextCursor:pages===1?'CENTER_A:2:1':null});}
  return json(bodyFor(url,'CENTER_A'));
 });
 await app.login('CENTER_A');await app.$('ledger-export').handlers.click();
 assert.equal(pages,2);assert.equal(app.downloads.length,1);
 const csv=await app.downloads[0].text();assert.match(csv,/ONE/);assert.match(csv,/TWO/);assert.match(csv,/'=HYPERLINK/);assert.match(app.$('ledger-export-message').textContent,/Exported 2/);
});
test('logout during full ledger export prevents download and clears export feedback',async()=>{
 let finish;
 const app=mount(async(url)=>{
  if(url.endsWith('/session'))return json({token:'TEST',organizationId:'CENTER_A'});
  if(url.endsWith('/session/logout'))return new Response(null,{status:204});
  if(url.includes('/ledger-export'))return new Promise(resolve=>finish=resolve);
  return json(bodyFor(url,'CENTER_A'));
 });
 await app.login('CENTER_A');const pending=app.$('ledger-export').handlers.click();await flush();await app.signOut();
 finish(json({organizationId:'CENTER_A',snapshot:'0',totalEntries:0,entries:[],nextCursor:null}));await pending;
 assert.equal(app.downloads.length,0);assert.equal(app.$('ledger-export').disabled,true);assert.equal(app.$('ledger-export-message').textContent,'');
});
test('incomplete ledger pages never produce a partial CSV download',async()=>{
 const app=mount(async(url)=>{
  if(url.endsWith('/session'))return json({token:'TEST',organizationId:'CENTER_A'});
  if(url.includes('/ledger-export'))return json({organizationId:'CENTER_A',snapshot:'2',totalEntries:2,entries:[],nextCursor:null});
  return json(bodyFor(url,'CENTER_A'));
 });
 await app.login('CENTER_A');await app.$('ledger-export').handlers.click();
 assert.equal(app.downloads.length,0);assert.match(app.$('ledger-export-message').textContent,/incomplete/);
});

test('delayed receipt evidence history cannot restore archive references after logout',async()=>{
 let finish;
 const app=mount(async(url)=>{
  if(url.endsWith('/session'))return json({token:'TEST',organizationId:'CENTER_A'});
  if(url.endsWith('/session/logout'))return new Response(null,{status:204});
  if(url.endsWith('/receipt-evidence'))return new Promise(resolve=>finish=resolve);
  return json(bodyFor(url,'CENTER_A'));
 });
 await app.login('CENTER_A');const pending=app.$('evidence-open').handlers.click();await flush();await app.signOut();
 finish(json({organizationId:'CENTER_A',requests:[{id:'private-case',archive_reference:'PRIVATE_ARCHIVE',evidence_sha256:'a'.repeat(64)}]}));await pending;
 assert.equal(app.$('evidence-history').children.length,0);assert.equal(app.$('evidence-file').value,'');assert.equal(app.$('evidence-panel').hidden,true);
});
