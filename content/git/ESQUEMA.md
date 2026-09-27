# Curso de Git — formato de una sección

Archivo `content/git/sNN.json`. Español neutro para Latinoamérica (el alumno es de Chile: «computador», «$», nada de «ordenador», «vale», «coger», «móvil», €). Comandos, opciones y mensajes de Git tal cual (en inglés).

## Cómo practica el alumno
En la plataforma hay una **terminal de práctica con Git REAL** (Git 2.50 del computador del alumno). Cada ejercicio y cada demostración se ejecutan en una carpeta aislada (`~` es una carpeta temporal propia con su `~/.gitconfig`; identidad `Alumno <alumno@cuaderno.local>` e `init.defaultBranch = main` ya configurados). Junto a la terminal se ve el **gráfico de commits** en vivo y las **tres áreas** (directorio de trabajo, área de preparación, repositorio).

La terminal NO es bash: es un intérprete restringido. Admite:
- `git …` (cualquier subcomando; sin red: los «remotos» son repositorios locales, p. ej. `~/servidor/proyecto.git`).
- `ls [-a] [-l]`, `cd`, `pwd`, `cat`, `echo [-n] [-e]`, `printf`, `touch`, `mkdir [-p]`, `rm [-r] [-f]`, `mv`, `cp [-r]`, `chmod +x`, `head/tail -n N`, `wc -l`, `grep [-n] [-i]`, `tree`, `clear`, `help`.
- `code ARCHIVO` (también `edit`, `nano`, `vim`): abre un editor dentro de la plataforma.
- Operadores `&&`, `||`, `;`, redirección `>` y `>>` (solo para echo/printf/cat) y tuberías **solo** del tipo `echo … | git …` o `printf … | git …`.
- NO admite: otras tuberías (`git log | head`), `$(…)`, variables salvo `$HOME` y `~`, `<`, `&`, scripts propios (salvo los que ejecute Git: hooks, `git bisect run ./script.sh`).
- Cuando Git abre un editor (`git commit` sin `-m`, `git rebase -i`, `git merge` sin `--no-edit`, `git tag -a` sin `-m`…) la plataforma muestra el archivo en un editor; el alumno lo edita y guarda y Git continúa. ¡Así se practica el rebase interactivo de verdad!

```jsonc
{
  "id": "s05", "order": 5, "title": "Ramas", "domain": "fundamentos",   // fundamentos | colaboracion | avanzado | experto | extra
  "summary": "…", "goal": "Meta en UNA frase medible",
  "objectives": ["5–8 resultados de aprendizaje, verbo observable"],
  "lessons": [
    {
      "id": "s05-l1", "title": "…", "minutes": 15,
      "goals": ["2–4, verbo observable (nunca entender/conocer/saber)"],
      "takeaways": ["3–5 ideas esenciales"],
      "blocks": [
        { "type": "p", "text": "…" }, { "type": "h", "text": "…" }, { "type": "list", "items": ["…"] },
        { "type": "table", "head": ["…"], "rows": [["…"]] },
        { "type": "diagram", "title": "…", "mermaid": "gitGraph\n  commit\n  branch feature\n  commit\n  checkout main\n  merge feature" },
        { "type": "code", "lang": "bash", "code": "git status" },                       // solo mostrar
        { "type": "code", "lang": "bash", "run": true, "setup": "nuevo_repo demo\ncommit_archivo a.txt 'uno' 'Primer commit'", "cwd": "demo",
          "code": "git switch -c feature\necho dos >> a.txt\ngit commit -am \"Segundo\"\ngit log --oneline --graph --all" },
        { "type": "callout", "variant": "tip|warn|exam", "text": "…" },
        { "type": "terms", "items": [{ "term": "HEAD", "en": "HEAD", "def": "…" }] }
      ]
    }
  ],
  "exercises": [
    {
      "id": "s05-e1", "title": "…", "level": "facil",       // facil | medio | dificil | proyecto
      "minutes": 8,
      "prompt": ["Situación y objetivo, en párrafos (admite ```bash … ``` para mostrar código)."],
      "setup": "nuevo_repo tienda\nfecha '2026-09-01 10:00'\ncommit_archivo index.html '<h1>Tienda</h1>' 'Primer commit'",
      "cwd": "tienda",                                      // carpeta (relativa a ~) donde empieza la terminal y se ejecutan los checks
      "checks": [
        { "name": "Existe la rama feature/login", "script": "rama_existe feature/login 'Crea la rama feature/login'" },
        { "name": "Estás en esa rama", "script": "en_rama feature/login" }
      ],
      "solution": ["git switch -c feature/login"],           // comandos tal como los escribiría el alumno
      "hints": ["Pista suave", "Pista concreta"],
      "explain": "Por qué, alternativas (git checkout -b) y qué pasa por dentro."
    }
  ],
  "labs": [],
  "flashcards": [{ "front": "…", "back": "…" }],
  "quiz": [ { "id": "s05-q1", "type": "single|multi|yesno", "…": "igual que en el curso de Python; `q` y `explain` admiten ```bash … ```" } ],
  "sources": [{ "title": "…", "url": "https://git-scm.com/docs/…" }]
}
```

### Pasos de la solución que usan el editor
Si un paso abre el editor, escríbelo como objeto con el contenido que el alumno dejaría en el archivo:
```json
{ "cmd": "git rebase -i HEAD~3", "edit": "pick a1b2c3d Añade login\nsquash d4e5f6a Arregla typo\npick 0a1b2c3 Añade logout\n" }
```
Como los hashes cambian en cada ejecución, en `edit` puedes usar `{{SHA:rev}}` y se sustituye por el hash corto real, p. ej. `pick {{SHA:HEAD~2}} Añade login`. Si hay varias ediciones seguidas (squash abre otro editor para el mensaje), usa `"edit": ["todo…", "mensaje final…"]` en orden.

## Scripts: `setup` y `checks`
Son scripts **bash 3.2** (macOS; nada de arrays asociativos, `${var,,}`, `mapfile`). Llevan cargadas estas funciones auxiliares (ver `lib-node/git-prelude.sh`):
- Preparación: `nuevo_repo DIR` (init con main y entra), `escribir ARCHIVO "texto"`, `anexar ARCHIVO "línea"`, `commit_archivo ARCHIVO "texto" "mensaje"`, `fecha "2026-09-01 10:00"` (historia reproducible), `autor "Ana Pérez" "ana@ejemplo.com"` y `yo` (volver al alumno). Para simular un servidor: `git init --bare ~/servidor/proyecto.git` y `git clone`/`git push` desde otra carpeta; para simular a un compañero, clona en `~/companera` y haz commits con `autor …`.
- Comprobación: `falla "mensaje"`, `es_repo`, `rama_existe R`, `rama_no_existe R`, `rama_actual`, `en_rama R`, `limpio`, `num_commits REV`, `mensaje REV`, `mensaje_es REV "texto"`, `contenido REV RUTA`, `archivo_tiene RUTA "texto"`, `archivo_existe RUTA`, `sin_conflictos`, `ancestro A B`, `es_merge REV`, `sin_operacion_en_curso`. Todas aceptan un último argumento opcional con el mensaje para el alumno.
- Un check **pasa si termina con código 0**; si falla, lo que imprima (la última línea) es lo que verá el alumno: que oriente sin regalar la solución. Usa comandos plumbing y formatos estables (`git rev-parse`, `git rev-list --count`, `git cat-file -t`, `git for-each-ref`, `git status --porcelain`), nunca la salida «bonita».
- Los checks se ejecutan en `cwd`. Pueden comprobar cualquier cosa del repositorio (incluso `~/servidor/*.git` con `git -C`).

## Reglas de calidad (obligatorias)
- El validador ejecuta el `setup`, comprueba que **al menos un check falla** antes de resolver, vuelve a preparar el escenario, ejecuta **la `solution` en la terminal de práctica real** (con las mismas restricciones que el alumno) y exige que **todos los checks pasen**. También ejecuta cada bloque `run` y exige que ningún comando sea rechazado por la terminal. Límite por comando: 45 s.
- Los escenarios deben ser realistas (proyectos pequeños con archivos con sentido, compañeros que hacen commits, servidores simulados) y deterministas (usa `fecha` y `autor`).
- Nada inventado: opciones, mensajes y comportamientos verificados en la documentación oficial (git-scm.com/docs, Pro Git 2ª ed.) y probados en Git 2.50. Si algo es de una versión reciente, dilo («desde Git 2.X»).
- Diagramas Mermaid permitidos: `gitGraph` (¡ideal para historia!), `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `mindmap`, `timeline`, `classDiagram`. Etiquetas con comillas dobles en flowchart; sin `style`/`classDef`/`%%{init}`.

## Validar
```bash
cd /Users/jltorocode/Documents/code/IA/cuaderno-next
node scripts/validate-git.mjs content/git/sNN.json
```

## Trampa de bash 3.2 en los mensajes
En bash 3.2 (macOS), una variable seguida de un carácter no ASCII se corrompe: `«$v»` o `$1á`. Escribe siempre `${v}`, `${1}` (dentro de template literals de JS: `\${v}`).
