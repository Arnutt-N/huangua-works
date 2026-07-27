# PRD + PRP-Plan: Login Enhancements & Password Reset

> Branch: `feat/login-enhancements` · Created: 2026-07-27
> Skills: karpathy-guidelines (baseline) + addyosmani `frontend-ui-engineering` + `security-and-hardening`

---

## Part 1 — PRD

### Problem Statement

1. Login form inputs lack icons (plain text fields)
2. Missing standard login UX: "remember me" checkbox, "forgot password?" link, "no account" notice
3. No password reset mechanism exists — locked-out staff have zero self-service path
4. **UX bug**: after successful login, the page flashes (inputs clear, appears to redirect back to login) before landing on /admin — caused by `router.refresh()` re-rendering the login page before `router.push()` completes

### Scope

**In:**
- Lucide icons on email (Mail) and password (Lock) inputs
- "จดจำฉัน" (remember me) checkbox — extends session from 1h to 30d
- "ลืมรหัสผ่าน?" link → `/admin/forgot-password`
- "ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ" muted text (no link — staff-only system)
- Fix login flash bug
- Self-service reset: request page → email with tokenized link → set new password
- Admin reset: head/superadmin triggers reset email from /admin/users
- Rate limiting + audit logging on all reset operations

**Out:** self-registration, SMS/OTP, email verification on signup

### Acceptance Criteria

| # | Criterion |
|---|-----------|
| 1 | Email input shows Mail icon; password input shows Lock icon (lucide-react) |
| 2 | Remember me unchecked → session expires after 1h; checked → 30d |
| 3 | "ลืมรหัสผ่าน?" links to /admin/forgot-password |
| 4 | "ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ" renders as muted text below form |
| 5 | After login: no flash/blink — inputs persist during pending, clean navigation to /admin |
| 6 | Forgot page: always shows generic success ("ลิงก์ถูกส่งแล้วถ้าอีเมลนี้อยู่ในระบบ") — prevents user enumeration |
| 7 | Reset link expires in 1h, single-use, token stored as SHA-256 hash in DB |
| 8 | Reset page: password min 8 chars + confirmation match → updates hash → invalidates token → redirects to login |
| 9 | Rate limits: 3 requests/email/15min, 5 requests/IP/15min (fail-secure) |
| 10 | Admin reset button (head/superadmin only) on /admin/users → sends reset email to target user |
| 11 | Audit events: `password_reset_requested`, `password_reset_success`, `password_reset_failure` (ใหม่) + `reset_user_password` (มีอยู่แล้ว — admin reset ที่ `users.ts:228`, ดูหมายเหตุ T4) |
| 12 | `pnpm lint && pnpm typecheck && pnpm build` pass |

### Constraints

- Auth.js v5 beta.25, JWT strategy, Next.js 16 (`proxy.ts` not `middleware.ts`)
- Proxy guards `/admin/:path*` — forgot/reset pages need allowlist in `authorized` callback
- No email infra exists → add nodemailer + SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`)
- Thai UI language, existing design tokens (glass-panel, lucide icons, `*-ink`/`*-soft` colors)

---

## Part 2 — PRP-Plan

### Architecture Decisions

1. **Token design**: `crypto.randomBytes(32).toString('hex')` plaintext in URL; DB stores SHA-256 hash (DB leak ≠ account takeover)
2. **Remember me**: JWT `expiresAt` claim — cookie maxAge raised to 30d in config, but `jwt` callback returns `null` when `expiresAt` passes (1h without remember, 30d with). No Auth.js `remember` option dependency (beta API instability)
3. **Email**: nodemailer + SMTP (works with any provider incl. Resend SMTP, Gmail, govt mail server). Dev fallback: `MAIL_CONSOLE=true` logs email to console instead of sending
4. **Reset pages under /admin/**: consistent admin design; `authorized` callback gets a public-paths allowlist
5. **Admin reset already exists** (`actions/users.ts:228`, superadmin-only, sets password directly). The "Both" decision is satisfied by this existing flow + the new self-service email flow — no new admin UI required (T4 reduced to verification only)

### Tranche Order

```
T1 (infra)  → T2 (login UI) → T3 (reset pages) → T4 (admin reset) → T5 (verify)
```

### T1 — Infrastructure (DB + mail + token lib)

| Action | File |
|--------|------|
| Add `passwordResetTokens` table | `src/lib/db/schema.ts` |
| Generate migration | `drizzle/` via drizzle-kit |
| Create mail sender (nodemailer, Thai HTML template) | `src/lib/mail.ts` (new) |
| Create token helpers (generate/hash/create/validate/consume) | `src/lib/auth/reset-token.ts` (new) |
| Add reset Zod schemas | `src/lib/validation.ts` |
| Install nodemailer | `package.json` |

**Schema:**
```ts
passwordResetTokens = pgTable('password_reset_tokens', {
  id: text PK (uuid v7),
  userId: text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tokenHash: text NOT NULL UNIQUE,       // sha256 of plaintext token
  expiresAt: timestamp NOT NULL,         // now + 1h
  usedAt: timestamp,                     // null = unused
  createdAt: timestamp NOT NULL default now
})
// index on userId (invalidate old tokens on new request)
```

### T2 — Login Form UI + Flash Fix

| Action | File |
|--------|------|
| Add `icon?: LucideIcon` prop to Input (absolute-positioned, `pl-10`) | `src/components/ui/field.tsx` |
| Icons + remember checkbox + forgot link + no-account text | `src/app/admin/login/login-form.tsx` |
| Remove `router.refresh()` (flash root cause); pass `remember` to action | `login-form.tsx` |
| Accept `remember` in login action → pass to signIn credentials | `src/app/admin/actions.ts` |
| `expiresAt` logic in jwt callback; raise cookie maxAge to 30d | `src/auth.ts` + `src/auth.config.ts` |

**Flash fix detail**: `router.refresh()` re-fetches the current RSC payload, causing a full client re-render (inputs unmount/remount → values lost) before `router.push` navigation commits. Removing it leaves `push` as the sole navigation — form stays intact during pending, then navigates cleanly.

### T3 — Forgot/Reset Pages + Actions

| Action | File |
|--------|------|
| Allowlist `/admin/forgot-password`, `/admin/reset-password` in authorized | `src/auth.config.ts` |
| Forgot page (server) + form (client, success state, resend cooldown UI) | `src/app/admin/forgot-password/` (new) |
| Reset page (reads `?token=`) + form (password + confirm + strength hint) | `src/app/admin/reset-password/` (new) |
| `requestReset` action: validate → rate-limit → lookup user → invalidate old tokens → create token → send email → generic success + audit | `src/app/admin/actions/reset.ts` (new) |
| `resetPassword` action: validate token (unused + unexpired) → hash new password → update user → mark used → audit | same file |

**Security rules:**
- `requestReset` returns identical response whether email exists or not (anti-enumeration)
- New request invalidates all prior unused tokens for that user
- `resetPassword` validates user is still `isActive` + role !== 'citizen' at consumption time
- Both actions rate-limited via existing `checkRateLimit` (Upstash)

### T4 — Admin Reset (ALREADY EXISTS — verification only)

`resetPassword` action exists at `src/app/admin/actions/users.ts:228` (superadmin-only, sets password directly, audits as `reset_user_password`). No new code. Verify during T5 that it still works alongside the new self-service flow.

### T5 — Verify

- `pnpm lint && pnpm typecheck && pnpm build`
- Manual flow test: login (remember on/off) → forgot → email (console mode) → reset → login with new password
- Verify no flash on login redirect
- Verify proxy allows unauthenticated access to forgot/reset pages
- Verify enumeration protection (nonexistent email → same UI response)

### Risk Register

| Risk | Mitigation |
|------|-----------|
| SMTP not configured in dev | `MAIL_CONSOLE=true` env → log email to console |
| Auth.js beta jwt-null behavior | Verify in T2: jwt callback returning null must invalidate session (documented v5 behavior) |
| Proxy matcher blocks reset pages | Allowlist in `authorized` callback (not matcher regex — simpler, single source of truth) |
| 30d cookie maxAge weakens stolen-cookie window | Only when user opts in via remember me; default stays 1h; per-request role/isActive re-check remains |
