// Valida secciones de un curso con prácticas en Python.
// Uso: node scripts/validate-course.mjs content/python/s01.json [...]
// Comprueba: formato, diagramas Mermaid, que cada solución pase sus tests y el código inicial falle,
// y que los ejemplos marcados con "run": true se ejecuten sin error. Todo con Pyodide (CPython 3.14).
import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRELUDE = fs.readFileSync(path.join(ROOT, "public/py/prelude.py"), "utf8");
const DOMAINS = new Set(["basico", "intermedio", "avanzado", "experto", "extra"]);
const BLOCKS = new Set(["p", "h", "list", "table", "diagram", "code", "callout", "terms"]);
const LEVELS = new Set(["facil", "medio", "dificil", "proyecto"]);
const JOB_TIMEOUT = 25000;
const str = (v) => typeof v === "string" && v.trim().length > 0;

/* ---------------- Formato ---------------- */
function checkSchema(s) {
  const e = [];
  const need = (c, m) => { if (!c) e.push(m); };
  need(str(s.id) && str(s.title) && str(s.summary) && str(s.goal), "Faltan id/title/summary/goal");
  need(Number.isInteger(s.order), "order debe ser entero");
  need(DOMAINS.has(s.domain), `domain inválido: ${s.domain}`);
  need(Array.isArray(s.objectives) && s.objectives.length >= 3 && s.objectives.every(str), "objectives: al menos 3");
  const ids = new Set();
  const uniq = (id, w) => { if (!str(id)) e.push(`${w}: falta id`); else if (ids.has(id)) e.push(`id duplicado: ${id}`); else ids.add(id); };
  const vague = /^(entender|conocer|saber|comprender|aprender)\b/i;
  (s.lessons || []).forEach((l, i) => {
    const w = `lessons[${i}] ${l.id || ""}`;
    uniq(l.id, w);
    need(str(l.title) && Array.isArray(l.blocks) && l.blocks.length >= 4, `${w}: title y al menos 4 bloques`);
    need(Array.isArray(l.goals) && l.goals.length >= 2 && l.goals.length <= 4 && l.goals.every(str), `${w}: goals 2–4`);
    (l.goals || []).forEach((g) => { if (vague.test(g)) e.push(`${w}: objetivo vago «${g.slice(0, 40)}…»`); });
    need(Array.isArray(l.takeaways) && l.takeaways.length >= 3 && l.takeaways.length <= 6 && l.takeaways.every(str), `${w}: takeaways 3–6`);
    (l.blocks || []).forEach((b, j) => {
      const bw = `${w} bloque ${j}`;
      if (!BLOCKS.has(b.type)) return e.push(`${bw}: tipo desconocido ${b.type}`);
      if (["p", "h", "callout"].includes(b.type)) need(str(b.text), `${bw}: falta text`);
      if (b.type === "callout") need(["exam", "tip", "warn"].includes(b.variant), `${bw}: variant inválido`);
      if (b.type === "list") need(Array.isArray(b.items) && b.items.every(str), `${bw}: items`);
      if (b.type === "table") need(Array.isArray(b.head) && Array.isArray(b.rows) && b.rows.every((r) => Array.isArray(r) && r.length === b.head.length), `${bw}: filas con distinto nº de columnas`);
      if (b.type === "code") { need(str(b.code), `${bw}: falta code`); if (b.run) need(b.lang === "python", `${bw}: run solo para python`); if (b.stdin) need(Array.isArray(b.stdin), `${bw}: stdin debe ser lista`); }
      if (b.type === "terms") need(Array.isArray(b.items) && b.items.every((t) => str(t.term) && str(t.def)), `${bw}: terms`);
      if (b.type === "diagram") {
        need(str(b.mermaid) && /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|mindmap|timeline)\b/.test(b.mermaid.trim()), `${bw}: tipo de diagrama no permitido`);
        if (/%%\{|classDef|\bstyle\s/.test(b.mermaid || "")) e.push(`${bw}: sin init/classDef/style`);
      }
    });
  });
  (s.exercises || []).forEach((x, i) => {
    const w = `exercises[${i}] ${x.id || ""}`;
    uniq(x.id, w);
    need(str(x.title) && LEVELS.has(x.level), `${w}: title/level`);
    need(Array.isArray(x.prompt) && x.prompt.length >= 1 && x.prompt.every(str), `${w}: prompt debe ser lista de párrafos`);
    need(typeof x.starter === "string" && str(x.solution), `${w}: starter/solution`);
    need(Array.isArray(x.tests) && x.tests.length >= 3 && x.tests.every((t) => str(t.name) && str(t.code)), `${w}: al menos 3 tests con name/code`);
    need(Array.isArray(x.hints) && x.hints.length >= 1 && x.hints.every(str), `${w}: al menos 1 pista`);
    need(str(x.explain), `${w}: falta explain`);
    if (x.examples) need(Array.isArray(x.examples) && x.examples.every((ex) => str(ex.call) && typeof ex.result === "string"), `${w}: examples {call, result}`);
    if (/\b(threading|multiprocessing|subprocess|socket)\b/.test(x.solution || "")) e.push(`${w}: usa módulos no disponibles en el navegador`);
  });
  (s.labs || []).forEach((lab, i) => need(str(lab.id) && str(lab.title) && Array.isArray(lab.steps), `labs[${i}]`));
  (s.flashcards || []).forEach((f, i) => need(str(f.front) && str(f.back), `flashcards[${i}]`));
  (s.quiz || []).forEach((q, i) => {
    const w = `quiz[${i}] ${q.id || ""}`;
    uniq(q.id, w);
    if (!["single", "multi", "yesno"].includes(q.type)) return e.push(`${w}: type inválido`);
    need(str(q.q) && str(q.explain), `${w}: q/explain`);
    if (q.type === "yesno") need(Array.isArray(q.statements) && q.statements.length >= 2 && q.statements.every((st) => str(st.text) && typeof st.answer === "boolean"), `${w}: statements`);
    else {
      need(Array.isArray(q.options) && q.options.length >= 2 && q.options.every(str), `${w}: options`);
      const ok = Array.isArray(q.answer) && q.answer.length >= 1 && q.answer.every((a) => Number.isInteger(a) && a >= 0 && a < (q.options || []).length) && new Set(q.answer).size === q.answer.length;
      need(ok, `${w}: answer fuera de rango`);
      if (q.type === "single") need(q.answer?.length === 1, `${w}: single con varias respuestas`);
      if (q.type === "multi") need(q.answer?.length >= 2, `${w}: multi necesita ≥2`);
    }
  });
  (s.sources || []).forEach((src, i) => need(str(src.title) && /^https?:\/\//.test(src.url || ""), `sources[${i}]`));
  return e;
}

/* ---------------- Mermaid ---------------- */
let mermaidReady = null;
async function checkMermaid(s) {
  if (!mermaidReady) {
    mermaidReady = (async () => {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM("<!doctype html><body></body>");
      globalThis.window = dom.window;
      globalThis.document = dom.window.document;
      try { globalThis.navigator = dom.window.navigator; } catch { /* ya existe */ }
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false });
      return mermaid;
    })();
  }
  const mermaid = await mermaidReady;
  const e = [];
  for (const l of s.lessons || []) for (const [j, b] of (l.blocks || []).entries()) if (b.type === "diagram") {
    try { await mermaid.parse(b.mermaid); }
    catch (err) {
      const msg = String(err?.message || err);
      // jsdom no implementa algunas APIs de medición; eso no es un error de sintaxis
      if (!/is not defined|getBBox|getComputedTextLength/.test(msg)) e.push(`${l.id} bloque ${j} (diagrama): ${msg.split("\n").slice(0, 3).join(" | ")}`);
    }
  }
  return e;
}

/* ---------------- Python (Pyodide) ---------------- */
const WORKER_FILE = path.join(ROOT, "scripts/py-worker.mjs");

function runJobs(jobs) {
  return new Promise((resolve) => {
    const results = new Array(jobs.length);
    let next = 0, current = -1, worker = null, timer = null, crashes = 0;
    const finish = () => { clearTimeout(timer); if (worker) worker.terminate(); resolve(results); };
    const start = () => {
      worker = new Worker(WORKER_FILE, { workerData: { prelude: PRELUDE } });
      worker.on("message", (m) => {
        if (m.type === "ready") return send();
        clearTimeout(timer);
        results[m.i] = m;
        send();
      });
      worker.on("error", (err) => {
        clearTimeout(timer);
        if (current >= 0 && !results[current]) results[current] = { fatal: String(err && err.message || err) };
        worker.terminate();
        if (++crashes > 3) { for (let i = 0; i < jobs.length; i++) if (!results[i]) results[i] = { fatal: "Pyodide no arranca: " + String(err && err.message || err) }; return resolve(results); }
        if (next < jobs.length) start(); else finish();
      });
    };
    const send = () => {
      if (next >= jobs.length) return finish();
      const i = (current = next++);
      timer = setTimeout(() => {
        results[i] = { timeout: true };
        worker.terminate();
        if (next < jobs.length) start(); else resolve(results);
      }, JOB_TIMEOUT);
      worker.postMessage({ ...jobs[i], i });
    };
    if (!jobs.length) return resolve(results);
    start();
  });
}

async function checkPython(s) {
  const e = [];
  const jobs = [];
  for (const x of s.exercises || []) jobs.push({ kind: "exercise", x, label: x.id });
  for (const l of s.lessons || []) for (const [j, b] of (l.blocks || []).entries()) if (b.type === "code" && b.run) jobs.push({ kind: "snippet", code: b.code, stdin: b.stdin, label: `${l.id} bloque ${j}` });
  const res = await runJobs(jobs);
  res.forEach((r, i) => {
    const job = jobs[i];
    if (!r) return e.push(`${job.label}: sin resultado`);
    if (r.timeout) return e.push(`${job.label}: tardó más de ${JOB_TIMEOUT / 1000} s (¿bucle infinito?)`);
    if (r.fatal) return e.push(`${job.label}: error interno: ${r.fatal}`);
    if (job.kind === "snippet") { if (r.error) e.push(`${job.label}: el ejemplo ejecutable falla: ${r.error}`); return; }
    const sol = r.sol;
    if (sol.codeError) e.push(`${job.label}: la SOLUCIÓN lanza error: ${sol.codeError}`);
    else if (sol.setupError) e.push(`${job.label}: el setup lanza error: ${sol.setupError}`);
    else sol.results.filter((t) => !t.ok).forEach((t) => e.push(`${job.label}: la SOLUCIÓN no pasa «${t.name}»: ${t.msg}`));
    if (!r.sta.codeError && !r.sta.setupError && r.sta.results.every((t) => t.ok)) e.push(`${job.label}: el código inicial (starter) ya pasa todos los tests; los tests no comprueban nada`);
  });
  return { errors: e, exercises: (s.exercises || []).length, snippets: jobs.length - (s.exercises || []).length };
}

/* ---------------- Principal ---------------- */
let failed = false;
for (const file of process.argv.slice(2)) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) { console.log(`✗ ${file}\n  - JSON inválido: ${err.message}`); failed = true; continue; }
  const errors = [...checkSchema(s), ...(await checkMermaid(s))];
  const py = await checkPython(s);
  errors.push(...py.errors);
  const counts = {
    lessons: (s.lessons || []).length,
    diagrams: (s.lessons || []).reduce((n, l) => n + (l.blocks || []).filter((b) => b.type === "diagram").length, 0),
    runnable: py.snippets,
    exercises: py.exercises,
    projects: (s.exercises || []).filter((x) => x.level === "proyecto").length,
    flashcards: (s.flashcards || []).length,
    quiz: (s.quiz || []).length
  };
  if (errors.length) { failed = true; console.log(`✗ ${file}  ${JSON.stringify(counts)}\n  - ${errors.slice(0, 60).join("\n  - ")}`); }
  else console.log(`OK ${file}  ${JSON.stringify(counts)}`);
}
process.exit(failed ? 1 : 0);
