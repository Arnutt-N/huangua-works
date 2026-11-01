# Dual Adversarial Plan Review: Print-friendly PMQA Statistical Report

**Target Document**: `prd-prp-print-friendly-pmqa-report.md` (Rev.2)  
**Target Route**: `/admin/reports/pmqa`  
**Date**: 2026-11-02  
**Final Composite Score**: **9.8 / 10**  
**Final Verdict**: **READY TO IMPLEMENT**

---

## 1. Review Summary & Incorporations

### Reviewer A (Architecture, Styling & Thai Government Standards)
- **Score**: 8.5/10 -> 9.8/10 (after Rev.2)
- **Key contributions accepted**:
  - `AdminShell` / `AdminLayout` margin and padding removal (`print:p-0 print:m-0 print:max-w-none print:w-full print:min-h-0`).
  - 8-Status grid A4 print adjustment: `print:grid-cols-4 print:gap-2` instead of 8 cramped columns.
  - Decorative progress bar hidden in print mode (`print:hidden`).
  - Formal Thai government date format: `(ตั้งแต่วันที่ 1 ตุลาคม พ.ศ. ... ถึงวันที่ 30 กันยายน พ.ศ. ...)`.
  - Solid black text for print contrast (`print:text-black`).

### Reviewer B (Test Rigor, Dark Mode Resilience & Table Pagination)
- **Score**: 7.5/10 -> 9.8/10 (after Rev.2)
- **Key contributions accepted**:
  - Dark mode print fix: Reset `print:bg-white print:text-black print:bg-none` at root level in `AdminLayout` to prevent white text on white paper.
  - Duplicate heading prevention: Put `print:hidden` on the entire screen header container.
  - Table pagination: Apply `print:break-inside-avoid` to individual `<tr>` elements instead of the whole table, and add `print:table-header-group` to `<thead>`.
  - Unit test completeness:
    - `PrintButton.test.tsx`: Spy `window.print`, custom label/className, touch target size, a11y role.
    - `pmqa/page.test.tsx`: Test print classes, empty categories edge case, 0 cases division-by-zero protection, and `searchParams` Promise resolution.

---

## 2. Gate Verification Readiness
- Protected design: `tokens.css` and `/` untouched (0 diff).
- Zero emoji: 100% strictly enforced.
- Execution Tranches 1-4 ready for sequential implementation.
