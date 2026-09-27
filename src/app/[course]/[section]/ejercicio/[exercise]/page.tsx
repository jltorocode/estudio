import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExerciseWorkspace from "@/components/ExerciseWorkspace";
import GitWorkspace from "@/components/GitWorkspace";
import EnglishDrill from "@/components/EnglishDrill";
import PgWorkspace from "@/components/PgWorkspace";
import type { EnglishExercise, Exercise, GitExercise, PgExercise } from "@/lib/types";
import { getCourse, getCourses, getExercise, getSections } from "@/lib/content";
import { pad2 } from "@/lib/format";

type P = { params: Promise<{ course: string; section: string; exercise: string }> };

export function generateStaticParams() {
  return getCourses().flatMap((c) => getSections(c.id).flatMap((s) => (s.exercises || []).map((x) => ({ course: c.id, section: s.id, exercise: x.id }))));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { course, section, exercise } = await params;
  return { title: getExercise(course, section, exercise)?.exercise.title || "Ejercicio" };
}

export default async function ExercisePage({ params }: P) {
  const { course: courseId, section: sectionId, exercise: exerciseId } = await params;
  const course = getCourse(courseId);
  const found = getExercise(courseId, sectionId, exerciseId);
  if (!course || !found || !course.sections.includes(sectionId)) notFound();
  const { section: s, exercise, index, prev, next } = found;
  return (
    <div className="wrap wide">
      <nav className="crumbs">
        <Link href={`/${courseId}`}>{course.code}</Link><span>/</span>
        <Link href={`/${courseId}/${s.id}?tab=ejercicios`}>{pad2(s.order)} · {course.short?.[s.id] || s.title}</Link><span>/</span>
        <span>Ejercicio {index + 1}</span>
      </nav>
      {course.runtime === "git" ? (
        <GitWorkspace
          courseId={courseId}
          sectionId={s.id}
          exercise={exercise as GitExercise}
          index={index}
          total={(s.exercises || []).length}
          prev={prev ? { id: prev.id, title: prev.title } : null}
          next={next ? { id: next.id, title: next.title } : null}
        />
      ) : course.runtime === "postgres" ? (
        <PgWorkspace
          courseId={courseId}
          sectionId={s.id}
          exercise={exercise as PgExercise}
          index={index}
          total={(s.exercises || []).length}
          prev={prev ? { id: prev.id, title: prev.title } : null}
          next={next ? { id: next.id, title: next.title } : null}
        />
      ) : course.runtime === "english" ? (
        <EnglishDrill
          courseId={courseId}
          sectionId={s.id}
          exercise={exercise as EnglishExercise}
          index={index}
          total={(s.exercises || []).length}
          prev={prev ? { id: prev.id, title: prev.title } : null}
          next={next ? { id: next.id, title: next.title } : null}
        />
      ) : (
      <ExerciseWorkspace
        courseId={courseId}
        sectionId={s.id}
        exercise={exercise as Exercise}
        index={index}
        total={(s.exercises || []).length}
        prev={prev ? { id: prev.id, title: prev.title } : null}
        next={next ? { id: next.id, title: next.title } : null}
      />
      )}
    </div>
  );
}
