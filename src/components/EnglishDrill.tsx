"use client";

// Ejercicio del curso de inglés: una serie de ítems con corrección inmediata. Los fallos vuelven al final
// hasta acertarlos; el resultado es el % de aciertos a la primera.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EnItem, EnglishExercise } from "@/lib/types";
import { canonical, expand, fillCloze, gaps, grade, speechScore, tiles, type DiffPart, type Grade } from "@/lib/english";
import { fmt, fmtBlock, levelLabel, shuffle } from "@/lib/format";
import { getPrefs, hasMic, listen, record, speak, stopSpeaking } from "@/lib/speech";
import { IconMic, IconSpeaker, IconStop, Say, VoiceMenu } from "./EnVoice";
import { pkey, useProgress } from "./ProgressProvider";

type Nav = { id: string; title: string } | null;
type Props = { courseId: string; sectionId: string; exercise: EnglishExercise; index: number; total: number; prev: Nav; next: Nav };

/** Resultado de un intento: correcto, verificado por el alumno, u omitido (no cuenta). */
type Outcome = { ok: boolean; skipped?: boolean; requeue?: boolean; grade?: Grade; user?: string; expected?: string; say?: string; msg?: string };

export const KIND_LABEL: Record<EnglishExercise["kind"], string> = {
  vocabulario: "Vocabulario", gramatica: "Gramática", traduccion: "Traducción", dictado: "Dictado", pronunciacion: "Pronunciación",
  conversacion: "Conversación", examen: "Examen del libro", mixto: "Desafío"
};
const ITEM_LABEL: Record<EnItem["t"], string> = { write: "escribir", choice: "elegir", cloze: "completar", order: "ordenar", match: "unir", speak: "pronunciar" };

export default function EnglishDrill(props: Props) {
  const { ready } = useProgress();
  if (!ready) return <div className="empty">Cargando tu ejercicio…</div>;
  return <Drill key={props.exercise.id} {...props} />;
}

function Drill({ courseId, sectionId, exercise: x, index, total, prev, next }: Props) {
  const { p, update } = useProgress();
  const key = pkey(courseId, x.id);
  const saved = p.exercises[key];
  const pass = x.pass ?? 80;
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [queue, setQueue] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [first, setFirst] = useState<Record<number, boolean | "skip">>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const [result, setResult] = useState<{ pct: number; ok: boolean } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of x.items) c[it.t] = (c[it.t] || 0) + 1;
    return Object.entries(c).map(([t, n]) => `${n} de ${ITEM_LABEL[t as EnItem["t"]]}`).join(" · ");
  }, [x.items]);
  const audio = x.items.some((it) => ("say" in it && it.say) || it.t === "speak" || it.t === "match");

  const start = () => {
    setQueue(x.items.map((_, i) => i));
    setPos(0);
    setFirst({});
    setOutcome(null);
    setResult(null);
    setAttemptKey((k) => k + 1);
    setPhase("run");
  };

  const itemIdx = queue[pos];
  const item = x.items[itemIdx];
  const done = Object.keys(first).length;

  const answer = (o: Outcome) => {
    if (outcome) return;
    setOutcome(o);
    setFirst((f) => (itemIdx in f ? f : { ...f, [itemIdx]: o.skipped ? "skip" : o.ok }));
    if (!o.ok && !o.skipped && o.requeue !== false) setQueue((q) => [...q, itemIdx]);
  };

  /** El alumno dice que su respuesta también era correcta: cuenta como acierto y no se repite. */
  const override = () => {
    if (!outcome || outcome.ok) return;
    setOutcome({ ...outcome, ok: true, msg: "Anotado como correcta. Si de verdad lo era, el contenido tenía que haberla aceptado." });
    // Solo cambia el resultado «a la primera» si este era el primer intento del ítem
    if (pos < x.items.length) setFirst((f) => ({ ...f, [itemIdx]: f[itemIdx] === false ? true : f[itemIdx] }));
    setQueue((q) => { const i = q.lastIndexOf(itemIdx); return i > pos ? [...q.slice(0, i), ...q.slice(i + 1)] : q; });
  };

  const finish = (firstMap: Record<number, boolean | "skip">) => {
    const counted = Object.values(firstMap).filter((v) => v !== "skip");
    const pct = counted.length ? Math.round((counted.filter((v) => v === true).length / counted.length) * 100) : 100;
    const ok = pct >= pass;
    setResult({ pct, ok });
    setPhase("done");
    update((d) => {
      const cur = d.exercises[key];
      d.exercises[key] = { solved: (cur?.solved ?? false) || ok, at: Date.now(), attempts: (cur?.attempts ?? 0) + 1, best: Math.max(cur?.best ?? 0, pct) };
    });
  };

  const advance = () => {
    stopSpeaking();
    if (pos + 1 >= queue.length) return finish(first);
    setPos(pos + 1);
    setOutcome(null);
    setAttemptKey((k) => k + 1);
  };

  // Intro / resultado
  if (phase === "intro") {
    return (
      <div className="drill-shell">
        <DrillHeader x={x} index={index} total={total} solved={!!saved?.solved} />
        <div className="drill-card">
          <div className="ex-prompt" dangerouslySetInnerHTML={{ __html: x.prompt.map((par) => fmtBlock(par)).join("") }} />
          {x.hints?.length ? (
            <div className="callout tip"><span className="lbl">Antes de empezar</span><ul style={{ margin: 0, paddingLeft: 18 }}>{x.hints.map((h, i) => <li key={i} dangerouslySetInnerHTML={{ __html: fmt(h) }} />)}</ul></div>
          ) : null}
          <p className="faint" style={{ margin: 0 }}>
            {x.items.length} ítems ({counts}). Se da por resuelto con <b>{pass} %</b> de aciertos a la primera; los que falles vuelven al final hasta que los aciertes.
            {x.source ? <> Fuente: {x.source}.</> : null}
          </p>
          {saved?.best != null && <p className="faint" style={{ margin: 0 }}>Tu mejor resultado: <b>{saved.best} %</b> · {saved.attempts} intento{saved.attempts === 1 ? "" : "s"}.</p>}
          <div className="row">
            <button className="btn primary" onClick={start} autoFocus>{saved?.attempts ? "Empezar otra vez" : "Empezar"} →</button>
            {audio && <VoiceMenu />}
          </div>
          {audio && <p className="faint" style={{ margin: 0 }}>Este ejercicio tiene audio: sube el volumen o usa audífonos.</p>}
        </div>
        <DrillNav courseId={courseId} sectionId={sectionId} prev={prev} next={next} />
      </div>
    );
  }

  if (phase === "done" && result) {
    const missed = x.items.map((it, i) => ({ it, i })).filter(({ i }) => first[i] === false);
    return (
      <div className="drill-shell">
        <DrillHeader x={x} index={index} total={total} solved={!!p.exercises[key]?.solved} />
        <div className={"drill-card drill-result " + (result.ok ? "ok" : "ko")}>
          <div className="score-ring" style={{ ["--pct" as string]: result.pct }}><b className="num">{result.pct} %</b><span>a la primera</span></div>
          <div className="stack" style={{ gap: 8 }}>
            <h2 style={{ margin: 0 }}>{result.ok ? (result.pct === 100 ? "¡Perfecto!" : "¡Resuelto!") : "Casi. Vuelve a intentarlo"}</h2>
            <p className="muted" style={{ margin: 0 }}>{result.ok ? `Superaste el ${pass} % necesario.` : `Necesitas ${pass} % de aciertos a la primera. Repasa los fallos de abajo y repite: la segunda vuelta siempre va mejor.`}</p>
          </div>
        </div>
        <div className="drill-card">
          <span className="eyebrow">Lo que practicaste</span>
          <div className="ex-explain" dangerouslySetInnerHTML={{ __html: fmtBlock(x.explain) }} />
          {missed.length > 0 && (
            <>
              <span className="eyebrow">Para repasar ({missed.length})</span>
              <ul className="missed">
                {missed.map(({ it, i }) => <li key={i}><ItemSummary it={it} /></li>)}
              </ul>
            </>
          )}
          <div className="row">
            <button className="btn" onClick={start}>↺ Repetir</button>
            {next ? <Link className="btn primary" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>Siguiente: {next.title} →</Link> : <Link className="btn primary" href={`/${courseId}/${sectionId}?tab=test`}>Ir al test de la sección →</Link>}
          </div>
        </div>
        <DrillNav courseId={courseId} sectionId={sectionId} prev={prev} next={next} />
      </div>
    );
  }

  if (!item) return null;
  const retry = pos >= x.items.length;
  return (
    <div className="drill-shell">
      <div className="drill-top">
        <button className="btn small ghost" onClick={() => { stopSpeaking(); setPhase("intro"); }} aria-label="Salir del ejercicio">✕</button>
        <div className="bar good drill-bar" aria-label={`${done} de ${x.items.length}`}><i style={{ width: `${(done / x.items.length) * 100}%` }} /></div>
        <span className="faint num">{Math.min(done + (outcome ? 0 : 1), x.items.length)}/{x.items.length}</span>
        <VoiceMenu />
      </div>
      <div className="drill-card drill-item" key={attemptKey}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill">{ITEM_LABEL[item.t]}</span>
          {retry && <span className="pill bad">repaso de un fallo</span>}
        </div>
        <ItemView item={item} outcome={outcome} onAnswer={answer} />
        {outcome && <Feedback item={item} o={outcome} onOverride={override} onNext={advance} last={pos + 1 >= queue.length} />}
      </div>
    </div>
  );
}

/* -------------------------------- Cabeceras -------------------------------- */

function DrillHeader({ x, index, total, solved }: { x: EnglishExercise; index: number; total: number; solved: boolean }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className={"blaze lvl-" + x.level}>{levelLabel(x.level)}</span>
        <span className="pill">{KIND_LABEL[x.kind]}</span>
        <span className="eyebrow">Ejercicio {index + 1} de {total}{x.minutes ? ` · ${x.minutes} min` : ""}</span>
        {solved && <span className="pill good">✓ Resuelto</span>}
      </div>
      <h1 className="ex-title">{x.title}</h1>
    </div>
  );
}

function DrillNav({ courseId, sectionId, prev, next }: { courseId: string; sectionId: string; prev: Nav; next: Nav }) {
  return (
    <div className="lesson-foot" style={{ marginTop: 8 }}>
      {prev ? <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${prev.id}`}>← {prev.title}</Link> : <Link className="btn" href={`/${courseId}/${sectionId}?tab=ejercicios`}>← Todos los ejercicios</Link>}
      {next && <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>{next.title} →</Link>}
    </div>
  );
}

/** Resumen de un ítem para la lista de repaso. */
function ItemSummary({ it }: { it: EnItem }) {
  switch (it.t) {
    case "write": return <><span dangerouslySetInnerHTML={{ __html: fmt(it.q) }} /> → <b lang={it.lang === "es" ? "es" : "en"}>{canonical(it.answers[0])}</b>{it.lang !== "es" && <Say text={canonical(it.answers[0])} />}</>;
    case "choice": return <><span dangerouslySetInnerHTML={{ __html: fmt(it.q) }} /> → <b>{it.options[it.answer]}</b>{it.say && <Say text={it.say} />}</>;
    case "cloze": { const t = fillCloze(it.text, it.answers); return <><b lang="en">{t}</b><Say text={t} />{it.es && <span className="faint"> · {it.es}</span>}</>; }
    case "order": return <><span dangerouslySetInnerHTML={{ __html: fmt(it.q) }} /> → <b lang="en">{it.answer}</b><Say text={it.answer} /></>;
    case "match": return <>{it.pairs.map(([a, b]) => `${a} = ${b}`).join(" · ")}</>;
    case "speak": return <><b lang="en">{it.say}</b><Say text={it.say} slow />{it.es && <span className="faint"> · {it.es}</span>}</>;
  }
}

/* -------------------------------- Retroalimentación -------------------------------- */

function DiffLine({ parts }: { parts: DiffPart[] }) {
  if (!parts.length) return null;
  return (
    <span className="diff" aria-label="Diferencias con la respuesta correcta">
      {parts.map((d, i) => <span key={i} className={"d-" + d.k} title={d.k === "miss" ? "Falta" : d.k === "extra" ? "Sobra o está mal" : undefined}>{d.t}</span>)}
    </span>
  );
}

function Feedback({ item, o, onOverride, onNext, last }: { item: EnItem; o: Outcome; onOverride: () => void; onNext: () => void; last: boolean }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  const verdict = o.grade?.verdict;
  const title = o.skipped ? "Omitido" : o.ok ? (verdict === "typo" ? "¡Correcto! (ojo con un detalle)" : "¡Correcto!") : verdict === "close" ? "Casi… revisa una letra" : "No es correcto";
  const canOverride = !o.ok && !o.skipped && (item.t === "write" || item.t === "cloze" || item.t === "order");
  const note = item.note;
  return (
    <div className={"feedback " + (o.skipped ? "skip" : o.ok ? "ok" : "ko")} role="status" aria-live="polite">
      <b className="fb-title">{o.ok && !o.skipped ? "✓ " : o.skipped ? "" : "✗ "}{title}</b>
      {o.msg && <p>{o.msg}</p>}
      {verdict === "typo" && o.ok && (
        <p>{item.t === "write" && item.lang === "es" ? "Revisa las tildes: " : "Revisa la ortografía (los apóstrofos): "}<b>{o.expected}</b></p>
      )}
      {!o.ok && o.expected && (
        <p className="fb-answer">
          <span className="faint">Respuesta correcta:</span> <b>{o.expected}</b>
          {o.say && <Say text={o.say} slow />}
        </p>
      )}
      {o.ok && o.say && verdict !== "typo" && o.expected && o.user && o.expected.toLowerCase().replace(/[^\p{L}\s']/gu, "").trim() !== o.user.toLowerCase().replace(/[^\p{L}\s']/gu, "").trim() && (
        <p className="faint">También se dice: <b>{o.expected}</b></p>
      )}
      {!o.ok && o.grade && o.user && <p className="fb-diff"><span className="faint">Tu respuesta comparada:</span> <DiffLine parts={o.grade.diff} /></p>}
      {o.ok && o.say && <p className="row" style={{ gap: 6, margin: 0 }}><span className="faint">Escúchala:</span><Say text={o.say} slow /></p>}
      {note && <p className="fb-note" dangerouslySetInnerHTML={{ __html: fmt(note) }} />}
      <div className="row">
        <button ref={btn} className="btn primary" onClick={onNext}>{last ? "Ver resultado" : "Continuar"} →</button>
        {canOverride && <button className="btn small ghost" onClick={onOverride} title="Si tu respuesta también era válida">Mi respuesta también es correcta</button>}
      </div>
    </div>
  );
}

/* ---------------------------------- Ítems ---------------------------------- */

type ItemProps<T extends EnItem["t"]> = { item: Extract<EnItem, { t: T }>; outcome: Outcome | null; onAnswer: (o: Outcome) => void };

function ItemView({ item, outcome, onAnswer }: { item: EnItem; outcome: Outcome | null; onAnswer: (o: Outcome) => void }) {
  switch (item.t) {
    case "write": return <WriteItem item={item} outcome={outcome} onAnswer={onAnswer} />;
    case "choice": return <ChoiceItem item={item} outcome={outcome} onAnswer={onAnswer} />;
    case "cloze": return <ClozeItem item={item} outcome={outcome} onAnswer={onAnswer} />;
    case "order": return <OrderItem item={item} outcome={outcome} onAnswer={onAnswer} />;
    case "match": return <MatchItem item={item} outcome={outcome} onAnswer={onAnswer} />;
    case "speak": return <SpeakItem item={item} outcome={outcome} onAnswer={onAnswer} />;
  }
}

const Q = ({ text }: { text: string }) => <div className="drill-q" dangerouslySetInnerHTML={{ __html: fmtBlock(text) }} />;

/** Botones «Comprobar» y «No lo sé». */
function Actions({ onCheck, onSkip, disabled, answered }: { onCheck: () => void; onSkip: () => void; disabled?: boolean; answered: boolean }) {
  if (answered) return null;
  return (
    <div className="row">
      <button className="btn primary" onClick={onCheck} disabled={disabled}>Comprobar</button>
      <button className="btn ghost" onClick={onSkip}>No lo sé</button>
    </div>
  );
}

const ACCENTS = ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"];

function WriteItem({ item, outcome, onAnswer }: ItemProps<"write">) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const lang = item.lang || "en";
  const expectedEn = lang === "en" ? canonical(item.answers[0]) : undefined;
  useEffect(() => { ref.current?.focus(); }, []);
  const check = () => {
    if (!v.trim()) return;
    const g = grade(v, item.answers, { lang, strict: item.strict });
    onAnswer({ ok: g.correct, grade: g, user: v, expected: g.expected, say: lang === "en" ? g.expected : item.say });
  };
  const skip = () => {
    const g = grade("", item.answers, { lang });
    onAnswer({ ok: false, grade: g, user: "", expected: g.expected, say: lang === "en" ? expectedEn : item.say });
  };
  const insert = (c: string) => {
    const el = ref.current;
    if (!el) return setV(v + c);
    const a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length;
    const nv = v.slice(0, a) + c + v.slice(b);
    setV(nv);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + c.length, a + c.length); });
  };
  const st = outcome ? (outcome.ok ? " ok" : " ko") : "";
  return (
    <>
      <Q text={item.q} />
      {item.say && (
        <div className="listen-box">
          <Say text={item.say} slow big autoPlay label="Escuchar" />
          <span className="faint">Puedes escucharlo las veces que quieras; el botón de la tortuga lo dice más despacio.</span>
        </div>
      )}
      <div className="answer-line">
        <span className="lang-tag">{lang === "en" ? "EN" : "ES"}</span>
        <input
          ref={ref}
          className={"drill-input" + st}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !outcome) { e.preventDefault(); check(); } }}
          readOnly={!!outcome}
          lang={lang}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={lang === "en" ? "Escribe en inglés…" : "Escribe en español…"}
          aria-label="Tu respuesta"
        />
      </div>
      {lang === "es" && !outcome && (
        <div className="accent-keys" aria-label="Letras con tilde">
          {ACCENTS.map((c) => <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(c)}>{c}</button>)}
        </div>
      )}
      <Actions onCheck={check} onSkip={skip} disabled={!v.trim()} answered={!!outcome} />
    </>
  );
}

function ChoiceItem({ item, outcome, onAnswer }: ItemProps<"choice">) {
  const [picked, setPicked] = useState<number | null>(null);
  // Las opciones se barajan en cada intento: la correcta no siempre está en el mismo sitio
  const order = useMemo(() => shuffle(item.options.map((_, i) => i)), [item.options]);
  const choose = (i: number) => {
    if (outcome) return;
    setPicked(i);
    onAnswer({ ok: i === item.answer, expected: item.options[item.answer], say: item.say });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (outcome || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = +e.key;
      if (n >= 1 && n <= item.options.length) choose(order[n - 1]);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  return (
    <>
      <Q text={item.q} />
      {item.say && (
        <div className="listen-box">
          <Say text={item.say} slow big autoPlay label="Escuchar" />
          {outcome && <span lang="en"><b>{item.say}</b></span>}
        </div>
      )}
      <div className="choices">
        {order.map((i, pos) => {
          const cls = outcome ? (i === item.answer ? " right" : i === picked ? " wrong" : " dim") : "";
          return (
            <button key={i} type="button" className={"choice" + cls} onClick={() => choose(i)} disabled={!!outcome && i !== item.answer && i !== picked}>
              <span className="k">{pos + 1}</span><span dangerouslySetInnerHTML={{ __html: fmt(item.options[i]) }} />
            </button>
          );
        })}
      </div>
      {!outcome && <div className="row"><button className="btn ghost" onClick={() => onAnswer({ ok: false, expected: item.options[item.answer], say: item.say })}>No lo sé</button></div>}
    </>
  );
}

function ClozeItem({ item, outcome, onAnswer }: ItemProps<"cloze">) {
  const n = gaps(item.text);
  const [vals, setVals] = useState<string[]>(() => Array(n).fill(""));
  const [marks, setMarks] = useState<(boolean | null)[]>(() => Array(n).fill(null));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const full = fillCloze(item.text, item.answers);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const check = () => {
    const gs = vals.map((v, k) => grade(v, item.answers[k], { lang: "en" }));
    const ok = gs.every((g) => g.correct);
    setMarks(gs.map((g) => g.correct));
    onAnswer({ ok, expected: full, say: full, user: vals.join(" / ") });
  };
  const skip = () => { setMarks(Array(n).fill(false)); onAnswer({ ok: false, expected: full, say: full }); };
  const parts = item.text.split(/_{3,}/);
  return (
    <>
      {item.q && <Q text={item.q} />}
      {item.say && <div className="listen-box"><Say text={full} slow big autoPlay label="Escuchar" /><span className="faint">Escucha y completa lo que falta.</span></div>}
      <p className="cloze" lang="en">
        {parts.map((t, k) => (
          <span key={k}>
            {t}
            {k < n && (
              <input
                ref={(el) => { refs.current[k] = el; }}
                className={"gap" + (marks[k] === true ? " ok" : marks[k] === false ? " ko" : "")}
                value={vals[k]}
                size={Math.max(4, canonical(item.answers[k][0]).length + 1)}
                onChange={(e) => setVals(vals.map((x, j) => (j === k ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || outcome) return;
                  e.preventDefault();
                  if (k + 1 < n && !vals[k + 1]) refs.current[k + 1]?.focus(); else if (vals.every((x) => x.trim())) check();
                }}
                readOnly={!!outcome}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label={`Hueco ${k + 1}`}
              />
            )}
          </span>
        ))}
      </p>
      {item.es && <p className="faint cloze-es">{item.es}</p>}
      {outcome && !outcome.ok && (
        <p className="faint">Huecos: {item.answers.map((a, k) => <span key={k}>{k ? " · " : ""}<b>{expand(a[0])[0]}</b>{a.length > 1 || expand(a[0]).length > 1 ? ` (también: ${[...a.flatMap(expand)].slice(1, 4).join(", ")})` : ""}</span>)}</p>
      )}
      <Actions onCheck={check} onSkip={skip} disabled={!vals.every((x) => x.trim())} answered={!!outcome} />
    </>
  );
}

type Tile = { id: number; w: string };

function OrderItem({ item, outcome, onAnswer }: ItemProps<"order">) {
  const bank = useMemo<Tile[]>(() => {
    const ws = [...tiles(item.answer), ...(item.extra || [])];
    let s = shuffle(ws.map((w, id) => ({ id, w })));
    // que no salga ya ordenada
    for (let k = 0; k < 5 && s.map((t) => t.w).join(" ") === tiles(item.answer).join(" "); k++) s = shuffle(s);
    return s;
  }, [item.answer, item.extra]);
  const [line, setLine] = useState<Tile[]>([]);
  const inLine = new Set(line.map((t) => t.id));
  const check = () => {
    const user = line.map((t) => t.w).join(" ");
    const g = grade(user, [item.answer, ...(item.answers || [])], { lang: "en" });
    onAnswer({ ok: g.correct, grade: g, user, expected: g.correct ? g.expected : item.answer, say: g.correct ? g.expected : item.answer });
  };
  return (
    <>
      <Q text={item.q} />
      <div className={"order-line" + (outcome ? (outcome.ok ? " ok" : " ko") : "")} aria-label="Tu frase">
        {line.length ? line.map((t) => (
          <button key={t.id} type="button" className="tile" disabled={!!outcome} onClick={() => setLine(line.filter((x) => x.id !== t.id))} lang="en">{t.w}</button>
        )) : <span className="faint">Toca las palabras en orden…</span>}
      </div>
      <div className="order-bank" aria-label="Palabras disponibles">
        {bank.map((t) => (
          <button key={t.id} type="button" className={"tile" + (inLine.has(t.id) ? " used" : "")} disabled={inLine.has(t.id) || !!outcome} onClick={() => setLine([...line, t])} lang="en">{t.w}</button>
        ))}
      </div>
      {!outcome && (
        <div className="row">
          <button className="btn primary" onClick={check} disabled={!line.length}>Comprobar</button>
          <button className="btn ghost" onClick={() => setLine([])} disabled={!line.length}>Borrar</button>
          <button className="btn ghost" onClick={() => onAnswer({ ok: false, expected: item.answer, say: item.answer })}>No lo sé</button>
        </div>
      )}
    </>
  );
}

function MatchItem({ item, outcome, onAnswer }: ItemProps<"match">) {
  const left = useMemo(() => shuffle(item.pairs.map((p, i) => ({ i, t: p[0] }))), [item.pairs]);
  const right = useMemo(() => shuffle(item.pairs.map((p, i) => ({ i, t: p[1] }))), [item.pairs]);
  const [sel, setSel] = useState<{ side: "l" | "r"; i: number } | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<{ l: number; r: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const pick = (side: "l" | "r", i: number) => {
    if (outcome || matched.has(i) && (side === "l" || side === "r")) return;
    if (side === "l") speak(item.pairs[i][0]);
    if (!sel || sel.side === side) { setSel({ side, i }); return; }
    const l = side === "l" ? i : sel.i, r = side === "r" ? i : sel.i;
    setSel(null);
    if (l === r) {
      const m = new Set(matched); m.add(l); setMatched(m);
      if (m.size === item.pairs.length) onAnswer({ ok: mistakes === 0, requeue: false, msg: mistakes ? `Terminaste con ${mistakes} error${mistakes > 1 ? "es" : ""}; cuenta como fallo a la primera.` : undefined });
    } else {
      setMistakes(mistakes + 1);
      setBad({ l, r });
      setTimeout(() => setBad(null), 650);
    }
  };
  const cls = (side: "l" | "r", i: number) =>
    "match-card" + (matched.has(i) ? " done" : "") + (sel?.side === side && sel.i === i ? " sel" : "") + (bad && (side === "l" ? bad.l : bad.r) === i ? " bad" : "");
  return (
    <>
      <Q text={item.q || "Une cada palabra en inglés con su traducción."} />
      <div className="match">
        <div className="match-col">{left.map((c) => <button key={c.i} type="button" className={cls("l", c.i)} onClick={() => pick("l", c.i)} disabled={matched.has(c.i)} lang="en">{c.t}</button>)}</div>
        <div className="match-col">{right.map((c) => <button key={c.i} type="button" className={cls("r", c.i)} onClick={() => pick("r", c.i)} disabled={matched.has(c.i)}>{c.t}</button>)}</div>
      </div>
      <p className="faint" style={{ margin: 0 }}>Parejas: {matched.size}/{item.pairs.length}{mistakes ? ` · errores: ${mistakes}` : ""}</p>
    </>
  );
}

function SpeakItem({ item, outcome, onAnswer }: ItemProps<"speak">) {
  const [mode] = useState(() => getPrefs().recog);
  const [state, setState] = useState<"idle" | "listening" | "recording" | "recorded">("idle");
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState<{ pct: number; parts: DiffPart[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { stopRef.current?.(); if (url) URL.revokeObjectURL(url); }, [url]);
  const auto = mode !== "off";

  const recognize = async () => {
    setErr(null); setHeard(""); setScore(null); setState("listening");
    const r = listen({ local: mode === "local", onInterim: setHeard });
    stopRef.current = r.stop;
    try {
      const { text, alts } = await r.result;
      setState("idle");
      if (!text) { setErr("No se entendió nada. Habla un poco más fuerte y claro, y vuelve a intentarlo."); return; }
      const best = (alts.length ? alts : [text]).map((a) => ({ a, s: speechScore(a, item.say) })).sort((p, q) => q.s.pct - p.s.pct)[0];
      setHeard(best.a);
      setScore(best.s);
    } catch (e) {
      setState("idle");
      setErr((e as Error).message);
    }
  };

  const rec = async () => {
    setErr(null);
    try {
      const r = await record();
      stopRef.current = r.stop;
      setState("recording");
      const blob = await r.result;
      if (url) URL.revokeObjectURL(url);
      const u = URL.createObjectURL(blob);
      setUrl(u);
      setState("recorded");
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } catch {
      setState("idle");
      setErr("No se pudo usar el micrófono (revisa el permiso del navegador).");
    }
  };

  const compare = async () => {
    await speak(item.say);
    await new Promise((r) => setTimeout(r, 300));
    audioRef.current?.play().catch(() => {});
  };

  const passed = score && score.pct >= 80;
  return (
    <>
      <Q text={item.q || "Escucha el modelo y dilo en voz alta."} />
      <div className="speak-model">
        <b lang="en" className="speak-text">{item.say}</b>
        {item.es && <span className="faint">{item.es}</span>}
        <Say text={item.say} slow big autoPlay label="Modelo" />
      </div>
      {!outcome && (
        <div className="speak-actions">
          {auto && (
            state === "listening"
              ? <button className="btn primary rec-on" onClick={() => stopRef.current?.()}><IconStop /> Escuchando… (pulsa al terminar)</button>
              : <button className="btn primary" onClick={recognize}><IconMic /> {score ? "Decirlo otra vez" : "Decirlo"}</button>
          )}
          {typeof window !== "undefined" && hasMic() && (
            state === "recording"
              ? <button className="btn rec-on" onClick={() => stopRef.current?.()}><IconStop /> Grabando… (pulsa al terminar)</button>
              : <button className={"btn" + (auto ? " ghost" : " primary")} onClick={rec}><IconMic /> {url ? "Grabarme otra vez" : "Grabarme"}</button>
          )}
          {url && <><button className="btn small" onClick={() => audioRef.current?.play()}><IconSpeaker /> Mi grabación</button><button className="btn small" onClick={compare}>Modelo + mi grabación</button></>}
          <audio ref={audioRef} src={url || undefined} hidden />
        </div>
      )}
      {heard && (
        <div className={"heard" + (score ? (passed ? " ok" : " ko") : "")}>
          <span className="faint">Te entendí:</span> <b lang="en">«{heard}»</b>
          {score && <><br /><span className="faint">Coincidencia: {score.pct} %</span> <DiffLine parts={score.parts} /></>}
        </div>
      )}
      {err && <p className="callout warn" style={{ margin: 0 }}><span className="lbl">Ojo</span><span>{err}</span></p>}
      {!outcome && (
        <div className="row">
          {score && <button className={"btn " + (passed ? "primary" : "")} onClick={() => onAnswer({ ok: !!passed, say: item.say, expected: item.say, msg: passed ? `Coincidencia del ${score.pct} %.` : `Coincidencia del ${score.pct} %: necesitas 80 %. Escucha el modelo despacio y vuelve a intentarlo cuando vuelva a salir.` })}>{passed ? "Continuar" : "Seguir (cuenta como fallo)"}</button>}
          {url && <><button className="btn primary" onClick={() => onAnswer({ ok: true, say: item.say, msg: "Autoevaluado: te salió bien." })}>Me salió bien</button><button className="btn" onClick={() => onAnswer({ ok: false, say: item.say, expected: item.say, msg: "Volverá a salir al final: escucha el modelo despacio y repítelo por partes." })}>Me salió mal</button></>}
          <button className="btn ghost" onClick={() => onAnswer({ ok: true, skipped: true, say: item.say, msg: "Omitido: no cuenta para tu resultado. Practícalo en voz alta cuando puedas." })}>Ahora no puedo hablar</button>
        </div>
      )}
      {!auto && !outcome && <p className="faint" style={{ margin: 0 }}>Grábate, escucha tu voz junto al modelo y evalúate con honestidad. Para que la plataforma te corrija sola, activa el reconocimiento en «Voz».</p>}
    </>
  );
}
