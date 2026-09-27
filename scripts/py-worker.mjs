// Hilo que ejecuta código Python con Pyodide para scripts/validate-course.mjs
import { parentPort, workerData } from "worker_threads";
import { loadPyodide } from "pyodide";

const py = await loadPyodide();
py.setStdout({ batched: () => {} });
py.setStderr({ batched: () => {} });
const last = (e) => { const m = String((e && e.message) || e).trim().split("\n"); return m[m.length - 1]; };

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

async function execCode(code, ns) {
  if (!py.globals.has("__cuaderno_exec")) py.runPython(EXEC_HELPER);
  const r = await py.globals.get("__cuaderno_exec")(code, ns);
  return r === undefined || r === null ? null : r;
}

let liberar = null;
async function fresh(moduleName) {
  if (!py.globals.has("__cuaderno_modulo")) py.runPython(MODULE_HELPERS);
  const pair = py.globals.get("__cuaderno_modulo")(moduleName);
  const ns = pair.get(0);
  const prev = pair.get(1);
  pair.destroy();
  liberar = () => { py.globals.get("__cuaderno_liberar")(moduleName, prev); if (prev && prev.destroy) prev.destroy(); liberar = null; };
  await py.runPythonAsync("import os, tempfile\nos.chdir(tempfile.mkdtemp())", { globals: ns });
  await py.runPythonAsync(workerData.prelude, { globals: ns });
  return ns;
}

async function runTests(code, x) {
  py.runPython(SNAP);
  try { return await runTestsInner(code, x); } finally { if (liberar) liberar(); py.runPython(RESTORE); }
}

async function runTestsInner(code, x) {
  const ns = await fresh("solucion");
  try { const ex = await execCode(code, ns); if (ex !== null) { ns.destroy(); return { codeError: `sys.exit(${ex}) al cargar el módulo`, results: x.tests.map((t) => ({ name: t.name, ok: false })) }; } }
  catch (e) { ns.destroy(); return { codeError: last(e), results: x.tests.map((t) => ({ name: t.name, ok: false })) }; }
  if (x.setup) {
    try { await execCode(x.setup, ns); }
    catch (e) { ns.destroy(); return { setupError: last(e), results: [] }; }
  }
  const results = [];
  for (const t of x.tests) {
    try { const ex = await execCode(t.code, ns); results.push(ex === null ? { name: t.name, ok: true } : { name: t.name, ok: false, msg: `sys.exit(${ex}) durante la prueba` }); }
    catch (e) { results.push({ name: t.name, ok: false, msg: last(e) }); }
  }
  ns.destroy();
  return { results };
}

parentPort.on("message", async (job) => {
  try {
    if (job.kind === "exercise") {
      const sol = await runTests(job.x.solution, job.x);
      const sta = await runTests(job.x.starter || "", job.x);
      parentPort.postMessage({ type: "done", i: job.i, sol, sta });
    } else {
      py.runPython(SNAP);
      const ns = await fresh("__main__");
      await py.runPythonAsync("_instalar_entradas(" + JSON.stringify(job.stdin || []) + ")", { globals: ns });
      let error = null;
      try { await execCode(job.code, ns); } catch (e) { error = last(e); }
      await py.runPythonAsync("_restaurar_entradas()", { globals: ns });
      ns.destroy();
      if (liberar) liberar();
      py.runPython(RESTORE);
      parentPort.postMessage({ type: "done", i: job.i, error });
    }
  } catch (e) {
    parentPort.postMessage({ type: "done", i: job.i, fatal: last(e) });
  }
});
parentPort.postMessage({ type: "ready" });
