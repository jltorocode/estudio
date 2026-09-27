import type { Readiness } from "@/lib/metas";

/** Índice de preparación con su desglose y la explicación de cómo se calcula. */
export default function ReadinessCard({ r, readyAt }: { r: Readiness; readyAt: number }) {
  return (
    <section className="readiness" aria-label="Índice de preparación para el examen">
      <div className="spread">
        <span className="eyebrow">Preparación para el examen</span>
        <span className="eyebrow">Meta: {readyAt} %</span>
      </div>
      <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
        <div className="big">{r.total}<small>%</small></div>
        <div className="level">{r.level}</div>
      </div>
      <div className="parts">
        {r.parts.map((x) => (
          <div className="part" key={x.key}>
            <span>{x.label} <span style={{ opacity: .6 }}>· peso {Math.round(x.weight * 100)} %</span></span>
            <span className="num" style={{ textAlign: "right" }}>{Math.round(x.value * 100)} %</span>
            <div className="bar"><i style={{ width: `${Math.round(x.value * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="advice">{r.advice}</div>
      <details>
        <summary>¿Cómo se calcula?</summary>
        {r.parts.map((x) => <p key={x.key}><b>{x.label} ({Math.round(x.weight * 100)} %):</b> {x.explain}</p>)}
        <p>Cuando llegues al {readyAt} % tienes el temario cubierto, dominas los tests y tus simulacros están por encima de la meta: es buen momento para reservar el examen.</p>
      </details>
    </section>
  );
}
