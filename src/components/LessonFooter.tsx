"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { pkey, useProgress } from "./ProgressProvider";

type L = { id: string; title: string } | null;

export default function LessonFooter({ courseId, sectionId, lessonId, prev, next }: { courseId: string; sectionId: string; lessonId: string; prev: L; next: L }) {
  const { p, update } = useProgress();
  const router = useRouter();
  const k = pkey(courseId, lessonId);
  const done = !!p.lessons[k];
  const markDone = () => update((d) => { d.lessons[k] = d.lessons[k] || Date.now(); });
  const base = `/${courseId}/${sectionId}`;
  return (
    <div className="lesson-foot">
      {prev ? <Link className="btn" href={`${base}/${prev.id}`}>← {prev.title}</Link> : <Link className="btn" href={base}>← Índice de la sección</Link>}
      <div className="row">
        <button className={"btn" + (done ? "" : " primary")} onClick={() => update((d) => { if (d.lessons[k]) delete d.lessons[k]; else d.lessons[k] = Date.now(); })}>
          {done ? "✓ Completada" : "Marcar como completada"}
        </button>
        {next
          ? <button className="btn" onClick={() => { markDone(); router.push(`${base}/${next.id}`); }}>Siguiente →</button>
          : <button className="btn" onClick={() => { markDone(); router.push(`${base}?tab=test`); }}>Ir al test de la sección →</button>}
      </div>
    </div>
  );
}
