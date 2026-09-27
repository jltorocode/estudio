#!/usr/bin/env python3
"""Graba las simulaciones de sesiones simultáneas (bloques "sessions") del curso de PostgreSQL.

Uso: python3 scripts/record-sims.py content/postgresql/s13.json [...]

Herramienta de desarrollo: el alumno nunca la usa (en la plataforma todo es simulado y se reproduce lo grabado).
Para cada bloque crea un clúster PostgreSQL 18 DESECHABLE en una carpeta temporal (solo socket Unix, sin TCP, así que
no toca ningún servidor instalado), carga el conjunto de datos y el setup, abre sesiones psql reales (o bash) en
terminales, ejecuta los pasos en orden y guarda lo que responde PostgreSQL: salida, prompt, si la orden quedó
esperando un bloqueo y cuándo se liberó.
"""
import getpass, json, os, pty, re, select, shutil, signal, subprocess, sys, tempfile, termios, time
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SENT = "\x1f"


def find_bin():
    cands = [os.environ.get("CUADERNO_PG_BIN"), "/opt/homebrew/opt/postgresql@18/bin", "/usr/local/opt/postgresql@18/bin", "/usr/lib/postgresql/18/bin"]
    for c in cands:
        if c and os.path.exists(os.path.join(c, "postgres")):
            return c
    pc = shutil.which("pg_config")
    if pc:
        return subprocess.check_output([pc, "--bindir"], text=True).strip()
    sys.exit("No encuentro PostgreSQL 18 (define CUADERNO_PG_BIN)")


BIN = find_bin()


class Cluster:
    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="pgrec", dir="/tmp")
        self.sock = os.path.join(self.dir, "s")
        self.home = os.path.join(self.dir, "home")
        os.makedirs(self.sock)
        os.makedirs(self.home)
        data = os.path.join(self.dir, "data")
        subprocess.run([f"{BIN}/initdb", "-D", data, "-U", "postgres", "-E", "UTF8", "--no-locale", "-A", "trust"], check=True, capture_output=True)
        with open(os.path.join(data, "postgresql.auto.conf"), "a") as f:
            f.write(f"listen_addresses = ''\nunix_socket_directories = '{self.sock}'\nport = 5432\ntimezone = 'America/Santiago'\nlog_timezone = 'America/Santiago'\nlc_messages = 'C'\n")
        self.data = data
        self.env = dict(os.environ, PATH=f"{BIN}:/usr/bin:/bin", PGHOST=self.sock, PGPORT="5432", PGUSER="postgres", HOME=self.home,
                        LANG="en_US.UTF-8", LC_ALL="en_US.UTF-8", PAGER="", PSQL_PAGER="", COLUMNS="100", PGTZ="America/Santiago")
        # El servidor también arranca con el HOME de la simulación (p. ej. para ~ en archive_command)
        subprocess.run([f"{BIN}/pg_ctl", "-D", data, "-l", os.path.join(self.dir, "log"), "-w", "start"], check=True, capture_output=True, env=self.env)

    def psql(self, db, sql):
        r = subprocess.run([f"{BIN}/psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db], input=sql, text=True, capture_output=True, env=self.env)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.strip())

    def stop(self):
        # Detiene cualquier servidor que se haya iniciado dentro de la carpeta (réplicas, etc.)
        out = subprocess.run(["ps", "-axo", "pid,command"], capture_output=True, text=True).stdout
        for line in out.splitlines():
            if self.dir in line and "postgres" in line and " -D " in line:
                pid = int(line.split()[0])
                try:
                    os.kill(pid, signal.SIGINT)
                except OSError:
                    pass
        subprocess.run([f"{BIN}/pg_ctl", "-D", self.data, "-m", "fast", "-w", "stop"], capture_output=True)
        time.sleep(0.3)
        shutil.rmtree(self.dir, ignore_errors=True)

    def clean(self, text):
        text = text.replace(self.home, "~").replace(self.sock, "/tmp").replace(self.dir, "/tmp/pg")
        # Como en una terminal: un \r vuelve al inicio de la línea (barras de progreso)
        text = "\n".join(l.split("\r")[-1] if "\r" in l else l for l in text.split("\n"))
        # Dueño de los archivos como en un servidor típico
        user = getpass.getuser()
        text = re.sub(r"(?m)^([-dlrwxs@+.]{10,11}\s+\d+\s+)" + re.escape(user) + r"(\s+)(staff|wheel|" + re.escape(user) + r")\b", r"\1postgres\2postgres", text)
        return text


class Term:
    """Una terminal (psql o bash) con eco desactivado; el prompt lleva un centinela para saber cuándo terminó."""

    def __init__(self, cl, argv, kind):
        self.kind = kind
        m, s = pty.openpty()
        a = termios.tcgetattr(s)
        a[1] &= ~termios.ONLCR
        a[3] &= ~termios.ECHO
        termios.tcsetattr(s, termios.TCSANOW, a)
        self.p = subprocess.Popen(argv, stdin=s, stdout=s, stderr=s, env=cl.env, cwd=cl.home, start_new_session=True)
        os.close(s)
        self.m = m
        self.buf = ""
        self.prompt = "$ " if kind == "shell" else ""
        self.waiting = False

    def read(self, timeout):
        end = time.time() + timeout
        while time.time() < end:
            r, _, _ = select.select([self.m], [], [], 0.05)
            if r:
                try:
                    d = os.read(self.m, 65536)
                except OSError:
                    return
                if not d:
                    return
                self.buf += d.decode("utf-8", "replace")
                if SENT in self.buf:
                    return
            elif self.p.poll() is not None:
                return

    def ready(self):
        return SENT in self.buf

    def take(self):
        """Devuelve (salida, prompt) de lo acumulado hasta el último centinela."""
        text = self.buf
        self.buf = ""
        parts = text.split(SENT)
        # Los prompts van como «\x1e<prompt>\x1f»
        out = re.sub("\x1e[^\x1e\x1f]*\x1f", "", text) if "\x1e" in text else text.replace(SENT, "")
        prompts = re.findall("\x1e([^\x1e\x1f]*)\x1f", text)
        if prompts:
            self.prompt = prompts[-1] if self.kind == "psql" else "$ "
        out = out.replace("\r\n", "\n")
        return out, parts

    def send(self, text):
        os.write(self.m, (text + "\n").encode())

    def close(self):
        try:
            os.killpg(self.p.pid, signal.SIGTERM)
        except OSError:
            pass


def record_block(b, where):
    cl = Cluster()
    try:
        db = b.get("database") or b.get("dataset") or "postgres"
        if db != "postgres":
            cl.psql("postgres", f'CREATE DATABASE "{db}"')
        if b.get("dataset"):
            with open(os.path.join(ROOT, "public/pg/datasets", b["dataset"] + ".sql")) as f:
                cl.psql(db, f.read())
        if b.get("setup"):
            cl.psql(db, b["setup"])
        cl.psql(db, "VACUUM ANALYZE")
        shells = set(b.get("shells") or [])
        terms = {}

        def open_term(name):
            # Las sesiones se abren recién cuando se usan: así una sesión psql puede conectarse
            # a un clúster que la terminal creó en pasos anteriores (réplicas, restauraciones…)
            if name in shells:
                t = Term(cl, ["/bin/bash", "--noprofile", "--norc"], "shell")
                t.send("export PS1=$'\\x1e$ \\x1f' PS2='' PROMPT_COMMAND=''; cd ~")
                t.read(3)
                t.take()
            else:
                args = (b.get("connect") or {}).get(name, db).split()
                t = Term(cl, [f"{BIN}/psql", "-X", "-n", "-v", "PROMPT1=\x1e%/%R%x%# \x1f", "-v", "PROMPT2=\x1e%/%R%x%# \x1f", "-v", "PROMPT3=\x1e>> \x1f", *args], "psql")
                t.read(5)
                out, _ = t.take()
                if not t.prompt:
                    raise RuntimeError(f"{where}: no pude abrir psql para {name}: {cl.clean(out)}")
            terms[name] = t
            return t

        for i, st in enumerate(b["steps"]):
            t = terms.get(st["s"]) or open_term(st["s"])
            st["prompt"] = t.prompt
            st.pop("wait", None)
            st.pop("wake", None)
            if t.waiting:
                raise RuntimeError(f"{where} paso {i}: la sesión {st['s']} sigue esperando un bloqueo; no se puede escribir en ella")
            lines = st["in"].split("\n")
            for ln in lines:
                t.send(ln)
            limit = 90 if t.kind == "shell" else 2.5
            # Espera a que aparezcan tantos prompts como líneas enviadas
            end = time.time() + limit
            while time.time() < end and t.buf.count(SENT) < len(lines):
                t.read(max(0.05, end - time.time()))
            if t.buf.count(SENT) >= len(lines):
                out, _ = t.take()
                st["out"] = cl.clean(out)
            else:
                if t.kind == "shell":
                    raise RuntimeError(f"{where} paso {i}: «{st['in']}» no terminó en {limit} s")
                # Quita los prompts de continuación (\x1e…\x1f) que psql imprimió antes de quedarse esperando
                partial = re.sub("\x1e[^\x1e\x1f]*\x1f", "", t.buf)
                partial = re.sub("\x1e[^\x1f]*$", "", partial).replace(SENT, "")
                st["out"] = cl.clean(partial.replace("\r\n", "\n").replace("\r", ""))
                t.buf = ""
                st["wait"] = True
                t.waiting = True
            # ¿Alguna sesión que esperaba terminó? (un COMMIT libera bloqueos; un deadlock se detecta en ~1 s)
            wakes = []
            end = time.time() + (1.4 if any(x.waiting for x in terms.values()) else 0)
            while time.time() < end:
                for name, o in terms.items():
                    if o.waiting and o is not t:
                        o.read(0.05)
                        if o.ready():
                            out, _ = o.take()
                            wakes.append({"s": name, "out": cl.clean(out)})
                            o.waiting = False
                if not any(o.waiting and o is not t for o in terms.values()):
                    break
            if st.get("wait") and t.ready():
                out, _ = t.take()
                st["out"] = (st["out"] or "") + cl.clean(out)
                st.pop("wait")
                t.waiting = False
            if wakes:
                st["wake"] = wakes
        for t in terms.values():
            t.close()
        b["recorded"] = str(date.today())
    finally:
        cl.stop()


def main():
    files = sys.argv[1:]
    if not files:
        sys.exit(__doc__)
    ver = subprocess.check_output([f"{BIN}/postgres", "--version"], text=True).strip()
    for path in files:
        with open(path) as f:
            s = json.load(f)
        n = 0
        for l in s.get("lessons", []):
            for j, b in enumerate(l.get("blocks", [])):
                if b.get("type") == "sessions":
                    record_block(b, f"{l['id']} bloque {j}")
                    n += 1
        with open(path, "w") as f:
            json.dump(s, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{path}: {n} simulaciones grabadas con {ver}")


if __name__ == "__main__":
    main()
