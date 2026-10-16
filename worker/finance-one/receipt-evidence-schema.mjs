export const RECEIPT_EVIDENCE_SCHEMA={table:['neo_fin_receipt_evidence_requests','neo_fin_receipt_evidence_decisions'],trigger:['neo_fin_receipt_evidence_request_validate','neo_fin_receipt_evidence_decision_validate','neo_fin_receipt_evidence_approve','neo_fin_receipt_evidence_request_no_update','neo_fin_receipt_evidence_request_no_delete','neo_fin_receipt_evidence_decision_no_update','neo_fin_receipt_evidence_decision_no_delete','neo_fin_receipt_verification_no_update','neo_fin_receipt_verification_no_delete'],index:['neo_fin_receipt_by_school']};
export async function receiptEvidenceSchemaReady(db){
 const r=await db.prepare("SELECT type,name FROM sqlite_master WHERE name LIKE 'neo_fin_receipt_%'").all();
 return Object.entries(RECEIPT_EVIDENCE_SCHEMA).every(([type,names])=>names.every(name=>r.results?.some(row=>row.type===type&&row.name===name)));
}
