"use client";

import { useState } from "react";
import type { SchemaInfo } from "@/lib/pgRunner";
import Mermaid from "./Mermaid";

const ent = (full: string) => full.replace(/^public\./, "").replace(/[^A-Za-z0-9_]/g, "_");
const typ = (t: string) =>
  t.replace(/character varying/, "varchar").replace(/timestamp with time zone/, "timestamptz").replace(/timestamp without time zone/, "timestamp")
    .replace(/double precision/, "float8").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "tipo";

/** Diagrama entidad-relación (Mermaid) a partir del catálogo. */
export function erDiagram(s: SchemaInfo) {
  const tables = s.tables.filter((t) => t.kind !== "v" && t.kind !== "m");
  if (!tables.length) return null;
  const fkCols = new Set(s.fks.flatMap((f) => f.cols.split(",").map((c) => f.from + "." + c)));
  let m = "erDiagram\n";
  for (const t of tables) {
    const full = t.schema + "." + t.name;
    m += `  ${ent(full)} {\n`;
    for (const c of t.columns.slice(0, 14)) {
      const keys = [c.pk ? "PK" : "", fkCols.has(full + "." + c.name) ? "FK" : ""].filter(Boolean).join(",");
      m += `    ${typ(c.type)} ${c.name.replace(/[^A-Za-z0-9_]/g, "_")}${keys ? " " + keys : ""}\n`;
    }
    if (t.columns.length > 14) m += `    etc mas_columnas\n`;
    m += "  }\n";
  }
  for (const f of s.fks) m += `  ${ent(f.to)} ||--o{ ${ent(f.from)} : "${f.cols}"\n`;
  return m;
}

/** Panel con las tablas de la base (columnas, llaves, filas) y su diagrama ER. */
export default function PgSchema({ schema, loading }: { schema: SchemaInfo | null; loading?: boolean }) {
  const [view, setView] = useState<"tablas" | "er">("tablas");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tables = schema?.tables ?? [];
  const fkOf = (full: string, col: string) => schema?.fks.find((f) => f.from === full && f.cols.split(",").includes(col));
  const er = schema && view === "er" ? erDiagram(schema) : null;

  return (
    <div className="gx-panel pg-schema">
      <div className="gx-panel-head spread">
        <span>Base {schema ? <code>{schema.db}</code> : ""} · {tables.length} {tables.length === 1 ? "tabla" : "tablas"}{loading ? " · actualizando…" : ""}</span>
        <span className="pg-seg" role="tablist">
          <button role="tab" aria-selected={view === "tablas"} className={view === "tablas" ? "on" : ""} onClick={() => setView("tablas")}>Tablas</button>
          <button role="tab" aria-selected={view === "er"} className={view === "er" ? "on" : ""} onClick={() => setView("er")}>Diagrama ER</button>
        </span>
      </div>
      {!schema && <div className="faint" style={{ padding: 12 }}>{loading ? "Leyendo el catálogo…" : "Sin datos (¿transacción fallida? Haz ROLLBACK)."}</div>}
      {schema && !tables.length && <div className="faint" style={{ padding: 12 }}>La base <code>{schema.db}</code> no tiene tablas todavía.</div>}
      {schema && view === "tablas" && tables.length > 0 && (
        <ul className="pg-tables">
          {tables.map((t) => {
            const full = t.schema + "." + t.name;
            const isOpen = open[full] ?? tables.length <= 4;
            return (
              <li key={full}>
                <button className="pg-tname" onClick={() => setOpen((o) => ({ ...o, [full]: !isOpen }))} aria-expanded={isOpen}>
                  <span className="caret">{isOpen ? "▾" : "▸"}</span>
                  <b>{t.schema === "public" ? t.name : full}</b>
                  <span className="faint">{t.kind === "v" ? "vista" : t.kind === "m" ? "vista mat." : t.kind === "p" ? "particionada" : ""}{t.rows !== null && t.kind !== "v" ? ` ${t.rows > 100000 ? "100 000+" : t.rows.toLocaleString("es-CL")} fila${t.rows === 1 ? "" : "s"}` : ""}</span>
                </button>
                {isOpen && (
                  <table className="pg-cols">
                    <tbody>
                      {t.columns.map((c) => {
                        const fk = fkOf(full, c.name);
                        return (
                          <tr key={c.name}>
                            <td className="k">{c.pk ? <span title="Llave primaria">🔑</span> : fk ? <span title={`Llave foránea → ${fk.to.replace(/^public\./, "")}`}>↗</span> : ""}</td>
                            <td className="n">{c.name}</td>
                            <td className="t">{c.type}{c.notnull && !c.pk ? " · not null" : ""}{fk ? ` → ${fk.to.replace(/^public\./, "")}(${fk.refcols})` : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {schema && view === "er" && (er ? <div className="pg-er"><Mermaid code={er} /></div> : <div className="faint" style={{ padding: 12 }}>No hay tablas para dibujar.</div>)}
    </div>
  );
}
