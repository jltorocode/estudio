"use client";
// Cliente del hilo de PostgreSQL (PGlite, PostgreSQL 18 en WebAssembly). Un único hilo para toda la página.
// Si una consulta no termina (una recursión sin fin, un generate_series gigantesco…), se reinicia el hilo y cada
// sesión abierta se reconstruye repitiendo lo que el alumno escribió, así no pierde su trabajo.

export type PgStatus = "idle" | "loading" | "ready" | "error";
export type Scenario = { key: string; database?: string; dataset?: string; setup?: string; extra?: string[]; analyze?: boolean; data?: Blob };
export type PgEvent = { prompt: string; line: string; out: string };
export type Tx = "I" | "T" | "E";
export type PgState = { prompt: string; tx: Tx; db: string; user: string; pending?: boolean };
export type InputResult = PgState & { events: PgEvent[]; quit?: boolean; editor?: string };
export type CheckResult = { name: string; ok: boolean; msg?: string };
export type SchemaInfo = {
  db: string;
  tables: { schema: string; name: string; kind: string; columns: { name: string; type: string; notnull: boolean; pk: boolean }[]; rows: number | null }[];
  fks: { from: string; to: string; cols: string; refcols: string }[];
};
export type ResultSet = { fields: { name: string; type: number }[]; rows: (string | null)[][] };
export type RunResult = { output: string; errors: { sql: string; message: string; code: string }[]; results: (ResultSet & { tag?: string; error?: unknown })[] } & Partial<PgState>;

export class PgTimeout extends Error {}

let worker: Worker | null = null;
let status: PgStatus = "idle";
let seq = 0;
let generation = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> | null }>();
const listeners = new Set<(s: PgStatus) => void>();
let readyWaiters: (() => void)[] = [];

function setStatus(s: PgStatus) { status = s; listeners.forEach((l) => l(s)); }

function boot() {
  if (worker) return;
  setStatus("loading");
  worker = new Worker("/pg/worker.mjs", { type: "module" });
  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data;
    if (m.ready) { setStatus("ready"); readyWaiters.forEach((f) => f()); readyWaiters = []; return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (p.timer) clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result);
    else p.reject(new Error(m.error));
  };
  worker.onerror = (e) => { console.error(e); setStatus("error"); };
}

/** Reinicia el hilo: cancela lo que esté corriendo. Las sesiones se reconstruyen al usarse. */
export function restart() {
  worker?.terminate();
  worker = null;
  generation++;
  for (const [, p] of pending) { if (p.timer) clearTimeout(p.timer); p.reject(new PgTimeout("reiniciado")); }
  pending.clear();
  setStatus("idle");
}

export function subscribe(fn: (s: PgStatus) => void) { listeners.add(fn); fn(status); return () => { listeners.delete(fn); }; }
export function preload() { boot(); void call("warm", {}, 120_000).catch(() => {}); }

export async function call<T>(op: string, args: unknown, timeoutMs = 60_000): Promise<T> {
  boot();
  if (status !== "ready") await new Promise<void>((r) => readyWaiters.push(r));
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    const timer = timeoutMs > 0 ? setTimeout(() => { if (pending.has(id)) { restart(); reject(new PgTimeout("tiempo")); } }, timeoutMs) : null;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    worker!.postMessage({ id, op, args });
  });
}

let sidSeq = 0;
const newSid = () => `s${Date.now().toString(36)}${(++sidSeq).toString(36)}`;

/** Una conexión de psql simulada. Guarda lo escrito para poder reconstruirse si el hilo se reinicia. */
export class PgSession {
  sid = newSid();
  log: string[] = [];
  gen = -1;
  state: PgState | null = null;
  constructor(public scenario: Scenario, public opts: { user?: string; files?: Record<string, string>; script?: string } = {}) {}

  async open(): Promise<PgState> {
    if (this.opts.script !== undefined) {
      const r = await call<RunResult>("run", { scenario: this.scenario, sql: this.opts.script, sid: this.sid, user: this.opts.user }, 120_000);
      this.state = { prompt: r.prompt!, tx: r.tx!, db: r.db!, user: r.user! };
    } else {
      this.state = await call<PgState>("open", { sid: this.sid, scenario: this.scenario, user: this.opts.user, files: this.opts.files }, 120_000);
    }
    this.gen = generation;
    return this.state;
  }

  /** Reabre la sesión y repite en silencio lo que el alumno había escrito. */
  async restore(): Promise<PgState> {
    await this.open();
    for (const t of this.log) {
      const r = await call<InputResult>("input", { sid: this.sid, text: t }, 120_000);
      this.state = r;
    }
    return this.state!;
  }

  async ensure() {
    if (this.gen !== generation || !this.state) await this.restore();
  }

  async input(text: string, timeoutMs = 60_000): Promise<InputResult> {
    await this.ensure();
    try {
      const r = await call<InputResult>("input", { sid: this.sid, text }, timeoutMs);
      this.log.push(text);
      this.state = r;
      return r;
    } catch (e) {
      if (e instanceof Error && /PGLITE_CRASH/.test(e.message)) {
        // La instancia quedó inservible: se reconstruye con lo anterior (sin la orden que la botó)
        const st = await this.restore();
        return {
          ...st,
          events: [{ prompt: "", line: "", out: 'ERROR:  stack depth limit exceeded\nHINT:  Increase the configuration parameter "max_stack_depth" (currently 2048kB), after ensuring the platform\'s stack depth limit is adequate.\n(Consola simulada: la recursión agotó la pila del motor en tu navegador, que admite unos 150 niveles de funciones anidadas; un servidor real daría el error de arriba. La base se reconstruyó con todo lo que habías hecho antes de esa orden.)\n' }],
        };
      }
      if (e instanceof PgTimeout) {
        const st = await this.restore();
        return {
          ...st,
          events: [{ prompt: "", line: "", out: `La orden tardó más de ${Math.round(timeoutMs / 1000)} s y se canceló (en un servidor real usarías Ctrl+C o statement_timeout).\nLa base se reconstruyó con todo lo que habías hecho antes de esa orden.\n` }],
        };
      }
      throw e;
    }
  }

  async check(checks: { name: string; sql: string; fail?: string; database?: string }[]) {
    await this.ensure();
    return call<{ results?: CheckResult[]; blocked?: Tx }>("check", { sid: this.sid, checks }, 120_000);
  }

  async schema() {
    await this.ensure();
    return call<SchemaInfo | null>("schema", { sid: this.sid }, 30_000);
  }

  async dump() {
    await this.ensure();
    return call<{ data: Blob; db: string; user: string }>("dump", { sid: this.sid }, 60_000);
  }

  async files() {
    await this.ensure();
    return call<Record<string, string>>("files", { sid: this.sid });
  }

  /** Vuelve al escenario inicial (olvida lo escrito). */
  async reset() {
    this.log = [];
    return this.open();
  }

  close() {
    if (worker && this.gen === generation) void call("close", { sid: this.sid }).catch(() => {});
  }
}

/** Ejecuta un script en una copia nueva del escenario (como «psql -f»). */
export function runScript(scenario: Scenario, sql: string, file = "consulta.sql") {
  return call<RunResult>("run", { scenario, sql, file }, 120_000);
}

export function compareQuery(scenario: Scenario, key: string, student: string, solution: string, ordered: boolean, columns: boolean) {
  return call<{ ok: boolean; reason?: string; output: string; expected: ResultSet | null; got: ResultSet | null }>("compare", { scenario, key, student, solution, ordered, columns }, 120_000);
}

export function expectedResult(scenario: Scenario, key: string, solution: string) {
  return call<{ fields: ResultSet["fields"]; rows: ResultSet["rows"]; text: string } | null>("expected", { scenario, key, solution }, 120_000);
}

export function checkScript(scenario: Scenario, sql: string, checks: { name: string; sql: string; fail?: string; database?: string }[]) {
  return call<{ output: string; errors: RunResult["errors"]; tx: Tx; results: CheckResult[] }>("checkScript", { scenario, sql, checks }, 120_000);
}
