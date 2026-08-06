---
name: docx-docs
description: Generate living architecture / ops / security docs from the DocX prose tags across the codebase.
---

Generate project documentation from DocX annotations for: $ARGUMENTS (default: the repo root).

1. Run `docx-pi docs <dir> --out DOCX-DOCS.md`. This scrapes every `@doc` prose tag (from source, HTML comments, config — any text file) and emits a single Markdown guide with a Mermaid architecture diagram, plus security, ops-runbook, data, and changelog sections. It never goes stale because it is regenerated from source.
2. Skim the output with the user. If the architecture diagram is sparse, that means the code lacks `@docarch: component = "...", relies_on = [...]` tags — offer to add them (this is also a good way for a non-expert to learn the shape of their own system).
3. Do not hand-edit the generated file; re-run the generator after code changes (or wire it into CI so the docs refresh on every push).
