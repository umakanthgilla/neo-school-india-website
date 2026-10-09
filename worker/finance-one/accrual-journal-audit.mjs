/**
 * STAGING-ONLY, READ-ONLY Finance approved accrual document ↔ posted journal audit.
 * A balanced total is insufficient: the accounts, source document and amounts
 * must match within the independently-owned legal business. No tax certification.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
const MAPPINGS=Object.freeze({
 sales_invoice:[['1100','asset'],['4000','income']],
 purchase_bill:[['5200','expense'],['2000','liability']],
 payroll_liability:[['5100','expense'],['2100','liability']]
});
const STAT_CODES=new Set(['2111','2112','2113','2114']);
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const LIMIT=50;
function add(report,code,context){
 report.issueCount++;
 report.counts[code]=(report.counts[code]||0)+1;
 if(report.findings.length<LIMIT)report.findings.push(Object.freeze({code,...context}));
}
function standard(doc,lines){
 const mapping=MAPPINGS[doc.document_type];
 if(!mapping||lines.length!==2)return false;
 const [dr,cr]=mapping;
 return lines.every((r,i)=>r.line_no===i+1&&r.active===1&&
  r.account_code===mapping[i][0]&&r.account_type===mapping[i][1]&&
  (i===0?r.debit_paise===doc.gross_paise&&r.credit_paise===0:
         r.debit_paise===0&&r.credit_paise===doc.gross_paise));
}
function legacyPayroll(doc,lines){
 if(lines.length<2)return false;
 let dr=0,cr=0,earned=0,employer=0,hasSalary=false;
 for(let i=0;i<lines.length;i++){
  const l=lines[i],code=l.account_code;
  if(l.line_no!==i+1||l.active!==1||!safe(l.debit_paise)||!safe(l.credit_paise))return false;
  if(l.debit_paise>0){
   if(l.credit_paise!==0||l.account_type!=='expense')return false;
   if(code==='5100')earned+=l.debit_paise;
   else if(code==='5300')employer+=l.debit_paise;
   else return false;
   dr+=l.debit_paise;
  }else if(l.credit_paise>0){
   if(l.debit_paise!==0||l.account_type!=='liability')return false;
   if(code==='2100')hasSalary=true;
   else if(!STAT_CODES.has(code))return false;
   cr+=l.credit_paise;
  }else return false;
  if(!safe(dr)||!safe(cr)||!safe(earned)||!safe(employer))return false;
 }
 return earned===doc.gross_paise&&dr===cr&&
  (hasSalary||lines.some(l=>STAT_CODES.has(l.account_code)))&&
  lines[0].account_code==='5100'&&lines[0].debit_paise===earned;
}
function validPosting(doc,lines){
 if(!safe(doc.gross_paise)||doc.gross_paise===0)return false;
 if(doc.document_type==='payroll_liability'&&doc.source_kind==='legacy_payroll')
  return legacyPayroll(doc,lines);
 return standard(doc,lines);
}
export async function auditFinanceAccrualJournals({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const [documents,journals,lines]=await Promise.all([
  db.prepare(`SELECT d.id,d.document_type,d.source_kind,d.status,d.gross_paise,
   j.id AS journal_id,j.status AS journal_status
   FROM neo_fin_documents d LEFT JOIN neo_fin_journals j
    ON j.organization_id=d.organization_id AND j.source_kind='document' AND j.source_id=d.id
   WHERE d.organization_id=?
     AND (d.document_type IN ('sales_invoice','purchase_bill','payroll_liability') OR j.id IS NOT NULL)
   ORDER BY d.id`).bind(organizationId).all(),
  db.prepare(`SELECT j.id AS journal_id,j.source_id FROM neo_fin_journals j
   LEFT JOIN neo_fin_documents d ON d.organization_id=j.organization_id AND d.id=j.source_id
   WHERE j.organization_id=? AND j.source_kind='document' AND d.id IS NULL
   ORDER BY j.id`).bind(organizationId).all(),
  db.prepare(`SELECT j.source_id AS document_id,l.line_no,
   a.account_code,a.account_type,a.active,l.debit_paise,l.credit_paise
   FROM neo_fin_journals j JOIN neo_fin_journal_lines l
    ON l.organization_id=j.organization_id AND l.journal_id=j.id
   JOIN neo_fin_accounts a ON a.organization_id=l.organization_id AND a.id=l.account_id
   WHERE j.organization_id=? AND j.source_kind='document'
   ORDER BY j.source_id,l.line_no`).bind(organizationId).all()
 ]);
 if(!Array.isArray(documents?.results)||!Array.isArray(journals?.results)||!Array.isArray(lines?.results))
  throw Error('Finance accrual audit unavailable');
 const byDocument=new Map();
 for(const row of lines.results){
  if(!byDocument.has(row.document_id))byDocument.set(row.document_id,[]);
  byDocument.get(row.document_id).push(row);
 }
 const result={organizationId,documentCount:0,orphanJournalCount:journals.results.length,
  issueCount:0,counts:{},findings:[]};
 for(const doc of documents.results){
  if(doc.status!=='approved'&&!doc.journal_id)continue;
  result.documentCount++;
  const context={documentId:doc.id,documentType:doc.document_type};
  if(!doc.journal_id){add(result,'missing_accrual_journal',context);continue;}
  if(doc.status!=='approved'){add(result,'nonapproved_accrual_document',context);continue;}
  if(doc.journal_status!=='posted'){add(result,'accrual_journal_not_posted',context);continue;}
  if(!validPosting(doc,byDocument.get(doc.id)||[]))
   add(result,'accrual_posting_mismatch',context);
 }
 for(const journal of journals.results)
  add(result,'orphan_accrual_journal',{documentId:journal.source_id,journalId:journal.journal_id});
 return Object.freeze({
  organizationId,ready:result.issueCount===0,
  documentCount:result.documentCount,orphanJournalCount:result.orphanJournalCount,
  issueCount:result.issueCount,counts:Object.freeze(result.counts),
  findings:Object.freeze(result.findings),
  findingsTruncated:result.issueCount>result.findings.length,
  note:'Document-to-journal consistency only; not proof of source genuineness or legal accounting compliance'
 });
}
