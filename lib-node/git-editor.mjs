// "Editor" que Git abre (GIT_EDITOR / GIT_SEQUENCE_EDITOR) en la terminal de práctica.
// No edita nada por sí mismo: publica el archivo en CUADERNO_BRIDGE_DIR y espera a que la
// plataforma devuelva el contenido que escribió el alumno en su editor (o que cancele).
import fs from "fs";
import path from "path";

const file = process.argv[process.argv.length - 1];
const dir = process.env.CUADERNO_BRIDGE_DIR;
if (!dir || !file) process.exit(1);

const id = `${Date.now()}-${process.pid}`;
const request = path.join(dir, `request-${id}.json`);
const response = path.join(dir, `response-${id}.json`);
fs.mkdirSync(dir, { recursive: true });
let content = "";
try { content = fs.readFileSync(file, "utf8"); } catch { content = ""; }
fs.writeFileSync(request + ".tmp", JSON.stringify({ id, file: path.resolve(file), content }));
fs.renameSync(request + ".tmp", request);

const LIMIT = Date.now() + 30 * 60 * 1000; // 30 minutos como máximo
const timer = setInterval(() => {
  if (fs.existsSync(response)) {
    clearInterval(timer);
    let r = { ok: false };
    try { r = JSON.parse(fs.readFileSync(response, "utf8")); } catch { /* respuesta inválida = cancelar */ }
    try { fs.unlinkSync(response); } catch { /* ya borrada */ }
    try { fs.unlinkSync(request); } catch { /* ya borrada */ }
    if (r.ok) { fs.writeFileSync(file, r.content ?? ""); process.exit(0); }
    process.exit(1);
  }
  if (Date.now() > LIMIT) { clearInterval(timer); try { fs.unlinkSync(request); } catch { /* ya borrada */ } process.exit(1); }
}, 60);
