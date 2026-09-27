// Impresión de resultados igual que psql 18 (print.c): alineado (bordes 0/1/2), expandido, sin alinear y CSV.
// Todo trabaja con texto: los valores llegan como los envía el servidor (formato texto del protocolo).

/** Tipos que psql alinea a la derecha (column_type_alignment). */
const RIGHT = new Set([20, 21, 23, 26, 28, 29, 700, 701, 790, 1700, 5069]);

/** Ancho en pantalla de un texto (los caracteres de ancho doble de Asia ocupan 2 columnas). */
export function strWidth(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 32 || (c >= 0x7f && c < 0xa0)) continue;
    if ((c >= 0x0300 && c <= 0x036f) || c === 0x200b) continue; // combinantes
    w += (c >= 0x1100 && (c <= 0x115f || c === 0x2329 || c === 0x232a || (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) || (c >= 0x20000 && c <= 0x3fffd))) ? 2 : 1;
  }
  return w;
}

const pad = (n) => (n > 0 ? " ".repeat(n) : "");
/** Separa en líneas y expande tabuladores a múltiplos de 8, como pg_wcsformat. */
const lines = (v) => String(v).split("\n").map((l) => {
  if (!l.includes("\t")) return l;
  let o = "";
  for (const ch of l) o += ch === "\t" ? " ".repeat(8 - (strWidth(o) % 8)) : ch;
  return o;
});

/**
 * @typedef {{ format?: string, border?: number, expanded?: "on"|"off"|"auto", tuplesOnly?: boolean, null?: string,
 *   footer?: boolean, fieldsep?: string, recordsep?: string, columns?: number, csvFieldsep?: string }} PrintOpts
 * @typedef {{ title?: string, headers: string[], types?: number[], rows: (string|null)[][], footers?: string[]|null, defaultFooter?: boolean, align?: string[] }} Table
 */

/** Pie por defecto «(N rows)». */
export const rowsFooter = (n) => `(${n} ${n === 1 ? "row" : "rows"})`;

/** Devuelve el texto que imprimiría psql para una tabla (termina en \n cuando corresponde). */
export function printTable(t, opt = {}) {
  const o = { format: "aligned", border: 1, expanded: "off", tuplesOnly: false, null: "", footer: true, fieldsep: "|", csvFieldsep: ",", columns: 100, ...opt };
  const rows = t.rows.map((r) => r.map((v) => (v === null || v === undefined ? o.null : v)));
  const align = t.align || t.headers.map((_, i) => (t.types && RIGHT.has(t.types[i]) ? "r" : "l"));
  const footers = t.footers !== undefined && t.footers !== null ? t.footers : t.defaultFooter === false ? [] : [rowsFooter(t.rows.length)];
  const showFooters = !o.tuplesOnly && o.footer !== false;

  if (o.format === "csv") return printCsv(t.headers, t.rows, o);
  if (o.format === "unaligned") {
    let out = "";
    if (!o.tuplesOnly && t.title) out += t.title + "\n";
    if (o.expanded === "on") {
      rows.forEach((r, i) => {
        if (i > 0) out += "\n";
        r.forEach((v, j) => (out += t.headers[j] + o.fieldsep + v + "\n"));
      });
    } else {
      if (!o.tuplesOnly) out += t.headers.join(o.fieldsep) + "\n";
      for (const r of rows) out += r.join(o.fieldsep) + "\n";
    }
    if (showFooters && !(o.expanded === "on" && !t.footers)) for (const f of footers) out += f + "\n";
    return out;
  }
  let expanded = o.expanded === "on";
  if (o.expanded === "auto") {
    const aligned = alignedText(t, rows, align, footers, o, showFooters);
    const widest = Math.max(0, ...aligned.split("\n").map(strWidth));
    if (widest <= o.columns) return aligned;
    expanded = true;
  }
  if (expanded) return expandedText(t, rows, footers, o, showFooters);
  return alignedText(t, rows, align, footers, o, showFooters);
}

function alignedText(t, rows, align, footers, o, showFooters) {
  const ncol = t.headers.length;
  const border = o.border;
  const cells = rows.map((r) => r.map(lines));
  const heads = t.headers.map(lines);
  const w = t.headers.map((_, i) => {
    let m = Math.max(0, ...heads[i].map(strWidth));
    for (const r of cells) for (const l of r[i]) m = Math.max(m, strWidth(l));
    return m;
  });
  let out = "";
  const total = w.reduce((a, b) => a + b, 0) + (border === 0 ? ncol : border === 1 ? ncol * 3 - (ncol > 0 ? 1 : 0) : ncol * 3 + 1);
  if (t.title && !o.tuplesOnly) {
    // psql centra el título según su línea más ancha y solo sangra la primera línea
    const tw = Math.max(...t.title.split("\n").map(strWidth));
    out += (total >= tw ? pad(Math.floor((total - tw) / 2)) : "") + t.title + "\n";
  }
  const sepLine = () =>
    border === 0 ? w.map((x) => "-".repeat(x)).join(" ") + "\n"
    : border === 1 ? w.map((x) => "-".repeat(x + 2)).join("+") + "\n"
    : "+" + w.map((x) => "-".repeat(x + 2)).join("+") + "+\n";
  if (border === 2) out += sepLine();
  if (!o.tuplesOnly && ncol > 0) {
    const hn = Math.max(1, ...heads.map((h) => h.length));
    for (let ln = 0; ln < hn; ln++) {
      let s = border === 2 ? "| " : border === 1 ? " " : "";
      for (let i = 0; i < ncol; i++) {
        const h = heads[i][ln] ?? "";
        const hw = strWidth(h);
        const more = ln < heads[i].length - 1;
        s += pad(Math.floor((w[i] - hw) / 2)) + h + pad(Math.ceil((w[i] - hw) / 2));
        s += more ? "+" : " ";
        if (i < ncol - 1) s += border === 0 ? "" : "| ";
      }
      if (border === 2) s += "|";
      out += s + "\n";
    }
    out += sepLine();
  }
  for (const r of cells) {
    const n = Math.max(1, ...r.map((c) => c.length));
    for (let ln = 0; ln < n; ln++) {
      let s = border === 2 ? "| " : border === 1 ? " " : "";
      for (let i = 0; i < ncol; i++) {
        const c = r[i];
        const v = c[ln] ?? "";
        const vw = strWidth(v);
        const more = ln < c.length - 1;
        const last = i === ncol - 1;
        if (last && border !== 2 && ln >= c.length) s += "";
        else if (align[i] === "r") s += pad(w[i] - vw) + v;
        else if (!last || border === 2 || more) s += v + pad(w[i] - vw);
        else s += v;
        if (!last) s += (more ? "+" : " ") + (border === 0 ? "" : "| ");
        else if (border === 2) s += (more ? "+" : " ") + "|";
        else if (more) s += "+";
      }
      out += s + "\n";
    }
  }
  if (border === 2) out += sepLine();
  if (showFooters) for (const f of footers) out += f + "\n";
  return out + "\n";
}

function expandedText(t, rows, footers, o, showFooters) {
  const border = o.border;
  const heads = t.headers;
  const hw = Math.max(0, ...heads.map(strWidth));
  let dw = 0;
  for (const r of rows) for (const v of r) for (const l of lines(v)) dw = Math.max(dw, strWidth(l));
  let out = "";
  if (t.title && !o.tuplesOnly) out += t.title + "\n";
  if (!rows.length) {
    if (showFooters) out += "(0 rows)\n";
    return out + "\n";
  }
  rows.forEach((r, k) => {
    if (!o.tuplesOnly) {
      // print_aligned_vertical_line de psql
      let h = border === 2 ? "+-" : border === 1 ? "-" : "";
      const label = border === 0 ? `* Record ${k + 1}` : `[ RECORD ${k + 1} ]`;
      h += label;
      let reclen = label.length;
      if (border !== 2) reclen++;
      for (let i = reclen; i < hw; i++) h += border > 0 ? "-" : " ";
      reclen -= hw;
      if (border > 0) {
        if (reclen-- <= 0) h += "-";
        if (reclen-- <= 0) h += "+";
        if (reclen-- <= 0) h += "-";
      } else if (reclen-- <= 0) h += " ";
      if (reclen < 0) reclen = 0;
      for (let i = reclen; i < dw; i++) h += border > 0 ? "-" : " ";
      if (border === 2) h += "-+";
      out += h + "\n";
    } else if (k > 0) out += "\n";
    r.forEach((v, j) => {
      const ls = lines(v);
      ls.forEach((l, li) => {
        const name = li === 0 ? heads[j] : "";
        const more = li < ls.length - 1;
        if (border === 2) out += "| " + name + pad(hw - strWidth(name)) + " | " + l + pad(dw - strWidth(l)) + (more ? "+" : " ") + "|\n";
        else if (border === 1) out += name + pad(hw - strWidth(name)) + " | " + l + (more ? "+" : "") + "\n";
        else out += name + pad(hw - strWidth(name)) + " " + l + (more ? "+" : "") + "\n";
      });
    });
  });
  if (border === 2) out += "+" + "-".repeat(hw + 2) + "+" + "-".repeat(dw + 2) + "+\n";
  if (showFooters && footers.length && t.footers) for (const f of footers) out += f + "\n";
  return out + "\n";
}

function printCsv(headers, rows, o) {
  const sep = o.csvFieldsep || ",";
  const q = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s === "" || s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r") || s === "\\.") return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  let out = "";
  if (!o.tuplesOnly) out += headers.map(q).join(sep) + "\n";
  for (const r of rows) out += r.map(q).join(sep) + "\n";
  return out;
}
