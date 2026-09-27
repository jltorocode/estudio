// Corrección de respuestas del curso de inglés. Sin dependencias: lo usan el navegador y el validador
// (Node 24 importa este archivo directamente, por eso solo usa sintaxis de TypeScript que se puede borrar).

/* --------------------------------- Tipos --------------------------------- */

/** Resultado de comparar una respuesta: ok, ok salvo tildes o apóstrofos («typo»), casi (1–2 letras) o incorrecta. */
export type Verdict = "ok" | "typo" | "close" | "wrong";
export type DiffPart = { t: string; k: "same" | "miss" | "extra" };
export type Grade = { verdict: Verdict; correct: boolean; expected: string; diff: DiffPart[] };

/* ------------------------- Patrones de respuesta ------------------------- */

const MAX_EXPANSIONS = 500;

/**
 * Expande un patrón de respuesta aceptada.
 * `{a|b}` = alternativas, `(x)` = opcional; se pueden anidar: `(I think) {he|she} is {late|delayed}`.
 * Lanza un error si las llaves o paréntesis no están equilibrados.
 */
export function expand(pattern: string): string[] {
  const s = String(pattern ?? "");
  let i = 0;
  const cross = (a: string[], b: string[]) => {
    const out: string[] = [];
    for (const x of a) for (const y of b) { out.push(x + y); if (out.length > MAX_EXPANSIONS) throw new Error(`demasiadas combinaciones en «${s}»`); }
    return out;
  };
  const seq = (stops: string): string[] => {
    let acc = [""];
    while (i < s.length && !stops.includes(s[i])) {
      const c = s[i];
      if (c === "{") { i++; acc = cross(acc, alt()); }
      else if (c === "(") {
        i++;
        const inner = seq(")");
        if (s[i] !== ")") throw new Error(`falta «)» en «${s}»`);
        i++;
        acc = cross(acc, [...inner, ""]);
      } else if (c === "}" || c === ")" || c === "|") throw new Error(`«${c}» sobrante en «${s}»`);
      else { acc = acc.map((a) => a + c); i++; }
    }
    return acc;
  };
  const alt = (): string[] => {
    const out: string[] = [];
    for (;;) {
      out.push(...seq("|}"));
      if (s[i] === "|") { i++; continue; }
      if (s[i] !== "}") throw new Error(`falta «}» en «${s}»`);
      i++;
      return out;
    }
  };
  const all = seq("");
  if (i < s.length) throw new Error(`«${s[i]}» sobrante en «${s}»`);
  // Si el patrón empieza con mayúscula, todas sus formas también (al omitir «(I think)» queda «He is late»)
  const upper = /^[^\p{L}]*\p{Lu}/u.test(s.replace(/[{}()|]/g, ""));
  const clean = all
    .map((x) => x.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").replace(/([¿¡])\s+/g, "$1").trim())
    .map((x) => (upper ? x.replace(/\p{L}/u, (c) => c.toUpperCase()) : x))
    .filter(Boolean);
  return [...new Set(clean)];
}

/** Primera forma de un patrón (la «canónica», la que se muestra como respuesta). */
export const canonical = (pattern: string) => expand(pattern)[0] ?? "";

/* ------------------------------ Normalización ----------------------------- */

const base = (s: string) =>
  String(s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»"]/g, " ")
    .replace(/[‐‑‒–—/]/g, " ")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2")
    .replace(/[.,!?¿¡;:()[\]…]/g, " ")
    .replace(/(^|\s)'+|'+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const FIXED: Record<string, string> = {
  "won't": "will not", "can't": "can not", cannot: "can not", "shan't": "shall not", "ain't": "is not",
  "let's": "let us", "i'm": "i am"
};
const S_PRONOUNS = new Set(["it", "he", "she", "that", "there", "here", "what", "who", "where", "when", "how", "this", "everyone", "everything", "nothing", "somebody", "someone"]);
const D_PRONOUNS = new Set(["i", "you", "he", "she", "it", "we", "they", "there", "who", "that"]);

/**
 * Formas normalizadas de una respuesta en inglés. Las contracciones se expanden (don't → do not) y
 * las ambiguas producen varias formas (it's → it is / it has; I'd → I would / I had).
 * Con `strict` no se tocan las contracciones (ejercicios sobre contracciones).
 * Con `loose` (solo para lo que escribe el alumno), «sky's» también puede ser «sky is» / «sky has».
 */
export function enForms(text: string, strict = false, loose = false): string[] {
  const words = base(text).replace(/\bto day\b/g, "today").split(" ").filter(Boolean);
  if (strict) return [words.join(" ")];
  let forms: string[][] = [[]];
  for (const w of words) {
    let opts: string[];
    const m = w.match(/^([a-z]+)'(s|d|re|ve|ll|m)$/);
    if (FIXED[w]) opts = [FIXED[w]];
    else if (/^[a-z]+n't$/.test(w)) opts = [w.slice(0, -3) + " not"];
    else if (m && m[2] === "re") opts = [m[1] + " are"];
    else if (m && m[2] === "ve") opts = [m[1] + " have"];
    else if (m && m[2] === "ll") opts = [m[1] + " will"];
    else if (m && m[2] === "m") opts = [m[1] + " am"];
    else if (m && m[2] === "s" && S_PRONOUNS.has(m[1])) opts = [m[1] + " is", m[1] + " has"];
    // «The sky's blue»: con un sustantivo, 's puede ser posesivo o contracción de is/has
    else if (m && m[2] === "s" && loose) opts = [w, m[1] + " is", m[1] + " has"];
    else if (m && m[2] === "d" && D_PRONOUNS.has(m[1])) opts = [m[1] + " would", m[1] + " had"];
    else opts = [w];
    const next: string[][] = [];
    for (const f of forms) for (const o of opts) if (next.length < 32) next.push([...f, o]);
    forms = next;
  }
  return [...new Set(forms.map((f) => f.join(" ").replace(/\s+/g, " ").trim()))];
}

/** Contracciones escritas sin apóstrofo que no se confunden con otra palabra (dont → don't). */
const NO_APOS: Record<string, string> = Object.fromEntries(
  ["don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "can't", "couldn't", "wouldn't", "shouldn't", "mustn't", "needn't", "i'm", "i've", "you're", "they're", "you've", "we've", "they've", "that's", "what's", "let's", "it'll", "i'll", "you'll", "she'll", "they'll", "we'd", "you'd", "they'd", "she's", "there's", "here's", "where's", "who's", "how's"]
    .map((c) => [c.replace("'", ""), c])
);
/** Pone el apóstrofo que falta en contracciones escritas sin él. */
const fixApostrophes = (text: string) => base(text).split(" ").map((w) => NO_APOS[w] || w).join(" ");

/** Forma normalizada de una respuesta en español (minúsculas, sin puntuación). */
export const esForm = (text: string) => base(text);

/** Quita tildes y diéresis (también ñ → n) para detectar respuestas correctas salvo por las tildes. */
export const noAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/* -------------------------------- Distancias ------------------------------ */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Palabras visibles de un texto (conserva mayúsculas y apóstrofos; quita la puntuación). */
export function words(text: string): string[] {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»"]/g, " ")
    .replace(/[.,!?¿¡;:()[\]…]/g, " ")
    .replace(/(^|\s)'+|'+(?=\s|$)/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
}

/** Diferencia palabra a palabra entre lo que escribió el alumno y la respuesta esperada. */
export function diffWords(user: string, expected: string): DiffPart[] {
  return diffTokens(words(user), words(expected));
}

function diffTokens(a: string[], b: string[]): DiffPart[] {
  const ka = a.map((w) => noAccents(w.toLowerCase())), kb = b.map((w) => noAccents(w.toLowerCase()));
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = ka[i] === kb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (ka[i] === kb[j]) { out.push({ t: b[j], k: "same" }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: a[i++], k: "extra" });
    else out.push({ t: b[j++], k: "miss" });
  }
  while (i < n) out.push({ t: a[i++], k: "extra" });
  while (j < m) out.push({ t: b[j++], k: "miss" });
  return out;
}

/* -------------------------------- Corrección ------------------------------ */

export type GradeOpts = { lang?: "en" | "es"; strict?: boolean };

/**
 * Compara la respuesta del alumno con los patrones aceptados.
 * - Inglés: ignora mayúsculas, puntuación y contracciones (salvo `strict`). Sin tolerancia a faltas:
 *   *walk* y *walks* son respuestas distintas. Si está a 1–2 letras, el veredicto es «close» (incorrecta, pero se avisa).
 * - Español: además acepta la respuesta sin tildes (veredicto «accent», cuenta como correcta con aviso).
 */
export function grade(user: string, patterns: string[], opts: GradeOpts = {}): Grade {
  const lang = opts.lang || "en";
  const answers = patterns.flatMap((p) => expand(p));
  const fallback = answers[0] ?? "";
  const forms = (t: string, mineSide = false) => (lang === "es" ? [esForm(t)] : enForms(t, opts.strict, mineSide));
  // La diferencia se calcula sobre las formas normalizadas (minúsculas, contracciones expandidas)
  const diffOf = (mine: string, theirs: string) => diffTokens(mine.split(" ").filter(Boolean), theirs.split(" ").filter(Boolean));
  if (!String(user ?? "").trim()) return { verdict: "wrong", correct: false, expected: fallback, diff: diffOf("", forms(fallback)[0] || "") };
  const mine = forms(user, true);
  let best = fallback, bestD = Infinity, bestPair: [string, string] = [mine[0] || "", forms(fallback)[0] || ""];
  for (const a of answers) {
    const theirs = forms(a);
    const hit = mine.find((x) => theirs.includes(x));
    if (hit) return { verdict: "ok", correct: true, expected: a, diff: diffOf(hit, hit) };
    for (const x of mine) for (const y of theirs) {
      const d = levenshtein(x, y);
      if (d < bestD) { bestD = d; best = a; bestPair = [x, y]; }
    }
  }
  // Correcta salvo por tildes (español) o por un apóstrofo olvidado (inglés): cuenta, con aviso
  if (lang === "es") {
    const plain = mine.map(noAccents);
    for (const a of answers) if (plain.includes(noAccents(esForm(a)))) return { verdict: "typo", correct: true, expected: a, diff: diffOf(mine[0], esForm(a)) };
  } else if (!opts.strict) {
    const fixed = enForms(fixApostrophes(user));
    for (const a of answers) if (enForms(a).some((y) => fixed.includes(y))) return { verdict: "typo", correct: true, expected: a, diff: diffOf(base(user), base(a)) };
  }
  const long = Math.max(...mine.map((x) => x.length));
  const verdict: Verdict = bestD <= (long >= 12 ? 2 : 1) && long >= 4 ? "close" : "wrong";
  return { verdict, correct: false, expected: best, diff: diffOf(bestPair[0], bestPair[1]) };
}

/* ---------------------- Pronunciación (reconocimiento) --------------------- */

const NUM: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  "11": "eleven", "12": "twelve", "13": "thirteen", "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen", "18": "eighteen", "19": "nineteen", "20": "twenty",
  "30": "thirty", "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy", "80": "eighty", "90": "ninety", "100": "one hundred", "1st": "first", "2nd": "second", "3rd": "third"
};

/** Palabras comparables para la pronunciación: minúsculas, contracciones expandidas y números en letras. */
export function speechTokens(text: string): string[] {
  return (enForms(text)[0] || "").split(" ").flatMap((w) => (NUM[w] ? NUM[w].split(" ") : [w])).filter(Boolean);
}

/**
 * Compara lo que reconoció el navegador con la frase modelo.
 * Devuelve el % de palabras del modelo que se reconocieron en orden y el detalle palabra a palabra.
 */
export function speechScore(heard: string, target: string): { pct: number; parts: DiffPart[] } {
  const a = speechTokens(heard), b = speechTokens(target);
  const parts = diffWords(a.join(" "), b.join(" "));
  const same = parts.filter((p) => p.k === "same").length;
  return { pct: b.length ? Math.round((same / b.length) * 100) : 0, parts };
}

/* ------------------------------ Otros ayudantes ---------------------------- */

/** Fichas de un ejercicio de ordenar: las palabras de la respuesta (sin puntuación final). */
export const tiles = (answer: string) => words(answer);

/** Rellena los huecos «___» de un texto con las primeras respuestas aceptadas (para escuchar la frase completa). */
export function fillCloze(text: string, answers: string[][]): string {
  let k = 0;
  return text.replace(/_{3,}/g, () => canonical(answers[k++]?.[0] ?? ""));
}

/** Nº de huecos «___» de un texto. */
export const gaps = (text: string) => (String(text).match(/_{3,}/g) || []).length;

/* ------------------------- Repetición espaciada (SRS) ------------------------- */

/** Días de espera de cada caja de Leitner (0 = nueva o fallada: se repasa hoy). */
export const SRS_DAYS = [0, 1, 3, 7, 16, 35];

/** Día local actual como número de días desde 1970 (para programar repasos). */
export function today(d = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** Nuevo estado [caja, díaDeRepaso] tras responder una tarjeta. */
export function srsNext(state: [number, number] | undefined, ok: boolean, day = today()): [number, number] {
  const box = ok ? Math.min((state?.[0] ?? 0) + 1, SRS_DAYS.length - 1) : 0;
  return [box, day + SRS_DAYS[box]];
}
