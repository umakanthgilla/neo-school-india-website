/**
 * STAGING-ONLY, READ-ONLY Finance approved accrual document ↔ posted journal audit.
 * A balanced total is insufficient: the accounts, source document and amounts
 * must match within the independently-owned legal business. No tax certification.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {approvedLegacyPayrollAccrualMatches} from './legacy-payroll-accrual-audit.mjs';
const MAPPINGS=Object.freeze({
 sales_invoice:[['1100','asset'],['4000','income']],
 purchase_bill:[['5200','expense'],['2000','liability']],
 payroll_liability:[['5100','expense'],['2100','liability']]
});
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
function validPosting(doc,lines){
 if(!Number.isSafeInteger(doc.gross_paise)||doc.gross_paise<=0)return false;
 return standard(doc,lines);
}
export async function auditFinanceAccrualJournals({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const [documents,journals,lines]=await Promise.all([
  db.prepare(`SELECT d.id,d.document_type,d.source_kind,d.source_id,d.status,d.gross_paise,
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
  const actualLines=byDocument.get(doc.id)||[];
  const valid=doc.document_type==='payroll_liability'&&doc.source_kind==='legacy_payroll'
   ? await approvedLegacyPayrollAccrualMatches(db,organizationId,doc,actualLines)
   : validPosting(doc,actualLines);
  if(!valid)add(result,'accrual_posting_mismatch',context);
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
