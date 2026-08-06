#!/usr/bin/env node
// Reports which DocX language grammars are available. Prebuilt grammars come from
// the tree-sitter-wasms dependency; Perl must be built locally (see build-perl-grammar.md).
const path = require("path");
const fs = require("fs");

const prebuilt = ["python", "javascript", "typescript", "go", "rust", "ruby", "php"];
console.log("DocX grammar availability:");
for (const lang of prebuilt) {
  let ok = false;
  try { require.resolve(`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`); ok = true; } catch {}
  console.log(`  ${ok ? "OK  " : "MISS"} ${lang}${ok ? "" : "  (install tree-sitter-wasms)"}`);
}
const perl = path.resolve(__dirname, "..", "grammars", "tree-sitter-perl.wasm");
console.log(`  ${fs.existsSync(perl) ? "OK  " : "TODO"} perl${fs.existsSync(perl) ? "" : "  (build it: scripts/build-perl-grammar.md)"}`);
