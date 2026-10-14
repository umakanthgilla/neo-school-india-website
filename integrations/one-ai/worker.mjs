// Independent, read-only admissions context service. Existing Neo Worker is unchanged.
import {verifyClaims} from './auth.mjs';
const product='neo-school-india';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {async fetch(request,env) {
 try {
  const url=new URL(request.url),match=url.pathname.match(/^\/context\/([A-Za-z0-9_.:@-]{1,128})$/);
  if(request.method!=='GET'||!match)return reply({error:'Not found'},404);
  if(!env.NEO_DB||!env.ENGINE_AUDIENCE||!env.CRM_TOKEN_SECRET||!env.TENANT_SCHOOLS_JSON)return reply({error:'Not configured'},503);
  const raw=request.headers.get('authorization')||'';
  const claims=await verifyClaims(raw.startsWith('Bearer ')?raw.slice(7):'',env.CRM_TOKEN_SECRET,{issuer:env.ENGINE_AUDIENCE,audience:'one-ai-crm',product});
  if(!claims||claims.leadId!==match[1])return reply({error:'Unauthorized'},401);
  const schools=JSON.parse(env.TENANT_SCHOOLS_JSON);
  if(!schools||!Object.hasOwn(schools,claims.tenantId)||typeof schools[claims.tenantId]!=='string')return reply({error:'Not found'},404);
  const school=schools[claims.tenantId],leadId=match[1];let row;
  if(leadId.startsWith('growth:')) {
   row=await env.NEO_DB.prepare(`SELECT l.status FROM leads l JOIN neo_growth_lead_meta m ON m.lead_id=l.lead_id
    JOIN neo_schools s ON s.school_id=m.branch_id AND s.active=1
    WHERE l.lead_id=? AND m.branch_id=? AND l.enquiry_type='Preschool Admission'`).bind(leadId.slice(7),school).first();
  } else if(leadId.startsWith('enquiry:')) {
   row=await env.NEO_DB.prepare(`SELECT json_extract(r.data,'$.status') AS status FROM neo_portal_records r
    JOIN neo_schools s ON s.school_id=r.school_id AND s.active=1
    WHERE r.school_id=? AND r.kind='enquiries' AND r.id=?`).bind(school,leadId.slice(8)).first();
  } else return reply({error:'Not found'},404);
  if(!row)return reply({error:'Not found'},404);
  const statuses=['New','Contacted','Follow-up','Interested','Visit / Meeting','Decision Pending','Converted','Lost'];
  return reply({product,tenantId:claims.tenantId,leadId,status:statuses.includes(row.status)?row.status:'New'});
 }catch{return reply({error:'Context service unavailable'},503);}
}};
