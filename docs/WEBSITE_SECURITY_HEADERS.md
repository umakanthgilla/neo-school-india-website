# Website response headers — staged rollout

Adds `_headers` to the root static output for Cloudflare Pages. No API Worker or database changes. Confirm the Pages project publishes this directory: the repository does not contain the dashboard's production build settings. Pages Functions/Worker responses do not inherit this file.

## What is enforced

- HSTS for 24 hours, without includeSubDomains or preload. Verify valid HTTPS before rollout. This deliberately avoids locking other subdomains to HTTPS.
- Existing nosniff and referrer policy values are retained.
- Same-origin framing only, through CSP frame-ancestors and X-Frame-Options. Cross-origin embedding of the school site is intentionally blocked; confirm there are no required external wrappers before production. YouTube embedded *inside* the site is unaffected by frame-ancestors.
- CSP base-uri self and object-src none. Inspection found no base/object/embed elements requiring an exception. These directives do not restrict scripts, styles, fetch calls, images or child frames.
- Camera, microphone and geolocation allowed for the same origin, with browser permission still required. This preserves the homepage location button and photo workflows. Payment Request and USB are disabled; no usage was found. Fullscreen, autoplay and encrypted media defaults are preserved for YouTube.

## Content CSP is report-only

The longer policy is deliberately NOT enforced. It inventories the current public pages and their resource origins (API Worker, Ask Neo, PIN code lookup, spreadsheet/PDF CDNs, Google Fonts and YouTube). Inline scripts/styles remain allowed in this candidate because the existing site uses them. This is not a complete XSS policy. Removing unsafe-inline requires separate nonce/hash or external-script work.

No reporting endpoint is configured: violations appear in browser developer tools only. Do not expect server-side CSP reports or monitoring. Review console violations during preview checks before tightening/enforcing the content policy. The checker only checks header presence, so a green CSP presence result does not establish that script restrictions are enforced.

## Validation and release

Run `python3 scripts/check-security-headers.py` from the repository root.

Before production, deploy this branch to an isolated Pages preview using existing deployment settings. Verify headers for both HEAD and GET on `/`, `/admin`, `/schools`, `/teachers`, `/parents`, their `.html` variants, and a static JS asset. Check aliases/redirects and error pages separately. Check dashboard Transform Rules for duplicate headers; duplicate CSP policies may impose additional restrictions.

Manually verify public admission/franchise forms, location lookup, Ask Neo, YouTube playback/fullscreen, admin/school/teacher/parent logins using authorized test accounts, document/photo previews, bulk imports, PDF export and PWA/service worker refresh. Static checks cannot establish authenticated end-to-end compatibility.

Only after preview validation and final release authorization, merge/deploy through the existing Pages process. The Finance & Payroll branch and PR #26 are unrelated and must remain untouched.

Re-run the website security checker and inspect the actual header values. A missing header finding is hardening guidance, not evidence of compromise. The uploaded baseline report inspected only a HEAD response from the homepage.

## Rollback

Revert the `_headers` addition and redeploy the previously verified Pages version. Browsers that already received HSTS may retain it for up to 24 hours. To explicitly clear it while HTTPS is still available, serve `Strict-Transport-Security: max-age=0`; removing the header alone does not immediately clear it. Do not disable HTTPS as rollback.

Reference: https://developers.cloudflare.com/pages/configuration/headers/

## Recorded preview verification — 2026-10-17

Preview: https://0c0f572d.neo-school-india-website.pages.dev/ (commit c8c3664621a1e2305b9e21403bafba248315f1e1). Cloudflare Pages check completed successfully.

- 20 HTTP checks passed: HEAD and GET for `/`, four portal aliases and their `.html` variants, plus `/neo-operations.js`. Canonical pages/assets returned 200 with the expected enforced and report-only headers; `.html` requests returned 308 redirects to the matching canonical aliases. Redirect responses were checked for routing, not header parity.
- Browser smoke checks: homepage renders; admission and franchise dialogs open; Ask Neo panel opens; Admin, School, Teacher and Parent sign-in pages render. No credentials entered or forms submitted. YouTube playback/fullscreen, chatbot replies, document/photo previews, imports, exports and authenticated workflows remain unverified.
- Admission branch list is unavailable in the preview. The read-only public branches API returned 200, but a request with the preview Origin received `Access-Control-Allow-Origin: https://neo-school-india-website.pages.dev`, which does not match the preview. The same endpoint with production Origin received `Access-Control-Allow-Origin: https://neoschoolindia.com`. This isolates an existing preview/API CORS boundary, rather than a CSP blocking finding. API allowlist was not changed.
- The remaining release gate is an isolated test API/database with the exact preview origin allowed, plus authorized test-account workflow validation. Do not use real submissions to the production API for preview QA. Production header changes are not released by this PR's preview.
