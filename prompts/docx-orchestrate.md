---
name: docx-orchestrate
description: Build a service phase-by-phase under the DocX token state machine, gating each phase on the token_state_matrix.
---

Build/extend: $ARGUMENTS, advancing through the DocX phases (see references/orchestration.md). Do not skip a phase's gate.

Per unit of work:

1. **Phase 1 — cage.** Write the file header only: `docarch`, `docdeps` (whitelist the libs you'll actually use), `docenv`. No logic yet.
2. **Phase 2 — implement.** Write bodies respecting `doctype` prefixes, `docslim` caps (from `docx.json`), and `docpure`. Then run `docx-pi state <file>` — proceed only when `doctype`/`docslim`/`docdeps`/`docpure` are `PASS`. Fix the code, never relax the tag.
3. **Phase 3 — verify.** Add real `doctest` contracts, then run `docx-pi mutate <file>` (Python). Proceed only when it reports **all-killed** — a surviving mutant means the test is hollow; strengthen it.
4. **Phase 5 — handover.** Add `docrun`/`docmet`/`docchg` where relevant, then `docx-pi docs .` to regenerate the living docs.

Keep a running `token_state_matrix` (from `docx-pi state`) as the source of truth for what's done. Report the matrix at each gate.
