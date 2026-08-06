// Core types shared by the language-agnostic engine and the per-language adapters.

export type Level = "error" | "warning";

export interface Finding {
  level: Level;
  token: string;
  line: number;
  message: string;
}

export interface Param {
  name: string;
  annotation?: string;
  line: number;
}

/**
 * Sets of tree-sitter node-type names, per language. This is the "data, not code"
 * part of an adapter: the generic engine computes depth / complexity / imports
 * from these sets, so adding a language is mostly filling this map in.
 */
export interface NodeTypeMap {
  func: string[];    // function/method definition nodes
  block: string[];   // block statements that increase nesting depth
  branch: string[];  // decision nodes that increase cyclomatic complexity
  call: string[];    // call-expression nodes (for docpure I/O detection)
  import: string[];  // import/use/require statement nodes
}

/**
 * A language backend. `doctypeMode` selects how the doctype layer is expressed:
 *   - "prefix": s_/a_/d_/m_/f_/o_ identifier prefixes (Python, JS, Go, ...)
 *   - "sigil":  native $ @ % sigils (Perl, where they are valid syntax)
 */
export interface LanguageAdapter {
  id: string;
  extensions: string[];
  grammarWasm: string;              // module-resolvable path or grammars/<file>.wasm
  commentLine: string;              // line-comment marker, e.g. "#" or "//"
  doctypeMode: "prefix" | "sigil";
  ioNames: string[];                // impure calls, e.g. print/open/input
  netNames: string[];               // network module roots, e.g. socket/requests
  nodeTypes: NodeTypeMap;

  functionName(node: any): string;
  bodyNode(node: any): any | null;  // the function body node (for line counting)
  params(node: any): Param[];
  locals(node: any): Param[];       // local variable DECLARATIONS inside the function (deduped by name)
  importModules(node: any): string[];
  callName(node: any): string | null;
  annotationPrefix(annotation: string): string | null; // typed langs; null if unknown
}

export interface FileReport {
  file: string;
  meta: { config: string | null; adapter: string | null; whitelist: string[] };
  findings: Finding[];
  errors: number;
  warnings: number;
}
