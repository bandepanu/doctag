import { FileReport } from "./types";

export function formatText(reports: FileReport[]): { text: string; hadError: boolean } {
  let hadError = false;
  const out: string[] = [];
  for (const r of reports) {
    hadError = hadError || r.errors > 0;
    out.push(`\n=== ${r.file} ===`);
    out.push(`  adapter: ${r.meta.adapter ?? "(none — unsupported extension)"}`);
    out.push(`  config:  ${r.meta.config ?? "(none found)"}`);
    if (r.findings.length === 0) out.push("  PASS — no violations");
    for (const f of r.findings) {
      const mark = f.level === "error" ? "ERROR" : "warn ";
      out.push(`  [${mark}] L${String(f.line).padEnd(4)} ${f.token.padEnd(9)} ${f.message}`);
    }
    out.push(`  -> ${r.errors} error(s), ${r.warnings} warning(s)`);
  }
  out.push(`\n${hadError ? "FAILED: violations found" : "OK: all files compliant"}`);
  return { text: out.join("\n"), hadError };
}
