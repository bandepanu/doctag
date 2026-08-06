// @docarch: component = "AuthHook", layer = "hooks", relies_on = ["pocketbase"]
// @docrisk: boundary = "public /api/login -> users collection", vector = "STRIDE.Spoofing"
// @docrun: triage = "tail pb logs; check auth rate-limit; restart pocketbase"
// @docdeps: allowed_imports = ["pocketbase"]
// @docslim: max_lines = 12, max_nested_depth = 2, max_complexity = 4
// @docpure: deterministic = false
function onLogin(d_ctx) {
  console.log("[BRIDGE: api -> users] login attempt");
  return d_ctx;
}
