"use client";

import { useRef, useState } from "react";
import type { Progress } from "@/lib/types";
import { useProgress } from "./ProgressProvider";

export default function BackupButtons() {
  const { p, replaceMerged } = useProgress();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const exportIt = () => {
    const data = JSON.stringify({ app: "cuaderno-certificaciones", exportedAt: new Date().toISOString(), progress: p }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuaderno-progreso-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg("Copia exportada.");
  };

  const importIt = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result));
        const prog: Progress = parsed?.progress ?? parsed;
        if (!prog || prog.v !== 1 || typeof prog.lessons !== "object") throw new Error();
        replaceMerged(prog);
        setMsg("Progreso importado y combinado.");
      } catch {
        setMsg("Ese archivo no es una copia de progreso válida.");
      }
    };
    r.readAsText(file);
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn small" onClick={exportIt}>Exportar progreso</button>
        <button className="btn small" onClick={() => input.current?.click()}>Importar</button>
      </div>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importIt(f); e.target.value = ""; }} />
      {msg && <span role="status">{msg}</span>}
    </div>
  );
}
