// Consola psql simulada en la terminal (el mismo motor del curso). Para autores de contenido.
// Uso: node scripts/psql.mjs [dataset|postgres] [--setup archivo.sql]
//   interactivo:   node scripts/psql.mjs tienda
//   con tubería:   echo "SELECT count(*) FROM pedidos;" | node scripts/psql.mjs tienda   (imprime la transcripción con prompts)
import fs from "fs";
import readline from "readline";
import { makeEngine } from "./pg-node.mjs";
import { Session } from "../public/pg/engine.mjs";

const args = process.argv.slice(2);
const si = args.indexOf("--setup");
const setup = si >= 0 ? fs.readFileSync(args[si + 1], "utf8") : "";
const ds = args.find((a, i) => !a.startsWith("--") && (si < 0 || i !== si + 1)) || "postgres";
const eng = makeEngine();
const spec = ds === "postgres" ? { database: "postgres", setup } : { dataset: ds, database: ds, setup };
const data = await eng.snapshot("cli", spec);
const s = await new Session(eng, { data, database: spec.database }).start();

if (!process.stdin.isTTY) {
  const text = fs.readFileSync(0, "utf8");
  let out = "";
  for (const line of text.replace(/\n$/, "").split("\n")) {
    const r = await s.psql.feed(line);
    for (const e of r.events) out += e.prompt + e.line + "\n" + e.out;
    if (r.quit) break;
  }
  process.stdout.write(out);
  process.exit(0);
}
console.log('psql (18.3) — consola simulada del curso\nType "help" for help.\n');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: s.psql.prompt() });
rl.prompt();
rl.on("line", async (line) => {
  rl.pause();
  const r = await s.psql.feed(line);
  process.stdout.write(r.events.map((e) => e.out).join(""));
  if (r.quit) process.exit(0);
  rl.setPrompt(s.psql.prompt());
  rl.resume();
  rl.prompt();
});
rl.on("close", () => process.exit(0));
