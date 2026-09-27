// Worker del navegador: PostgreSQL 18 (PGlite, WebAssembly) + consola psql simulada. Todo local, sin red.
import { PGlite, protocol } from "/pglite/index.js";
import { Engine, Session } from "./engine.mjs";

const CONTRIB = ["amcheck", "auto_explain", "bloom", "btree_gin", "btree_gist", "citext", "cube", "dict_int", "dict_xsyn", "earthdistance", "fuzzystrmatch", "hstore", "intarray", "isn", "lo", "ltree", "pageinspect", "pg_buffercache", "pg_freespacemap", "pg_stat_statements", "pg_surgery", "pg_trgm", "pg_visibility", "pg_walinspect", "pgcrypto", "seg", "tablefunc", "tcn", "tsm_system_rows", "tsm_system_time", "unaccent", "uuid_ossp"];
const once = (fn) => { let p = null; return () => (p ??= fn()); };

const loadExtensions = once(async () => {
  const e = {};
  await Promise.all(CONTRIB.map(async (n) => { e[n] = (await import(`/pglite/contrib/${n}.js`))[n]; }));
  e.vector = (await import("/pglite/vector/index.js")).vector;
  return e;
});
const bootOptions = once(async () => {
  const [mod, bundle] = await Promise.all([
    WebAssembly.compileStreaming(fetch("/pglite/pglite.wasm")),
    fetch("/pglite/pglite.data").then((r) => r.blob()),
  ]);
  return { pgliteWasmModule: mod, fsBundle: bundle };
});

const engine = new Engine({
  PGlite,
  protocol,
  extensions: loadExtensions,
  extra: async (name) => (name === "postgis" ? { postgis: (await import("/pglite/postgis/index.js")).postgis } : {}),
  help: once(() => fetch("/pg/help.json").then((r) => r.json())),
  checksSql: once(() => fetch("/pg/checks.sql").then((r) => r.text())),
  dataset: (name) => fetch(`/pg/datasets/${encodeURIComponent(name)}.sql`).then((r) => { if (!r.ok) throw new Error(`No existe el conjunto de datos «${name}»`); return r.text(); }),
  now: () => performance.now(),
  bootOptions,
  compress: true,
});

/** @type {Map<string, { s: Session, scenario: any, used: number }>} */
const sessions = new Map();
const MAX_SESSIONS = 4;

async function evict() {
  if (sessions.size < MAX_SESSIONS) return;
  const oldest = [...sessions.entries()].sort((a, b) => a[1].used - b[1].used)[0];
  if (oldest) { await oldest[1].s.close(); sessions.delete(oldest[0]); }
}
function get(sid) {
  const e = sessions.get(sid);
  if (!e) throw new Error("La sesión ya no existe (se cerró). Vuelve a abrir la consola.");
  e.used = Date.now();
  return e;
}
const snap = (sc) => sc.data ? Promise.resolve(sc.data) : engine.snapshot(sc.key, { database: sc.database, dataset: sc.dataset, setup: sc.setup, extra: sc.extra || [], analyze: sc.analyze !== false });
const dbOf = (sc) => sc.database || sc.dataset || "postgres";
const state = (s) => ({ prompt: s.psql.prompt(), tx: s.psql.tx, db: s.db, user: s.user, pending: s.psql.sc.pending() || !!s.psql.copy });

const handlers = {
  async warm() { await bootOptions(); await loadExtensions(); await engine.base(); return true; },
  async open({ sid, scenario, user, files }) {
    await evict();
    if (sessions.has(sid)) { await sessions.get(sid).s.close(); sessions.delete(sid); }
    const data = await snap(scenario);
    const s = await new Session(engine, { data, database: dbOf(scenario), user: user || "postgres", extra: scenario.extra || [], files }).start();
    sessions.set(sid, { s, scenario, used: Date.now() });
    return state(s);
  },
  async input({ sid, text }) {
    const { s } = get(sid);
    const r = await s.psql.feed(text);
    return { ...r, ...state(s) };
  },
  async schema({ sid }) { return get(sid).s.schema(); },
  async check({ sid, checks }) {
    const { s, scenario } = get(sid);
    if (s.psql.tx !== "I") return { blocked: s.psql.tx };
    const data = await s.dump();
    return { results: await engine.check(data, { database: s.home, extra: scenario.extra || [], checks }) };
  },
  /** Ejecuta un script en una copia nueva del escenario. Con sid, la copia queda abierta como consola. */
  async run({ scenario, sql, file, sid, user }) {
    const data = await snap(scenario);
    if (sid) {
      await evict();
      if (sessions.has(sid)) { await sessions.get(sid).s.close(); sessions.delete(sid); }
    }
    const r = await engine.runScript(data, { database: dbOf(scenario), user: user || "postgres", extra: scenario.extra || [], sql, file, keep: !!sid });
    if (sid && r.session) {
      sessions.set(sid, { s: r.session, scenario, used: Date.now() });
      return { output: r.output, errors: r.errors, results: r.results, ...state(r.session) };
    }
    return { output: r.output, errors: r.errors, results: r.results };
  },
  /** Script del alumno en una copia nueva + comprobaciones sobre el resultado (lo confirmado). */
  async checkScript({ scenario, sql, checks }) {
    const data = await snap(scenario);
    const r = await engine.runScript(data, { database: dbOf(scenario), extra: scenario.extra || [], sql, keep: true });
    try {
      const after = await r.session.dump();
      const results = await engine.check(after, { database: dbOf(scenario), extra: scenario.extra || [], checks });
      return { output: r.output, errors: r.errors, tx: r.tx, results };
    } finally { await r.session.close(); }
  },
  async compare({ scenario, key, student, solution, ordered, columns }) {
    const data = await snap(scenario);
    return engine.compare(data, { key, database: dbOf(scenario), extra: scenario.extra || [], student, solution, ordered, columns });
  },
  async expected({ scenario, key, solution }) {
    const data = await snap(scenario);
    return engine.expectedTable(data, { key, database: dbOf(scenario), extra: scenario.extra || [], solution });
  },
  /** Estado completo de la sesión (para guardar el laboratorio en el navegador). */
  async dump({ sid }) {
    const { s } = get(sid);
    return { data: await s.pg.dumpDataDir("gzip"), db: s.db, user: s.user };
  },
  async files({ sid }) { return Object.fromEntries(get(sid).s.files); },
  async close({ sid }) {
    const e = sessions.get(sid);
    if (e) { await e.s.close(); sessions.delete(sid); }
    return true;
  },
};

self.onmessage = async (ev) => {
  const { id, op, args } = ev.data;
  try {
    const h = handlers[op];
    if (!h) throw new Error("Operación desconocida: " + op);
    const result = await h(args || {});
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
self.postMessage({ ready: true });
