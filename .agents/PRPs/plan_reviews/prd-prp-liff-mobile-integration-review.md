# Adversarial Plan Review Synthesis: P2-01 Full LINE LIFF Mobile Integration

**Date:** 2026-11-02  
**Target Document:** [prd-prp-liff-mobile-integration.md](file:///C:/Users/arnutt.n/.gemini/antigravity-cli/brain/7c4198dc-a87f-4c5e-9780-a81a9dc8a880/prd-prp-liff-mobile-integration.md)  
**Reviewers:** Reviewer A (Security, CSP, Data Boundaries) & Reviewer B (UX/UI, Elderly Citizen Accessibility, Route Accuracy)  
**Initial Consensus:** REVISE  
**Revised Plan Status:** Rev 2.0.0 APPROVED FOR IMPLEMENTATION  

---

## 1. Key Critiques and Resolutions

| # | Topic | Reviewer Critique | Resolution in Rev 2.0.0 |
|---|---|---|---|
| 1 | **Ghost Route** | Plan referenced non-existent `src/app/track/[code]/page.tsx`. Tracking in this app is single-route (`/track?id=...`). | Removed ghost route; anchored tracking enhancements directly in `track/page.tsx` and `track-form.tsx`. |
| 2 | **Security Invariant** | Plan stated client would transmit `lineUserId` in intake payload. This violates the server-only cookie invariant. | Corrected: Client never transmits `lineUserId`. Server extracts verified identity exclusively from signed `LIFF_SESSION_COOKIE`. |
| 3 | **CSP for Avatars** | `next.config.ts` blocked `profile.line-scdn.net` under `img-src 'self' data: blob:`. | Added `next.config.ts` to plan with `https://*.line-scdn.net` in `img-src` and `https://access.line.me` in `connect-src`. |
| 4 | **Security Mock Gate** | `isLiffMockEnabled()` lacked `NODE_ENV !== 'production'` guard, risking auth bypass if env var leaked. | Added strict `process.env.NODE_ENV !== 'production'` check. |
| 5 | **Validation Ergonomics** | `fullNameSchema` rejected 1-character LINE names with 400 error. | Updated `submitCaseLineSchema` to allow single-character names safely. |
| 6 | **Elderly UX & Plain Thai** | Raw `lineUserId` should not be exposed (PDPA & clarity); need friendly Empty State for first-time LINE users; allow nickname editing. | Added profile banner (display name + avatar only), editable name with helpful hint, clear CID exemption note, and empty state with CTA to `/intake`. |
| 7 | **SDK Timeout** | Loading CDN SDK on slow 3G could hang indefinitely. | Added 5,000ms timeout in `loadLiffSdk()` to fail gracefully to standard web form. |

---

## 2. Verification Gate Sign-Off
- Security & CSP: Approved
- Route & Codebase Alignment: Approved
- Elderly Accessibility & UX: Approved
- Protected Design Invariants: Approved (0 diff on `tokens.css`, `page.tsx`, `components/landing/*`)
- Zero Emoji Policy: Approved
