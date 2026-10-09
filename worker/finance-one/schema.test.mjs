import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const foundation=readFileSync(new URL('../../migrations/finance_payroll_one_foundation.sql',import.meta.url),'utf8');
const projection=readFileSync(new URL('../../migrations/finance_payroll_one_cash_projection.sql',import.meta.url),'utf8');
function setup(){
  const db=new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(foundation);
  db.exec(projection);
  db.prepare("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES (?,?,?)").run('HO','Head Office','head_office');
  db.prepare("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES (?,?,?)").run('A','Center A','independent_center');
  db.prepare("INSERT INTO neo_fin_organizations(id,legal_name,organization_type) VALUES (?,?,?)").run('B','Center B','independent_center');
  return db;
}
const insertCash = "INSERT INTO neo_fin_cash_events(organization_id,event_id,source_kind,source_id,source_event_id,direction,amount_paise,effective_at,verification_reference) VALUES (?,?,?,?,?,?,?,?,?)";
test('migrations apply and projection isolates independent businesses',()=>{
  const db=setup();
  db.prepare(insertCash).run('A','E1','fee_receipt','R1','P1','money_in',1200,'2026-10-09','BANK1');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM neo_fin_daily_ledger WHERE organization_id='A'").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM neo_fin_daily_ledger WHERE organization_id='B'").get().n,0);
  db.close();
});
test('duplicate original transaction rejected by unique index',()=>{
  const db=setup();
  db.prepare(insertCash).run('A','E1','fee_receipt','R1','P1','money_in',1200,'2026-10-09','BANK1');
  assert.throws(()=>db.prepare(insertCash).run('A','E2','fee_receipt','R1','P1','money_in',1300,'2026-10-09','BANK2'),/UNIQUE/);
  db.close();
});
test('cash projection cannot be manually edited or deleted',()=>{
  const db=setup();
  db.prepare(insertCash).run('A','E1','fee_receipt','R1','P1','money_in',1200,'2026-10-09','BANK1');
  assert.throws(()=>db.exec("UPDATE neo_fin_cash_events SET amount_paise=1 WHERE event_id='E1'"),/immutable/);
  assert.throws(()=>db.exec("DELETE FROM neo_fin_cash_events WHERE event_id='E1'"),/immutable/);
  db.close();
});
test('orphan organizations and duplicate settlement references blocked',()=>{
  const db=setup();
  assert.throws(()=>db.prepare(insertCash).run('NONE','E1','fee_receipt','R1','P1','money_in',100,'2026-10-09','BANK'),/FOREIGN KEY/);
  db.exec("INSERT INTO neo_fin_documents(organization_id,id,document_type,status,gross_paise,source_kind,source_id) VALUES ('A','PAY1','payment','approved',3000,'payroll_payment','RUN1')");
  const insertSettlement="INSERT INTO neo_fin_payment_settlements(organization_id,id,document_id,amount_paise,status,bank_reference,verified_at) VALUES (?,?,?,?,?,?,?)";
  db.prepare(insertSettlement).run('A','S1','PAY1',1000,'verified','REF1','2026-10-09T11:00:00Z');
  assert.throws(()=>db.prepare(insertSettlement).run('A','S2','PAY1',1000,'verified','REF1','2026-10-09T12:00:00Z'),/UNIQUE/);
  db.close();
});
