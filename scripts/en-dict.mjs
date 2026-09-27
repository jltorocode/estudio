// Diccionario de pronunciación CMU (Carnegie Mellon, licencia en data/CMUDICT-LICENSE.txt):
// transcripción IPA (inglés americano) y comprobación ortográfica para el curso de inglés.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "cmudict.dict.gz");
let DICT = null;

// Correcciones de acento que el diccionario CMU trae mal (comprobadas en Merriam-Webster y Cambridge)
const FIXES = {
  undertake: "AH2 N D ER0 T EY1 K",
  overcome: "OW2 V ER0 K AH1 M",
  overtake: "OW2 V ER0 T EY1 K",
  overdo: "OW2 V ER0 D UW1",
  overlook: "OW2 V ER0 L UH1 K",
  // Números en -teen: acento principal en -teen (el CMU les pone dos acentos principales)
  thirteen: "TH ER2 T IY1 N",
  thirteenth: "TH ER2 T IY1 N TH",
  fourteen: "F AO2 R T IY1 N",
  fourteenth: "F AO2 R T IY1 N TH",
  seventeen: "S EH2 V AH0 N T IY1 N",
  seventeenth: "S EH2 V AH0 N T IY1 N TH",
  nineteen: "N AY2 N T IY1 N",
  nineteenth: "N AY2 N T IY1 N TH",
  outside: "AW2 T S AY1 D",
  // Vocales o acentos que el CMU trae mal
  apparatus: "AE2 P AH0 R AE1 T AH0 S",
  panorama: "P AE2 N AH0 R AE1 M AH0",
  paperboy: "P EY1 P ER0 B OY2",
  direction: "D IH0 R EH1 K SH AH0 N",
  hospital: "HH AA1 S P IH0 T AH0 L",
  probably: "P R AA1 B AH0 B L IY0",
  thirty: "TH ER1 D IY0",
  tomorrow: "T AH0 M AA1 R OW0",
  toothbrush: "T UW1 TH B R AH2 SH",
  invention: "IH0 N V EH1 N SH AH0 N"
};

// Pronunciaciones que el CMU no trae: sustantivos con el acento al principio (an UPgrade), verbos con el
// acento al final (to exPORT) y la forma habitual de tres sílabas de «comfortable»
const EXTRA = {
  comfortable: ["K AH1 M F T ER0 B AH0 L"],
  upgrade: ["AH1 P G R EY2 D"],
  downgrade: ["D AW1 N G R EY2 D"],
  export: ["IH0 K S P AO1 R T"]
};

// IPA fija cuando la división en sílabas automática coloca mal la marca de acento (house·work, no hou·swork)
const IPA_FIXES = {
  housework: "ˈhaʊsˌwɝk", lightweight: "ˈlaɪtˌweɪt", lifelong: "ˈlaɪfˌlɔŋ", worthwhile: "ˌwɝθˈwaɪl", artwork: "ˈɑrtˌwɝk",
  counteroffer: "ˈkaʊntɚˌɔfɚ", housewarming: "ˈhaʊsˌwɔrmɪŋ"
};

/** Mapa palabra → lista de pronunciaciones ARPAbet (la primera es la más común). */
export function dict() {
  if (DICT) return DICT;
  DICT = new Map(Object.entries(FIXES).map(([w, p]) => [w, [p.split(" ")]]));
  for (const line of zlib.gunzipSync(fs.readFileSync(FILE)).toString("utf8").split("\n")) {
    const m = line.match(/^(\S+?)(?:\(\d+\))?\s+([^#]+)/);
    if (!m) continue;
    const w = m[1].toLowerCase();
    if (FIXES[w]) continue;
    if (!DICT.has(w)) DICT.set(w, []);
    DICT.get(w).push(m[2].trim().split(/\s+/));
  }
  // Variantes que le faltan al CMU (se agregan a las suyas; la primera es la que se usa por defecto)
  for (const [w, list] of Object.entries(EXTRA)) {
    const cur = DICT.get(w) || [];
    DICT.set(w, [...list.map((x) => x.split(" ")), ...cur]);
  }
  return DICT;
}

const V = { AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", ER: "ɝ", EY: "eɪ", IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u" };
const C = { B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", P: "p", R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ" };
// Grupos de consonantes con los que puede empezar una sílaba en inglés (para colocar la marca de acento)
const ONSETS = new Set(["P L", "P R", "B L", "B R", "T R", "D R", "K L", "K R", "G L", "G R", "F L", "F R", "TH R", "SH R", "S P", "S T", "S K", "S M", "S N", "S L", "S W", "S F", "S P L", "S P R", "S T R", "S K R", "S K W", "S K L", "T W", "D W", "K W", "G W", "TH W", "P Y", "B Y", "K Y", "G Y", "M Y", "F Y", "V Y", "HH Y", "S P Y", "S K Y"]);

// Compuestos con dos acentos principales en el CMU cuyo acento fuerte es el PRIMERO (en los demás es el último:
// engineer, thirteen, downtown)
const FIRST_PRIMARY = new Set(["coworker", "coworkers", "sightseeing", "lightweight", "eyewitness", "workaround", "somewhat", "lifelong", "heavyweight", "overhead"]);

/**
 * Normaliza tres rarezas sistemáticas del CMU antes de pasar a IPA:
 * 1. ER0 seguido de vocal es /ər/ con la r en la sílaba siguiente (*around* /əˈraʊnd/, *history* /ˈhɪstəri/).
 * 2. Dos acentos principales en una palabra: queda uno (el último, o el primero en FIRST_PRIMARY) y el otro pasa a secundario.
 * 3. Un IH2 inicial justo antes del acento principal es átono (*important* /ɪmˈpɔrtənt/, *imagine* /ɪˈmædʒən/).
 */
function normalize(ph0, word = "") {
  const ph = [];
  ph0.forEach((p, i) => { if (p === "ER0" && /\d$/.test(ph0[i + 1] || "")) ph.push("AH0", "R"); else ph.push(p); });
  const prim = ph.map((p, i) => (/1$/.test(p) ? i : -1)).filter((i) => i >= 0);
  if (prim.length > 1) {
    const keep = FIRST_PRIMARY.has(word) ? prim[0] : prim.at(-1);
    for (const i of prim) if (i !== keep) ph[i] = ph[i].slice(0, -1) + "2";
  }
  const vi = ph.map((p, i) => (/\d$/.test(p) ? i : -1)).filter((i) => i >= 0);
  if (vi.length > 1 && ph[vi[0]] === "IH2" && /1$/.test(ph[vi[1]])) ph[vi[0]] = "IH0";
  return ph;
}

/** ARPAbet → IPA con marcas de acento ˈ (principal) y ˌ (secundario) al inicio de la sílaba. */
export function arpaToIpa(ph0, word = "") {
  const ph = normalize(ph0, word);
  const segs = ph.map((p) => ({ base: p.replace(/\d/g, ""), stress: /\d/.test(p) ? +p.slice(-1) : null }));
  const vowels = segs.map((s, i) => (s.stress !== null ? i : -1)).filter((i) => i >= 0);
  const marks = new Map();
  if (vowels.length > 1) {
    vowels.forEach((vi, n) => {
      const st = segs[vi].stress;
      if (st !== 1 && st !== 2) return;
      const prev = n ? vowels[n - 1] : -1;
      let start = vi;
      // retrocede por las consonantes que pueden formar el inicio de la sílaba
      for (let j = vi - 1; j > prev; j--) {
        const cluster = segs.slice(j, vi).map((s) => s.base);
        if (cluster.length === 1 ? cluster[0] !== "NG" : ONSETS.has(cluster.join(" "))) start = j; else break;
      }
      if (n === 0) start = 0;
      marks.set(start, st === 1 ? "ˈ" : "ˌ");
    });
  }
  return segs.map((s, i) => {
    let out = marks.get(i) || "";
    if (s.stress !== null) out += s.base === "AH" && s.stress === 0 ? "ə" : s.base === "ER" && s.stress === 0 ? "ɚ" : V[s.base];
    else out += C[s.base] || s.base.toLowerCase();
    return out;
  }).join("");
}

// Minúsculas, sin tildes (Holguín → holguin) y sin apóstrofos en los extremos
const clean = (w) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").replace(/^'+|'+$/g, "");

/** IPA de una palabra (null si no está en el diccionario). */
export function ipa(word) {
  const w = clean(word);
  if (IPA_FIXES[w]) return IPA_FIXES[w];
  const p = dict().get(w);
  return p ? arpaToIpa(p[0], w) : null;
}

/** IPA de todas las pronunciaciones registradas de una palabra. */
export function ipaAll(word) {
  const w = clean(word);
  if (IPA_FIXES[w]) return [IPA_FIXES[w]];
  return (dict().get(w) || []).map((p) => arpaToIpa(p, w));
}

/** ¿Existe la palabra en inglés? (acepta posesivos: brother's, boys'). */
export function known(word) {
  const w = clean(word);
  if (!w || /^\d+(st|nd|rd|th|s)?$/.test(w)) return true;
  const d = dict();
  return d.has(w) || (w.endsWith("'s") && d.has(w.slice(0, -2))) || (w.endsWith("s'") && d.has(w.slice(0, -1)));
}

/** Palabras de un texto en inglés (separa guiones; conserva apóstrofos internos). */
export function enWords(text) {
  return String(text ?? "").replace(/[’‘]/g, "'").split(/[^\p{L}']+/u).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean);
}
