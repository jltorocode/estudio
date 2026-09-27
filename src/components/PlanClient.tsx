"use client";

import Link from "next/link";
import { useState } from "react";
import type { Course, SectionMeta, StudyPlan } from "@/lib/types";
import { buildPlan, camps, dayKey, fmtDate, fmtMin, patternLabel, pendingItems, readiness, streak, type PlanItem } from "@/lib/metas";
import { useProgress } from "./ProgressProvider";

const KIND: Record<PlanItem["kind"], string> = { lesson: "lecciones", cards: "tarjetas", lab: "práctica", exercise: "ejercicios", test: "test", exam: "simulacros", review: "repaso de errores" };

export default function PlanClient({ course, sections }: { course: Course; sections: SectionMeta[] }) {
  const { p, update, ready } = useProgress();
  const saved = p.plans[course.id];
  const [draft, setDraft] = useState<StudyPlan>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return { examDate: dayKey(d), daysPerWeek: 5, minutesPerDay: 60, includeLabs: true };
  });
  const plan = saved || draft;
  const set = (patch: Partial<StudyPlan>) => {
    if (saved) update((d) => { d.plans[course.id] = { ...saved, ...patch }; }, { track: false });
    else setDraft({ ...draft, ...patch });
  };

  const items = pendingItems(course, sections, p, plan.includeLabs);
  const res = buildPlan(plan, items, course);
  const st = streak(p.activity);
  const r = readiness(course, sections, p);
  const campList = camps(course, sections, p);
  const todayKey = dayKey(new Date());
  const label = (sec: string) => (sections.find((s) => s.id === sec)?.domain === "extra" ? "Preparación final" : course.short?.[sec] || sec);

  if (!ready) return <div className="empty">Cargando tu plan…</div>;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="reveal">
        <span className="eyebrow">Tus metas</span>
        <h1 style={{ fontSize: "clamp(48px, 7vw, 92px)", marginTop: 8 }}>Mi plan</h1>
        <p className="muted reading" style={{ fontSize: 17.5 }}>
          Dime cuándo es tu examen y cuánto tiempo puedes dedicarle. Reparto todo lo que te queda por hacer en tus días de estudio, en el orden de la ruta, y te digo si llegas a tiempo. El plan se recalcula solo cada vez que avanzas.
        </p>
      </div>

      <div className="plan-grid">
        <div className="stack">
          <section className="panel stack" aria-label="Datos del plan">
            <span className="eyebrow">Tu disponibilidad</span>
            <label className="field">Fecha del examen
              <input type="date" value={plan.examDate} min={todayKey} onChange={(e) => set({ examDate: e.target.value })} />
              <small>Si aún no lo has reservado, pon una fecha objetivo realista.</small>
            </label>
            <label className="field">Días de estudio por semana
              <select value={plan.daysPerWeek} onChange={(e) => set({ daysPerWeek: +e.target.value })}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? "día" : "días"} ({patternLabel(n)})</option>)}
              </select>
            </label>
            <label className="field">Minutos por día de estudio
              <select value={plan.minutesPerDay} onChange={(e) => set({ minutesPerDay: +e.target.value })}>
                {[20, 30, 45, 60, 75, 90, 120, 150, 180].map((n) => <option key={n} value={n}>{fmtMin(n)}</option>)}
              </select>
            </label>
            {(course.targets.labsPerSection ?? 1) > 0 && (
              <label className="check-line">
                <input type="checkbox" checked={plan.includeLabs} onChange={(e) => set({ includeLabs: e.target.checked })} />
                Incluir una {course.labLabel || "práctica"} por sección
              </label>
            )}
            {!saved ? (
              <button className="btn primary" onClick={() => update((d) => { d.plans[course.id] = draft; }, { track: false })}>Guardar mi plan</button>
            ) : (
              <span className="faint">✓ Plan guardado. Los cambios se guardan al momento.</span>
            )}
          </section>

          <section className="panel stack" aria-label="Racha de estudio">
            <div className="spread"><span className="eyebrow">Racha de estudio</span><span className="faint mono">Mejor: {st.best} días</span></div>
            <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
              <b style={{ font: "900 64px/0.9 var(--display)" }} className="num">{st.current}</b>
              <span className="muted">{st.current === 1 ? "día seguido" : "días seguidos"}{st.today ? " · hoy ✓" : ""}</span>
            </div>
            <div className="streak-strip" aria-label="Actividad de los últimos 28 días">
              {st.last28.map((d) => <i key={d.key} title={`${fmtDate(d.key)}: ${d.n} acciones`} className={(d.n >= 12 ? "l3" : d.n >= 5 ? "l2" : d.n > 0 ? "l1" : "") + (d.key === todayKey ? " today" : "")} />)}
            </div>
            <span className="faint">Cuenta como estudio cualquier avance: completar una lección, marcar objetivos o pasos de una práctica, repasar tarjetas o terminar un test.</span>
          </section>
        </div>

        <div className="stack">
          {!res.valid ? (
            <div className="verdict-box ko"><h3>Revisa la fecha</h3><p style={{ margin: 0 }}>{res.reason}</p></div>
          ) : items.length === 0 ? (
            <div className="verdict-box ok"><h3>Todo hecho</h3><p style={{ margin: 0 }}>Has completado la ruta y los simulacros. Mantén la forma con un simulacro cada 2–3 días hasta el examen.</p></div>
          ) : res.fits ? (
            <div className="verdict-box ok">
              <h3>Llegas a tiempo</h3>
              <p style={{ margin: 0 }}>Estudiando {fmtMin(plan.minutesPerDay)} al día, {plan.daysPerWeek} {plan.daysPerWeek === 1 ? "día" : "días"} por semana, terminas todo el {res.finishDate ? fmtDate(res.finishDate, { weekday: "long", day: "numeric", month: "long" }) : "—"}, antes del examen ({fmtDate(plan.examDate, { day: "numeric", month: "long" })}). Te sobran {fmtMin(res.capacity - res.needed)} de margen para repasar.</p>
            </div>
          ) : (
            <div className="verdict-box ko">
              <h3>No llegas con este ritmo</h3>
              <p style={{ margin: 0 }}>Te faltan {fmtMin(res.needed - res.capacity)}. Para llegar, sube a unos <b>{fmtMin(res.neededPerDay)} por día de estudio</b>, añade días a la semana o mueve la fecha del examen.</p>
            </div>
          )}

          {res.valid && (
            <div className="kpis">
              <div><b>{res.daysLeft}</b><span>días hasta el examen</span></div>
              <div><b>{res.studyDays}</b><span>días de estudio en tu plan</span></div>
              <div><b>{Math.round(res.needed / 60)}<small style={{ fontSize: 18 }}> h</small></b><span>de trabajo pendiente</span></div>
              <div><b>{r.total}<small style={{ fontSize: 18 }}> %</small></b><span>preparación actual (meta {course.targets.readyAt} %)</span></div>
            </div>
          )}

          {res.valid && items.length > 0 && (
            <section className="panel stack" aria-label="Qué hacer hoy">
              <div className="spread">
                <span className="eyebrow">{res.todayItems.length ? `Hoy · meta de ${fmtMin(plan.minutesPerDay)}` : "Hoy"}</span>
                {st.today && <span className="pill good">Hoy ya has estudiado</span>}
              </div>
              {res.todayItems.length ? (
                <div className="today-list">
                  {res.todayItems.map((it, i) => (
                    <Link key={i} href={it.href}>
                      <span><b>{it.title}</b><br /><span className="faint">{label(it.sec)} · {KIND[it.kind]}</span></span>
                      <span className="faint mono">{fmtMin(it.minutes)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>Hoy es día de descanso según tu plan. Próximo día de estudio: {res.nextStudyDay ? fmtDate(res.nextStudyDay, { weekday: "long", day: "numeric", month: "long" }) : "—"}. Si te apetece, adelanta con las tarjetas.</p>
              )}
            </section>
          )}

          {res.valid && res.weeks.length > 0 && (
            <section aria-label="Calendario semana a semana">
              <div className="block-title" style={{ marginTop: 10 }}><h2 style={{ fontSize: 34 }}>Semana a semana</h2></div>
              <div className="weeks">
                {res.weeks.map((w, i) => {
                  const now = todayKey >= w.start && todayKey <= w.end;
                  return (
                    <div className={"week" + (now ? " now" : "")} key={w.start}>
                      <span className="eyebrow">{now ? "Esta semana" : `Semana ${i + 1}`} · {fmtMin(w.minutes)}</span>
                      <h4>{fmtDate(w.start)} – {fmtDate(w.end)}</h4>
                      <div className="wk-items">
                        {Object.entries(w.bySec).map(([sec, b]) => (
                          <span className="wk-item" key={sec}><b>{label(sec)}</b> · {b.kinds.map((k) => KIND[k as PlanItem["kind"]]).join(", ")}</span>
                        ))}
                      </div>
                      {w.milestones.map((m) => {
                        const c = campList.find((x) => x.id === m);
                        return <span className="milestone" key={m}>▲ {sections.find((s) => s.id === m)?.domain === "extra" ? "Listo para la cumbre" : `Campamento ${c ? String(c.order).padStart(2, "0") : ""} · ${label(m)}`}</span>;
                      })}
                    </div>
                  );
                })}
                <div className="week now" style={{ paddingBottom: 0 }}>
                  <span className="eyebrow">Cumbre</span>
                  <h4>Examen {course.code} · {fmtDate(plan.examDate, { weekday: "long", day: "numeric", month: "long" })}</h4>
                </div>
              </div>
            </section>
          )}

          <details className="panel">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>¿Cómo se calcula el plan?</summary>
            <ul className="muted" style={{ marginBottom: 0 }}>
              <li>Tomo todo lo que te queda en el orden de la ruta: cada lección con su duración, las tarjetas que aún no dominas (≈ 0,4 min por tarjeta){(course.targets.exercisesPct ?? 0) > 0 ? `, los ejercicios${course.runtime === "english" ? "" : " de código"} que te faltan para el ${course.targets.exercisesPct} % de cada sección` : ""}{(course.targets.labsPerSection ?? 1) > 0 ? ", una práctica por sección si las incluyes" : ""}, el test si no llegas al {course.targets.sectionTest} %, el repaso de errores y los simulacros que te falten para la meta ({course.targets.simulacros} seguidos con {course.targets.simulacro}+).</li>
              <li>Lo reparto en tus días de estudio ({patternLabel(plan.daysPerWeek)}) hasta el día antes del examen, con {fmtMin(plan.minutesPerDay)} por día.</li>
              <li>Cuando una sección termina dentro de una semana, verás el hito del campamento en esa semana.</li>
              <li>Se recalcula solo cada vez que avanzas o cambias tu disponibilidad.</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
