import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getCourse, getCourses, getSectionMetas } from "@/lib/content";

export function generateStaticParams() {
  return getCourses().map((c) => ({ course: c.id }));
}

export default async function CourseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ course: string }> }) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();
  return (
    <div className="app">
      <Sidebar course={course} sections={getSectionMetas(course.id)} />
      <div>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
