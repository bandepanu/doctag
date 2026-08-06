import { LanguageAdapter, Param } from "../core/types";

// Ruby: dynamically typed → doctype is prefix-presence only. Ruby has no import
// statement; `require "x"` is a method call, so imports are detected from calls.
export const ruby: LanguageAdapter = {
  id: "ruby",
  extensions: [".rb"],
  grammarWasm: "tree-sitter-ruby.wasm",
  commentLine: "#",
  doctypeMode: "prefix",
  ioNames: ["puts", "print", "p", "pp", "warn"],
  netNames: ["Net", "URI"],
  nodeTypes: {
    func: ["method", "singleton_method"],
    block: ["if", "unless", "while", "until", "for", "case", "begin"],
    branch: ["if", "unless", "while", "until", "for", "when", "rescue", "if_modifier", "unless_modifier", "while_modifier", "until_modifier"],
    call: ["call"],
    import: ["call"], // require/require_relative are calls; importModules filters them
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? node.namedChildren.find((c: any) => c.type === "identifier")?.text ?? "<method>";
  },
  bodyNode(node: any): any {
    return node.namedChildren.find((c: any) => c.type === "body_statement") ?? null;
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    const pl = node.namedChildren.find((c: any) => c.type === "method_parameters" || c.type === "parameters");
    if (!pl) return ps;
    for (const c of pl.namedChildren) {
      let id: any = null;
      if (c.type === "identifier") id = c;
      else id = c.childForFieldName?.("name") || c.namedChildren?.find((x: any) => x.type === "identifier");
      if (id) ps.push({ name: id.text, line: id.startPosition.row + 1 });
    }
    return ps;
  },

  locals(node: any): Param[] {
    const ps: Param[] = [];
    const seen = new Set<string>();
    (function walk(n: any) {
      if (n.type === "assignment") {
        const nm = n.namedChildren[0];
        if (nm && nm.type === "identifier" && !seen.has(nm.text)) { seen.add(nm.text); ps.push({ name: nm.text, line: nm.startPosition.row + 1 }); }
      }
      for (const c of n.namedChildren) walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    const method = (node.childForFieldName("method") || node.namedChildren.find((c: any) => c.type === "identifier"))?.text;
    if (method !== "require" && method !== "require_relative") return [];
    const args = node.childForFieldName("arguments") || node.namedChildren.find((c: any) => c.type === "argument_list");
    const str = args?.namedChildren?.find((c: any) => c.type === "string");
    return str ? [str.text.replace(/^['"]|['"]$/g, "")] : [];
  },

  callName(node: any): string | null {
    if (node.type !== "call") return null;
    return (node.childForFieldName("method") || node.namedChildren.find((c: any) => c.type === "identifier"))?.text ?? null;
  },

  annotationPrefix(): string | null {
    return null; // dynamic
  },
};
