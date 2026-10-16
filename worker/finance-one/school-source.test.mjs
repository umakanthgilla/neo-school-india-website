import test from 'node:test';
import assert from 'node:assert/strict';
import {readOnlySchoolSource} from './school-source.mjs';
test('school source capability exposes reads only and never prepares write or multi-statement SQL',async()=>{
 let prepared=0;const bound={first:async()=>({data:'test'}),all:async()=>({results:[]})};
 const source=readOnlySchoolSource({prepare(){prepared++;return {...bound,bind:()=>bound};}});
 for(const q of ['DELETE FROM neo_portal_records','UPDATE neo_portal_records SET data=?','WITH r AS (SELECT 1) DELETE FROM neo_portal_records','SELECT * FROM neo_portal_records; DELETE FROM neo_portal_records','SELECT * FROM neo_fin_documents','SELECT * FROM neo_portal_records -- hidden'])assert.throws(()=>source.prepare(q));
 assert.equal(prepared,0);assert.equal(source.batch,undefined);assert.equal(source.exec,undefined);
 const statement=source.prepare('SELECT data FROM neo_portal_records WHERE school_id=? AND id=?');
 assert.equal(statement.run,undefined);assert.equal(statement.bind('S_A','P1').run,undefined);
 assert.deepEqual(await statement.bind('S_A','P1').first(),{data:'test'});assert.equal(prepared,1);
 assert.equal(readOnlySchoolSource(null),null);
});
