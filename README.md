# Cuaderno de Certificaciones (Next.js)

Mi plataforma **personal y privada** para estudiar certificaciones. Solo funciona en este computador (`127.0.0.1`), sin cuentas y sin servicios externos.

## Abrirla
- **Doble clic en `Estudiar.command`**: prepara la app si hace falta, la arranca y abre el navegador en http://127.0.0.1:3901/ai-901.
- O en la terminal: `npm run estudiar` (compila y arranca) · `npm run dev` (modo desarrollo con recarga).

## Qué hay dentro
La plataforma es un **cuaderno de ruta**: cada certificación es una cumbre y cada sección un campamento.

- **Panel del curso**: índice de preparación (cobertura 40 % + dominio en tests 35 % + simulacros 25 %, explicado en pantalla), tu siguiente paso, el **mapa de ruta** con los campamentos y el método de estudio en 5 pasos con la meta de cada uno.
- **Metas por campamento** (sección): todas las lecciones, al menos una práctica en Azure y 80 % en el test. La cumbre: 2 simulacros completos seguidos con 850+ puntos.
- **Lecciones** con *Al terminar podrás…* (objetivos que marcas cuando los dominas), diagramas, tablas, código y *Lo que tienes que llevarte* (lo esencial para el examen).
- **Mi plan y metas**: fecha de examen, días y minutos de estudio → te dice si llegas, qué hacer hoy y el calendario semana a semana con los hitos. Racha de días estudiando.
- **Prácticas** paso a paso, **Tarjetas**, **Test** por sección, **Simulacro** cronometrado, **Repaso de errores**, **Glosario**, **Búsqueda**, tema claro/oscuro.
- Cursos incluidos:
  - **AI-901 Microsoft Azure AI Fundamentals** (10 secciones, 51 lecciones, 161 objetivos, 344 preguntas, prácticas en Azure).
  - **Python de cero a experto** (20 secciones en 4 niveles, 135 lecciones, 291 ejercicios autocorregidos —41 proyectos— con 2295 tests, 623 ejemplos ejecutables, 218 diagramas, 810 preguntas, 632 tarjetas).
  - **Git de cero a experto** (17 secciones en 5 niveles, 108 lecciones, 242 ejercicios con Git real —32 proyectos—, 320 demostraciones ejecutables, 154 diagramas, 666 preguntas, 491 tarjetas).
  - **Inglés Básico: de cero a conversar** (el libro de Augusto Ghio completo: 12 secciones en 4 niveles, 99 lecciones, 184 ejercicios con 2753 ítems autocorregidos —227 dictados y 231 de pronunciación—, 3526 frases y 2625 palabras con audio, 138 patrones de frase, 131 diagramas, 46 diálogos, 606 preguntas —114 de comprensión auditiva—, 847 tarjetas y las 850 palabras de Ogden con repaso espaciado).
  - **PostgreSQL de cero a experto** (26 secciones en 5 niveles + proyecto final, 130 lecciones, 669 ejemplos ejecutables en psql, 89 simulaciones de varias sesiones grabadas en PostgreSQL real, 394 ejercicios autocorregidos —53 proyectos—, 196 diagramas, 1132 preguntas, 902 tarjetas).

## Python en el navegador (curso de Python)
Todas las prácticas se ejecutan **aquí mismo** con **Python 3.14 real** (CPython compilado a WebAssembly con Pyodide), servido desde `public/pyodide` (lo copia `npm install`; funciona sin internet).
- **Ejercicios**: enunciado, pistas progresivas, editor con resaltado (CodeMirror), *Ejecutar* (Ctrl/⌘+Enter), *Comprobar* con tests (Mayús+Enter), solución de referencia y explicación. Tu código se guarda solo.
- **Ejemplos de las lecciones** editables y ejecutables, y **Laboratorio** libre en `/python/laboratorio`.
- Se comporta como un script real: `__name__ == "__main__"` al ejecutar; al comprobar, tu código se importa como el módulo `solucion`. `input()` lee de la casilla *Entrada*; `sys.exit()` muestra el código de salida; los bucles infinitos se detienen solos y el intérprete se recupera.
- Límites del navegador: no hay hilos, procesos, red ni `pip` (se explican en las lecciones con ejemplos no ejecutables).
- Validar un curso de Python (ejecuta cada solución y cada ejemplo en Pyodide): `npm run validar -- content/python/s01.json`.

## Git real en la plataforma (curso de Git)
Las prácticas usan **el Git instalado en este computador** (probado con Git 2.50), no una imitación. El servidor local crea para cada ejercicio una carpeta aislada en la carpeta temporal del sistema (`cuaderno-git/<sesión>/home`), con su propio `~/.gitconfig` (identidad *Alumno*, rama inicial `main`). Nada toca tus repositorios ni tu configuración de Git.
- **Ejercicios**: el escenario ya viene preparado (repos, compañeros que hacen commits, «servidores» locales `~/servidor/*.git`). Escribes comandos en la terminal, ves en vivo el **gráfico de commits** y las **tres áreas** (trabajo, preparación, repositorio) y pulsas **Comprobar**: se revisa el estado real del repositorio (ramas, commits, contenido, conflictos…). Pistas, solución paso a paso con botón ▶ y explicación.
- Cuando Git abre un editor (`git commit` sin `-m`, `git rebase -i`, `git merge`, `git tag -a`…) aparece un editor dentro de la página; guardas y Git continúa. `code ARCHIVO` abre cualquier archivo para editarlo (resolver conflictos, por ejemplo).
- **Demostraciones** en las lecciones (paso a paso o de una vez) y **Terminal libre** en `/git/laboratorio`.
- La terminal **no es bash**: acepta `git …` y órdenes básicas (`ls`, `cd`, `cat`, `echo`, `printf`, `touch`, `mkdir`, `rm`, `mv`, `cp`, `grep`, `tree`…), `&&`, `||`, `;`, `>`/`>>` y `echo … | git …`. Escribe `help` para verlas. Sin red: los remotos son repositorios locales.
- Límites: `git revert` y `cherry-pick --continue` no abren editor (usan el mensaje propuesto); cada comando tiene 45 s como máximo; las sesiones inactivas caducan (la terminal se reinicia sola).
- Seguridad: la API `/api/git` solo responde a peticiones de esta misma página en `127.0.0.1` (cabecera propia, mismo origen), los escenarios y comprobaciones salen del contenido del curso (nunca del navegador) y las rutas quedan confinadas a la carpeta de la sesión.
- Validar un curso de Git (prepara cada escenario, comprueba que los checks fallan, ejecuta la solución en la misma terminal y exige que pasen; ejecuta cada demostración): `npm run validar-git -- content/git/s01.json`.

## Inglés con audio y micrófono (curso de inglés)
Sigue el libro **«Inglés Básico» de Augusto Ghio D.** (método *Basic English* de C. K. Ogden) lección a lección, corregido y ampliado: cada sección avisa de las erratas del libro y de cuándo algo suena anticuado («En el inglés de todos los días»). El PDF está en `public/libros/ingles-basico.pdf` (copia personal, fuera de git) y cada sección enlaza sus páginas en *Fuentes*.
- **Audio en todo**: cada palabra, frase, patrón de frase y diálogo tiene 🔊 (y la tortuga para escucharlo despacio), «Escuchar todo» y botones para tapar el inglés o el español y ponerte a prueba. Los diálogos tienen **juego de roles**: eliges un personaje y la plataforma dice el resto. Usa las voces del sistema (inglés americano); en *Voz* eliges voz y velocidad. Para una voz más natural, instala una «Premium» en Ajustes del Sistema → Accesibilidad → Contenido leído → Voz del sistema → Gestionar voces.
- **Ejercicios** (series de 8–15 ítems con corrección al instante; los fallos vuelven al final; resuelto con 80 % de aciertos a la primera): traducir y transformar frases, **dictado**, escuchar y elegir, completar huecos, ordenar palabras, unir parejas y **pronunciación**. La corrección acepta contracciones (*isn't* = *is not*), perdona tildes y apóstrofos olvidados con aviso y muestra la diferencia palabra a palabra. Cada sección trae además el **examen del libro** con su comprobación.
- **Pronunciación**: te grabas y escuchas tu voz junto al modelo (la grabación no sale del navegador), o activas el **reconocimiento de voz**: *en este equipo* (Chrome descarga el paquete de inglés una vez; el audio no se envía) o *en línea* (el navegador envía el audio a su servicio de voz).
- **Laboratorio de inglés** (`/ingles/laboratorio`): pronunciación libre con resaltado palabra a palabra, las **850 palabras** con buscador, IPA y pronunciación figurada del libro, y **repaso espaciado** (Leitner: 1, 3, 7, 16 y 35 días) en dos direcciones.
- IPA americana del diccionario CMU (`scripts/data/cmudict.dict.gz`, licencia en `scripts/data/CMUDICT-LICENSE.txt`, con correcciones de acento en `scripts/en-dict.mjs`). `node scripts/ipa.mjs palabra "frase"` da la IPA y comprueba la ortografía.
- Validar una sección (formato, diagramas, ortografía de todo el inglés, IPA, grafía americana, que cada ejercicio se resuelva con su propia respuesta y los mínimos del plan): `node --no-warnings scripts/validate-english.mjs --fix-ipa content/ingles/s01.json`. Formato en `content/ingles/ESQUEMA.md`, alcance en `content/ingles/PLAN.md`.

## PostgreSQL simulado en el navegador (curso de PostgreSQL)
Todas las prácticas usan **PostgreSQL 18.3 real compilado a WebAssembly** (PGlite), servido desde `public/pglite` (lo copia `npm install`; funciona sin internet) y ejecutado en un hilo aparte del navegador. No usa ningún PostgreSQL instalado en el computador.
- **Consola psql simulada** (`public/pg/psql.mjs`): se comporta como psql 18 —prompts `=#`, `-#`, `=*#`, `=!#`; tablas alineadas; `\d`, `\dt+`, `\df`, `\du`, `\dp`, `\l`, `\x`, `\timing`, `\copy`, `\gexec`, `\h`…; errores con `LINE 1:` y `^`— y se verificó carácter por carácter contra el psql real. Autocompletado con Tab, historial y `\c` a otra base o usuario de verdad.
- **Ejercicios** de tres tipos: *consulta* (se compara tu resultado con el esperado, que ves en el enunciado), *script* (cada ejecución parte del escenario inicial y se comprueba el estado de la base) y *psql* (trabajas en la consola; la comprobación mira lo confirmado, como otra sesión). Panel con las tablas y **diagrama ER en vivo**.
- **Conjuntos de datos** chilenos y deterministas (`scripts/gen-datasets.mjs` → `public/pg/datasets`): tienda, rrhh, colegio (notas 1.0–7.0), biblioteca y metro (120.000 validaciones). Descripción en `content/postgresql/DATOS.md`.
- **Concurrencia y administración** (bloqueos, aislamiento, deadlocks, respaldos, PITR, réplicas…) se muestran como **simulaciones paso a paso de varias sesiones**, grabadas en un PostgreSQL 18 real con `python3 scripts/record-sims.py` (herramienta de desarrollo: crea un clúster desechable solo por socket Unix; nunca toca otro servidor).
- **Laboratorio** en `/postgresql/laboratorio` con los datasets; se guarda solo en este navegador.
- Límites de la simulación (explicados en el curso): una conexión por consola, sin procesos en segundo plano ni red, recursión de funciones hasta ~150 niveles.
- Validar una sección (ejecuta cada ejemplo, prepara cada escenario, exige que las comprobaciones fallen antes y pasen con la solución): `npm run validar-pg -- content/postgresql/s01.json`. Consola para autores: `node scripts/psql.mjs tienda`.

## De dónde sale el contenido
- **Curso de PostgreSQL**: documentación oficial de PostgreSQL 18 (y notas de las versiones 15–18), documentación de pgvector, PostGIS, psycopg, node-postgres y PgBouncer; cada sección lista sus fuentes. Todo ejemplo y solución ejecutados en PostgreSQL 18.3.
- **Curso de inglés**: el libro «Inglés Básico» de Augusto Ghio D. (todas sus lecciones, exámenes y el apéndice de 850 frases), la lista de las 850 palabras de C. K. Ogden, y como referencia Cambridge Dictionary, British Council LearnEnglish y Oxford Learner's Dictionaries; cada sección lista sus fuentes. Todo el inglés pasa por el corrector del diccionario CMU.
- **Curso de Git**: documentación oficial (git-scm.com/docs), libro *Pro Git* 2.ª edición (git-scm.com/book/es/v2) y notas de versión de Git; cada sección lista sus fuentes. Todo comando y salida probados en Git 2.50.
- **Curso de Python**: documentación oficial (docs.python.org 3.14, What's New, PEPs), guías del Python Institute (PCEP/PCAP/PCPP) y fuentes reconocidas; cada sección lista sus fuentes. Todo el código verificado ejecutándolo en Python 3.14.
- **Microsoft Learn** (oficial): guía de estudio del AI-901, página del examen, curso AI-901T00 y documentación de Foundry, Language, Speech, Vision, Content Understanding e IA responsable. Cada sección lista sus fuentes en la pestaña *Fuentes*.
- **in28minutes**: el PDF del curso como punto de partida (no su web ni sus videos).

## Mi progreso
- Se guarda en `data/progress.json` (excluido de git). Haz copia de ese archivo o usa **Exportar progreso** en la barra lateral.
- **Importar** combina un archivo exportado con el progreso actual (también sirve para traer el progreso de la versión HTML).

## Añadir un curso
1. Crea `content/<id>/s01.json`, `s02.json`… con el formato de `content/ESQUEMA.md`, más `goal` por sección y `goals`/`takeaways` por lección (valida con `node scripts/check-goals.mjs`).
2. Añade el curso a `content/courses.json` (id, código, títulos, dominios, examen, secciones, `short`, `weights` y `targets`).
3. Vuelve a abrir con `Estudiar.command` (recompila solo).

## Estructura
- `src/app/` rutas: `/`, `/[curso]`, `/[curso]/[sección]`, `/[curso]/[sección]/[lección]`, `simulacro`, `errores`, `tarjetas`, `glosario`, `buscar`, y `api/progress`, `api/git`.
- `src/components/` interfaz (QuizRunner, Deck, Labs, Mermaid, CodeBlock, GitTerminal, GitGraph…). `src/lib/` tipos y lectura de contenido.
- `public/pg/` motor del curso de PostgreSQL (worker, consola psql, `\d`, comprobaciones) y `public/pg/datasets/`.
- `lib-node/` motor de Git del servidor (`git-engine.mjs`: sesiones aisladas y terminal restringida; `git-editor.mjs`: puente del editor; `pty-run.py`: salida como en una terminal real; `git-prelude.sh`: funciones para escenarios y comprobaciones).
- `src/app/api/git/[action]` sesiones, comandos, editor, estado y comprobación.
