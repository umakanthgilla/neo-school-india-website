import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readLedgerExportPage} from './ledger-export.mjs';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE neo_fin_cash_events(organization_id TEXT,event_id TEXT,source_kind TEXT,source_id TEXT,direction TEXT,amount_paise INTEGER,effective_at TEXT,verification_reference TEXT);`);
 const db={prepare(query){return {bind(...args){return {first:async()=>sql.prepare(query).get(...args),all:async()=>({results:sql.prepare(query).all(...args)})};}};}};
 const insert=(org,id)=>sql.prepare('INSERT INTO neo_fin_cash_events VALUES(?,?,?,?,?,?,?,?)').run(org,id,'receipt',id,'money_in',100,'2026-10-16','=PRIVATE-REFERENCE');
 return {sql,db,insert};
}
test('ledger export includes every snapshot row once, excludes foreign businesses and later backdated insertions',async()=>{
 const f=fixture();try{
 for(let i=0;i<205;i++){f.insert('A','A'+i);f.insert('B','B'+i);}
 const first=await readLedgerExportPage({db:f.db,organizationId:'A'});
 assert.equal(first.entries.length,100);assert.equal(first.totalEntries,205);assert.ok(first.nextCursor);assert.deepEqual(JSON.parse(first.nextCursor),['A','A204','A99']);assert.equal(first.snapshot,'A204');assert.equal(first.entries[0].export_position,undefined);
 f.insert('A','LATER');
 const second=await readLedgerExportPage({db:f.db,organizationId:'A',cursor:first.nextCursor});
 const third=await readLedgerExportPage({db:f.db,organizationId:'A',cursor:second.nextCursor});
 const ids=[...first.entries,...second.entries,...third.entries].map(r=>r.event_id);
 assert.equal(ids.length,205);assert.equal(new Set(ids).size,205);assert.ok(ids.every(id=>id.startsWith('A')));assert.equal(third.nextCursor,null);assert.equal(third.snapshot,first.snapshot);assert.equal(third.totalEntries,205);
 }finally{f.sql.close();}
});
test('ledger export rejects malformed, foreign and impossible cursors and supports empty books',async()=>{
 const f=fixture();try{
 assert.deepEqual((await readLedgerExportPage({db:f.db,organizationId:'A'})).entries,[]);
 f.insert('A','ONE');
 for(const cursor of ['invalid',JSON.stringify(['B','ONE','ONE']),JSON.stringify(['A','MISSING','ONE']),JSON.stringify(['A','ONE','MISSING']),JSON.stringify(['A',1,1]),JSON.stringify(['A','ONE','ONE','extra'])])await assert.rejects(readLedgerExportPage({db:f.db,organizationId:'A',cursor}));
 }finally{f.sql.close();}
});
