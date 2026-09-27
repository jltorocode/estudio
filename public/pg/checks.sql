-- Funciones auxiliares para comprobar ejercicios. Se crean en una COPIA desechable de la base del alumno
-- (esquema verif, al final del search_path), así que el alumno nunca las ve.
CREATE SCHEMA verif;

CREATE FUNCTION verif.rel(nombre text) RETURNS oid LANGUAGE sql STABLE AS $$ SELECT to_regclass(nombre)::oid $$;

CREATE FUNCTION verif.existe_tabla(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(nombre) AND relkind IN ('r','p')) $$;
CREATE FUNCTION verif.existe_vista(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(nombre) AND relkind = 'v') $$;
CREATE FUNCTION verif.existe_vista_mat(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(nombre) AND relkind = 'm') $$;
CREATE FUNCTION verif.existe_indice(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(nombre) AND relkind IN ('i','I')) $$;
CREATE FUNCTION verif.existe_secuencia(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(nombre) AND relkind = 'S') $$;
CREATE FUNCTION verif.existe_esquema(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = nombre) $$;
CREATE FUNCTION verif.existe_rol(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = nombre) $$;
CREATE FUNCTION verif.existe_tipo(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT to_regtype(nombre) IS NOT NULL $$;
CREATE FUNCTION verif.existe_extension(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = nombre) $$;
CREATE FUNCTION verif.existe_base(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = nombre) $$;
CREATE FUNCTION verif.existe_funcion(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind IN ('f','a','w') AND (CASE WHEN nombre LIKE '%.%' THEN n.nspname || '.' || p.proname = nombre ELSE p.proname = nombre AND pg_function_is_visible(p.oid) END)) $$;
CREATE FUNCTION verif.existe_procedimiento(nombre text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'p' AND (CASE WHEN nombre LIKE '%.%' THEN n.nspname || '.' || p.proname = nombre ELSE p.proname = nombre AND pg_function_is_visible(p.oid) END)) $$;
CREATE FUNCTION verif.existe_trigger(tabla text, nombre text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass(tabla) AND NOT tgisinternal AND (nombre IS NULL OR tgname = nombre)) $$;
CREATE FUNCTION verif.existe_politica(tabla text, nombre text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = to_regclass(tabla) AND (nombre IS NULL OR polname = nombre)) $$;
CREATE FUNCTION verif.existe_columna(tabla text, columna text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(tabla) AND attname = columna AND attnum > 0 AND NOT attisdropped) $$;

CREATE FUNCTION verif.tipo_columna(tabla text, columna text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = to_regclass(tabla) AND attname = columna AND NOT attisdropped $$;
CREATE FUNCTION verif.es_not_null(tabla text, columna text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT attnotnull FROM pg_attribute WHERE attrelid = to_regclass(tabla) AND attname = columna AND NOT attisdropped), false) $$;
CREATE FUNCTION verif.default_columna(tabla text, columna text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE d.adrelid = to_regclass(tabla) AND a.attname = columna $$;
CREATE FUNCTION verif.es_identity(tabla text, columna text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT attidentity <> '' FROM pg_attribute WHERE attrelid = to_regclass(tabla) AND attname = columna), false) $$;
CREATE FUNCTION verif.es_generada(tabla text, columna text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(attgenerated::text, '') FROM pg_attribute WHERE attrelid = to_regclass(tabla) AND attname = columna $$;

CREATE FUNCTION verif.cols(rel oid, nums int2[]) RETURNS text[] LANGUAGE sql STABLE AS $$
  SELECT array_agg(a.attname::text ORDER BY k.i) FROM unnest(nums) WITH ORDINALITY k(n, i) JOIN pg_attribute a ON a.attrelid = rel AND a.attnum = k.n $$;
CREATE FUNCTION verif.mismo_conjunto(a text[], b text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND (SELECT array_agg(x ORDER BY x) FROM unnest(a) x) = (SELECT array_agg(x ORDER BY x) FROM unnest(b) x) $$;

CREATE FUNCTION verif.es_pk(tabla text, columnas text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'p' AND verif.mismo_conjunto(verif.cols(conrelid, conkey), columnas)) $$;
CREATE FUNCTION verif.tiene_pk(tabla text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'p') $$;
CREATE FUNCTION verif.es_unique(tabla text, columnas text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = to_regclass(tabla) AND i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND verif.mismo_conjunto(verif.cols(i.indrelid, (i.indkey::int2[])[0:i.indnkeyatts - 1]), columnas)) $$;
CREATE FUNCTION verif.num_checks(tabla text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'c' $$;
CREATE FUNCTION verif.checks_de(tabla text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(pg_get_constraintdef(oid), ' ' ORDER BY conname), '') FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'c' $$;
CREATE FUNCTION verif.es_fk(tabla text, columnas text[], ref_tabla text, ref_columnas text[] DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'f' AND confrelid = to_regclass(ref_tabla)
    AND verif.mismo_conjunto(verif.cols(conrelid, conkey), columnas)
    AND (ref_columnas IS NULL OR verif.mismo_conjunto(verif.cols(confrelid, confkey), ref_columnas))) $$;
CREATE FUNCTION verif.accion_fk(tabla text, columnas text[]) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END
  FROM pg_constraint WHERE conrelid = to_regclass(tabla) AND contype = 'f' AND verif.mismo_conjunto(verif.cols(conrelid, conkey), columnas) LIMIT 1 $$;
CREATE FUNCTION verif.tiene_indice(tabla text, columnas text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = to_regclass(tabla)
    AND verif.cols(i.indrelid, (i.indkey::int2[])[0:i.indnkeyatts - 1]) = columnas) $$;
CREATE FUNCTION verif.metodo_indice(nombre text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT am.amname::text FROM pg_class c JOIN pg_am am ON am.oid = c.relam WHERE c.oid = to_regclass(nombre) $$;
CREATE FUNCTION verif.def_indice(nombre text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT pg_get_indexdef(to_regclass(nombre)) $$;
CREATE FUNCTION verif.indices_de(tabla text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(pg_get_indexdef(indexrelid), E'\n' ORDER BY indexrelid::regclass::text), '') FROM pg_index WHERE indrelid = to_regclass(tabla) $$;

CREATE FUNCTION verif.filas(tabla text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE format('SELECT count(*) FROM %s', to_regclass(tabla)) INTO n; RETURN n; END $$;
CREATE FUNCTION verif.valor(consulta text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text; BEGIN EXECUTE consulta INTO v; RETURN v; END $$;
CREATE FUNCTION verif.num_filas(consulta text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE format('SELECT count(*) FROM (%s) s', consulta) INTO n; RETURN n; END $$;
CREATE FUNCTION verif.mismas_filas(a text, b text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN
  EXECUTE format('SELECT count(*) FROM ((%s) EXCEPT ALL (%s)) x', a, b) INTO n; IF n > 0 THEN RETURN false; END IF;
  EXECUTE format('SELECT count(*) FROM ((%s) EXCEPT ALL (%s)) x', b, a) INTO n; RETURN n = 0; END $$;
CREATE FUNCTION verif.falla(sentencia text, sqlstate_esperado text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sentencia;
  EXCEPTION WHEN OTHERS THEN
    RETURN sqlstate_esperado IS NULL OR SQLSTATE = sqlstate_esperado;
  END;
  RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'deshacer';
EXCEPTION WHEN SQLSTATE 'P0099' THEN RETURN false;
END $$;
CREATE FUNCTION verif.funciona(sentencia text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sentencia;
  EXCEPTION WHEN OTHERS THEN RETURN false;
  END;
  RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'deshacer';
EXCEPTION WHEN SQLSTATE 'P0099' THEN RETURN true;
END $$;
CREATE FUNCTION verif.error_de(sentencia text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sentencia;
  EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ': ' || SQLERRM;
  END;
  RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'deshacer';
EXCEPTION WHEN SQLSTATE 'P0099' THEN RETURN NULL;
END $$;
CREATE FUNCTION verif.plan(consulta text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; salida text := ''; BEGIN
  FOR r IN EXECUTE 'EXPLAIN ' || consulta LOOP salida := salida || r || E'\n'; END LOOP; RETURN salida; END $$;
CREATE FUNCTION verif.usa_indice(consulta text, indice text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE p text := verif.plan(consulta); BEGIN
  IF indice IS NULL THEN RETURN p ~ '(Index Scan|Index Only Scan|Bitmap Index Scan)'; END IF;
  RETURN p ~ ('(Index Scan|Index Only Scan|Bitmap Index Scan)( Backward)? (using|on) ' || indice || '\M'); END $$;
CREATE FUNCTION verif.rls_activo(tabla text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass(tabla)), false) $$;
CREATE FUNCTION verif.rls_forzado(tabla text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT relforcerowsecurity FROM pg_class WHERE oid = to_regclass(tabla)), false) $$;
CREATE FUNCTION verif.privilegio(rol text, objeto text, priv text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT has_table_privilege(rol, objeto, priv) $$;
CREATE FUNCTION verif.es_miembro(rol text, grupo text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT pg_has_role(rol, grupo, 'MEMBER') $$;
CREATE FUNCTION verif.atributo_rol(rol text, atributo text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE v boolean; BEGIN EXECUTE format('SELECT %I FROM pg_roles WHERE rolname = $1', atributo) INTO v USING rol; RETURN coalesce(v, false); END $$;
CREATE FUNCTION verif.filas_como(rol text, consulta text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN
  EXECUTE format('SET LOCAL ROLE %I', rol);
  EXECUTE format('SELECT count(*) FROM (%s) s', consulta) INTO n;
  RESET ROLE; RETURN n; END $$;
CREATE FUNCTION verif.falla_como(rol text, sentencia text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', rol);
    EXECUTE sentencia;
  EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN true;
  END;
  RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'deshacer';
EXCEPTION WHEN SQLSTATE 'P0099' THEN RESET ROLE; RETURN false;
END $$;
CREATE FUNCTION verif.comentario(objeto text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT obj_description(to_regclass(objeto), 'pg_class') $$;
CREATE FUNCTION verif.es_particionada(tabla text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass(tabla) AND relkind = 'p') $$;
CREATE FUNCTION verif.num_particiones(tabla text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM pg_inherits WHERE inhparent = to_regclass(tabla) $$;
CREATE FUNCTION verif.clave_particion(tabla text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT pg_get_partkeydef(to_regclass(tabla)) $$;
CREATE FUNCTION verif.def_vista(nombre text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT pg_get_viewdef(to_regclass(nombre)) $$;
CREATE FUNCTION verif.def_funcion(nombre text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(pg_get_functiondef(p.oid), E'\n') FROM pg_proc p WHERE p.oid IN (
    SELECT p2.oid FROM pg_proc p2 JOIN pg_namespace n ON n.oid = p2.pronamespace
    WHERE CASE WHEN nombre LIKE '%.%' THEN n.nspname || '.' || p2.proname = nombre ELSE p2.proname = nombre AND pg_function_is_visible(p2.oid) END) $$;
CREATE FUNCTION verif.volatilidad(nombre text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' ELSE 'volatile' END FROM pg_proc WHERE proname = nombre LIMIT 1 $$;
CREATE FUNCTION verif.lenguaje(nombre text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT l.lanname::text FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname = nombre LIMIT 1 $$;
CREATE FUNCTION verif.config_rol(rol text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_to_string(setconfig, ', '), '') FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole WHERE r.rolname = rol AND s.setdatabase = 0 $$;
CREATE FUNCTION verif.config_base(base text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_to_string(setconfig, ', '), '') FROM pg_db_role_setting s JOIN pg_database d ON d.oid = s.setdatabase WHERE d.datname = base AND s.setrole = 0 $$;
