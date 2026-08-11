// Generic, language-agnostic metrics computed from a tree-sitter subtree, driven
// entirely by the adapter's NodeTypeMap. No language-specific logic lives here.

export function findFunctions(root: any, funcTypes: string[]): any[] {
  const set = new Set(funcTypes);
  const out: any[] = [];
  (function f_Walk(n: any) {
    if (set.has(n.type)) out.push(n);
    for (const c of n.namedChildren) f_Walk(c);
  })(root);
  return out;
}

export function nestingDepth(node: any, blockTypes: string[], level = 0): number {
  const set = new Set(blockTypes);
  let best = level;
  for (const c of node.namedChildren) {
    const next = set.has(c.type) ? level + 1 : level;
    best = Math.max(best, nestingDepth(c, blockTypes, next));
  }
  return best;
}

export function complexity(fn: any, branchTypes: string[]): number {
  const set = new Set(branchTypes);
  let c = 1;
  (function f_Walk(n: any) {
    if (set.has(n.type)) c++;
    for (const ch of n.namedChildren) f_Walk(ch);
  })(fn);
  return c;
}

/** Non-blank, non-comment physical lines in the body, skipping a leading docstring. */
/** Rows occupied by a leading string docstring, if the body starts with one. */
function f_DocRows(bodyNode: any): Set<number> {
  const docRows = new Set<number>();
  const first = bodyNode.namedChildren[0];
  if (first && first.type === "expression_statement" && first.namedChildren[0] && first.namedChildren[0].type === "string") {
    for (let r = first.startPosition.row; r <= first.endPosition.row; r++) docRows.add(r);
  }
  return docRows;
}

export function bodyLineCount(bodyNode: any, lines: string[], commentMarker: string): number {
  if (!bodyNode) return 0;
  const start = bodyNode.startPosition.row;
  const end = bodyNode.endPosition.row;
  const docRows = f_DocRows(bodyNode);
  let count = 0;
  for (let r = start; r <= end; r++) {
    if (docRows.has(r)) continue;
    const t = (lines[r] || "").trim();
    if (!t) continue;
    if (t.startsWith(commentMarker)) continue;
    if (/^[{}()[\];,]+$/.test(t)) continue; // structural-punctuation-only line (e.g. "}") — don't count, so brace and indent languages are comparable
    count++;
  }
  return count;
}

export function collectCalls(fn: any, callTypes: string[]): any[] {
  const set = new Set(callTypes);
  const out: any[] = [];
  (function f_Walk(n: any) {
    if (set.has(n.type)) out.push(n);
    for (const c of n.namedChildren) f_Walk(c);
  })(fn);
  return out;
}

export function collectImports(root: any, importTypes: string[]): any[] {
  const set = new Set(importTypes);
  const out: any[] = [];
  (function f_Walk(n: any) {
    if (set.has(n.type)) out.push(n);
    for (const c of n.namedChildren) f_Walk(c);
  })(root);
  return out;
}

/** Contiguous comment lines directly above a 0-based start row (the function's header). */
export function headerLines(startRow: number, lines: string[], commentMarker: string): Set<number> {
  const out = new Set<number>();
  let i = startRow - 1;
  while (i >= 0) {
    const t = (lines[i] || "").trim();
    if (t.startsWith(commentMarker)) {
      out.add(i + 1); // store as 1-based line number
      i--;
    } else break;
  }
  return out;
}
