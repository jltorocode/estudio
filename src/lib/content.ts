import "server-only";
import fs from "fs";
import path from "path";
import { cache } from "react";
import type { Course, PoolEntry, Section, SectionMeta, Term } from "./types";

const ROOT = path.join(process.cwd(), "content");

export const getCourses = cache((): Course[] => JSON.parse(fs.readFileSync(path.join(ROOT, "courses.json"), "utf8")));

export const getCourse = cache((id: string): Course | undefined => getCourses().find((c) => c.id === id));

export const getSection = cache((courseId: string, sectionId: string): Section | undefined => {
  if (!/^[\w-]+$/.test(courseId) || !/^[\w-]+$/.test(sectionId)) return undefined;
  const file = path.join(ROOT, courseId, sectionId + ".json");
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8"));
});

export const getSections = cache((courseId: string): Section[] => {
  const c = getCourse(courseId);
  if (!c) return [];
  return c.sections.map((id) => getSection(courseId, id)).filter((s): s is Section => !!s);
});

export const getSectionMetas = cache((courseId: string): SectionMeta[] =>
  getSections(courseId).map((s) => ({
    id: s.id,
    order: s.order,
    title: s.title,
    domain: s.domain,
    summary: s.summary,
    goal: s.goal,
    lessons: s.lessons.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes, goals: l.goals })),
    labs: (s.labs || []).map((l) => ({ id: l.id, minutes: l.minutes })),
    exercises: (s.exercises || []).map((x) => ({ id: x.id, title: x.title, level: x.level, minutes: x.minutes, ...("kind" in x && x.kind ? { kind: x.kind } : "mode" in x && x.mode ? { kind: `pg-${x.mode}` } : {}) })),
    cards: s.flashcards.length,
    quiz: s.quiz.length
  }))
);

export const getPool = cache((courseId: string): PoolEntry[] =>
  getSections(courseId).flatMap((s) => s.quiz.map((q) => ({ q, sec: s.id, topic: q.topic || s.id })))
);

export const getGlossary = cache((courseId: string) => {
  const map = new Map<string, Term & { sec: string; lesson: string; lessonTitle: string }>();
  for (const s of getSections(courseId))
    for (const l of s.lessons)
      for (const b of l.blocks)
        if (b.type === "terms")
          for (const t of b.items) {
            const k = t.term.replace(/[`*]/g, "").toLowerCase();
            if (!map.has(k)) map.set(k, { ...t, sec: s.id, lesson: l.id, lessonTitle: l.title });
          }
  return [...map.values()].sort((a, b) => a.term.localeCompare(b.term, "es"));
});

export function lessonText(blocks: Section["lessons"][number]["blocks"]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "p": case "h": case "callout": return b.text;
        case "list": return b.items.join("\n");
        case "terms": return b.items.map((t) => `${t.term}: ${t.def}`).join("\n");
        case "table": return [b.head, ...b.rows].map((r) => r.join(" | ")).join("\n");
        case "code": return b.code;
        case "diagram": return b.title || "";
        case "words": return b.items.map((w) => `${w.en}: ${w.es}`).join("\n");
        case "phrases": return b.items.map((p) => `${p.en} — ${p.es}`).join("\n");
        case "dialog": return b.lines.map((l) => `${l.who}: ${l.en} (${l.es})`).join("\n");
        case "pattern": return b.rows.map((r) => r.join(" ")).join("\n");
        case "text": return [b.title || "", ...b.paragraphs.map((p) => `${p.en}\n${p.es}`)].join("\n");
      }
    })
    .join("\n\n");
}

export const getExercise = cache((courseId: string, sectionId: string, exerciseId: string) => {
  const s = getSection(courseId, sectionId);
  const list = s?.exercises || [];
  const i = list.findIndex((x) => x.id === exerciseId);
  return i < 0 ? undefined : { section: s!, exercise: list[i], index: i, prev: list[i - 1], next: list[i + 1] };
});

export const getSectionNames = cache((courseId: string): Record<string, string> =>
  Object.fromEntries(getSections(courseId).map((s) => [s.id, String(s.order).padStart(2, "0") + " · " + s.title]))
);

/* ------------------------------ Curso de inglés ------------------------------ */

/** Grupos del vocabulario de Ogden, en el orden en que se presentan (s11). */
const VOCAB_GROUPS = ["Operaciones", "Cosas generales", "Cosas que se pueden dibujar", "Cualidades generales", "Cualidades opuestas"];

/**
 * Vocabulario para el laboratorio. En el curso de Ghio, las 850 palabras (bloques `words` cuyo título empieza
 * por un grupo de Ogden); en los demás cursos de inglés, todas las palabras de todas las secciones, agrupadas por nivel.
 */
export const getVocab = cache((courseId: string) => {
  const vocab: { en: string; es: string; ipa?: string; fig?: string; group: string }[] = [];
  const seen = new Set<string>();
  const course = getCourse(courseId);
  const ogden = !course?.vocabLabel;
  const levelName = (d: string) => course?.domains.find((x) => x.id === d)?.short || d;
  for (const s of getSections(courseId))
    for (const l of s.lessons)
      for (const b of l.blocks)
        if (b.type === "words") {
          const group = ogden ? (b.title ? VOCAB_GROUPS.find((g) => b.title!.startsWith(g)) : undefined) : levelName(s.domain);
          if (!group) continue;
          for (const w of b.items) {
            const k = w.en.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            vocab.push({ en: w.en, es: w.es, ipa: w.ipa, fig: w.fig, group });
          }
        }
  const groups = ogden ? VOCAB_GROUPS : [...new Set(vocab.map((w) => w.group))];
  return { vocab, groups: groups.filter((g) => vocab.some((w) => w.group === g)), label: course?.vocabLabel || "Las 850 palabras" };
});

/** Todas las frases de ejemplo del curso (para practicar la pronunciación al azar). */
export const getCoursePhrases = cache((courseId: string) =>
  getSections(courseId).flatMap((s) => s.lessons.flatMap((l) => l.blocks.flatMap((b) => (b.type === "phrases" ? b.items.map((p) => ({ en: p.en, es: p.es })) : []))))
);
