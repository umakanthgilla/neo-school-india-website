/**
 * Validate that a cash event's posted journal actually follows the approved
 * double-entry account contract, not merely that its Bank side is balanced.
 * Staging only: no evidence ingestion, no posting and no bank assertion.
 */
import {journalPlanForEvent} from './source-journal.mjs';

function exact(line,code,debit,credit){
 return Boolean(line)&&line.account_code===code&&line.debit_paise===debit&&
  line.credit_paise===credit&&line.active===1;
}
export function cashJournalContract(event,lines,{statutoryAccountCode=null}={}){
 if(!Array.isArray(lines))return false;
 const amount=event?.amount_paise;
 if(!Number.isSafeInteger(amount)||amount<=0)return false;
 // Validate the bank line is an active asset, even if someone changed
 // the Chart of Accounts type after an earlier posting.
 const bank=lines.find(l=>l.account_code==='1000');
 if(!bank||bank.account_type!=='asset')return false;
 if(event.source_kind==='payroll_payment'&&
   typeof event.source_id==='string'&&event.source_id.includes('|')){
  if(event.direction!=='money_out'||![2,3].includes(lines.length))return false;
  const advance=lines.length===3?lines[2].credit_paise:0;
  return Number.isSafeInteger(advance)&&advance>=0&&
   (lines.length===2||advance>0)&&
   Number.isSafeInteger(amount+advance)&&
   exact(lines[0],'2100',amount+advance,0)&&
   exact(lines[1],'1000',0,amount)&&
   (lines.length===2||exact(lines[2],'1200',0,advance));
 }
 if(event.source_kind==='statutory_remittance_paid'){
  return event.direction==='money_out'&&
   ['2111','2112','2113','2114'].includes(statutoryAccountCode)&&
   lines.length===2&&
   exact(lines[0],statutoryAccountCode,amount,0)&&
   exact(lines[1],'1000',0,amount);
 }
 let plan;
 try{plan=journalPlanForEvent({organization_id:event.organization_id,
   event_id:event.event_id,source_kind:event.source_kind,
   direction:event.direction,amount_paise:amount});}
 catch{return false;}
 return lines.length===2 &&
  exact(lines[0],plan.debitCode,amount,0)&&exact(lines[1],plan.creditCode,0,amount);
}
