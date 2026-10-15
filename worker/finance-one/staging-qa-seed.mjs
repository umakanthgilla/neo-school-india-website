/** Offline synthetic seed generator. Never connects to Cloudflare or production. */
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {STANDARD_CHART} from './accounting-chart.mjs';
import {createFinancePasswordRecord} from './finance-password.mjs';
export const STAGING_DATABASE_ID='17c1d0d7-aab1-4e4a-9afe-6b36554b8f93';
const quote=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
const schoolSchema='CREATE TABLE IF NOT EXISTS neo_portal_records (school_id TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(school_id,kind,id));';
function syntheticSchoolRows(){
 return ['A','B','HO'].flatMap(suffix=>[
  ['students','QA_STUDENT',{}],['fee_structures','QA_FEES',{}],
  ['invoices','QA_INVOICE',{student_id:'QA_STUDENT',fee_structure_id:'QA_FEES',amount_paise:10000,due_date:'2026-10-14'}],
  ['payments','QA_PAYMENT',{invoice_id:'QA_INVOICE',receipt_no:'QA-RECEIPT',amount_paise:10000,method:'UPI'}],
  ['daily_accounts','FIN_FEE_QA_PAYMENT',{source_kind:'fee_payment',source_id:'QA_PAYMENT',direction:'IN',amount_paise:10000,reference:'QA-RECEIPT',status:'Posted'}]
 ].map(([kind,id,data])=>['QA_SCHOOL_20261014_'+suffix,kind,id,JSON.stringify(data)]));
}
/** Source-only fixture for a NEW isolated school staging D1. No credentials or Finance writes. */
export function generateSyntheticSchoolSourceSql(){
 return ['-- SYNTHETIC SCHOOL QA ONLY. Import into a new isolated source database, never production.',schoolSchema,
  ...syntheticSchoolRows().map(values=>`INSERT INTO neo_portal_records (school_id,kind,id,data) VALUES (${values.map(quote).join(',')});`)].join('\n')+'\n';
}
export async function generateStagingQaSeed({databaseId}){
 if(databaseId!==STAGING_DATABASE_ID)throw Error('Only the dedicated Finance staging database is permitted');
 const statements=['-- SYNTHETIC QA ONLY. Review target UUID before importing. Never apply to production.',
  '-- Import once; duplicate IDs intentionally fail. Keep both operation flags OFF until verification.',
  schoolSchema];
 const insert=(table,columns,values)=>statements.push(`INSERT INTO ${table} (${columns}) VALUES (${values.map(quote).join(',')});`);
 const credentials=[];
 for(const suffix of ['A','B','HO']){
  const org='QA_FIN_20261014_'+suffix,school='QA_SCHOOL_20261014_'+suffix;
  insert('neo_fin_organizations','id,legal_name,organization_type',[org,'SYNTHETIC QA '+suffix,suffix==='HO'?'head_office':'independent_center']);
  insert('neo_fin_school_ownership','school_id,organization_id,effective_from',[school,org,'2026-01-01']);
  for(const [code,name,type] of STANDARD_CHART)insert('neo_fin_accounts','organization_id,id,account_code,account_name,account_type',[org,'SYS_'+code,code,name,type]);
  for(const [label,role] of (suffix==='A'?[['maker','accountant'],['checker','owner'],['reader','auditor']]:[['owner','owner']])){
   const accountId='fin:qa20261014_'+suffix.toLowerCase()+'_'+label;
   const password=randomBytes(24).toString('base64url');
   const record=await createFinancePasswordRecord({accountId,password});
   insert('neo_fin_auth_accounts','account_id,salt,password_hash,iterations',[accountId,record.salt,record.passwordHash,record.iterations]);
   insert('neo_fin_memberships','organization_id,account_id,role',[org,accountId,role]);
   credentials.push({organizationId:org,accountId,role,password});
  }
  for(const row of syntheticSchoolRows().filter(row=>row[0]===school))insert('neo_portal_records','school_id,kind,id,data',row);
 }
 // No receipt evidence, statutory sign-off or financial postings are invented.
 return{sql:statements.join('\n')+'\n',credentials,databaseId};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [databaseId,outputDirectory,...extra]=process.argv.slice(2);
 if(!outputDirectory||extra.length)throw Error('Usage: node worker/finance-one/staging-qa-seed.mjs STAGING_UUID NEW_PRIVATE_OUTPUT_DIRECTORY');
 const seed=await generateStagingQaSeed({databaseId});
 mkdirSync(outputDirectory,{mode:0o700}); // Refuse existing paths; never overwrite credentials.
 writeFileSync(resolve(outputDirectory,'synthetic-qa.sql'),seed.sql,{mode:0o600,flag:'wx'});
 writeFileSync(resolve(outputDirectory,'private-logins.json'),JSON.stringify(seed.credentials,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('Offline QA files prepared. No database changed. Keep private-logins.json private; do not paste it into chat.');
}
