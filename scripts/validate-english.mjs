// Valida secciones del curso de inglés.
// Uso: node scripts/validate-english.mjs [--fix-ipa] content/ingles/s01.json [...]
// Comprueba formato, diagramas, ortografía de todo el inglés (diccionario CMU), IPA, que cada ejercicio
// se pueda resolver con su propia respuesta y las cantidades mínimas del plan.
// --fix-ipa rellena el campo `ipa` que falte en los bloques `words` con la pronunciación del diccionario CMU.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as E from "../src/lib/english.ts";
import { enWords, ipaAll, known } from "./en-dict.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COURSES = JSON.parse(fs.readFileSync(path.join(HERE, "..", "content", "courses.json"), "utf8"));
const BLOCKS = new Set(["p", "h", "list", "table", "diagram", "callout", "terms", "words", "phrases", "dialog", "pattern", "text"]);
const LEVELS = new Set(["facil", "medio", "dificil", "proyecto"]);
const KINDS = new Set(["vocabulario", "gramatica", "traduccion", "dictado", "pronunciacion", "conversacion", "examen", "mixto", "lectura", "audicion", "escritura", "expresion"]);
const ITEMS = new Set(["write", "choice", "cloze", "order", "match", "speak", "free"]);

/** Mínimos por sección de cada curso (la sección final, domain "extra", tiene los suyos). */
const MINIMUMS = {
  ingles: {
    normal: { lessons: 5, diagrams: 4, patterns: 3, dialogs: 1, words: 3, phrases: 3, exercises: 12, exams: 1, flashcards: 40, quiz: 35, speak: 8, dictation: 8, listening: 12 },
    final: { lessons: 3, diagrams: 3, exercises: 8, flashcards: 30, quiz: 100, speak: 6, dictation: 6, listening: 10 }
  },
  "ingles-pro": {
    normal: { lessons: 6, diagrams: 5, patterns: 4, dialogs: 2, words: 4, phrases: 4, texts: 2, exercises: 14, exams: 1, flashcards: 50, quiz: 40, speak: 10, dictation: 8, listening: 20, free: 4, freeSpeak: 2, freeWrite: 2 },
    final: { lessons: 4, diagrams: 3, texts: 2, exercises: 10, flashcards: 40, quiz: 120, speak: 6, dictation: 6, listening: 20, free: 4 }
  }
};
const str = (v) => typeof v === "string" && v.trim().length > 0;
const ALLOW = new Set(
  fs.readFileSync(path.join(HERE, "data", "en-allow.txt"), "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim().toLowerCase()).filter(Boolean)
);

// Grafías británicas → americanas (el audio y la IPA del curso son de inglés americano)
const BRITISH = {
  colour: "color", colours: "colors", coloured: "colored", harbour: "harbor", harbours: "harbors", plough: "plow", ploughs: "plows", grey: "gray",
  centre: "center", centres: "centers", theatre: "theater", theatres: "theaters", favour: "favor", favourite: "favorite", behaviour: "behavior",
  honour: "honor", labour: "labor", neighbour: "neighbor", neighbours: "neighbors", humour: "humor", flavour: "flavor", rumour: "rumor",
  metre: "meter", metres: "meters", litre: "liter", litres: "liters", cheque: "check", tyre: "tire", tyres: "tires", jewellery: "jewelry",
  programme: "program", organise: "organize", organised: "organized", realise: "realize", realised: "realized", travelled: "traveled",
  travelling: "traveling", cancelled: "canceled", defence: "defense", offence: "offense", licence: "license", catalogue: "catalog",
  aeroplane: "airplane", moustache: "mustache", pyjamas: "pajamas", mould: "mold", storey: "story", draught: "draft", gaol: "jail",
  armour: "armor", vapour: "vapor", odour: "odor", valour: "valor", splendour: "splendor", fibre: "fiber", sabre: "saber", woollen: "woolen"
};

const args = process.argv.slice(2);
const FIX = args.includes("--fix-ipa");
const files = args.filter((a) => !a.startsWith("--"));

/** IPA esperada de un texto en inglés: por palabra, cualquiera de sus pronunciaciones. */
function ipaOptions(text) {
  const ws = enWords(text);
  const per = ws.map((w) => ipaAll(w));
  return per.every((o) => o.length) ? per : null;
}
const stripIpa = (s) => String(s).replace(/^\/|\/$/g, "").trim();

function check(s, file) {
  const e = [];
  const need = (c, m) => { if (!c) e.push(m); };
  const courseId = path.basename(path.dirname(path.resolve(file)));
  const course = COURSES.find((c) => c.id === courseId);
  if (!course || course.runtime !== "english") return { e: [`${file}: la carpeta no corresponde a un curso de inglés de courses.json`], counts: {} };
  const DOMAINS = new Set(course.domains.map((d) => d.id));
  const isFinal = s.domain === "extra";
  const topics = new Set(course.sections.filter((x) => x !== s.id));
  need(str(s.id) && /^s\d\d$/.test(s.id) && path.basename(file, ".json") === s.id, "id debe ser sNN e igual al nombre del archivo");
  need(str(s.title) && str(s.summary) && str(s.goal), "Faltan title/summary/goal");
  need(Number.isInteger(s.order), "order debe ser entero");
  need(DOMAINS.has(s.domain), `domain inválido: ${s.domain}`);
  need(Array.isArray(s.objectives) && s.objectives.length >= 4, "objectives: al menos 4");
  need(Array.isArray(s.labs) && s.labs.length === 0, "labs debe ser [] (las prácticas son los ejercicios)");
  const ids = new Set();
  const uniq = (id, w, prefix) => {
    if (!str(id)) return e.push(`${w}: falta id`);
    if (ids.has(id)) return e.push(`id duplicado: ${id}`);
    if (prefix && !id.startsWith(`${s.id}-${prefix}`)) e.push(`${w}: el id debe empezar por ${s.id}-${prefix}`);
    ids.add(id);
  };

  // Todo el inglés que se escucha o se escribe pasa por el corrector ortográfico
  const english = [];
  const en = (text, where) => { if (str(text)) english.push([text, where]); };
  const vague = /^(entender|conocer|saber|comprender|aprender)\b/i;
  const counts = { lessons: 0, diagrams: 0, patterns: 0, dialogs: 0, words: 0, phrases: 0, texts: 0, exercises: 0, items: 0, speak: 0, dictation: 0, free: 0, freeSpeak: 0, freeWrite: 0, exams: 0, flashcards: 0, quiz: 0, listening: 0 };

  (s.lessons || []).forEach((l, i) => {
    const w = `lessons[${i}] ${l.id || ""}`;
    counts.lessons++;
    uniq(l.id, w, "l");
    need(str(l.title) && Array.isArray(l.blocks) && l.blocks.length >= 5, `${w}: title y al menos 5 bloques`);
    need(Number.isInteger(l.minutes) && l.minutes > 0, `${w}: minutes`);
    need(Array.isArray(l.goals) && l.goals.length >= 2 && l.goals.length <= 4 && l.goals.every(str), `${w}: goals 2–4`);
    (l.goals || []).forEach((g) => { if (vague.test(g)) e.push(`${w}: objetivo vago «${g.slice(0, 40)}…» (usa un verbo observable)`); });
    need(Array.isArray(l.takeaways) && l.takeaways.length >= 3 && l.takeaways.length <= 6 && l.takeaways.every(str), `${w}: takeaways 3–6`);
    (l.blocks || []).forEach((b, j) => {
      const bw = `${w} bloque ${j} (${b.type})`;
      if (!BLOCKS.has(b.type)) return e.push(`${bw}: tipo desconocido`);
      if (["p", "h", "callout"].includes(b.type)) need(str(b.text), `${bw}: falta text`);
      if (b.type === "callout") need(["exam", "tip", "warn"].includes(b.variant), `${bw}: variant inválido`);
      if (b.type === "list") need(Array.isArray(b.items) && b.items.length && b.items.every(str), `${bw}: items`);
      if (b.type === "table") need(Array.isArray(b.head) && b.head.length && Array.isArray(b.rows) && b.rows.length && b.rows.every((r) => Array.isArray(r) && r.length === b.head.length && r.every((c) => typeof c === "string")), `${bw}: filas con distinto nº de columnas`);
      if (b.type === "terms") need(Array.isArray(b.items) && b.items.every((t) => str(t.term) && str(t.def)), `${bw}: terms`);
      if (b.type === "diagram") {
        counts.diagrams++;
        need(str(b.mermaid) && /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|mindmap|timeline)\b/.test(b.mermaid.trim()), `${bw}: tipo de diagrama no permitido`);
        if (/%%\{|classDef|\bstyle\s/.test(b.mermaid || "")) e.push(`${bw}: sin init/classDef/style`);
        need(str(b.title), `${bw}: title`);
      }
      if (b.type === "words") {
        counts.words++;
        need(Array.isArray(b.items) && b.items.length >= 1, `${bw}: items`);
        (b.items || []).forEach((it, k) => {
          const iw = `${bw} [${k}] ${it.en || ""}`;
          if (!str(it.en) || !str(it.es)) return e.push(`${iw}: en y es obligatorios`);
          en(it.en, iw);
          const opts = ipaOptions(it.en);
          if (!str(it.ipa)) {
            if (opts && FIX) it.ipa = "/" + opts.map((o) => o[0]).join(" ") + "/";
            else e.push(`${iw}: falta ipa${opts ? " (ejecuta con --fix-ipa para rellenarla)" : " (la palabra no está en el diccionario: escríbela a mano)"}`);
          } else if (opts) {
            const got = stripIpa(it.ipa).split(/\s+/);
            const ok = got.length === opts.length && got.every((g, n) => opts[n].includes(g));
            if (!ok) e.push(`${iw}: ipa «${it.ipa}» no coincide con el diccionario CMU (${"/" + opts.map((o) => o[0]).join(" ") + "/"}${opts.some((o) => o.length > 1) ? "; variantes: " + opts.map((o) => o.join(" | ")).join(" · ") : ""})`);
          }
          if (it.ipa && !/^\/.+\/$/.test(it.ipa)) e.push(`${iw}: ipa va entre barras: /…/`);
        });
      }
      if (b.type === "phrases") {
        counts.phrases++;
        need(Array.isArray(b.items) && b.items.length >= 2 && b.items.every((p) => str(p.en) && str(p.es)), `${bw}: al menos 2 items con en/es`);
        (b.items || []).forEach((p, k) => en(p.en, `${bw} [${k}]`));
      }
      if (b.type === "dialog") {
        counts.dialogs++;
        need(Array.isArray(b.lines) && b.lines.length >= 4 && b.lines.every((x) => str(x.who) && str(x.en) && str(x.es)), `${bw}: al menos 4 líneas con who/en/es`);
        (b.lines || []).forEach((x, k) => en(x.en, `${bw} línea ${k}`));
        const who = new Set((b.lines || []).map((x) => x.who));
        need(who.size >= 2 && who.size <= 4, `${bw}: 2–4 personajes`);
      }
      if (b.type === "text") {
        counts.texts++;
        need(Array.isArray(b.paragraphs) && b.paragraphs.length >= 2 && b.paragraphs.every((p) => str(p.en) && str(p.es)), `${bw}: al menos 2 paragraphs con en/es`);
        need(!b.kind || b.kind === "read" || b.kind === "listen", `${bw}: kind read|listen`);
        (b.paragraphs || []).forEach((p, k) => en(p.en, `${bw} párrafo ${k}`));
        if (b.glossary != null) need(Array.isArray(b.glossary) && b.glossary.every((g) => str(g.en) && str(g.es)), `${bw}: glossary con en/es`);
        (b.glossary || []).forEach((g, k) => en(g.en, `${bw} glosario ${k}`));
        if (b.questions != null) need(Array.isArray(b.questions) && b.questions.every((q) => str(q.q) && Array.isArray(q.options) && q.options.length >= 2 && q.options.every(str) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length), `${bw}: questions (q, options ≥ 2, answer en rango)`);
        if (b.kind === "listen") { need(Array.isArray(b.questions) && b.questions.length >= 3, `${bw}: una audición necesita al menos 3 preguntas`); counts.listening++; }
      }
      if (b.type === "pattern") {
        counts.patterns++;
        need(Array.isArray(b.slots) && b.slots.length >= 2 && b.slots.every(str), `${bw}: slots (≥ 2)`);
        need(Array.isArray(b.rows) && b.rows.length >= 2 && b.rows.every((r) => Array.isArray(r) && r.length === (b.slots || []).length && r.every((c) => typeof c === "string")), `${bw}: rows con tantas celdas como slots (celda vacía = "")`);
        if (b.es != null) need(Array.isArray(b.es) && b.es.length === (b.rows || []).length && b.es.every(str), `${bw}: es debe tener una traducción por fila`);
        (b.rows || []).forEach((r, k) => en(r.join(" "), `${bw} fila ${k}`));
      }
    });
  });

  (s.exercises || []).forEach((x, i) => {
    const w = `exercises[${i}] ${x.id || ""}`;
    counts.exercises++;
    uniq(x.id, w, "e");
    need(str(x.title) && LEVELS.has(x.level), `${w}: title/level`);
    need(KINDS.has(x.kind), `${w}: kind inválido (${x.kind})`);
    if (x.kind === "examen") counts.exams++;
    need(Array.isArray(x.prompt) && x.prompt.length && x.prompt.every(str), `${w}: prompt (lista de párrafos)`);
    need(str(x.explain), `${w}: explain`);
    if (x.pass != null) need(Number.isInteger(x.pass) && x.pass >= 50 && x.pass <= 100, `${w}: pass entre 50 y 100`);
    if (x.hints != null) need(Array.isArray(x.hints) && x.hints.every(str), `${w}: hints`);
    need(Array.isArray(x.items) && x.items.length >= 6 && x.items.length <= 40, `${w}: entre 6 y 40 ítems`);
    (x.items || []).forEach((it, k) => {
      const iw = `${w} ítem ${k} (${it.t})`;
      counts.items++;
      if (!ITEMS.has(it.t)) return e.push(`${iw}: tipo desconocido`);
      const tryExpand = (pat) => { try { const r = E.expand(pat); if (!r.length) e.push(`${iw}: el patrón «${pat}» no produce respuestas`); return r; } catch (err) { e.push(`${iw}: ${err.message}`); return []; } };
      if (it.say != null && typeof it.say === "string") { en(it.say, iw + " say"); counts.listening++; }
      if (it.t === "write") {
        need(str(it.q), `${iw}: q`);
        need(Array.isArray(it.answers) && it.answers.length && it.answers.every(str), `${iw}: answers`);
        need(!it.lang || it.lang === "en" || it.lang === "es", `${iw}: lang en|es`);
        if (str(it.say)) counts.dictation++;
        for (const a of it.answers || []) {
          const forms = tryExpand(a);
          if (it.lang !== "es") forms.forEach((f) => en(f, iw + " answer"));
          const g = forms[0] ? E.grade(forms[0], it.answers, { lang: it.lang || "en", strict: it.strict }) : null;
          if (g && !g.correct) e.push(`${iw}: su propia respuesta «${forms[0]}» no se da por buena`);
        }
      }
      if (it.t === "choice") {
        need(str(it.q), `${iw}: q`);
        need(Array.isArray(it.options) && it.options.length >= 2 && it.options.length <= 6 && it.options.every(str), `${iw}: 2–6 options`);
        need(new Set((it.options || []).map((o) => o.trim().toLowerCase())).size === (it.options || []).length, `${iw}: opciones repetidas`);
        need(Number.isInteger(it.answer) && it.answer >= 0 && it.answer < (it.options || []).length, `${iw}: answer fuera de rango`);
      }
      if (it.t === "cloze") {
        need(str(it.text), `${iw}: text`);
        const n = E.gaps(it.text || "");
        need(n >= 1, `${iw}: text sin huecos ___`);
        need(Array.isArray(it.answers) && it.answers.length === n && it.answers.every((a) => Array.isArray(a) && a.length && a.every(str)), `${iw}: answers debe ser una lista por hueco (${n} huecos)`);
        (it.answers || []).forEach((alts) => Array.isArray(alts) && alts.forEach(tryExpand));
        if (n && it.answers?.length === n) en(E.fillCloze(it.text, it.answers), iw);
        if (it.say != null) need(typeof it.say === "boolean", `${iw}: en cloze, say es true/false`);
        if (it.say === true) counts.listening++;
      }
      if (it.t === "order") {
        need(str(it.q), `${iw}: q`);
        const t = E.tiles(it.answer || "");
        need(t.length >= 3 && t.length <= 16, `${iw}: answer con 3–16 palabras`);
        en(it.answer, iw);
        const key = (arr) => arr.map((x) => x.toLowerCase()).sort().join(" ");
        for (const alt of it.answers || []) {
          en(alt, iw);
          if (key(E.tiles(alt)) !== key(t)) e.push(`${iw}: la alternativa «${alt}» no usa exactamente las mismas fichas`);
        }
        const lower = new Set(t.map((x) => x.toLowerCase()));
        for (const x of it.extra || []) {
          en(x, iw + " extra");
          if (lower.has(String(x).toLowerCase())) e.push(`${iw}: la ficha extra «${x}» también está en la respuesta`);
          if (E.words(x).length !== 1) e.push(`${iw}: cada ficha extra es una sola palabra`);
        }
      }
      if (it.t === "match") {
        need(Array.isArray(it.pairs) && it.pairs.length >= 3 && it.pairs.length <= 8 && it.pairs.every((p) => Array.isArray(p) && p.length === 2 && str(p[0]) && str(p[1])), `${iw}: 3–8 pares [inglés, español]`);
        const L = (it.pairs || []).map((p) => String(p[0]).toLowerCase()), R = (it.pairs || []).map((p) => String(p[1]).toLowerCase());
        need(new Set(L).size === L.length && new Set(R).size === R.length, `${iw}: pares repetidos`);
        (it.pairs || []).forEach((p) => en(p[0], iw));
      }
      if (it.t === "speak") { need(str(it.say), `${iw}: say`); counts.speak++; }
      if (it.t === "free") {
        counts.free++;
        need(it.mode === "write" || it.mode === "speak", `${iw}: mode write|speak`);
        if (it.mode === "speak") counts.freeSpeak++; else counts.freeWrite++;
        need(str(it.q) && str(it.model), `${iw}: q y model`);
        en(it.model, iw + " model");
        need(Array.isArray(it.rubric) && it.rubric.length >= 3 && it.rubric.every(str), `${iw}: rubric con al menos 3 criterios`);
        if (it.minWords != null) need(Number.isInteger(it.minWords) && it.minWords > 0, `${iw}: minWords`);
        if (it.maxWords != null) need(Number.isInteger(it.maxWords) && it.maxWords >= (it.minWords || 1), `${iw}: maxWords`);
        if (it.targets != null) need(Array.isArray(it.targets) && it.targets.every((t) => str(t.label) && Array.isArray(t.any) && t.any.length && t.any.every(str)), `${iw}: targets [{label, any: [...]}]`);
        (it.targets || []).forEach((t) => (t.any || []).forEach((a) => tryExpand(a).forEach((f) => en(f.replace(/\*/g, " "), iw + " target"))));
        // La respuesta modelo tiene que cumplir sus propias metas y su extensión
        const hits = E.targetHits(it.model || "", it.targets || []);
        hits.forEach((h, k) => { if (!h) e.push(`${iw}: la respuesta modelo no cumple la meta «${it.targets[k].label}»`); });
        const n = E.wordCount(it.model || "");
        if (it.minWords && n < it.minWords) e.push(`${iw}: la respuesta modelo tiene ${n} palabras (mínimo ${it.minWords})`);
        if (it.maxWords && n > it.maxWords) e.push(`${iw}: la respuesta modelo tiene ${n} palabras (máximo ${it.maxWords})`);
      }
    });
  });

  (s.flashcards || []).forEach((f, i) => {
    counts.flashcards++;
    need(str(f.front) && str(f.back), `flashcards[${i}]`);
    if (f.say != null) { need(str(f.say), `flashcards[${i}]: say`); en(f.say, `flashcards[${i}]`); }
  });
  (s.quiz || []).forEach((q, i) => {
    const w = `quiz[${i}] ${q.id || ""}`;
    counts.quiz++;
    uniq(q.id, w, "q");
    if (q.say != null) { need(str(q.say), `${w}: say`); en(q.say, w); counts.listening++; }
    if (isFinal) need(topics.has(q.topic || ""), `${w}: en el examen final, topic = una sección del curso (${[...topics][0]}…${[...topics].at(-1)})`);
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
  need(Array.isArray(s.sources) && s.sources.length >= 2, "sources: al menos 2");
  (s.sources || []).forEach((src, i) => need(str(src.title) && (/^https?:\/\//.test(src.url || "") || (courseId === "ingles" && /^\/libros\/ingles-basico\.pdf(#page=\d+)?$/.test(src.url || ""))), `sources[${i}]: url https://…${courseId === "ingles" ? " o /libros/ingles-basico.pdf#page=N" : ""}`));

  // Ortografía (la sección puede declarar nombres propios en "allow": ["Matanzas"])
  if (s.allow != null) need(Array.isArray(s.allow) && s.allow.every((w) => str(w) && /^\p{Lu}/u.test(w)), "allow: lista de nombres propios (con mayúscula)");
  const allow = new Set([...ALLOW, ...(Array.isArray(s.allow) ? s.allow.map((w) => String(w).toLowerCase()) : [])]);
  const bad = new Map();
  for (const [text, where] of english)
    for (const word of enWords(text)) if (!known(word) && !allow.has(word.toLowerCase())) { if (!bad.has(word)) bad.set(word, where); }
  for (const [word, where] of bad) e.push(`ortografía: «${word}» no existe en el diccionario (${where}). Si es un nombre propio, añádelo a "allow" de la sección`);
  const brit = new Map();
  for (const [text, where] of english) for (const word of enWords(text)) { const us = BRITISH[word.toLowerCase()]; if (us && !brit.has(word.toLowerCase())) brit.set(word.toLowerCase(), [us, where]); }
  for (const [word, [us, where]] of brit) e.push(`grafía británica «${word}» (${where}): el curso usa inglés americano → «${us}» (puedes mencionar la británica en una nota)`);

  // s11: el vocabulario completo de Ogden en sus cinco grupos
  if (courseId === "ingles" && s.id === "s11") {
    const GROUPS = [["Operaciones", 100], ["Cosas generales", 400], ["Cosas que se pueden dibujar", 200], ["Cualidades generales", 100], ["Cualidades opuestas", 50]];
    const seen = new Map();
    for (const l of s.lessons || []) for (const b of l.blocks || []) if (b.type === "words" && str(b.title)) {
      const g = GROUPS.find(([name]) => b.title.startsWith(name));
      if (!g) continue;
      for (const it of b.items || []) {
        const k = String(it.en || "").toLowerCase();
        if (seen.has(k)) e.push(`vocabulario 850: «${it.en}» repetida (${seen.get(k)} y ${g[0]})`);
        seen.set(k, g[0]);
      }
    }
    for (const [name, n] of GROUPS) {
      const c = [...seen.values()].filter((v) => v === name).length;
      if (c !== n) e.push(`vocabulario 850: el grupo «${name}» tiene ${c} palabras y deben ser ${n} (bloques words cuyo title empieza por «${name}»)`);
    }
  }

  // Cantidades mínimas del plan
  const mins = MINIMUMS[courseId] || MINIMUMS.ingles;
  const min = isFinal ? mins.final : mins.normal;
  for (const [k, v] of Object.entries(min)) if (counts[k] < v) e.push(`mínimo del plan: ${k} ≥ ${v} (hay ${counts[k]})`);
  return { e, counts };
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

let failed = false;
for (const file of files) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) { console.log(`✗ ${file}\n  - JSON inválido: ${err.message}`); failed = true; continue; }
  const { e, counts } = check(s, file);
  e.push(...(await checkMermaid(s)));
  if (FIX) fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
  if (e.length) { failed = true; console.log(`✗ ${file}  ${JSON.stringify(counts)}\n  - ${e.slice(0, 80).join("\n  - ")}${e.length > 80 ? `\n  … y ${e.length - 80} más` : ""}`); }
  else console.log(`OK ${file}  ${JSON.stringify(counts)}`);
}
process.exit(failed ? 1 : 0);
