# Curso de PostgreSQL — formato de una sección

Archivo `content/postgresql/sNN.json`. **Español neutro para Latinoamérica** (el alumno es de Chile: «computador», «archivo», «auto», «celular», montos en pesos «$12.990»; nada de «ordenador», «fichero», «coger», «móvil», «vosotros», €). Palabras clave de SQL en MAYÚSCULAS en los ejemplos (`SELECT … FROM … WHERE`), identificadores en minúsculas y en español (`clientes`, `fecha_registro`). Mensajes de PostgreSQL y de psql tal cual (en inglés).

## El entorno del alumno (léelo entero: define qué se puede enseñar «haciendo»)

Todo se practica **dentro de la plataforma, simulado en el navegador**: PostgreSQL **18.3 real** compilado a WebAssembly (PGlite) + una **consola psql simulada** que se comporta como `psql` 18 (verificada contra el psql real, salida idéntica). El alumno no instala nada.

- **Consola psql**: prompts reales (`tienda=#`, `tienda-#` al continuar, `tienda=*#` en transacción, `tienda=!#` transacción fallida, `>` si no es superusuario), tablas alineadas, `(N rows)`, errores con `LINE 1:` y `^`, `DETAIL/HINT/CONTEXT`, NOTICE, LISTEN/NOTIFY, `\timing`.
- **Meta-comandos disponibles**: `\s` `\db` `\dC` `\d` `\d+` `\dt` `\di` `\dv` `\dm` `\ds` `\dn` `\df` `\df+` `\du` `\dg` `\drg` `\drds` `\ddp` `\dx` `\dT` `\dD` `\dp` `\z` `\dP` `\dX` `\dF[+]` `\dFd` `\dFp` `\dFt` `\dy` `\dL` `\dconfig` `\l` `\sf` `\sv` `\x` `\a` `\t` `\pset` (format/border/null/expanded/tuples_only/footer/title) `\C` `\f` `\timing` `\echo` `\qecho` `\set` `\unset` `\g` `\gx` `\gset` `\gexec` `\p` `\r` `\e` `\errverbose` `\conninfo` `\c` (cambia de base y de usuario, de verdad) `\encoding` `\copy` (con archivos virtuales del ejercicio) `\i` `\h` (ayuda oficial de todos los comandos SQL) `\?` `\q`, más `help`, `quit`. Variables `:var`, `:'var'`, `:"var"`, `AUTOCOMMIT off`, `ON_ERROR_ROLLBACK on`, `VERBOSITY verbose`, `ECHO_HIDDEN on` (muestra las consultas al catálogo de los `\d`).
- **NO disponible**: `\!` (no hay sistema operativo), `\o`, `\watch`, `\password`, `\if`. Nunca los uses en ejemplos ejecutables ni soluciones.
- **Una sola conexión por consola**: no se pueden abrir dos sesiones interactivas simultáneas. Para enseñar concurrencia (bloqueos, aislamiento, deadlocks, `SKIP LOCKED`, `LISTEN/NOTIFY` entre sesiones…) usa **bloques `sessions`** (simulaciones grabadas en un PostgreSQL 18 real con varias conexiones, ver abajo).
- **Sin procesos en segundo plano**: no hay consultas paralelas (`max_parallel_workers_per_gather = 0`), ni autovacuum automático, ni replicación, ni `pg_ctl`, ni archivos de configuración reales. `VACUUM`, `ANALYZE`, `CHECKPOINT`, `pg_stat_*`, `pg_settings`, `SET` y `ALTER SYSTEM` (queda en postgresql.auto.conf) sí funcionan; `pg_reload_conf()` NO (no hay postmaster: devuelve `f` con un WARNING), así que la recarga de configuración se muestra con simulaciones de terminal. Para administración (pg_ctl, postgresql.conf, pg_hba.conf, pg_dump/pg_restore, pg_basebackup, réplicas, PITR) usa **bloques `sessions` con terminales** (`shells`), también grabados en un PostgreSQL real.
- **Extensiones disponibles** (`CREATE EXTENSION`): pg_trgm, pgcrypto, "uuid-ossp", citext, hstore, ltree, tablefunc, unaccent, fuzzystrmatch, btree_gin, btree_gist, bloom, cube, earthdistance, intarray, isn, lo, seg, tcn, tsm_system_rows, tsm_system_time, amcheck, pageinspect, pg_buffercache, pg_freespacemap, pg_visibility, pg_walinspect, pg_stat_statements, auto_explain (con `LOAD 'auto_explain'`), **vector (pgvector)** y **postgis** (esta última solo si el ejercicio o bloque declara `"extra": ["postgis"]`; pesa 19 MB).
- **Roles**: se conecta como `postgres` (superusuario). `CREATE ROLE`, `GRANT`, `SET ROLE`, RLS y `\c - ana` (reconexión real como otro usuario: `session_user` cambia y dentro de esa conexión no puede volver a ser superusuario con `SET ROLE`/`SET SESSION AUTHORIZATION`; con `\c - postgres` se reconecta como superusuario, igual que en un servidor con autenticación `trust`) funcionan como en un servidor real. Un ejercicio puede empezar conectado como otro usuario con `"user": "ana"` (el rol debe existir en el setup y tener LOGIN).
- Zona horaria `America/Santiago` (`-03`/`-04`), `DateStyle` ISO, mensajes en inglés, `default_text_search_config = pg_catalog.english` (para español usa `'spanish'` explícitamente). La colación por defecto es **C** (orden por bytes: «Álvarez» queda después de «Vergara»): evita ordenar por textos con tilde en ejercicios ordenados o explícalo. Para orden lingüístico existe la colación ICU raíz `COLLATE "und-x-icu"` (también `"unicode"`); no hay datos ICU específicos de `es-CL`. `lc_numeric`/`lc_monetary`/`lc_time` son C (to_char con `G` pone coma; nombres de meses en inglés).
- Las consultas enormes que no terminan se cancelan a los 60 s (no hay `statement_timeout` real en la simulación).
- La recursión de funciones (PL/pgSQL o SQL) admite unos **150 niveles** en la simulación; más allá, el motor se cae (la consola muestra el error `stack depth limit exceeded` que daría un servidor real y reconstruye la sesión). No escribas ejemplos ni soluciones que recursen más de ~100 niveles; para mostrar el error real usa un bloque de solo lectura.
- `ALTER DATABASE … SET` / `ALTER ROLE … SET` se aplican al conectarse (`\c`), pero en la simulación `pg_settings.source` muestra `session` en vez de `database`/`user`. Las estadísticas `pg_stat_*` parten en cero en cada escenario y se publican al ~1 s (o con `SELECT pg_stat_force_next_flush()`); `pg_stat_activity` muestra una sola conexión.

## Conjuntos de datos (`dataset`)
`tienda`, `rrhh`, `colegio`, `biblioteca`, `metro`. Descripción, `\d` de cada tabla y filas de ejemplo en **`content/postgresql/DATOS.md`** (léelo antes de escribir consultas; no inventes columnas). Con `"dataset": "tienda"` la base se llama `tienda` y ya tiene los datos cargados y analizados (`VACUUM ANALYZE`). Sin dataset, la base es `postgres` vacía. `setup` (SQL) se ejecuta después del dataset; úsalo para crear tablas o datos propios del ejemplo/ejercicio.

## Estructura

```jsonc
{
  "id": "s07", "order": 7, "title": "Agregación y agrupamiento", "domain": "consultas",   // fundamentos | consultas | diseno | avanzado | experto | extra
  "summary": "2–3 frases", "goal": "Meta en UNA frase medible",
  "objectives": ["5–8 resultados de aprendizaje con verbo observable"],
  "lessons": [
    {
      "id": "s07-l1", "title": "…", "minutes": 15,
      "goals": ["2–4, verbo observable (nunca entender/conocer/saber/comprender/aprender)"],
      "takeaways": ["3–5 ideas esenciales"],
      "blocks": [ …al menos 5… ]
    }
  ],
  "exercises": [ … ],
  "labs": [],
  "flashcards": [{ "front": "…", "back": "…" }],
  "quiz": [ … ],
  "sources": [{ "title": "Documentación de PostgreSQL 18: …", "url": "https://www.postgresql.org/docs/18/…" }]
}
```

### Bloques de lección
```jsonc
{ "type": "p", "text": "Párrafo. Admite **negrita**, *cursiva* y `código`." }
{ "type": "h", "text": "Subtítulo" }
{ "type": "list", "items": ["…"], "ordered": false }
{ "type": "table", "head": ["…"], "rows": [["…"]] }
{ "type": "callout", "variant": "tip|warn|exam", "text": "…" }          // exam = «Lo que te van a preguntar»
{ "type": "terms", "items": [{ "term": "MVCC", "en": "Multiversion Concurrency Control", "def": "…" }] }
{ "type": "diagram", "title": "…", "mermaid": "erDiagram\n  clientes ||--o{ pedidos : hace", "caption": "…" }
{ "type": "code", "lang": "sql", "code": "SELECT …" }                                   // solo para leer
{ "type": "code", "lang": "sql", "run": true, "dataset": "tienda", "setup": "…opcional…",
  "code": "SELECT nombre, precio\nFROM productos\nWHERE precio > 100000\nORDER BY precio DESC;\n\\d productos" }  // EJEMPLO EJECUTABLE
{ "type": "code", "lang": "bash", "code": "pg_dump -Fc tienda > tienda.dump" }        // comandos de sistema: solo lectura
{ "type": "sessions", … }                                                                // ver abajo
```
- **Ejemplos ejecutables** (`run: true`, `lang: "sql"`): el alumno pulsa «Ejecutar en psql» y ve cada línea escrita en psql con su salida real; luego puede editar y seguir escribiendo. Pueden mezclar SQL y meta-comandos (`\d`, `\x`, `\timing`…). Cada sentencia termina en `;`. Si un error es **a propósito** (enseñar una restricción, un error típico), marca el bloque con `"errors": true`. Pon muchos: **al menos 2 por lección** (idealmente 3–5). Son la mejor forma de aprender.
- **Diagramas Mermaid permitidos**: `erDiagram` (¡ideal para modelos!), `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `mindmap`, `timeline`. Etiquetas con comillas dobles en flowchart; sin `style`/`classDef`/`%%{init}`. En erDiagram los tipos de atributo son una sola palabra (`int`, `text`, `numeric`, `timestamptz`).

### Simulaciones de varias sesiones (`sessions`) — concurrencia y administración
```jsonc
{
  "type": "sessions",
  "title": "Dos cajeros venden el último café",
  "sessions": ["A", "B"], "labels": ["Caja 1", "Caja 2"],
  "dataset": "tienda", "setup": "…opcional…",
  "steps": [
    { "s": "A", "in": "BEGIN;", "note": "La caja 1 abre una transacción." },
    { "s": "A", "in": "UPDATE productos SET stock = stock - 1 WHERE sku = 'CAF-001';" },
    { "s": "B", "in": "UPDATE productos SET stock = stock - 1 WHERE sku = 'CAF-001';",
      "ask": "¿Qué le pasa a la caja 2?", "note": "La caja 2 queda **esperando** el bloqueo de la fila." },
    { "s": "A", "in": "COMMIT;", "note": "Al confirmar, la caja 2 continúa y resta sobre el valor ya confirmado." }
  ]
}
```
- Cada paso: sesión (`s`), lo que se escribe (`in`: SQL o meta-comando; puede tener varias líneas), `note` (explicación que se muestra en ese paso) y opcionalmente `ask` (pregunta para que el alumno prediga antes de ver la salida: úsalo en los momentos clave).
- **No escribas las salidas**: se graban ejecutando los pasos en un PostgreSQL 18 real con varias conexiones: `python3 scripts/record-sims.py content/postgresql/sNN.json` (agrega `prompt`, `out`, `wait` —la orden quedó esperando un bloqueo— y `wake` —qué sesiones se liberaron—). Vuelve a grabar cada vez que cambies un bloque `sessions`. Revisa la salida grabada y ajusta las `note` a lo que realmente pasó.
- No escribas en una sesión que está esperando (el grabador lo rechaza): libérala primero desde otra.
- **Terminales** (administración): cada paso de terminal debe ser **de una sola línea** (encadena con `&&` o `;` si hace falta). `"shells": ["srv"]` hace que esa sesión sea una terminal bash (prompt `$ `) con las herramientas de PostgreSQL 18 (`pg_dump`, `pg_restore`, `pg_dumpall`, `createdb`, `dropdb`, `psql -c …`, `pg_basebackup`, `initdb`, `pg_ctl`, `pg_controldata`, `pg_waldump`, `pgbench`, `pg_isready`…). Variables ya definidas: `PGHOST`, `PGPORT=5432`, `PGUSER=postgres`; el directorio de trabajo es `~`. Puedes crear clústeres adicionales dentro de `~` (p. ej. una réplica con `pg_basebackup -D ~/replica -R` y `pg_ctl -D ~/replica -o "-p 5433 -c listen_addresses='' -k $PGHOST" start`) y conectarte a ellos con una sesión psql usando `"connect": { "R": "-p 5433 tienda" }`. Cada comando tiene hasta 90 s. Todo se hace en un clúster desechable que el grabador crea y borra.
- Úsalas para: bloqueos de filas, `SELECT … FOR UPDATE / SKIP LOCKED / NOWAIT`, niveles de aislamiento y sus anomalías, deadlocks, MVCC entre sesiones, LISTEN/NOTIFY entre sesiones, respaldo y restauración con pg_dump/pg_restore, pg_basebackup, réplicas, PITR, configuración y recarga, pgbench.

### Ejercicios (`exercises`) — tres modos

**1. `query`**: el alumno escribe una consulta en el editor; se compara su resultado con el de tu solución (el alumno ve el «Resultado esperado»).
```jsonc
{
  "id": "s07-e3", "title": "Ventas por categoría", "level": "medio", "minutes": 10,
  "mode": "query", "dataset": "tienda",
  "prompt": ["Enunciado claro en párrafos. Di qué columnas y en qué orden (y con qué nombre si pides alias)."],
  "starter": "-- Escribe tu consulta\nSELECT\n",
  "solution": "SELECT c.nombre AS categoria, sum(i.cantidad * i.precio_unitario) AS total\nFROM …\nGROUP BY c.nombre\nORDER BY total DESC;",
  "ordered": true,        // obligatorio: true si el enunciado pide un orden (se compara fila a fila); false = da igual el orden
  "columns": false,       // true = también se exigen los nombres de columna (pídelos en el enunciado)
  "requires": [{ "pattern": "\\bgroup\\s+by\\b", "msg": "Usa GROUP BY", "name": "Agrupa con GROUP BY" }],   // opcional: exige una técnica
  "hints": ["Pista suave", "Pista concreta"],
  "explain": "Por qué funciona, alternativas y trampas (NULL, empates…)."
}
```
- La comparación usa el texto exacto de los valores: pide el formato (redondeos con `round(x, 1)`, etc.) y evita resultados ambiguos. Si `ordered` es true, el orden debe estar **totalmente determinado** (desempata con otra columna o el id).
- La solución debe devolver filas (nunca 0) y el `starter` no debe resolverlo.

**2. `script`**: el alumno escribe sentencias (DDL/DML, funciones, triggers…); cada «Comprobar» parte del escenario inicial, ejecuta su script y verifica el estado con `checks`.
```jsonc
{
  "id": "s05-e4", "title": "…", "level": "medio", "mode": "script", "dataset": "tienda",
  "prompt": ["…"], "starter": "-- Escribe las sentencias\n",
  "solution": "ALTER TABLE clientes ADD CONSTRAINT …;",
  "checks": [
    { "name": "La restricción existe", "sql": "SELECT num_checks('clientes') >= 1", "fail": "Agrega la restricción con ALTER TABLE … ADD CONSTRAINT." },
    { "name": "Rechaza un email sin @", "sql": "SELECT falla($$INSERT INTO clientes (rut, nombre, apellido, email, fecha_registro) VALUES ('1-9','x','y','malo', current_date)$$, '23514')" }
  ],
  "hints": ["…"], "explain": "…"
}
```

Si la solución de un ejercicio `script` o `psql` produce un error **a propósito** (por ejemplo, para mostrar una transacción fallida y luego ROLLBACK), marca el ejercicio con `"solutionErrors": true`. En el modo `psql` no se evalúan `requires` (el alumno escribe en la consola): verifica la técnica con `checks`.

**3. `psql`**: el alumno trabaja en la consola psql (transacciones, meta-comandos, `\c`, `\copy`, roles…). «Comprobar» mira **lo confirmado** desde otra sesión (si tiene una transacción abierta se le pide COMMIT).
```jsonc
{
  "id": "s13-e2", "title": "…", "level": "medio", "mode": "psql", "dataset": "tienda",
  "user": "postgres",                    // opcional: conectar como otro rol (debe existir y tener LOGIN)
  "files": { "nuevos.csv": "sku,nombre\n…" },   // opcional: archivos para \copy o \i
  "prompt": ["…"],
  "solution": ["BEGIN;", "UPDATE …;", "COMMIT;"],   // lo que escribiría el alumno, línea a línea
  "checks": [ … ], "hints": ["…"], "explain": "…"
}
```

**Comprobaciones (`checks`)**: cada una puede llevar `"database": "otra"` para ejecutarse en otra base del clúster (p. ej. una base que el alumno creó con `CREATE DATABASE` y a la que se conectó con `\c`); si esa base no existe, la comprobación falla con su `fail`. Consulta SQL que devuelve **una fila**: la primera columna es booleana (pasa si es `true`); una segunda columna de texto opcional es el mensaje dinámico si falla (p. ej. `SELECT count(*) = 5, 'Hay ' || count(*) || ' filas; se esperaban 5' FROM …`). `fail` es el mensaje fijo si falla. Deben **orientar sin regalar la solución**. Corren como superusuario en una **copia desechable** (puedes insertar para probar restricciones: se deshace). Funciones auxiliares disponibles (esquema `verif`, sin prefijo):

| Función | Qué comprueba |
|---|---|
| `existe_tabla(n)`, `existe_vista(n)`, `existe_vista_mat(n)`, `existe_indice(n)`, `existe_secuencia(n)`, `existe_esquema(n)`, `existe_rol(n)`, `existe_tipo(n)`, `existe_extension(n)`, `existe_base(n)`, `existe_funcion(n)`, `existe_procedimiento(n)`, `existe_trigger(tabla[, nombre])`, `existe_politica(tabla[, nombre])`, `existe_columna(tabla, col)` | existencia (los nombres pueden llevar esquema: `'ventas.boletas'`) |
| `tipo_columna(tabla, col)` → text | tipo (`format_type`: `integer`, `character varying(80)`, `numeric(10,2)`, `timestamp with time zone`…) |
| `es_not_null(t, c)`, `default_columna(t, c)` → text, `es_identity(t, c)`, `es_generada(t, c)` → 's'/'v'/NULL | columnas |
| `es_pk(t, ARRAY['a','b'])`, `tiene_pk(t)`, `es_unique(t, ARRAY[…])`, `num_checks(t)`, `checks_de(t)` → text, `es_fk(t, ARRAY['col'], 'ref'[, ARRAY['refcol']])`, `accion_fk(t, ARRAY['col'])` → 'CASCADE'… | restricciones |
| `tiene_indice(t, ARRAY['col1','col2'])` (columnas clave en orden), `metodo_indice(nombre)` → btree/gin/gist/brin/hash, `def_indice(nombre)`, `indices_de(t)` | índices |
| `filas(t)`, `num_filas(consulta)`, `valor(consulta)` → text (1.ª col de la 1.ª fila), `mismas_filas(consulta_a, consulta_b)` (igual multiconjunto) | datos |
| `falla(sentencia[, sqlstate])`, `funciona(sentencia)`, `error_de(sentencia)` → text | que algo falle o funcione (se deshace) |
| `plan(consulta)` → text, `usa_indice(consulta[, nombre_indice])` | planes de ejecución |
| `rls_activo(t)`, `rls_forzado(t)`, `privilegio(rol, objeto, 'SELECT')`, `es_miembro(rol, grupo)`, `atributo_rol(rol, 'rolcanlogin')`, `filas_como(rol, consulta)` → bigint, `falla_como(rol, sentencia)` | seguridad |
| `es_particionada(t)`, `num_particiones(t)`, `clave_particion(t)` → text | particiones |
| `def_vista(n)`, `def_funcion(n)`, `volatilidad(f)`, `lenguaje(f)`, `comentario(objeto)`, `config_rol(rol)`, `config_base(base)` | definiciones |

Usa `$$…$$` para escribir sentencias dentro de las comprobaciones sin pelear con las comillas. Si la sentencia a su vez contiene `$$` (un bloque `DO`), usa otro delimitador exterior: `$chk$ DO $$ … $$ $chk$`.

## Reglas de calidad (obligatorias)
- **Nada inventado**: sintaxis, funciones, opciones y mensajes verificados en la documentación oficial de PostgreSQL 18 (https://www.postgresql.org/docs/18/). Si algo es de una versión reciente, dilo («desde PostgreSQL 17», «nuevo en 18»). Los ejemplos se ejecutan de verdad en el validador: si no funciona, no pasa.
- **Explica el modelo mental primero** (qué pasa por dentro, por qué) y luego la sintaxis; usa analogías chilenas cuando ayuden. Cada lección con: objetivos, texto, **≥ 2 ejemplos ejecutables**, al menos 1 diagrama o tabla cuando haya estructura que visualizar, callouts de trampas (`warn`) y de lo que se pregunta en entrevistas o certificaciones (`exam`).
- Ejercicios **realistas y graduados** (fácil → medio → difícil → proyecto), con datos de los datasets. Enunciados precisos (qué columnas, qué orden, qué nombres). Pistas progresivas. `explain` con alternativas y trampas.
- Quiz: preguntas que hagan pensar («¿qué devuelve esta consulta?», «¿qué pasa si…?», «¿cuál es más eficiente y por qué?»), con `explain` que enseña. Mezcla `single`, `multi` (≥2 correctas) y `yesno` (afirmaciones verdadero/falso). En `q` y `explain` se puede usar ```sql … ```.
- Flashcards: sintaxis exacta, meta-comandos, diferencias finas y trampas.

## Validar (obligatorio, hasta que diga OK)
```bash
cd /Users/jltorocode/Documents/code/IA/cuaderno-next
python3 scripts/record-sims.py content/postgresql/sNN.json   # si la sección tiene bloques "sessions"
node scripts/validate-pg.mjs content/postgresql/sNN.json
```
El validador ejecuta cada ejemplo (sin errores salvo `"errors": true`), prepara cada escenario, exige que las comprobaciones **fallen antes** y **pasen con la solución**, compara resultados en los ejercicios `query`, parsea los diagramas y revisa el lenguaje.

Trabaja tus archivos temporales (generadores, pruebas) en una carpeta propia con el nombre de tu sección (p. ej. `…/scratchpad/s13/`), nunca en carpetas compartidas: hay varios autores trabajando a la vez.

Para probar consultas mientras escribes, usa la misma consola simulada:
```bash
node scripts/psql.mjs tienda            # consola interactiva sobre un dataset (sal con \q)
echo "SELECT count(*) FROM pedidos;" | node scripts/psql.mjs tienda
```
