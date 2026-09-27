import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import LessonFooter from "@/components/LessonFooter";
import LessonGoals from "@/components/LessonGoals";
import { getCourse, getCourses, getSection, getSections } from "@/lib/content";
import { fmt, pad2 } from "@/lib/format";

type P = { params: Promise<{ course: string; section: string; lesson: string }> };

export function generateStaticParams() {
  return getCourses().flatMap((c) => getSections(c.id).flatMap((s) => s.lessons.map((l) => ({ course: c.id, section: s.id, lesson: l.id }))));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { course, section, lesson } = await params;
  return { title: getSection(course, section)?.lessons.find((l) => l.id === lesson)?.title || "Lección" };
}

export default async function LessonPage({ params }: P) {
  const { course: courseId, section: sectionId, lesson: lessonId } = await params;
  const course = getCourse(courseId);
  const s = getSection(courseId, sectionId);
  const i = s ? s.lessons.findIndex((l) => l.id === lessonId) : -1;
  if (!course || !s || i < 0 || !course.sections.includes(sectionId)) notFound();
  const l = s.lessons[i];
  const prev = s.lessons[i - 1];
  const next = s.lessons[i + 1];
  return (
    <div className="wrap">
      <nav className="crumbs">
        <Link href={`/${courseId}`}>{course.code}</Link><span>/</span>
        <Link href={`/${courseId}/${s.id}`}>{pad2(s.order)} · {course.short?.[s.id] || s.title}</Link><span>/</span>
        <span>Lección {i + 1} de {s.lessons.length}</span>
      </nav>
      <article className="lesson reading">
        <div className="row" style={{ gap: 10 }}>
          <span className="blaze">{pad2(s.order)}.{i + 1}</span>
          <span className="eyebrow">{l.minutes ? `${l.minutes} min de lectura` : "Lección"}</span>
        </div>
        <h1>{l.title}</h1>
        {l.goals?.length ? <LessonGoals courseId={courseId} lessonId={l.id} goals={l.goals} /> : null}
        <Blocks blocks={l.blocks} ctx={{ course: courseId, section: s.id, lesson: l.id }} />
        {l.takeaways?.length ? (
          <section className="takeaways" aria-label="Lo esencial para el examen">
            <h3>Lo que tienes que llevarte</h3>
            <ol>{l.takeaways.map((t, k) => <li key={k} dangerouslySetInnerHTML={{ __html: fmt(t) }} />)}</ol>
          </section>
        ) : null}
        <LessonFooter
          courseId={courseId}
          sectionId={s.id}
          lessonId={l.id}
          prev={prev ? { id: prev.id, title: prev.title } : null}
          next={next ? { id: next.id, title: next.title } : null}
        />
      </article>
    </div>
  );
}
