"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Course, SectionMeta } from "@/lib/types";
import { pad2 } from "@/lib/format";
import { camps, streak } from "@/lib/metas";
import { useProgress } from "./ProgressProvider";
import BackupButtons from "./BackupButtons";
import BrandMark from "./BrandMark";

type Theme = "system" | "light" | "dark";

export default function Sidebar({ course, sections }: { course: Course; sections: SectionMeta[] }) {
  const path = usePathname();
  const router = useRouter();
  const { p, status, update, ready } = useProgress();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = "/" + course.id;

  // Recuerda la última página de estudio para "Continuar"
  useEffect(() => {
    if (!ready) return;
    const studyPage = /^\/[\w-]+\/s\d+/.test(path);
    if (studyPage && p.lastPath !== path) update((d) => { d.lastPath = path; }, { track: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ready]);

  const applyTheme = (v: Theme) => {
    try { if (v === "system") localStorage.removeItem("cuaderno-theme"); else localStorage.setItem("cuaderno-theme", v); } catch { /* sin almacenamiento */ }
    if (v === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", v);
  };

  const wrongCount = Object.keys(p.wrong).filter((k) => k.startsWith(course.id + "/")).length;
  const campList = ready ? camps(course, sections, p) : [];
  const st = streak(p.activity);
  const cls = (on: boolean) => "nav-item" + (on ? " active" : "");

  return (
    <>
      <div className="topbar">
        <button className="btn small" onClick={() => setOpen(true)} aria-label="Abrir menú">☰ Menú</button>
        <span className="brand-name">Cuaderno de ruta</span>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={"side" + (open ? " open" : "")} aria-label="Navegación" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        <Link className="brand" href="/" style={{ textDecoration: "none" }}>
          <span className="brand-mark" style={{ color: "var(--side-ink)" }}><BrandMark /></span>
          <span><span className="brand-name">Cuaderno de ruta</span><br /><span className="brand-sub">Certificaciones</span></span>
        </Link>
        <input
          className="search"
          type="search"
          placeholder="Buscar en el curso…"
          aria-label="Buscar en el curso"
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (t.current) clearTimeout(t.current);
            t.current = setTimeout(() => { if (v.trim().length >= 2) router.push(`${base}/buscar?q=${encodeURIComponent(v.trim())}`); }, 350);
          }}
        />
        <Link className="side-streak" href={`${base}/plan`} style={{ textDecoration: "none" }} title="Días seguidos con actividad de estudio">
          <b className="num">{ready ? st.current : "–"}</b>
          <span>{st.current === 1 ? "día seguido" : "días seguidos"} estudiando<br />{st.today ? "Hoy ya has sumado ✓" : "Estudia algo hoy para mantenerla"}</span>
        </Link>
        <nav className="nav-group">
          <div className="nav-title eyebrow">{course.code} · Ruta</div>
          <Link className={cls(path === base)} href={base}>Panel y mapa de ruta</Link>
          {sections.map((s, i) => {
            const c = campList[i];
            const done = s.lessons.filter((l) => p.lessons[course.id + "/" + l.id]).length;
            return (
              <Link key={s.id} className={cls(path.startsWith(`${base}/${s.id}`))} href={`${base}/${s.id}`}>
                <span className={"dot " + (c?.status ?? "")} aria-label={c?.status === "reached" ? "Campamento alcanzado" : c?.status === "current" ? "Campamento actual" : "Pendiente"} />
                <span className="sec-no mono" style={{ fontSize: 11.5, color: "var(--side-ink-2)" }}>{pad2(s.order)}</span>
                <span>{course.short?.[s.id] || s.title}</span>
                <span className="mini">{s.lessons.length ? `${done}/${s.lessons.length}` : ""}</span>
              </Link>
            );
          })}
        </nav>
        <nav className="nav-group">
          <div className="nav-title eyebrow">Metas y práctica</div>
          <Link className={cls(path.startsWith(`${base}/plan`))} href={`${base}/plan`}>Mi plan y metas</Link>
          {course.runtime && <Link className={cls(path.startsWith(`${base}/laboratorio`))} href={`${base}/laboratorio`}>{({ git: "Terminal libre de Git", english: "Laboratorio de inglés", postgres: "Laboratorio de PostgreSQL" } as Record<string, string>)[course.runtime] ?? "Laboratorio de Python"}</Link>}
          <Link className={cls(path.startsWith(`${base}/simulacro`))} href={`${base}/simulacro`}>{course.provider === "Microsoft" ? "Simulacro de examen" : "Examen final"}</Link>
          <Link className={cls(path.startsWith(`${base}/errores`))} href={`${base}/errores`}>Repaso de errores <span className="mini">{wrongCount || ""}</span></Link>
          <Link className={cls(path.startsWith(`${base}/tarjetas`))} href={`${base}/tarjetas`}>Tarjetas mezcladas</Link>
          <Link className={cls(path.startsWith(`${base}/glosario`))} href={`${base}/glosario`}>Glosario</Link>
        </nav>
        <div className="side-foot">
          <div className="theme-switch" role="group" aria-label="Tema">
            {(["system", "light", "dark"] as Theme[]).map((v) => (
              <button key={v} aria-pressed={theme === v} onClick={() => applyTheme(v)}>{v === "system" ? "Auto" : v === "light" ? "Claro" : "Oscuro"}</button>
            ))}
          </div>
          <span>{status === "file" ? "✓ Progreso guardado en data/progress.json" : status === "local" ? "Progreso guardado en este navegador" : "Cargando progreso…"}</span>
          <BackupButtons />
          <a href={course.studyGuideUrl} target="_blank" rel="noopener noreferrer">{course.guideLabel || "Guía oficial"} ↗</a>
        </div>
      </aside>
    </>
  );
}

function readTheme(): Theme {
  const v = document.documentElement.getAttribute("data-theme");
  return v === "light" || v === "dark" ? v : "system";
}
function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
