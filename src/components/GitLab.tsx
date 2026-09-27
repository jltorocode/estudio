"use client";

import { useCallback, useState } from "react";
import type { GitState } from "@/lib/gitApi";
import GitAreas from "./GitAreas";
import GitGraph from "./GitGraph";
import GitTerminal from "./GitTerminal";

/** Terminal libre de Git: una carpeta de práctica vacía para experimentar sin miedo. */
export default function GitLab() {
  const [state, setState] = useState<GitState | null>(null);
  const onState = useCallback((s: GitState | null) => setState(s), []);
  return (
    <div className="stack">
      <p className="muted reading" style={{ margin: 0 }}>
        Una carpeta de práctica vacía solo para ti, con Git real. Crea repositorios, rompe cosas y arréglalas: nada de lo que hagas aquí toca tus proyectos reales. Empieza por ejemplo con <code>mkdir prueba</code>, <code>cd prueba</code> y <code>git init</code>. Escribe <code>help</code> para ver las órdenes disponibles.
      </p>
      <div className="gx-lab">
        <GitTerminal spec={{ kind: "lab" }} onState={onState} height={440} intro="Terminal libre. Tu carpeta de práctica (~) está vacía." />
        <div className="stack" style={{ gap: 12 }}>
          <div className="gx-panel"><div className="gx-panel-head">Gráfico de commits</div><GitGraph state={state} height={320} /></div>
          <div className="gx-panel"><div className="gx-panel-head">Las tres áreas</div><GitAreas state={state} />{state && !state.repo && <div className="faint" style={{ padding: 10 }}>Estás en <code>{state.cwd}</code>, fuera de un repositorio.</div>}</div>
        </div>
      </div>
    </div>
  );
}
