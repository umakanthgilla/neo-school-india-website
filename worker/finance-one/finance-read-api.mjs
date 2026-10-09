/**
 * Finance ONE read-only router for a future authenticated Worker integration.
 * No write actions and no client-supplied account identities are trusted.
 * The host MUST supply authenticatedAccountId from its verified server session.
 */
import {FinanceAccessError, resolveFinanceOrganization, listOwnDocuments} from './organization-access.mjs';
import {getFinanceSnapshot} from './finance-reports.mjs';
import {listPayoutSettlementStatus} from './settlement-status.mjs';
import {readStatutoryLiabilities} from './statutory-liabilities.mjs';
import {auditFinanceCashJournals} from './cash-journal-audit.mjs';
import {auditFinanceAccrualJournals} from './accrual-journal-audit.mjs';

const ROUTE = /^\/api\/finance-one\/v1\/organizations\/([A-Za-z0-9][A-Za-z0-9_-]{0,79})\/(summary|documents|daily-ledger|settlements|statutory-liabilities|cash-reconciliation|accrual-reconciliation)\/?$/;
function json(body,status=200) {
  return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
function limitParam(url){
  const raw=url.searchParams.get('limit');
  if(raw===null) return 50;
  if(!/^[1-9]\d*$/.test(raw))throw new FinanceAccessError('Invalid pagination limit',400);
  const limit=Number(raw);
  if(!Number.isSafeInteger(limit)||limit>100)throw new FinanceAccessError('Invalid pagination limit',400);
  return limit;
}
export async function handleFinanceReadApi({request,db,authenticatedAccountId}){
  const url=new URL(request.url);
  const match=url.pathname.match(ROUTE);
  if(!match) return null; // Existing Worker retains ownership of unrelated routes.
  if(request.method!=='GET') return json({error:'Read-only endpoint'},405);
  if(!db) return json({error:'Finance service unavailable'},503);
  if(typeof authenticatedAccountId!=='string'||!authenticatedAccountId.trim())return json({error:'Login required'},401);
  const [,organizationId,resource]=match;
  try {
    const context=await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
    if(resource==='summary')return json(await getFinanceSnapshot({db,accountId:authenticatedAccountId,organizationId}));
    if(resource==='statutory-liabilities')return json(await readStatutoryLiabilities({db,authenticatedAccountId,organizationId}));
    if(resource==='cash-reconciliation')return json(await auditFinanceCashJournals({db,authenticatedAccountId,organizationId}));
    if(resource==='accrual-reconciliation')return json(await auditFinanceAccrualJournals({db,authenticatedAccountId,organizationId}));
    const limit=limitParam(url);
    if(resource==='documents')return json({organizationId,documents:await listOwnDocuments(db,context,limit)});
    if(resource==='settlements')return json(await listPayoutSettlementStatus({db,authenticatedAccountId,organizationId,limit}));
    const result=await db.prepare(
      'SELECT event_id,source_kind,source_id,direction,amount_paise,effective_at,verification_reference FROM neo_fin_daily_ledger WHERE organization_id=? ORDER BY effective_at DESC,event_id DESC LIMIT ?'
    ).bind(organizationId,limit).all();
    return json({organizationId,entries:result.results||[]});
  } catch(error) {
    if(error instanceof FinanceAccessError)return json({error:error.message},error.status);
    return json({error:'Finance read failed'},500);
  }
}
