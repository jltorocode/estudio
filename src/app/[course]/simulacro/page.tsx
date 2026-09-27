import Link from "next/link";
import { notFound } from "next/navigation";
import ExamClient from "@/components/ExamClient";
import { getCourse, getPool, getSectionNames } from "@/lib/content";

export const metadata = { title: "Simulacro" };

export default async function SimulacroPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Simulacro</span></nav>
      <ExamClient course={course} pool={getPool(course.id)} sectionNames={getSectionNames(course.id)} />
    </div>
  );
}
