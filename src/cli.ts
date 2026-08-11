#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { validatePaths } from "./validate";
import { formatText } from "./core/report";
import { generateDocs } from "./docs/generate";
import { inventory } from "./inventory";
import { applyBlueprint } from "./apply";
import { tokenStateMatrix } from "./state";
import { mutate } from "./mutate";
import { suggestPrefixes } from "./suggest";

function f_ArgVal(rest: string[], flag: string, def?: string): string | undefined {
  const i = rest.indexOf(flag);
  return i !== -1 ? rest[i + 1] : def;
}

const SUPPORTED_EXTS = new Set([".py", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".go", ".rs", ".rb", ".php", ".pl", ".pm", ".html", ".htm", ".css"]);

function f_ChangedFiles(base?: string): string[] {
  // Fail CLOSED: if this isn't a git repo (or git is missing), throw — a gate that
  // can't determine the diff must not silently report "clean".
  try { execSync("git rev-parse --is-inside-work-tree", { stdio: "pipe" }); }
  catch { throw new Error("--changed needs a git repository (git not found, or not inside a repo)."); }
  const run = (cmd: string) => { try { return execSync(cmd, { encoding: "utf8" }); } catch { return ""; } };
  const out = run(`git diff --name-only --diff-filter=ACM ${base || "HEAD"}`);
  const staged = base ? "" : run(`git diff --name-only --cached --diff-filter=ACM`);
  const all = [...new Set((out + "\n" + staged).split(/\r?\n/).filter(Boolean))];
  return all.filter((f) => SUPPORTED_EXTS.has(path.extname(f).toLowerCase()) && fs.existsSync(f));
}

const HELP = `docx-pi — DocX validator & doc generator

USAGE
  docx-pi <file...> [--config docx.json] [--profile vibe] [--json]
  docx-pi --changed [--base <ref>]        validate only files changed vs HEAD (or <ref>)

COMMANDS
  <file...>            validate files (default): doctype, docslim, docdeps, docpure, docref
  docs <dir>           generate Markdown docs (+ diagrams) from prose tags   [--out FILE]
  inventory <dir>      dump functions/params/imports/metrics as JSON         [--out FILE]
  apply <file> <bp>    insert tag comments from a blueprint JSON (safe)
  state <file>         print the token_state_matrix (per-token PASS/FAIL)    [--config FILE]
  mutate <file.py>     mutation-test doctests (detect hollow tests)
  suggest-prefixes <dir>   propose doctype variable renames as JSON          [--out FILE]
  help                 show this

Languages: py js ts go rust rb php (+ perl when built) · html/css (deps + smells)`;

function f_CmdDocs(rest: string[]): void {
  const out = f_ArgVal(rest, "--out", "DOCX-DOCS.md")!;
  const dir = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--out") || ".";
  const { markdown, count } = generateDocs(dir);
  fs.writeFileSync(out, markdown);
  console.log(`docx-pi docs: scanned '${dir}', found ${count} annotation(s) -> ${out}`);
  process.exit(0);
}

async function f_CmdInventory(rest: string[]): Promise<void> {
  const out = f_ArgVal(rest, "--out", ".docx_inventory.json")!;
  const dir = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--out") || ".";
  const inv = await inventory(dir);
  fs.writeFileSync(out, JSON.stringify(inv, null, 2));
  const fns = inv.reduce((a, f) => a + f.functions.length, 0);
  console.log(`docx-pi inventory: ${inv.length} file(s), ${fns} function(s) -> ${out}`);
  process.exit(0);
}

function f_CmdApply(rest: string[]): void {
  const file = rest[0];
  const bp = JSON.parse(fs.readFileSync(rest[1], "utf8"));
  const r = applyBlueprint(file, bp);
  console.log(`docx-pi apply: inserted ${r.inserted} tag line(s) into ${r.file}`);
  process.exit(0);
}

async function f_CmdSuggest(rest: string[]): Promise<void> {
  const out = f_ArgVal(rest, "--out");
  const dir = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--out") || ".";
  const s = await suggestPrefixes(dir);
  const total = s.reduce((a, f) => a + f.renames.length, 0);
  const json = JSON.stringify(s, null, 2);
  if (out) { fs.writeFileSync(out, json); console.log(`docx-pi suggest-prefixes: ${total} rename(s) across ${s.length} file(s) -> ${out}`); }
  else console.log(json);
  process.exit(0);
}

async function f_CmdState(rest: string[]): Promise<void> {
  const file = rest.find((a, i) => !a.startsWith("--") && rest[i - 1] !== "--config")!;
  const m = await tokenStateMatrix(file, f_ArgVal(rest, "--config"));
  console.log(JSON.stringify(m, null, 2));
  process.exit(m.errors > 0 ? 1 : 0);
}

function f_ReportMutants(r: any): void {
  if (r.status === "no-doctests") { console.log(`docx-pi mutate: ${r.file} has no doctests to test against.`); return; }
  if (r.status === "baseline-failing") { console.log(`docx-pi mutate: ${r.file} doctests already fail — fix them first.`); return; }
  if (r.status === "all-killed") { console.log(`docx-pi mutate: ${r.file} — all mutants killed. Tests are real.`); return; }
  console.log(`docx-pi mutate: ${r.file} — ${r.mutants.length} SURVIVING mutant(s) (tests didn't catch these):`);
  for (const m of r.mutants) console.log(`  L${m.line}: '${m.original}' -> '${m.mutant}' still passed`);
}

async function f_CmdMutate(rest: string[]): Promise<void> {
  const file = rest.find((a) => !a.startsWith("--"))!;
  // Safety: mutate EXECUTES the file's doctests. Refuse by default on possibly-untrusted code.
  if (!rest.includes("--trust") && process.env.DOCX_TRUST !== "1") {
    console.error("docx-pi mutate runs this file's doctests AS CODE. Only do this on code you trust.");
    console.error("Re-run with --trust (or set DOCX_TRUST=1) to proceed.");
    process.exit(2);
  }
  const r = await mutate(file);
  f_ReportMutants(r);
  process.exit(r.mutants.length ? 1 : 0);
}

function f_ParseOptions(argv: string[]): { config?: string; profile?: "default" | "vibe"; asJson: boolean } {
  let config: string | undefined;
  const ci = argv.indexOf("--config");
  if (ci !== -1) config = argv[ci + 1];
  // Leave undefined unless explicitly set, so a docx.json can self-declare "profile": "vibe".
  let profile: "default" | "vibe" | undefined;
  const pi = argv.indexOf("--profile");
  if (pi !== -1) profile = argv[pi + 1] === "vibe" ? "vibe" : "default";
  return { config, profile, asJson: argv.includes("--json") };
}

async function f_CmdValidate(argv: string[]): Promise<void> {
  const { config, profile, asJson } = f_ParseOptions(argv);
  const flagValues = new Set(["--config", "--profile", "--base"]);
  let files = argv.filter((a, i) => !a.startsWith("--") && !flagValues.has(argv[i - 1]));

  // --changed [--base <ref>]: validate only files changed vs. HEAD (or a base branch),
  // so you can gate YOUR extension's edits without touching an updating upstream.
  if (argv.includes("--changed")) {
    const bi = argv.indexOf("--base");
    try {
      files = f_ChangedFiles(bi !== -1 ? argv[bi + 1] : undefined);
    } catch (e: any) {
      console.error("docx-pi:", e?.message || e);
      process.exit(2); // fail closed, not 0
    }
    if (!files.length) { console.log("docx-pi --changed: no changed source files (nothing to check)."); process.exit(0); }
  }

  if (!files.length) {
    console.error("Run 'docx-pi help' for usage.");
    process.exit(2);
  }

  const { reports, errors } = await validatePaths(files, config, { profile });
  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    const { text } = formatText(reports);
    console.log(text);
  }
  process.exit(errors > 0 ? 1 : 0);
}

async function f_Main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  if (cmd === "docs") return f_CmdDocs(rest);
  if (cmd === "inventory") return f_CmdInventory(rest);
  if (cmd === "apply") return f_CmdApply(rest);
  if (cmd === "suggest-prefixes") return f_CmdSuggest(rest);
  if (cmd === "state") return f_CmdState(rest);
  if (cmd === "mutate") return f_CmdMutate(rest);
  return f_CmdValidate(argv);
}

f_Main().catch((e) => {
  console.error("docx-pi error:", e?.message || e);
  process.exit(2);
});
