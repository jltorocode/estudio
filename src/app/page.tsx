import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { getCourses, getPool, getSectionMetas } from "@/lib/content";

export default function Catalog() {
  const courses = getCourses();
  return (
    <main className="main topo" style={{ minHeight: "100%" }}>
      <div className="wrap">
        <header className="catalog-hero reveal">
          <div className="row" style={{ gap: 12, color: "var(--ink)" }}>
            <span className="brand-mark"><BrandMark /></span>
            <span className="eyebrow">Cuaderno de ruta · uso personal</span>
          </div>
          <h1 style={{ marginTop: 18 }}>Mis cumbres</h1>
          <p>Cada certificación es una expedición: una ruta de campamentos con metas claras, un plan con fecha y un simulacro final antes de la cumbre.</p>
        </header>
        <div className="grid-2 reveal">
          {courses.map((c) => {
            const secs = getSectionMetas(c.id);
            const lessons = secs.reduce((n, s) => n + s.lessons.length, 0);
            return (
              <Link key={c.id} className="panel course-card" href={`/${c.id}`}>
                <span className="eyebrow">{c.provider} · {c.level}</span>
                <div className="code-badge">{c.code}</div>
                <h3 style={{ fontSize: 20 }}>{c.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{c.blurb}</p>
                <div className="row faint mono num"><span>{secs.length} campamentos</span><span>·</span><span>{lessons} lecciones</span><span>·</span><span>{getPool(c.id).length} preguntas</span></div>
                <span className="btn primary" style={{ alignSelf: "flex-start" }}>Abrir la ruta →</span>
              </Link>
            );
          })}
          <div className="panel course-card add">
            <span className="eyebrow">Próxima expedición</span>
            <h3 style={{ fontSize: 20 }}>Añadir otro curso</h3>
            <p className="muted" style={{ margin: 0 }}>
              Cada curso es una carpeta en <code className="inline-code">content/</code> con un JSON por sección y una entrada en{" "}
              <code className="inline-code">content/courses.json</code>. El formato está en <code className="inline-code">content/ESQUEMA.md</code>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
