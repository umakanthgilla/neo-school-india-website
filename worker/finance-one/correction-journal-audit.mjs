import {resolveFinanceOrganization} from './organization-access.mjs';
/** Read-only audit, including older deployments without migration 11. */
export async function auditCorrectionJournals({db,authenticatedAccountId,organizationId}){
 await resolveFinanceOrganization(db,authenticatedAccountId,organizationId,'finance','read');
 const schema=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('neo_fin_correction_decisions').first();
 const journals=(await db.prepare("SELECT id,source_id,status,posted_at FROM neo_fin_journals WHERE organization_id=? AND source_kind='approved_correction'").bind(organizationId).all()).results;
 const decisions=schema?(await db.prepare("SELECT request_id,journal_id,created_at FROM neo_fin_correction_decisions WHERE organization_id=? AND decision='approved'").bind(organizationId).all()).results:[];
 if(!Array.isArray(journals)||!Array.isArray(decisions))throw Error('Correction audit unavailable');
 const findings=[];const byRequest=new Map(journals.map(j=>[j.source_id,j]));
 for(const decision of decisions){
  const j=byRequest.get(decision.request_id);
  if(!j||j.id!=='REV|'+decision.request_id||j.status!=='posted'||j.posted_at!==decision.created_at){findings.push({code:'correction_journal_missing_or_invalid',requestId:decision.request_id});continue;}
  const lines=await db.prepare(`SELECT journal_id,line_no,account_id,debit_paise,credit_paise FROM neo_fin_journal_lines WHERE organization_id=? AND journal_id IN (?,?) ORDER BY line_no`).bind(organizationId,j.id,decision.journal_id).all();
  const original=lines.results.filter(l=>l.journal_id===decision.journal_id),reversal=lines.results.filter(l=>l.journal_id===j.id);
  if(original.length!==2||reversal.length!==2||original.some((l,i)=>l.line_no!==reversal[i].line_no||l.account_id!==reversal[i].account_id||l.debit_paise!==reversal[i].credit_paise||l.credit_paise!==reversal[i].debit_paise))findings.push({code:'correction_posting_mismatch',requestId:decision.request_id});
 }
 const approved=new Set(decisions.map(d=>d.request_id));
 for(const j of journals)if(!approved.has(j.source_id))findings.push({code:'orphan_correction_journal',journalId:j.id});
 const counts={};for(const f of findings)counts[f.code]=(counts[f.code]||0)+1;
 return {counts,ready:findings.length===0,issueCount:findings.length,findings:findings.slice(0,50),findingsTruncated:findings.length>50};
}
