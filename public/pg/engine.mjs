// Motor de prácticas de PostgreSQL: escenarios, sesiones de psql, comprobaciones y comparación de resultados.
// Funciona igual en el navegador (worker.mjs) y en Node (validador); recibe PGlite desde fuera.

import { Psql } from "./psql.mjs";
import { printTable } from "./print.mjs";
import { quoteIdent } from "./lexer.mjs";

const enc = new TextEncoder();
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/** Parámetros de arranque: los de PGlite, pero con los valores por defecto de un PostgreSQL normal
 * (search_path "$user", public; fsync activado; catálogos protegidos). Sin procesos en paralelo: en la simulación no existen. */
const START_PARAMS = ["--single", "-j", "-c", "exit_on_error=false", "-c", "log_checkpoints=false", "-c", "max_worker_processes=0", "-c", "max_parallel_workers=0", "-c", "max_parallel_workers_per_gather=0", "-c", "io_method=sync", "-c", "max_parallel_maintenance_workers=0"];

/**
 * @typedef {{ PGlite: any, protocol: any, extensions: () => Promise<Record<string, any>>, extra: (name: string) => Promise<Record<string, any>>,
 *   help: () => Promise<any>, checksSql: () => Promise<string>, dataset: (name: string) => Promise<string>, now: () => number,
 *   compress?: boolean, bootOptions?: () => Promise<object> }} Lib
 */

export class Engine {
  /** @param {Lib} lib */
  constructor(lib) {
    this.lib = lib;
    this.bases = new Map();
    this.snapshots = new Map();
    this.expected = new Map();
  }

  async exts(extra = []) {
    const e = { ...(await this.lib.extensions()) };
    for (const x of extra) Object.assign(e, await this.lib.extra(x));
    return e;
  }

  async boot(opts, extra = []) {
    const pre = this.lib.bootOptions ? await this.lib.bootOptions() : {};
    const pg = new this.lib.PGlite({ ...pre, ...opts, startParams: START_PARAMS, extensions: await this.exts(extra) });
    await pg.waitReady;
    return pg;
  }

  /** Clúster recién creado (con la zona horaria de Chile), como archivo de datos. */
  base(extra = []) {
    const k = extra.join(",");
    if (!this.bases.has(k)) {
      this.bases.set(k, (async () => {
        const pg = await this.boot({}, extra);
        await pg.exec("ALTER SYSTEM SET timezone = 'America/Santiago'");
        await pg.exec("ALTER SYSTEM SET log_timezone = 'America/Santiago'");
        await pg.exec("ALTER SYSTEM SET default_text_search_config = 'pg_catalog.english'");
        const d = await pg.dumpDataDir("none");
        await pg.close();
        return d;
      })());
    }
    return this.bases.get(k);
  }

  /** Abre una instancia sobre un estado del clúster. */
  async instance(data, { database = "postgres", username = "postgres", extra = [] } = {}) {
    const pg = await this.boot({ loadDataDir: data, database }, extra);
    // Conexión real como ese usuario (session_user), no un simple SET ROLE.
    if (username !== "postgres") await pg.exec(`SET SESSION AUTHORIZATION ${quoteIdent(username)}`);
    return pg;
  }

  /**
   * Escenario preparado (se construye una vez y se clona para cada sesión). Se arma por capas:
   * clúster base → base de datos → conjunto de datos (dataset) → setup propio del ejercicio.
   * @param {string} key  @param {{ database?: string, dataset?: string, setup?: string, extra?: string[], analyze?: boolean }} spec
   */
  snapshot(key, spec) {
    const database = spec.database || spec.dataset || "postgres";
    const extra = spec.extra || [];
    // Capa del dataset compartida entre ejercicios
    if (spec.dataset && spec.setup) {
      const dsKey = `dataset:${spec.dataset}:${database}:${extra.join(",")}`;
      return this.memo(key, async () => this.buildSnapshot({ database, setup: spec.setup, extra, analyze: spec.analyze, from: await this.snapshot(dsKey, { database, dataset: spec.dataset, extra, analyze: spec.analyze }) }));
    }
    return this.memo(key, async () => {
      const setup = spec.dataset ? await this.lib.dataset(spec.dataset) : spec.setup || "";
      return this.buildSnapshot({ database, setup, extra, analyze: spec.analyze });
    });
  }

  memo(key, fn) {
    if (!this.snapshots.has(key)) {
      const p = fn();
      p.catch(() => this.snapshots.delete(key));
      this.snapshots.set(key, p);
    }
    return this.snapshots.get(key);
  }

  async buildSnapshot({ database = "postgres", setup = "", extra = [], analyze = true, from = null }) {
    let pg;
    if (from) pg = await this.instance(from, { database, extra });
    else {
      pg = await this.instance(await this.base(extra), { extra });
      if (database !== "postgres") {
        await pg.exec(`CREATE DATABASE ${quoteIdent(database)}`);
        const d = await pg.dumpDataDir("none");
        await pg.close();
        pg = await this.instance(d, { database, extra });
      }
    }
    try {
      if (setup) {
        const s = new Session(this, { pg, database, user: "postgres", extra });
        await s.start();
        s.psql.vars.set("QUIET", "on");
        await s.psql.feed(setup, { script: "escenario.sql" });
        if (s.psql.errors.length) {
          const e = s.psql.errors[0];
          throw new Error(`El escenario tiene un error: ${e.message}\n  en: ${e.sql.trim().slice(0, 300)}`);
        }
        if (s.psql.tx !== "I") await pg.exec("COMMIT");
        // Deja la sesión como nueva: sin application_name ni variables de la preparación
        await pg.exec("RESET ALL");
      }
      if (analyze !== false) await pg.exec("VACUUM ANALYZE");
      await pg.exec("CHECKPOINT");
      return await pg.dumpDataDir(this.lib.compress ? "gzip" : "none");
    } finally {
      if (!pg.closed) await pg.close();
    }
  }

  /** Ejecuta un script completo en una copia nueva del escenario (como «psql -f consulta.sql»). */
  async runScript(data, { database = "postgres", user = "postgres", extra = [], sql, file = "consulta.sql", keep = false, files }) {
    const s = new Session(this, { data, database, user, extra, files });
    await s.start();
    s.psql.collector = [];
    const r = await s.psql.feed(sql, { script: file });
    const res = { output: r.events.map((e) => e.out).join(""), results: s.psql.collector, errors: s.psql.errors, tx: s.psql.tx };
    s.psql.collector = null;
    if (keep) return { ...res, session: s };
    await s.close();
    return res;
  }

  /** Último resultado con filas de un script. */
  static lastRows(results) {
    for (let i = results.length - 1; i >= 0; i--) if (results[i].fields) return results[i];
    return null;
  }

  /**
   * Compara el resultado de la consulta del alumno con el de la solución.
   * @param {Blob} data  @param {{ key: string, database?: string, extra?: string[], student: string, solution: string, ordered?: boolean, columns?: boolean }} o
   */
  async compare(data, o) {
    const ek = o.key + "\u0000" + o.solution;
    if (!this.expected.has(ek)) {
      const r = await this.runScript(data, { database: o.database, extra: o.extra, sql: o.solution, file: "solucion.sql" });
      if (r.errors.length) throw new Error("La solución de referencia falla: " + r.errors[0].message);
      this.expected.set(ek, Engine.lastRows(r.results));
    }
    const expected = this.expected.get(ek);
    const got = await this.runScript(data, { database: o.database, extra: o.extra, sql: o.student });
    const verdict = compareRows(expected, Engine.lastRows(got.results), got.errors, o);
    return { ...verdict, output: got.output, expected: expected && { fields: expected.fields, rows: expected.rows }, got: Engine.lastRows(got.results) };
  }

  /** Resultado esperado formateado como psql (para mostrarlo en el enunciado). */
  async expectedTable(data, o) {
    const ek = o.key + "\u0000" + o.solution;
    if (!this.expected.has(ek)) {
      const r = await this.runScript(data, { database: o.database, extra: o.extra, sql: o.solution, file: "solucion.sql" });
      if (r.errors.length) throw new Error("La solución de referencia falla: " + r.errors[0].message);
      this.expected.set(ek, Engine.lastRows(r.results));
    }
    const e = this.expected.get(ek);
    if (!e) return null;
    return { fields: e.fields, rows: e.rows, text: formatRows(e) };
  }

  /**
   * Ejecuta comprobaciones en una copia desechable del estado (como otra sesión: no ve lo no confirmado).
   * Cada comprobación puede indicar otra base con "database" (p. ej. una base que el alumno creó).
   */
  async check(data, { database = "postgres", extra = [], checks }) {
    const out = new Array(checks.length);
    const groups = new Map();
    checks.forEach((c, i) => { const db = c.database || database; if (!groups.has(db)) groups.set(db, []); groups.get(db).push(i); });
    for (const [db, idx] of groups) {
      let pg;
      try { pg = await this.instance(data, { database: db, extra }); }
      catch {
        for (const i of idx) out[i] = { name: checks[i].name, ok: false, msg: checks[i].fail || `La base de datos «${db}» no existe.` };
        continue;
      }
      try {
        const res = await runChecks(pg, this.lib.protocol, await this.lib.checksSql(), idx.map((i) => checks[i]));
        res.forEach((r, k) => (out[idx[k]] = r));
      } finally {
        await pg.close();
      }
    }
    return out;
  }
}

/** Comparación de resultados con mensajes que orientan sin regalar la solución. */
export function compareRows(exp, got, errors, o) {
  if (errors && errors.length) return { ok: false, reason: `Tu código produce un error: ${errors[0].message}` };
  if (!exp) return { ok: false, reason: "La solución no devuelve filas." };
  if (!got) return { ok: false, reason: "Tu código no devuelve ninguna tabla de resultados (¿falta el SELECT?)." };
  if (got.fields.length !== exp.fields.length) {
    return { ok: false, reason: `Tu consulta devuelve ${got.fields.length} columna${got.fields.length === 1 ? "" : "s"}; se esperaban ${exp.fields.length} (${exp.fields.map((f) => f.name).join(", ")}).` };
  }
  if (o.columns) {
    for (let i = 0; i < exp.fields.length; i++) {
      if (exp.fields[i].name !== got.fields[i].name) return { ok: false, reason: `La columna ${i + 1} se llama «${got.fields[i].name}»; debería llamarse «${exp.fields[i].name}» (usa un alias con AS).` };
    }
  }
  if (got.rows.length !== exp.rows.length) {
    return { ok: false, reason: `Tu consulta devuelve ${got.rows.length} fila${got.rows.length === 1 ? "" : "s"}; se esperaban ${exp.rows.length}.` };
  }
  const key = (r) => JSON.stringify(r);
  if (o.ordered) {
    for (let i = 0; i < exp.rows.length; i++) {
      if (key(exp.rows[i]) !== key(got.rows[i])) {
        const sameSet = multisetEqual(exp.rows, got.rows);
        if (sameSet) return { ok: false, reason: "Las filas son las correctas, pero no están en el orden pedido. Revisa el ORDER BY." };
        const j = exp.rows[i].findIndex((v, k) => v !== got.rows[i][k]);
        return { ok: false, reason: `La fila ${i + 1} no coincide${j >= 0 ? ` en la columna «${exp.fields[j].name}»: se esperaba ${show(exp.rows[i][j])} y tu consulta da ${show(got.rows[i][j])}` : ""}.` };
      }
    }
    return { ok: true };
  }
  if (!multisetEqual(exp.rows, got.rows)) {
    const want = new Map();
    for (const r of exp.rows) want.set(key(r), (want.get(key(r)) || 0) + 1);
    const extra = got.rows.find((r) => { const k = key(r); const n = want.get(k) || 0; if (n > 0) { want.set(k, n - 1); return false; } return true; });
    return { ok: false, reason: `Hay filas que no coinciden con las esperadas${extra ? `; por ejemplo, tu consulta devuelve (${extra.map(show).join(", ")}), que no está en el resultado esperado` : ""}.` };
  }
  return { ok: true };
}

const show = (v) => (v === null ? "NULL" : `«${v}»`);
function multisetEqual(a, b) {
  const k = (rows) => rows.map((r) => JSON.stringify(r)).sort();
  const x = k(a), y = k(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export function formatRows(r, opt = {}) {
  return printTable({ headers: r.fields.map((f) => f.name), types: r.fields.map((f) => f.type), rows: r.rows }, opt);
}

/** Error del motor simulado: la instancia quedó inservible (p. ej. recursión que agotó la pila de WebAssembly). */
export const CRASH = "PGLITE_CRASH";

async function execMsgs(pg, protocol, sql) {
  const r = await pg.execProtocol(protocol.serialize.query(sql), { throwOnError: false });
  // Una respuesta sin ReadyForQuery significa que el backend simulado se cayó a mitad de la orden
  if (!r.messages.some((m) => m.name === "readyForQuery")) {
    throw new Error(`${CRASH}: el motor simulado se quedó sin pila (típicamente una recursión de más de ~150 niveles)`);
  }
  return r.messages;
}

async function q(pg, protocol, sql) {
  const msgs = await execMsgs(pg, protocol, sql);
  let rows = [], fields = [], error = null;
  for (const m of msgs) {
    if (m.name === "rowDescription") { fields = m.fields; rows = []; }
    else if (m.name === "dataRow") rows.push(m.fields);
    else if (m.name === "error") error = m;
  }
  return { rows, fields, error };
}

/**
 * @param {{ name: string, sql: string, fail?: string }[]} checks
 * @returns {Promise<{ name: string, ok: boolean, msg?: string }[]>}
 */
export async function runChecks(pg, protocol, helpers, checks) {
  await q(pg, protocol, "BEGIN");
  // Los event triggers del alumno no deben bloquear la creación de las funciones auxiliares (desde PostgreSQL 17)
  await q(pg, protocol, "SET LOCAL event_triggers = off");
  const h = await q(pg, protocol, helpers);
  if (h.error) throw new Error("No se pudieron preparar las comprobaciones: " + h.error.message);
  // …y se reactivan para que las comprobaciones puedan probar los event triggers del alumno
  await q(pg, protocol, "SET LOCAL event_triggers = on");
  await q(pg, protocol, `SET LOCAL search_path = "$user", public, verif`);
  const out = [];
  for (const c of checks) {
    await q(pg, protocol, "SAVEPOINT verif_paso");
    const r = await q(pg, protocol, c.sql);
    if (r.error) out.push({ name: c.name, ok: false, msg: c.fail || r.error.message, error: r.error.message });
    else {
      const row = r.rows[0];
      const ok = !!row && row[0] === "t";
      out.push(ok ? { name: c.name, ok } : { name: c.name, ok, msg: (row && row[1]) || c.fail || "" });
    }
    await q(pg, protocol, "ROLLBACK TO SAVEPOINT verif_paso");
  }
  await q(pg, protocol, "ROLLBACK");
  return out;
}

/** Una conexión de psql simulada sobre una instancia (se puede cambiar de base o de usuario con \c). */
export class Session {
  /** @param {Engine} engine */
  constructor(engine, { data = null, pg = null, database = "postgres", user = "postgres", extra = [], files }) {
    this.engine = engine;
    this.data = data;
    this.pg = pg;
    this.db = database;
    this.home = database;
    this.user = user;
    this.extra = extra;
    this.files = files instanceof Map ? files : new Map(Object.entries(files || {}));
    this.psql = null;
  }

  async start() {
    if (!this.pg) this.pg = await this.engine.instance(this.data, { database: this.db, username: this.user, extra: this.extra });
    this.loginSuper = (await q(this.pg, this.engine.lib.protocol, "SELECT rolsuper FROM pg_roles WHERE rolname = session_user")).rows[0]?.[0] === "t";
    await q(this.pg, this.engine.lib.protocol, "SET application_name = 'psql'");
    await this.applySettings();
    this.psql = new Psql(this.env(), { db: this.db, user: this.user });
    await this.psql.refresh();
    return this;
  }

  /** Ejecuta como lo haría el servidor para el usuario conectado: un usuario normal no puede volver a ser superusuario. */
  async exec(sql) {
    const lib = this.engine.lib;
    // CREATE SUBSCRIPTION necesita conectarse a otro servidor: en la simulación no hay red (y el motor no trae libpqwalreceiver)
    const sub = /^\s*create\s+subscription\s+("(?:[^"]|"")+"|[^\s;]+)/i.exec(sql);
    if (sub) {
      const name = sub[1].replace(/^"|"$/g, "").replace(/""/g, '"');
      const msgs = await execMsgs(this.pg, lib.protocol, "ROLLBACK TO SAVEPOINT cuaderno_no_existe");
      return msgs.map((x) => (x.name === "error" ? Object.assign(x, { message: `subscription "${name}" could not connect to the publisher: connection to server failed: network is not available`, code: "08006", detail: undefined, position: undefined, where: undefined, hint: "Consola simulada: no hay otros servidores a los que conectarse. La replicación lógica completa se ve en las simulaciones grabadas de la sección 23.", routine: "CreateSubscription", file: "subscriptioncmds.c", line: "808" }) : x));
    }
    if (this.user !== "postgres" && !this.loginSuper) {
      const m = /^\s*(?:(reset)\s+session\s+authorization|set\s+(?:session\s+|local\s+)?session\s+authorization\s+(?:(default)|("(?:[^"]|"")+"|'(?:[^']|'')*'|[^\s;]+)))\s*;?\s*$/i.exec(sql);
      if (m) {
        const target = m[1] || m[2] ? this.user : m[3].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").replace(/""/g, '"');
        if (target !== this.user) {
          const msgs = await execMsgs(this.pg, lib.protocol, "ROLLBACK TO SAVEPOINT cuaderno_no_existe");
          return msgs.map((x) => (x.name === "error" ? Object.assign(x, { message: `permission denied to set session authorization "${target}"`, code: "42501", detail: undefined, hint: undefined, position: undefined, where: undefined, routine: "check_session_authorization", file: "variable.c", line: "871" }) : x));
        }
        const msgs = await execMsgs(this.pg, lib.protocol, `SET SESSION AUTHORIZATION ${quoteIdent(this.user)}`);
        return msgs.map((x) => (x.name === "commandComplete" ? Object.assign(x, { text: m[1] ? "RESET" : "SET" }) : x));
      }
      const msgs = await execMsgs(this.pg, lib.protocol, sql);
      if (/^\s*discard\s+all\b/i.test(sql)) await execMsgs(this.pg, lib.protocol, `SET SESSION AUTHORIZATION ${quoteIdent(this.user)}`);
      return msgs;
    }
    return execMsgs(this.pg, lib.protocol, sql);
  }

  env() {
    const lib = this.engine.lib;
    return {
      exec: (sql) => this.exec(sql),
      copyFrom: async (sql, data) => {
        const S = lib.protocol.serialize;
        const r = await this.pg.execProtocol(cat(S.query(sql), S.copyData(enc.encode(data)), S.copyDone()), { throwOnError: false });
        if (!r.messages.some((m) => m.name === "readyForQuery")) throw new Error(`${CRASH}: el motor simulado se cayó durante COPY`);
        return r.messages;
      },
      connect: (db, user) => this.reconnect(db, user),
      help: () => lib.help(),
      now: () => lib.now(),
      files: this.files,
    };
  }

  async reconnect(db, user) {
    const lib = this.engine.lib;
    const d = await q(this.pg, lib.protocol, `SELECT datallowconn, has_database_privilege(${lit(user)}, datname, 'CONNECT') FROM pg_database WHERE datname = ${lit(db)}`);
    const r = await q(this.pg, lib.protocol, `SELECT rolcanlogin FROM pg_roles WHERE rolname = ${lit(user)}`);
    if (!r.rows.length) return { error: `role "${user}" does not exist` };
    if (!d.rows.length) return { error: `database "${db}" does not exist` };
    if (r.rows[0][0] !== "t") return { error: `role "${user}" is not permitted to log in` };
    if (d.rows[0][0] !== "t") return { error: `database "${db}" is not currently accepting connections` };
    if (d.rows[0][1] !== "t") return { error: `permission denied for database "${db}"\nDETAIL:  User does not have CONNECT privilege.` };
    const data = await this.dump();
    await this.pg.close();
    this.pg = await this.engine.instance(data, { database: db, username: user, extra: this.extra });
    await q(this.pg, lib.protocol, "SET application_name = 'psql'");
    this.db = db;
    this.user = user;
    await this.applySettings();
    this.loginSuper = (await q(this.pg, lib.protocol, "SELECT rolsuper FROM pg_roles WHERE rolname = session_user")).rows[0]?.[0] === "t";
    return {};
  }

  /**
   * Aplica ALTER DATABASE/ROLE … SET al conectarse, como hace el servidor (base, luego rol, luego base+rol).
   * En la simulación quedan con origen «session» en pg_settings.
   */
  async applySettings() {
    const lib = this.engine.lib;
    const r = await q(this.pg, lib.protocol, `SELECT s.setconfig FROM pg_catalog.pg_db_role_setting s
LEFT JOIN pg_catalog.pg_database d ON d.oid = s.setdatabase
LEFT JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
WHERE (s.setdatabase = 0 OR d.datname = current_database()) AND (s.setrole = 0 OR r.rolname = session_user)
  AND NOT (s.setdatabase = 0 AND s.setrole = 0)
ORDER BY (s.setrole <> 0), (s.setdatabase <> 0)`);
    for (const [cfg] of r.rows || []) {
      const items = String(cfg).replace(/^\{|\}$/g, "").match(/"(?:[^"\\]|\\.)*"|[^,]+/g) || [];
      for (let it of items) {
        it = it.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1");
        const eq = it.indexOf("=");
        if (eq > 0) await q(this.pg, lib.protocol, `SELECT set_config(${lit(it.slice(0, eq))}, ${lit(it.slice(eq + 1))}, false)`);
      }
    }
  }

  /** Estado actual del clúster (lo confirmado), para comprobar o clonar. */
  async dump() {
    // VACUUM no espera a que su WAL se escriba; una confirmación con número de transacción lo obliga,
    // así la copia incluye el mapa de visibilidad, el congelamiento, etc. (solo si no hay transacción abierta)
    if (!this.psql || this.psql.tx === "I") await q(this.pg, this.engine.lib.protocol, "SELECT pg_catalog.pg_current_xact_id()");
    return this.pg.dumpDataDir("none");
  }

  async close() {
    if (this.pg && !this.pg.closed) await this.pg.close();
    this.pg = null;
  }

  /** Tablas, columnas y relaciones de la base actual (para el panel y el diagrama ER). */
  async schema() {
    const lib = this.engine.lib;
    if (this.psql && this.psql.tx === "E") return null;
    const cols = await q(this.pg, lib.protocol, `SELECT n.nspname, c.relname, c.relkind, a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull,
  EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY (i.indkey)) AS pk
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind IN ('r','p','v','m') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_' AND NOT c.relispartition
ORDER BY 1, 2, a.attnum`);
    if (cols.error) return null;
    const fks = await q(this.pg, lib.protocol, `SELECT cn.nspname, c.relname, fn.nspname, f.relname,
  (SELECT string_agg(a.attname, ',' ORDER BY k.i) FROM unnest(con.conkey) WITH ORDINALITY k(n, i) JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n),
  (SELECT string_agg(a.attname, ',' ORDER BY k.i) FROM unnest(con.confkey) WITH ORDINALITY k(n, i) JOIN pg_catalog.pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n)
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid = c.relnamespace
JOIN pg_catalog.pg_class f ON f.oid = con.confrelid JOIN pg_catalog.pg_namespace fn ON fn.oid = f.relnamespace
WHERE con.contype = 'f' AND con.conparentid = 0`);
    const tables = new Map();
    for (const [nsp, rel, kind, col, type, notnull, pk] of cols.rows) {
      const k = nsp + "." + rel;
      if (!tables.has(k)) tables.set(k, { schema: nsp, name: rel, kind, columns: [], rows: null });
      tables.get(k).columns.push({ name: col, type, notnull: notnull === "t", pk: pk === "t" });
    }
    const idle = !this.psql || this.psql.tx === "I";
    if (idle) {
      for (const t of tables.values()) {
        if (t.kind === "v") continue;
        const c = await q(this.pg, lib.protocol, `SELECT count(*) FROM (SELECT 1 FROM ${quoteIdent(t.schema)}.${quoteIdent(t.name)} LIMIT 100001) s`);
        if (!c.error && c.rows[0]) t.rows = Number(c.rows[0][0]);
      }
    }
    return {
      db: this.db,
      tables: [...tables.values()],
      fks: (fks.rows || []).map(([s1, t1, s2, t2, c1, c2]) => ({ from: s1 + "." + t1, to: s2 + "." + t2, cols: c1, refcols: c2 })),
    };
  }
}
