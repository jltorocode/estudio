// Valida secciones del curso de Git.
// Uso: node scripts/validate-git.mjs content/git/s01.json [...]
// Comprueba formato y diagramas; para cada ejercicio: prepara el escenario, exige que algún check falle,
// ejecuta la solución en la terminal de práctica real (respondiendo al editor) y exige que todos pasen.
// También ejecuta cada demostración (bloques "run") y exige que ningún comando sea rechazado.
import fs from "fs";
import * as G from "../lib-node/git-engine.mjs";

const DOMAINS = new Set(["fundamentos", "colaboracion", "avanzado", "experto", "extra"]);
const BLOCKS = new Set(["p", "h", "list", "table", "diagram", "code", "callout", "terms"]);
const LEVELS = new Set(["facil", "medio", "dificil", "proyecto"]);
const str = (v) => typeof v === "string" && v.trim().length > 0;
const strip = (t) => String(t).replace(/\x1b\[[0-9;]*m/g, "");

function checkSchema(s) {
  const e = [];
  const need = (c, m) => { if (!c) e.push(m); };
  need(str(s.id) && str(s.title) && str(s.summary) && str(s.goal), "Faltan id/title/summary/goal");
  need(Number.isInteger(s.order), "order debe ser entero");
  need(DOMAINS.has(s.domain), `domain inválido: ${s.domain}`);
  need(Array.isArray(s.objectives) && s.objectives.length >= 3, "objectives: al menos 3");
  const ids = new Set();
  const uniq = (id, w) => { if (!str(id)) e.push(`${w}: falta id`); else if (ids.has(id)) e.push(`id duplicado: ${id}`); else ids.add(id); };
  const vague = /^(entender|conocer|saber|comprender|aprender)\b/i;
  (s.lessons || []).forEach((l, i) => {
    const w = `lessons[${i}] ${l.id || ""}`;
    uniq(l.id, w);
    need(str(l.title) && Array.isArray(l.blocks) && l.blocks.length >= 4, `${w}: title y al menos 4 bloques`);
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
      if (b.type === "code") { need(str(b.code), `${bw}: falta code`); if (b.run) need(b.lang === "bash", `${bw}: las demostraciones ejecutables usan lang "bash"`); }
      if (b.type === "terms") need(Array.isArray(b.items) && b.items.every((t) => str(t.term) && str(t.def)), `${bw}: terms`);
      if (b.type === "diagram") {
        need(str(b.mermaid) && /^(gitGraph|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|mindmap|timeline)\b/.test(b.mermaid.trim()), `${bw}: tipo de diagrama no permitido`);
        if (/%%\{|classDef|\bstyle\s/.test(b.mermaid || "")) e.push(`${bw}: sin init/classDef/style`);
      }
    });
  });
  (s.exercises || []).forEach((x, i) => {
    const w = `exercises[${i}] ${x.id || ""}`;
    uniq(x.id, w);
    need(str(x.title) && LEVELS.has(x.level), `${w}: title/level`);
    need(Array.isArray(x.prompt) && x.prompt.length && x.prompt.every(str), `${w}: prompt (lista de párrafos)`);
    need(typeof x.setup === "string", `${w}: setup (script bash, puede ser "")`);
    need(typeof x.cwd === "string", `${w}: cwd (carpeta relativa a ~, puede ser "")`);
    need(Array.isArray(x.checks) && x.checks.length >= 2 && x.checks.every((c) => str(c.name) && str(c.script)), `${w}: al menos 2 checks con name/script`);
    need(Array.isArray(x.solution) && x.solution.length && x.solution.every((st) => str(st) || (st && str(st.cmd))), `${w}: solution (lista de comandos)`);
    need(Array.isArray(x.hints) && x.hints.length >= 1, `${w}: al menos 1 pista`);
    need(str(x.explain), `${w}: explain`);
    // bash 3.2: una variable pegada a un carácter no ASCII («$v») corrompe el mensaje
    const bad = [x.setup || "", ...(x.checks || []).map((c) => c.script || "")].join("\n").match(/\$[A-Za-z_][A-Za-z0-9_]*(?=[^\x00-\x7F])|\$[0-9](?=[^\x00-\x7F])/g);
    if (bad) e.push(`${w}: en bash 3.2 escribe \${…} cuando la variable va pegada a un carácter no ASCII: ${[...new Set(bad)].join(", ")}`);
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
  // El analizador de gitGraph de Mermaid imprime avisos internos de su gramática: se silencian
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

/** Ejecuta una lista de pasos en la terminal de práctica, respondiendo al editor si se abre. */
export async function runSteps(s, steps, label) {
  const problems = [];
  for (const st of steps) {
    const cmd = typeof st === "string" ? st : st.cmd;
    const edits = typeof st === "string" ? [] : Array.isArray(st.edit) ? [...st.edit] : st.edit != null ? [st.edit] : [];
    let r = await G.execLine(s, cmd);
    if (r.rejected) problems.push(`${label}: la terminal rechazó «${cmd}»: ${strip(r.out).trim().split("\n").pop()}`);
    if (/tardó demasiado/.test(r.out)) problems.push(`${label}: «${cmd}» tardó demasiado`);
    let guard = 0;
    while (r.editor && guard++ < 10) {
      let content = edits.length ? edits.shift() : r.editor.content;
      const refs = [...content.matchAll(/\{\{SHA:([^}]+)\}\}/g)];
      for (const m of refs) {
        const sha = await G.revParse(s, m[1]);
        if (!sha) problems.push(`${label}: no se pudo resolver {{SHA:${m[1]}}}`);
        content = content.replace(m[0], sha || "0000000");
      }
      r = await G.answerEditor(s, content);
      if (/tardó demasiado/.test(r.out)) problems.push(`${label}: «${cmd}» tardó demasiado`);
    }
    if (r.editor) problems.push(`${label}: «${cmd}» siguió pidiendo el editor`);
  }
  return problems;
}

async function checkExercises(s) {
  const e = [];
  for (const x of s.exercises || []) {
    let a, b;
    try {
      a = await G.createSession({ setup: x.setup, cwd: x.cwd });
      const before = await G.runChecks(a, x.checks, x.cwd);
      if (before.every((r) => r.ok)) e.push(`${x.id}: todos los checks pasan ANTES de resolver (no comprueban nada)`);
      b = await G.createSession({ setup: x.setup, cwd: x.cwd });
      e.push(...(await runSteps(b, x.solution, x.id)));
      const after = await G.runChecks(b, x.checks, x.cwd);
      after.filter((r) => !r.ok).forEach((r) => e.push(`${x.id}: tras la SOLUCIÓN no pasa «${r.name}»: ${r.msg}`));
    } catch (err) {
      e.push(`${x.id}: ${String(err.message || err).slice(0, 300)}`);
    } finally {
      if (a) G.destroySession(a.id);
      if (b) G.destroySession(b.id);
    }
  }
  return e;
}

async function checkDemos(s) {
  const e = [];
  let n = 0;
  for (const l of s.lessons || []) for (const [j, b] of (l.blocks || []).entries()) {
    if (b.type !== "code" || !b.run) continue;
    n++;
    let ses;
    try {
      ses = await G.createSession({ setup: b.setup || "", cwd: b.cwd || "" });
      const lines = b.code.split("\n").map((x) => x.trim()).filter((x) => x && !x.startsWith("#"));
      e.push(...(await runSteps(ses, lines, `${l.id} bloque ${j}`)));
    } catch (err) {
      e.push(`${l.id} bloque ${j}: ${String(err.message || err).slice(0, 300)}`);
    } finally { if (ses) G.destroySession(ses.id); }
  }
  return { e, n };
}

let failed = false;
for (const file of process.argv.slice(2)) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) { console.log(`✗ ${file}\n  - JSON inválido: ${err.message}`); failed = true; continue; }
  const errors = [...checkSchema(s), ...(await checkMermaid(s))];
  errors.push(...(await checkExercises(s)));
  const demos = await checkDemos(s);
  errors.push(...demos.e);
  const counts = {
    lessons: (s.lessons || []).length,
    diagrams: (s.lessons || []).reduce((n, l) => n + (l.blocks || []).filter((b) => b.type === "diagram").length, 0),
    demos: demos.n,
    exercises: (s.exercises || []).length,
    projects: (s.exercises || []).filter((x) => x.level === "proyecto").length,
    flashcards: (s.flashcards || []).length,
    quiz: (s.quiz || []).length
  };
  if (errors.length) { failed = true; console.log(`✗ ${file}  ${JSON.stringify(counts)}\n  - ${errors.slice(0, 60).join("\n  - ")}`); }
  else console.log(`OK ${file}  ${JSON.stringify(counts)}`);
}
process.exit(failed ? 1 : 0);
