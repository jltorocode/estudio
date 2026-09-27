import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SectionGoal from "@/components/SectionGoal";
import SectionTabs from "@/components/SectionTabs";
import { getCourse, getCourses, getSection, getSectionMetas, getSectionNames } from "@/lib/content";
import { domainOf, fmt, pad2 } from "@/lib/format";

type P = { params: Promise<{ course: string; section: string }> };

export function generateStaticParams() {
  return getCourses().flatMap((c) => c.sections.map((s) => ({ course: c.id, section: s })));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { course, section } = await params;
  return { title: getSection(course, section)?.title || "Sección" };
}

export default async function SectionPage({ params }: P) {
  const { course: courseId, section: sectionId } = await params;
  const course = getCourse(courseId);
  const s = getSection(courseId, sectionId);
  if (!course || !s || !course.sections.includes(sectionId)) notFound();
  const meta = getSectionMetas(courseId).find((m) => m.id === s.id)!;
  const dom = domainOf(course, s.domain);
  const cards = s.flashcards.map((f, i) => ({ ...f, k: `${courseId}/${s.id}#${i}` }));
  const quiz = s.quiz.map((q) => ({ q, sec: s.id, topic: q.topic || s.id }));
  const minutes = s.lessons.reduce((n, l) => n + (l.minutes || 0), 0);
  const weight = course.weights?.[s.id];

  return (
    <div className="wrap">
      <nav className="crumbs"><Link href="/">Cursos</Link><span>/</span><Link href={`/${courseId}`}>{course.code}</Link><span>/</span><span>Campamento {pad2(s.order)}</span></nav>
      <div className="sec-head reveal">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <span className="blaze">{pad2(s.order)}</span>
            <span className={"pill " + dom.cls}>{dom.name}{dom.weight ? ` · ${dom.weight}` : ""}</span>
            {weight ? <span className="pill">≈ {Math.round(weight * 100)} % del {course.provider === "Microsoft" ? "examen" : "examen final"}</span> : null}
          </div>
          <h1>{s.title}</h1>
          <p className="summary" dangerouslySetInnerHTML={{ __html: fmt(s.summary) }} />
          <div className="row mono faint" style={{ marginTop: 14, gap: 16 }}>
            <span>{s.lessons.length} lecciones · {minutes} min</span>
            {s.exercises?.length ? <span>{s.exercises.length} ejercicios</span> : null}
            {s.labs?.length ? <span>{s.labs.length} prácticas</span> : null}
            <span>{s.flashcards.length} tarjetas</span>
            <span>{s.quiz.length} preguntas</span>
          </div>
          {s.objectives.length > 0 && (
            <details className="official">
              <summary>{course.provider === "Microsoft" ? "Objetivos oficiales de Microsoft que cubre" : "Resultados de aprendizaje"} ({s.objectives.length})</summary>
              <ul className="objectives">{s.objectives.map((o, i) => <li key={i} dangerouslySetInnerHTML={{ __html: fmt(o) }} />)}</ul>
            </details>
          )}
        </div>
        <SectionGoal course={course} meta={meta} />
      </div>
      <Suspense fallback={<div className="empty">Cargando…</div>}>
        <SectionTabs courseId={courseId} meta={meta} labs={s.labs || []} cards={cards} quiz={quiz} sources={s.sources} exam={course.exam} sectionNames={getSectionNames(courseId)} exercisesPct={course.targets.exercisesPct ?? 0} labIntro={course.labIntro} runtime={course.runtime} />
      </Suspense>
    </div>
  );
}
