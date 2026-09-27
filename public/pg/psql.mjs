// Consola psql simulada (comportamiento de psql 18) sobre un PostgreSQL 18 en WebAssembly (PGlite).
// No depende de PGlite directamente: recibe un «env» que ejecuta mensajes del protocolo.

import { Scanner, quoteLiteral, quoteIdent } from "./lexer.mjs";
import { printTable } from "./print.mjs";
import { Describe } from "./describe.mjs";

const COPY_BANNER = "Enter data to be copied followed by a newline.\nEnd with a backslash and a period on a line by itself, or an EOF signal.\n";
const decoder = new TextDecoder();

/** Posición del error con «LINE n:» y el ^ (reportErrorPosition de libpq). */
export function errorPosition(query, loc) {
  const DISPLAY = 60, MINCUT = 10;
  const chars = Array.from(query.replace(/\t/g, " "));
  loc -= 1;
  if (loc < 0) return "";
  let line = 1, ibeg = 0, iend = -1, cno = 0;
  for (; cno < chars.length; cno++) {
    const ch = chars[cno];
    if (ch === "\r" || ch === "\n") {
      if (cno < loc) {
        if (ch === "\r" || cno === 0 || chars[cno - 1] !== "\r") line++;
        ibeg = cno + 1;
      } else { iend = cno; break; }
    }
  }
  if (iend < 0) iend = cno;
  if (loc > cno) return "";
  let begTrunc = false, endTrunc = false;
  if (iend - ibeg > DISPLAY) {
    if (ibeg + DISPLAY >= loc + MINCUT) {
      while (iend - ibeg > DISPLAY) iend--;
      endTrunc = true;
    } else {
      while (loc + MINCUT < iend) { iend--; endTrunc = true; }
      while (iend - ibeg > DISPLAY) { ibeg++; begTrunc = true; }
    }
  }
  const prefix = `LINE ${line}: ` + (begTrunc ? "..." : "");
  return prefix + chars.slice(ibeg, iend).join("") + (endTrunc ? "..." : "") + "\n" + " ".repeat(prefix.length + (loc - ibeg)) + "^\n";
}

const DEFAULT_VARS = {
  AUTOCOMMIT: "on", COMP_KEYWORD_CASE: "preserve-upper", ECHO: "none", ECHO_HIDDEN: "off", ENCODING: "UTF8", ERROR: "false",
  FETCH_COUNT: "0", HIDE_TABLEAM: "off", HIDE_TOAST_COMPRESSION: "off", HISTCONTROL: "none", HOST: "/tmp", IGNOREEOF: "0",
  LAST_ERROR_MESSAGE: "", LAST_ERROR_SQLSTATE: "00000", ON_ERROR_ROLLBACK: "off", ON_ERROR_STOP: "off", PORT: "5432",
  PROMPT1: "%/%R%x%# ", PROMPT2: "%/%R%x%# ", PROMPT3: ">> ", QUIET: "off", ROW_COUNT: "0", SERVER_VERSION_NAME: "18.3",
  SERVER_VERSION_NUM: "180003", SHELL_ERROR: "false", SHELL_EXIT_CODE: "0", SHOW_ALL_RESULTS: "on", SHOW_CONTEXT: "errors",
  SINGLELINE: "off", SINGLESTEP: "off", SQLSTATE: "00000", VERBOSITY: "default", VERSION_NAME: "18.3", VERSION_NUM: "180003",
  VERSION: "PostgreSQL 18.3 on wasm32-unknown-emscripten, compiled by emcc, 32-bit",
};

/** Comandos que psql no envuelve en BEGIN con AUTOCOMMIT off (command_no_begin). */
function noBegin(sql) {
  const s = sql.replace(/^\s+|\/\*[\s\S]*?\*\/|--[^\n]*\n/g, "").toLowerCase();
  return /^(begin|start|commit|end|rollback|abort|savepoint|release|prepare\s+transaction|commit\s+prepared|rollback\s+prepared|vacuum|cluster|create\s+database|drop\s+database|alter\s+system|create\s+tablespace|drop\s+tablespace|reindex\s+(database|system)|discard\s+all|(create|drop|reindex)\s+(unique\s+)?index\s+concurrently)\b/.test(s);
}
const isTxCommand = (sql) => /^\s*(begin|start|commit|end|rollback|abort|savepoint|release|prepare\s+transaction)\b/i.test(sql);

export class Psql {
  /**
   * @param {{ exec: (sql: string) => Promise<any[]>, copyFrom: (sql: string, data: string) => Promise<any[]>,
   *   connect: (db: string, user: string) => Promise<{ error?: string }>, help: () => Promise<any>, now: () => number,
   *   files: Map<string, string> }} env
   * @param {{ db: string, user: string, width?: number }} conn
   */
  constructor(env, conn) {
    this.env = env;
    this.db = conn.db;
    this.user = conn.user;
    this.superuser = true;
    this.pid = 0;
    this.tx = "I";
    this.sc = new Scanner();
    this.vars = new Map(Object.entries({ ...DEFAULT_VARS, DBNAME: conn.db, USER: conn.user }));
    this.pset = { format: "aligned", border: 1, expanded: "off", tuplesOnly: false, null: "", footer: true, fieldsep: "|", csvFieldsep: ",", columns: conn.width || 100, title: "" };
    this.timing = false;
    this.lastQuery = "";
    this.copy = null;
    this.lastError = null;
    this.lineNo = 1;
    this.src = null; // { name, line } cuando se ejecuta un archivo (\i o un script)
    this.errors = [];
    this.collector = null;
    this.history = [];
    this.describe = new Describe((sql) => this.hidden(sql), () => ({ ...this.pset }), () => this.vars.get("ECHO_HIDDEN") === "on");
  }

  /** Datos de conexión tras abrir o cambiar de base (\c). */
  async refresh() {
    const r = await this.hiddenSafe("SELECT current_setting('is_superuser'), pg_backend_pid(), current_user");
    if (r) {
      this.superuser = r.rows[0][0] === "on";
      this.pid = Number(r.rows[0][1]);
    }
    this.vars.set("DBNAME", this.db);
    this.vars.set("USER", this.user);
  }

  // ---------- Prompt ----------
  prompt() {
    const which = this.copy ? "PROMPT3" : this.sc.pending() ? "PROMPT2" : "PROMPT1";
    return this.expandPrompt(this.vars.get(which) ?? "", which);
  }

  expandPrompt(p, which) {
    let out = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c !== "%") { out += c; continue; }
      const n = p[++i];
      switch (n) {
        case "/": out += this.db; break;
        case "~": out += this.db === this.user ? "~" : this.db; break;
        case "n": out += this.user; break;
        case "#": out += this.superuser ? "#" : ">"; break;
        case "R": out += which === "PROMPT1" ? (this.vars.get("SINGLELINE") === "on" ? "^" : "=") : which === "PROMPT2" ? this.sc.promptChar() : ""; break;
        case "x": out += this.tx === "T" ? "*" : this.tx === "E" ? "!" : ""; break;
        case "m": case "M": out += "[local]"; break;
        case ">": out += "5432"; break;
        case "p": out += String(this.pid); break;
        case "l": out += String(this.lineNo); break;
        case "w": out += " ".repeat(this.expandPrompt(this.vars.get("PROMPT1") ?? "", "PROMPT1").length); break;
        case "%": out += "%"; break;
        case "[": case "]": break;
        case ":": {
          const end = p.indexOf(":", i + 1);
          if (end > i) { out += this.vars.get(p.slice(i + 1, end)) ?? ""; i = end; }
          break;
        }
        default:
          if (/[0-7]/.test(n)) {
            let j = i, oct = "";
            while (j < p.length && oct.length < 3 && /[0-7]/.test(p[j])) oct += p[j++];
            out += String.fromCharCode(parseInt(oct, 8));
            i = j - 1;
          } else if (n !== undefined) out += n;
      }
    }
    return out;
  }

  // ---------- Entrada ----------
  /**
   * Procesa texto como si se escribiera en psql (una o varias líneas).
   * @returns {Promise<{ events: {prompt: string, line: string, out: string}[], quit?: boolean, editor?: string }>}
   */
  async feed(text, { script = null } = {}) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    const events = [];
    const res = { events };
    const prevSrc = this.src;
    if (script) this.src = { name: script, line: 0 };
    for (const line of lines) {
      if (this.src) this.src.line++;
      else if (line.trim()) this.history.push(line);
      const prompt = script ? "" : this.prompt();
      const r = await this.line(line);
      events.push({ prompt, line, out: r.out });
      if (r.quit) { res.quit = true; break; }
      if (r.editor !== undefined) { res.editor = r.editor; break; }
    }
    if (script) {
      // Al final de un archivo, psql envía lo que quede en el búfer.
      if (this.sc.pending() && this.sc.buf.trim()) {
        const sql = this.sc.take();
        const out = await this.sendQuery(sql);
        if (out) events.push({ prompt: "", line: "", out });
      } else this.sc.reset();
      if (this.copy) { this.copy = null; }
    }
    this.src = prevSrc;
    return res;
  }

  async line(line) {
    if (this.copy) return { out: await this.copyLine(line) };
    // En modo interactivo, psql reconoce «help», «quit» y «exit» escritos solos.
    if (!this.src) {
      const w = line.trim().replace(/;$/, "").trim().toLowerCase();
      if (w === "help" && !this.sc.pending()) return { out: PSQL_HELP };
      if (w === "quit" || w === "exit") {
        if (!this.sc.pending()) return { out: "", quit: true };
        return { out: "Use \\q to quit.\n" };
      }
    }
    let out = "";
    let pos = 0;
    for (;;) {
      const r = this.sc.scan(line, pos, (n) => this.vars.get(n));
      if (r.kind === "semi") {
        const sql = this.sc.take();
        out += await this.sendQuery(sql);
        this.lineNo = 1;
        pos = r.next;
        if (this.copy) return { out };
        continue;
      }
      if (r.kind === "meta") {
        const m = await this.meta(line, r.at);
        out += m.out || "";
        if (m.quit || m.editor !== undefined) return { out, quit: m.quit, editor: m.editor };
        if (this.copy) return { out };
        pos = m.next;
        if (pos >= line.length) break;
        continue;
      }
      break;
    }
    if (this.sc.pending()) { this.sc.buf += "\n"; this.lineNo++; }
    return { out };
  }

  // ---------- Consultas ----------
  /** Ejecuta una consulta interna (meta-comandos) y devuelve filas en texto. Lanza el error del servidor. */
  async hidden(sql) {
    const msgs = await this.env.exec(sql);
    let fields = [], rows = [], err = null;
    for (const m of msgs) {
      if (m.name === "rowDescription") { fields = m.fields; rows = []; }
      else if (m.name === "dataRow") rows.push(m.fields);
      else if (m.name === "error") err = m;
      else if (m.name === "readyForQuery") this.tx = m.status;
    }
    if (err) throw err;
    return { fields, rows };
  }

  async hiddenSafe(sql) {
    try { return await this.hidden(sql); } catch { return null; }
  }

  prefix() {
    return this.src ? `psql:${this.src.name}:${this.src.line}: ` : "";
  }

  formatMessage(e, query) {
    const verbosity = this.vars.get("VERBOSITY") || "default";
    const sev = e.severity || "ERROR";
    const isError = sev === "ERROR" || sev === "FATAL" || sev === "PANIC";
    if (verbosity === "sqlstate") return this.prefix() + `${sev}:  ${e.code}\n`;
    let s = this.prefix() + sev + ":  " + (verbosity === "verbose" && e.code ? e.code + ": " : "") + e.message;
    let qtext = null, qpos = 0;
    if (e.position) {
      if (verbosity !== "terse" && query) { qtext = query; qpos = Number(e.position); }
      else s += ` at character ${e.position}`;
    } else if (e.internalPosition) {
      if (verbosity !== "terse" && e.internalQuery) { qtext = e.internalQuery; qpos = Number(e.internalPosition); }
      else s += ` at character ${e.internalPosition}`;
    }
    s += "\n";
    if (verbosity !== "terse") {
      if (qtext) s += errorPosition(qtext, qpos);
      if (e.detail) s += `DETAIL:  ${e.detail}\n`;
      if (e.hint) s += `HINT:  ${e.hint}\n`;
      if (e.internalQuery) s += `QUERY:  ${e.internalQuery}\n`;
      const sc = this.vars.get("SHOW_CONTEXT");
      if (e.where && (sc === "always" || (sc === "errors" && isError))) s += `CONTEXT:  ${e.where}\n`;
    }
    if (verbosity === "verbose") {
      if (e.schema) s += `SCHEMA NAME:  ${e.schema}\n`;
      if (e.table) s += `TABLE NAME:  ${e.table}\n`;
      if (e.column) s += `COLUMN NAME:  ${e.column}\n`;
      if (e.dataType) s += `DATATYPE NAME:  ${e.dataType}\n`;
      if (e.constraint) s += `CONSTRAINT NAME:  ${e.constraint}\n`;
      if (e.file) s += e.routine ? `LOCATION:  ${e.routine}, ${e.file}:${e.line}\n` : `LOCATION:  ${e.file}:${e.line}\n`;
    }
    return s;
  }

  setErrorVars(e) {
    this.vars.set("ERROR", e ? "true" : "false");
    this.vars.set("SQLSTATE", e ? e.code || "XX000" : "00000");
    if (e) {
      this.vars.set("LAST_ERROR_MESSAGE", e.message);
      this.vars.set("LAST_ERROR_SQLSTATE", e.code || "XX000");
    }
  }

  isCopyFromStdin(sql) {
    return /^\s*copy\b[\s\S]*?\bfrom\s+stdin\b/i.test(sql);
  }

  async sendQuery(sql, opts = {}) {
    if (!sql.replace(/;/g, "").trim()) {
      await this.env.exec(sql);
      return "";
    }
    this.lastQuery = sql;
    if (this.isCopyFromStdin(sql)) {
      this.copy = { sql, lines: [] };
      return this.src ? "" : COPY_BANNER;
    }
    let out = "";
    if (this.vars.get("AUTOCOMMIT") === "off" && this.tx === "I" && !noBegin(sql)) await this.hiddenSafe("BEGIN");
    const oer = this.vars.get("ON_ERROR_ROLLBACK");
    const useSp = (oer === "on" || (oer === "interactive" && !this.src)) && this.tx === "T" && !isTxCommand(sql);
    if (useSp) await this.hiddenSafe("SAVEPOINT pg_psql_temporary_savepoint");
    const t0 = this.env.now();
    const msgs = await this.env.exec(sql);
    const dt = this.env.now() - t0;
    const r = this.render(msgs, sql, opts);
    out += r.out;
    if (useSp) {
      if (r.error) await this.hiddenSafe("ROLLBACK TO pg_psql_temporary_savepoint");
      else if (this.tx === "T") await this.hiddenSafe("RELEASE pg_psql_temporary_savepoint");
    }
    if (/^\s*(set|reset)\b/i.test(sql) && !r.error) await this.refresh();
    if (this.timing) out += `Time: ${fmtTime(dt)}\n`;
    return out;
  }

  /** Convierte los mensajes del protocolo en lo que imprimiría psql. */
  render(msgs, sql, opts = {}) {
    const sink = opts.results || this.collector;
    let out = "";
    let cur = null;
    let error = null;
    let copyOut = false;
    const notifs = [];
    for (const m of msgs) {
      switch (m.name) {
        case "rowDescription": cur = { fields: m.fields, rows: [] }; break;
        case "dataRow": if (cur) cur.rows.push(m.fields); break;
        case "commandComplete": {
          out += this.printResult(cur, m.text, copyOut, opts);
          const n = /(\d+)$/.exec(m.text);
          this.vars.set("ROW_COUNT", n ? n[1] : "0");
          if (sink) sink.push({ sql, tag: m.text, fields: cur ? cur.fields.map((f) => ({ name: f.name, type: f.dataTypeID })) : null, rows: cur ? cur.rows : null });
          cur = null; copyOut = false;
          break;
        }
        case "copyOutResponse": copyOut = true; break;
        case "copyData": out += decoder.decode(m.chunk); break;
        case "notice": out += this.formatMessage(m, sql); break;
        case "error": error = m; out += this.formatMessage(m, sql); this.lastError = { e: m, sql }; this.errors.push({ sql, message: m.message, code: m.code }); if (sink) sink.push({ sql, error: { message: m.message, code: m.code, position: m.position } }); break;
        case "notification": notifs.push(m); break;
        case "readyForQuery": this.tx = m.status; break;
        case "parameterStatus":
          if (m.parameterName === "is_superuser") this.superuser = m.parameterValue === "on";
          break;
        default: break;
      }
    }
    for (const n of notifs) out += `Asynchronous notification "${n.channel}"${n.payload ? ` with payload "${n.payload}"` : ""} received from server process with PID ${n.processId}.\n`;
    this.setErrorVars(error);
    return { out, error };
  }

  printResult(cur, tag, copyOut, opts) {
    if (copyOut) return "";
    const quiet = this.vars.get("QUIET") === "on";
    if (cur) {
      if (opts.gset !== undefined) return this.gset(cur, opts.gset);
      if (opts.collect) { opts.collect.push(cur); return ""; }
      const popt = { ...this.pset };
      if (opts.expanded) popt.expanded = "on";
      if (opts.pset) Object.assign(popt, opts.pset);
      let s = printTable({ title: this.pset.title || undefined, headers: cur.fields.map((f) => f.name), types: cur.fields.map((f) => f.dataTypeID), rows: cur.rows }, popt);
      if (/^(INSERT|UPDATE|DELETE|MERGE)\b/.test(tag) && !quiet) s += tag + "\n";
      return s;
    }
    return quiet ? "" : tag + "\n";
  }

  gset(cur, prefix) {
    if (cur.rows.length === 0) return "no rows returned for \\gset\n";
    if (cur.rows.length > 1) return "more than one row returned for \\gset\n";
    cur.fields.forEach((f, i) => {
      const v = cur.rows[0][i];
      const name = prefix + f.name;
      if (v === null) this.vars.delete(name);
      else this.vars.set(name, v);
    });
    return "";
  }

  async copyLine(line) {
    if (line === "\\.") {
      const { sql, lines } = this.copy;
      this.copy = null;
      const data = lines.length ? lines.join("\n") + "\n" : "";
      const msgs = await this.env.copyFrom(sql, data);
      return this.render(msgs, sql).out;
    }
    this.copy.lines.push(line);
    return "";
  }

  // ---------- Meta-comandos ----------
  parseArgs(s) {
    const args = [];
    let i = 0;
    const n = s.length;
    while (i < n) {
      while (i < n && /\s/.test(s[i])) i++;
      if (i >= n) break;
      if (s[i] === "\\") break;
      let tok = "";
      while (i < n && !/\s/.test(s[i])) {
        const c = s[i];
        if (c === "'") {
          i++;
          while (i < n) {
            if (s[i] === "'" && s[i + 1] === "'") { tok += "'"; i += 2; continue; }
            if (s[i] === "'") { i++; break; }
            if (s[i] === "\\" && i + 1 < n) {
              const e = s[i + 1];
              tok += e === "n" ? "\n" : e === "t" ? "\t" : e === "r" ? "\r" : e;
              i += 2; continue;
            }
            tok += s[i++];
          }
          continue;
        }
        if (c === '"') {
          tok += c; i++;
          while (i < n) {
            if (s[i] === '"' && s[i + 1] === '"') { tok += '""'; i += 2; continue; }
            if (s[i] === '"') { tok += '"'; i++; break; }
            tok += s[i++];
          }
          continue;
        }
        if (c === ":" && s[i + 1] !== ":") {
          const m = /^:(?:'([A-Za-z0-9_]+)'|"([A-Za-z0-9_]+)"|([A-Za-z0-9_]+))/.exec(s.slice(i));
          if (m) {
            const v = this.vars.get(m[1] || m[2] || m[3]);
            if (v !== undefined) { tok += m[1] ? quoteLiteral(v).trim() : m[2] ? quoteIdent(v) : v; i += m[0].length; continue; }
          }
        }
        if (c === "\\") break;
        tok += c; i++;
      }
      args.push(tok);
    }
    return { args, end: i };
  }

  async meta(line, at) {
    const m = /^\\(\?|!|\\|[A-Za-z][A-Za-z0-9+]*)/.exec(line.slice(at));
    if (!m) return { out: "invalid command \\\nTry \\? for help.\n", next: line.length };
    const cmd = m[1];
    const restStart = at + m[0].length;
    const rest = line.slice(restStart);
    const whole = ["copy", "h", "help", "!", "sf", "sf+", "sv", "sv+"].includes(cmd);
    const parsed = whole ? { args: [], end: rest.length } : this.parseArgs(rest);
    const args = parsed.args;
    let next = restStart + parsed.end;
    if (line.slice(next, next + 2) === "\\\\") next += 2;
    try {
      const out = await this.runMeta(cmd, args, rest.trim());
      if (out && typeof out === "object") return { ...out, next };
      return { out: out ?? "", next };
    } catch (e) {
      return { out: this.formatMessage(e, null), next };
    }
  }

  async runMeta(cmd, args, raw) {
    const onoff = (v, cur) => (v === undefined ? !cur : /^(on|true|1|yes)$/i.test(v));
    // \restrict (psql 18.1+): mientras está activo, solo se admite \unrestrict con la misma clave
    if (this.restrictKey !== undefined && cmd !== "unrestrict") return `backslash commands are restricted; only \\unrestrict is allowed\n`;
    switch (cmd) {
      case "restrict":
        if (!args[0]) return "\\restrict: missing required argument\n";
        if (this.restrictKey !== undefined) return "\\restrict: already in restricted mode\n";
        this.restrictKey = args[0];
        return "";
      case "unrestrict":
        if (!args[0]) return "\\unrestrict: missing required argument\n";
        if (this.restrictKey === undefined) return "\\unrestrict: not currently in restricted mode\n";
        if (args[0] !== this.restrictKey) return "\\unrestrict: wrong key\n";
        this.restrictKey = undefined;
        return "";
      case "q": case "quit": return { quit: true, out: "" };
      case "?": return this.helpText();
      case "h": case "help": return this.sqlHelp(raw);
      case "x": {
        const v = args[0];
        this.pset.expanded = v === "auto" ? "auto" : v === undefined ? (this.pset.expanded === "on" ? "off" : "on") : onoff(v) ? "on" : "off";
        return this.pset.expanded === "auto" ? "Expanded display is used automatically.\n" : `Expanded display is ${this.pset.expanded}.\n`;
      }
      case "a":
        this.pset.format = this.pset.format === "aligned" ? "unaligned" : "aligned";
        return `Output format is ${this.pset.format}.\n`;
      case "t":
        this.pset.tuplesOnly = onoff(args[0], this.pset.tuplesOnly);
        return `Tuples only is ${this.pset.tuplesOnly ? "on" : "off"}.\n`;
      case "timing":
        this.timing = onoff(args[0], this.timing);
        return `Timing is ${this.timing ? "on" : "off"}.\n`;
      case "H":
        return "La consola simulada no admite el formato HTML (\\H).\n";
      case "C":
        this.pset.title = args[0] || "";
        return this.pset.title ? `Title is "${this.pset.title}".\n` : "Title is unset.\n";
      case "f":
        if (args[0] !== undefined) this.pset.fieldsep = args[0];
        return `Field separator is "${this.pset.fieldsep}".\n`;
      case "pset": return this.psetCmd(args);
      case "echo": case "qecho": case "warn": {
        let a = args;
        let nl = "\n";
        if (a[0] === "-n") { nl = ""; a = a.slice(1); }
        return a.join(" ") + nl;
      }
      case "set": {
        if (!args.length) return [...this.vars.keys()].sort().map((k) => `${k} = '${this.vars.get(k)}'`).join("\n") + "\n";
        const name = args[0];
        if (!/^[A-Za-z0-9_]+$/.test(name)) return `invalid variable name: "${name}"\n`;
        const val = args.slice(1).join("");
        if (name === "AUTOCOMMIT" || name === "ON_ERROR_ROLLBACK" || name === "ECHO_HIDDEN" || name === "QUIET" || name === "SINGLELINE") this.vars.set(name, val === "" ? "on" : val.toLowerCase());
        else this.vars.set(name, val);
        return "";
      }
      case "unset":
        if (args[0]) this.vars.delete(args[0]);
        return "";
      case "p": case "print": {
        const b = this.sc.buf.replace(/\n$/, "");
        if (b) return b + "\n";
        if (this.lastQuery) return this.lastQuery + "\n";
        return "Query buffer is empty.\n";
      }
      case "r": case "reset":
        this.sc.reset();
        return "Query buffer reset (cleared).\n";
      case "g": case "gx": case "gset": case "gexec": return this.runBuffer(cmd, args);
      case "conninfo": return this.conninfo();
      case "c": case "connect": return this.connect(args);
      case "l": case "list": case "l+": case "list+": {
        this.describe.echo = "";
        const out = await this.describe.listDatabases(args[0], cmd.endsWith("+"));
        return this.describe.echo + out;
      }
      case "sf": case "sf+": case "sv": case "sv+": {
        const name = raw.trim();
        if (!name) return cmd.startsWith("sf") ? "function name is required\n" : "view name is required\n";
        try {
          const def = await this.describe.showFunction(name, cmd.startsWith("sf") ? "f" : "v");
          return cmd.endsWith("+") ? Describe.numbered(def, cmd.startsWith("sf")) : def;
        } catch (e) {
          return this.formatMessage(e, null);
        }
      }
      case "errverbose": {
        if (!this.lastError) return "There is no previous error.\n";
        const v = this.vars.get("VERBOSITY");
        this.vars.set("VERBOSITY", "verbose");
        const s = this.formatMessage(this.lastError.e, this.lastError.sql);
        this.vars.set("VERBOSITY", v);
        return s;
      }
      case "encoding": return args[0] ? "" : "UTF8\n";
      case "s": return this.history.slice(0, -1).join("\n") + (this.history.length > 1 ? "\n" : "");
      case "copy": return this.copyCmd(raw);
      case "i": case "include": case "ir": case "include_relative": {
        const f = args[0];
        if (!f) return `\\${cmd}: missing required argument\n`;
        const content = this.env.files.get(f);
        if (content === undefined) return `${f}: No such file or directory\n`;
        const r = await this.feed(content, { script: f });
        return r.events.map((e) => e.out).join("");
      }
      case "o": case "out": return "La consola simulada no admite \\o (redirigir la salida a un archivo). Usa \\copy ... to 'archivo' para exportar datos.\n";
      case "!": return "La consola simulada no tiene un sistema operativo debajo: \\! no está disponible.\n";
      case "e": case "edit": {
        const content = this.sc.buf.trim() ? this.sc.buf : this.lastQuery;
        this.sc.reset();
        return { out: "", editor: content || "" };
      }
      case "watch": return "La consola simulada no admite \\watch.\n";
      case "password": return "La consola simulada no admite \\password. Usa ALTER ROLE nombre PASSWORD '...'.\n";
      case "dconfig": case "dconfig+": return this.describe.run(cmd, args);
      default: {
        if (/^(d|z)/.test(cmd)) {
          const out = await this.describe.run(cmd, args);
          if (out !== null) return out;
        }
        return `invalid command \\${cmd}\nTry \\? for help.\n`;
      }
    }
  }

  psetCmd(args) {
    const [opt, val] = args;
    const p = this.pset;
    const list = () => {
      const q = (v) => `'${v}'`;
      return [
        ["border", String(p.border)], ["columns", "0"], ["csv_fieldsep", q(p.csvFieldsep)], ["expanded", p.expanded],
        ["fieldsep", q(p.fieldsep)], ["fieldsep_zero", "off"], ["footer", p.footer ? "on" : "off"], ["format", p.format],
        ["linestyle", "ascii"], ["null", q(p.null)], ["numericlocale", "off"], ["pager", "0"], ["pager_min_lines", "0"],
        ["recordsep", "'\\n'"], ["recordsep_zero", "off"], ["tableattr", ""], ["title", p.title || ""], ["tuples_only", p.tuplesOnly ? "on" : "off"],
        ["unicode_border_linestyle", "single"], ["unicode_column_linestyle", "single"], ["unicode_header_linestyle", "single"], ["xheader_width", "full"],
      ].map(([k, v]) => (k + " ".repeat(25 - k.length) + v).trimEnd()).join("\n") + "\n";
    };
    if (!opt) return list();
    switch (opt) {
      case "format": {
        if (val !== undefined) {
          const f = ["aligned", "unaligned", "csv", "wrapped"].find((x) => x.startsWith(val.toLowerCase()));
          if (!f) return "\\pset: allowed formats are aligned, asciidoc, csv, html, latex, latex-longtable, troff-ms, unaligned, wrapped\n";
          p.format = f === "wrapped" ? "aligned" : f;
        }
        return `Output format is ${p.format}.\n`;
      }
      case "border": if (val !== undefined) p.border = Math.max(0, Math.min(2, Number(val) || 0)); return `Border style is ${p.border}.\n`;
      case "null": if (val !== undefined) p.null = val; return `Null display is "${p.null}".\n`;
      case "expanded": case "x":
        p.expanded = val === "auto" ? "auto" : val === undefined ? (p.expanded === "on" ? "off" : "on") : /^(on|true|1)$/i.test(val) ? "on" : "off";
        return p.expanded === "auto" ? "Expanded display is used automatically.\n" : `Expanded display is ${p.expanded}.\n`;
      case "tuples_only": case "t": p.tuplesOnly = val === undefined ? !p.tuplesOnly : /^(on|true|1)$/i.test(val); return `Tuples only is ${p.tuplesOnly ? "on" : "off"}.\n`;
      case "footer": p.footer = val === undefined ? !p.footer : /^(on|true|1)$/i.test(val); return `Default footer is ${p.footer ? "on" : "off"}.\n`;
      case "fieldsep": if (val !== undefined) p.fieldsep = val; return `Field separator is "${p.fieldsep}".\n`;
      case "csv_fieldsep": if (val !== undefined) p.csvFieldsep = val; return `Field separator for CSV is "${p.csvFieldsep}".\n`;
      case "title": p.title = val || ""; return p.title ? `Title is "${p.title}".\n` : "Title is unset.\n";
      case "pager": return "Pager usage is off.\n";
      case "linestyle": return "Line style is ascii.\n";
      case "columns": if (val !== undefined) p.columns = Number(val) || 100; return `Target width is ${p.columns}.\n`;
      default: return `\\pset: unknown option: ${opt}\n`;
    }
  }

  async runBuffer(cmd, args) {
    let sql = this.sc.buf.trim() ? this.sc.take() : "";
    if (!sql) {
      if (!this.lastQuery) return "\\" + cmd + ": no query buffer\n";
      sql = this.lastQuery;
    }
    if (cmd === "gx") return this.sendQuery(sql, { expanded: true });
    if (cmd === "gset") return this.sendQuery(sql, { gset: args[0] || "" });
    if (cmd === "gexec") {
      const collect = [];
      let out = await this.sendQuery(sql, { collect });
      for (const res of collect) for (const row of res.rows) for (const v of row) if (v !== null) out += await this.sendQuery(v);
      return out;
    }
    const opts = {};
    const optArg = args.join(" ");
    const po = /^\((.*)\)$/.exec(optArg);
    if (po) {
      const pset = {};
      for (const kv of po[1].split(/\s+/)) {
        const [k, v] = kv.split("=");
        if (k === "format") pset.format = v;
        if (k === "border") pset.border = Number(v);
        if (k === "null") pset.null = v;
        if (k === "tuples_only") pset.tuplesOnly = /^(on|true|1)$/.test(v);
        if (k === "expanded" || k === "x") pset.expanded = v;
      }
      opts.pset = pset;
    }
    return this.sendQuery(sql, opts);
  }

  conninfo() {
    const rows = [
      ["Database", this.db], ["Client User", this.user], ["Socket Directory", "/tmp"], ["Server Port", "5432"], ["Options", ""],
      ["Protocol Version", "3.0"], ["Password Used", "false"], ["GSSAPI Authenticated", "false"], ["Backend PID", String(this.pid)],
      ["SSL Connection", "false"], ["Superuser", this.superuser ? "on" : "off"], ["Hot Standby", "off"],
    ];
    return printTable({ title: "Connection Information", headers: ["Parameter", "Value"], rows }, { ...this.pset });
  }

  async connect(args) {
    const cur = (v, d) => (v === undefined || v === "-" ? d : v);
    const db = cur(args[0], this.db);
    const user = cur(args[1], this.user);
    const r = await this.env.connect(db, user);
    if (r.error) {
      this.errors.push({ sql: "\\c", message: r.error, code: "08006" });
      return `connection to server on socket "/tmp/.s.PGSQL.5432" failed: FATAL:  ${r.error}\nPrevious connection kept\n`;
    }
    this.db = db;
    this.user = user;
    this.tx = "I";
    await this.refresh();
    return `You are now connected to database "${db}" as user "${user}".\n`;
  }

  /** \copy: el archivo (o la entrada) lo pone psql y el servidor ejecuta COPY ... FROM STDIN / TO STDOUT. */
  async copyCmd(raw) {
    const s = raw.trim().replace(/;\s*$/, "");
    // Separar «tabla o (consulta)» + from/to + origen + opciones
    let i = 0, depth = 0, q = false;
    let dirAt = -1, dir = "";
    while (i < s.length) {
      const c = s[i];
      if (q) { if (c === "'") q = false; i++; continue; }
      if (c === "'") { q = true; i++; continue; }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (depth === 0 && /\s/.test(c)) {
        const m = /^\s+(from|to)\s+/i.exec(s.slice(i));
        if (m) { dirAt = i; dir = m[1].toLowerCase(); i += m[0].length; break; }
      }
      i++;
    }
    if (dirAt < 0) return "\\copy: parse error at end of line\n";
    const target = s.slice(0, dirAt).trim();
    let restS = s.slice(i);
    let src;
    const mq = /^'((?:[^']|'')*)'/.exec(restS);
    if (mq) { src = { file: mq[1].replace(/''/g, "'") }; restS = restS.slice(mq[0].length); }
    else {
      const mw = /^(\S+)/.exec(restS);
      if (!mw) return "\\copy: parse error at end of line\n";
      const w = mw[1];
      restS = restS.slice(w.length);
      if (/^(stdin|pstdin)$/i.test(w)) src = { stdin: true };
      else if (/^(stdout|pstdout)$/i.test(w)) src = { stdout: true };
      else if (/^program$/i.test(w)) return "La consola simulada no puede ejecutar programas (\\copy ... program).\n";
      else src = { file: w };
    }
    const options = restS.trim();
    if (dir === "from") {
      const sql = `COPY ${target} FROM STDIN ${options}`.trim();
      if (src.stdin) {
        this.copy = { sql, lines: [] };
        return this.src ? "" : COPY_BANNER;
      }
      const data = this.env.files.get(src.file);
      if (data === undefined) return `${src.file}: No such file or directory\n`;
      const msgs = await this.env.copyFrom(sql, data.endsWith("\n") || !data ? data : data + "\n");
      return this.render(msgs, sql).out;
    }
    const sql = `COPY ${target} TO STDOUT ${options}`.trim();
    const msgs = await this.env.exec(sql);
    if (src.stdout) {
      let out = "";
      let tag = "";
      for (const m of msgs) {
        if (m.name === "copyData") out += decoder.decode(m.chunk);
        if (m.name === "commandComplete") tag = m.text;
      }
      // psql no imprime «COPY n» cuando los datos van a la misma salida
      const r = this.render(msgs.filter((m) => m.name !== "copyData" && m.name !== "commandComplete"), sql);
      void tag;
      return out + r.out;
    }
    let data = "", tag = "";
    for (const m of msgs) {
      if (m.name === "copyData") data += decoder.decode(m.chunk);
      if (m.name === "commandComplete") tag = m.text;
    }
    const r = this.render(msgs.filter((m) => m.name !== "copyData" && m.name !== "commandComplete"), sql);
    if (r.error) return r.out;
    this.env.files.set(src.file, data);
    return tag + "\n";
  }

  async sqlHelp(topic) {
    const h = await this.env.help();
    if (!h) return "La ayuda de SQL no está disponible.\n";
    const t = topic.trim().replace(/;$/, "").toUpperCase().replace(/\s+/g, " ");
    if (!t || t === "*") return h.list;
    if (h.commands[t]) return h.commands[t];
    const matches = Object.keys(h.commands).filter((k) => k.startsWith(t + " ") || k === t);
    if (matches.length) return matches.map((k) => h.commands[k]).join("\n");
    const words = t.split(" ");
    for (let n = words.length - 1; n > 0; n--) {
      const pre = words.slice(0, n).join(" ");
      if (h.commands[pre]) return h.commands[pre];
    }
    return `No help available for "${topic.trim()}".\nTry \\h with no arguments to see available help.\n`;
  }

  helpText() {
    return HELP;
  }
}

function fmtTime(ms) {
  const base = `${ms.toFixed(3)} ms`;
  if (ms < 1000) return base;
  const s = ms / 1000;
  const mm = Math.floor(s / 60), ss = s - mm * 60;
  return `${base} (${String(mm).padStart(2, "0")}:${ss.toFixed(3).padStart(6, "0")})`;
}

const PSQL_HELP = `You are using psql, the command-line interface to PostgreSQL.
Type:  \\copyright for distribution terms
       \\h for help with SQL commands
       \\? for help with psql commands
       \\g or terminate with semicolon to execute query
       \\q to quit
`;

const HELP = `General
  \\q                     quit psql

Help
  \\? [commands]          show help on backslash commands
  \\h [NAME]              help on syntax of SQL commands, * for all commands

Query Buffer
  \\e                     edit the query buffer with the platform editor
  \\g [(OPTIONS)]         execute query (and send result to screen)
  \\gexec                 execute query, then execute each value in its result
  \\gset [PREFIX]         execute query and store result in psql variables
  \\gx [(OPTIONS)]        as \\g, but forces expanded output mode
  \\p                     show the contents of the query buffer
  \\r                     reset (clear) the query buffer

Input/Output
  \\copy ...              perform SQL COPY with data stream to the client host
  \\echo [-n] [STRING]    write string to standard output (-n for no newline)
  \\i FILE                execute commands from file
  \\qecho [-n] [STRING]   write string to \\o output stream (-n for no newline)

Informational
  (options: S = show system objects, + = additional detail)
  \\d[S+]                 list tables, views, and sequences
  \\d[S+]  NAME           describe table, view, sequence, or index
  \\db[+]  [PATTERN]      list tablespaces
  \\dconfig[+] [PATTERN]  list configuration parameters
  \\dC[+]  [PATTERN]      list casts
  \\dD[S+] [PATTERN]      list domains
  \\ddp    [PATTERN]      list default privileges
  \\df[anptw][S+] [FUNCPTRN]  list [only agg/normal/procedure/trigger/window] functions
  \\dF[+]  [PATTERN]      list text search configurations
  \\dFd    [PATTERN]      list text search dictionaries
  \\dFp    [PATTERN]      list text search parsers
  \\dFt    [PATTERN]      list text search templates
  \\dg[S+] [PATTERN]      list roles
  \\di[S+] [PATTERN]      list indexes
  \\dL[S+] [PATTERN]      list procedural languages
  \\dm[S+] [PATTERN]      list materialized views
  \\dn[S+] [PATTERN]      list schemas
  \\do[S+] [OPPTRN]       list operators
  \\dp[S]  [PATTERN]      list table, view, and sequence access privileges
  \\dP[itn+] [PATTERN]    list [only index/table] partitioned relations [n=nested]
  \\dRp[+] [PATTERN]      list replication publications
  \\dRs[+] [PATTERN]      list replication subscriptions
  \\drds [ROLEPTRN [DBPTRN]] list per-database role settings
  \\drg[S] [PATTERN]      list role grants
  \\ds[S+] [PATTERN]      list sequences
  \\dX     [PATTERN]      list extended statistics
  \\dt[S+] [PATTERN]      list tables
  \\dT[S+] [PATTERN]      list data types
  \\du[S+] [PATTERN]      list roles
  \\dv[S+] [PATTERN]      list views
  \\dx[+]  [PATTERN]      list extensions
  \\dy[+]  [PATTERN]      list event triggers
  \\l[+]   [PATTERN]      list databases
  \\sf[+]  FUNCNAME       show a function's definition
  \\sv[+]  VIEWNAME       show a view's definition
  \\z[S]   [PATTERN]      same as \\dp

Formatting
  \\a                     toggle between unaligned and aligned output mode
  \\C [STRING]            set table title, or unset if none
  \\f [STRING]            show or set field separator for unaligned query output
  \\pset [NAME [VALUE]]   set table output option
                         (border|csv_fieldsep|expanded|fieldsep|footer|format|
                         null|title|tuples_only)
  \\t [on|off]            show only rows
  \\x [on|off|auto]       toggle expanded output

Connection
  \\c[onnect] {[DBNAME|- USER|-]}
                         connect to new database
  \\conninfo              display information about current connection
  \\encoding [ENCODING]   show or set client encoding

Input/Output (history)
  \\s                     display history

Operating System
  \\timing [on|off]       toggle timing of commands

Variables
  \\set [NAME [VALUE]]    set internal variable, or list all if no parameters
  \\unset NAME            unset (delete) internal variable

(Consola simulada de la plataforma: se muestran solo los meta-comandos disponibles.)
`;
