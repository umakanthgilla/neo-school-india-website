// Read-only reconciliation utilities. No posting, payout, or data sharing.
import {cashLedgerTotals} from './cash-projection.mjs';
function amount(value) {
  if(!Number.isSafeInteger(value)) throw new Error('Invalid amount');
  return value;
}
export function reconcileBusinessCash({organizationId,openingBalancePaise=0,events=[],closingBalancePaise}) {
  if(typeof organizationId!=='string'||!organizationId.trim()) throw new Error('Business required');
  amount(openingBalancePaise);
  if(!Array.isArray(events)) throw new Error('Events required');
  const sourceKeys=new Set();
  const rows=[];
  for(const event of events){
    if(event.organization_id!==organizationId) throw new Error('Cross-business event rejected');
    if(typeof event.source_kind!=='string'||typeof event.source_id!=='string'||typeof event.source_event_id!=='string') throw new Error('Source reference required');
    const key=JSON.stringify([event.source_kind,event.source_id,event.source_event_id]);
    if(sourceKeys.has(key)) throw new Error('Duplicate cash source event');
    sourceKeys.add(key);
    rows.push(event);
  }
  const totals=cashLedgerTotals(rows);
  const calculated=openingBalancePaise+totals.netPaise;
  if(!Number.isSafeInteger(calculated)) throw new Error('Balance overflow');
  const result={organizationId,openingBalancePaise,moneyInPaise:totals.moneyInPaise,moneyOutPaise:totals.moneyOutPaise,calculatedClosingBalancePaise:calculated,eventCount:rows.length};
  if(closingBalancePaise!==undefined) {
    amount(closingBalancePaise);
    result.expectedClosingBalancePaise=closingBalancePaise;
    result.balanced=calculated===closingBalancePaise;
  }
  return Object.freeze(result);
}
