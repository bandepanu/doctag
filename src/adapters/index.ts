import * as path from "path";
import { LanguageAdapter } from "../core/types";
import { python } from "./python";
import { javascript } from "./javascript";
import { typescript } from "./typescript";
import { go } from "./go";
import { rust } from "./rust";
import { ruby } from "./ruby";
import { php } from "./php";
import { perl } from "./perl";

// All prebuilt-grammar languages (via tree-sitter-wasms) are implemented and verified
// by their good/bad example pairs. Perl uses native sigils and needs a one-time
// grammar build (provisional node types). Each is one adapter file; core never changes.
export const ADAPTERS: LanguageAdapter[] = [python, javascript, typescript, go, rust, ruby, php, perl];

const BY_EXT = new Map<string, LanguageAdapter>();
for (const a of ADAPTERS) for (const e of a.extensions) BY_EXT.set(e, a);

export function adapterForFile(file: string): LanguageAdapter | null {
  return BY_EXT.get(path.extname(file).toLowerCase()) ?? null;
}
