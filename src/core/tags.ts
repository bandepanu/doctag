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
export function parseKv(s_raw: string): Record<string, any> {
  const d_kv: Record<string, any> = {};
  let s_i = 0;
  const s_n = s_raw.length;
  while (s_i < s_n) {
    const s_eq = s_raw.indexOf("=", s_i);
    if (s_eq === -1) break;
    const s_key = s_raw.slice(s_i, s_eq).trim();
    const s_j = f_ScanKvVal(s_raw, s_eq + 1);
    const s_val = s_raw.slice(s_eq + 1, s_j).trim();
    d_kv[s_key] = f_Coerce(s_val);
    s_i = s_j + 1;
  }
  return d_kv;
}

/** Scan one value to its end index — quote- and bracket-depth-aware. */
function f_ScanKvVal(s_raw: string, s_i: number): number {
  let s_j = s_i;
  let s_depth = 0;
  let s_instr: string | null = null;
  const s_n = s_raw.length;
  while (s_j < s_n) {
    const s_c = s_raw[s_j];
    if (s_instr) {
      if (s_c === s_instr) s_instr = null;
      s_j++;
      continue;
    }
    if (s_c === '"' || s_c === "'") { s_instr = s_c; s_j++; continue; }
    if ("[{(".includes(s_c)) { s_depth++; s_j++; continue; }
    if ("]})".includes(s_c)) { s_depth--; s_j++; continue; }
    if (s_c === "," && s_depth === 0) return s_j;
    s_j++;
  }
  return s_j;
}

function f_Coerce(val: string): any {
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
