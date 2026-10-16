/** Read-only, organization-scoped cash ledger export at a fixed insertion boundary. */
import {FinanceAccessError} from './organization-access.mjs';
export async function readLedgerExportPage({db,organizationId,cursor}){
 let boundary,after=0;
 if(cursor!==null&&cursor!==undefined){
  if(typeof cursor!=='string'||cursor.length>2200)throw new FinanceAccessError('Invalid ledger export cursor',400);
  let parts;try{parts=JSON.parse(cursor);}catch{throw new FinanceAccessError('Invalid ledger export cursor',400);}
  if(!Array.isArray(parts)||parts.length!==3||parts[0]!==organizationId||!parts.slice(1).every(x=>typeof x==='string'&&x.length>0&&x.length<=1000))throw new FinanceAccessError('Invalid ledger export cursor',400);
  boundary=await db.prepare('SELECT event_id,rowid AS boundary FROM neo_fin_cash_events WHERE organization_id=? AND event_id=?').bind(organizationId,parts[1]).first();
  const previous=await db.prepare('SELECT rowid AS position FROM neo_fin_cash_events WHERE organization_id=? AND event_id=?').bind(organizationId,parts[2]).first();
  if(!boundary||!previous||previous.position>boundary.boundary)throw new FinanceAccessError('Ledger export changed; restart export',409);
  after=previous.position;
 }else{
  boundary=await db.prepare('SELECT event_id,rowid AS boundary FROM neo_fin_cash_events WHERE organization_id=? ORDER BY rowid DESC LIMIT 1').bind(organizationId).first()||{event_id:'',boundary:0};
 }
 if(!Number.isSafeInteger(boundary.boundary)||boundary.boundary<0||!Number.isSafeInteger(after)||after<0)throw Error('Ledger boundary unavailable');
 const snapshot=boundary.boundary;
 const total=await db.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events WHERE organization_id=? AND rowid<=?').bind(organizationId,snapshot).first();
 const result=await db.prepare(`SELECT event_id,source_kind,source_id,direction,amount_paise,effective_at,verification_reference
  FROM neo_fin_cash_events WHERE organization_id=? AND rowid>? AND rowid<=? ORDER BY rowid LIMIT 101`).bind(organizationId,after,snapshot).all();
 const rows=result.results||[],page=rows.slice(0,100);
 // Cursors expose only the business's own event IDs, never global row positions.
 const nextCursor=rows.length>100?JSON.stringify([organizationId,boundary.event_id,page.at(-1).event_id]):null;
 return {organizationId,snapshot:boundary.event_id,totalEntries:total.n,order:'posting insertion order',entries:page,nextCursor};
}
