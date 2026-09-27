"use client";

import { useEffect, useRef, useState } from "react";
import { preload, runPython, stop } from "@/lib/pyRunner";
import CodeEditor from "./CodeEditor";
import PyStatus from "./PyStatus";
import { useProgress } from "./ProgressProvider";

const SAMPLE = `# Laboratorio libre: escribe lo que quieras y pulsa «Ejecutar» (Ctrl/⌘ + Enter).
# Los archivos que crees aquí se conservan mientras tengas la página abierta.
from pathlib import Path

nombres = ["Ada", "Guido", "Grace"]
for i, nombre in enumerate(nombres, start=1):
    print(f"{i}. {nombre:<6} → {len(nombre)} letras")

Path("notas.txt").write_text("Python 3.14 en el navegador\\n")
print(Path("notas.txt").read_text())
`;

export default function LabClient({ courseId }: { courseId: string }) {
  const { ready } = useProgress();
  if (!ready) return <div className="empty">Cargando el laboratorio…</div>;
  return <Lab courseId={courseId} />;
}

function Lab({ courseId }: { courseId: string }) {
  const { p, update } = useProgress();
  const [code, setCode] = useState(() => p.lab[courseId] || SAMPLE);
  const [out, setOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stdin, setStdin] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { preload(); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onChange = (v: string) => {
    setCode(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => update((d) => { d.lab[courseId] = v; }, { track: false }), 1500);
  };

  const run = async () => {
    setRunning(true); setOut(""); setError(null);
    let acc = "";
    const r = await runPython({ kind: "run", code, stdin: stdin ? stdin.split("\n") : [], persistent: true }, (t) => { acc += t; setOut(acc); }, 30000);
    setError(r.error || null);
    setRunning(false);
  };

  return (
    <div className="lab-grid">
      <div className="stack" style={{ gap: 10 }}>
        <div className="ex-toolbar">
          <PyStatus />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn small ghost" onClick={() => onChange(SAMPLE)}>Ejemplo</button>
            <button className="btn small ghost" onClick={() => onChange("")}>Vaciar</button>
            {running ? <button className="btn small" onClick={stop}>■ Detener</button> : <button className="btn small primary" onClick={run}>▶ Ejecutar</button>}
          </div>
        </div>
        <CodeEditor value={code} onChange={onChange} onRun={run} minHeight={420} maxHeight={720} />
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <label className="stdin">
          <span className="eyebrow">Entrada para input() · una línea por dato</span>
          <textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={4} spellCheck={false} placeholder={"Ana\n25"} />
        </label>
        <div className="console tall" aria-live="polite">
          <div className="console-head"><span>Salida</span></div>
          <pre>{out ?? <span className="faint">Pulsa «Ejecutar» para ver aquí lo que imprime tu programa.</span>}{error && <span className="console-err">{(out ? "\n" : "") + error}</span>}</pre>
        </div>
        <p className="faint" style={{ margin: 0 }}>Es Python 3.14 real (CPython compilado a WebAssembly). Funciona casi toda la biblioteca estándar; no se pueden crear hilos, procesos ni conexiones de red, ni instalar paquetes con pip.</p>
      </div>
    </div>
  );
}
