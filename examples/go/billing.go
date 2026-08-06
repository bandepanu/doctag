package main

// @docarch: component = "Billing"
// @docdeps: allowed_imports = ["math"]
import "math"

// @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
// @docpure: deterministic = true, mutates_state = false
func Audit(s_amount float64, d_ctx map[string]string) map[string]interface{} {
	s_cents := int(math.Floor(s_amount * 100))
	s_ok := d_ctx["sign"] == "valid"
	if s_cents >= 0 && s_ok {
		return map[string]interface{}{"outcome": "ALLOW", "cents": s_cents}
	}
	return map[string]interface{}{"outcome": "DENY", "cents": s_cents}
}
