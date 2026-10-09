import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FinanceAccessError, resolveFinanceOrganization, listOwnDocuments,
  assertFinanceCapability
} from './organization-access.mjs';

const memberships = [
  {organization_id:'HO',account_id:'ho_owner',role:'owner',active:1},
  {organization_id:'CENTER_A',account_id:'alice',role:'owner',active:1},
  {organization_id:'CENTER_B',account_id:'bob',role:'owner',active:1},
  {organization_id:'CENTER_A',account_id:'auditor',role:'auditor',active:1},
  {organization_id:'CENTER_A',account_id:'teacher',role:'employee',active:1},
  {organization_id:'CENTER_A',account_id:'inactive',role:'owner',active:0},
];
function mockDb() {
  const observed = [];
  return {
    observed,
    prepare(sql) {
      return {bind(...values) {
        observed.push({sql,values});
        return {async all() {
          if(sql.includes('neo_fin_memberships')) {
            const [organizationId,accountId] = values;
            return {results:memberships.filter(m => m.organization_id===organizationId && m.account_id===accountId && m.active===1)};
          }
          if(sql.includes('neo_fin_documents')) {
            const [organizationId] = values;
            return {results:[{id:'invoice_1',organization_id:organizationId}]};
          }
          throw new Error('Unexpected query');
        }};
      }};
    }
  };
}
test('owner can access only their own business',async()=>{
  const db=mockDb();
  const ctx=await resolveFinanceOrganization(db,'alice','CENTER_A');
  assert.equal(ctx.organizationId,'CENTER_A');
  const rows=await listOwnDocuments(db,ctx);
  assert.equal(rows.length,1);
  assert.equal(db.observed.at(-1).values[0],'CENTER_A');
  await assert.rejects(resolveFinanceOrganization(db,'alice','CENTER_B'),FinanceAccessError);
  await assert.rejects(resolveFinanceOrganization(db,'ho_owner','CENTER_A'),FinanceAccessError);
});
test('auditor read allowed but write blocked',async()=>{
  const db=mockDb();
  assert.equal((await resolveFinanceOrganization(db,'auditor','CENTER_A')).role,'auditor');
  await assert.rejects(resolveFinanceOrganization(db,'auditor','CENTER_A','finance','write'),FinanceAccessError);
});
test('employee cannot view private business finance',async()=>{
  await assert.rejects(resolveFinanceOrganization(mockDb(),'teacher','CENTER_A'),FinanceAccessError);
});
test('inactive membership denied',async()=>{
  await assert.rejects(resolveFinanceOrganization(mockDb(),'inactive','CENTER_A'),FinanceAccessError);
});
test('invalid IDs and missing authentication rejected',async()=>{
  await assert.rejects(resolveFinanceOrganization(mockDb(),'alice','CENTER_A; DROP TABLE x'),FinanceAccessError);
  await assert.rejects(resolveFinanceOrganization(mockDb(),'','CENTER_A'),FinanceAccessError);
});
test('roles segregate payroll and finance writes',()=>{
  assert.throws(()=>assertFinanceCapability({active:1,role:'payroll_admin'},'finance','write'),FinanceAccessError);
  assert.equal(assertFinanceCapability({active:1,role:'payroll_admin'},'payroll','write'),true);
});

test('rejects forged organization contexts and mutable clones',async()=>{
  const db=mockDb();
  await assert.rejects(listOwnDocuments(db,{organizationId:'CENTER_B',role:'owner'}),FinanceAccessError);
  const valid=await resolveFinanceOrganization(db,'alice','CENTER_A');
  await assert.rejects(listOwnDocuments(db,{...valid,organizationId:'CENTER_B'}),FinanceAccessError);
  assert.equal((await listOwnDocuments(db,valid)).length,1);
});
test('pagination is bounded within organization',async()=>{
  const db=mockDb();
  const ctx=await resolveFinanceOrganization(db,'bob','CENTER_B');
  await listOwnDocuments(db,ctx,100000);
  assert.deepEqual(db.observed.at(-1).values,['CENTER_B',100]);
  await listOwnDocuments(db,ctx,100);
  assert.deepEqual(db.observed.at(-1).values,['CENTER_B',100]);
});
