/** Read-only, organization-scoped cash ledger export at a fixed insertion boundary. */
import {FinanceAccessError} from './organization-access.mjs';
export async function readLedgerExportPage({db,organizationId,cursor}){
 let snapshot,after=0;
 if(cursor!==null&&cursor!==undefined){
  if(typeof cursor!=='string'||cursor.length>160)throw new FinanceAccessError('Invalid ledger export cursor',400);
  const parts=cursor.split(':');
  if(parts.length!==3||parts[0]!==organizationId||!parts.slice(1).every(x=>/^(0|[1-9]\d*)$/.test(x)))throw new FinanceAccessError('Invalid ledger export cursor',400);
  [snapshot,after]=parts.slice(1).map(Number);
  if(!Number.isSafeInteger(snapshot)||!Number.isSafeInteger(after)||after<1||after>snapshot)throw new FinanceAccessError('Invalid ledger export cursor',400);
 }
 const boundary=await db.prepare('SELECT COALESCE(MAX(rowid),0) AS boundary FROM neo_fin_cash_events WHERE organization_id=?').bind(organizationId).first();
 if(!Number.isSafeInteger(boundary?.boundary)||boundary.boundary<0)throw Error('Ledger boundary unavailable');
 if(snapshot===undefined)snapshot=boundary.boundary;
 if(snapshot>boundary.boundary)throw new FinanceAccessError('Ledger export changed; restart export',409);
 const total=await db.prepare('SELECT COUNT(*) AS n FROM neo_fin_cash_events WHERE organization_id=? AND rowid<=?').bind(organizationId,snapshot).first();
 const result=await db.prepare(`SELECT rowid AS export_position,event_id,source_kind,source_id,direction,amount_paise,effective_at,verification_reference
  FROM neo_fin_cash_events WHERE organization_id=? AND rowid>? AND rowid<=? ORDER BY rowid LIMIT 101`).bind(organizationId,after,snapshot).all();
 const rows=result.results||[],page=rows.slice(0,100);
 const nextCursor=rows.length>100?organizationId+':'+snapshot+':'+page.at(-1).export_position:null;
 return {organizationId,snapshot:String(snapshot),totalEntries:total.n,order:'posting insertion order',entries:page.map(({export_position,...entry})=>entry),nextCursor};
}
