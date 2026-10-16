import test from 'node:test';import assert from 'node:assert/strict';
import {issueFinanceOneToken,readFinanceOneSession} from './finance-session.mjs';
const secret='very-long-demo-secret-key-not-for-production-123456';
const req=(token)=>new Request('https://example.com',{headers:{Authorization:'Bearer '+token}});
test('dedicated valid Finance ONE token resolves account',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 const session=await readFinanceOneSession(req(token),{FINANCE_ONE_SESSION_SECRET:secret});
 assert.equal(session.accountId,'fin:alice');
 assert.equal(session.credentialVersion,1);
});
test('school token and unsigned client claim never authorize finance',async()=>{
 assert.equal(await readFinanceOneSession(req('legacy.school.token'),{FINANCE_ONE_SESSION_SECRET:secret}),null);
 assert.equal(await readFinanceOneSession(req('fin:alice'),{FINANCE_ONE_SESSION_SECRET:secret}),null);
});
test('tampered Finance ONE token rejected',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 const [payload,sig]=token.split('.');
 assert.equal(await readFinanceOneSession(req(payload+'.'+sig.slice(0,-1)+'X'),{FINANCE_ONE_SESSION_SECRET:secret}),null);
});
test('wrong finance signing secret rejected',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 assert.equal(await readFinanceOneSession(req(token),{FINANCE_ONE_SESSION_SECRET:secret+'other'}),null);
});
test('missing finance session secret fails closed',async()=>{
 const token=await issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret});
 assert.equal(await readFinanceOneSession(req(token),{}),null);
});
test('too-long or invalid expiration cannot be issued',async()=>{
 await assert.rejects(issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret,ttlMs:24*60*60*1000}),/lifetime/);
 await assert.rejects(issueFinanceOneToken({accountId:'fin:alice',credentialVersion:1,secret:'short'}),/key unavailable/);
});

test('token issuance requires a revocable credential version',async()=>{
 await assert.rejects(issueFinanceOneToken({accountId:'fin:alice',secret}),/Credential version/);
});
