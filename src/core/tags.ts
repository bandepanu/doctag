// Language-agnostic DocX tag extraction and key=value parsing.
// A tag is any comment of the form:  <comment> @doctoken: key = value, key = [..]

export interface Tag {
  line: number;
  token: string;
  kv: Record<string, any>;
}

export function parseTags(lines: string[], commentMarker: string): Tag[] {
  const esc = commentMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${esc}\\s*@(doc[a-z]+)\\s*:\\s*(.*)$`);
  const out: Tag[] = [];
  lines.forEach((ln, i) => {
    const m = ln.match(re);
    if (m) out.push({ line: i + 1, token: m[1], kv: parseKv(m[2].trim()) });
  });
  return out;
}

/** Best-effort parse of `key = value, key = [..]` into JS values. Depth/quote aware. */
export function parseKv(raw: string): Record<string, any> {
  const d: Record<string, any> = {};
  let i = 0;
  const n = raw.length;
  while (i < n) {
    const eq = raw.indexOf("=", i);
    if (eq === -1) break;
    const key = raw.slice(i, eq).trim();
    let j = eq + 1;
    let depth = 0;
    let instr: string | null = null;
    while (j < n) {
      const c = raw[j];
      if (instr) {
        if (c === instr) instr = null;
      } else if (c === '"' || c === "'") {
        instr = c;
      } else if ("[{(".includes(c)) depth++;
      else if ("]})".includes(c)) depth--;
      else if (c === "," && depth === 0) break;
      j++;
    }
    const val = raw.slice(eq + 1, j).trim();
    d[key] = coerce(val);
    i = j + 1;
  }
  return d;
}

function coerce(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    const low = val.toLowerCase();
    if (low === "true") return true;
    if (low === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
    return val.replace(/^['"]|['"]$/g, "");
  }
}
