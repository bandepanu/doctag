// Vanilla HTML checks (no framework-specific parsing). HTML has no functions to
// police, but it CAN smuggle external dependencies and hide logic in inline blobs.
//   docdeps (errors): external <script src>, <link href> (styles/fonts), <img src>,
//                     and <script type="importmap"> hosts must be on the allow-list.
//   smells (warnings): inline <script>...</script> and <style>...</style> blocks —
//                     logic/CSS buried in markup, which nothing else can guard.
// Relative/local URLs are always allowed (your own assets, not external deps).
import { Finding } from "./core/types";

function hostOf(url: string): string | null {
  const m = url.match(/^(?:https?:)?\/\/([^/]+)/i);
  return m ? m[1].toLowerCase() : null; // null => relative/local (allowed)
}
function allowedHost(host: string, whitelist: string[]): boolean {
  return whitelist.some((w) => {
    const lw = String(w).toLowerCase().replace(/^(?:https?:)?\/\//, "").replace(/\/.*$/, "");
    return host === lw || host.endsWith("." + lw);
  });
}
const lineOfIdx = (src: string, idx: number) => src.slice(0, idx).split(/\r?\n/).length;

export function checkHtml(src: string, whitelist: string[]): Finding[] {
  const findings: Finding[] = [];
  const ln = (i: number) => lineOfIdx(src, i);
  let m: RegExpExecArray | null;

  if (whitelist.length) {
    // external URLs from src=, href=, and importmap
    const attrRe = /<(?:script|link|img|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi;
    while ((m = attrRe.exec(src))) {
      const host = hostOf(m[1]);
      if (host && !allowedHost(host, whitelist)) {
        findings.push({ level: "error", token: "docdeps", line: ln(m.index), message: `external asset host '${host}' not in docdeps whitelist [${whitelist.join(", ")}]` });
      }
    }
    const imapRe = /<script\b[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi;
    while ((m = imapRe.exec(src))) {
      let map: any; try { map = JSON.parse(m[1]); } catch { continue; }
      for (const url of Object.values(map.imports || {})) {
        const host = hostOf(String(url));
        if (host && !allowedHost(host, whitelist)) {
          findings.push({ level: "error", token: "docdeps", line: ln(m.index), message: `importmap host '${host}' not in docdeps whitelist [${whitelist.join(", ")}]` });
        }
      }
    }
  }

  // smells: inline script (with body, not src, not importmap) and inline style
  const inlineScript = /<script\b(?![^>]*\bsrc\s*=)(?![^>]*type\s*=\s*["']importmap["'])[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = inlineScript.exec(src))) {
    if (m[1].trim()) findings.push({ level: "warning", token: "docslim", line: ln(m.index), message: "inline <script> — move logic to a .js file so docdeps/docslim can guard it" });
  }
  const inlineStyle = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  while ((m = inlineStyle.exec(src))) {
    if (m[1].trim()) findings.push({ level: "warning", token: "docslim", line: ln(m.index), message: "inline <style> — move to a .css file" });
  }
  return findings;
}
