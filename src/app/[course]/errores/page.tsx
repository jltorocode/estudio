import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewClient from "@/components/ReviewClient";
import { getCourse, getPool, getSectionNames } from "@/lib/content";

export const metadata = { title: "Repaso de errores" };

export default async function ErroresPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Repaso de errores</span></nav>
      <ReviewClient course={course} pool={getPool(course.id)} sectionNames={getSectionNames(course.id)} />
    </div>
  );
}
