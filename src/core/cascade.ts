// Language-agnostic docx.json cascade: find the nearest config, resolve
// global_invariants + directory_overrides for a file, and validate @docref.
import * as fs from "fs";
import * as path from "path";

export interface DocxConfig {
  version?: string;
  global_invariants?: Record<string, Record<string, any>>;
  directory_overrides?: Record<string, Record<string, Record<string, any>>>;
}

/** Strip // and block comments (string-aware) and trailing commas, so a docx.json
 *  can be richly commented for learning (JSONC) yet still parse. */
export function stripJsonComments(s: string): string {
  let out = "";
  let i = 0;
  const n = s.length;
  let inStr = false;
  let strCh = "";
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") { out += s[i + 1] ?? ""; i += 2; continue; }
      if (c === strCh) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; out += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && s[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(s[i] === "*" && s[i + 1] === "/")) i++; i += 2; continue; }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function loadConfig(path: string): DocxConfig {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsMod = require("fs");
  return JSON.parse(stripJsonComments(fsMod.readFileSync(path, "utf8")));
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

function globToRe(pat: string): RegExp {
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
    const re = globToRe(pat);
    const reStar = globToRe(pat.replace(/\*+$/, "") + "*");
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
