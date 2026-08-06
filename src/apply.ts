// Retrofit Pass 3: safe, deterministic insertion. Given a blueprint of tag lines to
// place above specific source lines, insert them as comments with matching indent and
// the file's comment marker. Never touches executable logic — pure line insertion.
import * as fs from "fs";
import { adapterForFile } from "./adapters";

export interface Insertion { line: number; tags: string[] } // line is 1-based; tags like "@docslim: max_lines = 20"

export function applyBlueprint(file: string, insertions: Insertion[]): { file: string; inserted: number } {
  const adapter = adapterForFile(file);
  const marker = adapter ? adapter.commentLine : "#";
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

  // Insert bottom-up so earlier line numbers stay valid.
  const sorted = [...insertions].sort((a, b) => b.line - a.line);
  let inserted = 0;
  for (const ins of sorted) {
    const idx = Math.max(0, Math.min(ins.line - 1, lines.length));
    const indent = (lines[idx] || "").match(/^\s*/)?.[0] ?? "";
    const block = ins.tags.map((t) => `${indent}${marker} ${t.replace(/^#*\s*/, "")}`);
    lines.splice(idx, 0, ...block);
    inserted += block.length;
  }
  fs.writeFileSync(file, lines.join("\n"));
  return { file, inserted };
}
