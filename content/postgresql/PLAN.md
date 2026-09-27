# PostgreSQL de cero a experto — plan del curso

26 secciones en 5 niveles + proyecto final. Cada sección: **5 lecciones** (15–25 min cada una), **12–16 ejercicios** (graduados: ~4 fáciles, ~5 medios, ~3 difíciles y, desde el nivel 2, 1–2 proyectos), **25–35 tarjetas**, **35–45 preguntas** de test, **5–8 diagramas**, **≥ 2 ejemplos ejecutables por lección** y simulaciones `sessions` donde se indica. Todo verificado con el validador. Formato: `ESQUEMA.md`. Datos: `DATOS.md`.

Para no repetir: cada sección enseña SOLO lo suyo y puede usar lo de secciones anteriores (nunca lo de las siguientes, salvo un adelanto de una frase). Las secciones posteriores pueden hacer referencias («como viste en la sección 8…»).

## Nivel 1 · Fundamentos de SQL (`fundamentos`)

### s01 · Primeros pasos con PostgreSQL y psql (dataset principal: tienda)
1. Qué es una base de datos relacional y qué es PostgreSQL: tablas, filas, columnas; de Berkeley (Stonebraker, POSTGRES 1986) a PostgreSQL; licencia libre; por qué se usa tanto; SQL como lenguaje declarativo.
2. Arquitectura en 10 minutos: cliente-servidor, clúster → bases de datos → esquemas → tablas; un proceso por conexión; puerto 5432; dónde vive (`SELECT version()`, `current_database()`, `\l`, `\dn`, `\conninfo`). Cómo se instala en la vida real (bloques de solo lectura: Homebrew, Postgres.app, apt, Docker) y que en el curso todo es simulado.
3. psql, tu consola: el prompt y sus estados (`=#`, `-#`, `=*#`, `=!#`, `>`), terminar con `;`, varias líneas, `\?`, `\h`, `\d`, `\dt`, `\d tabla`, `\x`, `\timing`, historial, `\q`.
4. Tu primera consulta: `SELECT *` vs columnas, `LIMIT`, mayúsculas, comentarios `--` y `/* */`, errores y cómo leerlos (`LINE 1:` y `^`, `HINT`).
5. Aprender a pedir ayuda: `\h SELECT`, `\errverbose`, SQLSTATE, cómo navegar la documentación oficial.
Ejercicios: consultas simples (query) y exploración en psql (psql: crear una base con `CREATE DATABASE`, `\c` a ella, crear una tabla…).

### s02 · SELECT: consultar y filtrar datos (tienda)
1. SELECT y FROM: columnas, expresiones calculadas (precio − costo), alias (`AS`, comillas dobles), `DISTINCT`.
2. WHERE: comparaciones, `AND`/`OR`/`NOT` y precedencia (paréntesis), `BETWEEN`, `IN`, `LIKE`/`ILIKE` y comodines.
3. NULL y la lógica de tres valores: `IS NULL`, `IS DISTINCT FROM`, por qué `= NULL` nunca es verdadero, `COALESCE` (adelanto).
4. ORDER BY (ASC/DESC, varias columnas, `NULLS FIRST/LAST`, por alias o posición), `LIMIT`/`OFFSET`, `FETCH FIRST n ROWS WITH TIES`.
5. `DISTINCT ON` (propio de PostgreSQL) y el orden lógico de evaluación de una consulta (FROM → WHERE → SELECT → DISTINCT → ORDER BY → LIMIT), con diagrama.

### s03 · Tipos de datos y conversiones
1. Numéricos: `smallint`/`integer`/`bigint`, `numeric(p,s)` exacto vs `real`/`double precision` (0.1 + 0.2), por qué no usar `money`, desbordamientos.
2. Texto: `text` vs `varchar(n)` vs `char(n)`, largo, espacios, colaciones (solo C/libc en la simulación).
3. Fecha y hora: `date`, `time`, `timestamp` vs **`timestamptz`** (la gran trampa), `interval`, zonas horarias (`America/Santiago`, horario de verano: `-03`/`-04`), `now()` vs `clock_timestamp()`, literales ISO.
4. Otros tipos: `boolean`, `uuid` (`gen_random_uuid()`, `uuidv7()` nuevo en 18), `enum` (adelanto), arrays y `jsonb` (adelanto), `bytea`, `inet`.
5. Conversiones: `CAST`, `::`, `to_char`/`to_date`/`to_number`, `pg_typeof`, errores de conversión.

### s04 · Funciones y expresiones
1. Texto: `||`, `concat`, `concat_ws`, `upper`/`lower`/`initcap`, `length`, `trim`, `substring`, `left`/`right`, `position`, `replace`, `split_part`, `format()`, `lpad`.
2. Números: aritmética, **división entera** (5/2 = 2), `round`/`trunc`/`ceil`/`floor`, `mod`, `abs`, `power`; formatear pesos chilenos con `to_char`.
3. Fechas: `date_trunc`, `extract`, `age`, aritmética con `interval`, `generate_series` de fechas, `to_char` para formatear.
4. Condicionales: `CASE` (simple y buscado), `COALESCE`, `NULLIF` (evitar división por cero), `GREATEST`/`LEAST`.
5. Patrones y expresiones regulares: `~`, `~*`, `!~`, `SIMILAR TO`, `regexp_replace`, `regexp_match(es)`, `regexp_split_to_table`; validar formatos (RUT, email).

### s05 · Crear tablas y restricciones (DDL)
1. `CREATE TABLE`: tipos, `NOT NULL`, `DEFAULT`, columnas de identidad (`GENERATED ALWAYS/BY DEFAULT AS IDENTITY` vs `serial`), `COMMENT ON`, `IF NOT EXISTS`, `\d` y `\d+`.
2. Restricciones: `PRIMARY KEY`, `UNIQUE` (y `NULLS NOT DISTINCT`, desde 15), `CHECK`, `FOREIGN KEY` con `ON DELETE/UPDATE` (CASCADE, SET NULL, RESTRICT, NO ACTION), nombres de restricciones, `DEFERRABLE` (adelanto).
3. `ALTER TABLE`: agregar/quitar/renombrar columnas, cambiar tipo con `USING`, defaults, agregar restricciones (`NOT VALID` + `VALIDATE CONSTRAINT`), `DROP TABLE … CASCADE`.
4. Columnas generadas `STORED` y `VIRTUAL` (virtual es el valor por defecto desde 18); restricciones NOT NULL visibles en `\d+` (18).
5. Esquemas y `search_path`: `CREATE SCHEMA`, nombres calificados, el esquema `public` (cambios de permisos en 15), convenciones de nombres.

### s06 · Insertar, modificar y borrar datos (DML)
1. `INSERT`: varias filas, columnas explícitas, `DEFAULT`, `INSERT … SELECT`, `RETURNING`.
2. `UPDATE` (expresiones, `UPDATE … FROM`, `RETURNING`, `OLD`/`NEW` en RETURNING nuevo en 18) y `DELETE` (`USING`, `RETURNING`); `TRUNCATE` (`RESTART IDENTITY`, `CASCADE`). Siempre con WHERE (y cómo protegerse con una transacción).
3. Upsert: `INSERT … ON CONFLICT DO NOTHING / DO UPDATE SET … = EXCLUDED.…`, objetivo del conflicto, casos reales (sincronizar precios).
4. `MERGE` (desde 15; `RETURNING` y `WHEN NOT MATCHED BY SOURCE` desde 17).
5. Carga masiva: `COPY … FROM STDIN`, `\copy` con archivos CSV (`files` del ejercicio), `COPY … TO STDOUT`, `HEADER`, `CSV`, `ON_ERROR ignore` (17), `generate_series` para datos de prueba.

## Nivel 2 · Consultas avanzadas (`consultas`)

### s07 · Agregación y agrupamiento (tienda, colegio)
1. `count(*)` vs `count(col)` vs `count(DISTINCT col)`, `sum`, `avg`, `min`, `max`; NULL en agregados; redondeos.
2. `GROUP BY`: la regla de oro (agrupada o agregada), agrupar por expresiones (`date_trunc('month', fecha)`), por varias columnas; errores típicos.
3. `HAVING` vs `WHERE`; `FILTER (WHERE …)` para agregados condicionales y tablas dinámicas (pivot).
4. `string_agg`, `array_agg` (con `ORDER BY` interno), `bool_and`/`bool_or`, `percentile_cont`/`percentile_disc`, `mode()`, `stddev`, `any_value` (16).
5. `GROUPING SETS`, `ROLLUP`, `CUBE`, `grouping()`: reportes con subtotales y total general.

### s08 · JOIN: combinar tablas (tienda, rrhh, biblioteca)
1. Por qué los datos están repartidos (adelanto de normalización), diagrama ER de tienda; `INNER JOIN … ON`, alias de tablas.
2. `LEFT`/`RIGHT`/`FULL OUTER JOIN` y los NULL que aparecen; condición en `ON` vs en `WHERE` (la trampa clásica).
3. Joins de 3–4 tablas, **self join** (jefes y empleados en rrhh), `CROSS JOIN`, `USING` y `NATURAL` (y sus riesgos).
4. Semi-join y anti-join: `EXISTS`/`NOT EXISTS`, `IN`, **la trampa de `NOT IN` con NULL**, `LEFT JOIN … WHERE … IS NULL` (clientes sin pedidos, libros nunca prestados).
5. `LATERAL`: top-N por grupo, funciones que devuelven conjuntos en el FROM (`unnest`, `generate_series`).

### s09 · Subconsultas, CTE y operaciones de conjuntos (tienda, rrhh)
1. Subconsultas escalares, en `WHERE` (`IN`, `ANY`/`ALL`, `EXISTS`) y en `FROM`; correlacionadas vs no correlacionadas.
2. `WITH` (CTE) para leer consultas complejas; `MATERIALIZED`/`NOT MATERIALIZED`; varias CTE encadenadas.
3. CTE recursivas: organigrama de rrhh, árbol de categorías, series; `SEARCH`/`CYCLE` (14).
4. CTE que modifican datos (`WITH borrados AS (DELETE … RETURNING …) INSERT …`).
5. `UNION` / `UNION ALL` / `INTERSECT` / `EXCEPT`, `VALUES` como tabla.

### s10 · Funciones de ventana (colegio, tienda, rrhh, metro)
1. Qué es una ventana: `OVER ()`, `PARTITION BY`; agregado normal vs de ventana (las filas no se colapsan); porcentaje del total.
2. Rankings: `row_number`, `rank`, `dense_rank`, `ntile`, `percent_rank`; top-N por grupo (mejores alumnos por curso).
3. `lag`/`lead`, `first_value`/`last_value` (¡la trampa del marco por defecto!), `nth_value`; variación mes a mes de las ventas; reajustes de sueldo.
4. Marcos: `ROWS`/`RANGE`/`GROUPS BETWEEN …`, acumulados, promedios móviles, `EXCLUDE`, `WINDOW w AS (…)`.
5. Problemas clásicos: huecos e islas (gaps & islands), rachas, deduplicar con `row_number`, primera compra de cada cliente.

## Nivel 3 · Diseño de bases de datos (`diseno`)

### s11 · Modelado y normalización
1. Del problema al modelo: entidades, atributos, relaciones y cardinalidad; `erDiagram` con casos chilenos (reserva de canchas, consulta médica, colegio).
2. Relaciones 1-1, 1-N, N-M (tabla intermedia con atributos propios), autorreferencias y jerarquías.
3. Normalización con ejemplos de anomalías: 1FN, 2FN, 3FN, BCNF; cuándo y cómo desnormalizar a conciencia.
4. Claves naturales vs sustitutas (identity, `uuid`/`uuidv7`), claves compuestas, integridad referencial; tipos correctos (pesos en `integer`/`numeric`, fechas con zona).
5. Patrones y antipatrones: borrado lógico, auditoría (`creado_en`/`actualizado_en`), estados con CHECK vs enum vs tabla catálogo, EAV vs `jsonb`, convenciones de nombres.
Ejercicios `script` que piden implementar un modelo a partir de requisitos (las comprobaciones revisan PK, FK, UNIQUE, CHECK, tipos) y un proyecto de modelado completo.

### s12 · Vistas, secuencias, dominios y rangos
1. Vistas: `CREATE VIEW`, vistas actualizables, `WITH CHECK OPTION`, `security_barrier` y `security_invoker` (15).
2. Vistas materializadas: `REFRESH`, `CONCURRENTLY` (requiere índice único), cuándo conviene.
3. Secuencias: `nextval`/`currval`/`setval`, la identidad por dentro, los huecos (y por qué no importan), `OWNED BY`.
4. Dominios (`CREATE DOMAIN rut …`), enum (`ALTER TYPE … ADD VALUE`), tipos compuestos.
5. Rangos y multirrangos (`daterange`, `tstzrange`, `&&`, `@>`), restricciones de exclusión (`EXCLUDE USING gist` con `btree_gist`) para reservas que no se solapan; `WITHOUT OVERLAPS` en llaves temporales (18).

## Nivel 4 · PostgreSQL avanzado (`avanzado`)

### s13 · Transacciones, MVCC y concurrencia — **muchas simulaciones `sessions`**
1. ACID; `BEGIN`/`COMMIT`/`ROLLBACK`; autocommit de psql; transacción fallida (`=!#`); `SAVEPOINT`/`ROLLBACK TO`; `\set ON_ERROR_ROLLBACK on`.
2. MVCC por dentro: `xmin`/`xmax`/`ctid`, versiones de fila, snapshots, `pg_current_xact_id()`; con `pageinspect` (una sesión) y con simulaciones (lectores no bloquean a escritores).
3. Niveles de aislamiento (READ COMMITTED, REPEATABLE READ, SERIALIZABLE) con simulaciones de cada anomalía (lectura no repetible, fantasma, actualización perdida, *write skew*) y el error de serialización `40001` + reintentos.
4. Bloqueos: de fila (`UPDATE`, `SELECT … FOR UPDATE/SHARE`, `NOWAIT`, `SKIP LOCKED`), de tabla (`LOCK TABLE`, modos), `pg_locks`, `pg_stat_activity`, `lock_timeout`.
5. Deadlocks (simulación con el error real), cómo evitarlos; advisory locks; colas de trabajo con `FOR UPDATE SKIP LOCKED` (simulación con dos trabajadores).

### s14 · Índices (metro, tienda)
1. Cómo se guardan los datos: páginas de 8 kB, heap, `ctid`, TOAST; qué hace un Seq Scan; qué es un B-tree (diagrama).
2. B-tree: igualdad, rangos, `ORDER BY`, índices multicolumna (el orden importa), `UNIQUE`; *skip scan* (18).
3. Índices parciales, de expresión (`lower(email)`), cubrientes (`INCLUDE`) e index-only scans (visibility map, `VACUUM`).
4. Otros tipos: Hash, GIN (arrays, jsonb, tsvector, trigramas), GiST (rangos, exclusión), BRIN (series de tiempo del metro), bloom.
5. Mantenimiento: `CREATE INDEX CONCURRENTLY`, `REINDEX`, índices inválidos, tamaño, índices sin uso (`pg_stat_user_indexes`), el costo en escrituras, cuándo NO indexar.
Ejercicios `script` con `usa_indice(…)` y `plan(…)`.

### s15 · EXPLAIN y optimización (metro, tienda)
1. El planificador y los costos: `EXPLAIN`, costo inicial/total, filas estimadas, `width`; estadísticas (`pg_stats`, `ANALYZE`).
2. `EXPLAIN ANALYZE` (con BUFFERS por defecto en 18): tiempos reales, `loops`, `Rows Removed by Filter`; leer de adentro hacia afuera; Seq/Index/Index Only/Bitmap Scan.
3. Joins en el plan: Nested Loop, Hash Join, Merge Join; Sort, HashAggregate vs GroupAggregate, Memoize; `work_mem`.
4. Cuando el planificador se equivoca: estimaciones malas, columnas correlacionadas, `CREATE STATISTICS` (dependencies, ndistinct, mcv), `default_statistics_target`.
5. Recetario: reescribir consultas (funciones sobre columnas, `NOT IN` → `NOT EXISTS`, OR → UNION), paginación keyset vs OFFSET, `pg_stat_statements` para encontrar las consultas lentas, `auto_explain`.

### s16 · Funciones y procedimientos (SQL y PL/pgSQL)
1. Funciones SQL: parámetros, `RETURNS`, cuerpos estándar `BEGIN ATOMIC` (14), volatilidad (`IMMUTABLE`/`STABLE`/`VOLATILE`), `STRICT`, `\df`, `\sf`.
2. PL/pgSQL: `DECLARE`, `%TYPE`/`%ROWTYPE`, `IF`/`CASE`, `LOOP`/`WHILE`/`FOR`, `RAISE NOTICE`, bloques `DO`.
3. Devolver conjuntos: `RETURNS TABLE`, `SETOF`, `RETURN QUERY`/`NEXT`; `OUT`/`INOUT`, `VARIADIC`, `DEFAULT`, sobrecarga.
4. Errores: `RAISE EXCEPTION … USING ERRCODE/HINT`, `EXCEPTION WHEN … THEN`, `GET STACKED DIAGNOSTICS`, costo de los bloques con excepción.
5. Procedimientos (`CREATE PROCEDURE`, `CALL`, `COMMIT` dentro), SQL dinámico (`EXECUTE format(… %I … %L …) USING`), inyección SQL, `SECURITY DEFINER` con `search_path` seguro.

### s17 · Triggers y eventos
1. Qué es un trigger: `BEFORE`/`AFTER`/`INSTEAD OF`, `FOR EACH ROW/STATEMENT`, `NEW`/`OLD`, `TG_OP`, qué retorna la función.
2. Casos reales: `actualizado_en` automático, validaciones de negocio, valores derivados (stock), auditoría con `jsonb` (`to_jsonb(OLD)`).
3. Triggers por sentencia con tablas de transición (`REFERENCING NEW TABLE AS …`), `WHEN`, orden de ejecución, recursión (`pg_trigger_depth()`), costo.
4. `INSTEAD OF` en vistas; event triggers para DDL (`ddl_command_end`, `pg_event_trigger_ddl_commands()`).
5. `LISTEN`/`NOTIFY`: canales, payload, `pg_notify` desde triggers; simulación con una sesión que escucha y otra que notifica (una notificación solo se entrega al confirmar).

### s18 · JSON, arrays y búsqueda de texto (biblioteca, tienda)
1. `json` vs `jsonb`; operadores `->`, `->>`, `#>`, `#>>`, `@>`, `?`, `?|`, `?&`; construir (`jsonb_build_object`, `jsonb_agg`, `to_jsonb`) y modificar (`jsonb_set`, `||`, `-`).
2. SQL/JSON: jsonpath (`@?`, `@@`, `jsonb_path_query`), `JSON_TABLE`, `JSON_VALUE`, `JSON_QUERY`, `JSON_EXISTS` (17), `IS JSON` (16); índices GIN (`jsonb_ops` vs `jsonb_path_ops`).
3. Arrays: literales, `ANY`/`ALL`, `@>`, `&&`, `unnest`, `array_agg`, `cardinality`, índices GIN; cuándo usar un array y cuándo una tabla.
4. Búsqueda de texto completo: `tsvector`, `tsquery`, `to_tsvector('spanish', …)`, `websearch_to_tsquery`, `@@`, `ts_rank`, `ts_headline`, columna generada + índice GIN; `unaccent`.
5. Búsqueda aproximada: `pg_trgm` (`similarity`, `%`, `word_similarity`, índices GIN de trigramas para `LIKE '%x%'`), `fuzzystrmatch` (`levenshtein`); `hstore` y `ltree` en breve.

## Nivel 5 · Experto y administración (`experto`)

### s19 · Seguridad: roles, privilegios y RLS
1. Roles: `CREATE ROLE/USER`, `LOGIN`, atributos (`SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`), membresía y herencia (`INHERIT`, opción `SET` de 16), `\du`, `\drg`; roles predefinidos (`pg_read_all_data`, `pg_write_all_data`, `pg_monitor`, `pg_maintain` de 17).
2. Privilegios: `GRANT`/`REVOKE` en tablas, columnas, secuencias, esquemas (`USAGE`, `CREATE`), funciones (`EXECUTE`); `PUBLIC`; propiedad; `ALTER DEFAULT PRIVILEGES`; `\dp`; `MAINTAIN` (17). Practicar con `\c - usuario`.
3. Row Level Security: `ENABLE`/`FORCE`, políticas `USING`/`WITH CHECK`, `PERMISSIVE`/`RESTRICTIVE`, por comando y rol; multi-inquilino con `current_setting('app.tenant_id')`.
4. Autenticación y conexión: `pg_hba.conf` (tipo, base, usuario, dirección, método), `scram-sha-256` (md5 obsoleto en 18), SSL, `listen_addresses` — con simulación de terminal (editar pg_hba, recargar, conexión rechazada).
5. Seguridad aplicada: inyección SQL y consultas parametrizadas (`PREPARE`/`EXECUTE`), `search_path` seguro, `SECURITY DEFINER` bien hecho, `pgcrypto` (`crypt`/`gen_salt('bf')`, `pgp_sym_encrypt`), mínimo privilegio.

### s20 · Particionamiento y datos grandes (metro)
1. Por qué particionar; particionamiento declarativo `RANGE`, `LIST`, `HASH`; partición por defecto.
2. Poda de particiones en el plan (`EXPLAIN`), índices en tablas particionadas, la PK debe incluir la clave, subparticiones.
3. Mantenimiento: `ATTACH`/`DETACH PARTITION` (`CONCURRENTLY`), retención (borrar particiones viejas), mover datos, joins y agregados por partición.
4. Datos grandes: cargas con `generate_series`/`COPY`, tablas `UNLOGGED`, `BRIN`, `TABLESAMPLE`, tamaños (`pg_total_relation_size`, `pg_size_pretty`), TOAST y compresión (`lz4`).
5. Herencia clásica vs particiones; escalar horizontalmente (Citus, FDW) en forma conceptual.

### s21 · Administración y mantenimiento — simulaciones de terminal
1. Arquitectura: postmaster, backends, procesos auxiliares (checkpointer, background writer, walwriter, autovacuum), memoria (`shared_buffers`, `work_mem`, `maintenance_work_mem`), el directorio de datos (`base/`, `global/`, `pg_wal/`).
2. Configuración: `postgresql.conf`, `pg_settings` (contextos: postmaster/sighup/user…), `SET`, `ALTER SYSTEM`, `ALTER DATABASE/ROLE … SET`, `pg_reload_conf()`, `SHOW`, `\dconfig`.
3. VACUUM y autovacuum: tuplas muertas y *bloat*, `VACUUM` vs `VACUUM FULL`, congelamiento y *wraparound*, visibility map, `pg_stat_user_tables`, ajustes por tabla.
4. Monitoreo: `pg_stat_activity`, `pg_locks`, `pg_stat_statements`, `pg_stat_io` (16), `pg_stat_database`, tasa de aciertos de caché, logs (`log_min_duration_statement`).
5. Operación: WAL y checkpoints (`pg_current_wal_lsn()`, `pg_walinspect`), `pg_ctl` (start/stop y modos smart/fast/immediate), versiones menores vs mayores y `pg_upgrade`, `pgbench`.

### s22 · Respaldos y recuperación — simulaciones de terminal
1. Estrategia: respaldo lógico vs físico, RPO/RTO, regla 3-2-1, **probar las restauraciones**.
2. `pg_dump`/`pg_restore`: formatos (`-Fp`, `-Fc`, `-Fd`, `-Ft`), `-j`, `--schema-only`/`--data-only`, `-t`, `pg_restore --list`/`-L`, `--clean --if-exists`; `pg_dumpall --globals-only`.
3. Restaurar: `createdb` + `psql -f` / `pg_restore -d`; en la consola del curso, `\i archivo.sql` con archivos del ejercicio.
4. Respaldo físico: `pg_basebackup` (`-Ft -z -P -Xs`), `pg_verifybackup`, archivado continuo de WAL (`archive_mode`, `archive_command`), respaldos incrementales (`--incremental` + `pg_combinebackup`, 17).
5. Recuperación a un punto en el tiempo (PITR): `restore_command`, `recovery_target_time`, `recovery.signal`; simulación completa: respaldo base → cambios → `DROP TABLE` por error → recuperar justo antes.

### s23 · Replicación y alta disponibilidad — simulaciones de terminal
1. Conceptos: WAL, primario y réplica (standby), sincrónica vs asincrónica, *lag*, failover vs switchover, *split brain*.
2. Réplica física paso a paso: `pg_basebackup -R`, `standby.signal`, `primary_conninfo`, `pg_stat_replication`, consultas de solo lectura en la réplica y el error al escribir.
3. Slots de replicación, `synchronous_commit`/`synchronous_standby_names`, promoción (`pg_promote()`), `pg_rewind`.
4. Replicación lógica: `CREATE PUBLICATION`/`SUBSCRIPTION`, filtros de filas y columnas (15), `pg_createsubscriber` (17), usos (migraciones, integración).
5. Arquitecturas de alta disponibilidad: Patroni, PgBouncer, balanceo de lectura, servicios administrados en la nube (conceptual, con diagramas).

### s24 · PostgreSQL en aplicaciones
1. Conectarse desde código: URI de conexión, drivers (psycopg 3, node-postgres, JDBC), pooling (PgBouncer y sus modos), consultas parametrizadas; `PREPARE`/`EXECUTE`.
2. Patrones de escritura: upsert idempotente, contadores sin carreras, colas con `SKIP LOCKED` (simulación con dos trabajadores), patrón *outbox*, advisory locks.
3. Patrones de lectura: paginación keyset, el problema N+1 de los ORM y cómo evitarlo (joins, `json_agg` para anidar), vistas materializadas como caché.
4. Migraciones sin caídas: columna nullable + relleno por lotes, `CREATE INDEX CONCURRENTLY`, `NOT VALID` + `VALIDATE`, `lock_timeout`, renombrar sin romper; herramientas (Flyway, Alembic, Prisma) en forma conceptual.
5. Errores en producción: SQLSTATE comunes (`23505`, `23503`, `40001`, `40P01`, `57014`), reintentos, `statement_timeout`, `idle_in_transaction_session_timeout`, `transaction_timeout` (17); lista de buenas prácticas.

### s25 · Extensiones: pgvector, PostGIS y más
1. Extensiones: `CREATE EXTENSION`, `\dx`, versiones; `pgcrypto`, `citext`, `hstore`, `ltree`, `tablefunc` (`crosstab`), `uuid-ossp` vs `gen_random_uuid()`/`uuidv7()`.
2. pgvector: embeddings, `vector(n)`, distancias (`<->`, `<=>`, `<#>`), vecinos más cercanos, índices HNSW e IVFFlat, búsqueda semántica con vectores pequeños hechos a mano; idea de RAG.
3. PostGIS (`"extra": ["postgis"]`): `geometry` vs `geography`, SRID 4326, `ST_MakePoint`, `ST_Distance`, `ST_DWithin`, `ST_Contains`, índices GiST; estaciones del metro y comunas.
4. Herramientas internas: `pageinspect`, `pg_visibility`, `pg_buffercache`, `amcheck`, `pg_stat_statements`; FDW y el ecosistema (TimescaleDB, Citus) de forma conceptual.
5. Novedades de PostgreSQL 16, 17 y 18 con ejemplos ejecutables (`uuidv7()`, columnas virtuales, `OLD`/`NEW` en `RETURNING`, `JSON_TABLE`, `MERGE … RETURNING`, skip scan, `EXPLAIN` con BUFFERS por defecto, llaves temporales…).

## Final (`extra`)

### s26 · Proyecto final integrador: «Reservas Andes»
Un sistema de reservas (canchas o salas de un centro deportivo con sedes en varias comunas) construido paso a paso: requisitos y modelo ER; esquema con restricciones (incluida exclusión para que no se solapen reservas); datos; índices y `EXPLAIN`; consultas analíticas (ventanas, agregados); vistas; funciones y triggers de auditoría; roles y RLS por sede; respaldo (simulación). 5 lecciones-guía y 10–12 ejercicios de nivel `proyecto` (script) que se encadenan (cada uno parte con el setup que deja el anterior). Cierra con cómo seguir: certificaciones (EDB PostgreSQL Associate/Professional), documentación, comunidad.
