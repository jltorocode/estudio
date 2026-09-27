// Valida que una sección tenga meta, objetivos y resumen por lección, y que no se haya tocado nada más.
// Uso: node scripts/check-goals.mjs content/ai-901/s01.json [...]
import fs from "fs";
import { execSync } from "child_process";

let bad = 0;
const str = (v) => typeof v === "string" && v.trim().length > 0;
for (const f of process.argv.slice(2)) {
  const errs = [];
  let s;
  try { s = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { errs.push("JSON inválido: " + e.message); }
  if (s) {
    if (!str(s.goal)) errs.push("Falta section.goal");
    for (const l of s.lessons || []) {
      if (!Array.isArray(l.goals) || l.goals.length < 2 || l.goals.length > 4 || !l.goals.every(str)) errs.push(`${l.id}: goals debe tener 2–4 frases`);
      if (!Array.isArray(l.takeaways) || l.takeaways.length < 3 || l.takeaways.length > 6 || !l.takeaways.every(str)) errs.push(`${l.id}: takeaways debe tener 3–6 frases`);
    }
    // Nada más debe cambiar respecto a la versión confirmada en git
    try {
      const orig = JSON.parse(execSync(`git show HEAD:${f}`, { encoding: "utf8", maxBuffer: 1 << 26 }));
      const strip = (x) => {
        const c = structuredClone(x);
        delete c.goal;
        for (const l of c.lessons || []) { delete l.goals; delete l.takeaways; }
        return JSON.stringify(c);
      };
      if (strip(orig) !== strip(s)) errs.push("Se modificaron campos que no son goal/goals/takeaways");
    } catch (e) { errs.push("No se pudo comparar con git: " + e.message.split("\n")[0]); }
  }
  if (errs.length) { bad++; console.log("✗ " + f + "\n  - " + errs.join("\n  - ")); }
  else console.log("OK " + f + ` (${s.lessons.length} lecciones)`);
}
process.exit(bad ? 1 : 0);
