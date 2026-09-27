export type Block =
  | { type: "p" | "h"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "diagram"; title?: string; mermaid: string; caption?: string }
  | { type: "code"; lang?: string; code: string; caption?: string; run?: boolean; stdin?: string[]; setup?: string; cwd?: string; dataset?: string; database?: string; extra?: string[] }
  | { type: "callout"; variant: "exam" | "tip" | "warn"; text: string }
  | { type: "terms"; items: Term[] }
  // Curso de inglés (todos con audio)
  | { type: "words"; title?: string; items: Word[] }
  | { type: "phrases"; title?: string; items: Phrase[] }
  | { type: "dialog"; title?: string; lines: { who: string; en: string; es: string }[]; caption?: string }
  | { type: "pattern"; title?: string; slots: string[]; rows: string[][]; es?: string[]; caption?: string }
  // Lectura o audición larga: párrafos con audio y traducción tapada, glosario y preguntas de comprensión
  | { type: "text"; title?: string; kind?: "read" | "listen"; level?: string; source?: string; paragraphs: Phrase[]; glossary?: { en: string; es: string }[]; questions?: TextQuestion[]; caption?: string }
  // Curso de PostgreSQL: varias sesiones a la vez (salidas grabadas en PostgreSQL 18)
  | SimBlock;

export type Term = { term: string; en?: string; def: string };

/** Palabra del curso de inglés: `fig` = pronunciación figurada del libro, `ipa` = transcripción fonética. */
export type Word = { en: string; es: string; fig?: string; ipa?: string; note?: string };
export type Phrase = { en: string; es: string; note?: string };
/** Pregunta de comprensión de un bloque `text`: se responde tocando una opción; `explain` justifica la correcta. */
export type TextQuestion = { q: string; options: string[]; answer: number; explain?: string };
/** Meta que se comprueba sola en una producción libre: `any` = patrones (como en `answers`); basta con que aparezca uno. */
export type FreeTarget = { label: string; any: string[] };

export type Lesson = { id: string; title: string; minutes?: number; blocks: Block[]; goals?: string[]; takeaways?: string[] };

export type Lab = {
  id: string;
  title: string;
  goal: string;
  minutes?: number;
  cost?: string;
  prereqs?: string[];
  steps: { title: string; detail: string; code?: string; lang?: string }[];
  verify?: string[];
  cleanup?: string;
  challenge?: string;
};

export type Exercise = {
  id: string;
  title: string;
  level: "facil" | "medio" | "dificil" | "proyecto";
  minutes?: number;
  prompt: string[];
  examples?: { call: string; result: string }[];
  starter: string;
  solution: string;
  setup?: string;
  tests: { name: string; code: string }[];
  hints: string[];
  explain: string;
};

/** Paso de la solución de un ejercicio de Git (con contenido para el editor si Git lo abre). */
export type GitStep = string | { cmd: string; edit?: string | string[] };

export type GitExercise = {
  id: string;
  title: string;
  level: Exercise["level"];
  minutes?: number;
  prompt: string[];
  setup: string;
  cwd: string;
  checks: { name: string; script: string }[];
  solution: GitStep[];
  hints: string[];
  explain: string;
};

/** Ítem de un ejercicio de inglés. `say` = texto en inglés que se escucha; `note` = explicación tras responder. */
export type EnItem =
  | { t: "write"; q: string; say?: string; answers: string[]; lang?: "en" | "es"; strict?: boolean; note?: string }
  | { t: "choice"; q: string; say?: string; options: string[]; answer: number; note?: string }
  | { t: "cloze"; q?: string; text: string; answers: string[][]; say?: boolean; es?: string; note?: string }
  | { t: "order"; q: string; answer: string; answers?: string[]; extra?: string[]; note?: string }
  | { t: "match"; q?: string; pairs: [string, string][]; note?: string }
  | { t: "speak"; q?: string; say: string; es?: string; note?: string }
  /** Producción libre (escribir o hablar): metas que se comprueban solas, respuesta modelo y rúbrica de autoevaluación. */
  | { t: "free"; mode: "write" | "speak"; q: string; say?: string; minWords?: number; maxWords?: number; targets?: FreeTarget[]; model: string; modelEs?: string; rubric: string[]; note?: string };

export type EnglishExercise = {
  id: string;
  title: string;
  level: Exercise["level"];
  minutes?: number;
  kind: "vocabulario" | "gramatica" | "traduccion" | "dictado" | "pronunciacion" | "conversacion" | "examen" | "mixto" | "lectura" | "audicion" | "escritura" | "expresion";
  prompt: string[];
  items: EnItem[];
  /** % de aciertos a la primera para darlo por resuelto (por defecto 80). */
  pass?: number;
  hints?: string[];
  explain: string;
  /** De dónde sale (p. ej. «Libro, pág. 16: examen de la primera lección»). */
  source?: string;
};

export type Question =
  | { id: string; type: "single" | "multi"; q: string; options: string[]; answer: number[]; explain: string; topic?: string; say?: string }
  | { id: string; type: "yesno"; q: string; statements: { text: string; answer: boolean }[]; explain: string; topic?: string; say?: string };

export type Section = {
  id: string;
  order: number;
  title: string;
  /** Id de un dominio del curso (p. ej. "concepts", "basico"); "extra" = preparación del examen final. */
  domain: string;
  summary: string;
  /** Meta de la sección en una frase. */
  goal?: string;
  objectives: string[];
  lessons: Lesson[];
  flashcards: { front: string; back: string; say?: string }[];
  labs: Lab[];
  exercises?: (Exercise | GitExercise | EnglishExercise | PgExercise)[];
  quiz: Question[];
  sources: { title: string; url: string }[];
};

export type Course = {
  id: string;
  code: string;
  title: string;
  provider: string;
  level: string;
  blurb: string;
  officialUrl: string;
  studyGuideUrl: string;
  domains: { id: string; name: string; short?: string; weight: string }[];
  exam: { minutes: number; questions: number; passScore: number; maxScore: number };
  sections: string[];
  /** Nombre corto de cada sección para el mapa de ruta. */
  short: Record<string, string>;
  /** Peso aproximado de cada sección en el examen (suma ≈ 1). */
  weights: Record<string, number>;
  targets: {
    sectionTest: number;
    simulacro: number;
    simulacros: number;
    readyAt: number;
    /** % de ejercicios resueltos para alcanzar un campamento (0 = no aplica). */
    exercisesPct?: number;
    /** Prácticas guiadas necesarias por sección (0 = no aplica). */
    labsPerSection?: number;
  };
  /** "python" si el curso ejecuta código en el navegador. */
  runtime?: "python" | "git" | "english" | "postgres";
  guideLabel?: string;
  labLabel?: string;
  /** Texto de introducción de la pestaña de prácticas. */
  labIntro?: string;
  method?: { t: string; d: string; goal: string }[];
  /** Curso de inglés: nombre del vocabulario en el laboratorio (por defecto, las 850 palabras de Ogden). */
  vocabLabel?: string;
};

/** Resumen ligero de una sección para la navegación. */
export type SectionMeta = {
  id: string;
  order: number;
  title: string;
  domain: Section["domain"];
  summary: string;
  goal?: string;
  lessons: { id: string; title: string; minutes?: number; goals?: string[] }[];
  labs: { id: string; minutes?: number }[];
  exercises: { id: string; title: string; level: Exercise["level"]; minutes?: number; kind?: string }[];
  cards: number;
  quiz: number;
};

/** Pregunta con su sección y tema para tests y simulacros. */
export type PoolEntry = { q: Question; sec: string; topic: string };

export type Progress = {
  v: 1;
  lessons: Record<string, number>;
  labs: Record<string, number>;
  steps: Record<string, 1>;
  cards: Record<string, "known" | "again">;
  quiz: Record<string, { best: number; last: number; attempts: number; at: number }>;
  exams: {
    id: string;
    courseId: string;
    at: number;
    score: number;
    pct: number;
    total: number;
    passed: boolean;
    bySec: Record<string, [number, number]>;
  }[];
  wrong: Record<string, { n: number; at: number }>;
  lastPath?: string;
  /** Plan de estudio por curso. */
  plans: Record<string, StudyPlan>;
  /** Días con actividad ("AAAA-MM-DD" → nº de acciones). */
  activity: Record<string, number>;
  /** Objetivos de lección que marcaste como logrados ("curso/leccion#i"). */
  goals: Record<string, 1>;
  /** Ejercicios de código ("curso/ejercicio"). */
  exercises: Record<string, ExerciseProgress>;
  /** Código del laboratorio libre por curso. */
  lab: Record<string, string>;
  /** Repetición espaciada del vocabulario ("curso/w/palabra" → [caja, día de repaso]). */
  srs?: Record<string, [number, number]>;
};

export type ExerciseProgress = { solved: boolean; at: number; attempts: number; code?: string; sawSolution?: boolean; hints?: number; best?: number };

export type StudyPlan = { examDate: string; daysPerWeek: number; minutesPerDay: number; includeLabs: boolean };

/** Paso de una simulación de sesiones: lo que se escribe en una sesión y lo que responde PostgreSQL. */
export type SimStep = {
  s: string;
  in: string;
  prompt?: string;
  out?: string;
  /** La orden quedó esperando (un bloqueo). */
  wait?: boolean;
  /** Sesiones que estaban esperando y terminan tras este paso. */
  wake?: { s: string; out: string }[];
  note?: string;
  /** Pregunta para predecir antes de ver la salida. */
  ask?: string;
};

export type SimBlock = {
  type: "sessions";
  title?: string;
  caption?: string;
  kind?: "psql" | "shell";
  /** Nombres internos de las sesiones (p. ej. ["A", "B"]). */
  sessions: string[];
  /** Nombres visibles (p. ej. ["Sesión A · caja", "Sesión B · bodega"]). */
  labels?: string[];
  /** Sesiones que son una terminal (bash) en vez de psql. */
  shells?: string[];
  /** Cómo se conecta cada sesión de psql (argumentos de psql; por defecto, la base del bloque). */
  connect?: Record<string, string>;
  dataset?: string;
  database?: string;
  setup?: string;
  steps: SimStep[];
  /** Fecha de la grabación (la pone el grabador). */
  recorded?: string;
};

/** Ejercicio de PostgreSQL (se practica con PostgreSQL 18 simulado en el navegador). */
export type PgCheck = { name: string; sql: string; fail?: string; database?: string };
export type PgExercise = {
  id: string;
  title: string;
  level: Exercise["level"];
  minutes?: number;
  /** query: consulta comparada con la solución · script: sentencias + comprobaciones · psql: consola interactiva + comprobaciones. */
  mode: "query" | "script" | "psql";
  prompt: string[];
  dataset?: string;
  database?: string;
  setup?: string;
  extra?: string[];
  user?: string;
  files?: Record<string, string>;
  starter?: string;
  solution: string | string[];
  ordered?: boolean;
  columns?: boolean;
  checks?: PgCheck[];
  requires?: { pattern: string; flags?: string; msg: string; name?: string }[];
  hints: string[];
  explain: string;
};
