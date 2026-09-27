"use client";

import { useState } from "react";
import type { Lab } from "@/lib/types";
import { fmt } from "@/lib/format";
import CodeBlock from "./CodeBlock";
import { pkey, useProgress } from "./ProgressProvider";

const F = ({ t }: { t: string }) => <span dangerouslySetInnerHTML={{ __html: fmt(t) }} />;

export default function Labs({ courseId, labs, intro }: { courseId: string; labs: Lab[]; intro?: string }) {
  const { p, update } = useProgress();
  const [open, setOpen] = useState<string | null>(null);
  if (!labs.length) return <div className="empty">Esta sección no tiene prácticas.</div>;
  return (
    <div className="stack">
      <div className="callout tip">
        <span className="lbl">Antes de empezar</span>
        <div>{intro ? <F t={intro} /> : "Sigue los pasos y márcalos al completarlos."}</div>
      </div>
      {labs.map((lab) => {
        const isOpen = open === lab.id;
        const done = !!p.labs[pkey(courseId, lab.id)];
        const sdone = lab.steps.filter((_, j) => p.steps[pkey(courseId, lab.id + "#" + j)]).length;
        return (
          <div className="lab" key={lab.id}>
            <button className="lab-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : lab.id)}>
              <div className="spread">
                <span className="eyebrow">Práctica{lab.minutes ? ` · ${lab.minutes} min` : ""}</span>
                {done ? <span className="pill good">✓ Hecha</span> : <span className="pill num">{sdone}/{lab.steps.length} pasos</span>}
              </div>
              <h3 style={{ fontSize: 19 }}>{lab.title}</h3>
              <span className="muted"><F t={lab.goal} /></span>
            </button>
            {isOpen && (
              <div className="lab-body">
                <dl className="kv">
                  {lab.cost && <><dt>Coste</dt><dd><F t={lab.cost} /></dd></>}
                  {!!lab.prereqs?.length && <><dt>Necesitas</dt><dd><F t={lab.prereqs.join(" · ")} /></dd></>}
                </dl>
                {lab.steps.map((st, j) => {
                  const k = pkey(courseId, lab.id + "#" + j);
                  const on = !!p.steps[k];
                  return (
                    <div className="step" key={j}>
                      <button className={"step-no" + (on ? " on" : "")} aria-pressed={on} aria-label={`Marcar paso ${j + 1}`}
                        onClick={() => update((d) => { if (d.steps[k]) delete d.steps[k]; else d.steps[k] = 1; })}>{on ? "✓" : j + 1}</button>
                      <div className="stack" style={{ gap: 8 }}>
                        <h4><F t={st.title} /></h4>
                        <p><F t={st.detail} /></p>
                        {st.code && <CodeBlock code={st.code} lang={st.lang} />}
                      </div>
                    </div>
                  );
                })}
                {!!lab.verify?.length && (
                  <div className="callout tip"><span className="lbl">Comprueba</span><div><ul style={{ margin: 0, paddingLeft: 18 }}>{lab.verify.map((v, i) => <li key={i}><F t={v} /></li>)}</ul></div></div>
                )}
                {lab.cleanup && <div className="callout warn"><span className="lbl">Limpieza</span><div><F t={lab.cleanup} /></div></div>}
                {lab.challenge && <div className="callout exam"><span className="lbl">Reto</span><div><F t={lab.challenge} /></div></div>}
                <div className="row">
                  <button className={"btn" + (done ? "" : " primary")} onClick={() => update((d) => { const k = pkey(courseId, lab.id); if (d.labs[k]) delete d.labs[k]; else d.labs[k] = Date.now(); })}>
                    {done ? "✓ Práctica hecha" : "Marcar práctica como hecha"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
