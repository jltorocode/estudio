// Voz del curso de inglés: lectura en voz alta (voces del sistema), grabación con el micrófono y
// reconocimiento de voz. Todo corre en el navegador; el reconocimiento «en línea» es opcional y avisado.

/* ------------------------------ Preferencias ------------------------------ */

/** off = sin reconocimiento (te grabas y te comparas tú); local = en este equipo; online = servicio del navegador. */
export type RecogMode = "off" | "local" | "online";
export type VoicePrefs = { voice?: string; rate: number; recog: RecogMode };

const KEY = "cuaderno-voz-v1";
const EVT = "cuaderno-voz";
const DEFAULTS: VoicePrefs = { rate: 0.95, recog: "off" };

let cached: VoicePrefs | null = null;

/** Preferencias actuales (el mismo objeto mientras no cambien, para useSyncExternalStore). */
export function getPrefs(): VoicePrefs {
  if (cached) return cached;
  try { cached = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { cached = { ...DEFAULTS }; }
  return cached!;
}

/** Preferencias por defecto (en el servidor, donde no hay localStorage). */
export const defaultPrefs = () => DEFAULTS;

export function setPrefs(p: Partial<VoicePrefs>) {
  const next = { ...getPrefs(), ...p };
  cached = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento local */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
}

export function onPrefs(cb: (p: VoicePrefs) => void) {
  const h = (e: Event) => cb((e as CustomEvent<VoicePrefs>).detail);
  // Otra pestaña cambió las preferencias
  const st = (e: StorageEvent) => { if (e.key === KEY) { cached = null; cb(getPrefs()); } };
  window.addEventListener(EVT, h);
  window.addEventListener("storage", st);
  return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", st); };
}

/* --------------------------------- Voces ---------------------------------- */

// Voces de broma de macOS (no sirven para aprender)
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Good News|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Zarvox|Deranged|Hysterical|Junior|Ralph|Fred|Kathy)\b/i;
// Voces «Eloquence» de macOS: correctas pero robóticas
const ELOQUENCE = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
const GOOD = /^(Samantha|Ava|Allison|Susan|Tom|Evan|Nathan|Zoe|Nicky|Joelle|Noelle|Alex|Aaron|Daniel|Serena|Kate|Oliver|Karen|Moira|Tessa|Rishi|Arthur|Martha|Jamie|Stephanie)\b/i;

export const hasTTS = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

function score(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/premium/i.test(v.name)) s += 60;
  else if (/enhanced|mejorad/i.test(v.name)) s += 45;
  if (/siri/i.test(v.name)) s += 30;
  if (GOOD.test(v.name)) s += 25;
  if (/google/i.test(v.name)) s += 15;
  if (ELOQUENCE.test(v.name)) s -= 30;
  if (v.lang.replace("_", "-").toLowerCase() === "en-us") s += 12;
  else if (v.lang.toLowerCase().startsWith("en-gb")) s += 6;
  if (v.localService) s += 4;
  return s;
}

/** Voces en inglés útiles, de mejor a peor. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!hasTTS()) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/** Llama a cb cuando el navegador termina de cargar la lista de voces (Chrome la carga tarde). */
export function onVoices(cb: () => void) {
  if (!hasTTS()) return () => {};
  cb();
  speechSynthesis.addEventListener("voiceschanged", cb);
  return () => speechSynthesis.removeEventListener("voiceschanged", cb);
}

/** Voz elegida (o la mejor). `speaker` > 0 elige otra voz distinta para los personajes de un diálogo. */
export function pickVoice(speaker = 0): SpeechSynthesisVoice | undefined {
  const all = englishVoices();
  if (!all.length) return undefined;
  const chosen = all.find((v) => v.voiceURI === getPrefs().voice) || all[0];
  if (!speaker) return chosen;
  // Para el segundo personaje, una voz de otra persona (preferiblemente del mismo acento y calidad)
  const others = all.filter((v) => v.voiceURI !== chosen.voiceURI && v.name.split(" ")[0] !== chosen.name.split(" ")[0]);
  return others.length ? others[(speaker - 1) % others.length] : chosen;
}

/* ------------------------------ Lectura en voz alta ------------------------------ */

/** Texto preparado para leerlo: « / » y rayas se leen como pausas (no como «slash»), sin marcas ✓ ✗ ni asteriscos. */
export function speakable(text: string) {
  return String(text ?? "")
    .replace(/[✓✗✔✘*_`]/g, "")
    .replace(/\s+\/\s+/g, ". ")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/…/g, "...")
    .trim();
}

let current: { cancel: () => void } | null = null;
/** Cambia en cada lectura nueva: así una lectura en cadena sabe que otra la interrumpió. */
let generation = 0;

export function stopSpeaking() {
  current?.cancel();
  current = null;
  if (hasTTS()) speechSynthesis.cancel();
}

/**
 * Lee un texto en inglés. Resuelve al terminar (o al cancelarlo).
 * `slow` = a 0,6× de la velocidad elegida (para dictados y palabras difíciles).
 */
export function speak(text: string, opts: { slow?: boolean; speaker?: number; rate?: number; onWord?: (charIndex: number) => void } = {}): Promise<void> {
  return new Promise((resolve) => {
    const clean = speakable(text);
    if (!hasTTS() || !clean) return resolve();
    stopSpeaking();
    generation++;
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(opts.speaker || 0);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    const base = opts.rate ?? getPrefs().rate;
    u.rate = Math.max(0.4, Math.min(1.6, opts.slow ? base * 0.62 : base));
    let done = false;
    const finish = () => { if (!done) { done = true; clearInterval(keep); resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    if (opts.onWord) u.onboundary = (e) => { if (e.name === "word" || e.name === undefined) opts.onWord!(e.charIndex); };
    // Chrome corta las lecturas largas de sus voces en línea si no se «despierta» el motor de vez en cuando
    const keep = setInterval(() => { if (v && !v.localService && speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10000);
    current = { cancel: finish };
    speechSynthesis.speak(u);
  });
}

/** Lee varios textos seguidos con una pausa entre ellos. Devuelve una función para detener. */
export function speakAll(parts: { text: string; speaker?: number }[], opts: { gap?: number; slow?: boolean; onIndex?: (i: number) => void; onDone?: () => void } = {}) {
  let stopped = false;
  (async () => {
    for (let i = 0; i < parts.length && !stopped; i++) {
      opts.onIndex?.(i);
      const p = speak(parts[i].text, { speaker: parts[i].speaker, slow: opts.slow });
      const mine = generation;
      await p;
      if (stopped || generation !== mine) { stopped = true; break; }
      await new Promise((r) => setTimeout(r, opts.gap ?? 450));
    }
    opts.onIndex?.(-1);
    if (!stopped) opts.onDone?.();
  })();
  return () => { stopped = true; stopSpeaking(); opts.onIndex?.(-1); };
}

/* --------------------------------- Grabación --------------------------------- */

export const hasMic = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/** Graba el micrófono hasta que se llame a stop() (o 12 s). La grabación nunca sale de tu equipo. */
export async function record(maxMs = 12000): Promise<{ stop: () => void; result: Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const result = new Promise<Blob>((resolve) => {
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); };
  });
  rec.start();
  const timer = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, maxMs);
  return { stop: () => { clearTimeout(timer); if (rec.state === "recording") rec.stop(); }, result };
}

/* ------------------------------ Reconocimiento de voz ------------------------------ */

type Availability = "available" | "downloadable" | "downloading" | "unavailable";
type RecCtor = {
  new (): SpeechRec;
  available?: (o: { langs: string[]; processLocally?: boolean }) => Promise<Availability>;
  install?: (o: { langs: string[]; processLocally?: boolean }) => Promise<boolean>;
};
type SpeechRec = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean; processLocally?: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

function ctor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type RecogSupport = { api: boolean; local: Availability | "unknown" };

/** ¿Hay reconocimiento de voz? ¿Puede hacerse en este equipo (sin enviar el audio)? */
export async function recogSupport(): Promise<RecogSupport> {
  const C = ctor();
  if (!C) return { api: false, local: "unavailable" };
  if (!C.available) return { api: true, local: "unknown" };
  try { return { api: true, local: await C.available({ langs: ["en-US"], processLocally: true }) }; } catch { return { api: true, local: "unknown" }; }
}

/** Descarga el paquete de reconocimiento en inglés para usarlo sin conexión (Chrome). */
export async function installLocal(): Promise<boolean> {
  const C = ctor();
  if (!C?.install) return false;
  try { return await C.install({ langs: ["en-US"], processLocally: true }); } catch { return false; }
}

const RECOG_ERR: Record<string, string> = {
  "not-allowed": "El navegador no tiene permiso para usar el micrófono.",
  "service-not-allowed": "El navegador no permite el reconocimiento de voz aquí.",
  "no-speech": "No se oyó nada. Acércate al micrófono y vuelve a intentarlo.",
  "audio-capture": "No se encontró un micrófono.",
  network: "El reconocimiento en línea necesita conexión a internet.",
  "language-not-supported": "El reconocimiento de inglés no está instalado en este equipo.",
  aborted: ""
};

/**
 * Escucha una frase y devuelve lo reconocido (varias alternativas). `local` exige que se procese en el equipo.
 * Llama a onInterim con el texto provisional mientras hablas.
 */
export function listen(opts: { local: boolean; continuous?: boolean; onInterim?: (t: string) => void }): { stop: () => void; result: Promise<{ text: string; alts: string[] }> } {
  const C = ctor();
  if (!C) return { stop: () => {}, result: Promise.reject(new Error("Este navegador no tiene reconocimiento de voz.")) };
  const r = new C();
  r.lang = "en-US";
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.continuous = !!opts.continuous;
  if (opts.local) r.processLocally = true;
  let finalText = "";
  let alts: string[] = [];
  const result = new Promise<{ text: string; alts: string[] }>((resolve, reject) => {
    r.onresult = (e) => {
      // Se reconstruye entero en cada evento: la lista de resultados trae también los ya finales
      let interim = "", fin = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { fin += res[0].transcript; alts = Array.from({ length: res.length }, (_, k) => res[k].transcript); }
        else interim += res[0].transcript;
      }
      finalText = fin;
      opts.onInterim?.((finalText + " " + interim).trim());
    };
    r.onerror = (e) => { const m = RECOG_ERR[e.error] ?? `Error de reconocimiento: ${e.error}`; if (m) reject(new Error(m)); };
    r.onend = () => resolve({ text: finalText.trim(), alts: alts.length ? alts : [finalText.trim()] });
  });
  try { r.start(); } catch (err) { return { stop: () => {}, result: Promise.reject(err) }; }
  return { stop: () => { try { r.stop(); } catch { /* ya terminó */ } }, result };
}
