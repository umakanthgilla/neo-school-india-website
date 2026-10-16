// Staging-only cash event adapter. No external API route and no live Worker integration.
// Verified source workflow is required; no manual ledger editing or direct cash entries.
const sources = Object.freeze({
  fee_receipt:'money_in',
  customer_receipt:'money_in',
  refund_paid:'money_out',
  vendor_payment:'money_out',
  payroll_payment:'money_out',
  salary_advance_release:'money_out',
  expense_voucher:'money_out',
  statutory_remittance_paid:'money_out'
});
export function cashEventFromVerifiedSource(input) {
  if (!input || !Object.hasOwn(sources,input.sourceKind)) throw new Error('Unsupported cash source');
  for(const key of ['organizationId','sourceId','sourceEventId','verificationReference','effectiveAt']){
    if(typeof input[key]!=='string'||!input[key].trim()) throw new Error('Missing '+key);
  }
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(input.organizationId)) throw new Error('Invalid organization ID');
  if(!Number.isSafeInteger(input.amountPaise)||input.amountPaise<=0) throw new Error('Invalid amount');
  if(input.verified!==true) throw new Error('Payment not verified');
  if(!Number.isFinite(Date.parse(input.effectiveAt))) throw new Error('Invalid payment date');
  return Object.freeze({
    organizationId:input.organizationId,
    sourceKind:input.sourceKind,
    sourceId:input.sourceId,
    sourceEventId:input.sourceEventId,
    direction:sources[input.sourceKind],
    amountPaise:input.amountPaise,
    effectiveAt:input.effectiveAt,
    verificationReference:input.verificationReference
  });
}
export function cashLedgerTotals(rows) {
  let moneyIn=0,moneyOut=0;
  for(const row of rows){
    if(!Number.isSafeInteger(row.amount_paise)||row.amount_paise<=0) throw new Error('Invalid ledger amount');
    if(row.direction==='money_in') moneyIn+=row.amount_paise;
    else if(row.direction==='money_out') moneyOut+=row.amount_paise;
    else throw new Error('Invalid direction');
    if(!Number.isSafeInteger(moneyIn)||!Number.isSafeInteger(moneyOut)) throw new Error('Amount overflow');
  }
  return Object.freeze({moneyInPaise:moneyIn,moneyOutPaise:moneyOut,netPaise:moneyIn-moneyOut});
}
// Posting is intentionally not exported: authorization, verification and atomic DB writes
// must be implemented together after source voucher/receipt reconciliation audit.
