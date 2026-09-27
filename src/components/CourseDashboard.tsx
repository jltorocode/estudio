"use client";

import Link from "next/link";
import type { Course, SectionMeta } from "@/lib/types";
import { domainOf, pad2, plain } from "@/lib/format";
import { buildPlan, camps, fmtMin, pendingItems, readiness } from "@/lib/metas";
import { useProgress } from "./ProgressProvider";
import ReadinessCard from "./ReadinessCard";
import Trail from "./Trail";

export default function CourseDashboard({ course, sections, lessonTitles }: { course: Course; sections: SectionMeta[]; lessonTitles: Record<string, string> }) {
  const { p, ready } = useProgress();
  const base = "/" + course.id;
  const t = course.targets;
  const campList = camps(course, sections, p);
  const r = readiness(course, sections, p);
  const plan = p.plans[course.id];
  const items = pendingItems(course, sections, p, plan?.includeLabs ?? true);
  const next = items[0];
  const planRes = plan ? buildPlan(plan, items, course) : null;
  const lessonsDone = sections.reduce((n, s) => n + s.lessons.filter((l) => p.lessons[course.id + "/" + l.id]).length, 0);
  const lessonsTotal = sections.reduce((n, s) => n + s.lessons.length, 0);
  const reached = campList.filter((c) => c.status === "reached").length;
  const cont = p.lastPath && p.lastPath.startsWith(base + "/") ? p.lastPath : null;
  const contLabel = cont ? lessonTitles[cont.split("/")[3]?.split("?")[0]] || course.short?.[cont.split("/")[2]] : null;

  const method = (course.method || []).map((m, i) => ({ ...m, n: pad2(i + 1) }));
  const isCert = course.provider === "Microsoft";

  return (
    <div className="wrap">
      <nav className="crumbs"><Link href="/">Cursos</Link><span>/</span><span>{course.code}</span></nav>

      <header className="summit reveal">
        <div className="summit-title">
          <span className="eyebrow">{course.provider} · {course.level} · Tu expedición</span>
          <div className="code">{course.code}</div>
          <h1>{course.title}</h1>
          <p>{course.blurb}</p>
          <div className="row mono faint" style={{ gap: 18 }}>
            <span><b style={{ color: "var(--ink)" }}>{lessonsDone}</b>/{lessonsTotal} lecciones</span>
            <span><b style={{ color: "var(--ink)" }}>{reached}</b>/{campList.length} campamentos</span>
            <span>{isCert ? "Aprobado" : "Examen final"}: {course.exam.passScore}/{course.exam.maxScore}</span>
          </div>
          <div className="row">
            {cont ? <Link className="btn primary" href={cont}>Continuar: {contLabel}</Link> : <Link className="btn primary" href={`${base}/${sections[0]?.id}`}>Empezar la ruta</Link>}
            <Link className="btn" href={`${base}/plan`}>{plan ? "Ver mi plan" : "Crear mi plan"}</Link>
          </div>
        </div>
        <ReadinessCard r={r} readyAt={t.readyAt} />
      </header>

      {ready && next && (
        <div className="next-step">
          <span className="arrow" aria-hidden="true">→</span>
          <div>
            <span className="eyebrow">Tu siguiente paso · {course.short?.[next.sec] || "Examen"} · {fmtMin(next.minutes)}</span>
            <h3 style={{ marginTop: 4 }}>{next.title}</h3>
            <span className="faint">
              {planRes?.valid
                ? `Quedan ${planRes.daysLeft} días para tu examen. ${planRes.fits ? `Con ${plan!.minutesPerDay} min por día de estudio llegas a tiempo.` : `Necesitas unos ${planRes.neededPerDay} min por día de estudio para llegar.`}`
                : "Pon la fecha de tu examen en «Mi plan» y te diré cuánto estudiar cada día."}
            </span>
          </div>
          <Link className="btn primary" href={next.href}>Empezar</Link>
        </div>
      )}

      <div className="block-title">
        <h2>La ruta</h2>
        <p>
          Cada sección es un campamento. Lo alcanzas al cumplir sus metas: todas las lecciones
          {(t.exercisesPct ?? 0) > 0 ? `, el ${t.exercisesPct} % de los ejercicios` : ""}
          {(t.labsPerSection ?? 0) > 0 ? ", al menos una práctica" : ""} y un {t.sectionTest} % en el test. La cumbre es {isCert ? "el examen" : "dominar el curso"}.
        </p>
      </div>
      <Trail courseId={course.id} code={course.code} camps={campList} readiness={r.total} />

      {method.length > 0 && <div className="block-title">
        <h2>Cómo estudiar aquí</h2>
        <p>Un ciclo de {method.length} pasos por sección. Cada paso tiene su meta para que sepas cuándo has terminado.</p>
      </div>}
      {method.length > 0 && <div className="method" style={{ gridTemplateColumns: `repeat(${method.length}, minmax(0, 1fr))` }}>
        {method.map((m) => (
          <div className="step-m" key={m.n}>
            <span className="n">{m.n}</span>
            <h3>{m.t}</h3>
            <p>{m.d}</p>
            <span className="goal">{m.goal}</span>
          </div>
        ))}
      </div>}

      <div className="block-title">
        <h2>Campamentos</h2>
        <p className="row" style={{ gap: 6 }}>
          <span>{isCert ? "Dominios del examen:" : "Niveles:"}</span>
          {course.domains.filter((d) => d.id !== "extra").map((d) => <span key={d.id} className={"pill " + domainOf(course, d.id).cls}>{d.short || d.name}{d.weight ? ` ${d.weight}` : ""}</span>)}
        </p>
      </div>
      <div className="section-list">
        {sections.map((s, i) => {
          const c = campList[i];
          return (
            <Link key={s.id} className={"sec-row " + c.status} href={`${base}/${s.id}`}>
              <span className="no">{pad2(s.order)}</span>
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}><h3>{s.title}</h3><span className={"pill " + domainOf(course, s.domain).cls}>{domainOf(course, s.domain).label}</span></div>
                <p>{plain(s.goal || s.summary)}</p>
              </div>
              <div className="meta num">
                <span>{c.criteria.filter((x) => x.done).length}/{c.criteria.length} metas · {c.lessonsDone}/{c.lessonsTotal} lecciones</span>
                <div className={"bar" + (c.status === "reached" ? " good" : "")}><i style={{ width: `${c.pct * 100}%` }} /></div>
                <span>{c.status === "reached" ? "✓ Campamento alcanzado" : `Siguiente: ${c.criteria.find((x) => !x.done)?.label.toLowerCase()}`}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
