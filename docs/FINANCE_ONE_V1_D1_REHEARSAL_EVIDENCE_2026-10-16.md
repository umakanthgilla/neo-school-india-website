# Actual D1 restore and migration 13 rehearsal — 16 October 2026

Operator-confirmed result: PASS source and restored schema/counts match; PASS migration 13 restore rehearsal; PASS integrity OK; financial counts unchanged. STAGING MIGRATION NOT APPLIED.

Source: neo-finance-one-staging, UUID 17c1d0d7-aab1-4e4a-9afe-6b36554b8f93. Private backup/evidence folder: /Users/apple/neo-finance-before-review-8jbO0o. Backup checksum/size were verified locally against backup-evidence.json; no SQL export or private evidence was uploaded to GitHub.

New isolated restored D1: neo-finance-review-restore-mvahz8qd, UUID 876af673-7b8b-4e69-bac4-55d83ee0308a. Backup import processed 197 queries. Bookmark after restore: 00000000-0000001d-00005106-bcf110127b32b4f1303d1b566eda0232.

Only the checksum-pinned migration 13 from source 9dd49fb480746f56dedec08807eb5a62c4776073 was applied to this restored database. It processed 9 queries. Post-migration bookmark: 00000000-00000022-00005106-822bef52100406108ce99bd7dd408eac. Required two tables and seven triggers were detected; existing Finance schema and financial counts were unchanged; quick_check passed and foreign-key findings were zero.

The fixed helper source is 0326daa8e02e0b6e7181afe1b3c59700c19bf888. 394 local tests and exact-source CI run 38853311980 passed. Financial count queries run individually because actual D1 rejected a six-term compound SELECT. No authentication reduction was required.

Limits: source cash events and journals are zero. This proves actual D1 restoration and migration compatibility with the existing schema/QA identities; it does not prove recovery of populated financial transactions, live evidence retention, independent maker/checker cloud approval or payroll compliance. No source or restored financial postings were created by the helper.

Next: apply only verified migration 13 to the guarded staging database with evidence/source/correction flags OFF, compare its resulting schema and financial counts to the rehearsed result, then deploy the exact reviewed source and configure distinct verified Access identities for a synthetic independent receipt journey. Preserve backups and both restore databases; no destructive cleanup or production migration is authorized by this rehearsal. PR #26 remains draft/unmerged; production remains NO GO.
