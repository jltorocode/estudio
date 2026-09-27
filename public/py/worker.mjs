// Hilo que ejecuta Python (Pyodide, CPython 3.14) para el Cuaderno. Todo local: /pyodide y /py/prelude.py.
import { loadPyodide } from "/pyodide/pyodide.mjs";

let py = null;
let prelude = "";
const decoder = new TextDecoder();
let current = null; // { id, buf, timer, size }
const LIMIT = 200_000; // caracteres máximos de salida por ejecución

function flush() {
  if (!current || !current.buf) return;
  postMessage({ type: "out", id: current.id, text: current.buf });
  current.buf = "";
}
function write(text) {
  if (!current) return;
  if (current.size > LIMIT) return;
  current.size += text.length;
  current.buf += current.size > LIMIT ? text + "\n… (salida recortada: demasiado texto)\n" : text;
  if (!current.timer) current.timer = setTimeout(() => { current && (current.timer = null); flush(); }, 40);
}

const ready = (async () => {
  py = await loadPyodide({ indexURL: "/pyodide/" });
  prelude = await (await fetch("/py/prelude.py")).text();
  py.setStdout({ write: (b) => { write(decoder.decode(b, { stream: true })); return b.length; } });
  py.setStderr({ write: (b) => { write(decoder.decode(b, { stream: true })); return b.length; } });
  const version = py.runPython("import sys; sys.version.split()[0]");
  await py.runPythonAsync("import os\nos.makedirs('/home/pyodide/lab', exist_ok=True)");
  postMessage({ type: "ready", version });
})().catch((e) => postMessage({ type: "fatal", message: String((e && e.message) || e) }));

// Traceback legible: sin marcos internos de Pyodide y con «tu código» en lugar de <exec>
function cleanTraceback(msg) {
  const lines = String(msg).replace(/\s+$/, "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s+File "(\/lib\/python|<cuaderno>)/.test(l) || /_pyodide/.test(l)) {
      // saltar el marco interno y su línea de código (y marcadores ^^^)
      while (lines[i + 1] && /^\s{4,}/.test(lines[i + 1]) && !/^\s+File /.test(lines[i + 1])) i++;
      continue;
    }
    out.push(l.replace(/File "<exec>"/g, 'File "tu código"'));
  }
  return out.join("\n");
}
// Texto de la excepción final (admite mensajes de varias líneas): lo que va tras el último marco del traceback
function excText(msg) {
  const lines = String(msg).replace(/\s+$/, "").split("\n");
  let i = -1;
  lines.forEach((l, k) => { if (/^\s+File "/.test(l)) i = k; });
  if (i < 0) return lines[lines.length - 1];
  i++;
  while (i < lines.length && /^\s{4,}/.test(lines[i])) i++;
  return lines.slice(i).join("\n") || lines[lines.length - 1];
}
const lastLine = excText;

// Como en un script real: al ejecutar, __name__ == "__main__"; al comprobar, el código se importa como módulo
const MODULE_HELPERS = [
  "import sys, types",
  "def __cuaderno_modulo(nombre):",
  "    m = types.ModuleType(nombre)",
  "    anterior = sys.modules.get(nombre)",
  "    sys.modules[nombre] = m",
  "    return m.__dict__, anterior",
  "def __cuaderno_liberar(nombre, anterior):",
  "    if anterior is not None:",
  "        sys.modules[nombre] = anterior",
  "    else:",
  "        sys.modules.pop(nombre, None)"
].join("\n");

// Ejecuta código como lo haría Python con un script, pero capturando SystemExit (sys.exit, exit(), argparse):
// en Pyodide un SystemExit sin capturar apaga el intérprete entero.
const EXEC_HELPER = `import ast as _ast, inspect as _inspect, sys as _sys
_src = """
async def __cuaderno_exec(codigo, ns):
    co = compile(codigo, '<exec>', 'exec', flags=_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT, dont_inherit=True)
    try:
        r = eval(co, ns)
        if _inspect.iscoroutine(r):
            await r
    except SystemExit as e:
        c = e.code
        if isinstance(c, str):
            print(c, file=_sys.stderr)
            return 1
        return 0 if c is None else c
    return None
"""
exec(compile(_src, '<cuaderno>', 'exec'), globals())`;

const SNAP = "import sys\n__cuaderno_snap = (set(sys.modules), list(sys.path))";
const RESTORE = [
  "import sys, importlib",
  "_mods, _path = __cuaderno_snap",
  "for _k in list(sys.modules):",
  "    if _k not in _mods:",
  "        _f = getattr(sys.modules[_k], '__file__', None) or ''",
  "        if not _f.startswith('/lib/'):",
  "            del sys.modules[_k]",
  "sys.path[:] = _path",
  "importlib.invalidate_caches()"
].join("\n");

// El código del alumno se ejecuta en un módulo real registrado en sys.modules:
// "__main__" al ejecutar (como un script) y "solucion" al comprobar (como al importar un módulo con pytest).
async function execCode(code, ns) {
  if (!py.globals.has("__cuaderno_exec")) py.runPython(EXEC_HELPER);
  const r = await py.globals.get("__cuaderno_exec")(code, ns);
  return r === undefined || r === null ? null : r;
}

let liberar = null;
async function fresh(persistent, moduleName) {
  if (!py.globals.has("__cuaderno_modulo")) py.runPython(MODULE_HELPERS);
  const pair = py.globals.get("__cuaderno_modulo")(moduleName);
  const ns = pair.get(0);
  const prev = pair.get(1);
  pair.destroy();
  liberar = () => { py.globals.get("__cuaderno_liberar")(moduleName, prev); if (prev && prev.destroy) prev.destroy(); liberar = null; };
  await py.runPythonAsync(
    persistent ? "import os\nos.chdir('/home/pyodide/lab')" : "import os, tempfile\nos.chdir(tempfile.mkdtemp())",
    { globals: ns }
  );
  await py.runPythonAsync(prelude, { globals: ns });
  return ns;
}

self.onmessage = async (ev) => {
  const job = ev.data;
  await ready;
  if (!py) return;
  current = { id: job.id, buf: "", timer: null, size: 0 };
  const t0 = performance.now();
  let ns = null;
  try {
    // Cada ejecución empieza limpia: se olvidan los módulos que cree el alumno y se restaura sys.path al terminar
    py.runPython(SNAP);
    ns = await fresh(job.persistent, job.kind === "run" ? "__main__" : "solucion");
    await py.runPythonAsync("_instalar_entradas(" + JSON.stringify(job.stdin || []) + ")", { globals: ns });
    if (job.kind === "run") {
      let error = null;
      try {
        const exit = await execCode(job.code, ns);
        if (exit !== null) write(`\n[El programa terminó con sys.exit(${exit})]\n`);
      } catch (e) { error = cleanTraceback(e.message); }
      flush();
      postMessage({ type: "done", id: job.id, error, ms: Math.round(performance.now() - t0) });
    } else {
      // Corrección: código del alumno + setup + cada test por separado
      let codeError = null;
      try {
        const exit = await execCode(job.code, ns);
        if (exit !== null) codeError = `Tu código terminó con sys.exit(${exit}) al cargarse. Las pruebas importan tu código como un módulo: pon las llamadas a sys.exit() dentro de funciones o del bloque if __name__ == "__main__":`;
      } catch (e) { codeError = cleanTraceback(e.message); }
      const results = [];
      if (!codeError) {
        await py.runPythonAsync("_restaurar_entradas()", { globals: ns });
        if (job.setup) {
          try { await execCode(job.setup, ns); }
          catch (e) { codeError = "Error preparando la prueba: " + lastLine(e.message); }
        }
        if (!codeError) for (const t of job.tests) {
          try {
            const exit = await execCode(t.code, ns);
            results.push(exit === null ? { name: t.name, ok: true } : { name: t.name, ok: false, msg: `El código llamó a sys.exit(${exit}) durante la prueba` });
          }
          catch (e) { results.push({ name: t.name, ok: false, msg: lastLine(e.message) }); }
        }
      }
      flush();
      postMessage({ type: "done", id: job.id, codeError, results, ms: Math.round(performance.now() - t0) });
    }
  } catch (e) {
    flush();
    postMessage({ type: "done", id: job.id, error: "Pyodide fatal error: " + cleanTraceback((e && e.message) || e) });
  } finally {
    try { await py.runPythonAsync("_restaurar_entradas()", { globals: ns }); } catch { /* sin espacio de nombres */ }
    if (ns) ns.destroy();
    if (liberar) try { liberar(); } catch { /* ya liberado */ }
    try { py.runPython(RESTORE); } catch { /* sin instantánea */ }
    if (current && current.timer) clearTimeout(current.timer);
    current = null;
  }
};
