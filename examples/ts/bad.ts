// @docslim: max_lines = 3, max_nested_depth = 1, max_complexity = 2
// @docpure: deterministic = true
export function handle(amount: number, a_ctx: Map<string, number>): number {
  console.log("side effect");
  if (amount) {
    if (amount > 1) {
      return a_ctx.size;
    }
  }
  return 0;
}
