---
name: docx-retrofit
description: Retrofit DocX tokens onto an existing, untagged codebase in three safe passes.
---

Onboard the directory: $ARGUMENTS (default: ./src). Load the `docx` skill first. Work in three passes; do not skip ahead.

**Pass 1 — Inventory (deterministic, tooled).** Run `docx-pi inventory <dir> --out .docx_inventory.json`. This uses the same tree-sitter engine as the validator to dump every function's signature, params, current metrics (lines/nesting/complexity), and imports — no LLM guessing about what exists. Use it to align variable names across modules so the same entity gets one consistent prefixed name.

**Pass 2 — Map (per file).** Read each file's source alongside `.docx_inventory.json`. Draft a per-file annotation blueprint of tag lines to insert above each function: `doctype` renames, `docarch`/`docrisk`/`doctaint` where warranted, and `docslim` caps set to a sane ceiling with headroom — **never** to a bloated function's current length (the inventory's `metrics` tell you what's bloated). Emit it as an apply blueprint: `[{ "line": <fn start>, "tags": ["@docarch: ...", "@docslim: max_lines = N"] }, ...]`.

**Pass 3 — Insert (tooled, safe).** Run `docx-pi apply <file> <blueprint.json>` — it inserts the tags as comments with correct indentation and never touches executable logic. Then run `docx-pi <file>` and confirm it passes before advancing. Do any `doctype` variable renames as normal edits (those change identifiers, so review them). Stop and report if a file fails to clear.
