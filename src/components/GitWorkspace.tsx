"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { GitExercise } from "@/lib/types";
import { fmt, fmtBlock, levelLabel } from "@/lib/format";
import { gitApi, type GitState } from "@/lib/gitApi";
import GitAreas from "./GitAreas";
import GitGraph from "./GitGraph";
import GitTerminal, { type GitTerminalHandle } from "./GitTerminal";
import { pkey, useProgress } from "./ProgressProvider";

type Nav = { id: string; title: string } | null;
type Props = { courseId: string; sectionId: string; exercise: GitExercise; index: number; total: number; prev: Nav; next: Nav };
type Result = { name: string; ok: boolean; msg?: string };

export default function GitWorkspace(props: Props) {
  const { ready } = useProgress();
  if (!ready) return <div className="empty">Cargando el ejercicio…</div>;
  return <Workspace key={props.exercise.id} {...props} />;
}

function Workspace({ courseId, sectionId, exercise: x, index, total, prev, next }: Props) {
  const { p, update } = useProgress();
  const key = pkey(courseId, x.id);
  const saved = p.exercises[key];
  const term = useRef<GitTerminalHandle>(null);
  const [state, setState] = useState<GitState | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [hints, setHints] = useState(saved?.hints ?? 0);
  const [askSolution, setAskSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const solved = !!saved?.solved;
  const onState = useCallback((s: GitState | null) => setState(s), []);

  const record = (patch: Partial<NonNullable<typeof saved>>, track = false) =>
    update((d) => { const c = d.exercises[key]; d.exercises[key] = { solved: c?.solved ?? false, at: c?.at ?? Date.now(), attempts: c?.attempts ?? 0, hints: c?.hints, sawSolution: c?.sawSolution, ...patch }; }, { track });

  const check = async () => {
    const sid = term.current?.sessionId();
    if (!sid) return;
    setChecking(true);
    const r = await gitApi<{ results?: Result[]; error?: string }>("check", { session: sid });
    setChecking(false);
    const res = r.results || [{ name: "Comprobación", ok: false, msg: r.error || "No se pudo comprobar" }];
    setResults(res);
    const ok = res.every((t) => t.ok);
    update((d) => { const c = d.exercises[key]; d.exercises[key] = { solved: (c?.solved ?? false) || ok, at: Date.now(), attempts: (c?.attempts ?? 0) + 1, hints: c?.hints, sawSolution: c?.sawSolution }; });
  };

  const passed = results ? results.filter((t) => t.ok).length : 0;
  const allOk = !!results && passed === results.length;

  return (
    <div className="gx-layout">
      <section className="ex-brief" aria-label="Enunciado">
        <div className="row" style={{ gap: 10 }}>
          <span className={"blaze lvl-" + x.level}>{levelLabel(x.level)}</span>
          <span className="eyebrow">Ejercicio {index + 1} de {total}{x.minutes ? ` · ${x.minutes} min` : ""}</span>
          {solved && <span className="pill good">✓ Resuelto</span>}
        </div>
        <h1 className="ex-title">{x.title}</h1>
        <div className="ex-prompt" dangerouslySetInnerHTML={{ __html: x.prompt.map((par) => fmtBlock(par)).join("") }} />
        <div className="gx-goals">
          <span className="eyebrow">Se comprobará</span>
          <ul>{x.checks.map((c) => <li key={c.name} dangerouslySetInnerHTML={{ __html: fmt(c.name) }} />)}</ul>
        </div>

        <div className="ex-help">
          <div className="spread">
            <span className="eyebrow">Pistas · {Math.min(hints, x.hints.length)}/{x.hints.length}</span>
            {hints < x.hints.length && <button className="btn small" onClick={() => { const n = hints + 1; setHints(n); record({ hints: n }); }}>{hints === 0 ? "Ver una pista" : "Otra pista"}</button>}
          </div>
          {x.hints.slice(0, hints).map((h, i) => <div key={i} className="callout tip"><span className="lbl">Pista {i + 1}</span><div dangerouslySetInnerHTML={{ __html: fmtBlock(h) }} /></div>)}
          {!showSolution && (askSolution ? (
            <div className="callout warn">
              <span className="lbl">¿Seguro?</span>
              <div>
                Equivocarte en la terminal es gratis: puedes pulsar «Reiniciar» cuando quieras. Si llevas un rato atascado, mira la solución, entiéndela y luego hazla tú en la terminal.
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn small primary" onClick={() => { setShowSolution(true); setAskSolution(false); record({ sawSolution: true }); }}>Mostrar la solución</button>
                  <button className="btn small ghost" onClick={() => setAskSolution(false)}>Seguir intentándolo</button>
                </div>
              </div>
            </div>
          ) : <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAskSolution(true)}>Ver la solución</button>)}
        </div>

        {(showSolution || solved) && (
          <div className="ex-solution">
            {showSolution && (
              <>
                <span className="eyebrow">Solución de referencia</span>
                <ol className="gx-steps">
                  {x.solution.map((st, i) => {
                    const cmd = typeof st === "string" ? st : st.cmd;
                    const edits = typeof st === "string" ? [] : Array.isArray(st.edit) ? st.edit : st.edit != null ? [st.edit] : [];
                    return (
                      <li key={i}>
                        <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "nowrap" }}>
                          <code>{cmd}</code>
                          <button className="btn small ghost" onClick={() => term.current?.run(cmd)} title="Ejecutarlo en la terminal">▶</button>
                        </div>
                        {edits.map((e, k) => (
                          <details key={k}><summary className="faint">En el editor que abre Git, deja esto{edits.length > 1 ? ` (${k + 1}.ª vez)` : ""}:</summary><pre className="qcode">{e.replace(/\{\{SHA:([^}]+)\}\}/g, "<hash de $1>")}</pre></details>
                        ))}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <span className="eyebrow">Por qué funciona</span>
            <div className="ex-explain" dangerouslySetInnerHTML={{ __html: fmtBlock(x.explain) }} />
          </div>
        )}
      </section>

      <section className="gx-work" aria-label="Terminal y estado del repositorio">
        <GitTerminal ref={term} spec={{ kind: "exercise", course: courseId, section: sectionId, exercise: x.id }} onState={onState} height={300} intro="Escenario preparado. Escribe comandos de Git (help muestra las órdenes disponibles)." />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="faint">Cuando creas que está listo, compruébalo. Puedes comprobar tantas veces como quieras.</span>
          <button className="btn primary" onClick={check} disabled={checking}>{checking ? "Comprobando…" : "✓ Comprobar"}</button>
        </div>
        {results && (
          <div className={"tests " + (allOk ? "ok" : "ko")} aria-live="polite">
            <div className="tests-head">
              <b>{allOk ? "¡Objetivo cumplido!" : `${passed} de ${results.length} comprobaciones superadas`}</b>
              <div className="bar good" style={{ width: 140 }}><i style={{ width: `${(passed / results.length) * 100}%` }} /></div>
            </div>
            <ul>{results.map((t, i) => <li key={i} className={t.ok ? "ok" : "ko"}><span className="mark" aria-hidden="true">{t.ok ? "✓" : "✗"}</span><span><span dangerouslySetInnerHTML={{ __html: fmt(t.name) }} />{!t.ok && t.msg && <small>{t.msg}</small>}</span></li>)}</ul>
          </div>
        )}
        {allOk && (
          <div className="ex-done">
            <h3>Resuelto</h3>
            <p>{next ? "Sigue con el siguiente mientras lo tienes fresco." : "Has terminado los ejercicios de esta sección."} Lee «Por qué funciona» para ver alternativas.</p>
            {next ? <Link className="btn primary" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>Siguiente: {next.title} →</Link> : <Link className="btn primary" href={`/${courseId}/${sectionId}?tab=test`}>Ir al test de la sección →</Link>}
          </div>
        )}
        <div className="gx-state">
          <div className="gx-panel"><div className="gx-panel-head">Historia (gráfico de commits)</div><GitGraph state={state} height={300} /></div>
          <div className="gx-panel"><div className="gx-panel-head">Las tres áreas</div><GitAreas state={state} />{state && !state.repo && <div className="faint" style={{ padding: 10 }}>Estás en <code>{state.cwd}</code>, fuera de un repositorio.</div>}</div>
        </div>
        <div className="lesson-foot" style={{ marginTop: 8 }}>
          {prev ? <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${prev.id}`}>← {prev.title}</Link> : <Link className="btn" href={`/${courseId}/${sectionId}?tab=ejercicios`}>← Todos los ejercicios</Link>}
          {next && <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>{next.title} →</Link>}
        </div>
      </section>
    </div>
  );
}
