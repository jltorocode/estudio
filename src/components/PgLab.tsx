"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PgSession, Scenario, SchemaInfo } from "@/lib/pgRunner";
import CodeEditor from "./CodeEditor";
import PgSchema from "./PgSchema";
import PgTerminal, { type PgTerminalHandle } from "./PgTerminal";

const DATASETS = [
  { id: "", name: "Base vacía (postgres)" },
  { id: "tienda", name: "tienda · clientes, productos, pedidos" },
  { id: "rrhh", name: "rrhh · empleados, departamentos, sueldos" },
  { id: "colegio", name: "colegio · alumnos, cursos, notas" },
  { id: "biblioteca", name: "biblioteca · libros, autores, préstamos" },
  { id: "metro", name: "metro · viajes y validaciones (datos grandes)" },
];

// Guardado del laboratorio en IndexedDB (solo en este navegador)
const DB = "cuaderno-pg-lab";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("lab");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet<T>(k: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise((res) => { const t = db.transaction("lab").objectStore("lab").get(k); t.onsuccess = () => res(t.result as T); t.onerror = () => res(undefined); });
  } catch { return undefined; }
}
async function idbSet(k: string, v: unknown) {
  try {
    const db = await idb();
    await new Promise<void>((res) => { const t = db.transaction("lab", "readwrite"); t.objectStore("lab").put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); });
  } catch { /* sin guardado */ }
}
async function idbDel(k: string) {
  try { const db = await idb(); db.transaction("lab", "readwrite").objectStore("lab").delete(k); } catch { /* nada */ }
}

type Saved = { data: Blob; db: string; user: string; dataset: string; at: number };

/** Laboratorio libre de PostgreSQL: consola psql, tablas y diagrama, con guardado automático en el navegador. */
export default function PgLab() {
  const [dataset, setDataset] = useState<string | null>(null);
  const [restore, setRestore] = useState<Saved | null>(null);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draft, setDraft] = useState("-- Escribe aquí sentencias largas y envíalas a la consola\n");
  const [gen, setGen] = useState(0);
  const [ask, setAsk] = useState<string | null>(null);
  const term = useRef<PgTerminalHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    idbGet<Saved>("ultimo").then((s) => {
      if (!alive) return;
      if (s) { setRestore(s); setDataset(s.dataset); setSavedAt(s.at); } else setDataset("");
    });
    return () => { alive = false; };
  }, []);

  const scenario: Scenario | null = dataset === null ? null
    : restore ? { key: `lab-restore-${restore.at}`, data: restore.data, database: restore.db }
      : { key: `lab/${dataset || "vacia"}`, dataset: dataset || undefined, database: dataset || "postgres" };

  const onChange = useCallback((s: PgSession) => {
    setBusy(true);
    s.schema().then(setSchema).catch(() => {}).finally(() => setBusy(false));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const d = await s.dump();
        const at = Date.now();
        await idbSet("ultimo", { data: d.data, db: d.db, user: d.user, dataset: dataset ?? "", at });
        setSavedAt(at);
      } catch { /* sesión reiniciada */ }
    }, 2500);
  }, [dataset]);

  const choose = async (id: string) => {
    setAsk(null);
    await idbDel("ultimo");
    setRestore(null);
    setSavedAt(null);
    setDataset(id);
    setGen((g) => g + 1);
  };

  return (
    <div className="gx-lab pg-lab">
      <div className="gx-work">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="faint" htmlFor="pg-ds">Base de datos de partida:</label>
          <select id="pg-ds" value={ask ?? dataset ?? ""} onChange={(e) => setAsk(e.target.value)} disabled={dataset === null}>
            {DATASETS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="btn small ghost" onClick={() => setAsk(dataset ?? "")} disabled={dataset === null}>Empezar de cero</button>
          <span className="faint">{savedAt ? `Guardado en este navegador · ${new Date(savedAt).toLocaleTimeString("es-CL")}` : "Se guarda solo en este navegador"}</span>
        </div>
        {ask !== null && (
          <div className="callout warn">
            <span className="lbl">¿Seguro?</span>
            <div>
              Empezar con «{DATASETS.find((d) => d.id === ask)?.name}» borra lo que hayas hecho en el laboratorio.
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <button className="btn small primary" onClick={() => void choose(ask)}>Sí, empezar de nuevo</button>
                <button className="btn small ghost" onClick={() => setAsk(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
        {scenario && <PgTerminal key={gen} ref={term} scenario={scenario} user={restore?.user} height={440} onChange={onChange} intro={restore ? "Recuperé tu laboratorio tal como lo dejaste (lo confirmado)." : "Laboratorio libre: todo lo que hagas aquí se guarda en este navegador."} title="psql · laboratorio" />}
        <details className="gx-panel pg-draft">
          <summary className="gx-panel-head">Borrador para sentencias largas</summary>
          <CodeEditor value={draft} onChange={setDraft} onRun={() => void term.current?.run(draft.replace(/\n+$/, ""))} language="sql" minHeight={120} maxHeight={320} label="Borrador SQL" />
          <div className="row" style={{ justifyContent: "flex-end", padding: 8 }}><button className="btn small primary" onClick={() => void term.current?.run(draft.replace(/\n+$/, ""))}>Enviar a la consola (Ctrl/⌘ + Enter)</button></div>
        </details>
      </div>
      <PgSchema schema={schema} loading={busy} />
    </div>
  );
}
