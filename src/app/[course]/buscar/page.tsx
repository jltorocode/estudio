import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, getSections, lessonText } from "@/lib/content";
import { esc, plain } from "@/lib/format";

export const metadata = { title: "Buscar" };

export default async function BuscarPage({ params, searchParams }: { params: Promise<{ course: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const course = getCourse((await params).course);
  if (!course) notFound();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw || "").trim();
  const ql = q.toLowerCase();
  const hits: { sec: string; secTitle: string; id: string; title: string; snip: string }[] = [];
  if (ql.length >= 2) {
    for (const s of getSections(course.id))
      for (const l of s.lessons) {
        const txt = plain(l.title + "\n" + lessonText(l.blocks));
        const pos = txt.toLowerCase().indexOf(ql);
        if (pos >= 0) {
          const start = Math.max(0, pos - 70);
          hits.push({ sec: s.id, secTitle: s.title, id: l.id, title: l.title, snip: (start ? "…" : "") + txt.slice(start, pos + ql.length + 90).replace(/\s+/g, " ") + "…" });
        }
      }
  }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
  const hl = (t: string) => (q ? esc(t).replace(re, (m) => `<mark>${m}</mark>`) : esc(t));
  return (
    <div className="wrap stack">
      <nav className="crumbs"><Link href={`/${course.id}`}>{course.code}</Link><span>/</span><span>Buscar</span></nav>
      <h1 style={{ fontSize: "clamp(36px,5vw,60px)" }}>Resultados para “{q}”</h1>
      <div className="search-results">
        {hits.length ? hits.map((h) => (
          <Link key={h.id} className="search-hit" href={`/${course.id}/${h.sec}/${h.id}`}>
            <b>{h.title}</b> <small>· {h.secTitle}</small><br />
            <span className="muted" dangerouslySetInnerHTML={{ __html: hl(h.snip) }} />
          </Link>
        )) : <div className="empty">{ql.length < 2 ? "Escribe al menos 2 letras." : "No hay coincidencias."}</div>}
      </div>
    </div>
  );
}
