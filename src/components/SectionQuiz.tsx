"use client";

import { useState } from "react";
import type { PoolEntry } from "@/lib/types";
import { shuffle } from "@/lib/format";
import QuizRunner from "./QuizRunner";
import { pkey, useProgress } from "./ProgressProvider";

export default function SectionQuiz({ courseId, sectionId, entries, exam, sectionNames }: {
  courseId: string; sectionId: string; entries: PoolEntry[];
  exam: { passScore: number; maxScore: number }; sectionNames: Record<string, string>;
}) {
  const { p } = useProgress();
  const [run, setRun] = useState<{ n: number; list: PoolEntry[] } | null>(null);
  const qz = p.quiz[pkey(courseId, sectionId)];

  if (run) {
    return (
      <QuizRunner
        key={run.n}
        courseId={courseId}
        entries={run.list}
        mode="practice"
        quizKey={sectionId}
        exam={exam}
        sectionNames={sectionNames}
        restartLabel="Repetir test"
        onRestart={() => setRun(null)}
      />
    );
  }
  const start = (limit?: number) => {
    const list = shuffle(entries);
    setRun({ n: Date.now(), list: limit ? list.slice(0, limit) : list });
  };
  return (
    <div className="panel stack" style={{ maxWidth: 640 }}>
      <div className="eyebrow">Test de la sección</div>
      <h3 style={{ fontSize: 22 }}>{entries.length} preguntas estilo examen</h3>
      <p className="muted" style={{ margin: 0 }}>Modo práctica: compruebas cada respuesta al momento y ves la explicación de por qué es correcta o incorrecta. Las que falles pasan a tu repaso de errores. Atajos: teclas A–H para elegir y flechas para moverte.</p>
      {qz && <div className="row faint num"><span>Mejor resultado: <b>{qz.best}%</b></span><span>·</span><span>Último: {qz.last}%</span><span>·</span><span>{qz.attempts} intento{qz.attempts > 1 ? "s" : ""}</span></div>}
      <div className="row">
        <button className="btn primary" onClick={() => start()}>{qz ? "Repetir test" : "Empezar test"}</button>
        <button className="btn" onClick={() => start(10)}>10 preguntas al azar</button>
      </div>
    </div>
  );
}
