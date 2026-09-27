"use client";

import type { Course, SectionMeta } from "@/lib/types";
import { fmt } from "@/lib/format";
import { camps } from "@/lib/metas";
import { useProgress } from "./ProgressProvider";

/** Tarjeta con la meta de la sección y las metas del campamento, con su estado real. */
export default function SectionGoal({ course, meta }: { course: Course; meta: SectionMeta }) {
  const { p } = useProgress();
  const camp = camps(course, [meta], p)[0];
  const left = camp.criteria.filter((c) => !c.done).length;
  return (
    <aside className="goal-card" aria-label="Meta de la sección">
      <div className="goal-top">
        <span className="eyebrow">Meta de la sección</span>
        <p dangerouslySetInnerHTML={{ __html: fmt(meta.goal || meta.summary) }} />
      </div>
      <ul className="criteria">
        {camp.criteria.map((c) => (
          <li key={c.label} className={c.done ? "done" : ""}>
            <span className="tick" aria-hidden="true">✓</span>
            <span>{c.label}<small>{c.detail}</small></span>
          </li>
        ))}
      </ul>
      <div className={"camp-state " + (left ? "open" : "reached")}>
        {left ? `Te ${left === 1 ? "falta 1 meta" : `faltan ${left} metas`} para alcanzar este campamento` : "✓ Campamento alcanzado"}
      </div>
    </aside>
  );
}
