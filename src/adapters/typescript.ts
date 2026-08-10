import { LanguageAdapter, Param } from "../core/types";

// TypeScript: statically typed → doctype checks prefix + annotation agreement.
const SCALAR = new Set(["string", "number", "boolean", "bigint", "symbol"]);

export const typescript: LanguageAdapter = {
  id: "typescript",
  extensions: [".ts", ".tsx", ".mts", ".cts"],
  grammarWasm: "tree-sitter-typescript.wasm",
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
    const pl = node.childForFieldName("parameters") || node.namedChildren.find((c: any) => c.type === "formal_parameters");
    if (!pl) return ps;
    for (const c of pl.namedChildren) {
      if (c.type !== "required_parameter" && c.type !== "optional_parameter") continue;
      const ta = c.namedChildren.find((x: any) => x.type === "type_annotation");
      const ann = ta && ta.namedChildren[0] ? ta.namedChildren[0].text : undefined;
      const pattern = c.childForFieldName("pattern") || c.namedChildren.find((x: any) => x.type === "identifier");
      if (!pattern) continue;
      // Plain identifier param — unchanged behavior (name + annotation).
      if (pattern.type === "identifier") {
        ps.push({ name: pattern.text, annotation: ann, line: pattern.startPosition.row + 1 });
        continue;
      }
      // Binding pattern (object/array destructuring): report every bound
      // identifier so each is shape-prefixed. The outer annotation describes the
      // whole pattern, not each binding, so per-binding annotation is omitted
      // (prefix-presence is still enforced).
      const NAME_T = /^(?:identifier|shorthand_property_identifier_pattern)$/;
      (function walk(n: any): void {
        if (NAME_T.test(n.type)) {
          ps.push({ name: n.text, annotation: undefined, line: n.startPosition.row + 1 });
        } else {
          for (const ch of n.namedChildren) walk(ch);
        }
      })(pattern);
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    const add = (nm: any, ann?: any) => {
      if (!nm || nm.type !== "identifier" || seen.has(nm.text)) return;
      seen.add(nm.text);
      ps.push({ name: nm.text, annotation: ann ? ann.text : undefined, line: nm.startPosition.row + 1 });
    };
    (function walk(n: any) {
      if (n.type === "variable_declarator") {
        const ta = n.namedChildren.find((c: any) => c.type === "type_annotation");
        add(n.childForFieldName("name") || n.namedChildren[0], ta && ta.namedChildren[0] ? ta.namedChildren[0] : undefined);
      } else if (n.type === "for_in_statement") add(n.childForFieldName("left") || n.namedChildren[0]);
      for (const c of n.namedChildren) walk(c);
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

  annotationPrefix(annotation: string): string | null {
    const t = annotation.trim();
    if (t.endsWith("[]") || /^(Array|ReadonlyArray|Set|ReadonlySet)</.test(t)) return "a_";
    if (/^(Map|Record|WeakMap)</.test(t) || t === "object") return "d_";
    if (t === "boolean") return "b_";
    if (SCALAR.has(t)) return "s_";
    return null;
  },
};
