// Language-agnostic docx.json cascade: find the nearest config, resolve
// global_invariants + directory_overrides for a file, and validate @docref.
import * as fs from "node:fs";
import * as path from "node:path";

export interface DocxConfig {
  version?: string;
  global_invariants?: Record<string, Record<string, any>>;
  directory_overrides?: Record<string, Record<string, Record<string, any>>>;
}

/** Strip // and block comments (string-aware) and trailing commas, so a docx.json
 *  can be richly commented for learning (JSONC) yet still parse. */
export function stripJsonComments(s: string): string {
  let out = "";
  let s_i = 0;
  const n = s.length;
  let inStr = false;
  let strCh = "";
  while (s_i < n) {
    const c = s[s_i];
    const d = s[s_i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") { out += (s[s_i + 1] ?? ""); s_i += 2; continue; }
      if (c === strCh) inStr = false;
      s_i++;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; s_i++; continue; }
    if (c === "/" && d === "/") { s_i = f_SkipLine(s, s_i); continue; }
    if (c === "/" && d === "*") { s_i = f_SkipBlock(s, s_i); continue; }
    out += c;
    s_i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function f_SkipLine(s: string, s_i: number): number {
  while (s_i < s.length && s[s_i] !== "\n") s_i++;
  return s_i;
}

function f_SkipBlock(s: string, s_i: number): number {
  s_i += 2;
  while (s_i < s.length && !(s[s_i] === "*" && s[s_i + 1] === "/")) s_i++;
  return s_i + 2;
}

export function loadConfig(path: string): DocxConfig {
  return JSON.parse(stripJsonComments(fs.readFileSync(path, "utf8")));
}

export function findConfig(startFile: string, explicit?: string): string | null {
  if (explicit) return explicit;
  let dir = path.dirname(path.resolve(startFile));
  for (;;) {
    const cand = path.join(dir, "docx.json");
    if (fs.existsSync(cand)) return cand;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function f_GlobToRe(pat: string): RegExp {
  const esc = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${esc}$`);
}

/** Merge global_invariants, then any matching directory_overrides (shorter patterns first). */
export function resolveInherited(config: DocxConfig, relPath: string): Record<string, Record<string, any>> {
  const merged: Record<string, Record<string, any>> = {};
  for (const [tok, block] of Object.entries(config.global_invariants || {})) {
    merged[tok] = { ...(merged[tok] || {}), ...block };
  }
  const overrides = config.directory_overrides || {};
  for (const pat of Object.keys(overrides).sort((a, b) => a.length - b.length)) {
    const re = f_GlobToRe(pat);
    const reStar = f_GlobToRe(pat.replace(/\*+$/, "") + "*");
    if (re.test(relPath) || reStar.test(relPath)) {
      for (const [tok, block] of Object.entries(overrides[pat])) {
        merged[tok] = { ...(merged[tok] || {}), ...block };
      }
    }
  }
  return merged;
}

/** @docref inherit keys are valid if they name global_invariants or a directory_overrides pattern. */
export function docrefValid(config: DocxConfig, key: string): boolean {
  return key === "global_invariants" || key in (config.directory_overrides || {});
}
