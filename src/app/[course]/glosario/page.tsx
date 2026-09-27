import Link from "next/link";
import { notFound } from "next/navigation";
import GlossaryClient from "@/components/GlossaryClient";
import { getCourse, getGlossary } from "@/lib/content";

export const metadata = { title: "Glosario" };

export default async function GlosarioPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Glosario</span></nav>
      <GlossaryClient courseId={course.id} terms={getGlossary(course.id)} />
    </div>
  );
}
