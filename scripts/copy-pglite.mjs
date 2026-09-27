// Copia PGlite (PostgreSQL 18 en WebAssembly), sus extensiones y pg_dump a public/pglite para servirlos en local, sin internet.
import fs from "fs";
import path from "path";
const dst = path.resolve("public/pglite");
const want = (f) => /\.(js|wasm|data|tar\.gz)$/.test(f) && !f.endsWith(".map");
function copyDir(src, to) {
  if (!fs.existsSync(src)) { console.error("Falta " + src); process.exit(1); }
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const from = path.join(src, f);
    if (fs.statSync(from).isDirectory() || !want(f)) continue;
    const out = path.join(to, f);
    if (!fs.existsSync(out) || fs.statSync(out).size !== fs.statSync(from).size) fs.copyFileSync(from, out);
  }
}
copyDir(path.resolve("node_modules/@electric-sql/pglite/dist"), dst);
copyDir(path.resolve("node_modules/@electric-sql/pglite/dist/contrib"), path.join(dst, "contrib"));
copyDir(path.resolve("node_modules/@electric-sql/pglite-pgvector/dist"), path.join(dst, "vector"));
copyDir(path.resolve("node_modules/@electric-sql/pglite-postgis/dist"), path.join(dst, "postgis"));
copyDir(path.resolve("node_modules/@electric-sql/pglite-tools/dist"), path.join(dst, "tools"));
console.log("PGlite listo en public/pglite");
