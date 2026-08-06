# @docdeps: allowed_imports = ["math"]
# A deliberately non-compliant file: run the validator on it to see the Core
# checks fire. Expected violations: docdeps, doctype, docslim, docpure.
import os  # not in whitelist -> docdeps error


class Sloppy:
    # @docslim: max_lines = 4, max_nested_depth = 1, max_complexity = 3
    # @docpure: deterministic = true, mutates_state = false
    def handle(self, raw_amount, d_ctx: list):        # missing prefix on 'raw_amount'; d_ vs list
        print("side effect")                          # docpure: I/O
        if raw_amount:
            if raw_amount > 10:                        # nesting depth 2 > 1
                for _ in range(raw_amount):            # extra complexity + more lines
                    raw_amount -= os.getpid()
        return raw_amount
