// Orchestration: emit the token_state_matrix for a file — the machine-readable packet
// an agent passes between build phases. For each Core token: is it present, and does it
// pass? This turns the validator into a state source for the phase state machine
// (see references/orchestration.md).
import * as fs from "fs";
import * as path from "path";
import { validateFile } from "./validate";
import { parseTags } from "./core/tags";
import { adapterForFile } from "./adapters";

const CORE = ["doctype", "docslim", "docdeps", "docpure", "doctest", "docinv", "docref"];

export interface TokenState { present: boolean; status: "PASS" | "FAIL" | "ABSENT" }

export async function tokenStateMatrix(file: string, explicitConfig?: string): Promise<any> {
  const report = await validateFile(file, explicitConfig);
  const src = fs.readFileSync(file, "utf8");
  const adapter = adapterForFile(file);
  const lines = src.split(/\r?\n/);
  const tags = adapter ? parseTags(lines, adapter.commentLine) : [];
  const tagged = new Set(tags.map((t) => t.token));
  const hasPrefixParam = /(^|[^A-Za-z0-9_])[sadmfo]_/.test(src);
  const hasDoctest = />>>/.test(src);

  const present = (tok: string): boolean => {
    if (tok === "doctype") return hasPrefixParam;
    if (tok === "doctest") return hasDoctest || tagged.has("doctest");
    return tagged.has(tok);
  };
  const errTokens = new Set(report.findings.filter((f) => f.level === "error").map((f) => f.token));

  const matrix: Record<string, TokenState> = {};
  for (const tok of CORE) {
    const p = present(tok);
    matrix[tok] = { present: p, status: errTokens.has(tok) ? "FAIL" : p ? "PASS" : "ABSENT" };
  }
  return {
    file: path.relative(process.cwd(), file),
    language: report.meta.adapter,
    config: report.meta.config,
    errors: report.errors,
    warnings: report.warnings,
    token_state_matrix: matrix,
  };
}
