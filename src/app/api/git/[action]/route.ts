import fs from "fs";
import path from "path";
// Motor en JS puro (compartido con el validador scripts/validate-git.mjs)
import * as G from "../../../../../lib-node/git-engine.mjs";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Seguridad: esta API ejecuta Git real en el computador. Solo responde a la propia plataforma:
 * host local (evita DNS rebinding), cabecera propia (una web ajena no puede enviarla sin CORS,
 * y aquí no hay CORS) y mismo origen.
 */
function allowed(req: Request) {
  const host = req.headers.get("host") || "";
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return false;
  if (req.headers.get("x-cuaderno") !== "git") return false;
  const origin = req.headers.get("origin");
  if (origin) { try { if (new URL(origin).host !== host) return false; } catch { return false; } }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return true;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

function loadSection(course: string, section: string): Section | null {
  if (!/^[\w-]+$/.test(course) || !/^[\w-]+$/.test(section)) return null;
  const f = path.join(process.cwd(), "content", course, section + ".json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}

type Body = {
  session?: string; line?: string; content?: string; cancel?: boolean; path?: string;
  kind?: "exercise" | "demo" | "lab"; course?: string; section?: string; exercise?: string; lesson?: string; block?: number;
};

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  if (!allowed(req)) return json({ error: "No permitido" }, 403);
  const { action } = await ctx.params;
  let b: Body;
  try { b = await req.json(); } catch { return json({ error: "JSON no válido" }, 400); }

  if (action === "session") {
    // El escenario se lee del contenido del curso en el servidor: el navegador nunca envía scripts
    let setup = "", cwd = "", exercise = null as null | { course: string; section: string; id: string };
    if (b.kind === "exercise" && b.course && b.section && b.exercise) {
      const x = loadSection(b.course, b.section)?.exercises?.find((e) => e.id === b.exercise) as { setup?: string; cwd?: string } | undefined;
      if (!x) return json({ error: "Ejercicio no encontrado" }, 404);
      setup = x.setup || ""; cwd = x.cwd || "";
      exercise = { course: b.course, section: b.section, id: b.exercise };
    } else if (b.kind === "demo" && b.course && b.section && b.lesson && typeof b.block === "number") {
      const blk = loadSection(b.course, b.section)?.lessons.find((l) => l.id === b.lesson)?.blocks[b.block] as { type: string; setup?: string; cwd?: string } | undefined;
      if (!blk || blk.type !== "code") return json({ error: "Demostración no encontrada" }, 404);
      setup = blk.setup || ""; cwd = blk.cwd || "";
    } else if (b.kind !== "lab") return json({ error: "Tipo de sesión no válido" }, 400);
    try {
      const s = await G.createSession({ setup, cwd });
      s.exercise = exercise;
      return json({ session: s.id, state: await G.getState(s) });
    } catch (e) {
      return json({ error: String((e as Error).message || e) }, 500);
    }
  }

  const s = b.session ? G.getSession(b.session) : null;
  if (!s) return json({ error: "La sesión expiró. Reinicia la terminal." }, 410);

  if (action === "exec") {
    if (typeof b.line !== "string" || b.line.length > 4000) return json({ error: "Comando no válido" }, 400);
    const r = await G.execLine(s, b.line);
    return json({ ...r, state: await G.getState(s) });
  }
  if (action === "edit") {
    const r = await G.answerEditor(s, String(b.content ?? ""), !!b.cancel);
    return json({ ...r, state: await G.getState(s) });
  }
  if (action === "file") {
    if (typeof b.path !== "string" || typeof b.content !== "string") return json({ error: "Datos no válidos" }, 400);
    try { G.writeFile(s, b.path, b.content); } catch (e) { return json({ error: String((e as Error).message) }, 400); }
    return json({ ok: true, state: await G.getState(s) });
  }
  if (action === "state") return json({ state: await G.getState(s) });
  if (action === "check") {
    if (!s.exercise) return json({ error: "Esta terminal no es de un ejercicio" }, 400);
    const x = loadSection(s.exercise.course, s.exercise.section)?.exercises?.find((e) => e.id === s.exercise!.id) as { checks: { name: string; script: string }[]; cwd?: string } | undefined;
    if (!x) return json({ error: "Ejercicio no encontrado" }, 404);
    if (s.pending) return json({ results: x.checks.map((c) => ({ name: c.name, ok: false, msg: "Termina primero lo que Git está esperando en el editor" })) });
    return json({ results: await G.runChecks(s, x.checks, x.cwd || "") });
  }
  if (action === "close") { G.destroySession(s.id); return json({ ok: true }); }
  return json({ error: "Acción desconocida" }, 404);
}
