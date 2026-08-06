// web-tree-sitter bootstrap + grammar resolution. Pinned to web-tree-sitter 0.25.x,
// which loads the prebuilt tree-sitter-wasms grammars (0.26 changed the ABI).
import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TS: any = require("web-tree-sitter");
const Parser: any = TS.Parser;
const Language: any = TS.Language;

let initialized = false;
const langCache = new Map<string, any>();

/** Resolve a grammar wasm: prefer the bundled tree-sitter-wasms package, else grammars/ dir. */
export function resolveGrammar(wasmFile: string): string {
  try {
    return require.resolve(`tree-sitter-wasms/out/${wasmFile}`);
  } catch {
    const local = path.resolve(__dirname, "..", "..", "grammars", wasmFile);
    if (fs.existsSync(local)) return local;
    throw new Error(
      `grammar '${wasmFile}' not found. Install tree-sitter-wasms, or place the ` +
        `.wasm in grammars/ (see scripts/build-perl-grammar.md for Perl).`
    );
  }
}

export async function getParser(adapter: { id: string; grammarWasm: string }): Promise<any> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  if (!langCache.has(adapter.id)) {
    const lang = await Language.load(resolveGrammar(adapter.grammarWasm));
    langCache.set(adapter.id, lang);
  }
  const parser = new Parser();
  parser.setLanguage(langCache.get(adapter.id));
  return parser;
}
