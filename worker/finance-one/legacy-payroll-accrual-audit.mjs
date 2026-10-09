/**
 * Verify a posted legacy payroll accrual against the IMMUTABLE approved Finance
 * source snapshot and (when present) separately reviewed statutory amounts.
 * Staging read-only audit. Does not approve payroll or determine legal rates.
 */
const MONEY_FIELDS=['gross','late','attendance','advance','deductions','net'];
const STAT_CODES=[
 ['employee_pf_paise','2111'],['employee_esi_paise','2112'],
 ['professional_tax_paise','2113'],['tds_paise','2114']
];
const TYPES=Object.freeze({'5100':'expense','5300':'expense','2100':'liability',
 '2111':'liability','2112':'liability','2113':'liability','2114':'liability'});
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const money=s=>{if(!/^(0|[1-9][0-9]*)$/.test(s))return null;
 const n=Number(s);return safe(n)?n:null;};
function decode(source){
 if(typeof source!=='string')return null;
 const m=/^(\d+):([A-Za-z0-9_-]{1,100})\|(\d+):([A-Za-z0-9_-]{1,100})\|((?:0|[1-9][0-9]*)(?::(?:0|[1-9][0-9]*)){5})(?:\|ST:([0-9a-f]{64}))?$/.exec(source);
 if(!m||Number(m[1])!==m[2].length||Number(m[3])!==m[4].length)return null;
 const [gross,late,attendance,advance,deductions,net]=m[5].split(':').map(money);
 if([gross,late,attendance,advance,deductions,net].some(v=>v===null))return null;
 return{schoolId:m[2],payrollId:m[4],sourcePrefix:m[1]+':'+m[2]+'|'+m[3]+':'+m[4],
  gross,late,attendance,advance,deductions,net,statFingerprint:m[6]||null};
}
function entries(snapshot,stat){
 const employee=STAT_CODES.reduce((v,[key])=>v+stat[key],0);
 const employer=stat.employer_pf_paise+stat.employer_esi_paise;
 if(!safe(employee)||!safe(employer)||snapshot.gross<=0)return null;
 const earned=snapshot.gross-snapshot.late-snapshot.attendance;
 const payable=earned-employee;
 if(!safe(earned)||earned<=0||!safe(payable)||earned-snapshot.advance-employee!==snapshot.net||
  snapshot.late+snapshot.attendance+snapshot.advance+employee!==snapshot.deductions||
  snapshot.gross-snapshot.deductions!==snapshot.net)return null;
 const result=[['5100',earned,0]];
 if(payable>0)result.push(['2100',0,payable]);
 for(const [field,code] of STAT_CODES)if(stat[field]>0)result.push([code,0,stat[field]]);
 if(employer>0){
  result.push(['5300',employer,0]);
  if(stat.employer_pf_paise>0)result.push(['2111',0,stat.employer_pf_paise]);
  if(stat.employer_esi_paise>0)result.push(['2112',0,stat.employer_esi_paise]);
 }
 return result;
}
export async function approvedLegacyPayrollAccrualMatches(db,organizationId,document,lines){
 try{
  const snap=decode(document?.source_id);
  if(!snap||document.id!=='PAY_ACCR|'+snap.sourcePrefix)return false;
  const month=snap.payrollId.match(/_(20[0-9]{2}-(?:0[1-9]|1[0-2]))$/)?.[1];
  if(!month)return false;
  // A payroll journal must still belong to its current independent legal
  // business. Matching source numbers alone do not grant cross-center access.
  const owner=await db.prepare(`SELECT school_id FROM neo_fin_school_ownership
   WHERE organization_id=? AND school_id=? AND effective_to IS NULL
     AND date(? || '-01')>=date(effective_from) LIMIT 1`)
   .bind(organizationId,snap.schoolId,month).first();
  if(!owner)return false;
  const stat=Object.fromEntries([...STAT_CODES.map(([field])=>field),
   'employer_pf_paise','employer_esi_paise'].map(k=>[k,0]));
  if(snap.statFingerprint){

   const review=await db.prepare(`SELECT status,payroll_month,source_fingerprint,
    reviewed_at,reviewed_by,employee_pf_paise,employee_esi_paise,
    professional_tax_paise,tds_paise,employer_pf_paise,employer_esi_paise
    FROM neo_fin_payroll_statutory_reviews WHERE organization_id=? AND school_id=? AND payroll_record_id=?`)
    .bind(organizationId,snap.schoolId,snap.payrollId).first();
   if(!review||review.status!=='approved'||review.payroll_month!==month||
     review.source_fingerprint!==snap.statFingerprint||!review.reviewed_by||
     !Number.isFinite(Date.parse(review.reviewed_at)))return false;
   for(const key of Object.keys(stat)){
    if(!safe(review[key]))return false;
    stat[key]=review[key];
   }
  }
  const expected=entries(snap,stat);
  if(!expected||document.gross_paise!==snap.gross-snap.late-snap.attendance||
    expected.length!==lines.length)return false;
  return lines.every((line,i)=>{
   const [code,debit,credit]=expected[i];
   return line.line_no===i+1&&line.active===1&&
     line.account_code===code&&line.account_type===TYPES[code]&&
     line.debit_paise===debit&&line.credit_paise===credit;
  });
 }catch{return false;}
}
