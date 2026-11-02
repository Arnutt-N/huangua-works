# Dual Adversarial Plan Review Synthesis: E2E Playwright Suite Update (Step 5)

## Review Metadata
- **Plan**: `prd-prp-e2e-suite-update.md`
- **Reviewer A Score**: 5.5 / 10
- **Reviewer B Score**: 7.5 / 10
- **Synthesized Decision**: REVISE TO REV 2 AND PROCEED

---

## Key Consensus Findings & Required Adjustments

1. **S3 Storage Configuration for Resolution Photos**:
   - Issue: When `isStorageConfigured()` is false, `sanitizeResolutionPhotosForCitizen` removes all photos with `url === null`.
   - Resolution: Inject dummy S3 credentials into `playwright.config.ts` `webServer.env` (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`). AWS SDK generates presigned URLs cryptographically without network calls, enabling resolution photo rendering on `/track`.

2. **Headless Clipboard Permissions**:
   - Issue: Headless Chrome denies `navigator.clipboard.writeText` by default, causing copy button to stay on default state.
   - Resolution: Grant `permissions: ['clipboard-read', 'clipboard-write']` in `playwright.config.ts` `projects[0].use`.

3. **Rate Limiting & Idempotency in E2E Specs**:
   - Issue: Running tests consecutively trips `/api/cases/[id]` rate limit (10 req / 5 min) and admin login rate limit.
   - Resolution: Call `resetRateLimits` in `test.beforeAll` / `test.beforeEach` in both `e2e/track.spec.ts` and `e2e/admin-reports.spec.ts`. Pre-clean test IDs before inserting.

4. **Anchor Download vs Form Submit**:
   - Issue: "ส่งออก CSV" is an anchor `<a href="..." download>`, not a form button.
   - Resolution: Use `page.waitForEvent('download')` and assert filename `huangua-cases-*.csv`.

5. **Window Print Dialog in Headless Browser**:
   - Issue: Calling `window.print()` in headless Chrome can block the test.
   - Resolution: Stub `window.print` using `page.addInitScript(() => { window.print = () => {}; })`.

6. **Web Server Timeout**:
   - Issue: 60s timeout is too tight for cold Turbopack on Windows.
   - Resolution: Increase `webServer.timeout` to `120_000` ms, command to `npx next dev`.
