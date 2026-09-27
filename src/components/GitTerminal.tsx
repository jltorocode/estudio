"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ansiToHtml } from "@/lib/ansi";
import { gitApi, type ExecResult, type GitState } from "@/lib/gitApi";
import CodeEditor from "./CodeEditor";

export type SessionSpec =
  | { kind: "exercise"; course: string; section: string; exercise: string }
  | { kind: "demo"; course: string; section: string; lesson: string; block: number }
  | { kind: "lab" };

type Line = { t: "cmd"; prompt: string; text: string } | { t: "out"; html: string } | { t: "info"; text: string };
type Modal = { mode: "git"; file: string; content: string } | { mode: "file"; path: string; content: string };

export type GitTerminalHandle = { run: (line: string) => Promise<void>; reset: () => Promise<void>; sessionId: () => string | null };

type Props = {
  spec: SessionSpec;
  onState?: (s: GitState | null) => void;
  onSession?: (id: string | null) => void;
  autoStart?: boolean;
  height?: number;
  intro?: string;
};

function promptOf(s: GitState | null) {
  if (!s) return "~$";
  const br = s.repo ? (s.branch ? ` (${s.branch}${s.operation ? "|" + s.operation.toUpperCase() : ""})` : s.head ? ` (${s.head.slice(0, 7)}…)` : " (sin commits)") : "";
  return `${s.cwd}${br}$`;
}

/** Terminal de práctica con Git real (el servidor ejecuta los comandos en una carpeta aislada). */
const GitTerminal = forwardRef<GitTerminalHandle, Props>(function GitTerminal({ spec, onState, onSession, autoStart = true, height = 340, intro }, ref) {
  const [session, setSession] = useState<string | null>(null);
  const [state, setState] = useState<GitState | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [draft, setDraft] = useState("");
  const history = useRef<string[]>([]);
  const hIdx = useRef(-1);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<string | null>(null);
  const specKey = JSON.stringify(spec);

  const push = useCallback((l: Line | Line[]) => setLines((prev) => [...prev, ...(Array.isArray(l) ? l : [l])].slice(-600)), []);
  const updateState = useCallback((s: GitState | null | undefined) => { if (s) { setState(s); onState?.(s); } }, [onState]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    const old = sessionRef.current;
    if (old) gitApi("close", { session: old }).catch(() => {});
    const r = await gitApi<{ session?: string; state?: GitState; error?: string }>("session", spec as unknown as Record<string, unknown>);
    setBusy(false);
    if (r.error || !r.session) { setError(r.error || "No se pudo iniciar la terminal"); return null; }
    sessionRef.current = r.session;
    setSession(r.session);
    onSession?.(r.session);
    setLines(intro ? [{ t: "info", text: intro }] : []);
    updateState(r.state);
    return r.session;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  useEffect(() => {
    if (autoStart) start();
    return () => { if (sessionRef.current) gitApi("close", { session: sessionRef.current }).catch(() => {}); };
  }, [autoStart, start]);

  useEffect(() => { outRef.current?.scrollTo({ top: outRef.current.scrollHeight }); }, [lines, modal]);

  const handleResult = useCallback((r: ExecResult) => {
    if (r.error) { push({ t: "out", html: `<span class="a-red">${r.error}</span>` }); return; }
    if (r.clear) setLines([]);
    if (r.out) push({ t: "out", html: ansiToHtml(r.out) });
    updateState(r.state);
    if (r.editor) { setModal({ mode: "git", file: r.editor.file, content: r.editor.content }); setDraft(r.editor.content); }
    else if (r.openFile) { setModal({ mode: "file", path: r.openFile.path, content: r.openFile.content }); setDraft(r.openFile.content); }
  }, [push, updateState]);

  const run = useCallback(async (line: string) => {
    let sid = sessionRef.current;
    if (!sid) sid = await start();
    if (!sid) return;
    const text = line.trim();
    push({ t: "cmd", prompt: promptOf(state), text });
    if (!text) return;
    history.current = [...history.current.filter((h) => h !== text), text].slice(-100);
    hIdx.current = -1;
    setBusy(true);
    let r = await gitApi("exec", { session: sid, line: text });
    if (r.error && /expiró/.test(r.error)) {
      // El servidor se reinició: se prepara de nuevo el escenario y se repite el comando
      push({ t: "info", text: "La sesión había caducado (¿se reinició la plataforma?). Preparo el escenario de nuevo…" });
      const nsid = await start();
      if (nsid) r = await gitApi("exec", { session: nsid, line: text });
    }
    setBusy(false);
    handleResult(r);
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [start, push, state, handleResult]);

  useImperativeHandle(ref, () => ({ run, reset: async () => { await start(); }, sessionId: () => sessionRef.current }), [run, start]);

  const saveModal = async (cancel = false) => {
    if (!modal || !sessionRef.current) return;
    setBusy(true);
    if (modal.mode === "git") {
      const r = await gitApi("edit", { session: sessionRef.current, content: draft, cancel });
      setModal(null);
      push({ t: "info", text: cancel ? `Cerraste el editor sin guardar (${modal.file}).` : `Guardaste ${modal.file}; Git continúa.` });
      setBusy(false);
      handleResult(r);
    } else {
      if (!cancel) {
        const r = await gitApi<{ ok?: boolean; error?: string; state?: GitState }>("file", { session: sessionRef.current, path: modal.path, content: draft });
        if (r.error) push({ t: "out", html: `<span class="a-red">${r.error}</span>` });
        else { push({ t: "info", text: `Guardado ${modal.path}` }); updateState(r.state); }
      }
      setModal(null);
      setBusy(false);
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) { const v = input; setInput(""); run(v); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      hIdx.current = hIdx.current < 0 ? h.length - 1 : Math.max(0, hIdx.current - 1);
      setInput(h[hIdx.current]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      if (hIdx.current < 0) return;
      hIdx.current = hIdx.current + 1;
      if (hIdx.current >= h.length) { hIdx.current = -1; setInput(""); } else setInput(h[hIdx.current]);
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <div className="git-term" onClick={(e) => { if ((e.target as HTMLElement).closest("button, .git-modal")) return; inputRef.current?.focus({ preventScroll: true }); }}>
      <div className="git-term-head">
        <span><i className="dot r" /><i className="dot y" /><i className="dot g" /> Terminal de práctica · Git real</span>
        <button className="btn small ghost" onClick={() => start()} disabled={busy} title="Vuelve a preparar el escenario desde cero">↺ Reiniciar</button>
      </div>
      <div className="git-term-out" ref={outRef} style={{ height }}>
        {error && <div className="a-red">{error}</div>}
        {!session && !error && !autoStart && <div className="faint">Pulsa un comando o escribe para empezar.</div>}
        {lines.map((l, i) =>
          l.t === "cmd" ? <div key={i} className="cmd"><span className="prompt">{l.prompt}</span> {l.text}</div>
            : l.t === "info" ? <div key={i} className="info">{l.text}</div>
              : <pre key={i} dangerouslySetInnerHTML={{ __html: l.html }} />
        )}
        {modal && (
          <div className="git-modal" role="dialog" aria-label="Editor">
            <div className="git-modal-head">
              <span>{modal.mode === "git" ? <>Git abrió el editor: <code>{modal.file}</code></> : <>Editando <code>{modal.path}</code></>}</span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn small ghost" onClick={() => saveModal(true)} disabled={busy}>{modal.mode === "git" ? "Cerrar sin guardar" : "Cancelar"}</button>
                <button className="btn small primary" onClick={() => saveModal(false)} disabled={busy}>Guardar y cerrar</button>
              </span>
            </div>
            {modal.mode === "git" && <p className="faint git-modal-help">Edita como harías en tu editor. Las líneas que empiezan con <code>#</code> son comentarios que Git ignora. Al guardar, Git continúa.</p>}
            <CodeEditor value={draft} onChange={setDraft} language="text" minHeight={160} maxHeight={320} label="Editor de texto" />
          </div>
        )}
        {!modal && (
          <label className="git-input">
            <span className="prompt">{promptOf(state)}</span>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={busy && !!session} spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="Escribe un comando" placeholder={busy ? "ejecutando…" : ""} />
          </label>
        )}
      </div>
    </div>
  );
});

export default GitTerminal;
