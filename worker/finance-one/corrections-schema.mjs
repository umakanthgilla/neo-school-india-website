/** Mandatory migration-11 objects; checked before any online correction operation. */
export const CORRECTION_SCHEMA=Object.freeze({
 table:['neo_fin_correction_requests','neo_fin_correction_decisions'],
 index:['neo_fin_one_approved_reversal'],
 trigger:['neo_fin_correction_request_validate','neo_fin_correction_decision_validate',
 'neo_fin_correction_post','neo_fin_correction_journal_authorized','neo_fin_correction_journal_exact',
 'neo_fin_correction_request_no_update','neo_fin_correction_request_no_delete',
 'neo_fin_correction_decision_no_update','neo_fin_correction_decision_no_delete']
});
export async function correctionSchemaReady(db){
 const rows=await db.prepare("SELECT type,name FROM sqlite_master WHERE name LIKE 'neo_fin_correction_%' OR name='neo_fin_one_approved_reversal'").all();
 if(!Array.isArray(rows?.results))return false;
 return Object.entries(CORRECTION_SCHEMA).every(([type,names])=>names.every(name=>rows.results.some(r=>r.type===type&&r.name===name)));
}
