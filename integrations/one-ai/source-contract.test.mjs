// Guard against source-level drift before connecting ONE AI to Neo's private Worker.
// This is not a substitute for staging/live database or authentication testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../worker/neo-lead-crm-api-worker-transport-phase1.js',import.meta.url),'utf8');
test('Neo source exposes the employee identity attributes needed for tenant mapping',()=>{
 assert.match(source,/url\.pathname\s*===\s*['"]\/api\/employee\/me['"]/);
 assert.match(source,/account_id\s*:\s*a\.account_id/);
 assert.match(source,/school_id\s*:\s*a\.school_id/);
 assert.match(source,/staff_id\s*:\s*a\.staff_id/);
});
test('Neo source retains the read-only admissions context tables and join keys',()=>{
 assert.match(source,/CREATE TABLE IF NOT EXISTS neo_growth_lead_meta\s*\(/);
 assert.match(source,/lead_id TEXT PRIMARY KEY/);
 assert.match(source,/branch_id TEXT/);
 assert.match(source,/CREATE TABLE IF NOT EXISTS neo_schools\s*\(/);
 assert.match(source,/active INTEGER NOT NULL DEFAULT 1/);
 assert.match(source,/CREATE TABLE IF NOT EXISTS neo_portal_records\s*\(/);
 assert.match(source,/PRIMARY KEY\(school_id,kind,id\)/);
});
