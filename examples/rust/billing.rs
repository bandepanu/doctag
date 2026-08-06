// @docdeps: allowed_imports = ["std"]
use std::cmp::max;

// @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
// @docpure: deterministic = true, mutates_state = false
fn audit(s_amount: i64, a_items: Vec<String>) -> i64 {
    let s_cents = max(s_amount, 0);
    if s_cents >= 0 {
        return s_cents + a_items.len() as i64;
    }
    0
}
