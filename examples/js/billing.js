// @docarch: component = "Billing"
// @docdeps: allowed_imports = ["node:crypto"]
import { createHash } from "node:crypto";

export class Billing {
  // @docslim: max_lines = 8, max_nested_depth = 2, max_complexity = 4
  // @docpure: deterministic = true, mutates_state = false
  audit(s_amount, d_ctx) {
    const s_cents = Math.floor(Number(s_amount) * 100);
    const s_ok = d_ctx["sign"] === "valid";
    if (s_cents >= 0 && s_ok) {
      return { outcome: "ALLOW", cents: s_cents };
    }
    return { outcome: "DENY", cents: s_cents };
  }

  // @doctrace: not pure — logs and hashes
  route(s_amount, d_ctx) {
    console.log("[BRIDGE] routing");
    const s_h = createHash("sha256").update(String(s_amount)).digest("hex");
    return this.audit(s_amount, { ...d_ctx, s_h });
  }
}
