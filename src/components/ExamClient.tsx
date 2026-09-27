"use client";

import { useState } from "react";
import type { Course, PoolEntry } from "@/lib/types";
import { shuffle } from "@/lib/format";
import QuizRunner from "./QuizRunner";
import { useProgress } from "./ProgressProvider";

// Reparte las preguntas según el peso de cada sección en el examen (course.weights).
function buildExam(pool: PoolEntry[], n: number, weights: Record<string, number>) {
  const byTopic: Record<string, PoolEntry[]> = {};
  pool.forEach((e) => (byTopic[e.topic] ||= []).push(e));
  const picked: PoolEntry[] = [];
  const used = new Set<string>();
  for (const [t, w] of Object.entries(weights))
    for (const e of shuffle(byTopic[t] || []).slice(0, Math.round(n * w))) { picked.push(e); used.add(e.q.id); }
  for (const e of shuffle(pool)) { if (picked.length >= n) break; if (!used.has(e.q.id)) { picked.push(e); used.add(e.q.id); } }
  return shuffle(picked.slice(0, n));
}

export default function ExamClient({ course, pool, sectionNames }: { course: Course; pool: PoolEntry[]; sectionNames: Record<string, string> }) {
  const { p } = useProgress();
  const [run, setRun] = useState<{ key: number; list: PoolEntry[]; minutes: number } | null>(null);
  const exams = p.exams.filter((e) => e.courseId === course.id);
  const cert = course.provider === "Microsoft";
  const noun = cert ? "simulacro" : "examen";

  if (run) {
    return <QuizRunner key={run.key} courseId={course.id} entries={run.list} mode="exam" minutes={run.minutes} exam={course.exam} sectionNames={sectionNames} restartLabel={cert ? "Volver al simulacro" : "Volver al examen final"} onRestart={() => setRun(null)} />;
  }
  const start = (n: number, minutes: number) => { setRun({ key: Date.now(), list: buildExam(pool, n, course.weights || {}), minutes }); window.scrollTo(0, 0); };

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Condiciones de examen</div>
        <h1 style={{ fontSize: "clamp(48px,7vw,92px)", marginTop: 8 }}>{cert ? "Simulacro" : "Examen final"}</h1>
        <p className="muted reading">Preguntas mezcladas de todo el temario, repartidas según el peso de cada área. Con cronómetro, sin ver las respuestas hasta entregar y con la opción de marcar preguntas para revisarlas. Banco actual: {pool.length} preguntas.</p>
        <div className="callout exam" style={{ maxWidth: 760 }}><span className="lbl">Tu meta</span><div>Para dar por conquistada la cumbre: <b>{course.targets.simulacros} {cert ? "simulacros completos" : "exámenes completos"} seguidos con {course.targets.simulacro} puntos o más</b>. Se aprueba con {course.exam.passScore}, pero {cert ? "entrenar con margen te protege de los nervios y de las preguntas que no esperas" : "sacar 850+ dos veces seguidas demuestra que lo dominas de verdad, no por suerte"}.</div></div>
      </div>
      <div className="grid-2">
        <div className="panel stack">
          <span className="eyebrow">Completo</span>
          <h3 style={{ fontSize: 22 }}>{course.exam.questions} preguntas · {course.exam.minutes} min</h3>
          <p className="muted" style={{ margin: 0 }}>{cert ? "Parecido al examen real." : "Preguntas de todo el curso repartidas por peso."} Hazlo cuando hayas terminado todas las secciones.</p>
          <div><button className="btn primary" onClick={() => start(course.exam.questions, course.exam.minutes)}>Empezar {noun} completo</button></div>
        </div>
        <div className="panel stack">
          <span className="eyebrow">Rápido</span>
          <h3 style={{ fontSize: 22 }}>20 preguntas · 18 min</h3>
          <p className="muted" style={{ margin: 0 }}>Para medirte a mitad del estudio o repasar en poco tiempo.</p>
          <div><button className="btn" onClick={() => start(20, 18)}>Empezar {noun} rápido</button></div>
        </div>
      </div>
      <div className="panel stack">
        <div className="spread"><span className="eyebrow">Tu historial</span><span className="faint num">{exams.length} intento{exams.length === 1 ? "" : "s"}</span></div>
        {exams.length ? (
          <>
            <Spark exams={exams} pass={course.exam.passScore} max={course.exam.maxScore} />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Preguntas</th><th>Puntuación</th><th>Resultado</th></tr></thead>
                <tbody>
                  {exams.slice().reverse().slice(0, 15).map((e) => (
                    <tr key={e.id}>
                      <td className="num">{new Date(e.at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="num">{e.total}</td>
                      <td className="num"><b>{e.score}</b></td>
                      <td>{e.passed ? <span className="pill good">Aprobado</span> : <span className="pill bad">No aprobado</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <div className="empty">Aún no has hecho ningún {noun}.</div>}
      </div>
    </div>
  );
}

function Spark({ exams, pass, max }: { exams: { score: number; passed: boolean; id: string }[]; pass: number; max: number }) {
  const W = 560, H = 90, pad = 18;
  const xs = (i: number) => pad + (exams.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (exams.length - 1));
  const ys = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evolución de tus simulacros">
      <line x1={pad} x2={W - pad} y1={ys(pass)} y2={ys(pass)} stroke="var(--amber)" strokeDasharray="4 4" strokeWidth="1" />
      <text x={W - pad} y={ys(pass) - 4} textAnchor="end" fontSize="10" fill="var(--amber)">{pass}</text>
      <polyline points={exams.map((e, i) => `${xs(i)},${ys(e.score)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {exams.map((e, i) => <circle key={e.id} cx={xs(i)} cy={ys(e.score)} r={i === exams.length - 1 ? 4.5 : 3} fill={e.passed ? "var(--good)" : "var(--bad)"} />)}
    </svg>
  );
}
