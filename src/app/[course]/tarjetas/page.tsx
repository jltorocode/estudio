import Link from "next/link";
import { notFound } from "next/navigation";
import Deck from "@/components/Deck";
import { getCourse, getSections } from "@/lib/content";

export const metadata = { title: "Tarjetas" };

export default async function TarjetasPage({ params }: { params: Promise<{ course: string }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  const cards = getSections(course.id).flatMap((s) => s.flashcards.map((f, i) => ({ ...f, k: `${course.id}/${s.id}#${i}`, secTitle: s.title })));
  return (
    <div className="wrap">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Tarjetas</span></nav>
      <span className="eyebrow">Repaso rápido</span>
      <h1 style={{ fontSize: "clamp(48px,7vw,92px)", margin: "8px 0 26px" }}>Tarjetas</h1>
      <Deck cards={cards} />
    </div>
  );
}
