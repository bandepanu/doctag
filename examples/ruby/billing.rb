# @docdeps: allowed_imports = ["set"]
require "set"

# @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
# @docpure: deterministic = true, mutates_state = false
def audit(s_amount, d_ctx)
  s_cents = s_amount.to_i * 100
  return { outcome: "ALLOW", cents: s_cents } if d_ctx[:sign] == "valid"
  { outcome: "DENY", cents: s_cents }
end
