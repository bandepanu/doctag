// Vanilla CSS checks.
//   docdeps (errors): external @import and external url(...) assets (fonts/images
//                     from a CDN) must be on the allow-list.
//   smells (warnings): heavy !important use — a well-known specificity smell.
// Relative/local url()/@import are always allowed (your own assets).
import { Finding } from "./core/types";

const IMPORTANT_WARN_AT = 8; // more than this many !important in one file -> nudge

function hostOf(url: string): string | null {
  const clean = url.replace(/^["']|["']$/g, "");
  const m = clean.match(/^(?:https?:)?\/\/([^/]+)/i);
  return m ? m[1].toLowerCase() : null;
}
function allowedHost(host: string, whitelist: string[]): boolean {
  return whitelist.some((w) => {
    const lw = String(w).toLowerCase().replace(/^(?:https?:)?\/\//, "").replace(/\/.*$/, "");
    return host === lw || host.endsWith("." + lw);
  });
}
const lineOf = (src: string, idx: number) => src.slice(0, idx).split(/\r?\n/).length;

export function checkCss(src: string, whitelist: string[]): Finding[] {
  const findings: Finding[] = [];
  const ln = (i: number) => lineOf(src, i);
  let m: RegExpExecArray | null;

  if (whitelist.length) {
    // @import url("...") or @import "..."
    const importRe = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)/gi;
    while ((m = importRe.exec(src))) {
      const host = hostOf(m[1]);
      if (host && !allowedHost(host, whitelist)) findings.push({ level: "error", token: "docdeps", line: ln(m.index), message: `@import host '${host}' not in docdeps whitelist [${whitelist.join(", ")}]` });
    }
    // url(...) assets (fonts, background images)
    const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    while ((m = urlRe.exec(src))) {
      const host = hostOf(m[1]);
      if (host && !allowedHost(host, whitelist)) findings.push({ level: "error", token: "docdeps", line: ln(m.index), message: `url() asset host '${host}' not in docdeps whitelist [${whitelist.join(", ")}]` });
    }
  }

  const bangs = (src.match(/!important/gi) || []).length;
  if (bangs > IMPORTANT_WARN_AT) {
    findings.push({ level: "warning", token: "docslim", line: 1, message: `${bangs} uses of !important (> ${IMPORTANT_WARN_AT}) — a specificity smell; prefer clearer selectors` });
  }
  return findings;
}
