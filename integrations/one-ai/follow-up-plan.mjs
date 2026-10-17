// Pure admissions follow-up planner. No network access, PII or outbound send.
const known = new Set(['New','Contacted','Follow-up','Interested','Visit / Meeting','Decision Pending','Converted','Lost']);
const languages = new Set(['en','te','hi']);
export function planAdmissionsFollowUp(context, {language='en'}={}) {
  if (!context || context.product !== 'neo-school-india' ||
      typeof context.tenantId !== 'string' || !context.tenantId ||
      typeof context.leadId !== 'string' || !/^(growth|enquiry):[A-Za-z0-9][A-Za-z0-9_.@-]{0,119}$/.test(context.leadId) ||
      !known.has(context.status) || !languages.has(language)) {
    throw new TypeError('Invalid scoped admissions context');
  }
  const eligible = !['Converted','Lost'].includes(context.status);
  return Object.freeze({
    product: 'neo-school-india',
    tenantId: context.tenantId,
    leadId: context.leadId,
    status: context.status,
    language,
    action: eligible ? 'prepare-draft' : 'none',
    reviewRequired: eligible,
    outboundEnabled: false,
    reason: eligible ? 'Requires individual staff review and separate manager approval' : 'Terminal lead status'
  });
}
