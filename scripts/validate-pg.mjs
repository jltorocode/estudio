// Valida secciones del curso de PostgreSQL ejecutándolo todo en PostgreSQL 18 (PGlite, el mismo motor del navegador).
// Uso: node scripts/validate-pg.mjs content/postgresql/s01.json [...]
// - Formato de la sección, diagramas Mermaid y lenguaje (español neutro de Chile).
// - Cada ejemplo ejecutable de las lecciones: sin errores (salvo que el bloque diga "errors": true).
// - Cada ejercicio: el escenario se prepara sin errores; el punto de partida NO resuelve el ejercicio;
//   la solución sí (consulta: mismo resultado; script/psql: todas las comprobaciones pasan).
// - Simulaciones de sesiones: deben estar grabadas (node scripts/record-sims.mjs).
import fs from "fs";
import v8 from "v8";
import vm from "vm";
import { makeEngine } from "./pg-node.mjs";
import { Engine, Session } from "../public/pg/engine.mjs";

const DOMAINS = new Set(["fundamentos", "consultas", "diseno", "avanzado", "experto", "extra"]);
const BLOCKS = new Set(["p", "h", "list", "table", "diagram", "code", "callout", "terms", "sessions"]);
const LEVELS = new Set(["facil", "medio", "dificil", "proyecto"]);
const MODES = new Set(["query", "script", "psql"]);
const DATASETS = new Set(fs.readdirSync(new URL("../public/pg/datasets/", import.meta.url)).filter((f) => f.endsWith(".sql")).map((f) => f.replace(/\.sql$/, "")));
const str = (v) => typeof v === "string" && v.trim().length > 0;
const SPAIN = /\b(ordenadore?s?|coger|cogemos|coge|móvil(es)?|vosotros|habéis|podéis|tenéis|queréis|fichero(s)?|coche(s)?|zumo)\b|€/i;

function checkSchema(s) {
  const e = [];
  const need = (c, m) => { if (!c) e.push(m); };
  need(str(s.id) && str(s.title) && str(s.summary) && str(s.goal), "Faltan id/title/summary/goal");
  need(Number.isInteger(s.order), "order debe ser entero");
  need(DOMAINS.has(s.domain), `domain inválido: ${s.domain}`);
  need(Array.isArray(s.objectives) && s.objectives.length >= 4, "objectives: al menos 4");
  const ids = new Set();
  const uniq = (id, w) => { if (!str(id)) e.push(`${w}: falta id`); else if (ids.has(id)) e.push(`id duplicado: ${id}`); else ids.add(id); };
  const vague = /^(entender|conocer|saber|comprender|aprender)\b/i;
  (s.lessons || []).forEach((l, i) => {
    const w = `lessons[${i}] ${l.id || ""}`;
    uniq(l.id, w);
    need(str(l.title) && Array.isArray(l.blocks) && l.blocks.length >= 5, `${w}: title y al menos 5 bloques`);
    need(Array.isArray(l.goals) && l.goals.length >= 2 && l.goals.length <= 4 && l.goals.every(str), `${w}: goals 2–4`);
    (l.goals || []).forEach((g) => { if (vague.test(g)) e.push(`${w}: objetivo vago «${g.slice(0, 40)}…»`); });
    need(Array.isArray(l.takeaways) && l.takeaways.length >= 3 && l.takeaways.length <= 6, `${w}: takeaways 3–6`);
    (l.blocks || []).forEach((b, j) => {
      const bw = `${w} bloque ${j}`;
      if (!BLOCKS.has(b.type)) return e.push(`${bw}: tipo desconocido ${b.type}`);
      if (["p", "h", "callout"].includes(b.type)) need(str(b.text), `${bw}: falta text`);
      if (b.type === "callout") need(["exam", "tip", "warn"].includes(b.variant), `${bw}: variant inválido`);
      if (b.type === "list") need(Array.isArray(b.items) && b.items.every(str), `${bw}: items`);
      if (b.type === "table") need(Array.isArray(b.head) && b.rows?.every((r) => Array.isArray(r) && r.length === b.head.length), `${bw}: filas con distinto nº de columnas`);
      if (b.type === "code") {
        need(str(b.code), `${bw}: falta code`);
        if (b.run) need(b.lang === "sql", `${bw}: los ejemplos ejecutables usan lang "sql"`);
        if (b.dataset) need(DATASETS.has(b.dataset), `${bw}: dataset desconocido ${b.dataset}`);
      }
      if (b.type === "terms") need(Array.isArray(b.items) && b.items.every((t) => str(t.term) && str(t.def)), `${bw}: terms`);
      if (b.type === "diagram") {
        need(str(b.mermaid) && /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|mindmap|timeline|gantt)\b/.test(b.mermaid.trim()), `${bw}: tipo de diagrama no permitido`);
        if (/%%\{|classDef|\bstyle\s/.test(b.mermaid || "")) e.push(`${bw}: sin init/classDef/style`);
      }
      if (b.type === "sessions") {
        need(Array.isArray(b.sessions) && b.sessions.length >= 1 && Array.isArray(b.steps) && b.steps.length >= 2, `${bw}: sessions y al menos 2 steps`);
        (b.steps || []).forEach((st, k) => {
          need(b.sessions?.includes(st.s) && typeof st.in === "string", `${bw} paso ${k}: s (una de sessions) e in`);
          if (typeof st.prompt !== "string" || (st.out === undefined && !st.wait)) e.push(`${bw} paso ${k}: falta la grabación (ejecuta node scripts/record-sims.mjs ${"<archivo>"})`);
        });
        if (b.dataset) need(DATASETS.has(b.dataset), `${bw}: dataset desconocido ${b.dataset}`);
      }
    });
  });
  (s.exercises || []).forEach((x, i) => {
    const w = `exercises[${i}] ${x.id || ""}`;
    uniq(x.id, w);
    need(str(x.title) && LEVELS.has(x.level), `${w}: title/level`);
    need(MODES.has(x.mode), `${w}: mode debe ser query, script o psql`);
    need(Array.isArray(x.prompt) && x.prompt.length && x.prompt.every(str), `${w}: prompt (lista de párrafos)`);
    if (x.dataset) need(DATASETS.has(x.dataset), `${w}: dataset desconocido ${x.dataset}`);
    need(str(x.solution) || (Array.isArray(x.solution) && x.solution.length && x.solution.every((l) => typeof l === "string")), `${w}: solution`);
    if (x.mode !== "query") need(Array.isArray(x.checks) && x.checks.length >= 2 && x.checks.every((c) => str(c.name) && str(c.sql)), `${w}: al menos 2 checks con name/sql`);
    if (x.mode === "query") need(typeof x.ordered === "boolean", `${w}: ordered (true si el enunciado pide un orden)`);
    need(Array.isArray(x.hints) && x.hints.length >= 1, `${w}: al menos 1 pista`);
    need(str(x.explain), `${w}: explain`);
    (x.requires || []).forEach((r, k) => need(str(r.pattern) && str(r.msg), `${w}: requires[${k}] pattern/msg`));
  });
  (s.flashcards || []).forEach((f, i) => need(str(f.front) && str(f.back), `flashcards[${i}]`));
  (s.quiz || []).forEach((q, i) => {
    const w = `quiz[${i}] ${q.id || ""}`;
    uniq(q.id, w);
    if (!["single", "multi", "yesno"].includes(q.type)) return e.push(`${w}: type inválido`);
    need(str(q.q) && str(q.explain), `${w}: q/explain`);
    if (q.type === "yesno") need(Array.isArray(q.statements) && q.statements.length >= 2 && q.statements.every((st) => str(st.text) && typeof st.answer === "boolean"), `${w}: statements`);
    else {
      need(Array.isArray(q.options) && q.options.length >= 2, `${w}: options`);
      const ok = Array.isArray(q.answer) && q.answer.length >= 1 && q.answer.every((a) => Number.isInteger(a) && a >= 0 && a < (q.options || []).length) && new Set(q.answer).size === q.answer.length;
      need(ok, `${w}: answer fuera de rango`);
      if (q.type === "single") need(q.answer?.length === 1, `${w}: single con varias respuestas`);
      if (q.type === "multi") need(q.answer?.length >= 2, `${w}: multi necesita ≥2`);
    }
  });
  (s.sources || []).forEach((src, i) => need(str(src.title) && /^https?:\/\//.test(src.url || ""), `sources[${i}]`));
  // Español neutro (Chile)
  const text = JSON.stringify({ l: s.lessons, x: (s.exercises || []).map((x) => ({ p: x.prompt, h: x.hints, e: x.explain, t: x.title })), f: s.flashcards, q: s.quiz, g: s.goal, o: s.objectives, su: s.summary });
  const m = text.match(new RegExp(SPAIN.source, "gi"));
  if (m) e.push(`Regionalismos de España (usa español de Chile: computador, archivo, auto, celular, $): ${[...new Set(m)].join(", ")}`);
  return e;
}

let mermaidReady = null;
async function checkMermaid(s) {
  mermaidReady ||= (async () => {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM("<!doctype html><body></body>");
    globalThis.window = dom.window; globalThis.document = dom.window.document;
    try { globalThis.navigator = dom.window.navigator; } catch { /* ya existe */ }
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false });
    return mermaid;
  })();
  const log = console.log, warn = console.warn;
  console.log = () => {}; console.warn = () => {};
  const mermaid = await mermaidReady;
  const e = [];
  try {
    for (const l of s.lessons || []) for (const [j, b] of (l.blocks || []).entries()) if (b.type === "diagram") {
      try { await mermaid.parse(b.mermaid); }
      catch (err) { const msg = String(err?.message || err); if (!/is not defined|getBBox|getComputedTextLength/.test(msg)) e.push(`${l.id} bloque ${j} (diagrama): ${msg.split("\n").slice(0, 3).join(" | ")}`); }
    }
  } finally { console.log = log; console.warn = warn; }
  return e;
}

v8.setFlagsFromString("--expose_gc");
const gc = vm.runInNewContext("gc");
const eng = makeEngine();
const scen = (s, x) => ({ key: `${s.id}/${x.id}`, dataset: x.dataset, database: x.database || x.dataset || "postgres", setup: x.setup || "", extra: x.extra || [] });
const snap = (sc) => eng.snapshot(sc.key, { database: sc.database, dataset: sc.dataset, setup: sc.setup, extra: sc.extra, analyze: sc.analyze });
const UNSUPPORTED = /no está disponible|no admite|invalid command \\/;

async function checkDemos(s) {
  const e = [];
  let n = 0;
  for (const l of s.lessons || []) {
    for (const [j, b] of (l.blocks || []).entries()) {
      if (b.type !== "code" || !b.run) continue;
      n++;
      const w = `${l.id} bloque ${j} (ejemplo)`;
      try {
        const sc = scen(s, { id: `${l.id}-b${j}`, dataset: b.dataset, database: b.database, setup: b.setup, extra: b.extra });
        const data = await snap(sc);
        const ss = await new Session(eng, { data, database: sc.database, extra: sc.extra }).start();
        const r = await ss.psql.feed(b.code);
        const out = r.events.map((ev) => ev.out).join("");
        if (ss.psql.errors.length && !b.errors) e.push(`${w}: error inesperado: ${ss.psql.errors[0].message} (si es a propósito, marca el bloque con "errors": true)`);
        if (!ss.psql.errors.length && b.errors) e.push(`${w}: el bloque dice "errors": true pero no produce ningún error`);
        const bad = out.split("\n").find((line) => UNSUPPORTED.test(line));
        if (bad) e.push(`${w}: la consola simulada responde «${bad.trim()}»`);
        if (ss.psql.sc.pending()) e.push(`${w}: queda una sentencia sin terminar (¿falta un ;?)`);
        await ss.close();
      } catch (err) { e.push(`${w}: ${err.message}`); }
    }
  }
  return { e, n };
}

async function checkExercises(s) {
  const e = [];
  for (const x of s.exercises || []) {
    const w = `${x.id} (${x.mode})`;
    const sc = scen(s, x);
    let data;
    try { data = await snap(sc); } catch (err) { e.push(`${w}: el escenario falla: ${err.message}`); continue; }
    const sol = Array.isArray(x.solution) ? x.solution.join("\n") : x.solution;
    for (const r of x.requires || []) if (!new RegExp(r.pattern, r.flags ?? "i").test(sol.replace(/--[^\n]*/g, ""))) e.push(`${w}: la solución no cumple su propio requisito «${r.msg}»`);
    try {
      if (x.mode === "query") {
        const exp = await eng.runScript(data, { database: sc.database, extra: sc.extra, sql: sol, file: "solucion.sql" });
        if (exp.errors.length) { e.push(`${w}: la solución falla: ${exp.errors[0].message}`); continue; }
        const rows = Engine.lastRows(exp.results);
        if (!rows) { e.push(`${w}: la solución no devuelve filas`); continue; }
        if (!rows.rows.length) e.push(`${w}: la solución devuelve 0 filas (un resultado vacío no enseña nada: ajusta los datos)`);
        const again = await eng.compare(data, { key: sc.key, database: sc.database, extra: sc.extra, student: sol, solution: sol, ordered: !!x.ordered, columns: !!x.columns });
        if (!again.ok) e.push(`${w}: la solución no pasa su propia comparación: ${again.reason}`);
        const start = await eng.compare(data, { key: sc.key, database: sc.database, extra: sc.extra, student: x.starter || "", solution: sol, ordered: !!x.ordered, columns: !!x.columns });
        if (start.ok) e.push(`${w}: el código inicial (starter) ya resuelve el ejercicio`);
        if (x.ordered) {
          // Un ejercicio ordenado debe tener un orden bien definido (sin empates que cambien el resultado)
          const ord = /order\s+by/i.test(sol);
          if (!ord) e.push(`${w}: ordered=true pero la solución no tiene ORDER BY`);
        }
        if (x.checks?.length) {
          const after = await eng.runScript(data, { database: sc.database, extra: sc.extra, sql: sol, keep: true });
          const res = await eng.check(await after.session.dump(), { database: sc.database, extra: sc.extra, checks: x.checks });
          await after.session.close();
          res.filter((c) => !c.ok).forEach((c) => e.push(`${w}: con la solución falla «${c.name}»: ${c.error || c.msg}`));
        }
      } else if (x.mode === "script") {
        const before = await eng.check(data, { database: sc.database, extra: sc.extra, checks: x.checks });
        before.filter((c) => c.error).forEach((c) => e.push(`${w}: el check «${c.name}» da error de SQL antes de resolver: ${c.error}`));
        if (before.every((c) => c.ok)) e.push(`${w}: todas las comprobaciones pasan ANTES de resolver (el ejercicio ya está hecho)`);
        const starter = x.starter && x.starter.replace(/--[^\n]*/g, "").trim() ? x.starter : "";
        if (starter) {
          const st = await eng.runScript(data, { database: sc.database, extra: sc.extra, sql: starter, keep: true });
          const res = await eng.check(await st.session.dump(), { database: sc.database, extra: sc.extra, checks: x.checks });
          await st.session.close();
          if (res.every((c) => c.ok)) e.push(`${w}: el código inicial (starter) ya resuelve el ejercicio`);
        }
        const after = await eng.runScript(data, { database: sc.database, extra: sc.extra, sql: sol, keep: true });
        if (after.errors.length && !x.solutionErrors) e.push(`${w}: la solución produce un error: ${after.errors[0].message}`);
        if (after.tx !== "I") e.push(`${w}: la solución deja una transacción abierta`);
        const res = await eng.check(await after.session.dump(), { database: sc.database, extra: sc.extra, checks: x.checks });
        await after.session.close();
        res.filter((c) => !c.ok).forEach((c) => e.push(`${w}: con la solución falla «${c.name}»: ${c.error || c.msg}`));
      } else {
        const before = await eng.check(data, { database: sc.database, extra: sc.extra, checks: x.checks });
        before.filter((c) => c.error).forEach((c) => e.push(`${w}: el check «${c.name}» da error de SQL antes de resolver: ${c.error}`));
        if (before.every((c) => c.ok)) e.push(`${w}: todas las comprobaciones pasan ANTES de resolver (el ejercicio ya está hecho)`);
        const ss = await new Session(eng, { data, database: sc.database, user: x.user || "postgres", extra: sc.extra, files: x.files }).start();
        const r = await ss.psql.feed(sol);
        const out = r.events.map((ev) => ev.out).join("");
        if (ss.psql.errors.length && !x.solutionErrors) e.push(`${w}: la solución produce un error: ${ss.psql.errors[0].message} (si es a propósito, "solutionErrors": true)`);
        const bad = out.split("\n").find((line) => UNSUPPORTED.test(line));
        if (bad) e.push(`${w}: la consola simulada responde «${bad.trim()}»`);
        if (ss.psql.tx !== "I") e.push(`${w}: la solución deja una transacción abierta`);
        const res = await eng.check(await ss.dump(), { database: ss.home, extra: sc.extra, checks: x.checks });
        await ss.close();
        res.filter((c) => !c.ok).forEach((c) => e.push(`${w}: con la solución falla «${c.name}»: ${c.error || c.msg}`));
      }
    } catch (err) { e.push(`${w}: ${err.message}`); }
    gc();
  }
  return e;
}

let failed = false;
for (const file of process.argv.slice(2)) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); } catch (err) { console.log(`FALLA ${file}\n  JSON inválido: ${err.message}`); failed = true; continue; }
  const errs = [...checkSchema(s), ...(await checkMermaid(s))];
  const demos = await checkDemos(s);
  errs.push(...demos.e, ...(await checkExercises(s)));
  const counts = {
    lessons: s.lessons?.length || 0,
    diagrams: (s.lessons || []).flatMap((l) => l.blocks || []).filter((b) => b.type === "diagram").length,
    demos: demos.n,
    sims: (s.lessons || []).flatMap((l) => l.blocks || []).filter((b) => b.type === "sessions").length,
    exercises: s.exercises?.length || 0,
    projects: (s.exercises || []).filter((x) => x.level === "proyecto").length,
    flashcards: s.flashcards?.length || 0,
    quiz: s.quiz?.length || 0,
  };
  if (errs.length) { failed = true; console.log(`FALLA ${file}  ${JSON.stringify(counts)}\n  - ${errs.join("\n  - ")}`); }
  else console.log(`OK ${file}  ${JSON.stringify(counts)}`);
}
process.exit(failed ? 1 : 0);
