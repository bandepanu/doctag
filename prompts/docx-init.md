---
name: docx-init
description: Guided Phase-0 setup for DocX, designed for non-experts. The agent proposes sensible defaults; the user only approves or nudges — never faces a blank contract.
---

Set up DocX for this project the low-ceremony way. The user is likely not an expert, so **you propose, they approve** — never ask them to author a contract from scratch.

Context to work from: $ARGUMENTS (their goal for the project; if empty, ask one short question about what they're building).

Steps:

1. **Detect the stack.** Look at existing files (or their description) to pick the language(s). State what you found in one line.

2. **Propose a `docx.json` with the vibe profile**, copying `schema/docx.vibe.jsonc` as the base. Fill in:
   - `docslim` caps: sane project-wide defaults (start ~40 lines / depth 3 / complexity 8; tighten only if they want stricter). These live in `docx.json`, NOT per function — that is deliberate.
   - `docdeps.allowed_imports`: the handful of libraries the project actually uses plus the language's standard library. If unsure, list what's imported today and ask them to confirm additions.
   Show the proposed file and ask: **"Use these defaults, or want them stricter/looser?"** Apply their answer.

3. **Explain the deal in two sentences**, plainly: DocX will (a) stop the AI from writing sprawling functions or pulling in libraries you didn't approve, and (b) keep short notes and tests inside each file so future edits don't drift. They never have to write tags — the AI does, and the validator checks them.

4. **Prose tokens stay un-enforced — but offer them as a learning aid.** The vibe profile only *enforces* the Core tokens (`docslim`, `docdeps`, `docpure`, `doctype`, `doctest`); prose tokens are never gates (they can drift silently). Ask once: **"Want learning annotations? As I code, I'll add a couple of architecture notes (`docarch`, and `docrisk` where relevant) with a one-line plain explanation, so you pick up the concepts — they're just notes, never blockers, and they feed `docx-pi docs` to build your living architecture guide."** If yes, add them sparingly with a short human-readable reason on each; if no, skip entirely. Either way they are not enforced.

5. **Write `docx.json`** at the repo root and confirm the validator runs: `docx-pi <a source file>`. From here on, you (the agent) add and maintain the Core tags on every edit, and run the validator before finishing any task. If learning annotations are on, run `docx-pi docs .` once so they can see the generated architecture guide.

Keep the whole interaction to a couple of approvals. The goal is guardrails the user never has to think about — plus, optionally, a gentle on-ramp to architecture.
