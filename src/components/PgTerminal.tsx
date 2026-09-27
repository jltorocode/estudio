"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { PgSession, restart, type PgEvent, type PgState, type Scenario } from "@/lib/pgRunner";
import CodeEditor from "./CodeEditor";

type Line = { t: "in"; prompt: string; text: string } | { t: "out"; text: string } | { t: "info"; text: string };

export type PgTerminalHandle = {
  /** Escribe texto en la consola como si lo tecleara el alumno. */
  run: (text: string) => Promise<void>;
  reset: () => Promise<void>;
  session: () => PgSession | null;
};

type Props = {
  scenario: Scenario;
  user?: string;
  files?: Record<string, string>;
  /** Script que se ejecuta al abrir (la consola queda sobre su resultado). */
  script?: string;
  /** Texto que se «teclea» nada más abrir (demostraciones de las lecciones). */
  initialInput?: string;
  onState?: (s: PgState | null) => void;
  /** Se llama tras cada orden (para refrescar el panel de tablas). */
  onChange?: (session: PgSession) => void;
  height?: number;
  intro?: string;
  title?: string;
  autoStart?: boolean;
};

const BANNER = 'psql (18.3)\nType "help" for help.\n';

// Autocompletado con Tab (como el de psql): palabras clave, meta-comandos, tablas y columnas
const KEYWORDS = "ABORT ALTER ANALYZE AND ANY ARRAY AS ASC BEGIN BETWEEN BIGINT BOOLEAN BY CALL CASCADE CASE CAST CHECK COALESCE COLLATE COLUMN COMMENT COMMIT CONCURRENTLY CONFLICT CONSTRAINT COPY COUNT CREATE CROSS CUBE CURRENT_DATE CURRENT_TIMESTAMP DATABASE DATE DEFAULT DEFERRABLE DELETE DESC DISTINCT DO DOMAIN DROP ELSE END EXCEPT EXCLUDE EXECUTE EXISTS EXPLAIN EXTENSION FALSE FETCH FILTER FIRST FOLLOWING FOR FOREIGN FROM FULL FUNCTION GENERATED GRANT GROUP GROUPING HAVING IDENTITY IF ILIKE IN INDEX INHERITS INNER INSERT INTEGER INTERSECT INTERVAL INTO IS JOIN JSONB KEY LAST LATERAL LEFT LIKE LIMIT LOCK MATERIALIZED MERGE NATURAL NOT NOTHING NOTIFY NOWAIT NULL NULLIF NULLS NUMERIC OFFSET ON ONLY OR ORDER OUTER OVER OWNER PARTITION POLICY PRECEDING PREPARE PRIMARY PROCEDURE PUBLICATION RANGE RECURSIVE REFERENCES REFRESH RELEASE RENAME REPEATABLE REPLACE RESET RESTRICT RETURNING RETURNS REVOKE RIGHT ROLE ROLLBACK ROLLUP ROW ROWS SAVEPOINT SCHEMA SELECT SEQUENCE SERIALIZABLE SESSION SET SHOW SKIP SMALLINT STATISTICS TABLE TEMPORARY TEXT THEN TIMESTAMP TIMESTAMPTZ TO TRANSACTION TRIGGER TRUE TRUNCATE TYPE UNBOUNDED UNION UNIQUE UNLOGGED UPDATE USING UUID VACUUM VALUES VARCHAR VIEW VOLATILE WHEN WHERE WINDOW WITH WITHOUT".split(" ");
const METAS = "\\? \\a \\c \\conninfo \\copy \\d \\d+ \\dconfig \\dD \\df \\df+ \\dg \\di \\dL \\dm \\dn \\dp \\dP \\drg \\dRp \\dRs \\ds \\dt \\dt+ \\dT \\du \\dv \\dx \\dy \\e \\echo \\errverbose \\g \\gexec \\gset \\gx \\h \\i \\l \\p \\pset \\q \\r \\set \\sf \\sv \\t \\timing \\unset \\x \\z".split(" ");
function commonPrefix(xs: string[]) {
  let p = xs[0] || "";
  for (const x of xs) while (!x.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p;
}

/** Colorea la salida como una terminal: errores en rojo, avisos en amarillo, notas atenuadas. */
function OutText({ text }: { text: string }) {
  const parts = text.replace(/\n$/, "").split("\n");
  return (
    <pre>
      {parts.map((l, i) => {
        const cls = /^(psql:\S+: )?(ERROR|FATAL|PANIC):/.test(l) || /^connection to server/.test(l) || /^(invalid command|Try \\\?)/.test(l) ? "a-red"
          : /^(psql:\S+: )?WARNING:/.test(l) ? "a-yellow"
          : /^(psql:\S+: )?(NOTICE|INFO|LOG|DEBUG\d?):/.test(l) || /^Asynchronous notification/.test(l) ? "a-cyan"
          : /^(DETAIL|HINT|CONTEXT|QUERY|LOCATION|LINE \d+):/.test(l) || /^\s+\^$/.test(l) ? "pg-dim"
          : /^Time: /.test(l) ? "pg-dim" : "";
        return <span key={i} className={cls}>{l}{i < parts.length - 1 ? "\n" : ""}</span>;
      })}
    </pre>
  );
}

/** Consola psql simulada: PostgreSQL 18 real en el navegador (WebAssembly). */
const PgTerminal = forwardRef<PgTerminalHandle, Props>(function PgTerminal({ scenario, user, files, script, initialInput, onState, onChange, height = 340, intro, title = "psql · PostgreSQL 18", autoStart = true }, ref) {
  const [state, setState] = useState<PgState | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quit, setQuit] = useState(false);
  const [editor, setEditor] = useState<string | null>(null);
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sess = useRef<PgSession | null>(null);
  const names = useRef<string[] | null>(null);
  const key = JSON.stringify([scenario.key, user, script ?? null, initialInput ?? null]);

  const push = useCallback((l: Line | Line[]) => setLines((prev) => [...prev, ...(Array.isArray(l) ? l : [l])].slice(-800)), []);
  const setSt = useCallback((s: PgState | null) => { setState(s); onState?.(s); }, [onState]);

  const render = useCallback((events: PgEvent[], typed: boolean) => {
    const out: Line[] = [];
    events.forEach((e, i) => {
      if (!(typed && i === 0)) out.push({ t: "in", prompt: e.prompt, text: e.line });
      if (e.out) out.push({ t: "out", text: e.out });
    });
    push(out);
  }, [push]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    setQuit(false);
    sess.current?.close();
    const s = new PgSession(scenario, { user, files, script });
    sess.current = s;
    try {
      const st = await s.open();
      if (sess.current !== s) return null;
      setLines([...(intro ? [{ t: "info" as const, text: intro }] : []), { t: "out", text: BANNER + "\n" }]);
      setSt(st);
      if (initialInput) {
        const r = await s.input(initialInput);
        if (sess.current !== s) return null;
        render(r.events, false);
        setSt(r);
        if (r.quit) setQuit(true);
      }
      onChange?.(s);
      return s;
    } catch (e) {
      setError("No se pudo iniciar PostgreSQL: " + (e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const t = autoStart ? setTimeout(() => { void start(); }, 0) : null;
    return () => { if (t) clearTimeout(t); sess.current?.close(); sess.current = null; };
  }, [autoStart, start]);

  useEffect(() => { outRef.current?.scrollTo({ top: outRef.current.scrollHeight }); }, [lines, editor, busy]);

  const run = useCallback(async (text: string) => {
    let s = sess.current;
    if (!s || !state) s = await start();
    if (!s) return;
    if (quit) {
      // Tras \q, volver a conectarse (lo confirmado sigue ahí).
      setQuit(false);
      push({ t: "out", text: BANNER + "\n" });
      await s.input("\\c");
    }
    const firstPrompt = s.state?.prompt ?? state?.prompt ?? "";
    const firstLine = text.split("\n")[0];
    push({ t: "in", prompt: firstPrompt, text: firstLine });
    if (text.trim()) history.current = [...history.current.filter((h) => h !== text), text].slice(-200);
    hIdx.current = -1;
    setBusy(true);
    const slowTimer = setTimeout(() => setSlow(true), 1500);
    try {
      const r = await s.input(text);
      names.current = null;
      render(r.events, true);
      setSt(r);
      if (r.quit) { setQuit(true); push({ t: "info", text: "Saliste de psql. Escribe cualquier cosa (o Enter) para volver a conectarte; lo confirmado sigue en la base." }); }
      if (r.editor !== undefined) setEditor(r.editor);
      onChange?.(s);
    } catch (e) {
      push({ t: "out", text: "ERROR:  " + (e as Error).message + "\n" });
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setBusy(false);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [start, state, quit, push, render, setSt, onChange]);

  useImperativeHandle(ref, () => ({ run, reset: async () => { await start(); }, session: () => sess.current }), [run, start]);

  const submit = () => {
    if (busy) return;
    const v = input;
    setInput("");
    void run(v);
  };

  /** Tab: completa la palabra bajo el cursor. Con varias opciones, completa lo común y las muestra. */
  const complete = async (ta: HTMLTextAreaElement) => {
    const pos = ta.selectionStart;
    const before = input.slice(0, pos);
    const m = /(\\?[\p{L}\p{N}_.+]*)$/u.exec(before);
    const word = m ? m[1] : "";
    if (!word) return;
    let cands: string[];
    if (word.startsWith("\\")) cands = METAS.filter((c) => c.startsWith(word));
    else {
      if (!names.current && sess.current) {
        try {
          const sc = await sess.current.schema();
          const set = new Set<string>();
          for (const t of sc?.tables || []) { set.add(t.schema === "public" ? t.name : `${t.schema}.${t.name}`); for (const c of t.columns) set.add(c.name); }
          names.current = [...set];
        } catch { names.current = []; }
      }
      const lower = word === word.toLowerCase();
      const kw = KEYWORDS.filter((k) => k.toLowerCase().startsWith(word.toLowerCase())).map((k) => (lower ? k.toLowerCase() : k));
      const ids = (names.current || []).filter((n) => n.toLowerCase().startsWith(word.toLowerCase()));
      cands = [...new Set([...ids, ...kw])];
    }
    if (!cands.length) return;
    const add = cands.length === 1 ? cands[0] + (word.startsWith("\\") || KEYWORDS.includes(cands[0].toUpperCase()) ? " " : "") : commonPrefix(cands);
    if (add.length > word.length || cands.length === 1) {
      const next = before.slice(0, before.length - word.length) + add + input.slice(pos);
      setInput(next);
      const caret = before.length - word.length + add.length;
      setTimeout(() => ta.setSelectionRange(caret, caret), 0);
    }
    if (cands.length > 1) push({ t: "info", text: cands.slice(0, 60).join("   ") + (cands.length > 60 ? "   …" : "") });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); void complete(e.currentTarget); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); return; }
    if (e.key === "ArrowUp" && !input.includes("\n")) {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
      setInput(h[hIdx.current]);
    } else if (e.key === "ArrowDown" && !input.includes("\n")) {
      e.preventDefault();
      const h = history.current;
      if (hIdx.current < 0) return;
      hIdx.current += 1;
      if (hIdx.current >= h.length) { hIdx.current = -1; setInput(""); } else setInput(h[hIdx.current]);
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
    else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      if (busy) { restart(); return; }
      // Como en psql: Ctrl+C descarta la línea y lo que hubiera en el búfer de la consulta.
      push({ t: "in", prompt: state?.prompt ?? "", text: input + "^C" });
      setInput("");
      if (sess.current && state?.pending) void sess.current.input("\\r").then((r) => setSt(r));
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const t = e.clipboardData.getData("text");
    if (t.includes("\n") && !busy) {
      e.preventDefault();
      const full = input + t;
      setInput("");
      void run(full.replace(/\n$/, ""));
    }
  };

  const txLabel = state?.tx === "T" ? "transacción abierta" : state?.tx === "E" ? "transacción fallida: haz ROLLBACK" : null;

  return (
    <div className="git-term pg-term" onClick={(e) => { if ((e.target as HTMLElement).closest("button, .git-modal, pre")) return; inputRef.current?.focus({ preventScroll: true }); }}>
      <div className="git-term-head">
        <span><i className="dot r" /><i className="dot y" /><i className="dot g" /> {title}{state ? ` · ${state.user}@${state.db}` : ""}</span>
        <span className="row" style={{ gap: 6 }}>
          {txLabel && <span className={"pg-tx " + (state?.tx === "E" ? "bad" : "")}>{txLabel}</span>}
          {busy && slow && <button className="btn small ghost" onClick={() => restart()} title="Cancela la orden (como Ctrl+C)">■ Cancelar</button>}
          <button className="btn small ghost" onClick={() => void start()} disabled={busy && !slow} title="Vuelve al escenario inicial">↺ Reiniciar</button>
        </span>
      </div>
      <div className="git-term-out" ref={outRef} style={{ height }}>
        {error && <div className="a-red">{error}</div>}
        {!state && !error && <div className="info">{busy ? "Arrancando PostgreSQL 18 en tu navegador…" : "Pulsa una orden o escribe para empezar."}</div>}
        {lines.map((l, i) =>
          l.t === "in" ? <div key={i} className="cmd"><span className="prompt">{l.prompt}</span>{l.text}</div>
            : l.t === "info" ? <div key={i} className="info">{l.text}</div>
              : <OutText key={i} text={l.text} />
        )}
        {editor !== null && (
          <div className="git-modal" role="dialog" aria-label="Editor de la consulta">
            <div className="git-modal-head">
              <span>psql abrió el editor (<code>\e</code>)</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn small ghost" onClick={() => { setEditor(null); }}>Cancelar</button>
                <button className="btn small primary" onClick={() => { const c = editor; setEditor(null); void run(c.replace(/\n+$/, "")); }}>Guardar y ejecutar</button>
              </span>
            </div>
            <p className="faint git-modal-help">Al guardar, psql ejecuta lo que dejes (si termina en <code>;</code>) o lo deja en el búfer.</p>
            <CodeEditor value={editor} onChange={setEditor} language="sql" minHeight={140} maxHeight={320} label="Editor de SQL" />
          </div>
        )}
        {editor === null && (
          <label className="git-input">
            <span className="prompt">{quit ? "$ " : state?.prompt ?? ""}</span>
            <textarea ref={inputRef} rows={Math.min(8, input.split("\n").length)} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} onPaste={onPaste} disabled={!state && busy} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="Escribe en psql" placeholder={busy ? "ejecutando…" : ""} />
          </label>
        )}
      </div>
    </div>
  );
});

export default PgTerminal;
