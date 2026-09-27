"use client";

import { useState } from "react";
import type { SimBlock } from "@/lib/types";
import { fmt } from "@/lib/format";

type Entry = { kind: "in"; prompt: string; text: string; step: number } | { kind: "out"; text: string; step: number; late?: boolean };

/** Reproduce paso a paso varias sesiones simultáneas (salidas grabadas de un PostgreSQL 18 real). */
export default function PgSessions({ b }: { b: SimBlock }) {
  const [n, setN] = useState(0); // pasos mostrados
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const total = b.steps.length;
  const sessions = b.sessions;

  // Transcripción de cada sesión hasta el paso n
  const cols = sessions.map(() => [] as Entry[]);
  const waiting = sessions.map(() => false);
  for (let i = 0; i < n; i++) {
    const st = b.steps[i];
    const k = sessions.indexOf(st.s);
    if (k < 0) continue;
    const hidden = !!st.ask && !revealed[i] && i === n - 1;
    cols[k].push({ kind: "in", prompt: st.prompt ?? "", text: st.in, step: i });
    if (!hidden) {
      if (st.out) cols[k].push({ kind: "out", text: st.out, step: i });
      waiting[k] = !!st.wait;
      for (const w of st.wake || []) {
        const j = sessions.indexOf(w.s);
        if (j < 0) continue;
        if (w.out) cols[j].push({ kind: "out", text: w.out, step: i, late: true });
        waiting[j] = false;
      }
    }
  }
  const cur = n > 0 ? b.steps[n - 1] : null;
  const asking = cur && cur.ask && !revealed[n - 1];

  return (
    <div className="pg-sim">
      <div className="runnable-head">
        <span className="eyebrow">{b.kind === "shell" ? "Terminal" : "Sesiones simultáneas"} · grabado en PostgreSQL 18{b.title ? " · " : ""}{b.title && <span dangerouslySetInnerHTML={{ __html: fmt(b.title) }} />}</span>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn small ghost" onClick={() => setN(0)} disabled={n === 0}>↺</button>
          <button className="btn small ghost" onClick={() => setN((x) => Math.max(0, x - 1))} disabled={n === 0}>◀ Anterior</button>
          <button className="btn small primary" onClick={() => setN((x) => Math.min(total, x + 1))} disabled={n >= total || !!asking}>{n === 0 ? "▶ Empezar" : n >= total ? "Fin" : `Paso ${n + 1} de ${total} ▶`}</button>
          <button className="btn small ghost" onClick={() => { const r: Record<number, boolean> = {}; b.steps.forEach((_, i) => (r[i] = true)); setRevealed(r); setN(total); }} disabled={n >= total}>Ver todo</button>
        </span>
      </div>
      <div className="pg-sim-cols" style={{ gridTemplateColumns: `repeat(${sessions.length}, minmax(0, 1fr))` }}>
        {sessions.map((name, k) => (
          <div key={name} className="git-term pg-sim-col">
            <div className="git-term-head"><span><i className="dot g" />{b.labels?.[k] || name}</span>{waiting[k] && <span className="pg-wait">⏳ esperando</span>}</div>
            <div className="git-term-out" style={{ minHeight: 120, maxHeight: 420 }}>
              {cols[k].length === 0 && <div className="info">{n === 0 ? "Pulsa «Empezar»." : "…"}</div>}
              {cols[k].map((e, i) =>
                e.kind === "in"
                  ? <div key={i} className={"cmd" + (e.step === n - 1 ? " pg-now" : "")}><span className="prompt">{e.prompt}</span>{e.text}</div>
                  : <pre key={i} className={e.late ? "pg-late" : ""}>{e.text.replace(/\n$/, "")}</pre>
              )}
              {waiting[k] && <div className="pg-wait-line">⏳ La orden no termina: está esperando un bloqueo…</div>}
            </div>
          </div>
        ))}
      </div>
      {cur && (
        <div className={"pg-sim-note" + (asking ? " ask" : "")}>
          <b>Paso {n}</b> · {b.labels?.[sessions.indexOf(cur.s)] || cur.s}
          {asking ? (
            <div>
              <span dangerouslySetInnerHTML={{ __html: fmt(cur.ask!) }} />
              <div style={{ marginTop: 8 }}><button className="btn small primary" onClick={() => setRevealed((r) => ({ ...r, [n - 1]: true }))}>Mostrar qué pasa</button></div>
            </div>
          ) : cur.note ? <div dangerouslySetInnerHTML={{ __html: fmt(cur.note) }} /> : null}
        </div>
      )}
      {b.caption && <div className="codecap" dangerouslySetInnerHTML={{ __html: fmt(b.caption) }} />}
    </div>
  );
}
