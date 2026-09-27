"use client";

import { useCallback, useRef, useState } from "react";
import type { GitState } from "@/lib/gitApi";
import GitGraph from "./GitGraph";
import GitTerminal, { type GitTerminalHandle } from "./GitTerminal";

/** Demostración de una lección: los comandos se ejecutan paso a paso con Git real. */
export default function GitDemo({ code, caption, ids }: { code: string; caption?: string; ids: { course: string; section: string; lesson: string; block: number } }) {
  const cmds = code.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [state, setState] = useState<GitState | null>(null);
  const [running, setRunning] = useState(false);
  const term = useRef<GitTerminalHandle>(null);
  const onState = useCallback((s: GitState | null) => setState(s), []);

  const next = async () => {
    if (step >= cmds.length) return;
    setRunning(true);
    await term.current?.run(cmds[step]);
    setStep((n) => n + 1);
    setRunning(false);
  };
  const all = async () => {
    setRunning(true);
    for (let i = step; i < cmds.length; i++) { await term.current?.run(cmds[i]); setStep(i + 1); }
    setRunning(false);
  };

  return (
    <div className="git-demo">
      <div className="runnable-head">
        <span className="eyebrow">Demostración · Git real</span>
        {!open && <button className="btn small primary" onClick={() => setOpen(true)}>▶ Probar en la terminal</button>}
      </div>
      <ol className="git-demo-cmds">
        {cmds.map((c, i) => <li key={i} className={open && i < step ? "done" : open && i === step ? "next" : ""}><code>{c}</code></li>)}
      </ol>
      {open && (
        <>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small primary" onClick={next} disabled={running || step >= cmds.length}>{step >= cmds.length ? "Hecho" : `▶ Paso ${step + 1} de ${cmds.length}`}</button>
            <button className="btn small" onClick={all} disabled={running || step >= cmds.length}>Ejecutar el resto</button>
            <button className="btn small ghost" onClick={async () => { await term.current?.reset(); setStep(0); }} disabled={running}>↺ Empezar de nuevo</button>
            <span className="faint">También puedes escribir tus propios comandos.</span>
          </div>
          <div className="git-demo-grid">
            <GitTerminal ref={term} spec={{ kind: "demo", ...ids }} onState={onState} height={260} />
            <div className="gx-panel"><div className="gx-panel-head">Gráfico de commits</div><GitGraph state={state} height={300} /></div>
          </div>
        </>
      )}
      {caption && <div className="codecap" dangerouslySetInnerHTML={{ __html: caption }} />}
    </div>
  );
}
