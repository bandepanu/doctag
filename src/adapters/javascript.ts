import { LanguageAdapter, Param } from "../core/types";

function f_ParamId(o_c: any): any {
  if (o_c.type === "identifier") return o_c;
  if (o_c.type === "assignment_pattern") return o_c.childForFieldName("left") || o_c.namedChildren[0];
  if (o_c.type === "rest_pattern") return o_c.namedChildren.find((o_x: any) => o_x.type === "identifier");
  return null;
}

// JavaScript: dynamically typed, so doctype is prefix-PRESENCE only (no annotation
// to reconcile). A good contrast to Go. Node types verified against tree-sitter-javascript.
export const javascript: LanguageAdapter = {
  id: "javascript",
  extensions: [".js", ".mjs", ".cjs", ".jsx"],
  grammarWasm: "tree-sitter-javascript.wasm",
  commentLine: "//",
  doctypeMode: "prefix",
  ioNames: ["console.log", "console.error", "console.warn", "alert", "fetch"],
  netNames: ["axios", "http", "https"],
  nodeTypes: {
    func: ["function_declaration", "function_expression", "arrow_function", "method_definition", "generator_function_declaration"],
    block: ["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "try_statement", "switch_statement"],
    branch: ["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "catch_clause", "ternary_expression", "switch_case"],
    call: ["call_expression"],
    import: ["import_statement", "call_expression"], // ES import + CommonJS require()/dynamic import()
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? "<anon>";
  },

  bodyNode(node: any): any {
    return node.childForFieldName("body");
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    let pl = node.childForFieldName("parameters") || node.namedChildren.find((c: any) => c.type === "formal_parameters");
    if (!pl) {
      if (node.type === "arrow_function") { const id = node.namedChildren.find((c: any) => c.type === "identifier"); if (id) ps.push({ name: id.text, line: id.startPosition.row + 1 }); }
      return ps;
    }
    for (const c of pl.namedChildren) {
      const id = f_ParamId(c);
      if (id) ps.push({ name: id.text, line: id.startPosition.row + 1 });
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    const add = (nm: any) => {
      if (!nm || nm.type !== "identifier" || seen.has(nm.text)) return;
      seen.add(nm.text);
      ps.push({ name: nm.text, line: nm.startPosition.row + 1 });
    };
    (function f_Walk(n: any) {
      if (n.type === "variable_declarator") add(n.childForFieldName("name") || n.namedChildren[0]);
      else if (n.type === "for_in_statement") add(n.childForFieldName("left") || n.namedChildren[0]);
      for (const c of n.namedChildren) f_Walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    if (node.type === "import_statement") {
      const s = node.childForFieldName("source") || node.namedChildren.find((c: any) => c.type === "string");
      return s ? [s.text.replace(/^['"]|['"]$/g, "")] : [];
    }
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      if (fn && (fn.text === "require" || fn.text === "import")) {
        const args = node.childForFieldName("arguments");
        const str = args?.namedChildren?.find((c: any) => c.type === "string");
        if (str) return [str.text.replace(/^['"]|['"]$/g, "")];
      }
    }
    return [];
  },

  callName(node: any): string | null {
    if (node.type !== "call_expression") return null;
    return node.childForFieldName("function")?.text ?? null;
  },

  annotationPrefix(): string | null {
    return null; // JS has no static type annotations
  },
};
