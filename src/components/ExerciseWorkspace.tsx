"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Exercise } from "@/lib/types";
import { fmt, fmtBlock, levelLabel } from "@/lib/format";
import { runPython, stop, preload, type TestResult } from "@/lib/pyRunner";
import CodeEditor from "./CodeEditor";
import CodeBlock from "./CodeBlock";
import PyStatus from "./PyStatus";
import { pkey, useProgress } from "./ProgressProvider";

type Nav = { id: string; title: string } | null;
type Props = { courseId: string; sectionId: string; exercise: Exercise; index: number; total: number; prev: Nav; next: Nav };

export default function ExerciseWorkspace(props: Props) {
  const { ready } = useProgress();
  if (!ready) return <div className="empty">Cargando tu ejercicio…</div>;
  return <Workspace key={props.exercise.id} {...props} />;
}

function Workspace({ courseId, sectionId, exercise: x, index, total, prev, next }: Props) {
  const { p, update } = useProgress();
  const key = pkey(courseId, x.id);
  const saved = p.exercises[key];
  const [code, setCode] = useState(() => saved?.code ?? x.starter);
  const [out, setOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [busy, setBusy] = useState<"run" | "test" | null>(null);
  const [hints, setHints] = useState(saved?.hints ?? 0);
  const [askSolution, setAskSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(!!saved?.sawSolution && !!saved?.solved);
  const [askReset, setAskReset] = useState(false);
  const usesInput = /\binput\s*\(/.test(code);
  const [stdin, setStdin] = useState("");
  const solved = !!saved?.solved;
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { preload(); }, []);

  // Guarda el borrador unos segundos después de dejar de escribir
  const onChange = (v: string) => {
    setCode(v);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      update((d) => { const cur = d.exercises[key]; d.exercises[key] = { solved: cur?.solved ?? false, at: cur?.at ?? Date.now(), attempts: cur?.attempts ?? 0, hints: cur?.hints, sawSolution: cur?.sawSolution, code: v }; }, { track: false });
    }, 1500);
  };
  useEffect(() => () => { if (draftTimer.current) clearTimeout(draftTimer.current); }, []);

  const run = async () => {
    if (busy) return;
    setBusy("run"); setOut(""); setError(null);
    let acc = "";
    const r = await runPython({ kind: "run", code, stdin: stdin ? stdin.split("\n") : [] }, (t) => { acc += t; setOut(acc); });
    setError(r.error || null);
    setBusy(null);
  };

  const test = async () => {
    if (busy) return;
    setBusy("test"); setOut(""); setError(null); setResults(null);
    let acc = "";
    const r = await runPython({ kind: "test", code, setup: x.setup, tests: x.tests }, (t) => { acc += t; setOut(acc); });
    const res = r.results || [];
    setError(r.codeError || r.error || null);
    setResults(res);
    const ok = !r.codeError && !r.error && res.length === x.tests.length && res.every((t) => t.ok);
    update((d) => {
      const cur = d.exercises[key];
      d.exercises[key] = { solved: (cur?.solved ?? false) || ok, at: Date.now(), attempts: (cur?.attempts ?? 0) + 1, hints: cur?.hints, sawSolution: cur?.sawSolution, code };
    });
    setBusy(null);
  };

  const passed = results ? results.filter((t) => t.ok).length : 0;
  const allOk = results !== null && !error && passed === x.tests.length;

  return (
    <div className="ex-layout">
      <section className="ex-brief" aria-label="Enunciado">
        <div className="row" style={{ gap: 10 }}>
          <span className={"blaze lvl-" + x.level}>{levelLabel(x.level)}</span>
          <span className="eyebrow">Ejercicio {index + 1} de {total}{x.minutes ? ` · ${x.minutes} min` : ""}</span>
          {solved && <span className="pill good">✓ Resuelto</span>}
        </div>
        <h1 className="ex-title">{x.title}</h1>
        <div className="ex-prompt" dangerouslySetInnerHTML={{ __html: x.prompt.map((par) => fmtBlock(par)).join("") }} />
        {!!x.examples?.length && (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Llamada</th><th>Resultado esperado</th></tr></thead>
              <tbody>{x.examples.map((e, i) => <tr key={i}><td><code className="inline-code">{e.call}</code></td><td><code className="inline-code">{e.result}</code></td></tr>)}</tbody>
            </table>
          </div>
        )}

        <div className="ex-help">
          <div className="spread">
            <span className="eyebrow">Pistas · {Math.min(hints, x.hints.length)}/{x.hints.length}</span>
            {hints < x.hints.length && (
              <button className="btn small" onClick={() => { const n = hints + 1; setHints(n); update((d) => { const c = d.exercises[key]; d.exercises[key] = { solved: c?.solved ?? false, at: c?.at ?? Date.now(), attempts: c?.attempts ?? 0, code: c?.code, sawSolution: c?.sawSolution, hints: n }; }, { track: false }); }}>
                {hints === 0 ? "Ver una pista" : "Otra pista"}
              </button>
            )}
          </div>
          {x.hints.slice(0, hints).map((h, i) => <div key={i} className="callout tip"><span className="lbl">Pista {i + 1}</span><div dangerouslySetInnerHTML={{ __html: fmtBlock(h) }} /></div>)}
          {!showSolution && (
            askSolution ? (
              <div className="callout warn">
                <span className="lbl">¿Seguro?</span>
                <div>
                  Pelearte con el problema es lo que te hace mejorar. Si llevas un rato atascado, mira la solución, entiéndela y luego escríbela tú sin mirar.
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn small primary" onClick={() => { setShowSolution(true); setAskSolution(false); update((d) => { const c = d.exercises[key]; d.exercises[key] = { solved: c?.solved ?? false, at: c?.at ?? Date.now(), attempts: c?.attempts ?? 0, code: c?.code, hints: c?.hints, sawSolution: true }; }, { track: false }); }}>Mostrar la solución</button>
                    <button className="btn small ghost" onClick={() => setAskSolution(false)}>Seguir intentándolo</button>
                  </div>
                </div>
              </div>
            ) : (
              <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAskSolution(true)}>Ver la solución</button>
            )
          )}
        </div>

        {(showSolution || solved) && (
          <div className="ex-solution">
            {showSolution && (
              <>
                <span className="eyebrow">Solución de referencia</span>
                <CodeBlock code={x.solution} lang="python" />
                <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => setCode(x.solution)}>Copiar al editor</button>
              </>
            )}
            <span className="eyebrow">Por qué funciona</span>
            <div className="ex-explain" dangerouslySetInnerHTML={{ __html: fmtBlock(x.explain) }} />
            {!showSolution && solved && <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setShowSolution(true)}>Comparar con la solución de referencia</button>}
          </div>
        )}
      </section>

      <section className="ex-work" aria-label="Tu código">
        <div className="ex-toolbar">
          <PyStatus />
          <div className="row" style={{ gap: 6 }}>
            {askReset ? (
              <>
                <span className="faint">¿Borrar tu código?</span>
                <button className="btn small" onClick={() => { setCode(x.starter); setAskReset(false); setResults(null); setOut(null); setError(null); }}>Sí, reiniciar</button>
                <button className="btn small ghost" onClick={() => setAskReset(false)}>No</button>
              </>
            ) : (
              <button className="btn small ghost" onClick={() => setAskReset(true)} disabled={code === x.starter}>↺ Reiniciar</button>
            )}
            {busy ? <button className="btn small" onClick={stop}>■ Detener</button> : <button className="btn small" onClick={run} title="Ctrl/⌘ + Enter">▶ Ejecutar</button>}
            <button className="btn small primary" onClick={test} disabled={!!busy} title="Mayús + Enter">✓ Comprobar</button>
          </div>
        </div>
        <CodeEditor value={code} onChange={onChange} onRun={run} onTest={test} minHeight={300} maxHeight={640} />
        <details className="stdin-details" open={usesInput || undefined}>
          <summary className="faint">Entrada para input() al pulsar «Ejecutar» (una línea por dato)</summary>
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={3} spellCheck={false} placeholder={"Ana\n25"} />
        </details>
        <p className="faint" style={{ margin: 0 }}>
          <b>Ejecutar</b> corre tu programa y muestra lo que imprime. <b>Comprobar</b> pasa las {x.tests.length} pruebas automáticas. Atajos: Ctrl/⌘ + Enter y Mayús + Enter.
        </p>

        {(out !== null || error) && (
          <div className="console" aria-live="polite">
            <div className="console-head"><span>{busy === "test" || results ? "Salida durante las pruebas" : "Salida"}</span></div>
            <pre>{out}{error && <span className="console-err">{(out ? "\n" : "") + error}</span>}{!out && !error && !busy ? <span className="faint">(sin salida)</span> : null}</pre>
          </div>
        )}

        {results && (
          <div className={"tests " + (allOk ? "ok" : "ko")} aria-live="polite">
            <div className="tests-head">
              <b>{allOk ? "¡Todas las pruebas superadas!" : error ? "Tu código lanza un error antes de las pruebas" : `${passed} de ${x.tests.length} pruebas superadas`}</b>
              <div className="bar good" style={{ width: 140 }}><i style={{ width: `${(passed / x.tests.length) * 100}%` }} /></div>
            </div>
            <ul>
              {(results.length ? results : x.tests.map((t) => ({ name: t.name, ok: false }) as TestResult)).map((t, i) => (
                <li key={i} className={t.ok ? "ok" : "ko"}>
                  <span className="mark" aria-hidden="true">{t.ok ? "✓" : "✗"}</span>
                  <span><span dangerouslySetInnerHTML={{ __html: fmt(t.name) }} />{!t.ok && t.msg && <small>{t.msg.replace(/^AssertionError:?\s*/, "") || "La comprobación no se cumple"}</small>}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {allOk && (
          <div className="ex-done">
            <h3>Resuelto</h3>
            <p>{next ? "Sigue con el siguiente mientras lo tienes fresco." : "Has terminado los ejercicios de esta sección."} Lee también «Por qué funciona» para comparar tu enfoque.</p>
            <div className="row">
              {next ? <Link className="btn primary" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>Siguiente: {next.title} →</Link> : <Link className="btn primary" href={`/${courseId}/${sectionId}?tab=test`}>Ir al test de la sección →</Link>}
            </div>
          </div>
        )}

        <div className="lesson-foot" style={{ marginTop: 18 }}>
          {prev ? <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${prev.id}`}>← {prev.title}</Link> : <Link className="btn" href={`/${courseId}/${sectionId}?tab=ejercicios`}>← Todos los ejercicios</Link>}
          {next && <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>{next.title} →</Link>}
        </div>
      </section>
    </div>
  );
}
