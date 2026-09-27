// Motor de PostgreSQL simulado para Node (validador y pruebas): mismo código que usa el navegador.
import fs from "fs";
import path from "path";
import { PGlite, protocol } from "@electric-sql/pglite";
import { Engine } from "../public/pg/engine.mjs";

export const CONTRIB = ["amcheck", "auto_explain", "bloom", "btree_gin", "btree_gist", "citext", "cube", "dict_int", "dict_xsyn", "earthdistance", "fuzzystrmatch", "hstore", "intarray", "isn", "lo", "ltree", "pageinspect", "pg_buffercache", "pg_freespacemap", "pg_stat_statements", "pg_surgery", "pg_trgm", "pg_visibility", "pg_walinspect", "pgcrypto", "seg", "tablefunc", "tcn", "tsm_system_rows", "tsm_system_time", "unaccent", "uuid_ossp"];

let extCache = null;
export function makeEngine() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  return new Engine({
    PGlite,
    protocol,
    extensions: async () => {
      if (!extCache) {
        extCache = {};
        for (const n of CONTRIB) extCache[n] = (await import(`@electric-sql/pglite/contrib/${n}`))[n];
        extCache.vector = (await import("@electric-sql/pglite-pgvector")).vector;
      }
      return extCache;
    },
    extra: async (name) => (name === "postgis" ? { postgis: (await import("@electric-sql/pglite-postgis")).postgis } : {}),
    help: async () => JSON.parse(fs.readFileSync(path.join(root, "public/pg/help.json"), "utf8")),
    checksSql: async () => fs.readFileSync(path.join(root, "public/pg/checks.sql"), "utf8"),
    dataset: async (name) => {
      const f = path.join(root, "public/pg/datasets", name + ".sql");
      if (!/^[\w-]+$/.test(name) || !fs.existsSync(f)) throw new Error(`No existe el conjunto de datos «${name}»`);
      return fs.readFileSync(f, "utf8");
    },
    now: () => performance.now(),
  });
}
