"use client";

import type { GitState } from "@/lib/gitApi";

const ROW = 30;
const LANE = 18;
const PAD = 12;
const COLORS = ["var(--blaze)", "var(--lake)", "var(--pine)", "var(--amber)", "#B0579B", "var(--ink-3)"];

type Row = { sha: string; lane: number; parents: string[]; subject: string; author: string; date: string };

/** Asigna un carril a cada commit (orden topológico, del más nuevo al más antiguo). */
function layout(commits: NonNullable<GitState["commits"]>) {
  const lanes: (string | null)[] = [];
  const rows: Row[] = [];
  for (const c of commits) {
    let lane = lanes.indexOf(c.sha);
    if (lane < 0) { lane = lanes.indexOf(null); if (lane < 0) { lane = lanes.length; lanes.push(null); } }
    for (let i = 0; i < lanes.length; i++) if (i !== lane && lanes[i] === c.sha) lanes[i] = null;
    c.parents.forEach((p, k) => {
      if (k === 0) { lanes[lane] = p; return; }
      if (lanes.indexOf(p) < 0) { let j = lanes.indexOf(null); if (j < 0) { j = lanes.length; lanes.push(null); } lanes[j] = p; }
    });
    if (!c.parents.length) lanes[lane] = null;
    rows.push({ ...c, lane });
  }
  const width = Math.max(1, ...rows.map((r) => r.lane + 1));
  return { rows, width };
}

export default function GitGraph({ state, height = 320 }: { state: GitState | null; height?: number }) {
  if (!state) return <div className="git-empty">Preparando…</div>;
  if (!state.repo) return <div className="git-empty">Aquí todavía no hay un repositorio de Git.<br /><span className="faint">Entra en uno con <code>cd</code> o crea uno con <code>git init</code>.</span></div>;
  const commits = state.commits || [];
  if (!commits.length) return <div className="git-empty">Repositorio vacío: aún no hay commits.<br /><span className="faint">Prepara archivos con <code>git add</code> y confirma con <code>git commit</code>.</span></div>;

  const { rows, width } = layout(commits);
  const pos = new Map(rows.map((r, i) => [r.sha, { i, lane: r.lane }]));
  const x = (lane: number) => PAD + lane * LANE;
  const y = (i: number) => ROW / 2 + i * ROW;
  const svgW = PAD * 2 + (width - 1) * LANE;
  const svgH = rows.length * ROW;

  // Etiquetas por commit
  const labels = new Map<string, { text: string; kind: string }[]>();
  const add = (sha: string, l: { text: string; kind: string }) => { const a = labels.get(sha) || []; a.push(l); labels.set(sha, a); };
  for (const r of state.refs || []) {
    if (r.name.startsWith("refs/heads/")) {
      const n = r.name.slice(11);
      add(r.sha, { text: state.branch === n ? `HEAD → ${n}` : n, kind: state.branch === n ? "head" : "branch" });
    } else if (r.name.startsWith("refs/remotes/")) { if (!r.name.endsWith("/HEAD")) add(r.sha, { text: r.name.slice(13), kind: "remote" }); }
    else if (r.name.startsWith("refs/tags/")) add(r.sha, { text: "tag: " + r.name.slice(10), kind: "tag" });
  }
  if (!state.branch && state.head) add(state.head, { text: "HEAD (separado)", kind: "head" });

  const edges: React.ReactNode[] = [];
  rows.forEach((r, i) => {
    r.parents.forEach((p, k) => {
      const color = COLORS[r.lane % COLORS.length];
      const to = pos.get(p);
      const x1 = x(r.lane), y1 = y(i);
      if (!to) { edges.push(<path key={r.sha + p} d={`M${x1} ${y1} L${x1} ${svgH}`} stroke={color} strokeWidth="2" fill="none" strokeDasharray="3 3" />); return; }
      const x2 = x(to.lane), y2 = y(to.i);
      let d: string;
      if (x1 === x2) d = `M${x1} ${y1} L${x2} ${y2}`;
      else if (k > 0) d = `M${x1} ${y1} C${x1} ${y1 + ROW * 0.6}, ${x2} ${y1 + ROW * 0.4}, ${x2} ${y1 + ROW} L${x2} ${y2}`; // fusión: se abre cerca del hijo
      else d = `M${x1} ${y1} L${x1} ${y2 - ROW} C${x1} ${y2 - ROW * 0.4}, ${x2} ${y2 - ROW * 0.6}, ${x2} ${y2}`; // rama: se une cerca del padre
      edges.push(<path key={r.sha + p} d={d} stroke={k > 0 ? COLORS[to.lane % COLORS.length] : color} strokeWidth="2" fill="none" />);
    });
  });

  return (
    <div className="git-graph" style={{ maxHeight: height }}>
      <div className="git-graph-inner" style={{ gridTemplateColumns: `${svgW}px minmax(0, 1fr)` }}>
        <svg width={svgW} height={svgH} aria-hidden="true">
          {edges}
          {rows.map((r, i) => {
            const isHead = r.sha === state.head;
            const color = COLORS[r.lane % COLORS.length];
            const merge = r.parents.length > 1;
            return (
              <g key={r.sha} className="git-node">
                {isHead && <circle cx={x(r.lane)} cy={y(i)} r="9.5" fill="none" stroke="var(--ink)" strokeWidth="2" />}
                <circle cx={x(r.lane)} cy={y(i)} r={merge ? 5 : 6} fill={merge ? "var(--surface)" : color} stroke={color} strokeWidth="2.5" />
              </g>
            );
          })}
        </svg>
        <ol className="git-rows" aria-label="Historia de commits">
          {rows.map((r) => (
            <li key={r.sha} style={{ height: ROW }} className={r.sha === state.head ? "is-head" : ""}>
              <code className="sha">{r.sha.slice(0, 7)}</code>
              {(labels.get(r.sha) || []).map((l) => <span key={l.text} className={"ref ref-" + l.kind}>{l.text}</span>)}
              <span className="subject" title={r.subject}>{r.subject}</span>
              <span className="meta">{r.author} · {r.date}</span>
            </li>
          ))}
        </ol>
      </div>
      {commits.length >= 80 && <div className="faint" style={{ padding: "6px 10px" }}>Se muestran los 80 commits más recientes.</div>}
    </div>
  );
}
