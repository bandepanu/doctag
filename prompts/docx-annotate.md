---
name: docx-annotate
description: Add DocX tags to a file or build a Phase-0 skeleton contract.
---

Load the `docx` skill first. Target: $ARGUMENTS

1. Existing file: add the minimal correct tags (module: `docarch`/`docdeps`/`docenv`; class: `docinv`/`docstring`; method: `docslim`/`docpure`/`doctest`/`docperm`). Give variables structural prefixes (`s_/a_/d_`; native `$/@/%` in Perl) and make annotations agree. Prefer inheriting shared values via `# @docref: inherit = ["global_invariants"]`.
2. New functionality: produce a **skeleton contract** — signatures + docstrings + tags + a `doctest` contract, bodies left as `...`/`pass`. Choose realistic `docslim` caps (a sane ceiling, not padding).
3. Emit the Phase-0 JSON reflection plan, then implement bodies only if asked.
4. Run `docx-pi <file>` and report. Fix code, not tags, to clear errors.
