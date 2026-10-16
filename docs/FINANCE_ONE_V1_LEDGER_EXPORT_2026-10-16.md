# Full cash ledger CSV — 16 October 2026

The portal previously displayed only the latest 50 verified cash events. A separate read-only ledger-export endpoint now returns all events at a fixed organization-scoped insertion boundary, 100 per page. The portal validates snapshot identity, expected count, unique event IDs, amounts and continuation before downloading a CSV. New source postings after the first page are excluded; restart to include them. Rows are in posting insertion order, with their original effective dates retained. Amounts are integer INR paise.

The interactive export supports up to 10,000 events and refuses larger books before downloading. It never downloads a partial file after a page failure, count mismatch or logout. Spreadsheet text formulas are neutralized. Every page independently checks current Finance session and organization membership; a cursor never grants authority to another organization. No financial writes, new migrations, school-source binding or posting flags are needed.

Validation: 384 Node/SQLite tests passed. New tests cover 205 rows over three pages with interleaved other-Center events, concurrent backdated insertion, malformed/foreign cursors, unauthorized API access, complete multi-page CSV, formula neutralization, incomplete-page failure and logout during export. Chromium/WebKit browser QA now checks actual ledger CSV download and logout clearing. Browser executables are absent in this local environment; exact-commit CI must verify browser/build/package checks before staging rollout. This export has not yet been cloud deployed or client accepted.

Access login separately passed 29 cloud smoke checks on version 3f1692d2-2695-49f8-abc7-7a446d2bc370. This export does not complete source approvals/evidence intake, cash/refund/payroll corrections, statutory sign-off, populated D1 restore or financial cloud UAT. Production remains NO GO; PR #26 stays draft and unmerged.

## Actual protected staging acceptance

Operator output on 16 October records version `20fc9813-dfb4-432e-a80c-d680368519f0`, patch source `270a4b3f680f5d6c0941a9d86e55df895424617c`, and `PASS CLOUD: 29 access checks; 3 complete ledger exports`. This is the previously documented layered staging release with three checksum-verified export files replaced, not proof of a complete source-tree deployment. CI run `38848435788` passed all authorization, Chromium/WebKit, Worker bundle and source handover jobs.

Each ledger export used the QA Center A owner session; these QA books currently have zero cash events. Cloud export endpoint/session/pagination contract acceptance therefore covers empty books; the 205-entry/multi-page test remains SQLite evidence. Populated cloud receipt/voucher/payroll and manual evidence intake journeys are still pending. Both operation flags and the separate source flag remained OFF.

The deployment uploaded `portal.html.before-export-1792123455162` because the operator helper placed its HTML backup in the assets folder. That was a helper packaging mistake. The staging entrypoint serves only `/` and `/portal.html` for assets and returns 404 on unrelated paths; the backup is old public portal code, not credentials. Move backups outside the assets directory and exclude `*.before-*` in the next staging deployment; verify the old backup URL returns 404. No production change or PR merge occurred.
