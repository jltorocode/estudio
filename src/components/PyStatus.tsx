"use client";

import { useSyncExternalStore } from "react";
import { subscribe, type RunStatus } from "@/lib/pyRunner";

let snap: { s: RunStatus; v: string } = { s: "idle", v: "" };
const store = {
  subscribe: (cb: () => void) => subscribe((s, v) => { if (s !== snap.s || v !== snap.v) { snap = { s, v }; cb(); } }),
  get: () => snap,
  server: () => snap
};

/** Estado del intérprete de Python en el navegador. */
export function usePyStatus() {
  return useSyncExternalStore(store.subscribe, store.get, store.server);
}

export default function PyStatus() {
  const { s, v } = usePyStatus();
  const label = s === "ready" ? `Python ${v} listo` : s === "loading" ? "Preparando Python… (la primera vez tarda unos segundos)" : s === "error" ? "No se pudo iniciar Python" : "Python se inicia al ejecutar";
  return <span className={"py-status " + s} role="status"><i aria-hidden="true" />{label}</span>;
}
