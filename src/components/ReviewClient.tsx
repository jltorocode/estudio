"use client";

import { useState } from "react";
import type { Course, PoolEntry } from "@/lib/types";
import { shuffle } from "@/lib/format";
import QuizRunner from "./QuizRunner";
import { useProgress } from "./ProgressProvider";

export default function ReviewClient({ course, pool, sectionNames }: { course: Course; pool: PoolEntry[]; sectionNames: Record<string, string> }) {
  const { p, ready } = useProgress();
  const [run, setRun] = useState<{ key: number; list: PoolEntry[] } | null>(null);
  const prefix = course.id + "/";
  const ids = new Set(Object.keys(p.wrong).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));
  const entries = pool.filter((e) => ids.has(e.q.id));

  if (run) return <QuizRunner key={run.key} courseId={course.id} entries={run.list} mode="practice" exam={course.exam} sectionNames={sectionNames} restartLabel="Volver al repaso" onRestart={() => setRun(null)} />;

  const bySec: Record<string, number> = {};
  entries.forEach((e) => (bySec[e.topic] = (bySec[e.topic] || 0) + 1));
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Aprende de lo que fallas</div>
        <h1 style={{ fontSize: "clamp(48px,7vw,92px)", marginTop: 8 }}>Repaso de errores</h1>
        <p className="muted reading">Aquí se guardan las preguntas que fallaste en tests y simulacros. Cuando aciertes una aquí, sale de la lista.</p>
      </div>
      {!ready ? <div className="empty">Cargando…</div> : entries.length ? (
        <div className="panel stack">
          <div className="row">{Object.entries(bySec).map(([id, n]) => <span key={id} className="pill">{sectionNames[id] || id}: {n}</span>)}</div>
          <div><button className="btn primary" onClick={() => setRun({ key: Date.now(), list: shuffle(entries) })}>Practicar {entries.length} pregunta{entries.length > 1 ? "s" : ""}</button></div>
        </div>
      ) : <div className="empty">No tienes errores pendientes. Haz un test o un simulacro y vuelve aquí.</div>}
    </div>
  );
}
