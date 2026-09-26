# Neo school onboarding upgrade

This upgrade retains the existing lead API and ADMIN_PASSWORD login. New data uses three separate tables; no existing lead columns are changed.

## Deploy in order

1. In Cloudflare, open neo-lead-crm-api > Edit code. Save a copy of the current Worker before replacement.
2. Replace the complete worker.js with backend/worker.js from this package and deploy. Retain the existing DB binding and ADMIN_PASSWORD secret. No new secrets are required.
3. In the website GitHub repository, upload admin.html and schools.html to the root. Commit the changes and wait for the website deployment to finish.
4. Sign in at https://neoschoolindia.com/admin and choose School Onboarding.
5. On the onboarding page click Use current head-office session. On first use an unavailable message is expected until initialization; the admin controls remain visible.
6. Click Initialize onboarding database. This creates new tables only and is safe to repeat. Refresh schools.
7. Add a school using its name, city, owner and a unique 12–128 character password. Keep the generated school ID. Share credentials privately with that partner.
8. Partners open https://neoschoolindia.com/schools.html and sign in with their school ID and password. They can view only their own readiness checklist. Head office approves readiness steps, resets passwords and enables or suspends access.

## Verify live after deployment

Use one pilot school account. Confirm it can see its own checklist and cannot access another school. Confirm a head-office checklist update appears after school sign-in/refresh. Reset the school password and confirm the old session no longer works. No production data or test enquiries were submitted during local development.

## Scope and limitations

This is school-account management and onboarding readiness tracking, not a full school ERP. Admissions remain in the existing head-office CRM; they are not assigned to school accounts by this release. There are no document uploads, curriculum distribution, billing or teacher accounts. Head office still uses the existing shared admin password. School login is limited to 10 attempts per school ID per 15-minute window. Password reset invalidates prior school sessions; suspension blocks access immediately.

Local tests use SQLite with a D1-compatible adapter. Tests cover initialization, account creation, school isolation, admin-only approval, checklist persistence, password-reset invalidation, suspension and login throttling. Browser visual QA and production D1 deployment remain unverified.

The original Worker's root health endpoint reports a fixed database status; it should not be used as evidence that a live query succeeded.

Rollback: restore the previous Worker and website admin.html. Leave the additive school tables in place to retain onboarding data.
