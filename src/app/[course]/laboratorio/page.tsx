import Link from "next/link";
import { notFound } from "next/navigation";
import GitLab from "@/components/GitLab";
import EnglishLab from "@/components/EnglishLab";
import PgLab from "@/components/PgLab";
import LabClient from "@/components/LabClient";
import { getCourse, getCoursePhrases, getVocab } from "@/lib/content";

export const metadata = { title: "Laboratorio" };

export default async function LaboratorioPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course || !course.runtime) notFound();
  return (
    <div className="wrap wide">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Laboratorio</span></nav>
      <span className="eyebrow">Práctica libre</span>
      <h1 style={{ fontSize: "clamp(48px,7vw,92px)", margin: "8px 0 20px" }}>Laboratorio</h1>
      {course.runtime === "git" ? <GitLab /> : course.runtime === "postgres" ? <PgLab /> : course.runtime === "english" ? <EnglishLab courseId={course.id} {...getVocab(course.id)} phrases={getCoursePhrases(course.id)} /> : <LabClient courseId={course.id} />}
    </div>
  );
}
