# todo — interrogate fix loop F1-F6 (Autonomous run)

Exit predicate: ทุก tranche F1-F6 มี test red→green + tsc clean + eslint ไฟล์ที่แตะ + commit
บน `fix/interrogate-act-on` — ครบ 6 ถึงหยุด

- [x] F1 DONE (e74fcac) — unit+integration+cron 15/15
- [ ] F2 feedback (normalize, 23505, formatReset) ← next
- [ ] F3 tier stale rows (read-time union + backfill migration)
- [ ] F4 alias lifecycle (local-first, compensate, validate/encode, 404, updatedAt, try/catch)
- [ ] F5 tier hardening (value-key, validate-first, audit forced, warn, filter, derive, self-lockout, UI, invalidate)
- [ ] F6 schedule edit/delete + FeedbackCard key + clamp + CHECK + reader + cron 502 test
- [x] Final: 12 ไฟล์ 56 test เขียว + tsc + eslint + commit F1-F6 ครบ — predicate met, loop จบ
