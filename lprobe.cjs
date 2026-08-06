const { Parser, Language } = require("web-tree-sitter");
(async()=>{
  await Parser.init();
  const load=async f=>{const p=new Parser();p.setLanguage(await Language.load(require.resolve("tree-sitter-wasms/out/"+f)));return p;};
  const dump=(n,d=0,o=[])=>{if(n.isNamed)o.push("  ".repeat(d)+n.type+(n.namedChildCount===0?` '${n.text.slice(0,12)}'`:""));for(const c of n.namedChildren)dump(c,d+1,o);return o;};
  const samples={
    "tree-sitter-python.wasm":"def f():\n    s_x = 1\n    for a_i in items:\n        pass",
    "tree-sitter-javascript.wasm":"function f(){ let s_x = 1; const d_y = {}; for (const a_i of z){} }",
    "tree-sitter-go.wasm":"func f(){ s_x := 1\n var b_ok bool }",
    "tree-sitter-rust.wasm":"fn f(){ let s_x = 1; let mut a_v = vec![]; }",
    "tree-sitter-ruby.wasm":"def f\n  s_x = 1\nend",
    "tree-sitter-php.wasm":"<?php function f(){ $s_x = 1; }",
  };
  for(const[g,src]of Object.entries(samples)){
    const p=await load(g);
    console.log("== "+g+" ==\n"+dump(p.parse(src).rootNode).slice(0,22).join("\n"));
  }
})();
