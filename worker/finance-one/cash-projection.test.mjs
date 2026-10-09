import test from 'node:test';
import assert from 'node:assert/strict';
import {cashEventFromVerifiedSource,cashLedgerTotals} from './cash-projection.mjs';
const base={organizationId:'CENTER_A',sourceKind:'fee_receipt',sourceId:'RCPT-1',sourceEventId:'bank-1',verificationReference:'TXN-1',effectiveAt:'2026-10-09T10:00:00.000Z',amountPaise:10000,verified:true};
test('receipt posts Money In; payroll and vendors Money Out',()=>{
  assert.equal(cashEventFromVerifiedSource(base).direction,'money_in');
  assert.equal(cashEventFromVerifiedSource({...base,sourceKind:'payroll_payment'}).direction,'money_out');
  assert.equal(cashEventFromVerifiedSource({...base,sourceKind:'vendor_payment'}).direction,'money_out');
});
test('unverified payments and manual entries rejected',()=>{
  assert.throws(()=>cashEventFromVerifiedSource({...base,verified:false}),/not verified/);
  assert.throws(()=>cashEventFromVerifiedSource({...base,sourceKind:'manual_ledger'}),/Unsupported/);
  assert.throws(()=>cashEventFromVerifiedSource({...base,amountPaise:0}),/Invalid amount/);
});
test('source event contains only originating business',()=>{
  const event=cashEventFromVerifiedSource(base);
  assert.equal(event.organizationId,'CENTER_A');
  assert.equal(Object.isFrozen(event),true);
});
test('daily totals are sum of signed verified source movements',()=>{
  assert.deepEqual(cashLedgerTotals([{direction:'money_in',amount_paise:10000},{direction:'money_out',amount_paise:3000}]),{moneyInPaise:10000,moneyOutPaise:3000,netPaise:7000});
});
test('invalid ledger rows rejected',()=>{
  assert.throws(()=>cashLedgerTotals([{direction:'other',amount_paise:100}]),/Invalid direction/);
});
