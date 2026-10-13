/** Browser QA on a disposable local SQLite Worker fixture. Never contacts Cloudflare. */
import {chromium,webkit,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {STANDARD_CHART} from './accounting-chart.mjs';
import worker from './staging-entry.mjs';
import {createFinancePasswordRecord} from './finance-password.mjs';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';
const password='SyntheticQAOnly-Password-2026!';
const migrations=['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections'];
const html=readFileSync(new URL('../../finance-one/portal.html',import.meta.url),'utf8');
async function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const name of migrations)sqlite.exec(readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8'));
 const db={prepare(q){const s=sqlite.prepare(q),bound=a=>({first:async()=>s.get(...a),all:async()=>({results:s.all(...a)}),run:async()=>({success:true,meta:{changes:s.run(...a).changes}})});return{...bound([]),bind:(...a)=>bound(a)};},async batch(stmts){sqlite.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 sqlite.exec(`INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES('QA_CENTER','Synthetic QA Center','independent_center');
 INSERT INTO neo_fin_memberships(organization_id,account_id,role) VALUES('QA_CENTER','fin:maker','accountant'),('QA_CENTER','fin:checker','owner');
 INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise) VALUES('QA_CENTER','QA-INVOICE','sales_invoice','approved',10000);`);
 for(const [code,name,type] of STANDARD_CHART)sqlite.prepare("INSERT INTO neo_fin_accounts VALUES('QA_CENTER',?,?,?,?,1)").run(code,code,name,type);
 for(const accountId of ['fin:maker','fin:checker']){const p=await createFinancePasswordRecord({accountId,password});sqlite.prepare('INSERT INTO neo_fin_auth_accounts(account_id,salt,password_hash,iterations) VALUES(?,?,?,?)').run(accountId,p.salt,p.passwordHash,p.iterations);}
 await postAccrualJournalForDocument(db,'QA_CENTER','QA-INVOICE');
 const env={DB:db,FINANCE_ONE_ENVIRONMENT:'staging',FINANCE_ONE_READ_API_ENABLED:'true',FINANCE_ONE_OPERATIONS_ENABLED:'true',FINANCE_ONE_SESSION_SECRET:'SyntheticQAOnly-32-character-session-secret',FINANCE_ONE_LOGIN_CLIENT_LIMIT:{limit:async()=>({success:true})},FINANCE_ONE_LOGIN_ACCOUNT_LIMIT:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response(html)}};
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end('Fixture failed');console.error(e);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return{sqlite,server,url:'http://127.0.0.1:'+server.address().port};
}
mkdirSync('/tmp/finance-one-browser-qa',{recursive:true});
for(const [name,engine] of Object.entries({chromium,webkit})){
 const f=await fixture();let browser;
 try{
  browser=await engine.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.url+'/portal.html');
  async function login(account){await page.getByLabel('Business / Organization ID').fill('QA_CENTER');await page.getByLabel('Finance Account ID').fill(account);await page.getByLabel('Finance Password').fill(password);await page.getByRole('button',{name:'Sign in securely'}).click();await expect(page.locator('#money-in')).not.toHaveText('—');await expect(page.locator('#dash-error')).toHaveText('');}
  await login('fin:maker');await page.getByRole('button',{name:'Corrections & Approvals'}).click();
  await expect(page.locator('#correction-journal option')).toHaveCount(1);
  await page.getByLabel('Reason and source reference').fill('Synthetic duplicate invoice confirmed against original source');
  await page.getByRole('button',{name:'Request independent review'}).click();
  await expect(page.locator('#correction-requests')).toContainText('pending');
  await expect(page.getByRole('button',{name:'Approve accounting reversal'})).toHaveCount(0);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.locator('#correction-requests')).toBeEmpty();
  await login('fin:checker');await page.getByRole('button',{name:'Corrections & Approvals'}).click();
  await page.getByLabel(/Review note for/).fill('Synthetic independent review confirms full accrual reversal');
  await page.getByRole('button',{name:'Approve accounting reversal'}).click();
  await expect(page.locator('#correction-requests')).toContainText('approved');
  await expect(page.locator('#profit')).toContainText('0.00');
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' layout overflow at '+width);
   await page.screenshot({path:'/tmp/finance-one-browser-qa/'+name+'-'+width+'.png',fullPage:true});
  }
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM neo_fin_cash_events').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM neo_fin_correction_decisions').get().n,1);
  assert.deepEqual(errors,[]);
  console.log(name+': PASS — login, independent correction approval, logout privacy, zero cash, 390/768/1440px');
 }finally{if(browser)await browser.close();await new Promise(resolve=>f.server.close(resolve));f.sqlite.close();}
}
