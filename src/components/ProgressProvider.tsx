"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Progress } from "@/lib/types";

const LS_KEY = "cuaderno-progress-v1";
export const blankProgress = (): Progress => ({ v: 1, lessons: {}, labs: {}, steps: {}, cards: {}, quiz: {}, exams: [], wrong: {}, plans: {}, activity: {}, goals: {}, exercises: {}, lab: {} });

/** Fecha local en formato AAAA-MM-DD. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Status = "loading" | "file" | "local";
type Ctx = {
  p: Progress;
  ready: boolean;
  status: Status;
  /** Aplica un cambio. Por defecto cuenta como actividad de estudio de hoy (para la racha). */
  update: (mutate: (draft: Progress) => void, opts?: { track?: boolean }) => void;
  replaceMerged: (incoming: Progress) => void;
};

const ProgressContext = createContext<Ctx | null>(null);

export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = blankProgress();
  out.lessons = { ...b.lessons, ...a.lessons };
  out.labs = { ...b.labs, ...a.labs };
  out.steps = { ...b.steps, ...a.steps };
  out.cards = { ...b.cards, ...a.cards };
  out.quiz = { ...b.quiz };
  for (const [k, v] of Object.entries(a.quiz)) {
    const r = out.quiz[k];
    out.quiz[k] = !r ? v : { best: Math.max(r.best, v.best), last: v.at > r.at ? v.last : r.last, attempts: Math.max(r.attempts, v.attempts), at: Math.max(r.at, v.at) };
  }
  const ex = new Map<string, Progress["exams"][number]>();
  [...b.exams, ...a.exams].forEach((e) => ex.set(e.id, e));
  out.exams = [...ex.values()].sort((x, y) => x.at - y.at).slice(-100);
  out.wrong = { ...b.wrong };
  for (const [k, v] of Object.entries(a.wrong)) if (!out.wrong[k] || v.at > out.wrong[k].at) out.wrong[k] = v;
  out.lastPath = a.lastPath || b.lastPath;
  out.plans = { ...b.plans, ...a.plans };
  out.goals = { ...b.goals, ...a.goals };
  out.lab = { ...b.lab, ...a.lab };
  out.exercises = { ...b.exercises };
  for (const [k, v] of Object.entries(a.exercises)) {
    const r = out.exercises[k];
    out.exercises[k] = !r ? v : { ...(v.at >= r.at ? v : r), solved: v.solved || r.solved, attempts: Math.max(v.attempts, r.attempts), sawSolution: v.sawSolution || r.sawSolution };
    if (r && (v.best != null || r.best != null)) out.exercises[k].best = Math.max(v.best ?? 0, r.best ?? 0);
  }
  // Repetición espaciada: gana el repaso programado más tarde (el más reciente)
  out.srs = { ...(b.srs || {}) };
  for (const [k, v] of Object.entries(a.srs || {})) if (!out.srs[k] || v[1] >= out.srs[k][1]) out.srs[k] = v;
  out.activity = { ...b.activity };
  for (const [k, v] of Object.entries(a.activity)) out.activity[k] = Math.max(out.activity[k] || 0, v);
  return out;
}

const normalize = (x: unknown): Progress | null => {
  if (!x || typeof x !== "object" || (x as Progress).v !== 1) return null;
  return { ...blankProgress(), ...(x as Progress) };
};

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState<Progress>(blankProgress);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(p);

  useEffect(() => {
    let local: Progress | null = null;
    try { local = normalize(JSON.parse(localStorage.getItem(LS_KEY) || "null")); } catch { /* sin almacenamiento local */ }
    fetch("/api/progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((remote) => {
        const fromFile = normalize(remote);
        const merged = fromFile && local ? mergeProgress(local, fromFile) : fromFile || local || blankProgress();
        latest.current = merged;
        setP(merged);
        setStatus("file");
      })
      .catch(() => {
        const v = local || blankProgress();
        latest.current = v;
        setP(v);
        setStatus("local");
      })
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Progress) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento local */ }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch("/api/progress", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(latest.current) })
        .then((r) => setStatus(r.ok ? "file" : "local"))
        .catch(() => setStatus("local"));
    }, 700);
  }, []);

  const update = useCallback((mutate: (draft: Progress) => void, opts?: { track?: boolean }) => {
    const next: Progress = structuredClone(latest.current);
    mutate(next);
    if (opts?.track !== false) {
      const k = dayKey();
      next.activity[k] = (next.activity[k] || 0) + 1;
    }
    latest.current = next;
    setP(next);
    persist(next);
  }, [persist]);

  const replaceMerged = useCallback((incoming: Progress) => {
    const next = mergeProgress(latest.current, { ...blankProgress(), ...incoming });
    latest.current = next;
    setP(next);
    persist(next);
  }, [persist]);

  return <ProgressContext.Provider value={{ p, ready, status, update, replaceMerged }}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress fuera de ProgressProvider");
  return ctx;
}

export const pkey = (courseId: string, id: string) => courseId + "/" + id;
