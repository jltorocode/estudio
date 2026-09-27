"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Lab, PoolEntry, SectionMeta } from "@/lib/types";
import { fmt } from "@/lib/format";
import Deck, { type Card } from "./Deck";
import ExercisesTab from "./ExercisesTab";
import Labs from "./Labs";
import SectionQuiz from "./SectionQuiz";
import { pkey, useProgress } from "./ProgressProvider";

type Props = {
  courseId: string;
  meta: SectionMeta;
  labs: Lab[];
  cards: Card[];
  quiz: PoolEntry[];
  sources: { title: string; url: string }[];
  exam: { passScore: number; maxScore: number };
  sectionNames: Record<string, string>;
  exercisesPct?: number;
  labIntro?: string;
  /** Cómo se practica en el curso ("python", "git", "english"…): cambia el rótulo de los ejercicios. */
  runtime?: string;
};

const TABS = [["lecciones", "Lecciones"], ["ejercicios", "Ejercicios"], ["practicas", "Prácticas"], ["tarjetas", "Tarjetas"], ["test", "Test"], ["fuentes", "Fuentes"]] as const;

export default function SectionTabs({ courseId, meta, labs, cards, quiz, sources, exam, sectionNames, exercisesPct = 0, labIntro, runtime }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const { p } = useProgress();
  const tab = sp.get("tab") || "lecciones";
  const counts: Record<string, number> = { lecciones: meta.lessons.length, ejercicios: meta.exercises.length, practicas: labs.length, tarjetas: cards.length, test: quiz.length, fuentes: sources.length };
  // Solo se muestran las pestañas con contenido (un curso de Python no tiene prácticas en la nube; uno de Azure no tiene ejercicios de código)
  const tabs = TABS.filter(([id]) => id === "lecciones" || id === "test" || counts[id] > 0);

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={"tab" + (tab === id ? " active" : "")}
            onClick={() => router.replace(`/${courseId}/${meta.id}${id === "lecciones" ? "" : "?tab=" + id}`, { scroll: false })}>
            {label}<span className="count">{counts[id]}</span>
          </button>
        ))}
      </div>
      {tab === "lecciones" && (
        <div className="lesson-list">
          {meta.lessons.map((l, i) => {
            const done = !!p.lessons[pkey(courseId, l.id)];
            const goals = l.goals || [];
            const achieved = goals.filter((_, k) => p.goals[pkey(courseId, l.id + "#" + k)]).length;
            return (
              <Link key={l.id} className="lesson-item" href={`/${courseId}/${meta.id}/${l.id}`}>
                <span className={"check" + (done ? " on" : "")} aria-label={done ? "Completada" : "Pendiente"}>✓</span>
                <span>
                  <b>{i + 1}. {l.title}</b>
                  {goals[0] && <span className="goals-mini" dangerouslySetInnerHTML={{ __html: "Podrás: " + fmt(goals[0].charAt(0).toLowerCase() + goals[0].slice(1)) }} />}
                  <span className="faint mono">{l.minutes ? `${l.minutes} min` : ""}{goals.length ? ` · objetivos ${achieved}/${goals.length}` : ""}</span>
                </span>
                <span className="faint">Abrir →</span>
              </Link>
            );
          })}
        </div>
      )}
      {tab === "ejercicios" && <ExercisesTab courseId={courseId} meta={meta} pct={exercisesPct} runtime={runtime} />}
      {tab === "practicas" && <Labs courseId={courseId} labs={labs} intro={labIntro} />}
      {tab === "tarjetas" && <Deck cards={cards} />}
      {tab === "test" && <SectionQuiz courseId={courseId} sectionId={meta.id} entries={quiz} exam={exam} sectionNames={sectionNames} />}
      {tab === "fuentes" && (
        <ul className="stack" style={{ paddingLeft: 18 }}>
          {sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><br /><span className="faint">{s.url}</span></li>)}
        </ul>
      )}
    </>
  );
}
