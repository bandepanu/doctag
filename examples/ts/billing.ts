// @docarch: component = "Billing"
export class Billing {
  // @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
  // @docpure: deterministic = true, mutates_state = false
  audit(s_amount: string, d_ctx: Map<string, number>): object {
    const s_cents = Math.floor(Number(s_amount) * 100);
    const s_ok = d_ctx.get("sign") === 1;
    if (s_cents >= 0 && s_ok) {
      return { outcome: "ALLOW", cents: s_cents };
    }
    return { outcome: "DENY", cents: s_cents };
  }
}
