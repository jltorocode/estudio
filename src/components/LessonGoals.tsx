"use client";

import { fmt } from "@/lib/format";
import { pkey, useProgress } from "./ProgressProvider";

/** Objetivos de la lección con autoevaluación: los marcas cuando puedes hacerlo sin mirar. */
export default function LessonGoals({ courseId, lessonId, goals }: { courseId: string; lessonId: string; goals: string[] }) {
  const { p, update } = useProgress();
  const keyOf = (i: number) => pkey(courseId, lessonId + "#" + i);
  const done = goals.filter((_, i) => p.goals[keyOf(i)]).length;
  return (
    <section className="lesson-goals" aria-label="Objetivos de la lección">
      <header>
        <h3>Al terminar podrás</h3>
        <span className="pill num">{done}/{goals.length} logrados</span>
      </header>
      <ul>
        {goals.map((g, i) => {
          const on = !!p.goals[keyOf(i)];
          return (
            <li key={i} className={on ? "done" : ""}>
              <label>
                <input type="checkbox" checked={on} onChange={() => update((d) => { const k = keyOf(i); if (d.goals[k]) delete d.goals[k]; else d.goals[k] = 1; })} />
                <span dangerouslySetInnerHTML={{ __html: fmt(g) }} />
              </label>
            </li>
          );
        })}
      </ul>
      <footer>Márcalos al final, cuando puedas hacerlo sin mirar. Si alguno no te sale, vuelve a esa parte de la lección antes de seguir.</footer>
    </section>
  );
}
