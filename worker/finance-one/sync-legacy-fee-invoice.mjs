/**
 * Finance ONE staging: import an EXISTING, source-validated Neo School India
 * fee invoice into the owning independent business accounting books.
 * Never creates a second legacy invoice or Daily Cash Ledger entry.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
import {postAccrualJournalForDocument} from './accrual-journal.mjs';

const positive=value=>Number.isSafeInteger(value)&&value>0;
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=128;

export async function syncLegacyFeeInvoice({
 db,authenticatedAccountId,organizationId,schoolId,invoiceRecordId
}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 if(!validId(schoolId)||!validId(invoiceRecordId))throw Error('School and original invoice required');
 const owner=await db.prepare(`SELECT school_id FROM neo_fin_school_ownership
   WHERE school_id=? AND organization_id=? AND effective_to IS NULL LIMIT 1`)
   .bind(schoolId,organizationId).first();
 if(!owner)throw Error('School is not owned by this independent business');
 const stored=await db.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind='invoices' AND id=?")
   .bind(schoolId,invoiceRecordId).first();
 if(!stored?.data)throw Error('Original school fee invoice unavailable');
 let source;try{source=JSON.parse(stored.data);}catch{throw Error('Invalid original fee invoice');}
 if(!positive(source?.amount_paise)||!validId(source.student_id)||!validId(source.fee_structure_id) ||
   typeof source.due_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(source.due_date))
   throw Error('Invalid original fee invoice');
 // Existing portal generates invoices from a fee structure. Refuse non-existent
 // or cross-school fee structures before recognizing receivable/revenue.
 const feeStructure=await db.prepare("SELECT id FROM neo_portal_records WHERE school_id=? AND kind='fee_structures' AND id=?")
   .bind(schoolId,source.fee_structure_id).first();
 if(!feeStructure)throw Error('Original fee structure missing');
 const student=await db.prepare("SELECT id FROM neo_portal_records WHERE school_id=? AND kind='students' AND id=?")
   .bind(schoolId,source.student_id).first();
 if(!student)throw Error('Original student record missing');
 const documentId='FEE_INV|'+schoolId.length+':'+schoolId+'|'+invoiceRecordId.length+':'+invoiceRecordId;
 const prior=()=>db.prepare(`SELECT id,document_type,status,gross_paise,source_kind,source_id,currency
 FROM neo_fin_documents WHERE organization_id=? AND id=?`).bind(organizationId,documentId).first();
 const confirm=async()=>{
   const doc=await prior();
   if(!doc || doc.document_type!=='sales_invoice'||doc.status!=='approved'||
      doc.gross_paise!==source.amount_paise||doc.source_kind!=='legacy_invoice'||
      doc.source_id!==invoiceRecordId||doc.currency!=='INR')
     throw Error('Conflicting fee invoice accounting record; reconcile');
 };
 // Document may exist after a previous interruption. New inserts are unique per
 // legal owner/source, and a wrong prior amount is never silently ignored.
 const existing=await prior();
 let created=false;
 if(!existing){
  const r=await db.prepare(`INSERT INTO neo_fin_documents
    (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
    VALUES (?,?,'sales_invoice','approved',?,'legacy_invoice',?)
    ON CONFLICT(organization_id,id) DO NOTHING`)
    .bind(organizationId,documentId,source.amount_paise,invoiceRecordId).run();
  if(r?.success!==true||!Number.isInteger(r?.meta?.changes))throw Error('Fee invoice posting failed');
  created=r.meta.changes===1;
 }
 await confirm();
 // Invoice creates accrual accounting only; no money movement until a separately
 // verified matching fee receipt is settled.
 const journal=await postAccrualJournalForDocument(db,organizationId,documentId);
 return Object.freeze({organizationId,schoolId,invoiceRecordId,documentId,
    documentCreated:created,journalCreated:journal.created,journalId:journal.journalId});
}
