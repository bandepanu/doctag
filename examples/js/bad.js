// @docdeps: allowed_imports = ["node:crypto"]
import fs from "node:fs";

// @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
// @docpure: deterministic = true
export function handle(amount, d_items) {
  console.log("side effect");
  if (amount) {
    if (amount > 1) {
      return d_items.length;
    }
  }
  return 0;
}
