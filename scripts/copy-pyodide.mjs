// Copia Pyodide (CPython 3.14 en WebAssembly) a public/pyodide para servirlo en local, sin internet.
import fs from "fs";
import path from "path";
const src = path.resolve("node_modules/pyodide");
const dst = path.resolve("public/pyodide");
const files = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
fs.mkdirSync(dst, { recursive: true });
for (const f of files) {
  const from = path.join(src, f);
  if (!fs.existsSync(from)) { console.error("Falta " + from); process.exit(1); }
  const to = path.join(dst, f);
  if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(from).size) fs.copyFileSync(from, to);
}
console.log("Pyodide listo en public/pyodide");
