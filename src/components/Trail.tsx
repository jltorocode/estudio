"use client";

import Link from "next/link";
import type { Camp } from "@/lib/metas";
import { pad2 } from "@/lib/format";
import { FlagIcon } from "./BrandMark";

const VW = 1000;

type Layout = { pts: (readonly [number, number])[]; VH: number; up: boolean[] };

/**
 * Hasta 12 campamentos: un zigzag que sube hacia la cumbre (arriba a la derecha).
 * Con más: una serpentina de varias filas que asciende de abajo arriba; dentro de cada fila las
 * etiquetas alternan arriba/abajo para no tocarse.
 */
function layout(n: number): Layout {
  if (n <= 12) {
    const VH = 540;
    const pts = Array.from({ length: n }, (_, i) => {
      const last = i === n - 1;
      const x = 64 + (i / (n - 1)) * (VW - 150);
      const base = 350 - i * 15;
      const y = last ? 92 : base + (i % 2 ? -78 : 78);
      return [x, y] as const;
    });
    const up = pts.map((_, i) => i % 2 === 1 && i !== n - 2);
    return { pts, VH, up };
  }
  const perRow = 7;
  const rows = Math.ceil(n / perRow);
  const rowGap = 190;
  const VH = 150 + rows * rowGap;
  const pts: (readonly [number, number])[] = [];
  const up: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const cols = Math.min(perRow, n - row * perRow);
    const t = cols === 1 ? 0.5 : col / (perRow - 1);
    const ltr = row % 2 === 0;
    const x = 80 + (ltr ? t : 1 - t) * (VW - 160);
    const yBase = VH - 100 - row * rowGap;
    const y = yBase + (col % 2 ? -26 : 26);
    pts.push([x, y] as const);
    up.push(col % 2 === 1);
  }
  return { pts, VH, up };
}

function smooth(pts: readonly (readonly [number, number])[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export default function Trail({ courseId, code, camps, readiness }: { courseId: string; code: string; camps: Camp[]; readiness: number }) {
  const { pts, VH, up: upList } = layout(camps.length + 1);
  // El tramo recorrido llega hasta el último campamento alcanzado de forma consecutiva
  let reached = 0;
  while (reached < camps.length && camps[reached].status === "reached") reached++;
  // El tramo recorrido va del inicio a tu campamento actual (o a la cumbre si los tienes todos)
  const doneD = reached > 0 ? smooth(pts.slice(0, reached + 1)) : "";

  return (
    <div className="trail">
      <div style={{ position: "relative" }}>
        <svg className="path" viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Mapa de ruta: ${reached} de ${camps.length} campamentos alcanzados`}>
          <path className="route" d={smooth(pts)} />
          {doneD && <path className="route-done" d={doneD} pathLength={1000} style={{ strokeDasharray: 1000, ["--len" as string]: 1000 }} />}
        </svg>
        {camps.map((c, i) => {
          const [x, y] = pts[i];
          const up = upList[i];
          return (
            <Link key={c.id} href={`/${courseId}/${c.id}`} className={`camp ${c.status}`}
              style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%`, transform: up ? "translate(-50%, calc(-100% + 17px))" : "translate(-50%, -17px)", flexDirection: up ? "column-reverse" : "column" }}
              title={c.title}>
              <span className="marker">{c.status === "reached" ? "✓" : pad2(c.order)}</span>
              <span className="label">{c.short}</span>
              <span className="alt">{c.status === "reached" ? "alcanzado" : `${c.criteria.filter((x) => x.done).length}/${c.criteria.length} metas`}</span>
            </Link>
          );
        })}
        {(() => {
          const [x, y] = pts[pts.length - 1];
          return (
            <Link href={`/${courseId}/simulacro`} className="camp summit-camp" style={{ left: `${(x / VW) * 100}%`, top: `${(y / VH) * 100}%`, transform: upList[pts.length - 1] || camps.length < 12 ? "translate(-50%, calc(-100% + 23px))" : "translate(-50%, -23px)", flexDirection: upList[pts.length - 1] || camps.length < 12 ? "column-reverse" : "column" }} title="La cumbre: el examen">
              <span className="marker"><FlagIcon /></span>
              <span className="label">Cumbre · {code}</span>
              <span className="alt">Preparación {readiness} %</span>
            </Link>
          );
        })()}
      </div>
      <div className="trail-list">
        {camps.map((c) => (
          <Link key={c.id} href={`/${courseId}/${c.id}`}>
            <span className={"blaze " + (c.status === "reached" ? "done" : c.status === "current" ? "" : "ghost")}>{c.status === "reached" ? "✓" : pad2(c.order)}</span>
            <span><b>{c.short}</b><br /><span className="faint">{c.criteria.filter((x) => x.done).length}/{c.criteria.length} metas cumplidas</span></span>
            <span className="faint">→</span>
          </Link>
        ))}
        <Link href={`/${courseId}/simulacro`}>
          <span className="blaze lake">▲</span>
          <span><b>Cumbre · examen {code}</b><br /><span className="faint">Preparación {readiness} %</span></span>
          <span className="faint">→</span>
        </Link>
      </div>
      <div className="trail-legend">
        <span><i style={{ background: "var(--pine)" }} />Campamento alcanzado</span>
        <span><i style={{ background: "var(--blaze)" }} />Tu campamento actual</span>
        <span><i style={{ boxShadow: "inset 0 0 0 2px var(--ink-3)" }} />Por delante</span>
      </div>
    </div>
  );
}
