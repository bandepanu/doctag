# Building the Perl grammar WASM

Perl is the one target language whose tree-sitter grammar ships **C source only** — it is not in the `tree-sitter-wasms` bundle, and there is no prebuilt `.wasm` on npm. So it needs a one-time local build with emscripten. (Everything else — Python, JS, TS, Go, Rust, Ruby, PHP — comes prebuilt via the `tree-sitter-wasms` dependency and needs none of this.)

## Option A — tree-sitter CLI (recommended)

```bash
npm install -g tree-sitter-cli
git clone https://github.com/tree-sitter-perl/tree-sitter-perl
cd tree-sitter-perl
tree-sitter build --wasm            # requires Docker OR a local emscripten (emcc) toolchain
# produces tree-sitter-perl.wasm
cp tree-sitter-perl.wasm /path/to/docx-pi/grammars/
```

## Option B — emscripten directly

```bash
# with emsdk activated (emcc on PATH)
git clone https://github.com/tree-sitter-perl/tree-sitter-perl && cd tree-sitter-perl
tree-sitter generate         # if src/parser.c is not already present
emcc -Os -s WASM=1 -s SIDE_MODULE=1 -I src src/parser.c src/scanner.c -o tree-sitter-perl.wasm
cp tree-sitter-perl.wasm /path/to/docx-pi/grammars/
```

## After building

1. Confirm the ABI loads with the pinned `web-tree-sitter@0.25.x` (0.26 changed the ABI).
2. **Smoke-test the node-type names** in `src/adapters/perl.ts`. They're already sourced from `tree-sitter-perl`'s own `node-types.json` (so they're accurate, not guesses) — but the adapter has never actually *run*, so parse a sample and confirm the `nodeTypes` sets and the `params`/`importModules`/`callName` extractors behave. Adjust only if the grammar version you built differs. This is edits to `perl.ts` only; the engine and core never change.

Quick node-type dump:

```bash
node -e '
const {Parser,Language}=require("web-tree-sitter");
(async()=>{ await Parser.init(); const p=new Parser();
  const L=await Language.load("grammars/tree-sitter-perl.wasm"); p.setLanguage(L);
  const t=p.parse("sub add { my ($x,$y)=@_; return $x+$y; }");
  console.log(t.rootNode.toString());
})();'
```
