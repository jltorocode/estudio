import Link from "next/link";
import { notFound } from "next/navigation";
import PlanClient from "@/components/PlanClient";
import { getCourse, getSectionMetas } from "@/lib/content";

export const metadata = { title: "Mi plan y metas" };

export default async function PlanPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Mi plan y metas</span></nav>
      <PlanClient course={course} sections={getSectionMetas(course.id)} />
    </div>
  );
}
