# USHA ONE — Main Core V1

Safe development branch: `main-core-v1`

## Purpose
USHA ONE Main Core is the reusable business operating core. Neo School India is the first pilot workspace.

## V1 Modules
1. ONE Communication Hub — unified conversations across WhatsApp, Instagram, Web and Email.
2. ONE CRM — contacts, leads, pipeline, follow-ups, tasks and notes.
3. ONE Agent Core — intent, context, rules, memory, decision, approval and action.
4. ONE AI Gateway — provider/model routing, fallback, usage and cost controls.
5. Automation Layer — n8n and business APIs.
6. Business Data Layer — Supabase/Postgres.

## Pilot flow
Incoming enquiry -> Contact/Lead -> Conversation -> AI classification -> Suggested/approved reply -> CRM update -> Follow-up/task -> Outcome.

## Safety rules
- Production `main` is not modified during Main Core V1 development.
- External messaging actions are human-approved until explicitly promoted to trusted automation.
- Provider credentials belong in environment variables/secrets, never source code.
- Every automated action should be auditable.

## First implementation target
WhatsApp-first Communication Hub for Neo School India, reusing the existing Neo CRM foundation where useful without coupling the reusable core to Neo-specific branding or rules.
