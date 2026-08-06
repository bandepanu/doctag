// @docdeps: allowed_imports = ["std"]
use serde::Serialize;

// @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
// @docpure: deterministic = true
fn handle(amount: i64, d_items: Vec<String>) -> i64 {
    println!("side effect");
    if amount > 0 {
        if amount > 1 {
            return d_items.len() as i64;
        }
    }
    0
}
