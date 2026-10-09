/**
 * Read-only audit of EXISTING Neo School India source -> voucher -> Daily Ledger links.
 * No insert/update/delete; not an authorization endpoint. The caller MUST authorize
 * the school-to-independent-business ownership before retrieving any records.
 */
const kinds = new Set(['payments', 'vouchers', 'payroll', 'salary_advances', 'daily_accounts']);
const money = (value) => Number.isSafeInteger(value) && value > 0;
const str = (v) => typeof v === 'string' ? v : '';

export function auditLegacyLedgerRows(records) {
  if (!Array.isArray(records)) throw new TypeError('Records must be an array');
  const grouped = Object.fromEntries([...kinds].map(k => [k, []]));
  for (const row of records) {
    if (!row || !kinds.has(row.kind) || typeof row.id !== 'string' || !row.id || !row.data || typeof row.data !== 'object')
      throw new TypeError('Invalid legacy record');
    grouped[row.kind].push({...row.data, _recordId: row.id});
  }
  const findings=[];
  const add=(severity,code,sourceKind,sourceId,details='')=>findings.push({severity,code,sourceKind,sourceId,details});
  const ledger=grouped.daily_accounts;
  const bySource=new Map();
  for (const entry of ledger) {
    const key=JSON.stringify([entry.source_kind,entry.source_id]);
    const linked=bySource.get(key)||[];
    linked.push(entry);bySource.set(key,linked);
    if(!money(entry.amount_paise) || !['IN','OUT'].includes(entry.direction)) add('critical','INVALID_POSTING','daily_accounts',entry._recordId);
  }
  function checkPost(kind,id,expectedDirection,amount,sourceKind,sourceId,ref='') {
    const matches=bySource.get(JSON.stringify([sourceKind,sourceId]))||[];
    if(!matches.length){add('high','MISSING_DAILY_LEDGER',kind,id,sourceKind+':'+sourceId);return;}
    if(matches.length!==1){add('critical','DUPLICATE_DAILY_LEDGER',kind,id,String(matches.length));return;}
    const l=matches[0];
    if(l.direction!==expectedDirection || l.amount_paise!==amount) add('critical','POSTING_MISMATCH',kind,id);
    if(ref && str(l.reference)!==ref) add('high','REFERENCE_MISMATCH',kind,id);
  }
  for(const p of grouped.payments){
    if(!money(p.amount_paise)){add('critical','INVALID_SOURCE_AMOUNT','payments',p._recordId);continue;}
    checkPost('payments',p._recordId,'IN',p.amount_paise,'fee_payment',p._recordId,str(p.receipt_no));
  }
  const voucherBySource=new Map();
  for(const v of grouped.vouchers){
    const key=JSON.stringify([v.source_kind,v.source_id]);
    const set=voucherBySource.get(key)||[];set.push(v);voucherBySource.set(key,set);
    if(!money(v.amount_paise)){add('critical','INVALID_SOURCE_AMOUNT','vouchers',v._recordId);continue;}
    if(v.status==='Paid') checkPost('vouchers',v._recordId,'OUT',v.amount_paise,'voucher',v._recordId,str(v.voucher_no));
  }
  function matchVoucher(kind,source,sourceKind,expectedAmount){
    const matches=voucherBySource.get(JSON.stringify([sourceKind,source._recordId]))||[];
    if(matches.length===0){add('high','MISSING_SOURCE_VOUCHER',kind,source._recordId);return;}
    if(matches.length>1){add('critical','DUPLICATE_SOURCE_VOUCHER',kind,source._recordId);return;}
    if(matches[0].amount_paise!==expectedAmount) add('critical','VOUCHER_AMOUNT_MISMATCH',kind,source._recordId);
  }
  for (const adv of grouped.salary_advances) {
    if(['Released','Partially Recovered','Recovered'].includes(adv.status)) {
      matchVoucher('salary_advances',adv,'salary_advance',adv.amount_paise);
    }
  }
  for (const pay of grouped.payroll) {
    if(pay.status==='Paid') {
      matchVoucher('payroll',pay,'payroll',pay.net_paise);
      add('review','BANK_SETTLEMENT_UNVERIFIED','payroll',pay._recordId,'Legacy Paid status alone is not bank settlement proof');
    }
  }
  return Object.freeze({sources:grouped.payments.length+grouped.vouchers.length+grouped.payroll.length+grouped.salary_advances.length,postings:ledger.length,findings});
}

/** Caller supplies school_id resolved and authorized server-side; never client-authorized. */
export async function readLegacySchoolRows(db,authorizedSchoolId,{limit=5000}={}) {
  if(!db || typeof authorizedSchoolId!=='string' || !authorizedSchoolId.trim()) throw new Error('Server-authorized school required');
  if(!Number.isInteger(limit)||limit<1||limit>10000) throw new Error('Invalid limit');
  const rows=await db.prepare(`SELECT kind,id,data FROM neo_portal_records
    WHERE school_id=? AND kind IN ('payments','vouchers','payroll','salary_advances','daily_accounts')
    ORDER BY kind,id LIMIT ?`).bind(authorizedSchoolId,limit+1).all();
  if(rows.results.length>limit) throw new Error('Snapshot too large: paginate before auditing');
  return rows.results.map(r=>({kind:r.kind,id:r.id,data:JSON.parse(r.data)}));
}
