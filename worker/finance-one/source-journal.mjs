/**
 * Neo Finance ONE: staging-only automatic posting of verified CASH EVENTS to
 * a balanced double-entry journal. This does NOT write to the daily cash ledger.
 * No public routes; organization and account mappings must be trusted server-side.
 * Posting is idempotent per (organization_id, cash_event_id).
 */
const SOURCE_ACCOUNTS = Object.freeze({
  fee_receipt: ['1000','1100','money_in'],        // Bank Dr, Fee A/R Cr (invoice recognizes revenue)
  customer_receipt: ['1000','1100','money_in'],
  vendor_payment: ['2000','1000','money_out'],    // A/P Dr, Bank Cr
  payroll_payment: ['2100','1000','money_out'],   // Salary payable Dr, Bank Cr
  salary_advance_release: ['1200','1000','money_out'],
  expense_voucher: ['5000','1000','money_out'],   // Expense Dr, Bank Cr
  refund_paid: ['2200','1000','money_out']       // Customer refundable balance Dr
});
const safeId = value => typeof value==='string' && value.length>0 && value.length<512;
function safeAmount(value) {
  if(!Number.isSafeInteger(value) || value<=0) throw new Error('Invalid cash event amount');
  return value;
}
export function journalPlanForEvent(event) {
  if(!event || !safeId(event.organization_id) || !safeId(event.event_id)) throw new Error('Invalid cash event identity');
  const rule=Object.prototype.hasOwnProperty.call(SOURCE_ACCOUNTS,event.source_kind) ? SOURCE_ACCOUNTS[event.source_kind] : null;
  if(!rule) throw new Error('No approved account mapping for source');
  const [debitCode,creditCode,direction]=rule;
  if(event.direction!==direction) throw new Error('Cash event direction conflict');
  const amountPaise=safeAmount(event.amount_paise);
  return Object.freeze({organizationId:event.organization_id,eventId:event.event_id,sourceKind:'cash_event',sourceId:event.event_id,
    debitCode,creditCode,amountPaise});
}
export async function postJournalForCashEvent(db,organizationId,eventId,{postedAt}={}) {
  if(!db || !safeId(organizationId) || !safeId(eventId)) throw new Error('Trusted organization and event required');
  const event=await db.prepare('SELECT organization_id,event_id,source_kind,direction,amount_paise FROM neo_fin_cash_events WHERE organization_id=? AND event_id=?').bind(organizationId,eventId).first();
  if(!event) throw new Error('Verified cash event not found');
  const plan=journalPlanForEvent(event);
  if(plan.organizationId!==organizationId) throw new Error('Cross-business event rejected');
  const accounts=await db.prepare('SELECT id,account_code,active FROM neo_fin_accounts WHERE organization_id=? AND account_code IN (?,?)').bind(organizationId,plan.debitCode,plan.creditCode).all();
  const accts=new Map((accounts.results||[]).filter(x=>x.active===1).map(x=>[x.account_code,x.id]));
  const dr=accts.get(plan.debitCode),cr=accts.get(plan.creditCode);
  if(!dr||!cr||dr===cr) throw new Error('Required independent-business accounts unavailable');
  const journalId='JNL|'+eventId;
  const prior=async()=> {
    const header=await db.prepare('SELECT id,status FROM neo_fin_journals WHERE organization_id=? AND source_kind=? AND source_id=?').bind(organizationId,'cash_event',eventId).first();
    if(!header) return false;
    if(header.status!=='posted') throw new Error('Existing journal not posted; review required');
    const lines=await db.prepare('SELECT account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE organization_id=? AND journal_id=? ORDER BY line_no').bind(organizationId,header.id).all();
    const vals=lines.results||[];
    if(vals.length!==2 || vals[0].account_id!==dr || vals[0].debit_paise!==plan.amountPaise || vals[0].credit_paise!==0 ||
      vals[1].account_id!==cr || vals[1].credit_paise!==plan.amountPaise || vals[1].debit_paise!==0)
      throw new Error('Conflicting posted journal; reconciliation required');
    return true;
  };
  if(await prior()) return Object.freeze({journalId,created:false});
  const date=postedAt||new Date().toISOString();
  if(!Number.isFinite(Date.parse(date))) throw new Error('Invalid posting date');
  try {
    // Cloudflare D1 batch is transactional: all journal entries post or none.
    const result=await db.batch([
      db.prepare('INSERT INTO neo_fin_journals(organization_id,id,source_kind,source_id) VALUES (?,?,?,?)').bind(organizationId,journalId,'cash_event',eventId),
      db.prepare('INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)').bind(organizationId,journalId,1,dr,plan.amountPaise,0),
      db.prepare('INSERT INTO neo_fin_journal_lines(organization_id,journal_id,line_no,account_id,debit_paise,credit_paise) VALUES (?,?,?,?,?,?)').bind(organizationId,journalId,2,cr,0,plan.amountPaise),
      db.prepare("UPDATE neo_fin_journals SET status='posted',posted_at=? WHERE organization_id=? AND id=? AND status='draft'").bind(date,organizationId,journalId)
    ]);
    if(!Array.isArray(result) || result.length!==4 || result.some(r=>r?.success!==true)) throw new Error('Journal database batch not confirmed');
    return Object.freeze({journalId,created:true});
  } catch (err) {
    if(await prior()) return Object.freeze({journalId,created:false});
    throw err;
  }
}
