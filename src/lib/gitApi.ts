"use client";
// Cliente de la API de la terminal de práctica de Git (/api/git/*).

export type GitFile = { name: string; kind: string };
export type GitState = {
  cwd: string;
  repo: boolean;
  pending?: boolean;
  bare?: boolean;
  root?: string;
  branch?: string | null;
  head?: string | null;
  refs?: { name: string; sha: string }[];
  commits?: { sha: string; parents: string[]; subject: string; author: string; date: string }[];
  files?: { staged: GitFile[]; unstaged: GitFile[]; untracked: GitFile[]; conflicts: GitFile[] };
  upstream?: string | null;
  ahead?: number;
  behind?: number;
  stash?: { ref: string; msg: string }[];
  operation?: string | null;
};
export type ExecResult = {
  out?: string;
  code?: number;
  clear?: boolean;
  rejected?: boolean;
  openFile?: { path: string; content: string } | null;
  editor?: { file: string; content: string };
  pending?: boolean;
  state?: GitState;
  error?: string;
};

export async function gitApi<T = ExecResult>(action: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`/api/git/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-cuaderno": "git" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({ error: "Respuesta no válida del servidor" }));
  if (!r.ok && !data.error) data.error = `Error ${r.status}`;
  return data as T;
}
