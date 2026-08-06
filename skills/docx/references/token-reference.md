# DocX Token Catalog — canonical

**Single source of truth** for the token vocabulary, structural prefixes, and thresholds. The spec ([docx-spec.md](docx-spec.md)) explains the *concepts* (tiers, timelines, enforcement, cascade) and links here for the catalog — it does not restate this list. Tier: **C** = Core (enforced by the validator), **E** = Extended (documentary / generated). Phase: **D** = design-time, **R** = run-time.

## Structural type prefixes (the `doctype` layer)

Every variable and parameter name (except `self`/`cls`) begins with exactly one prefix + underscore — never omit it. In **Perl**, the native `$`/`@`/`%` sigils are used instead (they're valid there). A real type annotation, when present, must agree with the prefix; the validator reports a conflict like `a_totals: dict`.

| Prefix | Shape | Concrete types |
|--------|-------|----------------|
| `s_` | Scalar (text / number / null) | `str`, `int`, `float`, `None` |
| `b_` | Boolean | `bool` (`True`/`False`) |
| `a_` | Array / sequence | `list`, `tuple`, `set` |
| `d_` | Dictionary / hash | `dict` |
| `m_` | Match object | regex match results |
| `f_` | Function / callable | `def`, `lambda`, callable references |
| `o_` | Object / stream | open files, sockets, external class instances |
| `p_` | Pointer / reference — **Go/Rust/C-family only** | `*T`, `&T` (in other languages, not applicable) |

`b_` splits out of `s_` because booleans drive control flow and every type system can verify them. `p_` applies only where pointers/references are a real, type-visible shape (Go/Rust/C/C++); elsewhere it's simply unused. (Two prefixes were deliberately rejected: `j_` for JSON — a JSON payload is structurally a string, so it's `s_`/`d_`, not its own shape; and `g_` for globals — scope is orthogonal to shape and unverifiable, so use `ALL_CAPS` for globals instead.)

## Core tokens (enforced)

| Tier/Phase | Token | Meaning / what it enforces | Example |
|---|---|---|---|
| C·D | `doctype` | Structural shape via prefixes; prefix ↔ annotation agreement | `def f(self, s_id: str, d_payload: dict) -> dict:` |
| C·D | `docslim` | Volumetric caps: body lines, nesting depth, branch complexity | `# @docslim: max_lines = 12, max_nested_depth = 2, max_complexity = 4` |
| C·D | `docdeps` | Import whitelist — every import must resolve to it | `# @docdeps: allowed_imports = ["math", "sys", "app.crypto_layer"]` |
| C·D | `docpure` | Purity assertion — bans I/O / global mutation in the block | `# @docpure: deterministic = true, mutates_state = false` |
| C·R | `doctest` | Executable functional contract in the docstring | `>>> BalanceAuditor().audit("1500.50", ctx)` |
| C·R | `docinv` | Class invariant — boolean over object state that must hold | `# @docinv: self.s_balance == sum(self.a_history)` |
| C·D | `docref` | Inheritance link to a `docx.json` block (the DRY mechanism) | `# @docref: inherit = ["global_invariants", "src/adapters/*"]` |

## Extended tokens (documentary / generated)

| Tier/Phase | Token | Meaning | Example |
|---|---|---|---|
| E·D | `docstring` | High-level interface / usage description | `@docstring: lifecycle = "Active", stability = "Production"` |
| E·D | `docarch` | Component / layer / topology (feeds architecture diagram) | `# @docarch: component = "LedgerRouter", layer = "DataIngression"` |
| E·D | `docbiz` | Business intent — the "why" | `# @docbiz: intent = "Settle B2B invoices within SLA"` |
| E·D | `docspec` | Acceptance behavior, Given/When/Then | `# @docspec: given = "valid token", when = "charge", then = "ALLOW"` |
| E·D | `docrisk` | Threat model: trust boundary, STRIDE vector | `# @docrisk: boundary = "External API -> Core", vector = "STRIDE.Tampering"` |
| E·D | `doccomp` | Mapping to external regulation | `# @doccomp: standard = "PCI-DSS v4.0", section = "3.2.2"` |
| E·D | `docperm` | Authorization: roles, ACLs, auth scheme | `# @docperm: role_required = "ServiceAccount.Billing", auth = "OAuth2"` |
| E·D | `doctaint` | Data-flow taint: untrusted source / sanitizer / sink | `# @doctaint: source = "d_payload", status = "Untrusted"` |
| E·D | `docpriv` | PII field classification and masking | `# @docpriv: classification = "PII.Financial", masking = "Full"` |
| E·D | `docrule` | Documented local exception to global lint/style policy | `# @docrule: exception = "no-print", reason = "structured audit line"` |
| E·D | `docmock` | Permitted mocking footprint / fixtures (test-time only) | `# @docmock: ledger_db = "sandbox/mocks/ledger_db.sql"` |
| E·D | `docsub` | Behavioral subtyping (Liskov) — constrains an override | `# @docsub: mode = "Extend", target = "AccountLedger", override = "process_credit"` |
| E·R | `doctrace` | Sequence-hop marker (feeds sequence diagram) | `print("[BRIDGE: Ingress -> Crypto] routing")  # @doctrace` |
| E·R | `docfail` | Failure / resilience mapping: fallback, alert | `# @docfail: fallback = "Reject_Tx", alert = "PagerDuty"` |
| E·R | `docrun` | Operational runbook: triage commands | `# @docrun: triage = "run scripts/clear_stuck_db_locks.sh -id <id>"` |
| E·R | `docmet` | Runtime performance budgets | `# @docmet: latency_budget_ms = 150, max_memory_mb = 64` |
| E·R | `docchg` | Change ledger: deprecations, migration path | `# @docchg: deprecated_since = "v2.4.0", removal = "v3.0.0", migrate_to = "execute_transfer"` |
| E·D | `doccfg` | Application configuration values / IaC properties | `# @doccfg: log_level = "INFO", retry_max = 3` |
| E·D | `docenv` | *Required* runtime invariants to build/run safely | `# @docenv: platform = "linux/amd64", runtime = "python>=3.11", memory_limit_mb = 128` |
| E·D | `docdev` | Local developer bootstrap / sandbox onboarding | `# @docdev: bootstrap = "make dev", mock = "sandbox/mocks/ledger_db.sql"` |
| E·D | `docdata` | Data lineage: schema origin and analytical sink | `# @docdata: origin = "kafka.payments", sink = "warehouse.fct_tx"` |
| E·D | `doccost` | Cloud FinOps budget per workload | `# @doccost: max_spend_per_million_calls = 0.05` |
| E·D | `docux` | UI contract: component → layout / WCAG | `# @docux: component = "CheckoutButton", wcag = "AA", layout = "grid.primary"` |

## Token boundaries (where they overlap)

The token set is **not** MECE — some tokens overlap by design, and "collectively exhaustive across all of software" is not a property any fixed list can hold. Read the following as the intended boundaries:

- **Security cluster** (`docrisk` / `doccomp` / `docperm` / `doctaint` / `docpriv`): overlapping facets of one concern, not a partition. Use the one that names the fact you're recording.
- **Environment tokens**: `doccfg` = config *values*; `docenv` = *required* runtime invariants; `docdev` = local dev bootstrap; `docmock` = test-time mocking only.
- **`docsub`**: partly enforceable — the validator can flag an override that *adds* a precondition, but full contract inference is out of scope for v0.1.

## Choosing `docslim` thresholds (they're not arbitrary)

Two of the three map to established, documented software metrics; one is taste:

- **`max_complexity`** = McCabe **cyclomatic complexity** (1976), the number of independent paths through a function. Tool-backed: classic guidance ≤10; ESLint `complexity` defaults to 20, SonarQube to 15. Vibe default **8** is deliberately stricter/clearer.
- **`max_nested_depth`** = block nesting. ESLint `max-depth` defaults to 4; deep nesting is a known smell. Default **3**.
- **`max_lines`** = function body length. Least standardized (Clean Code ~20, ESLint `max-lines-per-function` 50). Default **40** is a moderate middle; tune freely.

`max_complexity` and `max_nested_depth` have decades of literature and linter precedent; `max_lines` is a judgment call. Start loose, tighten as you learn the feel.
