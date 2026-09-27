import fs from "fs/promises";
import path from "path";

// El progreso vive en data/progress.json, en tu disco. Sin cuentas ni servicios externos.
const FILE = path.join(process.cwd(), "data", "progress.json");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return new Response(raw, { headers: { "content-type": "application/json" } });
  } catch {
    return Response.json(null);
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || (body as { v?: number }).v !== 1) {
    return Response.json({ error: "Formato de progreso no válido" }, { status: 400 });
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(body));
  await fs.rename(tmp, FILE);
  return Response.json({ ok: true });
}
