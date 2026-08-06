import * as fs from "fs";
import * as path from "path";
import { Finding, FileReport, LanguageAdapter } from "./core/types";
import { parseTags, parseKv } from "./core/tags";
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

function allowed(mod: string, whitelist: string[]): boolean {
  return whitelist.some((w) => mod === w || mod.startsWith(w + "."));
}

export interface ValidateOptions {
  /** "vibe" = Core-only + docslim caps taken ONLY from the docx.json cascade,
   *  ignoring per-function @docslim headers so the code-writing agent can't set
   *  its own bar. "default" honors per-function overrides. */
  profile?: "default" | "vibe";
}

export async function validateFile(file: string, explicitConfig?: string, opts: ValidateOptions = {}): Promise<FileReport> {
  let vibe = opts.profile === "vibe";
  const findings: Finding[] = [];
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);

  // HTML/CSS have no functions to police, but docdeps guards their external assets
  // (scripts, stylesheets, fonts, images) and a couple of smells nudge on inline blobs.
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html" || ext === ".htm" || ext === ".css") {
    const cfgPath = findConfig(file, explicitConfig);
    const wl: string[] = [];
    let cfgStr: string | null = null;
    if (cfgPath && fs.existsSync(cfgPath)) {
      const config = loadConfig(cfgPath);
      let rel = path.resolve(file);
      try { rel = path.relative(path.dirname(path.resolve(cfgPath)), rel).split(path.sep).join("/"); } catch { rel = path.basename(file); }
      wl.push(...(((resolveInherited(config, rel).docdeps || {}).allowed_imports as string[]) || []));
      cfgStr = cfgPath;
    }
    const cmark = ext === ".css" ? "/*" : "<!--";
    for (const ln of lines) {
      const m = ln.match(/@docdeps\s*:\s*(.*?)(?:-->|\*\/)?\s*$/);
      if (m) { const kv = parseKv(m[1]); if (Array.isArray(kv.allowed_imports)) wl.push(...kv.allowed_imports); }
    }
    void cmark;
    const uniq = [...new Set(wl)];
    const hf = ext === ".css" ? checkCss(src, uniq) : checkHtml(src, uniq);
    return { file, meta: { config: cfgStr, adapter: ext === ".css" ? "css" : "html", whitelist: uniq }, findings: hf, errors: hf.filter((f) => f.level === "error").length, warnings: hf.filter((f) => f.level === "warning").length };
  }

  const adapter = adapterForFile(file);
  if (!adapter) {
    return { file, meta: { config: null, adapter: null, whitelist: [] }, findings, errors: 0, warnings: 0 };
  }

  // --- cascade ---
  const cfgPath = findConfig(file, explicitConfig);
  let config: DocxConfig = {};
  let inherited: Record<string, Record<string, any>> = {};
  if (cfgPath && fs.existsSync(cfgPath)) {
    config = loadConfig(cfgPath);
    let rel = path.resolve(file);
    try {
      rel = path.relative(path.dirname(path.resolve(cfgPath)), rel).split(path.sep).join("/");
    } catch {
      rel = path.basename(file);
    }
    inherited = resolveInherited(config, rel);
  }
  // A config can self-declare the profile so a vibe coder never needs the flag.
  if (opts.profile === undefined && (config as any).profile === "vibe") vibe = true;

  const tags = parseTags(lines, adapter.commentLine);

  // --- docref resolution ---
  for (const t of tags) {
    if (t.token === "docref") {
      for (const key of (t.kv.inherit as string[]) || []) {
        if (!docrefValid(config, key)) {
          findings.push({ level: "warning", token: "docref", line: t.line, message: `@docref inherits '${key}' but no such block in docx.json` });
        }
      }
    }
  }

  const parser = await getParser(adapter);
  const tree = parser.parse(src);
  const root = tree.rootNode;

  // --- docdeps whitelist (inherited + module-level tags) ---
  const whitelist: string[] = [...(((inherited.docdeps || {}).allowed_imports as string[]) || [])];
  for (const t of tags) if (t.token === "docdeps" && Array.isArray(t.kv.allowed_imports)) whitelist.push(...t.kv.allowed_imports);
  if (whitelist.length) {
    for (const imp of collectImports(root, adapter.nodeTypes.import)) {
      for (const mod of adapter.importModules(imp)) {
        if (/^[.\/]/.test(mod)) continue; // relative/local import — your own code, not an external dep
        if (!allowed(mod, whitelist)) {
          findings.push({ level: "error", token: "docdeps", line: imp.startPosition.row + 1, message: `import '${mod}' not in docdeps whitelist [${[...new Set(whitelist)].sort().join(", ")}]` });
        }
      }
    }
  }

  // --- per-function checks ---
  const headerTag = (token: string, fnStartRow: number): Record<string, any> | null => {
    const hl = headerLines(fnStartRow, lines, adapter.commentLine);
    let found: Record<string, any> | null = null;
    for (const t of tags) if (t.token === token && hl.has(t.line)) found = t.kv;
    return found;
  };

  for (const fn of findFunctions(root, adapter.nodeTypes.func)) {
    const name = adapter.functionName(fn);

    // doctype: strict in every profile — a missing prefix or a prefix/annotation
    // mismatch is an error. Checked on BOTH parameters and local declarations, so
    // "every variable is prefixed" is actually true (deduped by name).
    const dtSeen = new Set<string>();
    for (const p of [...adapter.params(fn), ...adapter.locals(fn)]) {
      if (p.name === "self" || p.name === "cls" || p.name.startsWith("_") || dtSeen.has(p.name)) continue;
      dtSeen.add(p.name);
      if (adapter.doctypeMode === "prefix") {
        if (!PREFIX_RE.test(p.name)) {
          findings.push({ level: "error", token: "doctype", line: p.line, message: `name '${p.name}' has no structural prefix (s_/b_/a_/d_/m_/f_/o_/p_)` });
        } else if (p.annotation) {
          const expected = adapter.annotationPrefix(p.annotation);
          if (expected && expected !== p.name.slice(0, 2)) {
            findings.push({ level: "error", token: "doctype", line: p.line, message: `'${p.name}' is prefixed '${p.name.slice(0, 2)}' but annotated '${p.annotation}' (expected '${expected}')` });
          }
        }
      } else if (adapter.doctypeMode === "sigil") {
        if (!SIGIL_RE.test(p.name)) {
          findings.push({ level: "error", token: "doctype", line: p.line, message: `variable '${p.name}' lacks a Perl sigil ($/@/%)` });
        }
      }
    }

    // docslim caps. Default: a function's own @docslim header wins over the
    // inherited cascade. Vibe: caps come ONLY from the cascade (docx.json), so the
    // agent writing the code cannot relax its own budget per function.
    const localSlim = headerTag("docslim", fn.startPosition.row);
    const slim = vibe ? { ...(inherited.docslim || {}) } : { ...(inherited.docslim || {}), ...(localSlim || {}) };
    if (vibe && localSlim && Object.keys(inherited.docslim || {}).length) {
      findings.push({ level: "warning", token: "docslim", line: fn.startPosition.row + 1, message: `${name}: per-function @docslim ignored under vibe profile (caps come from docx.json)` });
    }
    if (Object.keys(slim).length) {
      if (typeof slim.max_lines === "number") {
        const n = bodyLineCount(adapter.bodyNode(fn), lines, adapter.commentLine);
        if (n > slim.max_lines) findings.push({ level: "error", token: "docslim", line: fn.startPosition.row + 1, message: `${name}: body ${n} lines > max_lines ${slim.max_lines}` });
      }
      if (typeof slim.max_nested_depth === "number") {
        const d = nestingDepth(fn, adapter.nodeTypes.block);
        if (d > slim.max_nested_depth) findings.push({ level: "error", token: "docslim", line: fn.startPosition.row + 1, message: `${name}: nesting depth ${d} > max_nested_depth ${slim.max_nested_depth}` });
      }
      if (typeof slim.max_complexity === "number") {
        const c = complexity(fn, adapter.nodeTypes.branch);
        if (c > slim.max_complexity) findings.push({ level: "error", token: "docslim", line: fn.startPosition.row + 1, message: `${name}: complexity ${c} > max_complexity ${slim.max_complexity}` });
      }
    }

    // docpure
    const pure = headerTag("docpure", fn.startPosition.row);
    if (pure && (pure.deterministic === true || pure.mutates_state === false)) {
      for (const call of collectCalls(fn, adapter.nodeTypes.call)) {
        const cn = adapter.callName(call);
        if (!cn) continue;
        if (adapter.ioNames.includes(cn)) {
          findings.push({ level: "error", token: "docpure", line: call.startPosition.row + 1, message: `impure I/O call '${cn}(...)' in a block marked pure/deterministic` });
        } else if (adapter.netNames.includes(cn.split(".")[0])) {
          findings.push({ level: "error", token: "docpure", line: call.startPosition.row + 1, message: `network call via '${cn}' in a pure/deterministic block` });
        }
      }
    }
  }

  // docrule: a documented local policy exception downgrades a named rule's errors to
  // warnings (visible, not silent) — e.g. `# @docrule: suppress = ["docpure"]`.
  const suppress = new Set<string>();
  for (const t of tags) if (t.token === "docrule" && Array.isArray(t.kv.suppress)) for (const s of t.kv.suppress) suppress.add(String(s));
  if (suppress.size) {
    if (vibe) {
      // In vibe mode the agent must not be able to self-exempt — suppression is ignored.
      findings.push({ level: "warning", token: "docrule", line: 1, message: `@docrule suppression of [${[...suppress].join(", ")}] is IGNORED under the vibe profile (an agent cannot unlock its own cage)` });
    } else {
      for (const f of findings) if (f.level === "error" && suppress.has(f.token)) { f.level = "warning"; f.message += " (allowed by @docrule)"; }
    }
  }

  const errors = findings.filter((f) => f.level === "error").length;
  const warnings = findings.filter((f) => f.level === "warning").length;
  return { file, meta: { config: cfgPath, adapter: adapter.id, whitelist: [...new Set(whitelist)].sort() }, findings, errors, warnings };
}

export async function validatePaths(paths: string[], explicitConfig?: string, opts: ValidateOptions = {}): Promise<{ reports: FileReport[]; errors: number }> {
  const reports: FileReport[] = [];
  for (const p of paths) reports.push(await validateFile(p, explicitConfig, opts));
  return { reports, errors: reports.reduce((a, r) => a + r.errors, 0) };
}
