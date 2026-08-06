// Mutation-testing gate (Python doctests). The anti-"fake test" check: flip an operator
// in the code and re-run the doctests. If they still pass, the test never exercised that
// logic — a hollow test the agent could have gamed by hardcoding a return. Reports
// SURVIVING mutants. Python-only for now (uses `python -m doctest`).
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { getParser } from "./engine/parser";
import { python } from "./adapters/python";

const MUT: Record<string, string> = {
  "+": "-", "-": "+", "*": "//", "==": "!=", "!=": "==",
  "<": ">=", ">": "<=", "<=": ">", ">=": "<", and: "or", or: "and",
};
const OP_NODES = new Set(["binary_operator", "comparison_operator", "boolean_operator"]);

export interface Mutant { line: number; original: string; mutant: string; survived: boolean }

let PY: string | null = null;
function pyCmd(): string {
  if (PY) return PY;
  for (const c of ["python3", "python", "py"]) {
    try { execSync(`${c} --version`, { stdio: "pipe" }); PY = c; return c; } catch { /* try next */ }
  }
  PY = "python3";
  return PY; // fall back; the error will surface clearly
}

function runDoctest(source: string): boolean {
  // returns true if doctests PASS (exit 0)
  const tmp = path.join(os.tmpdir(), `docx_mut_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(tmp, source);
  try {
    execSync(`${pyCmd()} -m doctest ${tmp}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

export async function mutate(file: string): Promise<{ file: string; status: string; mutants: Mutant[] }> {
  const src = fs.readFileSync(file, "utf8");
  if (!/>>>/.test(src)) return { file, status: "no-doctests", mutants: [] };
  if (!runDoctest(src)) return { file, status: "baseline-failing", mutants: [] };

  const tree = (await getParser(python)).parse(src);
  const ops: { start: number; end: number; op: string; line: number }[] = [];
  (function walk(n: any) {
    if (OP_NODES.has(n.type)) {
      for (const c of n.children) {
        if (!c.isNamed && MUT[c.type] !== undefined) {
          ops.push({ start: c.startIndex, end: c.endIndex, op: c.type, line: c.startPosition.row + 1 });
        }
      }
    }
    for (const c of n.namedChildren) walk(c);
  })(tree.rootNode);

  const mutants: Mutant[] = [];
  for (const o of ops.slice(0, 60)) {
    const mutSrc = src.slice(0, o.start) + MUT[o.op] + src.slice(o.end);
    const survived = runDoctest(mutSrc); // still passes => test didn't catch the change
    if (survived) mutants.push({ line: o.line, original: o.op, mutant: MUT[o.op], survived });
  }
  return {
    file,
    status: mutants.length ? "survivors" : "all-killed",
    mutants,
  };
}
