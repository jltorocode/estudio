// Meta-comandos de descripción de psql 18 (\d, \dt, \di, \dn, \df, \du, \l, \dx, \dT, \dD, \dp, \sf, \sv, \dconfig…).
// Replican las consultas de describe.c y su forma de imprimir: título centrado, columnas y pies de tabla.

import { printTable } from "./print.mjs";

const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/** Convierte un patrón de psql (con *, ?, comillas y esquema.nombre) en partes regex. */
export function parsePattern(pattern) {
  const parts = [];
  let cur = "", inq = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '"') {
      if (inq && pattern[i + 1] === '"') { cur += '"'; i++; }
      else inq = !inq;
    } else if (inq) cur += ch.replace(/[\\^$.|+()[\]{}*?]/g, "\\$&");
    else if (ch === ".") { parts.push(cur); cur = ""; }
    else if (ch === "*") cur += ".*";
    else if (ch === "?") cur += ".";
    else if (/[\\^$|+()[\]{}]/.test(ch)) cur += "\\" + ch;
    else cur += ch.toLowerCase();
  }
  parts.push(cur);
  const name = parts.pop();
  const schema = parts.length ? parts.pop() : null;
  return { schema: schema === "" ? null : schema, name: name === "" ? ".*" : name };
}

/** Condición SQL para un patrón. */
function patternWhere(pattern, schemaCol, nameCol, visible) {
  if (!pattern) return visible ? `  AND ${visible}\n` : "";
  const p = parsePattern(pattern);
  let w = `  AND ${nameCol} OPERATOR(pg_catalog.~) ${esc("^(" + p.name + ")$")} COLLATE pg_catalog.default\n`;
  if (p.schema) w += `  AND ${schemaCol} OPERATOR(pg_catalog.~) ${esc("^(" + p.schema + ")$")} COLLATE pg_catalog.default\n`;
  else if (visible) w += `  AND ${visible}\n`;
  return w;
}

const PLURAL = { t: "tables", v: "views", m: "materialized views", i: "indexes", s: "sequences", E: "foreign tables" };

export class Describe {
  /** @param {(sql: string) => Promise<{fields: {name: string, dataTypeID: number}[], rows: (string|null)[][]}>} q  @param {() => any} popt */
  constructor(q, popt, echoHidden) {
    this.q = async (sql) => {
      const eh = echoHidden();
      const r = await q(sql);
      return eh ? { ...r, echo: "/******** QUERY *********/\n" + sql + "\n/************************/\n\n" } : r;
    };
    this.popt = popt;
    this.echo = "";
  }

  async query(sql) {
    const r = await this.q(sql);
    if (r.echo) this.echo += r.echo;
    return r;
  }

  table(r, title, extra = {}) {
    return printTable({ title, headers: r.fields.map((f) => f.name), types: r.fields.map((f) => f.dataTypeID), rows: r.rows, ...extra }, this.popt());
  }

  /** Dispatcher. Devuelve el texto a imprimir. */
  async run(cmd, args) {
    this.echo = "";
    const out = await this.dispatch(cmd, args);
    return out === null ? null : this.echo + out;
  }

  async dispatch(cmd, args) {
    let base = cmd;
    const verbose = base.includes("+");
    base = base.replace(/\+/g, "");
    let system = false;
    if (base.length >= 2 && base.endsWith("S")) { system = true; base = base.slice(0, -1); }
    const pattern = args[0];
    if (base === "d") return pattern ? this.describeTableDetails(pattern, verbose, system) : this.listTables("tvmsE", null, verbose, system);
    if (/^d[tvmisE]+$/.test(base)) return this.listTables(base.slice(1), pattern, verbose, system);
    switch (base) {
      case "dn": return this.listSchemas(pattern, verbose, system);
      case "df": case "dfn": case "dfp": case "dfa": case "dft": case "dfw": return this.listFunctions(base.slice(2), pattern, verbose, system);
      case "du": case "dg": return this.describeRoles(pattern, verbose, system);
      case "drg": return this.describeRoleGrants(pattern, system);
      case "dx": return this.listExtensions(pattern, verbose);
      case "dT": return this.describeTypes(pattern, verbose, system);
      case "dD": return this.listDomains(pattern, verbose, system);
      case "dp": case "z": return this.permissionsList(pattern, system);
      case "dP": case "dPt": case "dPi": case "dPn": return this.listPartitioned(base.slice(2).replace("n", ""), pattern, verbose);
      case "dy": return this.listEventTriggers(pattern, verbose);
      case "dconfig": return this.describeConfig(pattern, verbose);
      case "dL": return this.listLanguages(pattern, verbose, system);
      case "dRp": return verbose ? this.describePublications(pattern) : this.listPublications(pattern);
      case "dRs": return this.listSubscriptions(pattern, verbose);
      case "dC": return this.listCasts(pattern, verbose);
      case "db": return this.listTablespaces(pattern, verbose);
      case "dX": return this.listExtendedStats(pattern);
      case "do": return this.listOperators(pattern, verbose, system);
      case "ddp": return this.listDefaultACLs(pattern);
      case "dF": return verbose ? this.describeTSConfigs(pattern) : this.listTSObjects("config", pattern);
      case "dFd": return this.listTSObjects("dict", pattern);
      case "dFp": return this.listTSObjects("parser", pattern);
      case "dFt": return this.listTSObjects("template", pattern);
      case "drds": return this.listDbRoleSettings(pattern, args[1]);
      default: return null;
    }
  }

  async listTables(kinds, pattern, verbose, system) {
    const k = kinds.split("");
    const showTables = k.includes("t"), showViews = k.includes("v"), showMat = k.includes("m"), showIdx = k.includes("i"), showSeq = k.includes("s"), showForeign = k.includes("E");
    const relkinds = [];
    if (showTables) relkinds.push("'r'", "'p'");
    if (showTables && (system || pattern)) relkinds.push("'t'");
    if (showViews) relkinds.push("'v'");
    if (showMat) relkinds.push("'m'");
    if (showIdx) relkinds.push("'i'", "'I'");
    if (showSeq) relkinds.push("'S'");
    if (showForeign) relkinds.push("'f'");
    let sql = `SELECT n.nspname as "Schema",
  c.relname as "Name",
  CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' WHEN 'i' THEN 'index' WHEN 'S' THEN 'sequence' WHEN 't' THEN 'TOAST table' WHEN 'f' THEN 'foreign table' WHEN 'p' THEN 'partitioned table' WHEN 'I' THEN 'partitioned index' END as "Type",
  pg_catalog.pg_get_userbyid(c.relowner) as "Owner"`;
    if (showIdx) sql += `,\n  c2.relname as "Table"`;
    if (verbose) {
      sql += `,\n  CASE c.relpersistence WHEN 'p' THEN 'permanent' WHEN 't' THEN 'temporary' WHEN 'u' THEN 'unlogged' END as "Persistence"`;
      if (showTables || showMat || showIdx) sql += `,\n  am.amname as "Access method"`;
      sql += `,\n  pg_catalog.pg_size_pretty(pg_catalog.pg_table_size(c.oid)) as "Size",\n  pg_catalog.obj_description(c.oid, 'pg_class') as "Description"`;
    }
    sql += `\nFROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_catalog.pg_am am ON am.oid = c.relam`;
    if (showIdx) sql += `\n     LEFT JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid\n     LEFT JOIN pg_catalog.pg_class c2 ON i.indrelid = c2.oid`;
    sql += `\nWHERE c.relkind IN (${relkinds.join(",")})\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname !~ '^pg_toast'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "c.relname", "pg_catalog.pg_table_is_visible(c.oid)");
    sql += "ORDER BY 1,2;";
    const r = await this.query(sql);
    const one = [showTables, showViews, showMat, showIdx, showSeq, showForeign].filter(Boolean).length === 1;
    const noun = one ? PLURAL[kinds] || "relations" : "relations";
    if (!r.rows.length) {
      return pattern ? `Did not find any ${noun} named "${pattern}".\n` : `Did not find any ${noun}.\n`;
    }
    return this.table(r, `List of ${noun}`);
  }

  async describeTableDetails(pattern, verbose, system) {
    let sql = `SELECT c.oid,
  n.nspname,
  c.relname
FROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE true\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n`;
    sql += patternWhere(pattern, "n.nspname", "c.relname", "pg_catalog.pg_table_is_visible(c.oid)");
    sql += "ORDER BY 2, 3;";
    const r = await this.query(sql);
    if (!r.rows.length) return `Did not find any relation named "${pattern}".\n`;
    let out = "";
    for (const [oid, nsp, rel] of r.rows) out += await this.describeOne(oid, nsp, rel, verbose);
    return out;
  }

  async describeOne(oid, schema, name, verbose) {
    const ti = (await this.query(`SELECT c.relchecks, c.relkind, c.relhasindex, c.relhasrules, c.relhastriggers, c.relrowsecurity, c.relforcerowsecurity, false AS relhasoids, c.relispartition, pg_catalog.array_to_string(c.reloptions || array(select 'toast.' || x from pg_catalog.unnest(tc.reloptions) x), ', ')
, c.reltablespace, CASE WHEN c.reloftype = 0 THEN '' ELSE c.reloftype::pg_catalog.regtype::pg_catalog.text END, c.relpersistence, c.relreplident, am.amname
FROM pg_catalog.pg_class c
 LEFT JOIN pg_catalog.pg_class tc ON (c.reltoastrelid = tc.oid)
LEFT JOIN pg_catalog.pg_am am ON (c.relam = am.oid)
WHERE c.oid = '${oid}';`)).rows[0];
    const [checks, relkind, hasindex, , hastriggers, rowsec, forcerowsec, , ispartition, reloptions, , reloftype, persistence, replident, amname] = ti;
    const T = (b) => b === "t";
    const qn = `${schema}.${name}`;

    if (relkind === "S") return this.describeSequence(oid, qn);

    const isIndex = relkind === "i" || relkind === "I";
    const showDefaults = ["r", "v", "m", "f", "c", "p"].includes(relkind);
    let cols = `SELECT a.attname,
  pg_catalog.format_type(a.atttypid, a.atttypmod),
  (SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid, true)
   FROM pg_catalog.pg_attrdef d
   WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum AND a.atthasdef),
  a.attnotnull,
  (SELECT c.collname FROM pg_catalog.pg_collation c, pg_catalog.pg_type t
   WHERE c.oid = a.attcollation AND t.oid = a.atttypid AND a.attcollation <> t.typcollation) AS attcollation,
  a.attidentity,
  a.attgenerated`;
    if (isIndex) cols += `,\n  CASE WHEN a.attnum <= (SELECT i.indnkeyatts FROM pg_catalog.pg_index i WHERE i.indexrelid = '${oid}') THEN 'yes' ELSE 'no' END AS is_key,\n  pg_catalog.pg_get_indexdef(a.attrelid, a.attnum, TRUE) AS indexdef`;
    if (verbose) cols += `,\n  a.attstorage,\n  a.attcompression AS attcompression,\n  a.attstattarget,\n  pg_catalog.col_description(a.attrelid, a.attnum)`;
    cols += `\nFROM pg_catalog.pg_attribute a\nWHERE a.attrelid = '${oid}' AND a.attnum > 0 AND NOT a.attisdropped\nORDER BY a.attnum;`;
    const cr = await this.query(cols);

    const headers = ["Column", "Type"];
    if (showDefaults) headers.push("Collation", "Nullable", "Default");
    if (isIndex) headers.push("Key?", "Definition");
    const showStorage = verbose;
    const showCompression = verbose && ["r", "p", "m"].includes(relkind);
    const showStats = verbose && ["r", "i", "I", "m", "f", "p"].includes(relkind);
    const showDesc = verbose && ["r", "v", "m", "f", "c", "p"].includes(relkind);
    if (verbose) {
      if (showStorage) headers.push("Storage");
      if (showCompression) headers.push("Compression");
      if (showStats) headers.push("Stats target");
      if (showDesc) headers.push("Description");
    }
    const storageName = { p: "plain", m: "main", x: "extended", e: "external" };
    const rows = cr.rows.map((a) => {
      const [attname, type, def, notnull, coll, identity, generated] = a;
      const row = [attname, type];
      if (showDefaults) {
        let d = def ?? "";
        if (identity === "a") d = "generated always as identity";
        else if (identity === "d") d = "generated by default as identity";
        else if (generated === "s") d = `generated always as (${def}) stored`;
        else if (generated === "v") d = `generated always as (${def})`;
        row.push(coll ?? "", T(notnull) ? "not null" : "", d);
      }
      let k = 7;
      if (isIndex) { row.push(a[7], a[8]); k = 9; }
      if (verbose) {
        const [storage, compression, stattarget, desc] = a.slice(k);
        if (showStorage) row.push(storageName[storage] || storage || "");
        if (showCompression) row.push(compression === "p" ? "pglz" : compression === "l" ? "lz4" : "");
        if (showStats) row.push(stattarget ?? "");
        if (showDesc) row.push(desc ?? "");
      }
      return row;
    });

    const unlogged = persistence === "u" ? "Unlogged " : "";
    const titles = { r: `${unlogged ? "Unlogged table" : "Table"}`, v: "View", m: `${unlogged ? "Unlogged materialized view" : "Materialized view"}`, i: `${unlogged ? "Unlogged index" : "Index"}`, I: "Partitioned index", c: "Composite type", f: "Foreign table", p: `${unlogged ? "Unlogged partitioned table" : "Partitioned table"}`, t: "TOAST table" };
    const title = `${titles[relkind] || "Relation"} "${qn}"`;
    const footers = [];

    if (isIndex) {
      const ir = (await this.query(`SELECT i.indisunique, i.indisprimary, i.indisclustered, i.indisvalid,
  (NOT i.indimmediate) AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = i.indrelid AND conindid = i.indexrelid AND contype IN ('p','u','x') AND condeferrable) AS condeferrable,
  (NOT i.indimmediate) AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = i.indrelid AND conindid = i.indexrelid AND contype IN ('p','u','x') AND condeferred) AS condeferred,
  i.indisreplident,
  i.indnullsnotdistinct,
  a.amname, c2.relname, pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)
FROM pg_catalog.pg_index i, pg_catalog.pg_class c, pg_catalog.pg_class c2, pg_catalog.pg_am a
WHERE i.indexrelid = c.oid AND c.oid = '${oid}' AND c.relam = a.oid
AND i.indrelid = c2.oid;`)).rows[0];
      if (ir) {
        const [uniq, prim, clus, valid, deferrable, deferred, replident2, nnd, am, tbl, pred] = ir;
        let f = "";
        if (T(prim)) f = "primary key, ";
        else if (T(uniq)) f = "unique" + (T(nnd) ? " nulls not distinct" : "") + ", ";
        f += `${am}, for table "${schema}.${tbl}"`;
        if (pred) f += `, predicate (${pred})`;
        if (T(clus)) f += ", clustered";
        if (!T(valid)) f += ", invalid";
        if (T(deferrable)) f += ", deferrable";
        if (T(deferred)) f += ", initially deferred";
        if (T(replident2)) f += ", replica identity";
        footers.push(f);
      }
    } else if (relkind === "v" || relkind === "m") {
      if (relkind === "m" && T(hasindex)) await this.indexFooters(oid, footers);
      if (verbose) {
        const vd = (await this.query(`SELECT pg_catalog.pg_get_viewdef('${oid}'::pg_catalog.oid, true);`)).rows[0][0];
        footers.push("View definition:", ...String(vd).split("\n"));
        if (relkind === "v" && reloptions) footers.push(`Options: ${reloptions}`);
      }
      if (relkind === "v" && T(hastriggers)) await this.triggerFooters(oid, footers, relkind);
      if (relkind === "m" && verbose && amname) footers.push(`Access method: ${amname}`);
      if (relkind === "m" && verbose && reloptions) footers.push(`Options: ${reloptions}`);
    } else if (["r", "p", "f"].includes(relkind)) {
      if (T(ispartition)) {
        const pr = (await this.query(`SELECT inhparent::pg_catalog.regclass,
  pg_catalog.pg_get_expr(c.relpartbound, c.oid),
  inhdetachpending${verbose ? ",\n  pg_catalog.pg_get_partition_constraintdef(c.oid)" : ""}
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_inherits i ON c.oid = inhrelid
WHERE c.oid = '${oid}';`)).rows[0];
        if (pr) {
          footers.push(`Partition of: ${pr[0]} ${pr[1]}${T(pr[2]) ? " DETACH PENDING" : ""}`);
          if (verbose) footers.push(pr[3] ? `Partition constraint: ${pr[3]}` : "No partition constraint");
        }
      }
      if (relkind === "p") {
        const pk = (await this.query(`SELECT pg_catalog.pg_get_partkeydef('${oid}'::pg_catalog.oid);`)).rows[0][0];
        footers.push(`Partition key: ${pk}`);
      }
      if (T(hasindex)) await this.indexFooters(oid, footers);
      if (Number(checks) > 0) {
        const ck = await this.query(`SELECT r.conname, pg_catalog.pg_get_constraintdef(r.oid, true)
FROM pg_catalog.pg_constraint r
WHERE r.conrelid = '${oid}' AND r.contype = 'c'
ORDER BY 1;`);
        if (ck.rows.length) footers.push("Check constraints:", ...ck.rows.map((c) => `    "${c[0]}" ${c[1]}`));
      }
      if (T(hastriggers) || relkind === "p") {
        const fk = await this.query(`SELECT true as sametable, conname,
  pg_catalog.pg_get_constraintdef(r.oid, true) as condef,
  conrelid::pg_catalog.regclass AS ontable
FROM pg_catalog.pg_constraint r
WHERE r.conrelid = '${oid}'
    AND r.contype = 'f' AND (r.conparentid = 0 OR r.conparentid IS NULL)
ORDER BY conname;`);
        if (fk.rows.length) footers.push("Foreign-key constraints:", ...fk.rows.map((f) => `    "${f[1]}" ${f[2]}`));
        const rb = await this.query(`SELECT conname, conrelid::pg_catalog.regclass AS ontable,
       pg_catalog.pg_get_constraintdef(oid, true) AS condef
  FROM pg_catalog.pg_constraint c
 WHERE confrelid IN (SELECT pg_catalog.pg_partition_ancestors('${oid}')
                     UNION ALL VALUES ('${oid}'::pg_catalog.regclass))
       AND contype = 'f' AND conparentid = 0
ORDER BY conname;`);
        if (rb.rows.length) footers.push("Referenced by:", ...rb.rows.map((f) => `    TABLE "${f[1]}" CONSTRAINT "${f[0]}" ${f[2]}`));
      }
      const pol = await this.query(`SELECT pol.polname, pol.polpermissive,
  CASE WHEN pol.polroles = '{0}' THEN NULL ELSE pg_catalog.array_to_string(array(select rolname from pg_catalog.pg_roles where oid = any (pol.polroles) order by 1),',') END,
  pg_catalog.pg_get_expr(pol.polqual, pol.polrelid),
  pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid),
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    END AS cmd
FROM pg_catalog.pg_policy pol
WHERE pol.polrelid = '${oid}' ORDER BY 1;`);
      const np = pol.rows.length;
      if (T(rowsec) && !T(forcerowsec) && np > 0) footers.push("Policies:");
      if (T(rowsec) && T(forcerowsec) && np > 0) footers.push("Policies (forced row security enabled):");
      if (T(rowsec) && !T(forcerowsec) && np === 0) footers.push("Policies (row security enabled): (none)");
      if (T(rowsec) && T(forcerowsec) && np === 0) footers.push("Policies (forced row security enabled): (none)");
      if (!T(rowsec) && np > 0) footers.push("Policies (row security disabled):");
      for (const [pname, permissive, roles, qual, wcheck, pcmd] of pol.rows) {
        let s = `    POLICY "${pname}"`;
        if (!T(permissive)) s += " AS RESTRICTIVE";
        if (pcmd) s += ` FOR ${pcmd}`;
        if (roles) s += `\n      TO ${roles}`;
        if (qual) s += `\n      USING (${qual})`;
        if (wcheck) s += `\n      WITH CHECK (${wcheck})`;
        footers.push(...s.split("\n"));
      }
      const st = await this.query(`SELECT oid, stxrelid::pg_catalog.regclass, stxnamespace::pg_catalog.regnamespace::pg_catalog.text AS nsp, stxname,
pg_catalog.pg_get_statisticsobjdef_columns(oid) AS columns,
  'd' = any(stxkind) AS ndist_enabled,
  'f' = any(stxkind) AS deps_enabled,
  'm' = any(stxkind) AS mcv_enabled,
stxstattarget
FROM pg_catalog.pg_statistic_ext
WHERE stxrelid = '${oid}'
ORDER BY nsp, stxname;`);
      if (st.rows.length) {
        footers.push("Statistics objects:");
        for (const s of st.rows) {
          const [, rel, nsp, sname, scols, nd, dep, mcv, target] = s;
          const hasAll = T(nd) && T(dep) && T(mcv);
          const exprOnly = !/,/.test(scols) && /\(/.test(scols);
          let line = `    "${nsp}.${sname}"`;
          if (!hasAll && !exprOnly) {
            const kinds = [];
            if (T(nd)) kinds.push("ndistinct");
            if (T(dep)) kinds.push("dependencies");
            if (T(mcv)) kinds.push("mcv");
            line += ` (${kinds.join(", ")})`;
          }
          line += ` ON ${scols} FROM ${rel}`;
          if (target !== null && target !== undefined && target !== "" && target !== "-1") line += `; STATISTICS ${target}`;
          footers.push(line);
        }
      }
      if (verbose) {
        const nn = await this.query(`SELECT c.conname, a.attname, c.connoinherit,
  c.conislocal, c.coninhcount <> 0,
  c.convalidated
FROM pg_catalog.pg_constraint c JOIN
  pg_catalog.pg_attribute a ON
    (a.attrelid = c.conrelid AND a.attnum = c.conkey[1])
WHERE c.contype = 'n' AND
  c.conrelid = '${oid}'::pg_catalog.regclass
ORDER BY a.attnum;`);
        if (nn.rows.length) {
          footers.push("Not-null constraints:");
          for (const [cn, an, noinh, islocal, inh, valid] of nn.rows) {
            footers.push(`    "${cn}" NOT NULL "${an}"${T(noinh) ? " NO INHERIT" : T(islocal) && T(inh) ? " (local, inherited)" : T(inh) ? " (inherited)" : ""}${T(valid) ? "" : " NOT VALID"}`);
          }
        }
      }
      if (T(hastriggers)) await this.triggerFooters(oid, footers, relkind);
      if (relkind === "r" || relkind === "f") {
        // Herencia clásica (no particiones)
        const inh = await this.query(`SELECT c.oid::pg_catalog.regclass
FROM pg_catalog.pg_class c, pg_catalog.pg_inherits i
WHERE c.oid = i.inhparent AND i.inhrelid = '${oid}'
  AND c.relkind != 'p' AND c.relkind != 'I'
ORDER BY inhseqno;`);
        inh.rows.forEach((r, i) => footers.push((i === 0 ? "Inherits: " : "          ") + r[0] + (i < inh.rows.length - 1 ? "," : "")));
      }
      const ch = await this.query(`SELECT c.oid::pg_catalog.regclass, c.relkind, inhdetachpending, pg_catalog.pg_get_expr(c.relpartbound, c.oid)
FROM pg_catalog.pg_class c, pg_catalog.pg_inherits i
WHERE c.oid = i.inhrelid AND i.inhparent = '${oid}'
ORDER BY pg_catalog.pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT', c.oid::pg_catalog.regclass::pg_catalog.text;`);
      if (relkind === "p") {
        if (!verbose) footers.push(`Number of partitions: ${ch.rows.length} (Use \\d+ to list them.)`);
        else if (!ch.rows.length) footers.push("Number of partitions: 0");
        else ch.rows.forEach((r, i) => footers.push((i === 0 ? "Partitions: " : "            ") + r[0] + " " + r[3] + (r[1] === "p" ? ", PARTITIONED" : "") + (T(r[2]) ? " (DETACH PENDING)" : "") + (i < ch.rows.length - 1 ? "," : "")));
      } else if (ch.rows.length) {
        if (!verbose) footers.push(`Number of child tables: ${ch.rows.length} (Use \\d+ to list them.)`);
        else ch.rows.forEach((r, i) => footers.push((i === 0 ? "Child tables: " : "              ") + r[0] + (i < ch.rows.length - 1 ? "," : "")));
      }
      if (reloftype) footers.push(`Typed table of type: ${reloftype}`);
      if (verbose && (relkind === "r" || relkind === "m") && replident !== "d" && replident !== "i" && schema !== "pg_catalog") footers.push(`Replica Identity: ${replident === "f" ? "FULL" : "NOTHING"}`);
      if (verbose && amname) footers.push(`Access method: ${amname}`);
      if (verbose && reloptions) footers.push(`Options: ${reloptions}`);
    }
    // psql: «This output looks confusing in expanded mode.»
    return printTable({ title, headers, rows, footers, types: [] }, { ...this.popt(), expanded: "off" });
  }

  async indexFooters(oid, footers) {
    const ix = await this.query(`SELECT c2.relname, i.indisprimary, i.indisunique, i.indisclustered, i.indisvalid, pg_catalog.pg_get_indexdef(i.indexrelid, 0, true),
  pg_catalog.pg_get_constraintdef(con.oid, true), contype, condeferrable, condeferred, i.indisreplident, c2.reltablespace, con.conperiod
FROM pg_catalog.pg_class c, pg_catalog.pg_class c2, pg_catalog.pg_index i
  LEFT JOIN pg_catalog.pg_constraint con ON (conrelid = i.indrelid AND conindid = i.indexrelid AND contype IN ('p','u','x'))
WHERE c.oid = '${oid}' AND c.oid = i.indrelid AND i.indexrelid = c2.oid
ORDER BY i.indisprimary DESC, c2.relname;`);
    if (!ix.rows.length) return;
    footers.push("Indexes:");
    for (const [rel, prim, uniq, clus, valid, idxdef, condef, contype, deferrable, deferred, replident, , conperiod] of ix.rows) {
      let s = `    "${rel}"`;
      if (contype === "x" || conperiod === "t") s += ` ${condef}`;
      else {
        if (prim === "t") s += " PRIMARY KEY,";
        else if (uniq === "t") s += contype === "u" ? " UNIQUE CONSTRAINT," : " UNIQUE,";
        const u = idxdef.indexOf(" USING ");
        s += " " + (u >= 0 ? idxdef.slice(u + 7) : idxdef);
        if (deferrable === "t") s += " DEFERRABLE";
        if (deferred === "t") s += " INITIALLY DEFERRED";
      }
      if (clus === "t") s += " CLUSTER";
      if (valid !== "t") s += " INVALID";
      if (replident === "t") s += " REPLICA IDENTITY";
      footers.push(s);
    }
  }

  async triggerFooters(oid, footers) {
    const tr = await this.query(`SELECT t.tgname, pg_catalog.pg_get_triggerdef(t.oid, true), t.tgenabled, t.tgisinternal,
  CASE WHEN t.tgparentid != 0 THEN
    (SELECT u.tgrelid::pg_catalog.regclass
     FROM pg_catalog.pg_trigger AS u,
          pg_catalog.pg_partition_ancestors(t.tgrelid) WITH ORDINALITY AS a(relid, depth)
     WHERE u.tgname = t.tgname AND u.tgrelid = a.relid
           AND u.tgparentid = 0
     ORDER BY a.depth LIMIT 1)
  END AS parent
FROM pg_catalog.pg_trigger t
WHERE t.tgrelid = '${oid}' AND (NOT t.tgisinternal OR (t.tgisinternal AND t.tgenabled = 'D')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_depend WHERE objid = t.oid
        AND refclassid = 'pg_catalog.pg_trigger'::pg_catalog.regclass))
ORDER BY 1;`);
    const groups = [["Triggers:", (e, int) => (e === "O" || e === "t") && !int], ["Disabled user triggers:", (e, int) => e === "D" && !int], ["Disabled internal triggers:", (e, int) => e === "D" && int], ["Triggers firing always:", (e) => e === "A"], ["Triggers firing on replica only:", (e) => e === "R"]];
    for (const [label, pred] of groups) {
      const list = tr.rows.filter((t) => pred(t[2], t[3] === "t"));
      if (!list.length) continue;
      footers.push(label);
      for (const t of list) {
        const def = t[1];
        const u = def.indexOf(" TRIGGER ");
        let s = "    " + (u >= 0 ? def.slice(u + 9) : def);
        if (t[4]) s += `, ON TABLE ${t[4]}`;
        footers.push(s);
      }
    }
  }

  async describeSequence(oid, qn) {
    const r = await this.query(`SELECT pg_catalog.format_type(seqtypid, NULL) AS "Type",
       seqstart AS "Start",
       seqmin AS "Minimum",
       seqmax AS "Maximum",
       seqincrement AS "Increment",
       CASE WHEN seqcycle THEN 'yes' ELSE 'no' END AS "Cycles?",
       seqcache AS "Cache"
FROM pg_catalog.pg_sequence
WHERE seqrelid = '${oid}';`);
    const own = await this.query(`SELECT pg_catalog.quote_ident(nspname) || '.' ||
   pg_catalog.quote_ident(relname) || '.' ||
   pg_catalog.quote_ident(attname),
   d.deptype
FROM pg_catalog.pg_class c
INNER JOIN pg_catalog.pg_depend d ON c.oid=d.refobjid
INNER JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
INNER JOIN pg_catalog.pg_attribute a ON (
 a.attrelid=c.oid AND
 a.attnum=d.refobjsubid)
WHERE d.classid='pg_catalog.pg_class'::pg_catalog.regclass
 AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass
 AND d.objid='${oid}'
 AND d.deptype IN ('a', 'i')`);
    const footers = [];
    if (own.rows.length) footers.push(own.rows[0][1] === "i" ? `Sequence for identity column: ${own.rows[0][0]}` : `Owned by: ${own.rows[0][0]}`);
    return printTable({ title: `Sequence "${qn}"`, headers: r.fields.map((f) => f.name), types: r.fields.map((f) => f.dataTypeID), rows: r.rows, footers }, { ...this.popt(), expanded: "off" });
  }

  async listSchemas(pattern, verbose, system) {
    let sql = `SELECT n.nspname AS "Name",
  pg_catalog.pg_get_userbyid(n.nspowner) AS "Owner"`;
    if (verbose) sql += `,\n  pg_catalog.array_to_string(n.nspacl, E'\\n') AS "Access privileges",\n  pg_catalog.obj_description(n.oid, 'pg_namespace') AS "Description"`;
    sql += `\nFROM pg_catalog.pg_namespace n\n`;
    sql += !system && !pattern ? `WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'\n` : "WHERE true\n";
    sql += patternWhere(pattern, null, "n.nspname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any schemas named "${pattern}".\n`;
    return this.table(r, "List of schemas");
  }

  async listFunctions(types, pattern, verbose, system) {
    let sql = `SELECT n.nspname as "Schema",
  p.proname as "Name",
  pg_catalog.pg_get_function_result(p.oid) as "Result data type",
  pg_catalog.pg_get_function_arguments(p.oid) as "Argument data types",
 CASE p.prokind
  WHEN 'a' THEN 'agg'
  WHEN 'w' THEN 'window'
  WHEN 'p' THEN 'proc'
  ELSE 'func'
 END as "Type"`;
    if (verbose) sql += `,
 CASE
  WHEN p.provolatile = 'i' THEN 'immutable'
  WHEN p.provolatile = 's' THEN 'stable'
  WHEN p.provolatile = 'v' THEN 'volatile'
 END as "Volatility",
 CASE
  WHEN p.proparallel = 'r' THEN 'restricted'
  WHEN p.proparallel = 's' THEN 'safe'
  WHEN p.proparallel = 'u' THEN 'unsafe'
 END as "Parallel",
 pg_catalog.pg_get_userbyid(p.proowner) as "Owner",
 CASE WHEN prosecdef THEN 'definer' ELSE 'invoker' END AS "Security",
 CASE WHEN p.proleakproof THEN 'yes' ELSE 'no' END as "Leakproof?",
 pg_catalog.array_to_string(p.proacl, E'\\n') AS "Access privileges",
 l.lanname as "Language",
 CASE WHEN l.lanname IN ('internal', 'c') THEN p.prosrc END as "Internal name",
 pg_catalog.obj_description(p.oid, 'pg_proc') as "Description"`;
    sql += `\nFROM pg_catalog.pg_proc p
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace\n`;
    if (verbose) sql += `     LEFT JOIN pg_catalog.pg_language l ON l.oid = p.prolang\n`;
    sql += "WHERE true\n";
    const kinds = { a: "'a'", n: "'f'", p: "'p'", w: "'w'", t: null };
    const wanted = types.split("").filter((t) => kinds[t]).map((t) => kinds[t]);
    if (types.includes("t")) sql += `      AND p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype\n`;
    if (wanted.length) sql += `      AND p.prokind IN (${wanted.join(",")})\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "p.proname", "pg_catalog.pg_function_is_visible(p.oid)");
    sql += "ORDER BY 1, 2, 4;";
    const r = await this.query(sql);
    if (!r.rows.length) return pattern ? `Did not find any functions named "${pattern}".\n` : "Did not find any functions.\n";
    return this.table(r, "List of functions");
  }

  async describeRoles(pattern, verbose, system) {
    let sql = `SELECT r.rolname, r.rolsuper, r.rolinherit,
  r.rolcreaterole, r.rolcreatedb, r.rolcanlogin,
  r.rolconnlimit, r.rolvaliduntil${verbose ? ",\n  pg_catalog.shobj_description(r.oid, 'pg_authid') AS description" : ""}
, r.rolreplication
, r.rolbypassrls
FROM pg_catalog.pg_roles r\n`;
    sql += !system && !pattern ? "WHERE r.rolname !~ '^pg_'\n" : "WHERE true\n";
    sql += patternWhere(pattern, null, "r.rolname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any roles named "${pattern}".\n`;
    const rows = r.rows.map((x) => {
      const [name, sup, inh, crole, cdb, login, conn, until] = x;
      const repl = x[verbose ? 9 : 8], bypass = x[verbose ? 10 : 9];
      const attrs = [];
      if (sup === "t") attrs.push("Superuser");
      if (inh !== "t") attrs.push("No inheritance");
      if (crole === "t") attrs.push("Create role");
      if (cdb === "t") attrs.push("Create DB");
      if (login !== "t") attrs.push("Cannot login");
      if (repl === "t") attrs.push("Replication");
      if (bypass === "t") attrs.push("Bypass RLS");
      let a = attrs.join(", ");
      const c = Number(conn);
      if (c >= 0) a += (a ? "\n" : "") + (c === 0 ? "No connections" : `${c} connection${c === 1 ? "" : "s"}`);
      if (until) a += (a ? "\n" : "") + "Password valid until " + until;
      const row = [name, a];
      if (verbose) row.push(x[8] ?? "");
      return row;
    });
    const headers = ["Role name", "Attributes"];
    if (verbose) headers.push("Description");
    return printTable({ title: "List of roles", headers, rows, footers: [] }, this.popt());
  }

  async describeRoleGrants(pattern, system) {
    let sql = `SELECT m.rolname AS "Role name", r.rolname AS "Member of",
  pg_catalog.concat_ws(', ',
    CASE WHEN pam.admin_option THEN 'ADMIN' END,
    CASE WHEN pam.inherit_option THEN 'INHERIT' END,
    CASE WHEN pam.set_option THEN 'SET' END
  ) AS "Options",
  g.rolname AS "Grantor"
FROM pg_catalog.pg_roles m
     JOIN pg_catalog.pg_auth_members pam ON (pam.member = m.oid)
     LEFT JOIN pg_catalog.pg_roles r ON (pam.roleid = r.oid)
     LEFT JOIN pg_catalog.pg_roles g ON (pam.grantor = g.oid)\n`;
    sql += !system && !pattern ? "WHERE m.rolname !~ '^pg_'\n" : "WHERE true\n";
    sql += patternWhere(pattern, null, "m.rolname", null);
    sql += "ORDER BY 1, 2, 4;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any role grants named "${pattern}".\n`;
    return this.table(r, "List of role grants");
  }

  async listExtensions(pattern, verbose) {
    if (verbose) return this.listExtensionContents(pattern);
    let sql = `SELECT e.extname AS "Name", e.extversion AS "Version", ae.default_version AS "Default version",n.nspname AS "Schema", d.description AS "Description"
FROM pg_catalog.pg_extension e LEFT JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace LEFT JOIN pg_catalog.pg_description d ON d.objoid = e.oid AND d.classoid = 'pg_catalog.pg_extension'::pg_catalog.regclass LEFT JOIN pg_catalog.pg_available_extensions() ae(name, default_version, comment) ON ae.name = e.extname\nWHERE true\n`;
    sql += patternWhere(pattern, null, "e.extname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any extensions named "${pattern}".\n`;
    return this.table(r, "List of installed extensions");
  }

  async listExtensionContents(pattern) {
    let sql = `SELECT e.extname, e.oid\nFROM pg_catalog.pg_extension e\nWHERE true\n`;
    sql += patternWhere(pattern, null, "e.extname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    if (!r.rows.length) return pattern ? `Did not find any extensions named "${pattern}".\n` : "Did not find any extensions.\n";
    let out = "";
    for (const [name, oid] of r.rows) {
      const c = await this.query(`SELECT pg_catalog.pg_describe_object(classid, objid, 0) AS "Object description"
FROM pg_catalog.pg_depend
WHERE refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass AND refobjid = '${oid}' AND deptype = 'e'
ORDER BY 1;`);
      out += printTable({ title: `Objects in extension "${name}"`, headers: ["Object description"], rows: c.rows }, this.popt());
    }
    return out;
  }

  async describeTypes(pattern, verbose, system) {
    let sql = `SELECT n.nspname as "Schema",
  pg_catalog.format_type(t.oid, NULL) AS "Name",\n`;
    if (verbose) sql += `  t.typname AS "Internal name",
  CASE WHEN t.typrelid != 0
      THEN CAST('tuple' AS pg_catalog.text)
    WHEN t.typlen < 0
      THEN CAST('var' AS pg_catalog.text)
    ELSE CAST(t.typlen AS pg_catalog.text)
  END AS "Size",
  pg_catalog.array_to_string(
      ARRAY(
          SELECT e.enumlabel
          FROM pg_catalog.pg_enum e
          WHERE e.enumtypid = t.oid
          ORDER BY e.enumsortorder
      ),
      E'\\n'
  ) AS "Elements",
  pg_catalog.pg_get_userbyid(t.typowner) AS "Owner",
  pg_catalog.array_to_string(t.typacl, E'\\n') AS "Access privileges",\n`;
    sql += `  pg_catalog.obj_description(t.oid, 'pg_type') as "Description"
FROM pg_catalog.pg_type t
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid))
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid)\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "pg_catalog.format_type(t.oid, NULL)", "pg_catalog.pg_type_is_visible(t.oid)");
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any data types named "${pattern}".\n`;
    return this.table(r, "List of data types");
  }

  async listDomains(pattern, verbose, system) {
    let sql = `SELECT n.nspname as "Schema",
       t.typname as "Name",
       pg_catalog.format_type(t.typbasetype, t.typtypmod) as "Type",
       (SELECT c.collname FROM pg_catalog.pg_collation c, pg_catalog.pg_type bt
        WHERE c.oid = t.typcollation AND bt.oid = t.typbasetype AND t.typcollation <> bt.typcollation) as "Collation",
       CASE WHEN t.typnotnull THEN 'not null' END as "Nullable",
       t.typdefault as "Default",
       pg_catalog.array_to_string(ARRAY(
         SELECT pg_catalog.pg_get_constraintdef(r.oid, true) FROM pg_catalog.pg_constraint r WHERE t.oid = r.contypid AND r.contype = 'c' ORDER BY r.conname
       ), ' ') as "Check"`;
    if (verbose) sql += `,\n  pg_catalog.array_to_string(t.typacl, E'\\n') AS "Access privileges",\n       d.description as "Description"`;
    sql += `\nFROM pg_catalog.pg_type t
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace\n`;
    if (verbose) sql += `     LEFT JOIN pg_catalog.pg_description d ON d.classoid = t.tableoid AND d.objoid = t.oid AND d.objsubid = 0\n`;
    sql += `WHERE t.typtype = 'd'\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "t.typname", "pg_catalog.pg_type_is_visible(t.oid)");
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any domains named "${pattern}".\n`;
    return this.table(r, "List of domains");
  }

  async permissionsList(pattern, system) {
    let sql = `SELECT n.nspname as "Schema",
  c.relname as "Name",
  CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' WHEN 'S' THEN 'sequence' WHEN 'f' THEN 'foreign table' WHEN 'p' THEN 'partitioned table' END as "Type",
  pg_catalog.array_to_string(c.relacl, E'\\n') AS "Access privileges",
  pg_catalog.array_to_string(ARRAY(
    SELECT attname || E':\\n  ' || pg_catalog.array_to_string(attacl, E'\\n  ')
    FROM pg_catalog.pg_attribute a
    WHERE attrelid = c.oid AND NOT attisdropped AND attacl IS NOT NULL
  ), E'\\n') AS "Column privileges",
  pg_catalog.array_to_string(ARRAY(
    SELECT polname
    || CASE WHEN NOT polpermissive THEN
       E' (RESTRICTIVE)'
       ELSE '' END
    || CASE WHEN polcmd != '*' THEN
           E' (' || polcmd::pg_catalog.text || E'):'
       ELSE E':'
       END
    || CASE WHEN polqual IS NOT NULL THEN
           E'\\n  (u): ' || pg_catalog.pg_get_expr(polqual, polrelid)
       ELSE E''
       END
    || CASE WHEN polwithcheck IS NOT NULL THEN
           E'\\n  (c): ' || pg_catalog.pg_get_expr(polwithcheck, polrelid)
       ELSE E''
       END    || CASE WHEN polroles <> '{0}' THEN
           E'\\n  to: ' || pg_catalog.array_to_string(
               ARRAY(
                   SELECT rolname
                   FROM pg_catalog.pg_roles
                   WHERE oid = ANY (polroles)
                   ORDER BY 1
               ), E', ')
       ELSE E''
       END
    FROM pg_catalog.pg_policy pol
    WHERE polrelid = c.oid), E'\\n')
    AS "Policies"
FROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','v','m','S','f','p')\n`;
    if (!system && !pattern) sql += "  AND n.nspname !~ '^pg_'\n";
    sql += patternWhere(pattern, "n.nspname", "c.relname", "pg_catalog.pg_table_is_visible(c.oid)");
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any relations named "${pattern}".\n`;
    return this.table(r, "Access privileges");
  }

  async listPartitioned(kind, pattern, verbose) {
    const idx = kind.includes("i");
    const tbl = kind.includes("t");
    const nested = kind.includes("n");
    const both = idx === tbl;
    let sql = `SELECT n.nspname as "Schema",
  c.relname as "Name",
  pg_catalog.pg_get_userbyid(c.relowner) as "Owner"`;
    if (both) sql += `,\n  CASE c.relkind WHEN 'p' THEN 'partitioned table' WHEN 'I' THEN 'partitioned index' END as "Type"`;
    if (nested) sql += `,\n  inh.inhparent::pg_catalog.regclass as "Parent name"`;
    if (idx || both) sql += `,\n c2.oid::pg_catalog.regclass as "Table"`;
    if (verbose) {
      sql += `,\n  am.amname as "Access method"`;
      if (nested) sql += `,\n  s.dps as "Leaf partition size",\n  s.tps as "Total size"`;
      else sql += `,\n  s.tps as "Total size"`;
      sql += `,\n  pg_catalog.obj_description(c.oid, 'pg_class') as "Description"`;
    }
    sql += `\nFROM pg_catalog.pg_class c
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace\n`;
    if (idx || both) sql += `     LEFT JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid\n     LEFT JOIN pg_catalog.pg_class c2 ON i.indrelid = c2.oid\n`;
    if (nested) sql += `     LEFT JOIN pg_catalog.pg_inherits inh ON c.oid = inh.inhrelid\n`;
    if (verbose) {
      sql += `     LEFT JOIN pg_catalog.pg_am am ON c.relam = am.oid\n`;
      sql += nested
        ? `,\n     LATERAL (SELECT pg_catalog.pg_size_pretty(sum(
                 CASE WHEN ppt.isleaf AND ppt.level = 1
                      THEN pg_catalog.pg_table_size(ppt.relid) ELSE 0 END)) AS dps,
                     pg_catalog.pg_size_pretty(sum(pg_catalog.pg_table_size(ppt.relid))) AS tps
              FROM pg_catalog.pg_partition_tree(c.oid) ppt) s\n`
        : `,\n     LATERAL (SELECT pg_catalog.pg_size_pretty(sum(pg_catalog.pg_table_size(ppt.relid))) AS tps
              FROM pg_catalog.pg_partition_tree(c.oid) ppt) s\n`;
    }
    sql += `WHERE c.relkind IN (${both ? "'p','I'" : idx ? "'I'" : "'p'"})\n`;
    if (!nested) sql += `  AND NOT c.relispartition\n`;
    sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname !~ '^pg_toast'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "c.relname", "pg_catalog.pg_table_is_visible(c.oid)");
    sql += both ? 'ORDER BY "Schema", "Type" DESC, "Name";' : 'ORDER BY "Schema", "Name";';
    const r = await this.query(sql);
    const noun = both ? "partitioned relations" : idx ? "partitioned indexes" : "partitioned tables";
    if (!r.rows.length && pattern) return `Did not find any ${noun} named "${pattern}".\n`;
    return this.table(r, `List of ${noun}`);
  }

  async listEventTriggers(pattern, verbose) {
    let sql = `SELECT evtname as "Name", evtevent as "Event", pg_catalog.pg_get_userbyid(e.evtowner) as "Owner",
 case evtenabled when 'O' then 'enabled'  when 'R' then 'replica'  when 'A' then 'always'  when 'D' then 'disabled' end as "Enabled",
 e.evtfoid::pg_catalog.regproc as "Function", pg_catalog.array_to_string(array(select x from pg_catalog.unnest(evttags) as t(x)), ', ') as "Tags"`;
    if (verbose) sql += `,\npg_catalog.obj_description(e.oid, 'pg_event_trigger') as "Description"`;
    sql += `\nFROM pg_catalog.pg_event_trigger e\nWHERE true\n`;
    sql += patternWhere(pattern, null, "evtname", null);
    sql += "ORDER BY 1";
    const r = await this.query(sql);
    return this.table(r, "List of event triggers");
  }

  async listLanguages(pattern, verbose, system) {
    let sql = `SELECT l.lanname AS "Name",
       pg_catalog.pg_get_userbyid(l.lanowner) as "Owner",
       l.lanpltrusted AS "Trusted"`;
    if (verbose) sql += `,\n       NOT l.lanispl AS "Internal language",\n       l.lanplcallfoid::pg_catalog.regprocedure AS "Call handler",\n       l.lanvalidator::pg_catalog.regprocedure AS "Validator",\n       l.laninline::pg_catalog.regprocedure AS "Inline handler",\n       pg_catalog.array_to_string(l.lanacl, E'\\n') AS "Access privileges"`;
    sql += `,\n       d.description AS "Description"\nFROM pg_catalog.pg_language l\nLEFT JOIN pg_catalog.pg_description d\n  ON d.classoid = l.tableoid AND d.objoid = l.oid\n  AND d.objsubid = 0\n`;
    sql += pattern ? "WHERE true\n" + patternWhere(pattern, null, "l.lanname", null) : system ? "" : "WHERE l.lanplcallfoid != 0\n";
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    return this.table(r, "List of languages");
  }

  async listDbRoleSettings(rolePattern, dbPattern) {
    let sql = `SELECT rolname AS "Role", datname AS "Database",
pg_catalog.array_to_string(setconfig, E'\\n') AS "Settings"
FROM pg_catalog.pg_db_role_setting s
LEFT JOIN pg_catalog.pg_database d ON d.oid = setdatabase
LEFT JOIN pg_catalog.pg_roles r ON r.oid = setrole\nWHERE true\n`;
    if (rolePattern && rolePattern !== "*") sql += patternWhere(rolePattern, null, "r.rolname", null);
    if (dbPattern && dbPattern !== "*") sql += patternWhere(dbPattern, null, "d.datname", null);
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length) return rolePattern && dbPattern ? `Did not find any settings for role "${rolePattern}" and database "${dbPattern}".\n` : rolePattern ? `Did not find any settings for role "${rolePattern}".\n` : "Did not find any settings.\n";
    return this.table(r, "List of settings");
  }

  async listTSObjects(kind, pattern) {
    const K = {
      config: ["pg_ts_config", "cfgname", "cfgnamespace", "pg_ts_config_is_visible", "text search configurations"],
      dict: ["pg_ts_dict", "dictname", "dictnamespace", "pg_ts_dict_is_visible", "text search dictionaries"],
      parser: ["pg_ts_parser", "prsname", "prsnamespace", "pg_ts_parser_is_visible", "text search parsers"],
      template: ["pg_ts_template", "tmplname", "tmplnamespace", "pg_ts_template_is_visible", "text search templates"],
    }[kind];
    const [tbl, name, nsp, vis, noun] = K;
    let sql = `SELECT
  n.nspname as "Schema",
  t.${name} as "Name",
  pg_catalog.obj_description(t.oid, '${tbl}') as "Description"
FROM pg_catalog.${tbl} t
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.${nsp}
WHERE true\n`;
    sql += patternWhere(pattern, "n.nspname", `t.${name}`, `pg_catalog.${vis}(t.oid)`);
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any ${noun.replace("text search ", "text search ")} named "${pattern}".\n`;
    return this.table(r, `List of ${noun}`);
  }

  async describeTSConfigs(pattern) {
    let sql = `SELECT c.oid, c.cfgname,
   n.nspname,
   p.prsname,
   np.nspname as pnspname
FROM pg_catalog.pg_ts_config c
   LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.cfgnamespace,
 pg_catalog.pg_ts_parser p
   LEFT JOIN pg_catalog.pg_namespace np ON np.oid = p.prsnamespace
WHERE  p.oid = c.cfgparser\n`;
    sql += patternWhere(pattern, "n.nspname", "c.cfgname", "pg_catalog.pg_ts_config_is_visible(c.oid)");
    sql += "ORDER BY 3, 2;";
    const r = await this.query(sql);
    if (!r.rows.length) return pattern ? `Did not find any text search configuration named "${pattern}".\n` : "Did not find any text search configurations.\n";
    let out = "";
    for (const [oid, cfg, nsp, prs, pnsp] of r.rows) {
      const m = await this.query(`SELECT
  ( SELECT t.alias FROM
    pg_catalog.ts_token_type(c.cfgparser) AS t
    WHERE t.tokid = m.maptokentype ) AS "Token",
  pg_catalog.btrim(
    ARRAY( SELECT mm.mapdict::pg_catalog.regdictionary
           FROM pg_catalog.pg_ts_config_map AS mm
           WHERE mm.mapcfg = m.mapcfg AND mm.maptokentype = m.maptokentype
           ORDER BY mapcfg, maptokentype, mapseqno
    ) :: pg_catalog.text,
  '{}') AS "Dictionaries"
FROM pg_catalog.pg_ts_config AS c, pg_catalog.pg_ts_config_map AS m
WHERE c.oid = '${oid}' AND m.mapcfg = c.oid
GROUP BY m.mapcfg, m.maptokentype, c.cfgparser
ORDER BY 1;`);
      if (out) out += "";
      out += printTable({ title: `Text search configuration "${nsp}.${cfg}"\nParser: "${pnsp}.${prs}"`, headers: m.fields.map((f) => f.name), rows: m.rows, footers: [] }, this.popt());
    }
    return out;
  }

  async listDefaultACLs(pattern) {
    let sql = `SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS "Owner",
  n.nspname AS "Schema",
  CASE d.defaclobjtype WHEN 'r' THEN 'table' WHEN 'S' THEN 'sequence' WHEN 'f' THEN 'function' WHEN 'T' THEN 'type' WHEN 'n' THEN 'schema' WHEN 'L' THEN 'large object' END AS "Type",
  pg_catalog.array_to_string(d.defaclacl, E'\\n') AS "Access privileges"
FROM pg_catalog.pg_default_acl d
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace\n`;
    if (pattern) sql += `WHERE (n.nspname OPERATOR(pg_catalog.~) ${esc("^(" + parsePattern(pattern).name + ")$")} COLLATE pg_catalog.default\n        OR pg_catalog.pg_get_userbyid(d.defaclrole) OPERATOR(pg_catalog.~) ${esc("^(" + parsePattern(pattern).name + ")$")} COLLATE pg_catalog.default)\n`;
    sql += "ORDER BY 1, 2, 3;";
    const r = await this.query(sql);
    return this.table(r, "Default access privileges");
  }

  async listOperators(pattern, verbose, system) {
    let sql = `SELECT n.nspname as "Schema",
  o.oprname AS "Name",
  CASE WHEN o.oprkind='l' THEN NULL ELSE pg_catalog.format_type(o.oprleft, NULL) END AS "Left arg type",
  CASE WHEN o.oprkind='r' THEN NULL ELSE pg_catalog.format_type(o.oprright, NULL) END AS "Right arg type",
  pg_catalog.format_type(o.oprresult, NULL) AS "Result type",\n`;
    if (verbose) sql += `  o.oprcode AS "Function",\n`;
    sql += `  coalesce(pg_catalog.obj_description(o.oid, 'pg_operator'),
           pg_catalog.obj_description(o.oprcode, 'pg_proc')) AS "Description"
FROM pg_catalog.pg_operator o
     LEFT JOIN pg_catalog.pg_namespace n ON n.oid = o.oprnamespace\nWHERE true\n`;
    if (!system && !pattern) sql += `      AND n.nspname <> 'pg_catalog'\n      AND n.nspname <> 'information_schema'\n`;
    sql += patternWhere(pattern, "n.nspname", "o.oprname", "pg_catalog.pg_operator_is_visible(o.oid)");
    sql += "ORDER BY 1, 2, 3, 4;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any operators named "${pattern}".\n`;
    return this.table(r, "List of operators");
  }

  async listExtendedStats(pattern) {
    let sql = `SELECT 
es.stxnamespace::pg_catalog.regnamespace::pg_catalog.text AS "Schema", 
es.stxname AS "Name", 
pg_catalog.format('%s FROM %s', 
  pg_catalog.pg_get_statisticsobjdef_columns(es.oid), 
  es.stxrelid::pg_catalog.regclass) AS "Definition",
CASE WHEN 'd' = any(es.stxkind) THEN 'defined' 
END AS "Ndistinct", 
CASE WHEN 'f' = any(es.stxkind) THEN 'defined' 
END AS "Dependencies",
CASE WHEN 'm' = any(es.stxkind) THEN 'defined' 
END AS "MCV"  
FROM pg_catalog.pg_statistic_ext es 
WHERE true\n`;
    sql += patternWhere(pattern, "es.stxnamespace::pg_catalog.regnamespace::pg_catalog.text", "es.stxname", "pg_catalog.pg_statistics_obj_is_visible(es.oid)");
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any extended statistics named "${pattern}".\n`;
    return this.table(r, "List of extended statistics");
  }

  async listTablespaces(pattern, verbose) {
    let sql = `SELECT spcname AS "Name",
  pg_catalog.pg_get_userbyid(spcowner) AS "Owner",
  pg_catalog.pg_tablespace_location(oid) AS "Location"`;
    if (verbose) sql += `,\n  pg_catalog.array_to_string(spcacl, E'\\n') AS "Access privileges",\n  spcoptions AS "Options",\n  pg_catalog.pg_size_pretty(pg_catalog.pg_tablespace_size(oid)) AS "Size",\n  pg_catalog.shobj_description(oid, 'pg_tablespace') AS "Description"`;
    sql += `\nFROM pg_catalog.pg_tablespace\nWHERE true\n`;
    sql += patternWhere(pattern, null, "spcname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    return this.table(r, "List of tablespaces");
  }

  async listCasts(pattern, verbose) {
    let sql = `SELECT pg_catalog.format_type(castsource, NULL) AS "Source type",
       pg_catalog.format_type(casttarget, NULL) AS "Target type",
       CASE WHEN c.castmethod = 'b' THEN '(binary coercible)'
            WHEN c.castmethod = 'i' THEN '(with inout)'
            ELSE p.proname
       END AS "Function",
       CASE WHEN c.castcontext = 'e' THEN 'no'
            WHEN c.castcontext = 'a' THEN 'in assignment'
            ELSE 'yes'
       END AS "Implicit?"`;
    if (verbose) sql += `,\n       d.description AS "Description"`;
    sql += `
FROM pg_catalog.pg_cast c LEFT JOIN pg_catalog.pg_proc p
     ON c.castfunc = p.oid
     LEFT JOIN pg_catalog.pg_type ts
     ON c.castsource = ts.oid
     LEFT JOIN pg_catalog.pg_namespace ns
     ON ns.oid = ts.typnamespace
     LEFT JOIN pg_catalog.pg_type tt
     ON c.casttarget = tt.oid
     LEFT JOIN pg_catalog.pg_namespace nt
     ON nt.oid = tt.typnamespace\n`;
    if (verbose) sql += `     LEFT JOIN pg_catalog.pg_description d\n     ON d.classoid = c.tableoid AND d.objoid = c.oid AND d.objsubid = 0\n`;
    if (pattern) {
      const p = parsePattern(pattern);
      const re = esc("^(" + p.name + ")$");
      sql += `WHERE ( (true  AND pg_catalog.format_type(ts.oid, NULL) OPERATOR(pg_catalog.~) ${re} COLLATE pg_catalog.default
) OR (true  AND pg_catalog.format_type(tt.oid, NULL) OPERATOR(pg_catalog.~) ${re} COLLATE pg_catalog.default
) )\n`;
    } else sql += `WHERE ( (true  AND pg_catalog.pg_type_is_visible(ts.oid)\n) OR (true  AND pg_catalog.pg_type_is_visible(tt.oid)\n) )\n`;
    sql += "ORDER BY 1, 2;";
    const r = await this.query(sql);
    return this.table(r, "List of casts");
  }

  async listPublications(pattern) {
    let sql = `SELECT pubname AS "Name",
  pg_catalog.pg_get_userbyid(pubowner) AS "Owner",
  puballtables AS "All tables",
  pubinsert AS "Inserts",
  pubupdate AS "Updates",
  pubdelete AS "Deletes",
  pubtruncate AS "Truncates",
  (CASE pubgencols
    WHEN 'n' THEN 'none'
    WHEN 's' THEN 'stored'
   END) AS "Generated columns",
  pubviaroot AS "Via root"
FROM pg_catalog.pg_publication\nWHERE true\n`;
    sql += patternWhere(pattern, null, "pubname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    if (!r.rows.length && pattern) return `Did not find any publications named "${pattern}".\n`;
    return this.table(r, "List of publications");
  }

  async describePublications(pattern) {
    let sql = `SELECT oid, pubname, pg_catalog.pg_get_userbyid(pubowner) AS "Owner", puballtables AS "All tables", pubinsert AS "Inserts", pubupdate AS "Updates", pubdelete AS "Deletes", pubtruncate AS "Truncates", (CASE pubgencols WHEN 'n' THEN 'none' WHEN 's' THEN 'stored' END) AS "Generated columns", pubviaroot AS "Via root"
FROM pg_catalog.pg_publication\nWHERE true\n`;
    sql += patternWhere(pattern, null, "pubname", null);
    sql += "ORDER BY 2;";
    const r = await this.query(sql);
    if (!r.rows.length) return pattern ? `Did not find any publication named "${pattern}".\n` : "Did not find any publications.\n";
    let out = "";
    for (const row of r.rows) {
      const [oid, name] = row;
      const footers = [];
      const t = await this.query(`SELECT n.nspname, c.relname,
  pg_catalog.pg_get_expr(pr.prqual, c.oid),
  (CASE WHEN pr.prattrs IS NOT NULL THEN
     pg_catalog.array_to_string(ARRAY(SELECT attname FROM pg_catalog.generate_series(0, pg_catalog.array_upper(pr.prattrs::pg_catalog.int2[], 1)) s, pg_catalog.pg_attribute WHERE attrelid = c.oid AND attnum = prattrs[s]), ', ')
   ELSE NULL END)
FROM pg_catalog.pg_class c,
     pg_catalog.pg_namespace n,
     pg_catalog.pg_publication_rel pr
WHERE c.relnamespace = n.oid
  AND c.oid = pr.prrelid
  AND pr.prpubid = '${oid}'
ORDER BY 1,2`);
      if (t.rows.length) {
        footers.push("Tables:");
        for (const [nsp, rel, qual, cols] of t.rows) footers.push(`    "${nsp}.${rel}"${cols ? ` (${cols})` : ""}${qual ? ` WHERE ${qual}` : ""}`);
      }
      const sc = await this.query(`SELECT n.nspname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_publication_namespace pn ON n.oid = pn.pnnspid WHERE pn.pnpubid = '${oid}' ORDER BY 1`);
      if (sc.rows.length) { footers.push("Tables from schemas:"); for (const [nsp] of sc.rows) footers.push(`    "${nsp}"`); }
      out += printTable({ title: `Publication ${name}`, headers: r.fields.slice(2).map((f) => f.name), types: r.fields.slice(2).map((f) => f.dataTypeID), rows: [row.slice(2)], footers }, this.popt());
    }
    return out;
  }

  async listSubscriptions(pattern, verbose) {
    let sql = `SELECT subname AS "Name"
,  pg_catalog.pg_get_userbyid(subowner) AS "Owner"
,  subenabled AS "Enabled"
,  subpublications AS "Publication"`;
    if (verbose) sql += `
, subbinary AS "Binary"
, (CASE substream WHEN 'f' THEN 'off' WHEN 't' THEN 'on' WHEN 'p' THEN 'parallel' END) AS "Streaming"
, subtwophasestate AS "Two-phase commit"
, subdisableonerr AS "Disable on error"
, suborigin AS "Origin"
, subpasswordrequired AS "Password required"
, subrunasowner AS "Run as owner?"
, subfailover AS "Failover"
,  subsynccommit AS "Synchronous commit"
,  subconninfo AS "Conninfo"
, subskiplsn AS "Skip LSN"`;
    sql += `\nFROM pg_catalog.pg_subscription\nWHERE subdbid = (SELECT oid\n                 FROM pg_catalog.pg_database\n                 WHERE datname = pg_catalog.current_database())\n`;
    sql += patternWhere(pattern, null, "subname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    return this.table(r, "List of subscriptions");
  }

  async describeConfig(pattern, verbose) {
    let sql = `SELECT s.name AS "Parameter", pg_catalog.current_setting(s.name) AS "Value"`;
    if (verbose) sql += `, s.vartype AS "Type", s.context AS "Context", pg_catalog.array_to_string(p.paracl, E'\\n') AS "Access privileges"`;
    sql += `\nFROM pg_catalog.pg_settings s\n`;
    if (verbose) sql += `  LEFT JOIN pg_catalog.pg_parameter_acl p\n  ON pg_catalog.lower(s.name) = p.parname\n`;
    if (pattern) {
      const p = parsePattern(pattern);
      sql += `WHERE pg_catalog.lower(s.name) OPERATOR(pg_catalog.~) ${esc("^(" + p.name + ")$")} COLLATE pg_catalog.default\n`;
    } else sql += `WHERE s.source <> 'default' AND\n      s.setting IS DISTINCT FROM s.boot_val\n`;
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    return this.table(r, pattern ? "List of configuration parameters" : "List of non-default configuration parameters");
  }

  async listDatabases(pattern, verbose) {
    let sql = `SELECT
  d.datname as "Name",
  pg_catalog.pg_get_userbyid(d.datdba) as "Owner",
  pg_catalog.pg_encoding_to_char(d.encoding) as "Encoding",
  CASE d.datlocprovider WHEN 'b' THEN 'builtin' WHEN 'c' THEN 'libc' WHEN 'i' THEN 'icu' END AS "Locale Provider",
  d.datcollate as "Collate",
  d.datctype as "Ctype",
  d.datlocale as "Locale",
  d.daticurules as "ICU Rules",
  CASE WHEN pg_catalog.array_length(d.datacl, 1) = 0 THEN '(none)' ELSE pg_catalog.array_to_string(d.datacl, E'\\n') END AS "Access privileges"`;
    if (verbose) sql += `,
  CASE WHEN pg_catalog.has_database_privilege(d.datname, 'CONNECT')
       THEN pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(d.datname))
       ELSE 'No Access'
  END as "Size",
  t.spcname as "Tablespace",
  pg_catalog.shobj_description(d.oid, 'pg_database') as "Description"`;
    sql += `\nFROM pg_catalog.pg_database d\n`;
    if (verbose) sql += `  JOIN pg_catalog.pg_tablespace t on d.dattablespace = t.oid\n`;
    if (pattern) sql += "WHERE true\n" + patternWhere(pattern, null, "d.datname", null);
    sql += "ORDER BY 1;";
    const r = await this.query(sql);
    return this.table(r, "List of databases");
  }

  /** \\sf+ / \\sv+: numera las líneas (en funciones, solo el cuerpo), como print_with_linenumbers de psql. */
  static numbered(text, isFunc) {
    let inHeader = isFunc;
    let n = 0;
    return text.replace(/\n$/, "").split("\n").map((l) => {
      if (inHeader && (l.startsWith("AS ") || l.startsWith("BEGIN ") || l.startsWith("RETURN "))) inHeader = false;
      if (inHeader) return "        " + l;
      n++;
      return String(n).padEnd(7) + " " + l;
    }).join("\n") + "\n";
  }

  async showFunction(name, kind) {
    const oidq = /\(/.test(name) ? `'${name.replace(/'/g, "''")}'::pg_catalog.regprocedure::pg_catalog.oid` : `'${name.replace(/'/g, "''")}'::pg_catalog.regproc::pg_catalog.oid`;
    if (kind === "f") {
      const r = await this.query(`SELECT pg_catalog.pg_get_functiondef(${oidq})`);
      return r.rows[0][0];
    }
    const r = await this.query(`SELECT nspname, relname, relkind, pg_catalog.pg_get_viewdef(c.oid, true), pg_catalog.array_remove(pg_catalog.array_remove(c.reloptions,'check_option=local'),'check_option=cascaded') AS reloptions, CASE WHEN 'check_option=local' = ANY (c.reloptions) THEN 'LOCAL'::text WHEN 'check_option=cascaded' = ANY (c.reloptions) THEN 'CASCADED'::text ELSE NULL END AS checkoption FROM pg_catalog.pg_class c LEFT JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid WHERE c.oid = '${name.replace(/'/g, "''")}'::pg_catalog.regclass::pg_catalog.oid`);
    const [nsp, rel, relkind, def, opts, check] = r.rows[0];
    let s = `CREATE OR REPLACE ${relkind === "m" ? "MATERIALIZED VIEW" : "VIEW"} ${nsp}.${rel}`;
    if (opts && opts !== "{}") s += ` WITH (${String(opts).replace(/^\{|\}$/g, "").replace(/,/g, ", ")})`;
    s += " AS\n" + String(def).replace(/;\s*$/, "");
    if (check) s += `\n  WITH ${check} CHECK OPTION`;
    return s + "\n";
  }
}
