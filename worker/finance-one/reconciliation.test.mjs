import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileBusinessCash} from './reconciliation.mjs';
const rows=[
 {organization_id:'CENTER_A',source_kind:'fee_receipt',source_id:'R-1',source_event_id:'P-1',direction:'money_in',amount_paise:20000},
 {organization_id:'CENTER_A',source_kind:'expense_voucher',source_id:'V-1',source_event_id:'P-2',direction:'money_out',amount_paise:7000}
];
test('independent business cash totals reconcile',()=>{
 const x=reconcileBusinessCash({organizationId:'CENTER_A',openingBalancePaise:5000,events:rows,closingBalancePaise:18000});
 assert.equal(x.balanced,true);
 assert.equal(x.calculatedClosingBalancePaise,18000);
});
test('cross-business records rejected',()=>{
 assert.throws(()=>reconcileBusinessCash({organizationId:'HO',events:rows}),/Cross-business/);
});
test('duplicate source transaction rejected',()=>{
 assert.throws(()=>reconcileBusinessCash({organizationId:'CENTER_A',events:[rows[0],rows[0]]}),/Duplicate/);
});
test('incorrect closing balance flagged',()=>{
 const x=reconcileBusinessCash({organizationId:'CENTER_A',events:rows,closingBalancePaise:0});
 assert.equal(x.balanced,false);
});
test('negative opening balances are supported for business overdrafts',()=>{
 const result=reconcileBusinessCash({organizationId:'CENTER_A',openingBalancePaise:-5000,events:rows});
 assert.equal(result.calculatedClosingBalancePaise,8000);
});
test('unsafe opening balances are rejected',()=>{
 assert.throws(()=>reconcileBusinessCash({organizationId:'CENTER_A',openingBalancePaise:Number.MAX_SAFE_INTEGER+1}),/Invalid amount/);
});
