// Retrofit Pass 1: deterministic inventory. Walks a directory and, using the same
// tree-sitter engine as the validator, dumps every function's signature, params,
// current metrics, and the file's imports as JSON. This is the factual base an
// agent maps tokens onto — no LLM guessing about what exists.
import * as fs from "fs";
import * as path from "path";
import { adapterForFile } from "./adapters";
import { getParser } from "./engine/parser";
import { findFunctions, nestingDepth, complexity, bodyLineCount } from "./engine/metrics";
import { loadScope, inScope, walkFiles } from "./scope";

export interface FnInfo {
  name: string;
  startLine: number;
  endLine: number;
  params: { name: string; annotation?: string }[];
  metrics: { lines: number; nested_depth: number; complexity: number };
}
export interface FileInventory {
  file: string;
  language: string;
  imports: { module: string; line: number }[];
  functions: FnInfo[];
}

export async function inventory(root: string): Promise<FileInventory[]> {
  const result: FileInventory[] = [];
  const scope = loadScope(root);
  for (const file of walkFiles(root, (f) => !!adapterForFile(f))) {
    if (!inScope(path.relative(root, file), scope)) continue;
    const adapter = adapterForFile(file)!;
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split(/\r?\n/);
    let tree: any;
    try { tree = (await getParser(adapter)).parse(src); }
    catch { console.error(`  (skipped ${path.relative(root, file)}: could not parse)`); continue; }
    const root2 = tree.rootNode;

    const imports: { module: string; line: number }[] = [];
    const { collectImports } = await import("./engine/metrics");
    for (const imp of collectImports(root2, adapter.nodeTypes.import)) {
      for (const mod of adapter.importModules(imp)) imports.push({ module: mod, line: imp.startPosition.row + 1 });
    }

    const functions: FnInfo[] = [];
    for (const fn of findFunctions(root2, adapter.nodeTypes.func)) {
      functions.push({
        name: adapter.functionName(fn),
        startLine: fn.startPosition.row + 1,
        endLine: fn.endPosition.row + 1,
        params: adapter.params(fn).map((p) => ({ name: p.name, annotation: p.annotation })),
        metrics: {
          lines: bodyLineCount(adapter.bodyNode(fn), lines, adapter.commentLine),
          nested_depth: nestingDepth(fn, adapter.nodeTypes.block),
          complexity: complexity(fn, adapter.nodeTypes.branch),
        },
      });
    }
    result.push({ file: path.relative(root, file), language: adapter.id, imports, functions });
  }
  return result;
}
