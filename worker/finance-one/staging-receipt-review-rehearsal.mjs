/** Fixed-target staging backup restore and migration-13 rehearsal. Never migrates staging. */
import {readFileSync,writeFileSync,chmodSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const accountId='9e116ff1df56f3e8aa0da63f21e9ba97';
const stagingId='17c1d0d7-aab1-4e4a-9afe-6b36554b8f93';
const migrationSha='094678f06e1aa45dbae9f8f644cb7473de06b2c7fa25020c3d609dd5ab46b0b9';
const sourceSha='9dd49fb480746f56dedec08807eb5a62c4776073';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[
 ['integrity','PRAGMA quick_check;'],
 ['foreign-keys','PRAGMA foreign_key_check;'],
 ['schema',"SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name LIKE 'neo_fin_%' ORDER BY type,name;"],
 ['financial-counts',`SELECT 'documents' AS item,COUNT(*) AS total FROM neo_fin_documents
 UNION ALL SELECT 'settlements',COUNT(*) FROM neo_fin_payment_settlements
 UNION ALL SELECT 'cash_events',COUNT(*) FROM neo_fin_cash_events
 UNION ALL SELECT 'journals',COUNT(*) FROM neo_fin_journals
 UNION ALL SELECT 'journal_lines',COUNT(*) FROM neo_fin_journal_lines
 UNION ALL SELECT 'receipt_verifications',COUNT(*) FROM neo_fin_receipt_verifications;`]
];
export async function rehearseReceiptReview({folder,stagingConfig,runner=execFileSync,request=fetch,log=console.log,now=Date.now}){
 let phase='backup verification';
 try{
  const backup=join(folder,'staging-before-migration-13.sql'),meta=JSON.parse(readFileSync(join(folder,'backup-evidence.json'),'utf8'));
  const bytes=readFileSync(backup);
  if(meta.databaseId!==stagingId||meta.bytes!==bytes.length||meta.sha256!==hash(bytes))throw Error('Backup verification failed');
  const text=readFileSync(stagingConfig,'utf8');
  for(const required of ['name = "neo-finance-one-staging"','account_id = "'+accountId+'"','database_id = "'+stagingId+'"','FINANCE_ONE_ENVIRONMENT = "staging"','FINANCE_ONE_OPERATIONS_ENABLED = "false"','FINANCE_ONE_SOURCE_OPERATIONS_ENABLED = "false"'])if(!text.includes(required))throw Error('Staging guard failed');
  const run=(config,args,capture=false)=>runner('npx',['--yes','wrangler@4.129.1',...args,'--config',config],{encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit',env:{...process.env,CI:'true',CLOUDFLARE_ACCOUNT_ID:accountId}});
  const inspect=(config,name,label)=>{
   const results=[];
   for(const [kind,sql] of checks){
    phase=label+'/'+kind;
    const raw=run(config,['d1','execute',name,'--remote','--command',sql,'--json'],true);
    const parsed=JSON.parse(raw);
    // One query per invocation: do not assume how D1 groups multi-statement results.
    if(!Array.isArray(parsed)||parsed.length!==1||parsed[0].success!==true||!Array.isArray(parsed[0].results))throw Error('Unconfirmed query');
    results.push(parsed[0].results);
   }
   if(results[0]?.[0]?.quick_check!=='ok'||results[1].length)throw Error('Integrity failed');
   writeFileSync(join(folder,label+'-check.json'),JSON.stringify(results,null,2),{mode:0o600});
   return results;
  };
  log('PASS: backup checksum and staging guards');
  const before=inspect(stagingConfig,'neo-finance-one-staging','source');
  if(before[2].some(r=>r.name.startsWith('neo_fin_receipt_evidence_')))throw Error('Migration 13 already present; inspect before selecting migrations');
  const config=join(folder,'wrangler.review-restore.toml');
  if(existsSync(config))throw Error('Existing restore config found; preserve and inspect it instead of creating another database');
  phase='create isolated restore database';
  const name='neo-finance-review-restore-'+now().toString(36);
  writeFileSync(config,'name = "neo-finance-review-restore-tool"\naccount_id = "'+accountId+'"\n',{mode:0o600});
  const created=run(config,['d1','create',name],true);
  const id=created.match(/database_id\s*=\s*"([a-f0-9-]{36})"/i)?.[1];
  if(!id||[stagingId,'e70605a8-2602-4502-8b7d-646688fec47a','a60f04c0-c504-4727-b042-f7f02fc846a8'].includes(id))throw Error('New restore ID not confirmed');
  writeFileSync(config,'name = "neo-finance-review-restore-tool"\naccount_id = "'+accountId+'"\n[[d1_databases]]\nbinding = "RESTORE_CHECK"\ndatabase_name = "'+name+'"\ndatabase_id = "'+id+'"\n',{mode:0o600});chmodSync(config,0o600);
  log('RESTORE DATABASE: '+name);log('RESTORE DATABASE ID: '+id);
  phase='restore backup into new test database';
  run(config,['d1','execute',name,'--remote','--file',backup]);
  const restored=inspect(config,name,'restored-before');
  if(JSON.stringify(before)!==JSON.stringify(restored))throw Error('Restored schema/counts differ');
  log('PASS: source and restored schema/counts match');
  phase='verified migration download';
  const url='https:'+'//'+'raw.githubusercontent.com/umakanthgilla/neo-school-india-website/'+sourceSha+'/migrations/finance_payroll_one_receipt_evidence_review.sql';
  const response=await request(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Download failed');
  const migration=Buffer.from(await response.arrayBuffer());if(hash(migration)!==migrationSha)throw Error('Migration checksum failed');
  const file=join(folder,'migration-13-verified.sql');writeFileSync(file,migration,{mode:0o600});
  phase='migration 13 on restore database only';
  run(config,['d1','execute',name,'--remote','--file',file]);
  const after=inspect(config,name,'restored-after');
  const objects=after[2].filter(r=>r.name.startsWith('neo_fin_receipt_evidence_'));
  const oldSchema=after[2].filter(r=>!r.name.startsWith('neo_fin_receipt_evidence_'));
  if(objects.length!==9||JSON.stringify(oldSchema)!==JSON.stringify(restored[2])||JSON.stringify(after[3])!==JSON.stringify(restored[3]))throw Error('Migration result differs');
  const evidence={checkedAt:new Date(now()).toISOString(),sourceDatabaseId:stagingId,restoreDatabaseName:name,restoreDatabaseId:id,backupSha256:meta.sha256,restoredSchemaAndCountsMatch:true,migration13Objects:objects.length,financialCountsUnchanged:true,stagingMigrationApplied:false};
  writeFileSync(join(folder,'migration-13-rehearsal.json'),JSON.stringify(evidence,null,2),{mode:0o600});
  log('PASS: migration 13 restore rehearsal');log('PASS: integrity OK; financial counts unchanged');log('STAGING MIGRATION: NOT APPLIED');log('EVIDENCE FOLDER: '+folder);
  return evidence;
 }catch{log('RESTORE STOPPED: '+phase);return null;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const folder=process.argv[2];
 if(!folder||process.argv.length!==3)throw Error('Usage: node staging-receipt-review-rehearsal.mjs BACKUP_FOLDER');
 const result=await rehearseReceiptReview({folder,stagingConfig:join(homedir(),'neo-finance-access-release.O0unLT/wrangler.access.staging.toml')});
 if(!result)process.exitCode=1;
}
