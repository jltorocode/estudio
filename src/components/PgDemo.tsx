"use client";

import { useState } from "react";
import { preload, type Scenario } from "@/lib/pgRunner";
import CodeEditor from "./CodeEditor";
import PgTerminal from "./PgTerminal";

/** Ejemplo de una lección: el SQL se escribe en psql (PostgreSQL 18 real en el navegador) y puedes seguir escribiendo. */
export default function PgDemo({ code, scenario, caption }: { code: string; scenario: Scenario; caption?: string }) {
  const [src, setSrc] = useState(code.replace(/\n+$/, ""));
  const [editing, setEditing] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <div className="pg-demo">
      <div className="runnable-head">
        <span className="eyebrow">Ejemplo · psql{scenario.dataset ? ` · base «${scenario.database || scenario.dataset}»` : ""}</span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small ghost" onClick={() => setEditing((e) => !e)}>{editing ? "Ocultar editor" : "✎ Editar"}</button>
          {run > 0 && src !== code.replace(/\n+$/, "") && <button className="btn small ghost" onClick={() => setSrc(code.replace(/\n+$/, ""))}>Restaurar</button>}
          <button className="btn small primary" onMouseEnter={() => preload()} onFocus={() => preload()} onClick={() => setRun((n) => n + 1)}>{run ? "↺ Ejecutar de nuevo" : "▶ Ejecutar en psql"}</button>
        </span>
      </div>
      {editing ? <CodeEditor value={src} onChange={setSrc} onRun={() => setRun((n) => n + 1)} language="sql" minHeight={80} maxHeight={360} label="Editor del ejemplo" />
        : <pre className="pg-code"><code>{src}</code></pre>}
      {run > 0 && <PgTerminal key={run} scenario={scenario} initialInput={src} height={Math.min(460, 150 + src.split("\n").length * 22)} title="psql · ejemplo" />}
      {caption && <div className="codecap" dangerouslySetInnerHTML={{ __html: caption }} />}
    </div>
  );
}
