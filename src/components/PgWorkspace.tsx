"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PgExercise } from "@/lib/types";
import { fmt, fmtBlock, levelLabel } from "@/lib/format";
import { checkScript, compareQuery, expectedResult, preload, runScript, PgSession, type PgState, type Scenario, type SchemaInfo } from "@/lib/pgRunner";
import CodeEditor from "./CodeEditor";
import PgSchema from "./PgSchema";
import PgTerminal, { type PgTerminalHandle } from "./PgTerminal";
import { pkey, useProgress } from "./ProgressProvider";

type Nav = { id: string; title: string } | null;
type Props = { courseId: string; sectionId: string; exercise: PgExercise; index: number; total: number; prev: Nav; next: Nav };
type Result = { name: string; ok: boolean; msg?: string };

export default function PgWorkspace(props: Props) {
  const { ready } = useProgress();
  if (!ready) return <div className="empty">Cargando el ejercicio…</div>;
  return <Workspace key={props.exercise.id} {...props} />;
}

export function scenarioOf(courseId: string, x: { id: string; dataset?: string; database?: string; setup?: string; extra?: string[] }): Scenario {
  return { key: `${courseId}/${x.id}`, dataset: x.dataset, database: x.database || x.dataset || "postgres", setup: x.setup || "", extra: x.extra };
}

const MODE = {
  query: { label: "Consulta", help: "Escribe la consulta en el editor. «Ejecutar» te muestra su resultado; «Comprobar» lo compara con el resultado esperado." },
  script: { label: "Script SQL", help: "Escribe las sentencias en el editor. Cada ejecución parte del escenario inicial, así que puedes probar las veces que quieras." },
  psql: { label: "Consola psql", help: "Trabaja en la consola como en un servidor real. Cuando termines (y hayas confirmado con COMMIT si abriste una transacción), comprueba." },
} as const;

function Workspace({ courseId, sectionId, exercise: x, index, total, prev, next }: Props) {
  const { p, update } = useProgress();
  const key = pkey(courseId, x.id);
  const saved = p.exercises[key];
  const scenario = useMemo(() => scenarioOf(courseId, x), [courseId, x]);
  const solutionSql = Array.isArray(x.solution) ? x.solution.join("\n") : x.solution;
  const [code, setCode] = useState(() => saved?.code ?? x.starter ?? "");
  const [out, setOut] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"run" | "check" | null>(null);
  const [expected, setExpected] = useState<{ text: string; rows: number } | null>(null);
  const [expErr, setExpErr] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [hints, setHints] = useState(saved?.hints ?? 0);
  const [askSolution, setAskSolution] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(x.mode === "psql");
  const [runN, setRunN] = useState(0);
  const [pgState, setPgState] = useState<PgState | null>(null);
  const term = useRef<PgTerminalHandle>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solved = !!saved?.solved;

  useEffect(() => { preload(); }, []);

  // Resultado esperado (ejercicios de consulta)
  useEffect(() => {
    if (x.mode !== "query") return;
    let alive = true;
    expectedResult(scenario, x.id, solutionSql).then((r) => { if (alive && r) setExpected({ text: r.text, rows: r.rows.length }); }).catch((e) => alive && setExpErr((e as Error).message));
    return () => { alive = false; };
  }, [scenario, x.id, x.mode, solutionSql]);

  const refreshSchema = useCallback(async (s: PgSession) => {
    setSchemaBusy(true);
    try { setSchema(await s.schema()); } catch { /* sesión reiniciada */ } finally { setSchemaBusy(false); }
  }, []);

  const onChange = (v: string) => {
    setCode(v);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      update((d) => { const c = d.exercises[key]; d.exercises[key] = { solved: c?.solved ?? false, at: c?.at ?? Date.now(), attempts: c?.attempts ?? 0, hints: c?.hints, sawSolution: c?.sawSolution, code: v }; }, { track: false });
    }, 1500);
  };
  useEffect(() => () => { if (draftTimer.current) clearTimeout(draftTimer.current); }, []);

  const record = (patch: Record<string, unknown>, ok?: boolean) =>
    update((d) => {
      const c = d.exercises[key];
      d.exercises[key] = { solved: (c?.solved ?? false) || !!ok, at: Date.now(), attempts: (c?.attempts ?? 0) + (ok === undefined ? 0 : 1), hints: c?.hints, sawSolution: c?.sawSolution, code: x.mode === "psql" ? c?.code : code, ...patch };
    }, { track: ok !== undefined });

  /** En modo script, el panel muestra las tablas tal como quedan tras el script del alumno. */
  const scriptSchema = async (sql: string) => {
    const s = new PgSession(scenario, { script: sql });
    setSchemaBusy(true);
    try { await s.open(); setSchema(await s.schema()); } catch { /* sin panel */ } finally { s.close(); setSchemaBusy(false); }
  };

  const requireResults = (): Result[] =>
    (x.requires || []).map((r) => {
      const ok = new RegExp(r.pattern, r.flags ?? "i").test(code.replace(/--[^\n]*/g, ""));
      return { name: r.name || r.msg, ok, msg: ok ? undefined : r.msg };
    });

  const run = async () => {
    if (busy || x.mode === "psql") return;
    setBusy("run"); setNotice(null);
    try {
      const r = await runScript(scenario, code);
      setOut(r.output || "(sin salida)");
      setRunN((n) => n + 1);
      if (x.mode === "script") void scriptSchema(code);
    } catch (e) { setOut("ERROR:  " + (e as Error).message); }
    setBusy(null);
  };

  const check = async () => {
    if (busy) return;
    setBusy("check"); setNotice(null); setResults(null);
    try {
      if (x.mode === "query") {
        const v = await compareQuery(scenario, x.id, code, solutionSql, !!x.ordered, !!x.columns);
        setOut(v.output || "(sin salida)");
        const res: Result[] = [{ name: "El resultado coincide con el esperado", ok: v.ok, msg: v.reason }, ...requireResults()];
        if (x.checks?.length) {
          const c = await checkScript(scenario, code, x.checks);
          res.push(...c.results);
        }
        setResults(res);
        record({}, res.every((t) => t.ok));
      } else if (x.mode === "script") {
        const c = await checkScript(scenario, code, x.checks || []);
        setOut(c.output || "(sin salida)");
        const res = [...c.results, ...requireResults()];
        if (c.tx !== "I") setNotice("Tu script terminó con una transacción abierta: al desconectarse, PostgreSQL la deshace (ROLLBACK). Termínala con COMMIT.");
        setResults(res);
        void scriptSchema(code);
        record({}, res.every((t) => t.ok));
      } else {
        const s = term.current?.session();
        if (!s) { setNotice("La consola aún no está lista."); setBusy(null); return; }
        const c = await s.check(x.checks || []);
        if (c.blocked) {
          setNotice(c.blocked === "E"
            ? "Tu transacción falló (el prompt muestra =!#). Escribe ROLLBACK; y vuelve a intentarlo: la comprobación mira lo confirmado, como otra sesión."
            : "Tienes una transacción abierta (el prompt muestra =*#). Termínala con COMMIT; (o ROLLBACK;) antes de comprobar: las demás sesiones no ven cambios sin confirmar.");
        } else {
          const res = c.results || [];
          setResults(res);
          record({}, res.every((t) => t.ok));
        }
      }
    } catch (e) {
      setResults([{ name: "Comprobación", ok: false, msg: (e as Error).message }]);
    }
    setBusy(null);
  };

  const passed = results ? results.filter((t) => t.ok).length : 0;
  const allOk = !!results && results.length > 0 && passed === results.length;
  const checksList = x.mode === "query" ? ["El resultado coincide con el esperado", ...(x.requires || []).map((r) => r.name || r.msg), ...(x.checks || []).map((c) => c.name)] : [...(x.checks || []).map((c) => c.name), ...(x.requires || []).map((r) => r.name || r.msg)];

  return (
    <div className="gx-layout pg-layout">
      <section className="ex-brief" aria-label="Enunciado">
        <div className="row" style={{ gap: 10 }}>
          <span className={"blaze lvl-" + x.level}>{levelLabel(x.level)}</span>
          <span className="eyebrow">Ejercicio {index + 1} de {total}{x.minutes ? ` · ${x.minutes} min` : ""} · {MODE[x.mode].label}</span>
          {solved && <span className="pill good">✓ Resuelto</span>}
        </div>
        <h1 className="ex-title">{x.title}</h1>
        <div className="ex-prompt" dangerouslySetInnerHTML={{ __html: x.prompt.map((par) => fmtBlock(par)).join("") }} />
        {x.mode === "query" && (
          <div className="pg-expected">
            <span className="eyebrow">Resultado esperado{expected ? ` · ${expected.rows} fila${expected.rows === 1 ? "" : "s"}` : ""}{x.ordered ? " · en este orden" : ""}</span>
            {expected ? <pre className="pg-out">{trimRows(expected.text, 14)}</pre> : <div className="faint">{expErr ? "No se pudo calcular: " + expErr : "Calculando con PostgreSQL…"}</div>}
          </div>
        )}
        <div className="gx-goals">
          <span className="eyebrow">Se comprobará</span>
          <ul>{checksList.map((c, i) => <li key={i} dangerouslySetInnerHTML={{ __html: fmt(c) }} />)}</ul>
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
                Equivocarte aquí es gratis: la base vuelve al escenario inicial cuando quieras. Si llevas un rato atascado, mira la solución, entiéndela y luego escríbela tú.
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
                <pre className="qcode pg-sol">{solutionSql}</pre>
                <div className="row" style={{ gap: 6 }}>
                  {x.mode !== "psql"
                    ? <button className="btn small" onClick={() => onChange(solutionSql)}>Copiar al editor</button>
                    : <button className="btn small" onClick={() => void term.current?.run(solutionSql)}>▶ Escribirla en la consola</button>}
                </div>
              </>
            )}
            <span className="eyebrow">Por qué funciona</span>
            <div className="ex-explain" dangerouslySetInnerHTML={{ __html: fmtBlock(x.explain) }} />
          </div>
        )}
      </section>

      <section className="gx-work" aria-label="Práctica">
        <p className="faint pg-modehelp">{MODE[x.mode].help}</p>
        {x.mode !== "psql" ? (
          <>
            <div className="pg-editor">
              <CodeEditor value={code} onChange={onChange} onRun={run} onTest={check} language="sql" minHeight={170} maxHeight={420} label="Editor de SQL" />
            </div>
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="faint">Ctrl/⌘ + Enter ejecuta · Mayús + Enter comprueba</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={run} disabled={!!busy}>{busy === "run" ? "Ejecutando…" : "▶ Ejecutar"}</button>
                <button className="btn primary" onClick={check} disabled={!!busy}>{busy === "check" ? "Comprobando…" : "✓ Comprobar"}</button>
              </span>
            </div>
            {out !== null && (
              <div className="gx-panel">
                <div className="gx-panel-head">Salida de PostgreSQL</div>
                <pre className="pg-out pg-out-run">{out}</pre>
              </div>
            )}
          </>
        ) : (
          <>
            <PgTerminal ref={term} scenario={scenario} user={x.user} files={x.files} height={360} onState={setPgState} onChange={refreshSchema} intro="Escenario preparado. Escribe SQL o meta-comandos (\? muestra la ayuda)." />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="faint">{pgState?.tx === "T" ? "Hay una transacción abierta: haz COMMIT antes de comprobar." : "Cuando creas que está listo, compruébalo. Puedes comprobar tantas veces como quieras."}</span>
              <button className="btn primary" onClick={check} disabled={!!busy}>{busy === "check" ? "Comprobando…" : "✓ Comprobar"}</button>
            </div>
          </>
        )}
        {notice && <div className="callout warn"><span className="lbl">Ojo</span><div>{notice}</div></div>}
        {results && (
          <div className={"tests " + (allOk ? "ok" : "ko")} aria-live="polite">
            <div className="tests-head">
              <b>{allOk ? "¡Objetivo cumplido!" : `${passed} de ${results.length} comprobaciones superadas`}</b>
              <div className="bar good" style={{ width: 140 }}><i style={{ width: `${(passed / Math.max(1, results.length)) * 100}%` }} /></div>
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

        {x.mode !== "psql" && (
          <div className="gx-panel pg-console-box">
            <button className="gx-panel-head pg-toggle" onClick={() => setConsoleOpen((o) => !o)} aria-expanded={consoleOpen}>
              {consoleOpen ? "▾" : "▸"} Explorar en psql {x.mode === "script" && runN > 0 ? "(sobre el resultado de tu última ejecución)" : "(sobre el escenario)"}
            </button>
            {consoleOpen && (
              <PgTerminal key={x.mode === "script" ? runN : 0} scenario={scenario} user={x.user} files={x.files} script={x.mode === "script" && runN > 0 ? code : undefined} height={260} onChange={refreshSchema} />
            )}
          </div>
        )}
        <PgSchema schema={schema} loading={schemaBusy} />
        {!schema && x.mode !== "psql" && !consoleOpen && <SchemaLoader scenario={scenario} onSchema={setSchema} />}

        <div className="lesson-foot" style={{ marginTop: 8 }}>
          {prev ? <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${prev.id}`}>← {prev.title}</Link> : <Link className="btn" href={`/${courseId}/${sectionId}?tab=ejercicios`}>← Todos los ejercicios</Link>}
          {next && <Link className="btn" href={`/${courseId}/${sectionId}/ejercicio/${next.id}`}>{next.title} →</Link>}
        </div>
      </section>
    </div>
  );
}

/** Lee las tablas del escenario (sin mostrar consola). */
function SchemaLoader({ scenario, onSchema }: { scenario: Scenario; onSchema: (s: SchemaInfo | null) => void }) {
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = new PgSession(scenario);
      try { await s.open(); const sc = await s.schema(); if (alive) onSchema(sc); } catch { /* sin panel */ } finally { s.close(); }
    })();
    return () => { alive = false; };
  }, [scenario, onSchema]);
  return null;
}

function trimRows(text: string, max: number) {
  const lines = text.replace(/\n+$/, "").split("\n");
  if (lines.length <= max + 3) return lines.join("\n");
  const head = lines.slice(0, 2 + max);
  return [...head, `… (${lines.length - 3 - max} filas más)`, lines[lines.length - 1]].join("\n");
}
