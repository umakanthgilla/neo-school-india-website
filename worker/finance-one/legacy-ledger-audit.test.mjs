import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLegacyLedgerRows, readLegacySchoolRows} from './legacy-ledger-audit.mjs';
const rec=(kind,id,data)=>({kind,id,data});
const good=[
 rec('payments','P1',{amount_paise:12500,receipt_no:'RCPT-2026-1'}),
 rec('daily_accounts','FIN_FEE_P1',{source_kind:'fee_payment',source_id:'P1',direction:'IN',amount_paise:12500,reference:'RCPT-2026-1'}),
 rec('vouchers','V1',{source_kind:'manual_voucher',source_id:'V1',voucher_no:'PV-2026-1',status:'Paid',amount_paise:3000}),
 rec('daily_accounts','FIN_VCH_V1',{source_kind:'voucher',source_id:'V1',direction:'OUT',amount_paise:3000,reference:'PV-2026-1'})
];
test('correct fee and voucher source links pass',()=>assert.equal(auditLegacyLedgerRows(good).findings.length,0));
test('missing Fee posting detected',()=>assert.ok(auditLegacyLedgerRows([good[0]]).findings.some(x=>x.code==='MISSING_DAILY_LEDGER')));
test('duplicate fee posting detected',()=>assert.ok(auditLegacyLedgerRows([...good,rec('daily_accounts','ANOTHER',{...good[1].data})]).findings.some(x=>x.code==='DUPLICATE_DAILY_LEDGER')));
test('amount mismatch detected',()=>assert.ok(auditLegacyLedgerRows([good[0],rec('daily_accounts','X',{...good[1].data,amount_paise:55})]).findings.some(x=>x.code==='POSTING_MISMATCH')));
test('Released advance without voucher flagged',()=>assert.ok(auditLegacyLedgerRows([rec('salary_advances','ADV1',{status:'Released',amount_paise:12000})]).findings.some(x=>x.code==='MISSING_SOURCE_VOUCHER')));
test('Paid payroll alone is not bank verification',()=>{
  const findings=auditLegacyLedgerRows([rec('payroll','PAY1',{status:'Paid',net_paise:12500})]).findings;
  assert.ok(findings.some(x=>x.code==='BANK_SETTLEMENT_UNVERIFIED'));
});
test('read only school query always scoped and bounded',async()=>{
 let observed;
 const db={prepare(q){return {bind(...params){observed={q,params};return {all:async()=>({results:[]})};}}}};
 assert.deepEqual(await readLegacySchoolRows(db,'CENTER_A',{limit:25}),[]);
 assert.match(observed.q,/school_id=\?/);
 assert.deepEqual(observed.params,['CENTER_A',26]);
});
test('rejects oversized snapshot instead of silent truncation',async()=>{
 const db={prepare(){return{bind(){return{all:async()=>({results:[{},{},{}]})};}}}};
 await assert.rejects(readLegacySchoolRows(db,'CENTER_A',{limit:2}),/paginate/);
});

test('orphan ledger postings without source are detected',()=>{
 const orphan=rec('daily_accounts','ORPHAN',{direction:'OUT',amount_paise:100,source_kind:'voucher',source_id:'MISSING'});
 assert.ok(auditLegacyLedgerRows([orphan]).findings.some(x=>x.code==='ORPHAN_DAILY_LEDGER'));
});
