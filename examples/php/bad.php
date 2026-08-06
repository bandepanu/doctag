<?php
// @docdeps: allowed_imports = ["App\\Crypto"]
use App\Logger;

// @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
// @docpure: deterministic = true
function handle(int $amount, array $d_items): int {
  echo "side effect";
  if ($amount) {
    if ($amount > 1) {
      return count($d_items);
    }
  }
  return 0;
}
