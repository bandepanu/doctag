import { LanguageAdapter, Param } from "../core/types";

// PHP: every variable carries a mandatory `$`, so the sigil conveys no shape info —
// the s_/a_/d_ prefix lives in the name AFTER the `$`, which the adapter strips.
// doctype is therefore prefix mode (not sigil mode like Perl). PHP has optional
// type hints, so annotation agreement applies when a hint is present. `echo` is a
// language construct (echo_statement), included in the call set for docpure.
const SCALAR = new Set(["int", "float", "string", "bool"]);

export const php: LanguageAdapter = {
  id: "php",
  extensions: [".php"],
  grammarWasm: "tree-sitter-php.wasm",
  commentLine: "//",
  doctypeMode: "prefix",
  ioNames: ["echo", "print", "printf", "var_dump", "print_r", "fwrite", "file_put_contents", "file_get_contents"],
  netNames: ["curl", "fsockopen"],
  nodeTypes: {
    func: ["function_definition", "method_declaration"],
    block: ["if_statement", "for_statement", "foreach_statement", "while_statement", "do_statement", "switch_statement", "try_statement"],
    branch: ["if_statement", "for_statement", "foreach_statement", "while_statement", "do_statement", "catch_clause", "conditional_expression"],
    call: ["function_call_expression", "member_call_expression", "scoped_call_expression", "echo_statement"],
    import: ["namespace_use_declaration"],
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? "<function>";
  },
  bodyNode(node: any): any {
    return node.childForFieldName("body");
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    const pl = node.childForFieldName("parameters") || node.namedChildren.find((c: any) => c.type === "formal_parameters");
    if (!pl) return ps;
    for (const c of pl.namedChildren) {
      if (!/parameter/.test(c.type)) continue;
      const vn = c.namedChildren.find((x: any) => x.type === "variable_name");
      const typeNode = c.namedChildren.find((x: any) => x.type !== "variable_name" && /type|name/.test(x.type));
      if (vn) ps.push({ name: vn.text.replace(/^\$/, ""), annotation: typeNode ? typeNode.text : undefined, line: vn.startPosition.row + 1 });
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    (function walk(n: any) {
      if (n.type === "assignment_expression") {
        const vn = n.namedChildren[0];
        if (vn && vn.type === "variable_name") {
          const nm = vn.text.replace(/^\$/, "");
          if (!seen.has(nm)) { seen.add(nm); ps.push({ name: nm, line: vn.startPosition.row + 1 }); }
        }
      }
      for (const c of n.namedChildren) walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    const out: string[] = [];
    (function walk(n: any) {
      if (n.type === "namespace_use_clause") {
        const q = n.namedChildren.find((c: any) => c.type === "qualified_name" || c.type === "name");
        if (q) out.push(q.text);
      }
      for (const c of n.namedChildren) walk(c);
    })(node);
    return out;
  },

  callName(node: any): string | null {
    if (node.type === "echo_statement") return "echo";
    return (node.childForFieldName("function") || node.childForFieldName("name"))?.text ?? null;
  },

  annotationPrefix(annotation: string): string | null {
    const t = annotation.trim().replace(/^\?/, "").toLowerCase();
    if (t === "array" || t === "iterable") return "a_";
    if (t === "bool") return "b_";
    if (SCALAR.has(t)) return "s_";
    if (t === "object") return "o_";
    if (t === "callable" || t === "closure") return "f_";
    return null;
  },
};
