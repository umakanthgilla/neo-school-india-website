// Local browser contract check with synthetic API responses; no deployed E2E claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
 ?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=resolve(import.meta.dirname,'../..');
let enabled=true;
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+'/'))throw Error('invalid path');
  let body=await readFile(path);
  if(pathname==='/employees.html'&&enabled)body=Buffer.from(body.toString().replace('<html lang="en">','<html lang="en" data-one-ai-staging="true">'));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');
  res.end(body);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('neo_employee_token','synthetic.session'));
 let draft=null,generations=0;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin)return route.abort();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/employee/me')return json({account_id:'staff-a',name:'Synthetic staff',staff_id:'TEST-1',staff_type:'Admissions',school:{name:'Synthetic School'},staff:{},attendance:[],leaves:[],advances:[],payroll:[]});
  if(url.pathname.startsWith('/api/one-ai/')){
   assert.equal(req.headers().authorization,'Bearer synthetic.session');
   if(url.pathname.endsWith('/generate')){
    generations++;assert.ok(req.headers()['idempotency-key']);
    assert.equal(req.postDataJSON().language,'te');
    draft={id:'draft-1',leadId:'enquiry:E1',language:'te',message:'<img src=x onerror=alert(1)> నమస్కారం',state:'draft',version:1,createdAt:'2026-10-17'};
    return json(draft,201);
   }
   if(url.pathname.endsWith('/transition')){
    const body=req.postDataJSON();
    if(body.action==='approve')return json({error:'Separate manager approval required'},403);
    draft={...draft,state:body.action==='submit'?'pending_review':'draft',version:draft.version+1,...(body.action==='edit'?{message:body.message}:{})};
    return json(draft);
   }
   return json({drafts:draft?[draft]:[],nextCursor:null});
  }
  return route.continue();
 });
 await page.goto(origin+'/employees.html');
 await page.getByRole('textbox',{name:'CRM lead reference'}).fill('enquiry:E1');
 await page.getByRole('button',{name:'Open draft review',exact:true}).click();
 await page.getByText('No drafts yet.',{exact:true}).waitFor();
 await page.getByLabel('Draft language').selectOption('te');
 await page.getByRole('button',{name:'Generate draft',exact:true}).click();
 await page.getByText('draft · Version 1.',{exact:false}).waitFor();
 assert.equal(generations,1);
 assert.equal(await page.locator('.one-ai-panel img').count(),0);
 await page.getByRole('button',{name:'Submit for approval',exact:true}).click();
 await page.getByText('pending_review · Version 2.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Approve',exact:true}).click();
 await page.getByText('Separate manager approval required',{exact:true}).waitFor();
 const bounds=await page.locator('.one-ai-panel').boundingBox();
 assert.ok(bounds.width<=390);
 await page.locator('#employeeLogout').click();
 assert.equal(await page.locator('.one-ai-panel').count(),0);
 assert.deepEqual(errors,[]);
 enabled=false;await page.reload();
 assert.equal(await page.locator('input[placeholder="enquiry:E1 or growth:L1"]').count(),0);
 console.log('PASS: mobile employee session, Telugu generation, submission, approval denial, text-only rendering, logout cleanup, default-disabled UI. Synthetic APIs only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
