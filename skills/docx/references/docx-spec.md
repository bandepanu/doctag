# The DocX Framework — Consolidated Specification

**Version:** 0.1 (bundle for the [pi](https://pi.dev/) coding-agent harness)
**Status:** Working specification. Supersedes the five source drafts (base framework doc, enforcement doc, and deltas 1–3).

DocX embeds a system's knowledge — types, tests, architecture, security, ops, and lifecycle — directly in source files as standardized comment tags, so that one Git commit updates the code and everything that describes it. The goal is a single point of truth (DRY applied to the whole engineering lifecycle) and a design-time cage that keeps an AI coding agent from producing "slop": bloated, hallucinated, or structurally fragile code.

This consolidated spec makes three deliberate changes to the source drafts. They are called out in full in [§7 What changed and why](#7-what-changed-and-why); read that section if you are comparing against the originals.

---

## 1. Design principles

DocX rests on four ideas carried over from the base framework doc, which remain the strongest parts of the paradigm:

**Knowledge-as-code.** Every lifecycle fact is declared exactly once, inline, next to the code it governs. When the code changes, its tags change in the same commit, so documentation cannot drift.

**Two timelines.** Tags are processed either at **design time** (static parsing of the file at rest — AST/regex) or at **run time** (dynamic observation of the executing process). Every token below is classified into one of these phases. This split, not a flat token list, is the primary organizing frame.

**V-Model symmetry.** Each decomposition/design token on the left of the systems-engineering V has a matching verification token on the right (e.g. `docarch` ↔ `doctrace`, `docstring` ↔ `doctest`).

**Shift-left enforcement (Phase 0).** Enforcement moves from a late CI gate to task-planning time. A human or orchestrator writes a *skeleton contract file* (signatures + tags, no logic); the agent must read it and confirm the constraints *before* it earns write access to the function body. See [§5](#5-enforcement-pipeline).

---

## 2. Syntax

### 2.1 Tag form

A DocX tag is a source comment of the form:

```
# @doctoken: key = value, key = value, ...
```

Tags may sit at module, class, or method scope, and stack (multiple lines of the same token are allowed). The parser reads them from the raw source text; they never affect execution. The `@` sigil and `doc` prefix make them cheap to extract with a single regex: `@(doc[a-z]+)\s*:\s*(.*)`.

Values are a permissive `key = value` list. Where a value is structured (lists, numbers), use JSON-ish literals: `allowed_imports = ["math", "sys"]`, `max_lines = 12`.

### 2.2 Structural type prefixes (the `doctype` layer)

The source drafts declared types with Perl-style sigils (`$scalar`, `@list`, `%map`) placed *inside identifiers* — e.g. `def execute_transfer(self, $user_id)`. **That syntax is not valid in Python or most languages** and cannot be parsed, executed, or doctested. This spec replaces it with a lowercase single-letter **prefix + underscore** convention that is a legal identifier everywhere and survives copy-paste. The prefix declares *coarse structural shape*; a real type annotation, when present, declares the *precise* type, and the validator checks they agree.

> The **canonical prefix table** (prefix → shape → concrete types) and the full token catalog live in **[token-reference.md](token-reference.md)** — the single source of truth. This spec does not restate them.

Example — the same signature the drafts wrote as `execute_transfer(self, $user_id, %account_payload)` becomes valid code:

```python
def execute_transfer(self, s_user_id: str, d_account_payload: dict) -> dict:
    ...
```

---

## 3. Token taxonomy

Tokens are split into two tiers. This tiering **replaces the source drafts' claim of a "MECE, 25-token, completely closed loop."** Several tokens genuinely overlap (the security cluster especially), and "collectively exhaustive across all of software" is not a property any fixed list can hold. Honesty here is the point of the framework, so the spec states what each token can *actually* enforce.

- **Core (enforced).** Machine-checkable today by the bundled validator. These carry the anti-slop weight. Adopt these first.
- **Extended (generated / documentary).** Parsed to produce diagrams, audits, and runbooks, but not hard-enforced. Adopt as needed; unused ones should be omitted rather than left as decoration.

The **full catalog** — every Core and Extended token with tier, phase, meaning, example, and the overlap/boundary notes (the security cluster and the four environment tokens are *not* mutually exclusive) — is maintained once, in **[token-reference.md](token-reference.md)**. It is not duplicated here.

---

## 4. The two timelines

```
              ┌───────────────────────────────┐
              │   Unified source file          │
              │   code + doctype + docX tags   │
              └───────────────┬────────────────┘
                              │
          ┌───────────────────┴────────────────────┐
          ▼ (static parse: AST/regex)               ▼ (dynamic: hooks/traces)
   DESIGN / CODE TIME                         RUN / EXECUTION TIME
   docstring docarch doccfg docrisk           doctest doctrace docfail
   doccomp docperm docdev docchg docdeps       doctaint docmet docrun
   docslim docpure doctype docref              docinv docpriv
```

Design-time tools scrape `docarch`/`docrisk`/`doccomp` into architecture diagrams, threat models, and compliance matrices, and run the Core checks. Run-time tools evaluate `doctest`, watch `doctrace` to draw sequence diagrams, enforce `doctaint` sinks, and check `docinv` around public calls.

---

## 5. Enforcement pipeline

Three horizons, from the enforcement doc, retained:

**Phase 0 — Task planning.** A skeleton contract file is authored: signatures, `docstring`, structural bounds (`docarch`, `docdeps`), volumetric caps (`docslim`), purity (`docpure`), and the `doctest` contract — but no execution logic. The agent reads it and, *before writing the body*, emits a structured JSON plan confirming it understands each binding constraint (e.g. "12-line budget under docslim; no network under docpure; imports limited to math, sys"). This is the "pre-flight reflection hook." A ready-to-use prompt for it ships in `prompts/docx-annotate.md`.

**Phase 1 — Real-time IDE.** An LSP parses tags on each keystroke: exceeding `max_lines`, or importing outside `docdeps`, surfaces as an editor error before the code is ever committed. *(Not built in v0.1 — the validator provides the same checks as a pre-commit/CI step.)*

**Phase 2 — CI gate.** The `docx-pi` CLI runs the Core checks and exits non-zero on violation (wire it via `hooks/pre-commit` or `ci/docx.yml`; scope to your own edits with `--changed`). The **mutation-testing** idea from the source *is* shipped: `docx-pi mutate` sabotages operators and re-runs the `doctest` blocks to catch tests that pass against hardcoded returns (Python). One enforcement idea remains a documented extension, not shipped: network-less sandbox compilation scoped to `docdeps`.

---

## 6. Metadata cascade (`docx.json`)

To keep shared invariants DRY across files, global metadata lives in a root `docx.json` and is inherited automatically, CSS-like:

- `global_invariants` — system-wide defaults (compliance standard, runtime, core import whitelist).
- `directory_overrides` — per-glob overrides (e.g. `src/adapters/*` gets an external-ingestion trust boundary).
- A file opts into a block with `# @docref: inherit = ["global_invariants", "src/adapters/*"]`.

Resolution order (lowest → highest precedence): `global_invariants` → matching `directory_overrides` → file-level tags. A file-level tag always wins over an inherited one. A config may also carry `profile` ("vibe") and `include`/`exclude` globs (scoping). Full schema in `schema/docx.schema.json`; worked, commented example in `schema/docx.vibe.jsonc` (and one per folder under `examples/`). Change PCI-DSS v4.0 → v5.0 in one place and every file's inherited assertion updates.

---

## 7. What changed and why

Three substantive corrections were made turning the drafts into this spec:

1. **Invalid sigil syntax → prefix convention.** `$`/`@`/`%` inside identifiers do not parse. Replaced with the structural prefix convention ([§2.2](#22-structural-type-prefixes-the-doctype-layer); canonical set in [token-reference.md](token-reference.md)), valid identifiers in every language, making the code examples and doctests actually runnable.

2. **"MECE / complete / 25 tokens" → Core + Extended tiers.** The drafts declared completeness at 19, then 24, then 25/30 tokens while several overlapped. Replaced with an honest two-tier model that separates what is *enforced* from what is *generated*, and drops the exhaustiveness claim ([§3](#3-token-taxonomy)).

3. **Asserted tooling → working tools.** The drafts describe linters, LSPs, sandboxes, and mutation testers as if they exist. This bundle ships real ones — a multi-language tree-sitter validator, a documentation generator, a retrofit `inventory`/`apply` pair, and a mutation-testing gate — and clearly labels the few genuine future extensions (real-time LSP, network-less sandbox) rather than faking them ([§5](#5-enforcement-pipeline)).

Dangling tokens from the drafts (`docbiz`, `docspec`, `docrule`) that were referenced but never defined are given definitions in [§3.2](#32-extended-tokens-generated--documentary).
