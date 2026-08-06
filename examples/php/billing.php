<?php
// @docdeps: allowed_imports = ["App\\Crypto"]
use App\Crypto;

class Billing {
  // @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
  // @docpure: deterministic = true, mutates_state = false
  public function audit(string $s_amount, array $a_items): array {
    $s_cents = (int)($s_amount * 100);
    if ($s_cents >= 0) {
      return ["outcome" => "ALLOW", "cents" => $s_cents];
    }
    return ["outcome" => "DENY", "cents" => $s_cents];
  }
}
