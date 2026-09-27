// Cálculo de metas: campamentos (hitos por sección), índice de preparación, racha y plan semanal.
import type { Course, Progress, SectionMeta, StudyPlan } from "./types";

const k = (c: Course, id: string) => c.id + "/" + id;

/* ------------------------------ Campamentos ------------------------------ */

export type Criterion = { label: string; done: boolean; detail: string };
export type Camp = {
  id: string;
  order: number;
  short: string;
  title: string;
  lessonsDone: number;
  lessonsTotal: number;
  criteria: Criterion[];
  status: "reached" | "current" | "pending";
  /** Avance de 0 a 1 dentro del campamento. */
  pct: number;
};

/** Nº de simulacros completos (40+ preguntas) consecutivos, contando desde el último, con la nota objetivo o más. */
export function goodExamRun(course: Course, p: Progress) {
  const full = p.exams.filter((e) => e.courseId === course.id && e.total >= 40);
  let n = 0;
  for (let i = full.length - 1; i >= 0 && full[i].score >= course.targets.simulacro; i--) n++;
  return n;
}

export function camps(course: Course, sections: SectionMeta[], p: Progress): Camp[] {
  const t = course.targets;
  const goodExams = goodExamRun(course, p);
  let currentAssigned = false;
  return sections.map((s) => {
    const lessonsDone = s.lessons.filter((l) => p.lessons[k(course, l.id)]).length;
    const labsDone = s.labs.filter((l) => p.labs[k(course, l.id)]).length;
    const exSolved = solvedCount(course, s, p);
    const exNeeded = exercisesNeeded(course, s);
    const best = p.quiz[k(course, s.id)]?.best ?? null;
    const criteria: Criterion[] = [
      { label: "Completar todas las lecciones", done: lessonsDone === s.lessons.length, detail: `${lessonsDone}/${s.lessons.length} lecciones` }
    ];
    if (s.domain === "extra") {
      criteria.push({ label: `${t.simulacros} simulacros completos seguidos con ${t.simulacro}+ puntos`, done: goodExams >= t.simulacros, detail: `${Math.min(goodExams, t.simulacros)}/${t.simulacros} conseguidos` });
    } else {
      const labsGoal = Math.min(t.labsPerSection ?? 1, s.labs.length);
      if (labsGoal > 0) criteria.push({ label: `Hacer al menos ${labsGoal === 1 ? "una" : labsGoal} ${course.labLabel || "práctica"}`, done: labsDone >= labsGoal, detail: `${labsDone}/${s.labs.length} prácticas` });
      if (exNeeded > 0) criteria.push({ label: `Resolver ${exNeeded} de ${s.exercises.length} ejercicios (${t.exercisesPct} %)`, done: exSolved >= exNeeded, detail: `${exSolved}/${s.exercises.length} resueltos` });
      criteria.push({ label: `Sacar ${t.sectionTest} % o más en el test`, done: (best ?? 0) >= t.sectionTest, detail: best == null ? "Test sin hacer" : `Mejor nota: ${best} %` });
    }
    const pct = criteria.filter((c) => c.done).length / criteria.length;
    const reached = criteria.every((c) => c.done);
    let status: Camp["status"] = reached ? "reached" : "pending";
    if (!reached && !currentAssigned) { status = "current"; currentAssigned = true; }
    return { id: s.id, order: s.order, short: course.short?.[s.id] || s.title, title: s.title, lessonsDone, lessonsTotal: s.lessons.length, criteria, status, pct };
  });
}

/** Ejercicios resueltos de una sección. */
export function solvedCount(course: Course, s: SectionMeta, p: Progress) {
  return s.exercises.filter((x) => p.exercises[k(course, x.id)]?.solved).length;
}
/** Ejercicios que hay que resolver para alcanzar el campamento. */
export function exercisesNeeded(course: Course, s: SectionMeta) {
  const pct = course.targets.exercisesPct ?? 0;
  return pct > 0 && s.exercises.length ? Math.ceil((s.exercises.length * pct) / 100) : 0;
}

/* --------------------------- Índice de preparación --------------------------- */

export type ReadinessPart = { key: string; label: string; weight: number; value: number; explain: string };
export type Readiness = { total: number; parts: ReadinessPart[]; level: string; advice: string };

export function readiness(course: Course, sections: SectionMeta[], p: Progress): Readiness {
  const w = course.weights || {};
  const weighted = sections.filter((s) => w[s.id]);
  const W = weighted.reduce((n, s) => n + w[s.id], 0) || 1;
  const coverage = weighted.reduce((n, s) => n + w[s.id] * (s.lessons.length ? s.lessons.filter((l) => p.lessons[k(course, l.id)]).length / s.lessons.length : 0), 0) / W;
  const mastery = weighted.reduce((n, s) => n + w[s.id] * Math.min(1, (p.quiz[k(course, s.id)]?.best ?? 0) / 100), 0) / W;
  const exams = p.exams.filter((e) => e.courseId === course.id && e.total >= 20).slice(-3);
  const avg = exams.length ? exams.reduce((n, e) => n + e.score, 0) / exams.length : 0;
  const sim = Math.min(1, avg / course.targets.simulacro);
  const hasEx = weighted.some((s) => s.exercises.length);
  const practice = hasEx ? weighted.reduce((n, s) => n + w[s.id] * (s.exercises.length ? Math.min(1, solvedCount(course, s, p) / Math.max(1, exercisesNeeded(course, s) || s.exercises.length)) : 0), 0) / W : 0;
  const simExplain = exams.length ? `Media de tus últimos ${exams.length} simulacro${exams.length > 1 ? "s" : ""} (${Math.round(avg)} pts) frente a la meta de ${course.targets.simulacro}.` : `Aún no hay simulacros. La meta es una media de ${course.targets.simulacro} puntos.`;
  const parts: ReadinessPart[] = hasEx
    ? [
        { key: "cov", label: "Cobertura del temario", weight: 0.3, value: coverage, explain: "Lecciones completadas, ponderadas por el peso de cada sección." },
        { key: "exe", label: course.runtime === "english" ? "Práctica (ejercicios)" : "Práctica de código", weight: 0.3, value: practice, explain: `Ejercicios resueltos en cada sección frente a la meta (${course.targets.exercisesPct} %), ponderados por su peso.` },
        { key: "mas", label: "Dominio en los tests", weight: 0.2, value: mastery, explain: "Tu mejor nota en el test de cada sección, ponderada por su peso." },
        { key: "sim", label: "Examen final", weight: 0.2, value: sim, explain: simExplain }
      ]
    : [
        { key: "cov", label: "Cobertura del temario", weight: 0.4, value: coverage, explain: "Lecciones completadas, ponderadas por el peso de cada sección en el examen." },
        { key: "mas", label: "Dominio en los tests", weight: 0.35, value: mastery, explain: "Tu mejor nota en el test de cada sección, también ponderada por su peso." },
        { key: "sim", label: "Simulacros", weight: 0.25, value: sim, explain: simExplain }
      ];
  const total = Math.round(parts.reduce((n, x) => n + x.weight * x.value, 0) * 100);
  const ready = course.targets.readyAt;
  const level = total >= ready ? "Listo para el examen" : total >= 70 ? "Casi listo" : total >= 40 ? "En camino" : "Campo base";
  const weakest = [...parts].sort((a, b) => a.value - b.value)[0];
  const advice =
    total >= ready ? "Reserva el examen: mantén el ritmo con un simulacro cada 2–3 días hasta la fecha."
      : weakest.key === "cov" ? "Lo que más te sube ahora es avanzar lecciones: sigue el orden de la ruta."
        : weakest.key === "exe" ? "Programa más: resuelve los ejercicios de las secciones que ya leíste. Es lo que de verdad te hace experto."
        : weakest.key === "mas" ? "Repite los tests de sección donde no llegas al 80 % y pasa por el repaso de errores."
          : "Haz un simulacro completo: te dirá qué secciones flojean de verdad.";
  return { total, parts, level, advice };
}

/* --------------------------------- Racha --------------------------------- */

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function streak(activity: Record<string, number>, today = new Date()) {
  let current = 0;
  let d = activity[dayKey(today)] ? today : addDays(today, -1);
  while (activity[dayKey(d)]) { current++; d = addDays(d, -1); }
  const days = Object.keys(activity).sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const day of days) {
    run = prev && dayKey(addDays(new Date(prev + "T12:00:00"), 1)) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  const last28 = Array.from({ length: 28 }, (_, i) => { const x = addDays(today, i - 27); const key = dayKey(x); return { key, n: activity[key] || 0, dow: x.getDay() }; });
  return { current, best, last28, today: !!activity[dayKey(today)] };
}

/* ------------------------------ Plan de estudio ------------------------------ */

export type PlanItem = { kind: "lesson" | "cards" | "lab" | "exercise" | "test" | "exam" | "review"; sec: string; title: string; minutes: number; href: string };

export function pendingItems(course: Course, sections: SectionMeta[], p: Progress, includeLabs: boolean): PlanItem[] {
  const base = "/" + course.id;
  const items: PlanItem[] = [];
  for (const s of sections) {
    for (const l of s.lessons) if (!p.lessons[k(course, l.id)]) items.push({ kind: "lesson", sec: s.id, title: l.title, minutes: l.minutes || 12, href: `${base}/${s.id}/${l.id}` });
    if (s.domain === "extra") continue;
    const lessonsDone = s.lessons.every((l) => p.lessons[k(course, l.id)]);
    const testDone = (p.quiz[k(course, s.id)]?.best ?? 0) >= course.targets.sectionTest;
    // Con el campamento consolidado (lecciones + test), las tarjetas pasan a ser repaso opcional
    const unknown = lessonsDone && testDone ? 0 : Array.from({ length: s.cards }, (_, i) => p.cards[k(course, s.id + "#" + i)] !== "known").filter(Boolean).length;
    if (unknown) items.push({ kind: "cards", sec: s.id, title: `Repasar ${unknown} tarjetas`, minutes: Math.max(5, Math.ceil(unknown * 0.4)), href: `${base}/${s.id}?tab=tarjetas` });
    if (includeLabs && (course.targets.labsPerSection ?? 1) > 0 && !s.labs.some((l) => p.labs[k(course, l.id)]) && s.labs[0]) items.push({ kind: "lab", sec: s.id, title: `Una ${course.labLabel || "práctica"}`, minutes: s.labs[0].minutes || 30, href: `${base}/${s.id}?tab=practicas` });
    // Ejercicios de código: los que falten para la meta, en orden de dificultad
    let missing = exercisesNeeded(course, s) - solvedCount(course, s, p);
    for (const x of s.exercises) {
      if (missing <= 0) break;
      if (p.exercises[k(course, x.id)]?.solved) continue;
      items.push({ kind: "exercise", sec: s.id, title: x.title, minutes: x.minutes || 12, href: `${base}/${s.id}/ejercicio/${x.id}` });
      missing--;
    }
    if ((p.quiz[k(course, s.id)]?.best ?? 0) < course.targets.sectionTest) items.push({ kind: "test", sec: s.id, title: `Test de sección (meta ${course.targets.sectionTest} %)`, minutes: Math.ceil(s.quiz * 1.3), href: `${base}/${s.id}?tab=test` });
  }
  const good = goodExamRun(course, p);
  const extraSec = sections.find((s) => s.domain === "extra")?.id || "exam";
  if (Object.keys(p.wrong).some((x) => x.startsWith(course.id + "/"))) items.push({ kind: "review", sec: extraSec, title: "Repaso de errores", minutes: 30, href: `${base}/errores` });
  for (let i = good; i < course.targets.simulacros; i++) items.push({ kind: "exam", sec: extraSec, title: `Simulacro completo ${i + 1} de ${course.targets.simulacros}`, minutes: course.exam.minutes + 15, href: `${base}/simulacro` });
  return items;
}

// Días de estudio según cuántos por semana (0 = domingo)
const PATTERNS: Record<number, number[]> = { 1: [6], 2: [2, 6], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
export const patternLabel = (n: number) => PATTERNS[n].map((d) => ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d]).join(" · ");

export type PlanWeek = { start: string; end: string; minutes: number; bySec: Record<string, { n: number; minutes: number; kinds: string[] }>; milestones: string[] };
export type PlanResult = {
  valid: boolean;
  reason?: string;
  daysLeft: number;
  studyDays: number;
  needed: number;
  capacity: number;
  fits: boolean;
  neededPerDay: number;
  finishDate: string | null;
  weeks: PlanWeek[];
  todayItems: PlanItem[];
  nextStudyDay: string | null;
};

export function buildPlan(plan: StudyPlan, items: PlanItem[], course: Course, today = new Date()): PlanResult {
  const exam = new Date(plan.examDate + "T00:00:00");
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((exam.getTime() - start.getTime()) / 86400000);
  const needed = items.reduce((n, x) => n + x.minutes, 0);
  const empty: PlanResult = { valid: false, daysLeft, studyDays: 0, needed, capacity: 0, fits: false, neededPerDay: 0, finishDate: null, weeks: [], todayItems: [], nextStudyDay: null };
  if (isNaN(exam.getTime())) return { ...empty, reason: "Elige la fecha del examen." };
  if (daysLeft <= 0) return { ...empty, reason: "La fecha del examen ya pasó o es hoy. Elige una fecha futura." };

  const pattern = PATTERNS[Math.min(7, Math.max(1, plan.daysPerWeek))];
  const days: Date[] = [];
  for (let i = 0; i < daysLeft; i++) { const d = addDays(start, i); if (pattern.includes(d.getDay())) days.push(d); }
  const capacity = days.length * plan.minutesPerDay;

  // Reparte las tareas día a día (una tarea puede ocupar varios días)
  const weeks = new Map<string, PlanWeek>();
  const weekOf = (d: Date) => { const m = addDays(d, -((d.getDay() + 6) % 7)); return m; };
  let di = 0, left = plan.minutesPerDay, finishDate: string | null = null;
  const todayItems: PlanItem[] = [];
  const lastItemOfSec = new Map<string, number>();
  items.forEach((it, i) => lastItemOfSec.set(it.sec, i));
  for (let i = 0; i < items.length && di < days.length; i++) {
    const it = items[i];
    let rest = it.minutes;
    while (rest > 0 && di < days.length) {
      const d = days[di];
      const use = Math.min(rest, left);
      const wk = weekOf(d);
      const key = dayKey(wk);
      if (!weeks.has(key)) weeks.set(key, { start: key, end: dayKey(addDays(wk, 6)), minutes: 0, bySec: {}, milestones: [] });
      const w = weeks.get(key)!;
      w.minutes += use;
      const b = (w.bySec[it.sec] ||= { n: 0, minutes: 0, kinds: [] });
      b.minutes += use;
      if (!b.kinds.includes(it.kind)) b.kinds.push(it.kind);
      if (rest === it.minutes) b.n++;
      if (di === 0 && dayKey(d) === dayKey(start) && !todayItems.includes(it)) todayItems.push(it);
      rest -= use;
      left -= use;
      if (rest <= 0) {
        finishDate = dayKey(d);
        if (lastItemOfSec.get(it.sec) === i) w.milestones.push(it.sec);
      }
      if (left <= 0) { di++; left = plan.minutesPerDay; }
    }
  }
  const fits = needed <= capacity;
  return {
    valid: true,
    daysLeft,
    studyDays: days.length,
    needed,
    capacity,
    fits,
    neededPerDay: days.length ? Math.ceil(needed / days.length) : needed,
    finishDate: fits ? finishDate : null,
    weeks: [...weeks.values()],
    todayItems,
    nextStudyDay: days[0] ? dayKey(days[0]) : null
  };
}

export const fmtDate = (key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(key + "T12:00:00").toLocaleDateString("es", opts);

export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? " " + (m % 60) + " min" : ""}`);
