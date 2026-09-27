// Motor de la terminal de práctica de Git.
// Ejecuta Git REAL dentro de carpetas aisladas (una por sesión) con un intérprete de comandos
// propio y restringido: git + órdenes básicas de archivos. Nunca toca los repositorios ni la
// configuración reales del usuario: HOME, ~/.gitconfig y el directorio de trabajo son de la sesión.
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// Next.js empaqueta este módulo en .next/: se buscan los archivos auxiliares desde la raíz del proyecto
const HERE = fs.existsSync(path.join(process.cwd(), "lib-node", "git-prelude.sh"))
  ? path.join(process.cwd(), "lib-node")
  : path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(os.tmpdir(), "cuaderno-git");
const GIT = process.env.CUADERNO_GIT || "git";
const PRELUDE = fs.readFileSync(path.join(HERE, "git-prelude.sh"), "utf8");
const BRIDGE = path.join(HERE, "git-editor.mjs");
const PTY_RUN = path.join(HERE, "pty-run.py");
const PYTHON = process.env.CUADERNO_PYTHON || "/usr/bin/python3";
const CMD_TIMEOUT = 45_000; // filter-branch espera 10 s a propósito; margen para equipos lentos
const OUT_LIMIT = 200_000;

const sessions = new Map();

/* ------------------------------------------------------------------ */
/* Sesiones                                                            */
/* ------------------------------------------------------------------ */

function cleanupOld() {
  try {
    const now = Date.now();
    for (const d of fs.readdirSync(ROOT)) {
      const p = path.join(ROOT, d);
      const st = fs.statSync(p);
      if (now - st.mtimeMs > 24 * 3600_000) fs.rmSync(p, { recursive: true, force: true });
    }
  } catch { /* carpeta aún no creada */ }
}

/**
 * Crea una sesión aislada. setup: script bash (del contenido del curso, nunca del navegador)
 * que prepara el escenario dentro de ~. cwd: carpeta inicial relativa a ~.
 */
export async function createSession({ setup = "", cwd = "", identity = true } = {}) {
  cleanupOld();
  const id = crypto.randomBytes(16).toString("hex");
  const base = path.join(ROOT, id);
  const home = path.join(base, "home");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(base, "bridge"), { recursive: true });
  // Configuración "del sistema" de la sesión: colores en la terminal de práctica
  // Configuración "del sistema" de la sesión: sin paginador (la salida va a la página). Los colores y las
  // decoraciones ((HEAD -> main)) salen solos porque git escribe en una pseudo-terminal (lib-node/pty-run.py).
  fs.writeFileSync(path.join(base, "gitconfig-system"), "[core]\n\tpager = cat\n");
  // Configuración global del alumno dentro de la sesión (~/.gitconfig)
  fs.writeFileSync(
    path.join(home, ".gitconfig"),
    (identity ? "[user]\n\tname = Alumno\n\temail = alumno@cuaderno.local\n" : "") + "[init]\n\tdefaultBranch = main\n"
  );
  const s = {
    id, base, home, realHome: fs.realpathSync(home), cwd: home,
    /** @type {any} */ pending: null,
    used: Date.now(),
    exercise: /** @type {null | { course: string, section: string, id: string }} */ (null)
  };
  sessions.set(id, s);
  if (setup) {
    const r = await runScript(s, setup, home);
    if (r.code !== 0) throw new Error("El escenario no se pudo preparar: " + r.out.slice(-800));
  }
  if (cwd) {
    const p = path.resolve(home, cwd);
    if (inside(s, p) && fs.existsSync(p)) s.cwd = p;
  }
  return s;
}

export function getSession(id) {
  const s = sessions.get(id);
  if (s) s.used = Date.now();
  return s || null;
}

export function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  if (s.pending) try { s.pending.child.kill("SIGKILL"); } catch { /* ya terminó */ }
  sessions.delete(id);
  fs.rmSync(s.base, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/* Entorno y rutas                                                     */
/* ------------------------------------------------------------------ */

function gitEnv(s, extra = {}) {
  const editor = `"${process.execPath}" "${BRIDGE}"`;
  return {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: s.home,
    XDG_CONFIG_HOME: path.join(s.home, ".config"),
    GIT_CONFIG_SYSTEM: path.join(s.base, "gitconfig-system"),
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ALLOW_PROTOCOL: "file",
    GIT_EDITOR: editor,
    GIT_SEQUENCE_EDITOR: editor,
    EDITOR: editor,
    VISUAL: editor,
    CUADERNO_BRIDGE_DIR: path.join(s.base, "bridge"),
    LANG: "en_US.UTF-8",
    LC_ALL: "en_US.UTF-8",
    TERM: "xterm-256color",
    COLUMNS: "100",
    TMPDIR: path.join(s.base, "tmp"),
    ...extra
  };
}

function within(root, p) {
  const rel = path.relative(root, p);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
// macOS: la carpeta temporal es un enlace (/var -> /private/var); se acepta cualquiera de las dos formas
const inside = (s, p) => within(s.home, p) || within(s.realHome, p);

/** Resuelve una ruta del alumno y garantiza que queda dentro de su ~. */
function safePath(s, p) {
  let raw = p;
  if (raw === "~" || raw.startsWith("~/")) raw = path.join(s.home, raw.slice(1));
  const abs = path.resolve(s.cwd, raw);
  if (!inside(s, abs)) throw new ShellError(`ruta fuera de tu carpeta de práctica: ${p}`);
  // Evita escapar mediante enlaces simbólicos
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== s.home && probe !== path.dirname(probe)) probe = path.dirname(probe);
  let real = probe;
  try { real = fs.realpathSync(probe); } catch { /* no existe todavía */ }
  if (!within(s.realHome, real)) throw new ShellError(`ruta fuera de tu carpeta de práctica: ${p}`);
  return abs;
}

class ShellError extends Error {}

const display = (s, p) => {
  const rel = within(s.realHome, p) && !within(s.home, p) ? path.relative(s.realHome, p) : path.relative(s.home, p);
  return rel ? "~/" + rel : "~";
};

/* ------------------------------------------------------------------ */
/* Scripts de contenido (setup / checks): bash con el preludio         */
/* ------------------------------------------------------------------ */

function runScript(s, script, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.join(s.base, "tmp"), { recursive: true });
    const child = spawn("/bin/bash", ["-c", PRELUDE + "\nset -e\n" + script], {
      cwd,
      env: gitEnv(s, { GIT_CONFIG_SYSTEM: "/dev/null", ...extraEnv }),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    const add = (d) => { if (out.length < OUT_LIMIT) out += d.toString(); };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const t = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? 1, out }); });
  });
}

/** Ejecuta las comprobaciones de un ejercicio. Cada una es un script: pasa si termina con código 0. */
export async function runChecks(s, checks, cwd = "") {
  const dir = cwd ? path.resolve(s.home, cwd) : s.home;
  const results = [];
  for (const c of checks) {
    if (!fs.existsSync(dir)) { results.push({ name: c.name, ok: false, msg: `No existe la carpeta ${cwd}` }); continue; }
    // set -e no se aplica a las comprobaciones: cada línea decide con falla()
    const r = await new Promise((resolve) => {
      const child = spawn("/bin/bash", ["-c", PRELUDE + "\n" + c.script], { cwd: dir, env: gitEnv(s, { GIT_CONFIG_SYSTEM: "/dev/null" }), stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => { out += d; });
      child.stderr.on("data", () => {});
      const t = setTimeout(() => child.kill("SIGKILL"), 15_000);
      child.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? 1, out }); });
    });
    const msg = r.out.trim().split("\n").filter(Boolean).pop() || "";
    results.push({ name: c.name, ok: r.code === 0, msg: r.code === 0 ? undefined : msg || "La comprobación no se cumple" });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Análisis de la línea de comandos                                    */
/* ------------------------------------------------------------------ */

/** Divide la línea en comandos con operadores &&, ||, ; y tuberías simples. */
function tokenize(line) {
  const out = []; // tokens: {t:"word", v, quoted} | {t:"op", v}
  let i = 0, cur = null;
  const push = () => { if (cur) { out.push(cur); cur = null; } };
  const word = () => (cur ||= { t: "word", v: "", quoted: false });
  while (i < line.length) {
    const c = line[i];
    if (c === "'") { word().quoted = true; const j = line.indexOf("'", i + 1); if (j < 0) throw new ShellError("falta cerrar una comilla simple (')"); cur.v += line.slice(i + 1, j); i = j + 1; continue; }
    if (c === '"') {
      word().quoted = true; i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === "\\" && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) { cur.v += line[i + 1]; i += 2; continue; }
        if (line[i] === "`" || (line[i] === "$" && line[i + 1] === "(")) throw new ShellError("esta terminal no admite sustitución de comandos ($(...) o `...`)");
        cur.v += line[i++];
      }
      if (i >= line.length) throw new ShellError('falta cerrar una comilla doble (")');
      i++; continue;
    }
    if (c === "\\" && i + 1 < line.length) {
      // Un comodín escapado (\*) no se expande, como en bash
      if ("*?[".includes(line[i + 1])) word().quoted = true;
      word().v += line[i + 1]; i += 2; continue;
    }
    if (c === " " || c === "\t") { push(); i++; continue; }
    if (c === "`" || (c === "$" && line[i + 1] === "(")) throw new ShellError("esta terminal no admite sustitución de comandos ($(...) o `...`)");
    if (line.startsWith("&&", i) || line.startsWith("||", i) || line.startsWith(">>", i)) { push(); out.push({ t: "op", v: line.slice(i, i + 2) }); i += 2; continue; }
    if (c === ";" || c === "|" || c === ">" || c === "<" || c === "&") {
      push();
      if (c === "<") throw new ShellError("esta terminal no admite redirección de entrada (<)");
      if (c === "&") throw new ShellError("esta terminal no admite procesos en segundo plano (&)");
      out.push({ t: "op", v: c }); i++; continue;
    }
    if (c === "#" && !cur) break; // comentario
    word().v += c; i++;
  }
  push();
  return out;
}

function parse(line) {
  const toks = tokenize(line);
  const seq = []; // [{cmd: {argv, redirect, pipeFrom}, op}]
  let argv = [], redirect = null, pipeFrom = null;
  const flush = (op) => {
    if (!argv.length && (op || redirect)) throw new ShellError("sintaxis incompleta");
    if (argv.length) seq.push({ cmd: { argv, redirect, pipeFrom }, op });
    argv = []; redirect = null; pipeFrom = null;
  };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === "word") { argv.push(t); continue; }
    if (t.v === ">" || t.v === ">>") {
      const f = toks[++k];
      if (!f || f.t !== "word") throw new ShellError(`falta el archivo después de ${t.v}`);
      redirect = { op: t.v, file: f.v };
      continue;
    }
    if (t.v === "|") {
      if (!argv.length) throw new ShellError("sintaxis incompleta");
      pipeFrom = { argv, redirect: null };
      argv = [];
      continue;
    }
    flush(t.v);
  }
  flush(null);
  return seq;
}

/** Expande ~, $HOME y comodines (* ? []) de las palabras sin comillas, como haría bash. */
function expand(s, words) {
  const out = [];
  for (const w of words) {
    let v = w.v;
    if (!w.quoted) {
      if (v === "~" || v.startsWith("~/")) v = s.home + v.slice(1);
      v = v.replace(/\$HOME|\$\{HOME\}/g, s.home);
      if (/[*?[]/.test(v)) {
        const matches = glob(s, v);
        if (matches.length) { out.push(...matches); continue; }
      }
    }
    out.push(v);
  }
  return out;
}

function glob(s, pattern) {
  const abs = path.isAbsolute(pattern);
  const parts = pattern.split("/");
  let bases = [abs ? "/" : ""];
  for (const part of parts) {
    if (part === "") continue;
    const next = [];
    for (const b of bases) {
      const dir = path.resolve(s.cwd, b || ".");
      if (!/[*?[]/.test(part)) { next.push(b ? path.join(b, part) : part); continue; }
      let entries = [];
      try { entries = fs.readdirSync(dir); } catch { continue; }
      const re = new RegExp("^" + part.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      for (const e of entries.sort()) if ((part.startsWith(".") || !e.startsWith(".")) && re.test(e)) next.push(b ? path.join(b, e) : e);
    }
    bases = next;
  }
  return bases.filter((b) => { try { fs.accessSync(path.resolve(s.cwd, b)); return true; } catch { return false; } });
}

/* ------------------------------------------------------------------ */
/* Órdenes básicas                                                     */
/* ------------------------------------------------------------------ */

const HELP = `Órdenes disponibles en esta terminal de práctica:
  git …            Git real (versión instalada en tu computador)
  ls [-a] [-l]     listar archivos        cd RUTA / pwd   moverse / ver dónde estás
  cat ARCHIVO      ver un archivo         code ARCHIVO    abrir el editor (también: edit, nano, vim)
  echo / printf    escribir texto (usa > archivo o >> archivo para guardarlo)
  touch, mkdir [-p], rm [-r] [-f], mv, cp [-r], chmod +x, head/tail -n N, wc -l, grep, tree, clear
Operadores: &&  ||  ;  > >>  y tuberías echo/printf | git …
Todo ocurre dentro de ~ (tu carpeta de práctica aislada); nada afecta a tus repositorios reales.`;

function unescapeEcho(t) {
  return t.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
}

function printfFormat(fmt, args) {
  let i = 0;
  const one = () => unescapeEcho(fmt).replace(/%([sd%])/g, (m, c) => (c === "%" ? "%" : String(args[i++] ?? "")));
  let out = one();
  while (i < args.length && /%[sd]/.test(fmt)) out += one();
  return out;
}

function builtin(s, argv) {
  const [cmd, ...a] = argv;
  const flags = new Set(a.filter((x) => /^-[a-zA-Z]+$/.test(x)).flatMap((x) => x.slice(1).split("")));
  const args = a.filter((x) => !/^-[a-zA-Z]+$/.test(x));
  const dirOf = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  switch (cmd) {
    case "help": return { out: HELP + "\n" };
    case "pwd": return { out: display(s, s.cwd) + "\n" };
    case "cd": {
      const target = safePath(s, args[0] ?? "~");
      if (!dirOf(target)) throw new ShellError(`cd: no existe la carpeta: ${args[0]}`);
      s.cwd = target;
      return { out: "" };
    }
    case "clear": return { out: "", clear: true };
    case "echo": {
      let parts = a;
      let nl = true, esc = false;
      while (parts[0] === "-n" || parts[0] === "-e") { if (parts[0] === "-n") nl = false; else esc = true; parts = parts.slice(1); }
      const t = parts.join(" ");
      return { out: (esc ? unescapeEcho(t) : t) + (nl ? "\n" : "") };
    }
    case "printf": return { out: a.length ? printfFormat(a[0], a.slice(1)) : "" };
    case "ls": {
      const targets = args.length ? args : ["."];
      let out = "";
      for (const t of targets) {
        const p = safePath(s, t);
        if (!fs.existsSync(p)) throw new ShellError(`ls: no existe: ${t}`);
        if (!dirOf(p)) { out += t + "\n"; continue; }
        if (targets.length > 1) out += `${t}:\n`;
        const names = fs.readdirSync(p).filter((n) => flags.has("a") || !n.startsWith(".")).sort();
        if (flags.has("a")) names.unshift(".", "..");
        const fmt = (n) => (dirOf(path.join(p, n)) ? `\x1b[1;34m${n}/\x1b[0m` : n);
        if (flags.has("l")) {
          for (const n of names) {
            const st = fs.statSync(path.join(p, n));
            out += `${st.isDirectory() ? "d" : "-"}${st.mode & 0o100 ? "x" : "-"} ${String(st.size).padStart(7)}  ${fmt(n)}\n`;
          }
        } else out += names.map(fmt).join("  ") + (names.length ? "\n" : "");
      }
      return { out };
    }
    case "cat": {
      if (!args.length) throw new ShellError("cat: indica un archivo (esta terminal no lee del teclado; usa code ARCHIVO para escribir)");
      return { out: args.map((f) => { const p = safePath(s, f); if (!fs.existsSync(p)) throw new ShellError(`cat: no existe el archivo: ${f}`); if (dirOf(p)) throw new ShellError(`cat: ${f} es una carpeta`); return fs.readFileSync(p, "utf8"); }).join("") };
    }
    case "touch": { for (const f of args) { const p = safePath(s, f); if (!fs.existsSync(p)) fs.writeFileSync(p, ""); else fs.utimesSync(p, new Date(), new Date()); } return { out: "" }; }
    case "mkdir": { for (const f of args) { const p = safePath(s, f); if (fs.existsSync(p) && !flags.has("p")) throw new ShellError(`mkdir: ya existe: ${f}`); fs.mkdirSync(p, { recursive: flags.has("p") || true }); } return { out: "" }; }
    case "rm": {
      for (const f of args) {
        const p = safePath(s, f);
        if (p === s.home) throw new ShellError("rm: no se puede borrar tu carpeta de práctica completa");
        if (!fs.existsSync(p)) { if (flags.has("f")) continue; throw new ShellError(`rm: no existe: ${f}`); }
        if (dirOf(p) && !flags.has("r") && !flags.has("R")) throw new ShellError(`rm: ${f} es una carpeta (usa rm -r)`);
        fs.rmSync(p, { recursive: true, force: true });
      }
      return { out: "" };
    }
    case "mv": case "cp": {
      if (args.length < 2) throw new ShellError(`${cmd}: indica origen y destino`);
      const dst = safePath(s, args[args.length - 1]);
      const srcs = args.slice(0, -1).map((f) => safePath(s, f));
      for (const src of srcs) {
        if (!fs.existsSync(src)) throw new ShellError(`${cmd}: no existe: ${path.basename(src)}`);
        const to = dirOf(dst) ? path.join(dst, path.basename(src)) : dst;
        if (cmd === "mv") fs.renameSync(src, to);
        else { if (dirOf(src) && !flags.has("r") && !flags.has("R")) throw new ShellError(`cp: ${path.basename(src)} es una carpeta (usa cp -r)`); fs.cpSync(src, to, { recursive: true }); }
      }
      return { out: "" };
    }
    case "chmod": {
      const [mode, ...files] = a;
      for (const f of files) {
        const p = safePath(s, f);
        const cur = fs.statSync(p).mode & 0o777;
        const next = mode === "+x" || mode === "u+x" || mode === "a+x" ? cur | 0o111 : mode === "-x" ? cur & ~0o111 : /^[0-7]{3}$/.test(mode) ? parseInt(mode, 8) : null;
        if (next === null) throw new ShellError("chmod: usa +x, -x o un modo numérico como 755");
        fs.chmodSync(p, next);
      }
      return { out: "" };
    }
    case "head": case "tail": {
      let n = 10; const files = [];
      for (let k = 0; k < a.length; k++) { if (a[k] === "-n") n = parseInt(a[++k], 10) || 10; else if (/^-\d+$/.test(a[k])) n = parseInt(a[k].slice(1), 10); else files.push(a[k]); }
      return { out: files.map((f) => { const lines = fs.readFileSync(safePath(s, f), "utf8").split("\n"); if (lines[lines.length - 1] === "") lines.pop(); const sel = cmd === "head" ? lines.slice(0, n) : lines.slice(-n); return sel.join("\n") + (sel.length ? "\n" : ""); }).join("") };
    }
    case "wc": return { out: args.map((f) => { const t = fs.readFileSync(safePath(s, f), "utf8"); return `${String((t.match(/\n/g) || []).length).padStart(7)} ${f}\n`; }).join("") };
    case "grep": {
      const [pat, ...files] = args;
      if (!pat || !files.length) throw new ShellError("grep: uso: grep [-n] [-i] PATRÓN ARCHIVO…");
      const re = new RegExp(pat, flags.has("i") ? "i" : "");
      let out = "";
      for (const f of files) {
        const lines = fs.readFileSync(safePath(s, f), "utf8").split("\n");
        lines.forEach((l, k) => { if (re.test(l)) out += `${files.length > 1 ? f + ":" : ""}${flags.has("n") ? k + 1 + ":" : ""}${l}\n`; });
      }
      return { out, code: out ? 0 : 1 };
    }
    case "tree": {
      const start = safePath(s, args[0] ?? ".");
      let out = (args[0] ?? ".") + "\n";
      const walk = (dir, prefix) => {
        const names = fs.readdirSync(dir).filter((n) => n !== ".git" && (flags.has("a") || !n.startsWith("."))).sort();
        names.forEach((n, k) => {
          const last = k === names.length - 1;
          const p = path.join(dir, n);
          out += `${prefix}${last ? "└── " : "├── "}${dirOf(p) ? `\x1b[1;34m${n}\x1b[0m` : n}\n`;
          if (dirOf(p)) walk(p, prefix + (last ? "    " : "│   "));
        });
      };
      walk(start, "");
      return { out };
    }
    case "code": case "edit": case "nano": case "vim": case "vi": case "open": {
      if (!args[0]) throw new ShellError(`${cmd}: indica el archivo que quieres editar`);
      const p = safePath(s, args[0]);
      if (dirOf(p)) throw new ShellError(`${cmd}: ${args[0]} es una carpeta`);
      const content = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      return { out: "", openFile: { path: display(s, p), content } };
    }
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/* Git                                                                 */
/* ------------------------------------------------------------------ */

// Opciones que ejecutan programas arbitrarios o salen de la carpeta de práctica
const GLOBAL_BLOCKED = [/^--exec-path/, /^--git-dir/, /^--work-tree/, /^--namespace/];
const ANY_BLOCKED = [/^--upload-pack/, /^--receive-pack/, /^--exec(=|$)/, /^--config-env/];

function checkGitArgs(s, args) {
  const sub = args.findIndex((a, k) => !a.startsWith("-") && args[k - 1] !== "-C" && args[k - 1] !== "-c");
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    const isGlobal = sub < 0 || k < sub;
    if (isGlobal && a === "-C") { safePath(s, args[k + 1] ?? ""); continue; }
    if (a === "-c" && /^(core\.(sshCommand|fsmonitor|pager|editor)|protocol\.|uploadpack\.|credential\.)/i.test(args[k + 1] || "")) throw new ShellError(`opción no permitida en la terminal de práctica: -c ${args[k + 1]}`);
    if (isGlobal && GLOBAL_BLOCKED.some((re) => re.test(a))) throw new ShellError(`opción no permitida en la terminal de práctica: ${a}`);
    // git rebase --exec/-x ejecuta pruebas entre commits (como los hooks): se permite; en clone/fetch/push, --exec es --upload-pack
    const rebaseExec = args[sub] === "rebase" && /^--exec(=|$)/.test(a);
    if ((ANY_BLOCKED.some((re) => re.test(a)) && !rebaseExec) || (args[sub] === "clone" && a === "-u")) throw new ShellError(`opción no permitida en la terminal de práctica: ${a}`);
    if (/^(https?|ssh|git):\/\/|^[\w.-]+@[\w.-]+:/.test(a)) throw new ShellError("sin red en la terminal de práctica: usa repositorios locales (por ejemplo ../servidor/proyecto.git)");
    const fileUrl = a.match(/^file:\/\/(.*)$/);
    if (fileUrl) safePath(s, fileUrl[1]);
    // Valores de opciones con ruta (--output=/x, --template=../../x…): deben quedar dentro de ~
    const optVal = a.match(/^--[\w-]+=(.+)$/);
    if (optVal && (/^[/~]/.test(optVal[1]) || /(^|\/)\.\.(\/|$)/.test(optVal[1]))) safePath(s, optVal[1]);
    // Argumentos sueltos con ruta absoluta o que suben (../): salvo los rangos de -L (/regex/,+3)
    const isLineRange = args[k - 1] === "-L" || /^\/.*\/(,.*)?$/.test(a) || /,/.test(a);
    if (!isLineRange && !optVal && ((a.startsWith("/") && !a.startsWith(s.home)) || /(^|\/)\.\.(\/|$)/.test(a))) safePath(s, a);
  }
}

/**
 * Lanza git y espera a que termine o a que pida el editor.
 * Devuelve {out, code} o {out, editor:{file, content}} (el proceso queda en s.pending).
 */
function startGit(s, args, stdin) {
  fs.mkdirSync(path.join(s.base, "tmp"), { recursive: true });
  // GIT_MERGE_AUTOEDIT: como en una terminal real, merge y pull abren el editor para el mensaje de fusión
  // Salida por una pseudo-terminal (como en una terminal real) y entrada por tubería (para `printf … | git …`)
  const child = spawn(PYTHON, [PTY_RUN, GIT, ...args], { cwd: s.cwd, env: gitEnv(s, { GIT_MERGE_AUTOEDIT: "yes" }), stdio: ["pipe", "pipe", "pipe"], detached: true });
  if (stdin != null) child.stdin.end(stdin); else child.stdin.end();
  const p = { child, out: "", done: false, code: null, waiters: [], lastRequest: null };
  const add = (d) => { if (p.out.length < OUT_LIMIT) p.out += d.toString(); };
  child.stdout.on("data", add);
  child.stderr.on("data", add);
  child.on("close", (code, sig) => {
    p.done = true;
    p.code = code ?? (sig ? 124 : 1);
    p.waiters.splice(0).forEach((f) => f());
  });
  child.on("error", (e) => { p.out += `No se pudo ejecutar git: ${e.message}\n`; p.done = true; p.code = 127; p.waiters.splice(0).forEach((f) => f()); });
  s.pending = p;
  return waitGit(s);
}

/** Espera al proceso pendiente: termina, pide editor o se pasa de tiempo. */
function waitGit(s) {
  const p = s.pending;
  const bridge = path.join(s.base, "bridge");
  return new Promise((resolve) => {
    const started = Date.now();
    let finished = false;
    const finish = (r) => { if (finished) return; finished = true; clearInterval(iv); resolve(r); };
    const iv = setInterval(() => {
      if (p.done) return;
      // ¿Git abrió el editor?
      let req = null;
      try { req = fs.readdirSync(bridge).find((f) => f.startsWith("request-") && f.endsWith(".json") && f !== p.lastRequest); } catch { /* sin carpeta */ }
      if (req) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(bridge, req), "utf8"));
          p.lastRequest = req;
          p.editorId = data.id;
          const out = p.out; p.out = "";
          finish({ out, editor: { file: inside(s, data.file) ? display(s, data.file) : path.basename(data.file), content: data.content } });
          return;
        } catch { /* aún escribiéndose */ }
      }
      if (Date.now() - started > CMD_TIMEOUT) {
        try { process.kill(-p.child.pid, "SIGKILL"); } catch { try { p.child.kill("SIGKILL"); } catch { /* ya terminó */ } }
      }
    }, 50);
    const onDone = () => {
      const timedOut = Date.now() - started > CMD_TIMEOUT;
      s.pending = null;
      const outText = (p.out + (timedOut ? "\n[El comando tardó demasiado y se detuvo]\n" : "")).split(s.realHome).join("~").split(s.home).join("~");
      finish({ out: outText, code: p.code });
    };
    if (p.done) onDone(); else p.waiters.push(onDone);
  });
}

/** El alumno guardó (o canceló) el archivo que Git abrió en el editor. */
export async function answerEditor(s, content, cancel = false) {
  const p = s.pending;
  if (!p || !p.editorId) return { out: "No hay ningún editor abierto.\n", code: 1 };
  fs.writeFileSync(path.join(s.base, "bridge", `response-${p.editorId}.json`), JSON.stringify(cancel ? { ok: false } : { ok: true, content }));
  p.editorId = null;
  const r = await waitGit(s);
  return r;
}

/* ------------------------------------------------------------------ */
/* Ejecución de una línea                                              */
/* ------------------------------------------------------------------ */

/**
 * Ejecuta una línea escrita por el alumno. Devuelve
 * { out, code, clear?, openFile?, editor? } — si hay editor, el comando queda pendiente.
 */
export async function execLine(s, line) {
  if (s.pending) return { out: "Git está esperando a que guardes o cierres el editor.\n", code: 1 };
  let seq;
  try { seq = parse(line.trim()); } catch (e) { return { out: `\x1b[31m${e.message}\x1b[0m\n`, code: 2, rejected: true }; }
  let out = "", code = 0, clear = false, openFile = null, rejected = false;
  let prevOp = null;
  for (const { cmd, op } of seq) {
    if ((prevOp === "&&" && code !== 0) || (prevOp === "||" && code === 0)) { prevOp = op; continue; }
    prevOp = op;
    try {
      const argv = expand(s, cmd.argv);
      let stdin = null;
      if (cmd.pipeFrom) {
        const src = expand(s, cmd.pipeFrom.argv);
        if (!["echo", "printf"].includes(src[0]) || argv[0] !== "git") throw new ShellError("esta terminal solo admite tuberías del tipo: echo … | git … o printf … | git …");
        stdin = builtin(s, src).out;
      }
      let r;
      if (argv[0] === "git") {
        checkGitArgs(s, argv.slice(1));
        if (cmd.redirect) throw new ShellError("redirige la salida de git en tu computador; aquí solo echo/printf/cat admiten > y >>");
        r = await startGit(s, argv.slice(1), stdin);
        if (r.editor) return { out: out + r.out, code: 0, editor: r.editor, pending: true };
      } else {
        r = builtin(s, argv);
        if (!r) throw new ShellError(`${argv[0]}: orden no disponible en esta terminal de práctica (escribe help para ver las disponibles)`);
        if (cmd.redirect) {
          const p = safePath(s, cmd.redirect.file);
          if (cmd.redirect.op === ">>") fs.appendFileSync(p, r.out); else fs.writeFileSync(p, r.out);
          r = { ...r, out: "" };
        }
      }
      out += r.out;
      code = r.code ?? 0;
      if (r.clear) { clear = true; out = ""; }
      if (r.openFile) openFile = r.openFile;
    } catch (e) {
      if (!(e instanceof ShellError)) throw e;
      out += `\x1b[31m${e.message}\x1b[0m\n`;
      code = 1;
      rejected = true;
    }
  }
  // Las rutas de la carpeta de práctica se muestran como ~ (igual que el prompt)
  out = out.split(s.realHome).join("~").split(s.home).join("~");
  return { out, code, clear, openFile, rejected };
}

/** Hash corto de una revisión en el directorio actual de la sesión (para {{SHA:rev}}). */
export async function revParse(s, rev) {
  const r = await gitQuiet(s, ["rev-parse", "--short", rev], s.cwd);
  return r.code === 0 ? r.out.trim() : null;
}

/** Guarda un archivo editado desde el editor de la plataforma (orden code/edit). */
export function writeFile(s, displayPath, content) {
  const p = safePath(s, displayPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

/* ------------------------------------------------------------------ */
/* Estado para el gráfico y las tres áreas                             */
/* ------------------------------------------------------------------ */

function gitQuiet(s, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(GIT, args, { cwd, env: gitEnv(s, { GIT_CONFIG_SYSTEM: "/dev/null", GIT_OPTIONAL_LOCKS: "0" }), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ code, out }));
    child.on("error", () => resolve({ code: 127, out: "" }));
  });
}

export async function getState(s) {
  const base = { cwd: display(s, s.cwd), repo: false, pending: !!s.pending };
  const top = await gitQuiet(s, ["rev-parse", "--show-toplevel", "--git-dir", "--is-bare-repository"], s.cwd);
  if (top.code !== 0) return base;
  const [toplevel, gitDirRaw, bare] = top.out.trim().split("\n");
  const gitDir = path.resolve(s.cwd, gitDirRaw);
  const isBare = bare === "true";
  const [head, refs, log, status, stash] = await Promise.all([
    gitQuiet(s, ["symbolic-ref", "--quiet", "--short", "HEAD"], s.cwd),
    gitQuiet(s, ["for-each-ref", "--format=%(refname)%09%(objectname)%09%(objecttype)%09%(*objectname)", "refs/heads", "refs/remotes", "refs/tags"], s.cwd),
    gitQuiet(s, ["log", "--all", "--topo-order", "-n", "80", "--format=%H%x1f%P%x1f%s%x1f%an%x1f%ad", "--date=format:%d %b %H:%M"], s.cwd),
    isBare ? Promise.resolve({ code: 0, out: "" }) : gitQuiet(s, ["status", "--porcelain=v2", "--branch", "--untracked-files=all"], s.cwd),
    gitQuiet(s, ["stash", "list", "--format=%gd%x1f%s"], s.cwd)
  ]);
  const headSha = (await gitQuiet(s, ["rev-parse", "--verify", "--quiet", "HEAD"], s.cwd)).out.trim();
  const commits = log.out.split("\n").filter(Boolean).map((l) => {
    const [sha, parents, subject, author, date] = l.split("\x1f");
    return { sha, parents: parents ? parents.split(" ") : [], subject, author, date };
  });
  const refList = refs.out.split("\n").filter(Boolean).map((l) => {
    const [name, sha, type, peeled] = l.split("\t");
    return { name, sha: type === "tag" && peeled ? peeled : sha };
  });
  const files = { staged: [], unstaged: [], untracked: [], conflicts: [] };
  let upstream = null, ahead = 0, behind = 0;
  for (const l of status.out.split("\n")) {
    if (l.startsWith("# branch.upstream ")) upstream = l.slice(18);
    else if (l.startsWith("# branch.ab ")) { const m = l.match(/\+(\d+) -(\d+)/); if (m) { ahead = +m[1]; behind = +m[2]; } }
    else if (l.startsWith("1 ") || l.startsWith("2 ")) {
      const parts = l.split(" ");
      const xy = parts[1];
      const name = l.startsWith("2 ") ? parts.slice(9).join(" ").split("\t")[0] : parts.slice(8).join(" ");
      const kind = (c) => ({ M: "modificado", A: "nuevo", D: "borrado", R: "renombrado", C: "copiado", T: "tipo" })[c] || c;
      if (xy[0] !== ".") files.staged.push({ name, kind: kind(xy[0]) });
      if (xy[1] !== ".") files.unstaged.push({ name, kind: kind(xy[1]) });
    } else if (l.startsWith("u ")) files.conflicts.push({ name: l.split(" ").slice(10).join(" "), kind: "conflicto" });
    else if (l.startsWith("? ")) files.untracked.push({ name: l.slice(2), kind: "sin seguimiento" });
  }
  const has = (f) => fs.existsSync(path.join(gitDir, f));
  const operation = has("MERGE_HEAD") ? "merge" : has("rebase-merge") || has("rebase-apply") ? "rebase" : has("CHERRY_PICK_HEAD") ? "cherry-pick" : has("REVERT_HEAD") ? "revert" : has("BISECT_LOG") ? "bisect" : null;
  return {
    ...base,
    repo: true,
    bare: isBare,
    root: display(s, toplevel || gitDir),
    branch: head.code === 0 ? head.out.trim() : null,
    head: headSha || null,
    refs: refList,
    commits,
    files,
    upstream,
    ahead,
    behind,
    stash: stash.out.split("\n").filter(Boolean).map((l) => { const [ref, msg] = l.split("\x1f"); return { ref, msg }; }),
    operation
  };
}
