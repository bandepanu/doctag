# ==============================================================================
# @docarch: component = "LedgerRouter", layer = "adapters"
# @docbiz: intent = "Authorize inbound settlement amounts within PCI scope"
# @doccomp: standard = "PCI-DSS v4.0", section = "3.2.2"
# @docdeps: allowed_imports = ["app.crypto_layer"]
# @docenv: platform = "linux/amd64", runtime = "python>=3.11", memory_limit_mb = 128
# @docref: inherit = ["global_invariants"]
# ==============================================================================
"""Corrected, valid-Python DocX example.

This is the enforcement doc's BalanceAuditor rewritten to actually parse, run,
and pass tools/validate_docx.py. The Perl-style sigils ($raw_amount,
%secure_context) are replaced with s_/a_/d_ structural prefixes; the "pure"
method no longer performs I/O; imports stay inside the docdeps whitelist.
"""
import math
import app.crypto_layer as crypto_layer


class BalanceAuditor:
    """Evaluates balances across untrusted ingestion endpoints.

    @docstring: lifecycle = "Active", stability = "Production"
    @docinv: self.s_floor_cents >= 0
    """

    def __init__(self, s_floor_cents: int = 0) -> None:
        self.s_floor_cents = s_floor_cents

    # @docperm: role_required = "ServiceAccount.Billing", auth = "OAuth2"
    # @docrisk: boundary = "External API -> Core Ledger", vector = "STRIDE.Tampering"
    # @docslim: max_lines = 12, max_nested_depth = 2, max_complexity = 4
    # @docpure: deterministic = true, mutates_state = false
    # @doctaint: source = "d_secure_context", status = "Untrusted"
    # @docpriv: classification = "PII.Financial", masking = "Full"
    def audit_transaction(self, s_raw_amount: str, d_secure_context: dict) -> dict:
        """Check a numeric boundary against the configured floor.

        @doctest:
            >>> BalanceAuditor().audit_transaction("1500.50", {"s_sign": "valid_signature"})
            {'outcome': 'ALLOW', 'audited_cents': 150050}
            >>> BalanceAuditor(200000).audit_transaction("1500.50", {"s_sign": "valid_signature"})
            {'outcome': 'DENY', 'audited_cents': 150050}
        """
        s_clean_cents = math.floor(float(s_raw_amount) * 100)
        s_signed = d_secure_context.get("s_sign") == "valid_signature"
        if s_clean_cents >= self.s_floor_cents and s_signed:
            return {"outcome": "ALLOW", "audited_cents": s_clean_cents}
        return {"outcome": "DENY", "audited_cents": s_clean_cents}

    # @doctrace: sequence hop -- deliberately NOT marked @docpure, since it does I/O
    # @docfail: fallback = "Reject_Tx", alert = "PagerDuty"
    # @docrun: triage = "run scripts/clear_stuck_db_locks.sh -id <tx>"
    def route(self, s_raw_amount: str, d_secure_context: dict) -> dict:
        """Trace-logged wrapper; tolerates malformed input."""
        print("[BRIDGE: adapters -> crypto_layer] routing")  # @doctrace
        s_verified = crypto_layer.validate_hash(d_secure_context.get("s_sign", ""))
        try:
            if s_verified:
                return self.audit_transaction(s_raw_amount, d_secure_context)
            return {"outcome": "DENY", "audited_cents": 0}
        except ValueError:
            return {"outcome": "REJECT", "audited_cents": 0}
