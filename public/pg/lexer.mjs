// Analizador léxico de psql (psqlscan.l, simplificado): decide dónde termina cada sentencia,
// qué prompt de continuación corresponde y dónde empieza un meta-comando. También interpola :variables.

const isIdentStart = (c) => /[A-Za-z_\u0080-￿]/.test(c);
const isIdentChar = (c) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

export function quoteLiteral(v) {
  const s = String(v);
  const body = s.replace(/'/g, "''");
  return s.includes("\\") ? " E'" + body.replace(/\\/g, "\\\\") + "'" : "'" + body + "'";
}
export const quoteIdent = (v) => '"' + String(v).replace(/"/g, '""') + '"';

export class Scanner {
  constructor() {
    this.buf = "";
    this.reset();
  }

  reset() {
    this.buf = "";
    this.state = null; // null | "q" (') | "e" (E') | "d" (") | "$" (dollar) | "c" (comment)
    this.tag = "";
    this.depth = 0;
    this.paren = 0;
    this.idents = [];
    this.identCount = 0;
    this.beginDepth = 0;
  }

  /** Carácter de %R para PROMPT2 según el estado. */
  promptChar() {
    if (this.state === "c") return "*";
    if (this.state === "d") return '"';
    if (this.state === "q" || this.state === "e") return "'";
    if (this.state === "$") return "$";
    if (this.paren > 0) return "(";
    return "-";
  }

  /** ¿Hay una sentencia a medio escribir? */
  pending() {
    return this.buf.length > 0 || this.state !== null;
  }

  trackIdent(word) {
    if (this.identCount === 0) this.idents = [0, 0, 0, 0];
    const low = word.toLowerCase();
    if (["create", "function", "procedure", "or", "replace"].includes(low) && this.identCount < 4) this.idents[this.identCount] = low[0];
    this.identCount++;
    const id = this.idents;
    if (id[0] === "c" && (id[1] === "f" || id[1] === "p" || (id[1] === "o" && id[2] === "r" && (id[3] === "f" || id[3] === "p"))) && this.paren === 0) {
      if (low === "begin") this.beginDepth++;
      else if (low === "case") { if (this.beginDepth >= 1) this.beginDepth++; }
      else if (low === "end") { if (this.beginDepth > 0) this.beginDepth--; }
    }
  }

  /**
   * Analiza `line` desde `pos`. Agrega el texto al búfer y se detiene en:
   *  - { kind: "semi", next }   fin de sentencia (el ';' queda en el búfer)
   *  - { kind: "meta", at }     barra invertida fuera de comillas (meta-comando)
   *  - { kind: "eol" }          fin de la línea
   * @param {string} line  @param {number} pos  @param {(name: string) => string|undefined} getVar
   */
  scan(line, pos, getVar) {
    let i = pos;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      const c2 = line[i + 1];
      if (this.state === "c") {
        if (c === "/" && c2 === "*") { this.depth++; this.buf += "/*"; i += 2; continue; }
        if (c === "*" && c2 === "/") { this.depth--; this.buf += "*/"; i += 2; if (this.depth === 0) this.state = null; continue; }
        this.buf += c; i++; continue;
      }
      if (this.state === "q") {
        if (c === "'") {
          if (c2 === "'") { this.buf += "''"; i += 2; continue; }
          this.buf += c; i++; this.state = null; continue;
        }
        this.buf += c; i++; continue;
      }
      if (this.state === "e") {
        if (c === "\\" && i + 1 < n) { this.buf += c + c2; i += 2; continue; }
        if (c === "'") {
          if (c2 === "'") { this.buf += "''"; i += 2; continue; }
          this.buf += c; i++; this.state = null; continue;
        }
        this.buf += c; i++; continue;
      }
      if (this.state === "d") {
        if (c === '"') {
          if (c2 === '"') { this.buf += '""'; i += 2; continue; }
          this.buf += c; i++; this.state = null; continue;
        }
        this.buf += c; i++; continue;
      }
      if (this.state === "$") {
        if (line.startsWith(this.tag, i)) { this.buf += this.tag; i += this.tag.length; this.state = null; continue; }
        this.buf += c; i++; continue;
      }
      // Estado inicial
      if (/\s/.test(c)) { if (this.buf.length) this.buf += c; i++; continue; }
      if (c === "-" && c2 === "-") {
        if (this.buf.length) this.buf += line.slice(i);
        return { kind: "eol" };
      }
      if (c === "/" && c2 === "*") { this.state = "c"; this.depth = 1; this.buf += "/*"; i += 2; continue; }
      if (c === "'") {
        const prev = this.buf[this.buf.length - 1];
        const prev2 = this.buf[this.buf.length - 2];
        this.state = (prev === "E" || prev === "e") && !(prev2 && isIdentChar(prev2)) ? "e" : "q";
        this.buf += c; i++; continue;
      }
      if (c === '"') { this.state = "d"; this.buf += c; i++; continue; }
      if (c === "$") {
        const prev = this.buf[this.buf.length - 1];
        const m = /^\$([A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(line.slice(i));
        if (m && !(prev && isIdentChar(prev))) { this.state = "$"; this.tag = m[0]; this.buf += m[0]; i += m[0].length; continue; }
        this.buf += c; i++; continue;
      }
      if (c === "(") { this.paren++; this.buf += c; i++; continue; }
      if (c === ")") { if (this.paren > 0) this.paren--; this.buf += c; i++; continue; }
      if (c === ";") {
        this.buf += c; i++;
        if (this.paren === 0 && this.beginDepth === 0) return { kind: "semi", next: i };
        continue;
      }
      if (c === "\\") return { kind: "meta", at: i };
      if (c === ":") {
        if (c2 === ":") { this.buf += "::"; i += 2; continue; }
        const m = /^:(?:'([A-Za-z0-9_\u0080-￿]+)'|"([A-Za-z0-9_\u0080-￿]+)"|\{\?([A-Za-z0-9_\u0080-￿]+)\}|([A-Za-z0-9_\u0080-￿]+))/.exec(line.slice(i));
        if (m) {
          const name = m[1] || m[2] || m[3] || m[4];
          const v = getVar(name);
          if (m[3]) { this.buf += v !== undefined ? "TRUE" : "FALSE"; i += m[0].length; continue; }
          if (v !== undefined) {
            this.buf += m[1] ? quoteLiteral(v).trim() : m[2] ? quoteIdent(v) : v;
            i += m[0].length;
            continue;
          }
          this.buf += m[0]; i += m[0].length; continue;
        }
        this.buf += c; i++; continue;
      }
      if (isIdentStart(c)) {
        let j = i + 1;
        while (j < n && isIdentChar(line[j])) j++;
        const word = line.slice(i, j);
        this.trackIdent(word);
        this.buf += word; i = j; continue;
      }
      this.buf += c; i++;
    }
    return { kind: "eol" };
  }

  /** Termina la sentencia actual: devuelve el texto y deja el analizador listo para la siguiente. */
  take() {
    const s = this.buf;
    this.reset();
    return s;
  }
}

/**
 * Separa un script en sentencias (para ejecutar archivos o scripts del editor).
 * Devuelve [{ sql, line }] donde line es el número de línea (1-based) donde empieza.
 */
export function splitStatements(text) {
  const sc = new Scanner();
  const out = [];
  const lines = text.split("\n");
  let startLine = 0;
  lines.forEach((line, li) => {
    let pos = 0;
    for (;;) {
      const before = sc.buf.length;
      const r = sc.scan(line, pos, () => undefined);
      if (before === 0 && sc.buf.length > 0) startLine = li + 1;
      if (r.kind === "semi") { out.push({ sql: sc.take(), line: startLine }); pos = r.next; continue; }
      if (r.kind === "meta") { sc.buf += line.slice(r.at); break; }
      break;
    }
    if (sc.buf.length) sc.buf += "\n";
  });
  const rest = sc.buf.trim();
  if (rest) out.push({ sql: rest, line: startLine });
  return out;
}
