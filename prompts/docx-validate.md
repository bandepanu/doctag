---
name: docx-validate
description: Run the DocX tree-sitter validator on files and explain any violations.
---

Run the DocX validator on: $ARGUMENTS  (default to files changed in the working tree if none given).

1. Execute `docx-pi --json <files>` (or call the `docx_validate` tool) and parse the report.
2. For each error, explain in one line the constraint and why the code violates it (`docslim` lines/nesting/complexity, `docdeps` unlisted import, `doctype` missing/mismatched prefix or missing Perl sigil, `docpure` I/O, `docref` unresolved).
3. Propose the **code** fix, not a tag relaxation — unless the limit is genuinely wrong, in which case flag it for human approval before editing any `docx.json` or `@doc` value.
4. Re-run until exit code 0, then confirm compliance. Do not mark work complete while any error-level finding remains.
