"use client";

import Link from "next/link";
import type { SectionMeta } from "@/lib/types";
import { levelLabel } from "@/lib/format";
import { pkey, useProgress } from "./ProgressProvider";

/** Rótulo de la pestaña de ejercicios según cómo se practica en cada curso. */
const PRACTICE: Record<string, string> = {
  python: "Práctica de código · se ejecuta aquí, con Python real",
  git: "Práctica con Git real · en una terminal aislada",
  english: "Práctica de inglés · con audio, micrófono y corrección al instante",
  postgres: "Práctica con PostgreSQL 18 · simulado aquí mismo, en tu navegador"
};
const KIND: Record<string, string> = { vocabulario: "Vocabulario", gramatica: "Gramática", traduccion: "Traducción", dictado: "Dictado", pronunciacion: "Pronunciación", conversacion: "Conversación", examen: "Examen del libro", mixto: "Desafío", "pg-query": "Consulta", "pg-script": "Script SQL", "pg-psql": "Consola psql" };

export default function ExercisesTab({ courseId, meta, pct, runtime }: { courseId: string; meta: SectionMeta; pct: number; runtime?: string }) {
  const { p } = useProgress();
  const list = meta.exercises;
  if (!list.length) return <div className="empty">Esta sección no tiene ejercicios.</div>;
  const solved = list.filter((x) => p.exercises[pkey(courseId, x.id)]?.solved).length;
  const needed = pct > 0 ? Math.ceil((list.length * pct) / 100) : list.length;
  return (
    <div className="stack">
      <div className="spread panel" style={{ padding: "14px 18px" }}>
        <div>
          <span className="eyebrow">{PRACTICE[runtime || "python"] ?? PRACTICE.python}</span>
          <div style={{ marginTop: 4 }}><b className="num">{solved}/{list.length}</b> resueltos{pct > 0 && <> · meta del campamento: <b>{needed}</b> ({pct} %)</>}</div>
        </div>
        <div className={"bar" + (solved >= needed ? " good" : "")} style={{ width: 200 }}><i style={{ width: `${(solved / list.length) * 100}%` }} /></div>
      </div>
      <div className="lesson-list">
        {list.map((x, i) => {
          const st = p.exercises[pkey(courseId, x.id)];
          return (
            <Link key={x.id} className="lesson-item" href={`/${courseId}/${meta.id}/ejercicio/${x.id}`}>
              <span className={"check" + (st?.solved ? " on" : "")} aria-label={st?.solved ? "Resuelto" : "Pendiente"}>✓</span>
              <span>
                <b>{i + 1}. {x.title}</b>
                <span className="faint mono" style={{ display: "block", marginTop: 4 }}>
                  <span className={"blaze lvl-" + x.level} style={{ marginRight: 8 }}>{levelLabel(x.level)}</span>
                  {x.kind && KIND[x.kind] ? <span className="pill" style={{ marginRight: 8 }}>{KIND[x.kind]}</span> : null}
                  {x.minutes ? `${x.minutes} min` : ""}{st && !st.solved && st.attempts ? ` · ${st.attempts} intento${st.attempts > 1 ? "s" : ""}` : ""}{st?.best != null ? ` · mejor: ${st.best} %` : ""}{st?.sawSolution ? " · viste la solución" : ""}
                </span>
              </span>
              <span className="faint">{st?.solved ? "Repasar →" : st?.attempts ? "Continuar →" : "Empezar →"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
