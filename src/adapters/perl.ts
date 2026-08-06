import { LanguageAdapter, Param } from "../core/types";

/**
 * Perl adapter.
 *
 * Node-type names below are taken from the real grammar — `tree-sitter-perl`
 * 1.2.1 `src/node-types.json` — so they are accurate, NOT guesses. What's still
 * missing is only the compiled WASM: Perl ships C-source-only and this environment
 * has no emscripten/docker to build it (see scripts/build-perl-grammar.md). So the
 * adapter is *build-ready but runtime-unverified* — once someone builds
 * tree-sitter-perl.wasm into grammars/, it should work without code changes.
 *
 * doctypeMode is "sigil": Perl variables always carry native $ @ % sigils, so the
 * shape contract is intrinsic to the language (the check effectively always passes;
 * the real value for Perl is docslim / docdeps / docpure).
 */
export const perl: LanguageAdapter = {
  id: "perl",
  extensions: [".pl", ".pm"],
  grammarWasm: "tree-sitter-perl.wasm", // build locally into grammars/ (not in tree-sitter-wasms)
  commentLine: "#",
  doctypeMode: "sigil",
  ioNames: ["print", "say", "printf", "open", "system", "exec", "warn"],
  netNames: ["IO::Socket", "LWP", "Net::HTTP"],
  nodeTypes: {
    func: ["subroutine_declaration_statement", "method_declaration_statement"],
    block: ["conditional_statement", "for_statement", "cstyle_for_statement", "loop_statement"],
    branch: [
      "conditional_statement", "elsif", "for_statement", "cstyle_for_statement", "loop_statement",
      "conditional_expression", "postfix_conditional_expression", "postfix_loop_expression", "postfix_for_expression",
    ],
    call: ["function_call_expression", "method_call_expression", "ambiguous_function_call_expression", "func1op_call_expression", "func0op_call_expression"],
    import: ["use_statement", "require_expression"],
  },

  functionName(node: any): string {
    return node.childForFieldName?.("name")?.text ?? "<sub>";
  },
  bodyNode(node: any): any {
    return node.childForFieldName?.("body") ?? null;
  },

  // Perl params arrive via `my ($x, @y, %z) = @_;`. Collect the sigil-carrying
  // variable nodes (scalar/array/hash) declared in the sub. Their text carries the
  // sigil, which is exactly what the sigil-mode doctype check reads.
  params(node: any): Param[] {
    const ps: Param[] = [];
    (function walk(n: any) {
      if (n.type === "variable_declaration") {
        (function grab(v: any) {
          if (["scalar", "array", "hash"].includes(v.type) && /^[$@%]/.test(v.text)) {
            ps.push({ name: v.text, line: v.startPosition.row + 1 });
          }
          for (const c of v.namedChildren) grab(c);
        })(n);
      }
      for (const c of n.namedChildren) walk(c);
    })(node);
    return ps;
  },

  // Perl variables always carry a sigil and params() already walks every
  // variable_declaration in the sub, so there are no extra "locals" to check.
  locals(): Param[] {
    return [];
  },

  importModules(node: any): string[] {
    if (node.type === "use_statement") {
      const m = node.childForFieldName?.("module");
      return m ? [m.text] : [];
    }
    const first = node.namedChildren?.[0];
    return first ? [first.text] : [];
  },

  callName(node: any): string | null {
    if (node.type === "method_call_expression") return node.childForFieldName?.("method")?.text ?? null;
    return node.childForFieldName?.("function")?.text ?? node.namedChildren?.[0]?.text ?? null;
  },

  // Sigil IS the type contract; no separate annotation to reconcile.
  annotationPrefix(): string | null {
    return null;
  },
};
