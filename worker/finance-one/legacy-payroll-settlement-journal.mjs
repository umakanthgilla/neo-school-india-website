/**
 * Staging-only final-payroll settlement: Dr earned salary payable;
 * Cr verified net bank payout; Cr employee advance recovery (if any).
 * The advance set-off is NOT booked at payroll approval.
 * Never writes to the school's existing Daily Ledger.
 */
import {verifyLegacyPayout} from './legacy-payout-verifier.mjs';
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const ids=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,100}\|[A-Za-z0-9_-]{1,100}$/.test(s);
export async function postLegacyPayrollSettlementJournal(db,organizationId,eventId) {
 if(!db?.prepare||!db?.batch||!organizationId||!eventId)throw Error('Verified payroll event required');
 const event=await db.prepare(`SELECT organization_id,event_id,source_kind,source_id,source_event_id,
   direction,amount_paise,effective_at,verification_reference FROM neo_fin_cash_events
   WHERE organization_id=? AND event_id=?`).bind(organizationId,eventId).first();
 if(!event||event.organization_id!==organizationId||event.source_kind!=='payroll_payment'||
    event.direction!=='money_out'||!ids(event.source_id)||
    !safe(event.amount_paise)||event.amount_paise<=0)throw Error('Legacy payroll cash event required');
 const verified=await verifyLegacyPayout(db,{organizationId,sourceKind:'payroll_payment',
  sourceId:event.source_id,sourceEventId:event.source_event_id});
 if(!verified||verified.amountPaise!==event.amount_paise||
    verified.verificationReference!==event.verification_reference||
    verified.effectiveAt!==event.effective_at)throw Error('Original verified payroll settlement no longer matches');
 const [schoolId,payrollRecordId]=event.source_id.split('|');
 const stored=await db.prepare("SELECT data FROM neo_portal_records WHERE school_id=? AND kind='payroll' AND id=?")
  .bind(schoolId,payrollRecordId).first();
 let payroll;try{payroll=JSON.parse(stored.data)}catch{throw Error('Invalid verified payroll breakdown')}
 const advance=payroll.advance_recovery_paise,net=payroll.net_paise;
 const earned=net+advance;
 if(!safe(advance)||!safe(net)||!Number.isSafeInteger(earned)||earned<=0||net!==event.amount_paise)
  throw Error('Inconsistent salary payable and advance recovery');
 const ac=await db.prepare('SELECT id,account_code,active FROM neo_fin_accounts WHERE organization_id=? AND account_code IN (?,?,?)')
  .bind(organizationId,'2100','1000','1200').all();
 const accountIds=new Map((ac.results||[]).filter(x=>x.active===1).map(x=>[x.account_code,x.id]));
 const plan=[
  {code:'2100',debit:earned,credit:0},
  {code:'1000',debit:0,credit:net}
 ];
 if(advance>0)plan.push({code:'1200',debit:0,credit:advance});
 if(plan.some(p=>!accountIds.has(p.code)) || new Set(plan.map(p=>accountIds.get(p.code))).size!==plan.length)
  throw Error('Payroll payout accounting accounts unavailable');
 const journalId='JNL|'+eventId;
 const previous=async()=>{
  const j=await db.prepare("SELECT id,status FROM neo_fin_journals WHERE organization_id=? AND source_kind='cash_event' AND source_id=?")
   .bind(organizationId,eventId).first();
  if(!j)return false;
  if(j.status!=='posted')throw Error('Unfinished payroll cash journal; reconcile');
  const rows=await db.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE organization_id=? AND journal_id=? ORDER BY line_no')
   .bind(organizationId,j.id).all();
  if(rows.results?.length!==plan.length||rows.results.some((x,i)=>x.account_id!==accountIds.get(plan[i].code)||
    x.debit_paise!==plan[i].debit||x.credit_paise!==plan[i].credit))
   throw Error('Conflicting payroll advance recovery journal; reconcile');
  return true;
 };
 if(await previous())return Object.freeze({journalId,created:false});
 const inserts=[
  db.prepare("INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,?,?)")
   .bind(organizationId,journalId,'cash_event',eventId),
  ...plan.map((p,i)=>db.prepare(`INSERT INTO neo_fin_journal_lines
   (organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)`)
   .bind(organizationId,journalId,i+1,accountIds.get(p.code),p.debit,p.credit)),
  db.prepare("UPDATE neo_fin_journals SET status='posted',posted_at=? WHERE organization_id=? AND id=? AND status='draft'")
   .bind(event.effective_at,organizationId,journalId)
 ];
 try{
  const results=await db.batch(inserts);
  if(!Array.isArray(results)||results.length!==inserts.length||results.some(x=>x?.success!==true))
   throw Error('Payroll settlement journal transaction not confirmed');
  return Object.freeze({journalId,created:true});
 }catch(err){
  if(await previous())return Object.freeze({journalId,created:false});
  throw err;
 }
}
