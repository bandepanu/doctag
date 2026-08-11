import * as fs from "node:fs";
import * as path from "node:path";
import { Finding, FileReport, LanguageAdapter } from "./core/types";
import { parseTags, parseKv, Tag } from "./core/tags";
import { findConfig, resolveInherited, docrefValid, loadConfig, DocxConfig } from "./core/cascade";
import { adapterForFile } from "./adapters";
import { checkHtml } from "./html";
import { checkCss } from "./css";
import { getParser } from "./engine/parser";
import {
  findFunctions, nestingDepth, complexity, bodyLineCount, collectCalls, collectImports, headerLines,
} from "./engine/metrics";

const PREFIX_RE = /^[sabdmfop]_/;  // s_ b_ a_ d_ m_ f_ o_ p_
const SIGIL_RE = /^[$@%]/;

function f_Allowed(s_m: string, a_wl: string[]): boolean {
  return a_wl.some((s_e) => s_m === s_e || s_m.startsWith(s_e + "."));
}

export interface ValidateOptions {
  /** "vibe" = Core-only + docslim caps taken ONLY from the docx.json cascade,
   *  ignoring per-function @docslim headers so the code-writing agent can't set
   *  its own bar. "default" honors per-function overrides. */
  profile?: "default" | "vibe";
}

// --- HTML/CSS: no functions to police, so docdeps guards external assets ---
function f_ValidateWeb(s_file: string, s_src: string, a_lines: string[], s_ext: string, s_explicit?: string): FileReport {
  const s_cfgPath = findConfig(s_file, s_explicit);
  const a_wl: string[] = [];
  let s_cfgStr: string | null = null;
  if (s_cfgPath && fs.existsSync(s_cfgPath)) {
    const d_config = loadConfig(s_cfgPath);
    let s_rel = path.resolve(s_file);
    try { s_rel = path.relative(path.dirname(path.resolve(s_cfgPath)), s_rel).split(path.sep).join("/"); } catch { s_rel = path.basename(s_file); }
    a_wl.push(...(((resolveInherited(d_config, s_rel).docdeps || {}).allowed_imports as string[]) || []));
    s_cfgStr = s_cfgPath;
  }
  for (const s_ln of a_lines) {
    const m_hit = s_ln.match(/@docdeps\s*:\s*(.*?)(?:-->|\*\/)?\s*$/);
    if (m_hit) { const d_kv = parseKv(m_hit[1]); if (Array.isArray(d_kv.allowed_imports)) a_wl.push(...d_kv.allowed_imports); }
  }
  const a_uniq = [...new Set(a_wl)];
  const a_hf = s_ext === ".css" ? checkCss(s_src, a_uniq) : checkHtml(s_src, a_uniq);
  return { file: s_file, meta: { config: s_cfgStr, adapter: s_ext === ".css" ? "css" : "html", whitelist: a_uniq }, findings: a_hf, errors: a_hf.filter((o_f) => o_f.level === "error").length, warnings: a_hf.filter((o_f) => o_f.level === "warning").length };
}

// --- @docref inheritance resolution ---
function f_ValidateDocrefs(a_tags: Tag[], d_config: DocxConfig, a_findings: Finding[]): void {
  for (const o_t of a_tags) {
    if (o_t.token !== "docref") continue;
    for (const s_key of (o_t.kv.inherit as string[]) || []) {
      if (!docrefValid(d_config, s_key)) {
        a_findings.push({ level: "warning", token: "docref", line: o_t.line, message: `@docref inherits '${s_key}' but no such block in docx.json` });
      }
    }
  }
}

// single import module against the whitelist
function f_CheckMod(s_mod: string, o_imp: any, a_wl: string[], a_findings: Finding[]): void {
  if (/^[.\/]/.test(s_mod)) return; // relative/local import — your own code
  if (!f_Allowed(s_mod, a_wl)) {
    a_findings.push({ level: "error", token: "docdeps", line: o_imp.startPosition.row + 1, message: `import '${s_mod}' not in docdeps whitelist [${[...new Set(a_wl)].sort().join(", ")}]` });
  }
}

// --- @docdeps whitelist (inherited + module-level tags) on imports ---
function f_ValidateDocdeps(o_root: any, a_tags: Tag[], d_inherited: Record<string, Record<string, any>>, o_adapter: LanguageAdapter, a_findings: Finding[]): string[] {
  const a_wl: string[] = [...(((d_inherited.docdeps || {}).allowed_imports as string[]) || [])];
  for (const o_t of a_tags) if (o_t.token === "docdeps" && Array.isArray(o_t.kv.allowed_imports)) a_wl.push(...o_t.kv.allowed_imports);
  if (a_wl.length) {
    for (const o_imp of collectImports(o_root, o_adapter.nodeTypes.import)) {
      for (const s_mod of o_adapter.importModules(o_imp)) {
        f_CheckMod(s_mod, o_imp, a_wl, a_findings);
      }
    }
  }
  return [...new Set(a_wl)].sort();
}

// one variable's prefix/sigil + annotation agreement
function f_CheckDoctypeName(o_p: any, o_adapter: LanguageAdapter, a_findings: Finding[]): void {
  if (o_adapter.doctypeMode === "sigil") {
    if (!SIGIL_RE.test(o_p.name)) {
      a_findings.push({ level: "error", token: "doctype", line: o_p.line, message: `variable '${o_p.name}' lacks a Perl sigil ($/@/%)` });
    }
    return;
  }
  if (o_adapter.doctypeMode !== "prefix") return;
  if (!PREFIX_RE.test(o_p.name)) {
    a_findings.push({ level: "error", token: "doctype", line: o_p.line, message: `name '${o_p.name}' has no structural prefix (s_/b_/a_/d_/m_/f_/o_/p_)` });
    return;
  }
  if (o_p.annotation) {
    const s_expected = o_adapter.annotationPrefix(o_p.annotation);
    if (s_expected && s_expected !== o_p.name.slice(0, 2)) {
      a_findings.push({ level: "error", token: "doctype", line: o_p.line, message: `'${o_p.name}' is prefixed '${o_p.name.slice(0, 2)}' but annotated '${o_p.annotation}' (expected '${s_expected}')` });
    }
  }
}

// --- @doctype: strict prefix/sigil + annotation agreement, deduped by name ---
function f_ValidateDoctype(o_fn: any, o_adapter: LanguageAdapter, a_findings: Finding[]): void {
  const a_seen = new Set<string>();
  for (const o_p of [...o_adapter.params(o_fn), ...o_adapter.locals(o_fn)]) {
    if (o_p.name === "self" || o_p.name === "cls" || o_p.name.startsWith("_") || a_seen.has(o_p.name)) continue;
    a_seen.add(o_p.name);
    f_CheckDoctypeName(o_p, o_adapter, a_findings);
  }
}

// --- @docslim caps (cascade, or cascade + per-function header unless vibe) ---
function f_SlimCap(a_findings: Finding[], s_name: string, s_label: string, s_suffix: string, s_capName: string, s_actual: number, s_cap: number | undefined, s_row: number): void {
  if (typeof s_cap !== "number") return;
  if (s_actual > s_cap) {
    a_findings.push({ level: "error", token: "docslim", line: s_row, message: `${s_name}: ${s_label} ${s_actual}${s_suffix} > ${s_capName} ${s_cap}` });
  }
}

function f_HeaderTag(s_token: string, a_tags: Tag[], a_lines: string[], o_adapter: LanguageAdapter, s_fnRow: number): Record<string, any> | null {
  const o_hl = headerLines(s_fnRow, a_lines, o_adapter.commentLine);
  let d_found: Record<string, any> | null = null;
  for (const o_t of a_tags) if (o_t.token === s_token && o_hl.has(o_t.line)) d_found = o_t.kv;
  return d_found;
}

function f_ValidateDocslim(o_fn: any, a_lines: string[], a_tags: Tag[], d_inherited: Record<string, Record<string, any>>, b_vibe: boolean, o_adapter: LanguageAdapter, a_findings: Finding[]): void {
  const s_name = o_adapter.functionName(o_fn);
  const d_local = f_HeaderTag("docslim", a_tags, a_lines, o_adapter, o_fn.startPosition.row);
  const d_slim = b_vibe ? { ...(d_inherited.docslim || {}) } : { ...(d_inherited.docslim || {}), ...(d_local || {}) };
  if (b_vibe && d_local && Object.keys(d_inherited.docslim || {}).length) {
    a_findings.push({ level: "warning", token: "docslim", line: o_fn.startPosition.row + 1, message: `${s_name}: per-function @docslim ignored under vibe profile (caps come from docx.json)` });
  }
  const s_lines = bodyLineCount(o_adapter.bodyNode(o_fn), a_lines, o_adapter.commentLine);
  const s_depth = nestingDepth(o_fn, o_adapter.nodeTypes.block);
  const s_cmplx = complexity(o_fn, o_adapter.nodeTypes.branch);
  f_SlimCap(a_findings, s_name, "body", " lines", "max_lines", s_lines, d_slim.max_lines, o_fn.startPosition.row + 1);
  f_SlimCap(a_findings, s_name, "nesting depth", "", "max_nested_depth", s_depth, d_slim.max_nested_depth, o_fn.startPosition.row + 1);
  f_SlimCap(a_findings, s_name, "complexity", "", "max_complexity", s_cmplx, d_slim.max_complexity, o_fn.startPosition.row + 1);
}

// one call against a pure block's I/O + network rules
function f_CheckCall(o_call: any, o_adapter: LanguageAdapter, a_findings: Finding[]): void {
  const s_cn = o_adapter.callName(o_call);
  if (!s_cn) return;
  if (o_adapter.ioNames.includes(s_cn)) {
    a_findings.push({ level: "error", token: "docpure", line: o_call.startPosition.row + 1, message: `impure I/O call '${s_cn}(...)' in a block marked pure/deterministic` });
  } else if (o_adapter.netNames.includes(s_cn.split(".")[0])) {
    a_findings.push({ level: "error", token: "docpure", line: o_call.startPosition.row + 1, message: `network call via '${s_cn}' in a pure/deterministic block` });
  }
}

// --- @docpure: no I/O or network calls in deterministic/pure blocks ---
function f_ValidateDocpure(o_fn: any, a_tags: Tag[], a_lines: string[], o_adapter: LanguageAdapter, a_findings: Finding[]): void {
  const d_pure = f_HeaderTag("docpure", a_tags, a_lines, o_adapter, o_fn.startPosition.row);
  if (d_pure && (d_pure.deterministic === true || d_pure.mutates_state === false)) {
    for (const o_call of collectCalls(o_fn, o_adapter.nodeTypes.call)) {
      f_CheckCall(o_call, o_adapter, a_findings);
    }
  }
}

// collect the names a @docrule wants suppressed
function f_CollectSuppress(a_tags: Tag[]): Set<string> {
  const a_suppress = new Set<string>();
  for (const o_t of a_tags) {
    if (o_t.token !== "docrule" || !Array.isArray(o_t.kv.suppress)) continue;
    for (const s_s of o_t.kv.suppress) a_suppress.add(String(s_s));
  }
  return a_suppress;
}

// --- @docrule: a documented policy exception downgrades errors to warnings ---
function f_ApplyDocrule(a_tags: Tag[], b_vibe: boolean, a_findings: Finding[]): void {
  const a_suppress = f_CollectSuppress(a_tags);
  if (!a_suppress.size) return;
  if (b_vibe) {
    a_findings.push({ level: "warning", token: "docrule", line: 1, message: `@docrule suppression of [${[...a_suppress].join(", ")}] is IGNORED under the vibe profile (an agent cannot unlock its own cage)` });
  } else {
    for (const o_f of a_findings) {
      if (o_f.level === "error" && a_suppress.has(o_f.token)) {
        o_f.level = "warning";
        o_f.message += " (f_Allowed by @docrule)";
      }
    }
  }
}

export async function validateFile(s_file: string, s_explicit?: string, o_opts: ValidateOptions = {}): Promise<FileReport> {
  let b_vibe = o_opts.profile === "vibe";
  const a_findings: Finding[] = [];
  const s_src = fs.readFileSync(s_file, "utf8");
  const a_lines = s_src.split(/\r?\n/);

  // HTML/CSS have no functions to police; route to the web-asset checker.
  const s_ext = path.extname(s_file).toLowerCase();
  if (s_ext === ".html" || s_ext === ".htm" || s_ext === ".css") {
    return f_ValidateWeb(s_file, s_src, a_lines, s_ext, s_explicit);
  }

  const o_adapter = adapterForFile(s_file);
  if (!o_adapter) {
    return { file: s_file, meta: { config: null, adapter: null, whitelist: [] }, findings: a_findings, errors: 0, warnings: 0 };
  }

  // --- cascade ---
  const s_cfgPath = findConfig(s_file, s_explicit);
  let d_config: DocxConfig = {};
  let d_inherited: Record<string, Record<string, any>> = {};
  if (s_cfgPath && fs.existsSync(s_cfgPath)) {
    d_config = loadConfig(s_cfgPath);
    let s_rel = path.resolve(s_file);
    try { s_rel = path.relative(path.dirname(path.resolve(s_cfgPath)), s_rel).split(path.sep).join("/"); } catch { s_rel = path.basename(s_file); }
    d_inherited = resolveInherited(d_config, s_rel);
  }
  // A config can self-declare the profile so a vibe coder never needs the flag.
  if (o_opts.profile === undefined && (d_config as any).profile === "vibe") b_vibe = true;

  const a_tags = parseTags(a_lines, o_adapter.commentLine);

  // --- docref resolution ---
  f_ValidateDocrefs(a_tags, d_config, a_findings);

  const o_parser = await getParser(o_adapter);
  const o_tree = o_parser.parse(s_src);
  const o_root = o_tree.rootNode;

  // --- docdeps ---
  const a_wl = f_ValidateDocdeps(o_root, a_tags, d_inherited, o_adapter, a_findings);

  // --- per-function checks ---
  for (const o_fn of findFunctions(o_root, o_adapter.nodeTypes.func)) {
    f_ValidateDoctype(o_fn, o_adapter, a_findings);
    f_ValidateDocslim(o_fn, a_lines, a_tags, d_inherited, b_vibe, o_adapter, a_findings);
    f_ValidateDocpure(o_fn, a_tags, a_lines, o_adapter, a_findings);
  }

  // --- docrule ---
  f_ApplyDocrule(a_tags, b_vibe, a_findings);

  const s_errors = a_findings.filter((o_f) => o_f.level === "error").length;
  const s_warnings = a_findings.filter((o_f) => o_f.level === "warning").length;
  return { file: s_file, meta: { config: s_cfgPath, adapter: o_adapter.id, whitelist: a_wl }, findings: a_findings, errors: s_errors, warnings: s_warnings };
}

export async function validatePaths(a_paths: string[], s_explicit?: string, o_opts: ValidateOptions = {}): Promise<{ reports: FileReport[]; errors: number }> {
  const a_reports: FileReport[] = [];
  for (const s_p of a_paths) a_reports.push(await validateFile(s_p, s_explicit, o_opts));
  return { reports: a_reports, errors: a_reports.reduce((s_sum, o_r) => s_sum + o_r.errors, 0) };
}
