# DocX Orchestration — token state machine

Treats the tokens as **state transitions**, not just documentation: an agent moves a service from inception to done by satisfying token constraints phase by phase, and a machine-readable **`token_state_matrix`** (emitted by `docx-pi state <file>`) gates each step.

## The token_state_matrix packet

`docx-pi state <file>` returns, per Core token, `{ present, status }` where status is `PASS` / `FAIL` / `ABSENT`:

```json
{ "file": "src/billing.py", "language": "python", "errors": 0,
  "token_state_matrix": {
    "doctype": { "present": true,  "status": "PASS" },
    "docslim": { "present": true,  "status": "PASS" },
    "docdeps": { "present": true,  "status": "PASS" },
    "docpure": { "present": false, "status": "ABSENT" },
    "doctest": { "present": true,  "status": "PASS" },
    "docinv":  { "present": false, "status": "ABSENT" },
    "docref":  { "present": true,  "status": "PASS" } } }
```

Exit code is non-zero if any token is `FAIL`, so it drops into a gate.

## The six phases (advance only when the gate passes)

| Phase | Focus | Gate before leaving |
|-------|-------|---------------------|
| 0 Inception | Human intent: `docbiz`, `doccomp`, `docux` in a skeleton | Human approves the skeleton |
| 1 Structural cage | `docarch`, `docdeps`, `docenv` headers, no logic | `docdeps` present |
| 2 Implementation | Write bodies under `doctype` + `docslim` + `docpure` | `docslim`/`doctype`/`docpure` = PASS (`docx-pi`) |
| 3 Verification | `doctest` contracts + mutation gate | `doctest` PASS **and** `docx-pi mutate` = all-killed |
| 4 Runtime proof | `doctrace`, `doctaint` observed in staging | (out of scope for v0.1 tooling) |
| 5 Operations | `docrun`, `docmet`, `docchg` for handover | docs generate (`docx-pi docs`) |

Phases 2–3 are fully enforceable today with `docx-pi state` + `docx-pi mutate`. Phases 4–5 are documented; runtime taint/telemetry is reference-architecture, not shipped.

## Loop

For each unit of work: emit the matrix → if any binding token is `FAIL`, fix the code (never relax the tag) → re-emit → advance only when the phase gate is green. The `/docx-orchestrate` prompt drives this.
