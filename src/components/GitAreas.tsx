"use client";

import type { GitFile, GitState } from "@/lib/gitApi";

const OPS: Record<string, string> = {
  merge: "Merge en curso: resuelve los conflictos, git add y git commit (o git merge --abort).",
  rebase: "Rebase en curso: resuelve, git add y git rebase --continue (o --skip / --abort).",
  "cherry-pick": "Cherry-pick en curso: resuelve y git cherry-pick --continue (o --abort).",
  revert: "Revert en curso: resuelve y git revert --continue (o --abort).",
  bisect: "Bisect en curso: marca git bisect good/bad; al terminar, git bisect reset."
};

function Files({ list, empty }: { list: GitFile[]; empty: string }) {
  if (!list.length) return <span className="faint">{empty}</span>;
  return (
    <ul>
      {list.slice(0, 40).map((f) => (
        <li key={f.kind + f.name} className={"gf gf-" + f.kind.replace(/\s+/g, "-")}>
          <code>{f.name}</code><span>{f.kind}</span>
        </li>
      ))}
      {list.length > 40 && <li className="faint">… y {list.length - 40} más</li>}
    </ul>
  );
}

/** Las tres áreas de Git: directorio de trabajo, área de preparación (index) y repositorio. */
export default function GitAreas({ state }: { state: GitState | null }) {
  if (!state?.repo) return null;
  if (state.bare) return <div className="git-areas"><div className="area"><h4>Repositorio bare</h4><span className="faint">Sin directorio de trabajo: es un repositorio para compartir (como un servidor).</span></div></div>;
  const f = state.files || { staged: [], unstaged: [], untracked: [], conflicts: [] };
  const work = [...f.conflicts, ...f.unstaged, ...f.untracked];
  const headCommit = state.commits?.find((c) => c.sha === state.head);
  return (
    <div className="git-areas">
      {state.operation && <div className="git-op">{OPS[state.operation] || state.operation}</div>}
      <div className="area">
        <h4><span className="n">1</span> Directorio de trabajo</h4>
        <Files list={work} empty="Sin cambios" />
      </div>
      <div className="area">
        <h4><span className="n">2</span> Área de preparación</h4>
        <Files list={f.staged} empty="Nada preparado" />
      </div>
      <div className="area">
        <h4><span className="n">3</span> Repositorio</h4>
        {headCommit ? (
          <div className="repo-info">
            <div><b>{state.branch ? `HEAD → ${state.branch}` : "HEAD separado"}</b> <code>{headCommit.sha.slice(0, 7)}</code></div>
            <div className="faint">«{headCommit.subject}»</div>
          </div>
        ) : <span className="faint">Sin commits todavía</span>}
        {state.upstream && <div className="faint">Sigue a <code>{state.upstream}</code>{state.ahead ? ` · ${state.ahead} por delante` : ""}{state.behind ? ` · ${state.behind} por detrás` : ""}{!state.ahead && !state.behind ? " · al día" : ""}</div>}
        {!!state.stash?.length && <div className="faint">{state.stash.length} en el stash</div>}
      </div>
    </div>
  );
}
