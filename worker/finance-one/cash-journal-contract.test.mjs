import test from 'node:test';
import assert from 'node:assert/strict';
import {cashJournalContract} from './cash-journal-contract.mjs';
const event=(kind='fee_receipt',amount=10000,sourceId='SRC')=>({
 organization_id:'A',event_id:'E1',source_kind:kind,source_id:sourceId,
 direction:kind==='fee_receipt'?'money_in':'money_out',amount_paise:amount
});
const line=(code,debit,credit,type='asset',active=1)=>({
 account_code:code,account_type:type,active,debit_paise:debit,credit_paise:credit
});
test('fee receipt needs bank debit and fee receivable credit, not a random balanced contra',()=>{
 const source=event();
 assert.equal(cashJournalContract(source,[
  line('1000',10000,0),line('1100',0,10000)]),true);
 assert.equal(cashJournalContract(source,[
  line('1000',10000,0),line('5000',0,10000)]),false);
});
test('approved generic vendor payout requires Accounts Payable debit',()=>{
 const source=event('vendor_payment');
 assert.equal(cashJournalContract(source,[
  line('2000',10000,0,'liability'),line('1000',0,10000)]),true);
 assert.equal(cashJournalContract(source,[
  line('5000',10000,0,'expense'),line('1000',0,10000)]),false);
});
test('legacy payroll with advance recovery requires Salary Payable Dr, Bank Cr and advance Cr',()=>{
 const source=event('payroll_payment',65000,'SCHOOL_A|PAY1');
 const rows=[line('2100',85000,0,'liability'),line('1000',0,65000),
  line('1200',0,20000)];
 assert.equal(cashJournalContract(source,rows),true);
 assert.equal(cashJournalContract(source,rows.slice(0,2)),false);
 assert.equal(cashJournalContract(source,[
  line('2100',85000,0,'liability'),line('1000',0,65000),line('2000',0,20000)]),false);
});
test('legacy payroll without advance is a strict two-line journal',()=>{
 const source=event('payroll_payment',65000,'SCHOOL_A|PAY2');
 assert.equal(cashJournalContract(source,[
  line('2100',65000,0,'liability'),line('1000',0,65000)]),true);
});
test('statutory payout must debit precisely the approved tax liability',()=>{
 const source=event('statutory_remittance_paid',10000,'PF_SEP');
 const rows=[line('2111',10000,0,'liability'),line('1000',0,10000)];
 assert.equal(cashJournalContract(source,rows,{statutoryAccountCode:'2111'}),true);
 assert.equal(cashJournalContract(source,rows,{statutoryAccountCode:'2112'}),false);
 assert.equal(cashJournalContract(source,rows),false);
});
test('unapproved types, amount discrepancy, inactive Bank and extra posting lines fail closed',()=>{
 const source=event();
 assert.equal(cashJournalContract(event('unknown_source'),[
  line('1000',10000,0),line('1100',0,10000)]),false);
 assert.equal(cashJournalContract(source,[
  line('1000',10000,0,'asset',0),line('1100',0,10000)]),false);
 assert.equal(cashJournalContract(source,[
  line('1000',10000,0,'liability'),line('1100',0,10000)]),false);
 assert.equal(cashJournalContract(source,[
  line('1000',9000,0),line('1100',0,9000)]),false);
 assert.equal(cashJournalContract(source,[
  line('1000',10000,0),line('1100',0,10000),line('2000',0,1)]),false);
});
