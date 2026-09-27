"use client";

// Bloques del curso de inglés: vocabulario, frases, diálogos y patrones de frase, todos con audio.
import { useEffect, useRef, useState } from "react";
import type { Phrase, TextQuestion, Word } from "@/lib/types";
import { fmt } from "@/lib/format";
import { speakAll } from "@/lib/speech";
import { IconPlay, IconStop, Say, VoiceMenu } from "./EnVoice";

const H = ({ html, as: Tag = "span", className }: { html: string; as?: "span" | "div" | "p" | "b" | "h4"; className?: string }) => (
  <Tag className={className} dangerouslySetInnerHTML={{ __html: fmt(html) }} />
);

/** Reproduce una lista de textos seguidos; devuelve el índice que suena y el botón. */
function usePlayAll(parts: { text: string; speaker?: number }[], gap = 500) {
  const [idx, setIdx] = useState(-1);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const toggle = () => {
    if (idx >= 0) { stopRef.current?.(); stopRef.current = null; setIdx(-1); return; }
    stopRef.current = speakAll(parts, { gap, onIndex: setIdx });
  };
  const button = (label = "Escuchar todo") => (
    <button type="button" className={"btn small" + (idx >= 0 ? " primary" : "")} onClick={toggle}>
      {idx >= 0 ? <><IconStop /> Detener</> : <><IconPlay /> {label}</>}
    </button>
  );
  return { idx, button };
}

type Hide = "none" | "es" | "en";
const HIDE_LABEL: Record<Hide, string> = { none: "Ver todo", es: "Tapar español", en: "Tapar inglés" };

function HideToggle({ hide, setHide }: { hide: Hide; setHide: (h: Hide) => void }) {
  return (
    <div className="seg" role="group" aria-label="Autoevaluación">
      {(["none", "es", "en"] as Hide[]).map((h) => (
        <button key={h} type="button" className={hide === h ? "on" : ""} aria-pressed={hide === h} onClick={() => setHide(h)}>{HIDE_LABEL[h]}</button>
      ))}
    </div>
  );
}

/** Texto tapado que se destapa al pulsarlo (para autoevaluarse). Se usa con key={modo} para volver a taparlo. */
function Veil({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!hidden || shown) return <>{children}</>;
  return <button type="button" className="veil" onClick={() => setShown(true)} title="Pulsa para ver">Pulsa para ver</button>;
}

/* ------------------------------- Vocabulario ------------------------------- */

export function WordsBlock({ title, items }: { title?: string; items: Word[] }) {
  const [hide, setHide] = useState<Hide>("none");
  const { idx, button } = usePlayAll(items.map((w) => ({ text: w.en })), 700);
  return (
    <section className="en-block">
      <header className="en-head">
        <div>
          <span className="eyebrow">Vocabulario · {items.length} {items.length === 1 ? "palabra" : "palabras"}</span>
          {title && <H as="h4" html={title} />}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {button()}
          <HideToggle hide={hide} setHide={setHide} />
          <VoiceMenu />
        </div>
      </header>
      <div className="en-words">
        {items.map((w, i) => (
          <div key={i} className={"en-word" + (idx === i ? " playing" : "")}>
            <div className="en-word-top">
              <Veil key={hide} hidden={hide === "en"}><b className="en-w" lang="en">{w.en}</b></Veil>
              <Say text={w.en} slow />
            </div>
            {w.ipa && <span className="en-ipa" title="Pronunciación en el alfabeto fonético internacional (inglés americano)">{w.ipa}</span>}
            {w.fig && <span className="en-fig" title="Pronunciación figurada del libro">«{w.fig}»</span>}
            <span className="en-es"><Veil key={hide} hidden={hide === "es"}>{w.es}</Veil></span>
            {w.note && <H className="en-note" html={w.note} />}
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- Frases --------------------------------- */

export function PhrasesBlock({ title, items }: { title?: string; items: Phrase[] }) {
  const [hide, setHide] = useState<Hide>("none");
  const { idx, button } = usePlayAll(items.map((p) => ({ text: p.en })), 650);
  return (
    <section className="en-block">
      <header className="en-head">
        <div>
          <span className="eyebrow">Frases · {items.length}</span>
          {title && <H as="h4" html={title} />}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {button()}
          <HideToggle hide={hide} setHide={setHide} />
          <VoiceMenu />
        </div>
      </header>
      <ol className="en-phrases">
        {items.map((p, i) => (
          <li key={i} className={idx === i ? "playing" : ""}>
            <Say text={p.en} slow />
            <span className="en-en" lang="en"><Veil key={hide} hidden={hide === "en"}>{p.en}</Veil></span>
            <span className="en-es"><Veil key={hide} hidden={hide === "es"}>{p.es}</Veil></span>
            {p.note && <H className="en-note" html={p.note} />}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------- Diálogo --------------------------------- */

export function DialogBlock({ title, lines, caption }: { title?: string; lines: { who: string; en: string; es: string }[]; caption?: string }) {
  const people = [...new Set(lines.map((l) => l.who))];
  const [showEs, setShowEs] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const stopRef = useRef<(() => void) | null>(null);
  const { idx, button } = usePlayAll(lines.map((l) => ({ text: l.en, speaker: people.indexOf(l.who) })), 350);
  useEffect(() => () => stopRef.current?.(), []);

  // Juego de roles: la plataforma dice las líneas de los demás y se detiene en las tuyas
  const roleRef = useRef<string | null>(null);
  useEffect(() => { roleRef.current = role; }, [role]);
  const advance = (k: number) => {
    if (k >= lines.length) { setStep(lines.length); return; }
    setStep(k);
    if (lines[k].who === roleRef.current) return; // tu turno: esperas a pulsar «Ya lo dije»
    stopRef.current = speakAll([{ text: lines[k].en, speaker: people.indexOf(lines[k].who) }], { onDone: () => advance(k + 1) });
  };
  const startRole = (who: string) => { stopRef.current?.(); setRole(who); setStep(-1); };
  useEffect(() => { if (role) advance(0); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = role ? step : idx;

  return (
    <section className="en-block en-dialog">
      <header className="en-head">
        <div>
          <span className="eyebrow">Diálogo · {people.join(" y ")}</span>
          {title && <H as="h4" html={title} />}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {!role && button("Escuchar el diálogo")}
          <button type="button" className={"btn small" + (showEs ? "" : " primary")} onClick={() => setShowEs(!showEs)}>{showEs ? "Ocultar traducción" : "Mostrar traducción"}</button>
          <VoiceMenu />
        </div>
      </header>
      <div className="role-bar">
        <span className="faint">Practica un papel:</span>
        {people.map((p) => <button key={p} type="button" className={"btn small" + (role === p ? " primary" : "")} onClick={() => (role === p ? (stopRef.current?.(), setRole(null), setStep(-1)) : startRole(p))}>{role === p ? `Salir del papel de ${p}` : `Ser ${p}`}</button>)}
      </div>
      <div className="chat">
        {lines.map((l, i) => {
          const side = people.indexOf(l.who) % 2 ? "right" : "left";
          const mine = role === l.who;
          const future = role !== null && i > step;
          return (
            <div key={i} className={`bubble ${side}` + (active === i ? " playing" : "") + (mine ? " mine" : "") + (future ? " future" : "")}>
              <span className="who">{l.who}{mine ? " (tú)" : ""}</span>
              {mine && step === i ? (
                <div className="my-turn">
                  <span className="en-es">Di en inglés: <b>{l.es}</b></span>
                  <details><summary>Ver la frase</summary><span lang="en">{l.en}</span></details>
                  <div className="row" style={{ gap: 6 }}>
                    <Say text={l.en} slow />
                    <button type="button" className="btn small primary" onClick={() => advance(i + 1)}>Ya lo dije → siguiente</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="line"><Say text={l.en} speaker={people.indexOf(l.who)} /><span lang="en">{l.en}</span></div>
                  {showEs && <span className="en-es">{l.es}</span>}
                </>
              )}
            </div>
          );
        })}
        {role && step >= lines.length && (
          <div className="role-done">
            <b>¡Diálogo completo!</b> <button type="button" className="btn small" onClick={() => { setStep(-1); advance(0); }}>Otra vez</button>
            <button type="button" className="btn small ghost" onClick={() => { setRole(null); setStep(-1); }}>Salir</button>
          </div>
        )}
      </div>
      {caption && <H as="p" className="faint" html={caption} />}
    </section>
  );
}

/* ------------------------------ Patrón de frase ------------------------------ */

/** Frase de una fila de patrón para leerla (sin celdas vacías ni «—»). */
const rowText = (r: string[]) => r.filter((c) => c && !/^[\s—–-]*$/.test(c)).join(" ");

export function PatternBlock({ title, slots, rows, es, caption }: { title?: string; slots: string[]; rows: string[][]; es?: string[]; caption?: string }) {
  const { idx, button } = usePlayAll(rows.map((r) => ({ text: rowText(r) })), 600);
  return (
    <figure className="en-block en-pattern">
      <header className="en-head">
        <div>
          <span className="eyebrow">Patrón de frase</span>
          {title && <H as="h4" html={title} />}
        </div>
        <div className="row" style={{ gap: 6 }}>{button()}<VoiceMenu /></div>
      </header>
      <div className="pat-wrap">
        <table className="pat">
          <thead>
            <tr>
              <th aria-label="Audio" />
              {slots.map((s, i) => <th key={i} className={`slot-${i % 6}`}><H html={s} /></th>)}
              {es?.length ? <th className="pat-es">Traducción</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={idx === i ? "playing" : ""}>
                <td className="pat-say"><Say text={rowText(r)} /></td>
                {r.map((c, j) => <td key={j} className={`slot-${j % 6}` + (c ? "" : " empty")} lang="en">{c || "—"}</td>)}
                {es?.[i] && <td className="pat-es">{es[i]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <figcaption dangerouslySetInnerHTML={{ __html: fmt(caption) }} />}
    </figure>
  );
}

/* ------------------------------ Lectura / audición ------------------------------ */

/**
 * Texto largo por párrafos, todos con audio. En una lectura se ve el inglés y la traducción se destapa por
 * párrafo; en una audición el texto empieza oculto: primero se escucha, se responden las preguntas y después se lee.
 */
export function TextBlock({ title, kind = "read", level, source, paragraphs, glossary, questions, caption }: {
  title?: string; kind?: "read" | "listen"; level?: string; source?: string; paragraphs: Phrase[];
  glossary?: { en: string; es: string }[]; questions?: TextQuestion[]; caption?: string;
}) {
  const listenFirst = kind === "listen";
  const [showText, setShowText] = useState(!listenFirst);
  const [showEs, setShowEs] = useState<Record<number, boolean>>({});
  const [allEs, setAllEs] = useState(false);
  const { idx, button } = usePlayAll(paragraphs.map((p) => ({ text: p.en })), 700);
  const words = paragraphs.reduce((n, p) => n + p.en.split(/\s+/).filter(Boolean).length, 0);
  return (
    <section className="en-block en-text">
      <header className="en-head">
        <div>
          <span className="eyebrow">{listenFirst ? "Audición" : "Lectura"}{level ? ` · ${level}` : ""} · {words} palabras</span>
          {title && <H as="h4" html={title} />}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {button(listenFirst ? "Escuchar" : "Escuchar el texto")}
          {listenFirst && <button type="button" className={"btn small" + (showText ? " primary" : "")} onClick={() => setShowText(!showText)}>{showText ? "Ocultar el texto" : "Ver el texto"}</button>}
          {showText && <button type="button" className={"btn small" + (allEs ? " primary" : "")} onClick={() => { setAllEs(!allEs); setShowEs({}); }}>{allEs ? "Ocultar traducción" : "Traducción completa"}</button>}
          <VoiceMenu />
        </div>
      </header>
      {listenFirst && !showText && (
        <p className="faint" style={{ margin: 0 }}>Escucha sin leer (una vez a velocidad normal y otra más despacio si hace falta), responde las preguntas y solo entonces mira el texto.</p>
      )}
      {showText && (
        <div className="en-paras">
          {paragraphs.map((p, i) => {
            const es = allEs || showEs[i];
            return (
              <div key={i} className={"en-para" + (idx === i ? " playing" : "")}>
                <div className="en-para-en"><Say text={p.en} /><p lang="en">{p.en}</p></div>
                {es ? <p className="en-es">{p.es}</p> : <button type="button" className="btn small ghost en-para-tr" onClick={() => setShowEs({ ...showEs, [i]: true })}>Traducir este párrafo</button>}
                {p.note && <H className="en-note" html={p.note} />}
              </div>
            );
          })}
        </div>
      )}
      {glossary?.length ? (
        <details className="en-gloss">
          <summary>Glosario del texto ({glossary.length})</summary>
          <ul>{glossary.map((g, i) => <li key={i}><Say text={g.en} /><b lang="en">{g.en}</b> <span className="faint">= {g.es}</span></li>)}</ul>
        </details>
      ) : null}
      {questions?.length ? <TextQuestions questions={questions} /> : null}
      {(source || caption) && <p className="faint" style={{ margin: 0 }}>{caption && <span dangerouslySetInnerHTML={{ __html: fmt(caption) }} />}{source ? <> {caption ? "· " : ""}Fuente: <span dangerouslySetInnerHTML={{ __html: fmt(source) }} /></> : null}</p>}
    </section>
  );
}

function TextQuestions({ questions }: { questions: TextQuestion[] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = Object.keys(picked).length;
  const right = questions.filter((q, i) => picked[i] === q.answer).length;
  return (
    <div className="en-tq">
      <span className="eyebrow">Comprensión · {answered ? `${right}/${answered} correctas` : `${questions.length} preguntas`}</span>
      <ol>
        {questions.map((q, i) => {
          const got = picked[i];
          return (
            <li key={i}>
              <H as="p" html={q.q} />
              <div className="en-tq-opts">
                {q.options.map((o, k) => (
                  <button key={k} type="button" disabled={got != null}
                    className={"btn small" + (got != null && k === q.answer ? " tq-ok" : got === k ? " tq-ko" : "")}
                    onClick={() => setPicked({ ...picked, [i]: k })}>{o}</button>
                ))}
              </div>
              {got != null && <p className={got === q.answer ? "tq-msg ok" : "tq-msg ko"}>{got === q.answer ? "✓ Correcto." : `✗ Era: ${q.options[q.answer]}.`} {q.explain && <span dangerouslySetInnerHTML={{ __html: fmt(q.explain) }} />}</p>}
            </li>
          );
        })}
      </ol>
      {answered > 0 && <button type="button" className="btn small ghost" onClick={() => setPicked({})}>Responder otra vez</button>}
    </div>
  );
}
