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

// IPA fija cuando la división en sílabas automática coloca mal la marca de acento (house·work, no hou·swork)
const IPA_FIXES = { housework: "ˈhaʊsˌwɝk" };

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
  return DICT;
}

const V = { AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", ER: "ɝ", EY: "eɪ", IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u" };
const C = { B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", P: "p", R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ" };
// Grupos de consonantes con los que puede empezar una sílaba en inglés (para colocar la marca de acento)
const ONSETS = new Set(["P L", "P R", "B L", "B R", "T R", "D R", "K L", "K R", "G L", "G R", "F L", "F R", "TH R", "SH R", "S P", "S T", "S K", "S M", "S N", "S L", "S W", "S F", "S P L", "S P R", "S T R", "S K R", "S K W", "S K L", "T W", "D W", "K W", "G W", "TH W", "P Y", "B Y", "K Y", "G Y", "M Y", "F Y", "V Y", "HH Y", "S P Y", "S K Y"]);

/** ARPAbet → IPA con marcas de acento ˈ (principal) y ˌ (secundario) al inicio de la sílaba. */
export function arpaToIpa(ph) {
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
  return p ? arpaToIpa(p[0]) : null;
}

/** IPA de todas las pronunciaciones registradas de una palabra. */
export function ipaAll(word) {
  const w = clean(word);
  if (IPA_FIXES[w]) return [IPA_FIXES[w]];
  return (dict().get(w) || []).map(arpaToIpa);
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
