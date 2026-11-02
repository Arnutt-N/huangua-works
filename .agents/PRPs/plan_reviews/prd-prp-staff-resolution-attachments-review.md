# Dual Adversarial Plan Review: Staff Resolution Attachments (Before & After)

**Target Document**: `prd-prp-staff-resolution-attachments.md` (Rev.2)  
**Target Route**: `/admin/cases/[id]` & `/track`  
**Date**: 2026-11-02  
**Final Composite Score**: **9.7 / 10**  
**Final Verdict**: **READY TO IMPLEMENT**

---

## 1. Review Summary & Incorporations

### Reviewer A (Architecture, Concurrency & Security)
- **Initial Score**: 7.5/10 -> **9.7/10** (after Rev.2)
- **Key contributions accepted**:
  - `FOR UPDATE` row lock inside database transaction to guarantee zero lost updates on `cases.metadata`.
  - PDPA Sanitization: `PublicResolutionPhoto` completely strips `uploadedBy` (staff internal UUID) and S3 storage `key` before sending to `/track`.
  - Explicit storage cleanup: `deleteFile(photo.key)` executed on photo deletion.
  - Centralize `sniffImageMime` in `src/lib/media-upload-rules.ts`.

### Reviewer B (Frontend UX, A11y & Citizen Track Flow)
- **Initial Score**: 8.5/10 -> **9.7/10** (after Rev.2)
- **Key contributions accepted**:
  - `min-h-touch` (>= 44px) on delete buttons and tag selector radio buttons.
  - Zero state cleanliness: Hide resolution photo card on `/track` if `resolutionPhotos.length === 0`.
  - Mobile-first responsiveness: 1 column on mobile (Before stacked above After), 2 columns on desktop.
  - Prevent CLS with fixed `aspect-video` and integrate Radix `Dialog` for zoom viewing.
  - Destructive styling and confirm guard on photo deletion.

---

## 2. Gate Verification Readiness
- Zero emoji rule: 100% strictly enforced.
- Protected design: `tokens.css` and `/` untouched (0 diff).
- Tranches 1-4 mapped for systematic TDD execution.
