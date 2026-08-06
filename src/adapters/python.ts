import { LanguageAdapter, Param } from "../core/types";

const ANN_TO_PREFIX: Record<string, string> = {
  str: "s_", int: "s_", float: "s_", bool: "b_", bytes: "s_", complex: "s_", none: "s_", decimal: "s_",
  list: "a_", tuple: "a_", set: "a_", frozenset: "a_", sequence: "a_", iterable: "a_",
  dict: "d_", mapping: "d_", ordereddict: "d_", defaultdict: "d_",
  match: "m_", callable: "f_",
};

export const python: LanguageAdapter = {
  id: "python",
  extensions: [".py"],
  grammarWasm: "tree-sitter-python.wasm",
  commentLine: "#",
  doctypeMode: "prefix",
  ioNames: ["print", "open", "input"],
  netNames: ["socket", "requests", "http", "urllib", "httpx", "aiohttp", "ftplib", "smtplib"],
  nodeTypes: {
    func: ["function_definition"],
    block: ["if_statement", "for_statement", "while_statement", "with_statement", "try_statement", "elif_clause"],
    branch: ["if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "conditional_expression", "boolean_operator"],
    call: ["call"],
    import: ["import_statement", "import_from_statement"],
  },

  functionName(node: any): string {
    return node.childForFieldName("name")?.text ?? "<anon>";
  },

  bodyNode(node: any): any {
    return node.childForFieldName("body");
  },

  params(node: any): Param[] {
    const ps: Param[] = [];
    const pl = node.childForFieldName("parameters");
    if (!pl) return ps;
    for (const c of pl.namedChildren) {
      let nameNode: any = null;
      let annNode: any = null;
      if (c.type === "identifier") nameNode = c;
      else if (c.type === "typed_parameter") {
        nameNode = c.namedChildren.find((x: any) => x.type === "identifier");
        annNode = c.childForFieldName("type");
      } else if (c.type === "default_parameter") {
        nameNode = c.childForFieldName("name");
      } else if (c.type === "typed_default_parameter") {
        nameNode = c.childForFieldName("name");
        annNode = c.childForFieldName("type");
      } else if (c.type === "list_splat_pattern" || c.type === "dictionary_splat_pattern") {
        nameNode = c.namedChildren.find((x: any) => x.type === "identifier");
      }
      if (nameNode) {
        ps.push({
          name: nameNode.text,
          annotation: annNode ? annNode.text : undefined,
          line: nameNode.startPosition.row + 1,
        });
      }
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
      if (n.type === "assignment" || n.type === "augmented_assignment") add(n.childForFieldName("left") || n.namedChildren[0], n.childForFieldName("type"));
      else if (n.type === "for_statement") add(n.childForFieldName("left") || n.namedChildren[0]);
      for (const c of n.namedChildren) walk(c);
    })(node);
    return ps;
  },

  importModules(node: any): string[] {
    if (node.type === "import_statement") {
      const names: string[] = [];
      for (const c of node.namedChildren) {
        if (c.type === "dotted_name") names.push(c.text);
        else if (c.type === "aliased_import") {
          const dn = c.childForFieldName("name");
          if (dn) names.push(dn.text);
        }
      }
      return names;
    }
    if (node.type === "import_from_statement") {
      const m = node.childForFieldName("module_name");
      return m ? [m.text] : [];
    }
    return [];
  },

  callName(node: any): string | null {
    if (node.type !== "call") return null;
    return node.childForFieldName("function")?.text ?? null;
  },

  annotationPrefix(annotation: string): string | null {
    const base = annotation.split("[")[0].split(".").pop()!.trim().toLowerCase();
    return ANN_TO_PREFIX[base] ?? null;
  },
};
