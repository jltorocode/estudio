// Documenta los conjuntos de datos (content/postgresql/DATOS.md) con la consola psql simulada:
// \d de cada tabla, número de filas y algunas filas de ejemplo. Uso: node scripts/doc-datasets.mjs
import fs from "fs";
import { makeEngine } from "./pg-node.mjs";
import { Session } from "../public/pg/engine.mjs";

const eng = makeEngine();
const DESC = {
  tienda: "Comercio electrónico chileno «Tienda Andes»: categorías (con jerarquía padre_id), productos (precios en CLP enteros), clientes (RUT válidos, algunos sin email/teléfono/comuna), pedidos (2025-01 a 2026-06, estados y método de pago; `pendiente` sin método), detalle de pedidos (precio histórico por ítem) y reseñas (nota 1–5, comentarios en español, algunos NULL). Hay clientes sin pedidos y productos nunca vendidos.",
  rrhh: "Recursos humanos de «Andes Digital SpA»: departamentos, empleados con jerarquía (jefe_id; el gerente general no tiene jefe), historial de sueldos (reajustes), proyectos y asignaciones (N a M). Hay empleados que ya se fueron (fecha_salida) y una practicante sin departamento.",
  colegio: "Liceo con 6 cursos de enseñanza media, 7 asignaturas, alumnos y notas en escala chilena (1.0 a 7.0; se aprueba con 4.0): 2 semestres × 3 evaluaciones (la 3.ª del 2.º semestre aún no existe).",
  biblioteca: "Biblioteca comunitaria: autores latinoamericanos, libros reales (con resumen para búsqueda de texto), relación libro_autor (N a M, hay antologías con varios autores), socios y préstamos (algunos atrasados y algunos nunca devueltos: fecha_devolucion NULL). Hay libros que nunca se han prestado.",
  metro: "Metro de Santiago: líneas, estaciones reales (con combinaciones: una estación puede estar en varias líneas vía linea_estacion), 6.000 tarjetas y 120.000 validaciones del primer semestre de 2026 (tabla grande para índices, EXPLAIN y particiones).",
};
let md = `# Conjuntos de datos del curso de PostgreSQL

Generados por \`node scripts/gen-datasets.mjs\` (deterministas) en \`public/pg/datasets/*.sql\`. Cada uno vive en una base de datos con su mismo nombre (\`"dataset": "tienda"\` → base \`tienda\`, prompt \`tienda=#\`). Este documento se genera con \`node scripts/doc-datasets.mjs\` usando la misma consola psql simulada del curso.

`;
for (const ds of Object.keys(DESC)) {
  const data = await eng.snapshot("doc-" + ds, { dataset: ds, database: ds });
  const s = await new Session(eng, { data, database: ds }).start();
  const tabs = (await s.psql.hidden("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.oid")).rows.map((r) => r[0]);
  md += `## ${ds}\n\n${DESC[ds]}\n\n`;
  for (const t of tabs) {
    const n = (await s.psql.hidden(`SELECT count(*) FROM ${t}`)).rows[0][0];
    const d = await s.psql.feed(`\\d ${t}`);
    const sample = await s.psql.feed(`SELECT * FROM ${t} ORDER BY 1 LIMIT 3;`);
    md += `### ${t} (${n} filas)\n\n\`\`\`\n${d.events.map((e) => e.out).join("").trimEnd()}\n\`\`\`\n\nEjemplo:\n\n\`\`\`\n${sample.events.map((e) => e.out).join("").trimEnd()}\n\`\`\`\n\n`;
  }
  await s.close();
}
fs.writeFileSync("content/postgresql/DATOS.md", md);
console.log("content/postgresql/DATOS.md", (md.length / 1024).toFixed(0), "KB");
process.exit(0);
