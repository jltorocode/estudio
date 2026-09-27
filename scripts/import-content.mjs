// Convierte los cursos de la versión HTML (../plataforma-estudio/courses) a JSON en content/.
// Uso: node scripts/import-content.mjs [rutaOrigen]
import fs from "fs"; import path from "path"; import vm from "vm";
const src = path.resolve(process.argv[2] || "../plataforma-estudio/courses");
const out = path.resolve("content");
const courses = [];
const ctx = { STUDY: { course: (c) => courses.push(c), section: () => {} } };
vm.runInNewContext(fs.readFileSync(path.join(src, "index.js"), "utf8"), ctx);
for (const c of courses) {
  fs.mkdirSync(path.join(out, c.id), { recursive: true });
  for (const sid of c.sections) {
    const f = path.join(src, c.id, sid + ".js");
    if (!fs.existsSync(f)) { console.warn("Falta", f); continue; }
    let sec = null;
    vm.runInNewContext(fs.readFileSync(f, "utf8"), { STUDY: { section: (_, s) => (sec = s) } });
    fs.writeFileSync(path.join(out, c.id, sid + ".json"), JSON.stringify(sec, null, 1));
  }
}
fs.writeFileSync(path.join(out, "courses.json"), JSON.stringify(courses, null, 2));
console.log(`Importados ${courses.length} curso(s):`, courses.map((c) => `${c.id} (${c.sections.length} secciones)`).join(", "));
