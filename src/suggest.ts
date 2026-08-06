// suggest-prefixes (retrofit helper): proposes doctype variable renames as JSON, so
// the agent can apply them (renaming an identifier + its uses within a function is a
// job the AI does reliably). We do NOT auto-rename across scopes — that's the one hard
// part we deliberately leave to the AI-plus-verify loop.
import * as fs from "fs";
import * as path from "path";
import { adapterForFile } from "./adapters";
import { getParser } from "./engine/parser";
import { findFunctions } from "./engine/metrics";
import { loadScope, inScope, walkFiles } from "./scope";

const PREFIX_RE = /^[sabdmfop]_/;

export interface Rename { old: string; new: string; line: number; annotation?: string }
export interface FileSuggestion { file: string; language: string; renames: Rename[] }

export async function suggestPrefixes(root: string): Promise<FileSuggestion[]> {
  const scope = loadScope(root);
  const result: FileSuggestion[] = [];
  for (const file of walkFiles(root, (f) => !!adapterForFile(f))) {
    if (!inScope(path.relative(root, file), scope)) continue;
    const adapter = adapterForFile(file)!;
    if (adapter.doctypeMode !== "prefix") continue; // Perl uses native sigils; nothing to rename
    const src = fs.readFileSync(file, "utf8");
    let tree: any;
    try { tree = (await getParser(adapter)).parse(src); } catch { continue; }
    const renames: Rename[] = [];
    const seen = new Set<string>();
    for (const fn of findFunctions(tree.rootNode, adapter.nodeTypes.func)) {
      for (const p of [...adapter.params(fn), ...adapter.locals(fn)]) {
        if (p.name === "self" || p.name === "cls" || p.name.startsWith("_") || PREFIX_RE.test(p.name)) continue;
        const prefix = (p.annotation && adapter.annotationPrefix(p.annotation)) || "s_";
        const key = `${p.name}@${p.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        renames.push({ old: p.name, new: prefix + p.name, line: p.line, annotation: p.annotation });
      }
    }
    if (renames.length) result.push({ file: path.relative(root, file), language: adapter.id, renames });
  }
  return result;
}
