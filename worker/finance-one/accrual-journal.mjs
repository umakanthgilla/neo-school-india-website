/** Neo Finance ONE: staging-only approved document to double-entry accrual journal.
 * Does not create or modify a cash event. No public route or direct manual ledger.
 */
const mappings=Object.freeze({
 sales_invoice:['1100','4000'],
 purchase_bill:['5200','2000'],
 payroll_liability:['5100','2100']
});
export async function postAccrualJournalForDocument(db,organizationId,documentId,{postedAt}={}) {
 if(!db || !organizationId || !documentId || typeof organizationId!=='string'||typeof documentId!=='string')throw new Error('Business and document required');
 const doc=await db.prepare('SELECT organization_id,id,document_type,status,gross_paise,source_kind FROM neo_fin_documents WHERE organization_id=? AND id=?').bind(organizationId,documentId).first();
 if(!doc || doc.status!=='approved' || doc.organization_id!==organizationId)throw new Error('Approved document for business required');
 if(doc.document_type==='payroll_liability' && doc.source_kind==='legacy_payroll')throw new Error('Legacy payroll requires deduction-aware accrual journal');
 const rule=Object.prototype.hasOwnProperty.call(mappings,doc.document_type)?mappings[doc.document_type]:null;
 if(!rule)throw new Error('Unsupported accounting document');
 if(!Number.isSafeInteger(doc.gross_paise)||doc.gross_paise<=0)throw new Error('Invalid document amount');
 const [debitCode,creditCode]=rule;
 const existing=await db.prepare('SELECT id,account_code,active FROM neo_fin_accounts WHERE organization_id=? AND account_code IN (?,?)').bind(organizationId,debitCode,creditCode).all();
 const accounts=new Map((existing.results||[]).filter(a=>a.active===1).map(a=>[a.account_code,a.id]));
 const dr=accounts.get(debitCode),cr=accounts.get(creditCode);
 if(!dr||!cr||dr===cr)throw new Error('Business accounting configuration incomplete');
 const journalId='JNL-DOC|'+documentId;
 const previous=async()=>{
  const journal=await db.prepare('SELECT id,status FROM neo_fin_journals WHERE organization_id=? AND source_kind=? AND source_id=?').bind(organizationId,'document',documentId).first();
  if(!journal)return false;
  if(journal.status!=='posted')throw new Error('Unfinished accrual journal');
  const lines=await db.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE organization_id=? AND journal_id=? ORDER BY line_no').bind(organizationId,journal.id).all();
  const x=lines.results||[];
  if(x.length!==2||x[0].account_id!==dr||x[0].debit_paise!==doc.gross_paise||x[0].credit_paise!==0||x[1].account_id!==cr||x[1].credit_paise!==doc.gross_paise||x[1].debit_paise!==0)throw new Error('Conflicting accrual journal; reconcile');
  return true;
 };
 if(await previous())return Object.freeze({journalId,created:false});
 const date=postedAt||new Date().toISOString();if(!Number.isFinite(Date.parse(date)))throw new Error('Invalid posting timestamp');
 try {
  const results=await db.batch([
    db.prepare('INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,?,?)').bind(organizationId,journalId,'document',documentId),
    db.prepare('INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)').bind(organizationId,journalId,1,dr,doc.gross_paise,0),
    db.prepare('INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)').bind(organizationId,journalId,2,cr,0,doc.gross_paise),
    db.prepare("UPDATE neo_fin_journals SET status='posted',posted_at=? WHERE organization_id=? AND id=? AND status='draft'").bind(date,organizationId,journalId)
  ]);
  if(!Array.isArray(results)||results.length!==4||results.some(x=>x.success!==true))throw new Error('Accrual posting transaction failed');
  return Object.freeze({journalId,created:true});
 } catch(err){if(await previous())return Object.freeze({journalId,created:false});throw err;}
}
