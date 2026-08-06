---
name: docx
description: Author and enforce DocX Framework tokens in source files across languages — inline knowledge-as-code metadata (types, tests, architecture, security, ops) that keeps an AI coding agent from producing bloated or hallucinated slop. Use when writing, annotating, retrofitting, or reviewing code under DocX governance, or validating a file against its docx.json. Trigger on DocX, docslim, docdeps, doctype prefixes/sigils, skeleton contract, or the docx-pi validator.
license: MIT
metadata:
  version: "0.1"
---

# DocX Framework (pi, multi-language)

DocX embeds lifecycle knowledge in source as `<comment> @doctoken: key = value` tags so code and its documentation, tests, and constraints move together in one commit. Your job when this skill is active: **write code that satisfies the DocX tags already in the file, add correct tags to new code, and never violate the Core-tier constraints.** The tags are a cage, not decoration.

Full spec: [references/docx-spec.md](references/docx-spec.md). Token cheat sheet: [references/token-reference.md](references/token-reference.md).

## Non-negotiable rules

1. **Structural types (`doctype`), language-aware.**
   - In most languages, **every variable and parameter — including locals you declare inside a function** (except `self`/`cls` and `_`) — starts with the structural shape prefix **defined in the canonical [token catalog](references/token-reference.md)** — load it if you don't have the prefixes memorized. A real type annotation, if present, must agree (`a_x: dict` is wrong). Never use `$`/`@`/`%` inside identifiers in these languages — invalid syntax.
   - **In Perl**, use the native `$`/`@`/`%` sigils — they are valid there and the validator expects them.
2. **Respect `docslim`.** Stay inside `max_lines`, `max_nested_depth`, `max_complexity`. If the task can't fit, stop and say so — don't blow the cap silently.
3. **Respect `docdeps`.** Only import from the whitelist (`@docdeps` plus anything inherited from `docx.json`). Propose adding a dependency rather than importing off-list.
4. **Respect `docpure`.** In a block marked `deterministic = true` or `mutates_state = false`, write no I/O (`print`, `open`, network) and no global mutation. (The validator catches obvious I/O only — don't rely on it to catch subtle side-effects; keep the block genuinely pure.) Put trace logging in a non-pure method.
5. **`doctest` must be real.** Executable examples that exercise real logic — never hardcode a return to match expected output.
6. **Keep prose tags fresh (they don't self-heal).** When you change code that carries prose tags (`docarch`, `docrisk`, `docrun`, `doctrace`, …), update those tags in the same edit — nothing enforces them, so a stale note silently lies. Never add `@docrule: suppress` to dodge a Core error under the vibe profile; it's ignored there anyway. Fix the code, not the tag.

## Phase-0 skeleton-contract handshake

Given a skeleton contract (signatures + tags, no bodies), **before writing any body**, emit a short JSON plan confirming each binding constraint, then implement:

```json
{ "file": "adapters/ledger_router.py",
  "understands": { "docslim": "audit: <=12 lines, depth <=2, complexity <=4",
                   "docdeps": "imports limited to app.crypto_layer, math",
                   "docpure": "audit is pure: no I/O", "doctest": "satisfy the 2 documented cases" },
  "plan": "compute cents with math.floor, compare to floor + signature, return dict" }
```

## Validate (always, before declaring done)

Run the tree-sitter Core-tier validator:

```bash
docx-pi <file...>            # human summary, exit 1 on violation
docx-pi --json <file...>     # machine-readable for CI/orchestration
docx-pi --changed [--base main]   # only files changed vs HEAD/base (scope to YOUR edits)
```

Or call the `docx_validate` tool with `{ "files": ["path"] }`. If it reports an error, **fix the code, not the tag** — unless the human approves a limit change.

Other commands: `docx-pi inventory <dir>` (Pass-1 facts), `docx-pi suggest-prefixes <dir>` (propose doctype renames), `docx-pi apply <file> <bp.json>` (safe tag insertion), `docx-pi state <file>` (token_state_matrix), `docx-pi mutate <file.py>` (hollow-test detection), `docx-pi docs <dir>` (living docs). HTML/CSS files are also validated (external-asset `docdeps` + inline/`!important` smells). `docx-pi help` lists everything.

## Vibe profile (low-ceremony mode)

For non-experts, run in the **vibe profile**: drop a `docx.json` with `"profile": "vibe"` at the repo root (copy `schema/docx.vibe.jsonc`), or pass `--profile vibe`. In this mode:

- Only the **Core, machine-checkable** tokens are enforced (`docslim`, `docdeps`, `docpure`, `doctype`, `doctest`). The prose tokens are not enforced — don't rely on them as governance.
- `docslim` caps come **only from `docx.json`**, not per-function `@docslim`. This is deliberate: the agent writing the code must not be able to relax its own budget. Set caps once, globally.
- To onboard a beginner, use `/docx-init` — you propose sensible defaults, they just approve. Never hand them a blank contract.

You (the agent) write and maintain the Core tags on every edit and run the validator before finishing. The user should not have to think about tags.

## Retrofitting existing code

Use `/docx-retrofit`. Three passes: (1) inventory (the validator's parse extracts functions/params/imports), (2) map tokens per file, (3) atomic file-by-file insertion. Never set `docslim` to a bloated function's current length — target a sane ceiling.

## Supported languages

Python, JavaScript, TypeScript, Go, Rust, Ruby, PHP are all implemented and verified. Vanilla HTML/CSS get external-asset `docdeps` + a couple of smell checks (no framework parsing). Perl uses native `$`/`@`/`%` sigils and needs a one-time grammar build (see `scripts/build-perl-grammar.md`).
