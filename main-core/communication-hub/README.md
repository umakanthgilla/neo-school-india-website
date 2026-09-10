# ONE Communication Hub V1

Pilot workspace: Neo School India

## Implemented in this build
- Unified Inbox shell
- Channel badges (WhatsApp/Web ready)
- Conversation view
- Contact/Lead context header
- Follow-up and Task actions
- ONE AI suggested reply card
- Human approval before AI send
- Responsive desktop/mobile shell

## Next implementation
1. Replace demo conversations with database-backed conversations/messages.
2. Map every conversation to workspace/contact/lead records.
3. Add WhatsApp Cloud API webhook ingestion and outbound send service.
4. Persist message delivery/status IDs.
5. Add AI suggestion endpoint through ONE AI Gateway.
6. Log approvals/actions in action_log.
7. Add Instagram adapter after WhatsApp pilot is stable.

## Pilot rule
No automatic high-risk outbound action. AI drafts/suggests; human approves during V1 pilot.