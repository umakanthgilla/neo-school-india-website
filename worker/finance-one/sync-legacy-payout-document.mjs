/**
 * Staging-only original payout -> Finance approved PAYMENT DOCUMENT import.
 * This recognizes the original payout record, NOT proof of bank settlement.
 * It never creates a Finance cash event, a journal, or another Daily Ledger row.
 */
import {resolveFinanceOrganization} from './organization-access.mjs';
const TYPES=Object.freeze({
 vendor_payment:{kind:'vendor_payments',status:['Paid'],voucher:'VENDOR_',ledger:'FIN_VENDOR_',voucherSource:'vendor_payment',amount:'amount_paise'},
 payroll_payment:{kind:'payroll',status:['Paid'],voucher:'PAY_',ledger:'FIN_PAY_',voucherSource:'payroll',amount:'net_paise'},
 salary_advance_release:{kind:'salary_advances',status:['Released','Recovered','Partially Recovered'],voucher:'ADV_',ledger:'FIN_ADV_',voucherSource:'salary_advance',amount:'amount_paise'}
});
const idPattern=/^[A-Za-z0-9_-]{1,100}$/;
async function legacy(db,school,kind,id){
 const r=await db.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind=? AND id=?").bind(school,kind,id).first();
 if(!r?.data)return null;
 try{return JSON.parse(r.data);}catch{return null;}
}
export async function syncLegacyPayoutDocument({
 db,authenticatedAccountId,organizationId,schoolId,legacyRecordId,sourceKind
}){
 const spec=Object.prototype.hasOwnProperty.call(TYPES,sourceKind)?TYPES[sourceKind]:null;
 if(!spec||![schoolId,legacyRecordId].every(x=>typeof x==='string'&&idPattern.test(x)))throw Error('Invalid original payout');
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','write');
 const owner=await db.prepare("SELECT organization_id FROM neo_fin_school_ownership WHERE school_id=? AND organization_id=? AND effective_to IS NULL LIMIT 1")
  .bind(schoolId,organizationId).first();
 if(!owner)throw Error('Independent business ownership required');
 const original=await legacy(db,schoolId,spec.kind,legacyRecordId);
 const amount=original?.[spec.amount];
 if(!original||!spec.status.includes(original.status)||!Number.isSafeInteger(amount)||amount<=0)throw Error('Original payout not approved or invalid');
 const voucherId=spec.voucher+legacyRecordId;
 const voucher=await legacy(db,schoolId,'vouchers',voucherId);
 if(!voucher||voucher.source_kind!==spec.voucherSource||voucher.source_id!==legacyRecordId||
  voucher.status!=='Paid'||voucher.amount_paise!==amount||!voucher.voucher_no)
  throw Error('Original payout voucher missing or mismatched');
 const matching=await db.prepare(`SELECT id,data FROM neo_portal_records
 WHERE school_id=? AND kind='daily_accounts'
 AND json_extract(data,'$.source_kind')='voucher'
 AND json_extract(data,'$.source_id')=? LIMIT 2`).bind(schoolId,voucherId).all();
 if(matching?.results?.length!==1||matching.results[0].id!==spec.ledger+legacyRecordId)
  throw Error('Original payout ledger missing or duplicated');
 let entry;
 try{entry=JSON.parse(matching.results[0].data);}catch{throw Error('Original ledger invalid');}
 if(entry.direction!=='OUT'||entry.status!=='Posted'||entry.amount_paise!==amount||entry.reference!==voucher.voucher_no)
  throw Error('Original payout ledger mismatched');
 const sourceId=schoolId+'|'+legacyRecordId;
 const documentId='LEGACY_PAY|'+sourceKind+'|'+schoolId+'|'+legacyRecordId;
 const query='SELECT id,document_type,status,gross_paise,source_kind,source_id FROM neo_fin_documents WHERE organization_id=? AND id=?';
 const verify=async()=>{
  const doc=await db.prepare(query).bind(organizationId,documentId).first();
  if(!doc||doc.document_type!=='payment'||doc.status!=='approved'||
     doc.gross_paise!==amount||doc.source_kind!==sourceKind||doc.source_id!==sourceId)
    throw Error('Conflicting original payout accounting document');
 };
 let created=false;
 const existing=await db.prepare(query).bind(organizationId,documentId).first();
 if(!existing){
  const result=await db.prepare(`INSERT INTO neo_fin_documents
   (organization_id,id,document_type,status,gross_paise,source_kind,source_id)
   VALUES (?,?,'payment','approved',?,?,?)
   ON CONFLICT(organization_id,id) DO NOTHING`)
   .bind(organizationId,documentId,amount,sourceKind,sourceId).run();
  if(result?.success!==true||!Number.isInteger(result?.meta?.changes))throw Error('Source payment document posting failed');
  created=result.meta.changes===1;
 }
 await verify();
 return Object.freeze({organizationId,schoolId,legacyRecordId,sourceKind,documentId,created});
}
