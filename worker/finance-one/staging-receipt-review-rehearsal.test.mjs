import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rehearseReceiptReview} from './staging-receipt-review-rehearsal.mjs';
const names=['foundation','cash_projection','accounting_journals','auth_accounts','receipt_evidence','legacy_payout_integrity','statutory_review','statutory_remittance','session_revocations','issued_document_immutability','corrections','source_operations'];
const baseline=names.map(name=>readFileSync(new URL('../../migrations/finance_payroll_one_'+name+'.sql',import.meta.url),'utf8')).join('\n');
const migration=readFileSync(new URL('../../migrations/finance_payroll_one_receipt_evidence_review.sql',import.meta.url));
function fixture(){
 const folder=mkdtempSync(join(tmpdir(),'receipt-restore-test-')),stagingConfig=join(folder,'staging.toml');
 const source=new DatabaseSync(':memory:'),restored=new DatabaseSync(':memory:');source.exec(baseline);
 writeFileSync(join(folder,'staging-before-migration-13.sql'),baseline);
 writeFileSync(join(folder,'backup-evidence.json'),JSON.stringify({databaseId:'17c1d0d7-aab1-4e4a-9afe-6b36554b8f93',bytes:Buffer.byteLength(baseline),sha256:createHash('sha256').update(baseline).digest('hex')}));
 writeFileSync(stagingConfig,'name = "neo-finance-one-staging"\naccount_id = "9e116ff1df56f3e8aa0da63f21e9ba97"\ndatabase_id = "17c1d0d7-aab1-4e4a-9afe-6b36554b8f93"\nFINANCE_ONE_ENVIRONMENT = "staging"\nFINANCE_ONE_OPERATIONS_ENABLED = "false"\nFINANCE_ONE_SOURCE_OPERATIONS_ENABLED = "false"\n');
 let writes=0,queries=0;const logs=[];
 const runner=(binary,args)=>{
  assert.equal(binary,'npx');
  if(args.includes('create'))return 'database_id = "11111111-2222-4333-8444-555555555555"';
  const name=args[args.indexOf('execute')+1];
  if(args.includes('--file')){
   assert.notEqual(name,'neo-finance-one-staging');writes++;restored.exec(readFileSync(args[args.indexOf('--file')+1],'utf8'));return '';
  }
  queries++;const sql=args[args.indexOf('--command')+1];
  const results=(name==='neo-finance-one-staging'?source:restored).prepare(sql).all();
  return JSON.stringify([{success:true,results,meta:{}}]);
 };
 return {folder,stagingConfig,runner,logs,source,restored,get writes(){return writes;},get queries(){return queries;},close(){source.close();restored.close();rmSync(folder,{recursive:true,force:true});}};
}
test('restore helper checks each query separately, compares full schema and migrates only new restored database',async()=>{
 const f=fixture();try{
 const evidence=await rehearseReceiptReview({...f,request:async()=>new Response(migration),log:line=>f.logs.push(line),now:()=>1792123455000});
 assert.ok(evidence,f.logs.join('\n'));assert.equal(evidence.stagingMigrationApplied,false);assert.equal(f.writes,2);assert.equal(f.queries,12);
 assert.equal(f.source.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'neo_fin_receipt_evidence_%'").get().n,0);
 assert.equal(f.restored.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'neo_fin_receipt_evidence_%'").get().n,9);
 assert.equal(JSON.parse(readFileSync(join(f.folder,'migration-13-rehearsal.json'),'utf8')).financialCountsUnchanged,true);
 }finally{f.close();}
});
test('altered backup fails before creating a database or running any remote query',async()=>{
 const f=fixture();try{
 writeFileSync(join(f.folder,'staging-before-migration-13.sql'),'ALTERED');let called=false;
 const evidence=await rehearseReceiptReview({...f,runner:()=>{called=true;throw Error('Must not run');},log:()=>{}});
 assert.equal(evidence,null);assert.equal(called,false);
 }finally{f.close();}
});
