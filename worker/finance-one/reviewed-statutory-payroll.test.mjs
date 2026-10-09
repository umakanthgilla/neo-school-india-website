import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {statutoryAmounts,payrollStatutoryFingerprint,requireReviewedStatutoryPayroll} from './reviewed-statutory-payroll.mjs';
const salary={staff_id:'S1',month:'2026-09',gross_paise:100000,late_deduction_paise:0,
 attendance_deduction_paise:0,advance_recovery_paise:5000,deductions_paise:15000,net_paise:85000,
 employee_pf_paise:5000,employee_esi_paise:1000,professional_tax_paise:200,
 tds_paise:3800,employer_pf_paise:6000,employer_esi_paise:1000,statutory_review_id:'2026-TG-REVIEWED'};
test('statutory totals keep employer contributions outside employee salary deductions',()=>{
 const x=statutoryAmounts(salary);assert.equal(x.employeeTotalPaise,10000);assert.equal(x.employerTotalPaise,7000);
});
test('negative, unsafe and fractional statutory values rejected',()=>{
 for(const bad of [-1,1.5,Number.MAX_SAFE_INTEGER+1,'100']){
  assert.throws(()=>statutoryAmounts({...salary,tds_paise:bad}),/Invalid statutory/);
 }
 assert.throws(()=>statutoryAmounts({...salary,tds_paise:Number.MAX_SAFE_INTEGER}),/overflow/);
});
test('payroll fingerprint is stable, employee withholding or salary changes invalidate it',async()=>{
 const original=await payrollStatutoryFingerprint(salary);
 assert.equal(original.length,64);
 assert.equal(await payrollStatutoryFingerprint({...salary}),original);
 assert.notEqual(await payrollStatutoryFingerprint({...salary,employee_pf_paise:4999}),original);
 assert.notEqual(await payrollStatutoryFingerprint({...salary,gross_paise:99000}),original);
});
test('statutory payroll cannot post without independent review evidence',async()=>{
 const db={prepare(){return{bind(){return{first:async()=>null}}}}};
 await assert.rejects(requireReviewedStatutoryPayroll(db,'A','SCHOOL_A','S1_2026-09',salary),/approval or amounts mismatch/);
});
test('approval schema prevents changes or deletion of reviewed statutory amounts',()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE neo_fin_organizations(id TEXT PRIMARY KEY);INSERT INTO neo_fin_organizations VALUES('A')");
 sql.exec(readFileSync(new URL('../../migrations/finance_payroll_one_statutory_review.sql',import.meta.url),'utf8'));
 sql.prepare(`INSERT INTO neo_fin_payroll_statutory_reviews
 (organization_id,school_id,payroll_record_id,payroll_month,policy_reference,source_fingerprint,reviewed_by,reviewed_at,status)
 VALUES ('A','SCHOOL_A','S1_2026-09','2026-09','policy',?,'reviewer','2026-10-02','approved')`).run('a'.repeat(64));
 assert.throws(()=>sql.exec("UPDATE neo_fin_payroll_statutory_reviews SET employee_pf_paise=99"),/immutable/);
 assert.throws(()=>sql.exec("DELETE FROM neo_fin_payroll_statutory_reviews"),/immutable/);
 sql.close();
});
