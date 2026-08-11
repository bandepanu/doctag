import { LanguageAdapter, Param } from "../core/types";

// Go: statically typed, so doctype checks BOTH prefix presence AND annotation
// agreement (map[...] -> d_, []T -> a_, scalar -> s_, ...). Node types verified
// against tree-sitter-go.
const SCALAR = new Set([
  "string", "int", "int8", "int16", "int32", "int64", "uint", "uint8", "uint16", "uint32",
  "uint64", "uintptr", "byte", "rune", "float32", "float64", "bool", "error", "complex64", "complex128",
]);

function f_Add(a_ps: Param[], a_seen: Set<string>, o_nm: any, o_ann?: any): void {
  if (!o_nm || o_nm.type !== "identifier" || o_nm.text === "_" || a_seen.has(o_nm.text)) return;
  a_seen.add(o_nm.text);
  a_ps.push({ name: o_nm.text, annotation: o_ann ? o_ann.text : undefined, line: o_nm.startPosition.row + 1 });
}

export const go: LanguageAdapter = {
  id: "go",
  extensions: [".go"],
  grammarWasm: "tree-sitter-go.wasm",
  commentLine: "//",
  doctypeMode: "prefix",
  ioNames: ["fmt.Println", "fmt.Printf", "fmt.Print", "println", "print"],
  netNames: ["net", "http"],
  nodeTypes: {
    func: ["function_declaration", "method_declaration"],
    block: ["if_statement", "for_statement", "expression_switch_statement", "type_switch_statement", "select_statement"],
    branch: ["if_statement", "for_statement", "expression_case", "type_case", "communication_case"],
    call: ["call_expression"],
    import: ["import_declaration"],
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? "<func>";
  },

  bodyNode(node: any): any {
    return node.childForFieldName("body");
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    for (const pl of node.namedChildren.filter((c: any) => c.type === "parameter_list")) {
      for (const pd of pl.namedChildren) {
        if (pd.type !== "parameter_declaration" && pd.type !== "variadic_parameter_declaration") continue;
        const ids = pd.namedChildren.filter((c: any) => c.type === "identifier");
        const typeNode = pd.namedChildren.find((c: any) => c.type !== "identifier");
        const ann = typeNode ? typeNode.text : undefined;
        for (const id of ids) ps.push({ name: id.text, annotation: ann, line: id.startPosition.row + 1 });
      }
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    (function f_Walk(n: any) {
      if (n.type === "short_var_declaration") {
        const left = n.childForFieldName("left");
        for (const c of left ? left.namedChildren : []) f_Add(ps, seen, c);
      } else if (n.type === "var_spec") {
        const typeNode = n.namedChildren.find((c: any) => c.type !== "identifier");
        for (const c of n.namedChildren.filter((c: any) => c.type === "identifier")) f_Add(ps, seen, c, typeNode);
      }
      for (const c of n.namedChildren) f_Walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    const specs: any[] = [];
    (function f_Collect(n: any) {
      if (n.type === "import_spec") specs.push(n);
      for (const c of n.namedChildren) f_Collect(c);
    })(node);
    return specs
      .map((s) => {
        const p = s.childForFieldName("path") || s.namedChildren.find((c: any) => c.type === "interpreted_string_literal");
        return p ? p.text.replace(/^"|"$/g, "") : null;
      })
      .filter((x): x is string => !!x);
  },

  callName(node: any): string | null {
    if (node.type !== "call_expression") return null;
    return node.childForFieldName("function")?.text ?? null;
  },

  annotationPrefix(annotation: string): string | null {
    const t = annotation.trim();
    if (t.startsWith("[]") || t.startsWith("[")) return "a_";
    if (t.startsWith("map[")) return "d_";
    if (t.startsWith("func")) return "f_";
    if (t.startsWith("*")) return "p_";
    if (t.startsWith("chan")) return "o_";
    if (t === "bool") return "b_";
    if (SCALAR.has(t)) return "s_";
    return null; // custom struct/interface — no assertion
  },
};
