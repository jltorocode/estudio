import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CourseDashboard from "@/components/CourseDashboard";
import { getCourse, getSectionMetas } from "@/lib/content";

type P = { params: Promise<{ course: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = getCourse((await params).course);
  return { title: c ? c.code : "Curso" };
}

export default async function CoursePage({ params }: P) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  const sections = getSectionMetas(course.id);
  const lessonTitles = Object.fromEntries(sections.flatMap((s) => s.lessons.map((l) => [l.id, l.title])));
  return <CourseDashboard course={course} sections={sections} lessonTitles={lessonTitles} />;
}
