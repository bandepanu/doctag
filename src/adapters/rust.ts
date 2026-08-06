import { LanguageAdapter, Param } from "../core/types";

// Rust: statically typed. Note println!/eprintln! are macro_invocation nodes, not
// calls, so both are in the call set and callName resolves the macro identifier.
const SCALAR = new Set([
  "i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64", "u128", "usize",
  "f32", "f64", "bool", "char", "str", "String",
]);

export const rust: LanguageAdapter = {
  id: "rust",
  extensions: [".rs"],
  grammarWasm: "tree-sitter-rust.wasm",
  commentLine: "//",
  doctypeMode: "prefix",
  ioNames: ["println", "print", "eprintln", "eprint"],
  netNames: ["std::net", "reqwest", "hyper"],
  nodeTypes: {
    func: ["function_item"],
    block: ["if_expression", "for_expression", "while_expression", "loop_expression", "match_expression"],
    branch: ["if_expression", "for_expression", "while_expression", "loop_expression", "match_arm"],
    call: ["call_expression", "macro_invocation"],
    import: ["use_declaration"],
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? "<fn>";
  },
  bodyNode(node: any): any {
    return node.childForFieldName("body");
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    const pl = node.childForFieldName("parameters") || node.namedChildren.find((c: any) => c.type === "parameters");
    if (!pl) return ps;
    for (const c of pl.namedChildren) {
      if (c.type !== "parameter") continue; // skips self_parameter
      const nameNode = c.childForFieldName("pattern");
      const typeNode = c.childForFieldName("type");
      if (nameNode) ps.push({ name: nameNode.text, annotation: typeNode ? typeNode.text : undefined, line: nameNode.startPosition.row + 1 });
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    (function walk(n: any) {
      if (n.type === "let_declaration") {
        const nm = n.childForFieldName("pattern");
        if (nm && nm.type === "identifier" && !seen.has(nm.text)) {
          seen.add(nm.text);
          const t = n.childForFieldName("type");
          ps.push({ name: nm.text, annotation: t ? t.text : undefined, line: nm.startPosition.row + 1 });
        }
      }
      for (const c of n.namedChildren) walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    const arg = node.namedChildren[0];
    if (!arg) return [];
    return [arg.text.split("::")[0].replace(/[{}\s].*$/, "")];
  },

  callName(node: any): string | null {
    if (node.type === "macro_invocation") return node.namedChildren.find((c: any) => c.type === "identifier")?.text ?? null;
    if (node.type === "call_expression") return node.childForFieldName("function")?.text ?? null;
    return null;
  },

  annotationPrefix(annotation: string): string | null {
    const t = annotation.trim();
    if (t.startsWith("&") || t.startsWith("*")) return "p_";
    if (t === "bool") return "b_";
    if (/^(Vec|VecDeque|HashSet|BTreeSet)</.test(t) || t.startsWith("[")) return "a_";
    if (/^(HashMap|BTreeMap)</.test(t)) return "d_";
    if (/^(fn|Fn|FnMut|FnOnce)/.test(t)) return "f_";
    if (SCALAR.has(t)) return "s_";
    return null;
  },
};
