/** Read original receipt linkage only. Does not certify evidence or modify the school. */
export async function readReceiptEvidenceSource({db,sourceDb,organizationId,schoolId,paymentRecordId}){
 const ownership=await db.prepare("SELECT effective_from FROM neo_fin_school_ownership WHERE organization_id=? AND school_id=? AND effective_to IS NULL").bind(organizationId,schoolId).first();
 if(!ownership)throw Error('Receipt ownership unavailable');
 const row=await sourceDb.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind='payments' AND id=?").bind(schoolId,paymentRecordId).first();
 if(!row?.data)throw Error('Original receipt unavailable');
 const fee=JSON.parse(row.data);
 if(typeof fee.receipt_no!=='string'||!fee.receipt_no.trim()||fee.receipt_no.length>200||typeof fee.invoice_id!=='string'||!fee.invoice_id||!Number.isSafeInteger(fee.amount_paise)||fee.amount_paise<=0||!['Cash','UPI','Bank transfer','Cheque'].includes(fee.method))throw Error('Invalid original receipt');
 const result=await sourceDb.prepare("SELECT id,data FROM neo_portal_records WHERE school_id=? AND kind='daily_accounts' AND json_extract(data,'$.source_kind')='fee_payment' AND json_extract(data,'$.source_id')=? LIMIT 2").bind(schoolId,paymentRecordId).all();
 if(result.results?.length!==1||result.results[0].id!=='FIN_FEE_'+paymentRecordId)throw Error('Original receipt ledger missing or duplicated');
 const ledger=JSON.parse(result.results[0].data);
 if(ledger.direction!=='IN'||ledger.status!=='Posted'||ledger.amount_paise!==fee.amount_paise||ledger.reference!==fee.receipt_no)throw Error('Original receipt ledger mismatched');
 const payload=JSON.stringify([schoolId,paymentRecordId,row.data,result.results[0].id,result.results[0].data]);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
 return {receiptNo:fee.receipt_no,amountPaise:fee.amount_paise,evidenceType:fee.method==='Cash'?'cash_counted':'bank_reconciled',fingerprint:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join(''),effectiveFrom:ownership.effective_from};
}
