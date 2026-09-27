"use client";
// Cliente del hilo de Python. Un único hilo compartido; si una ejecución se pasa de tiempo
// (bucle infinito) se detiene el hilo y se crea uno nuevo.

export type RunStatus = "idle" | "loading" | "ready" | "error";
export type TestResult = { name: string; ok: boolean; msg?: string };
export type RunResult = { error?: string | null; codeError?: string | null; results?: TestResult[]; ms?: number; stopped?: boolean; timedOut?: boolean };
type Job = { kind: "run" | "test"; code: string; stdin?: string[]; setup?: string; tests?: { name: string; code: string }[]; persistent?: boolean };

let worker: Worker | null = null;
let status: RunStatus = "idle";
let version = "";
let seq = 0;
const listeners = new Set<(s: RunStatus, v: string) => void>();
let pending: { id: number; onOut: (t: string) => void; resolve: (r: RunResult) => void; timer: ReturnType<typeof setTimeout> } | null = null;
let readyWaiters: (() => void)[] = [];

function setStatus(s: RunStatus) { status = s; listeners.forEach((l) => l(s, version)); }

function boot() {
  if (worker) return;
  setStatus("loading");
  worker = new Worker("/py/worker.mjs", { type: "module" });
  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data;
    if (m.type === "ready") { version = m.version; setStatus("ready"); readyWaiters.forEach((f) => f()); readyWaiters = []; return; }
    if (m.type === "fatal") { setStatus("error"); return; }
    if (!pending || m.id !== pending.id) return;
    if (m.type === "out") pending.onOut(m.text);
    if (m.type === "done") {
      clearTimeout(pending.timer);
      const p = pending;
      pending = null;
      // Si Pyodide sufrió un error fatal (p. ej. desbordamiento de pila por recursión infinita), el intérprete queda inservible: reinícialo
      const text = String(m.error || m.codeError || "");
      if (/fatal error|Maximum call stack|RangeError/i.test(text)) {
        kill();
        boot();
        const msg = "Python se quedó sin pila (casi siempre es una recursión infinita: una función, propiedad o método que se llama a sí mismo sin caso base). El intérprete se reinició; revisa tu código y vuelve a intentarlo.";
        p.resolve({ ...m, error: m.error ? msg : m.error, codeError: m.codeError ? msg : m.codeError });
        return;
      }
      p.resolve(m);
    }
  };
  worker.onerror = () => setStatus("error");
}

function kill() {
  worker?.terminate();
  worker = null;
  setStatus("idle");
}

export function subscribe(fn: (s: RunStatus, v: string) => void) { listeners.add(fn); fn(status, version); return () => { listeners.delete(fn); }; }
export function preload() { boot(); }

/** Ejecuta código. onOut recibe la salida a medida que se produce. */
export async function runPython(job: Job, onOut: (t: string) => void, timeoutMs = 15000): Promise<RunResult> {
  if (pending) stop();
  boot();
  if (status !== "ready") await new Promise<void>((r) => readyWaiters.push(r));
  const id = ++seq;
  return new Promise<RunResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending || pending.id !== id) return;
      pending = null;
      kill();
      boot();
      resolve({ timedOut: true, error: `Tu código tardó más de ${Math.round(timeoutMs / 1000)} segundos y se detuvo. ¿Hay un bucle infinito (un while cuya condición nunca se vuelve falsa)?` });
    }, timeoutMs);
    pending = { id, onOut, resolve, timer };
    worker!.postMessage({ ...job, id });
  });
}

/** Detiene la ejecución en curso reiniciando el hilo de Python. */
export function stop() {
  if (!pending) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  kill();
  boot();
  p.resolve({ stopped: true, error: "Ejecución detenida." });
}
