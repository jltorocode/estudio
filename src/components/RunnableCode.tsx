"use client";

import { useState } from "react";
import { runPython, stop } from "@/lib/pyRunner";
import CodeEditor from "./CodeEditor";
import PyStatus from "./PyStatus";

/** Ejemplo de una lección que se puede editar y ejecutar. */
export default function RunnableCode({ code, stdin, caption }: { code: string; stdin?: string[]; caption?: string }) {
  const [src, setSrc] = useState(code);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const usesInput = /\binput\s*\(/.test(src);
  const [entrada, setEntrada] = useState((stdin || []).join("\n"));

  const run = async () => {
    setRunning(true);
    setOut("");
    setErr(null);
    let acc = "";
    const r = await runPython({ kind: "run", code: src, stdin: usesInput ? entrada.split("\n") : [] }, (t) => { acc += t; setOut(acc); });
    setErr(r.error || null);
    setRunning(false);
  };

  return (
    <div className="runnable">
      <div className="runnable-head">
        <span className="eyebrow">Python · editable</span>
        <div className="row" style={{ gap: 6 }}>
          {src !== code && <button className="btn small ghost" onClick={() => { setSrc(code); setOut(null); setErr(null); }}>↺ Restaurar</button>}
          {running ? <button className="btn small" onClick={stop}>■ Detener</button> : <button className="btn small primary" onClick={run} title="Ctrl/⌘ + Enter">▶ Ejecutar</button>}
        </div>
      </div>
      <CodeEditor value={src} onChange={setSrc} onRun={run} minHeight={40} maxHeight={420} />
      {usesInput && (
        <label className="stdin">
          <span className="eyebrow">Entrada para input() · una línea por dato</span>
          <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} rows={Math.max(2, entrada.split("\n").length)} spellCheck={false} />
        </label>
      )}
      {out !== null && (
        <div className="console" aria-live="polite">
          <div className="console-head"><span>Salida</span><PyStatus /></div>
          <pre>{out}{err && <span className="console-err">{(out ? "\n" : "") + err}</span>}{!out && !err && !running ? <span className="faint">(sin salida)</span> : null}</pre>
        </div>
      )}
      {caption && <div className="codecap" dangerouslySetInnerHTML={{ __html: caption }} />}
    </div>
  );
}
