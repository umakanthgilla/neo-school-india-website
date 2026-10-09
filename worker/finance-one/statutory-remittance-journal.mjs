/**
 * Post one approved, independently verified PF/ESI/PT/TDS remittance voucher.
 * Debit statutory payable; credit bank. No direct legacy Daily Ledger inserts.
 */
import {verifyStatutoryBankRemittance} from './statutory-remittance-verifier.mjs';
const valid=v=>typeof v==='string'&&v.length>0&&v.length<512;
export async function postStatutoryRemittanceJournal(db,organizationId,eventId){
 if(!db?.batch||!valid(organizationId)||!valid(eventId))throw Error('Trusted statutory event required');
 const event=await db.prepare(`SELECT organization_id,event_id,source_kind,source_id,source_event_id,
  direction,amount_paise,effective_at,verification_reference FROM neo_fin_cash_events
  WHERE organization_id=? AND event_id=?`).bind(organizationId,eventId).first();
 if(!event||event.organization_id!==organizationId||
  event.source_kind!=='statutory_remittance_paid'||event.direction!=='money_out'||
  !Number.isSafeInteger(event.amount_paise)||event.amount_paise<=0)
  throw Error('Verified statutory cash event unavailable');
 const proof=await verifyStatutoryBankRemittance(db,{
  organizationId,sourceKind:event.source_kind,sourceId:event.source_id,sourceEventId:event.source_event_id
 });
 if(!proof||proof.amountPaise!==event.amount_paise||
   proof.verificationReference!==event.verification_reference||
   proof.effectiveAt!==event.effective_at)throw Error('Statutory payment verification mismatch');
 const order=await db.prepare(`SELECT account_code FROM neo_fin_statutory_remittances
  WHERE organization_id=? AND id=? AND status='approved'`).bind(organizationId,event.source_id).first();
 if(!order||!['2111','2112','2113','2114'].includes(order.account_code))throw Error('Approved statutory voucher unavailable');
 const accounts=await db.prepare(`SELECT id,account_code FROM neo_fin_accounts
  WHERE organization_id=? AND active=1 AND account_code IN (?,?)`)
  .bind(organizationId,order.account_code,'1000').all();
 const byCode=new Map((accounts.results||[]).map(x=>[x.account_code,x.id]));
 const payableId=byCode.get(order.account_code),bankId=byCode.get('1000');
 if(!payableId||!bankId||payableId===bankId)throw Error('Statutory payable/bank account unavailable');
 const journalId='JNL|'+eventId;
 const existing=async()=>{
  const j=await db.prepare(`SELECT id,status FROM neo_fin_journals WHERE organization_id=?
   AND source_kind='cash_event' AND source_id=?`).bind(organizationId,eventId).first();
  if(!j)return false;
  if(j.status!=='posted')throw Error('Unfinished statutory journal requires review');
  const rows=await db.prepare(`SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines
   WHERE organization_id=? AND journal_id=? ORDER BY line_no`).bind(organizationId,j.id).all();
  const x=rows.results||[];
  if(x.length!==2||x[0].account_id!==payableId||x[0].debit_paise!==event.amount_paise||x[0].credit_paise!==0||
    x[1].account_id!==bankId||x[1].debit_paise!==0||x[1].credit_paise!==event.amount_paise)
    throw Error('Conflicting statutory journal; manual reconciliation needed');
  return true;
 };
 if(await existing())return Object.freeze({journalId,created:false});
 try{
  const result=await db.batch([
   db.prepare('INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES(?,?,?,?)')
    .bind(organizationId,journalId,'cash_event',eventId),
   db.prepare(`INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
    VALUES(?,?,?,?,?,?)`).bind(organizationId,journalId,1,payableId,event.amount_paise,0),
   db.prepare(`INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise)
    VALUES(?,?,?,?,?,?)`).bind(organizationId,journalId,2,bankId,0,event.amount_paise),
   db.prepare(`UPDATE neo_fin_journals SET status='posted',posted_at=? WHERE organization_id=? AND id=? AND status='draft'`)
    .bind(event.effective_at,organizationId,journalId)
  ]);
  if(!Array.isArray(result)||result.length!==4||result.some(x=>x?.success!==true))
   throw Error('Statutory journal transaction not confirmed');
  return Object.freeze({journalId,created:true});
 }catch(error){
  if(await existing())return Object.freeze({journalId,created:false});
  throw error;
 }
}
