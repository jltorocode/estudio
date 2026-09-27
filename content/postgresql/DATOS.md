# Conjuntos de datos del curso de PostgreSQL

Generados por `node scripts/gen-datasets.mjs` (deterministas) en `public/pg/datasets/*.sql`. Cada uno vive en una base de datos con su mismo nombre (`"dataset": "tienda"` → base `tienda`, prompt `tienda=#`). Este documento se genera con `node scripts/doc-datasets.mjs` usando la misma consola psql simulada del curso.

## tienda

Comercio electrónico chileno «Tienda Andes»: categorías (con jerarquía padre_id), productos (precios en CLP enteros), clientes (RUT válidos, algunos sin email/teléfono/comuna), pedidos (2025-01 a 2026-06, estados y método de pago; `pendiente` sin método), detalle de pedidos (precio histórico por ítem) y reseñas (nota 1–5, comentarios en español, algunos NULL). Hay clientes sin pedidos y productos nunca vendidos.

### categorias (13 filas)

```
              Table "public.categorias"
  Column  |  Type   | Collation | Nullable | Default 
----------+---------+-----------+----------+---------
 id       | integer |           | not null | 
 nombre   | text    |           | not null | 
 padre_id | integer |           |          | 
Indexes:
    "categorias_pkey" PRIMARY KEY, btree (id)
    "categorias_nombre_key" UNIQUE CONSTRAINT, btree (nombre)
Foreign-key constraints:
    "categorias_padre_id_fkey" FOREIGN KEY (padre_id) REFERENCES categorias(id)
Referenced by:
    TABLE "categorias" CONSTRAINT "categorias_padre_id_fkey" FOREIGN KEY (padre_id) REFERENCES categorias(id)
    TABLE "productos" CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES categorias(id)
```

Ejemplo:

```
 id |   nombre    | padre_id 
----+-------------+----------
  1 | Tecnología  |         
  2 | Computación |        1
  3 | Audio       |        1
(3 rows)
```

### productos (49 filas)

```
                           Table "public.productos"
    Column    |  Type   | Collation | Nullable |           Default            
--------------+---------+-----------+----------+------------------------------
 id           | integer |           | not null | generated always as identity
 sku          | text    |           | not null | 
 nombre       | text    |           | not null | 
 categoria_id | integer |           | not null | 
 precio       | integer |           | not null | 
 costo        | integer |           | not null | 
 stock        | integer |           | not null | 0
 activo       | boolean |           | not null | true
 creado_en    | date    |           | not null | 
Indexes:
    "productos_pkey" PRIMARY KEY, btree (id)
    "productos_sku_key" UNIQUE CONSTRAINT, btree (sku)
Check constraints:
    "productos_costo_check" CHECK (costo > 0)
    "productos_precio_check" CHECK (precio > 0)
    "productos_stock_check" CHECK (stock >= 0)
Foreign-key constraints:
    "productos_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES categorias(id)
Referenced by:
    TABLE "pedido_items" CONSTRAINT "pedido_items_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id)
    TABLE "resenas" CONSTRAINT "resenas_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id)
```

Ejemplo:

```
 id |   sku    |        nombre        | categoria_id | precio | costo  | stock | activo | creado_en  
----+----------+----------------------+--------------+--------+--------+-------+--------+------------
  1 | COMP-001 | Notebook 14" Ryzen 5 |            2 | 549990 | 343590 |    37 | t      | 2024-04-09
  2 | COMP-002 | Monitor 24" Full HD  |            2 | 129990 |  77810 |    84 | t      | 2025-06-20
  3 | COMP-003 | Teclado mecánico     |            2 |  49990 |  28900 |    16 | t      | 2024-08-30
(3 rows)
```

### clientes (60 filas)

```
                            Table "public.clientes"
     Column     |  Type   | Collation | Nullable |           Default            
----------------+---------+-----------+----------+------------------------------
 id             | integer |           | not null | generated always as identity
 rut            | text    |           | not null | 
 nombre         | text    |           | not null | 
 apellido       | text    |           | not null | 
 email          | text    |           |          | 
 telefono       | text    |           |          | 
 comuna         | text    |           |          | 
 region         | text    |           |          | 
 fecha_registro | date    |           | not null | 
Indexes:
    "clientes_pkey" PRIMARY KEY, btree (id)
    "clientes_email_key" UNIQUE CONSTRAINT, btree (email)
    "clientes_rut_key" UNIQUE CONSTRAINT, btree (rut)
Referenced by:
    TABLE "pedidos" CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    TABLE "resenas" CONSTRAINT "resenas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id)
```

Ejemplo:

```
 id |    rut     |  nombre  |    apellido     |            email             |    telefono     |   comuna   |    region     | fecha_registro 
----+------------+----------+-----------------+------------------------------+-----------------+------------+---------------+----------------
  1 | 19501525-2 | Lucas    | Castro Núñez    | lucas.castro@hotmail.com     |                 | Santiago   | Metropolitana | 2025-04-12
  2 | 23322749-8 | Benjamín | Contreras Bravo | benjamin.contreras@gmail.com |                 | La Serena  | Coquimbo      | 2024-08-07
  3 | 16517822-K | Agustina | Reyes Pizarro   | agustina.reyes66@gmail.com   | +56 9 3173 6076 | Talcahuano | Biobío        | 2025-09-14
(3 rows)
```

### pedidos (420 filas)

```
                                     Table "public.pedidos"
     Column     |           Type           | Collation | Nullable |           Default            
----------------+--------------------------+-----------+----------+------------------------------
 id             | integer                  |           | not null | generated always as identity
 cliente_id     | integer                  |           | not null | 
 fecha          | timestamp with time zone |           | not null | 
 estado         | text                     |           | not null | 
 metodo_pago    | text                     |           |          | 
 costo_despacho | integer                  |           | not null | 0
Indexes:
    "pedidos_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "pedidos_estado_check" CHECK (estado = ANY (ARRAY['pendiente'::text, 'pagado'::text, 'enviado'::text, 'entregado'::text, 'cancelado'::text]))
    "pedidos_metodo_pago_check" CHECK (metodo_pago = ANY (ARRAY['debito'::text, 'credito'::text, 'transferencia'::text]))
Foreign-key constraints:
    "pedidos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id)
Referenced by:
    TABLE "pedido_items" CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
```

Ejemplo:

```
 id | cliente_id |         fecha          |  estado   | metodo_pago | costo_despacho 
----+------------+------------------------+-----------+-------------+----------------
  1 |         26 | 2025-01-13 21:10:03-03 | cancelado | credito     |           3990
  2 |         40 | 2025-01-16 12:39:59-03 | entregado | debito      |           5990
  3 |         33 | 2025-01-18 20:24:35-03 | entregado | credito     |              0
(3 rows)
```

### pedido_items (818 filas)

```
                Table "public.pedido_items"
     Column      |  Type   | Collation | Nullable | Default 
-----------------+---------+-----------+----------+---------
 pedido_id       | integer |           | not null | 
 producto_id     | integer |           | not null | 
 cantidad        | integer |           | not null | 
 precio_unitario | integer |           | not null | 
Indexes:
    "pedido_items_pkey" PRIMARY KEY, btree (pedido_id, producto_id)
Check constraints:
    "pedido_items_cantidad_check" CHECK (cantidad > 0)
    "pedido_items_precio_unitario_check" CHECK (precio_unitario > 0)
Foreign-key constraints:
    "pedido_items_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    "pedido_items_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id)
```

Ejemplo:

```
 pedido_id | producto_id | cantidad | precio_unitario 
-----------+-------------+----------+-----------------
         1 |          12 |        1 |           23740
         1 |          29 |        1 |           12990
         2 |          44 |        1 |            5690
(3 rows)
```

### resenas (150 filas)

```
                            Table "public.resenas"
   Column    |   Type   | Collation | Nullable |           Default            
-------------+----------+-----------+----------+------------------------------
 id          | integer  |           | not null | generated always as identity
 producto_id | integer  |           | not null | 
 cliente_id  | integer  |           | not null | 
 nota        | smallint |           | not null | 
 comentario  | text     |           |          | 
 fecha       | date     |           | not null | 
Indexes:
    "resenas_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "resenas_nota_check" CHECK (nota >= 1 AND nota <= 5)
Foreign-key constraints:
    "resenas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    "resenas_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES productos(id)
```

Ejemplo:

```
 id | producto_id | cliente_id | nota |               comentario               |   fecha    
----+-------------+------------+------+----------------------------------------+------------
  1 |          44 |         40 |    4 | El mejor café que he probado en grano. | 2025-01-30
  2 |          47 |         40 |    2 |                                        | 2025-02-26
  3 |          36 |         49 |    1 | No funcionó como esperaba; lo devolví. | 2025-03-04
(3 rows)
```

## rrhh

Recursos humanos de «Andes Digital SpA»: departamentos, empleados con jerarquía (jefe_id; el gerente general no tiene jefe), historial de sueldos (reajustes), proyectos y asignaciones (N a M). Hay empleados que ya se fueron (fecha_salida) y una practicante sin departamento.

### departamentos (6 filas)

```
           Table "public.departamentos"
 Column |  Type   | Collation | Nullable | Default 
--------+---------+-----------+----------+---------
 id     | integer |           | not null | 
 nombre | text    |           | not null | 
 ciudad | text    |           | not null | 
Indexes:
    "departamentos_pkey" PRIMARY KEY, btree (id)
    "departamentos_nombre_key" UNIQUE CONSTRAINT, btree (nombre)
Referenced by:
    TABLE "empleados" CONSTRAINT "empleados_departamento_id_fkey" FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
```

Ejemplo:

```
 id |   nombre   |  ciudad  
----+------------+----------
  1 | Gerencia   | Santiago
  2 | Finanzas   | Santiago
  3 | Tecnología | Santiago
(3 rows)
```

### empleados (55 filas)

```
                  Table "public.empleados"
     Column      |  Type   | Collation | Nullable | Default 
-----------------+---------+-----------+----------+---------
 id              | integer |           | not null | 
 rut             | text    |           | not null | 
 nombre          | text    |           | not null | 
 apellido        | text    |           | not null | 
 email           | text    |           | not null | 
 departamento_id | integer |           |          | 
 cargo           | text    |           | not null | 
 jefe_id         | integer |           |          | 
 fecha_ingreso   | date    |           | not null | 
 fecha_salida    | date    |           |          | 
 sueldo          | integer |           | not null | 
Indexes:
    "empleados_pkey" PRIMARY KEY, btree (id)
    "empleados_email_key" UNIQUE CONSTRAINT, btree (email)
    "empleados_rut_key" UNIQUE CONSTRAINT, btree (rut)
Check constraints:
    "empleados_sueldo_check" CHECK (sueldo > 0)
Foreign-key constraints:
    "empleados_departamento_id_fkey" FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
    "empleados_jefe_id_fkey" FOREIGN KEY (jefe_id) REFERENCES empleados(id)
Referenced by:
    TABLE "asignaciones" CONSTRAINT "asignaciones_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    TABLE "empleados" CONSTRAINT "empleados_jefe_id_fkey" FOREIGN KEY (jefe_id) REFERENCES empleados(id)
    TABLE "historial_sueldos" CONSTRAINT "historial_sueldos_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleados(id)
```

Ejemplo:

```
 id |    rut     |  nombre  |   apellido    |             email              | departamento_id |         cargo         | jefe_id | fecha_ingreso | fecha_salida | sueldo  
----+------------+----------+---------------+--------------------------------+-----------------+-----------------------+---------+---------------+--------------+---------
  1 | 20716666-9 | Benjamín | Pérez Díaz    | benjamin.perez@andesdigital.cl |               1 | Gerente general       |         | 2012-08-21    |              | 8900000
  2 | 19870864-K | Rodrigo  | Tapia Vergara | rodrigo.tapia@andesdigital.cl  |               2 | Gerente de Finanzas   |       1 | 2015-11-26    |              | 5600000
  3 | 11126285-3 | Agustina | Núñez Cortés  | agustina.nunez@andesdigital.cl |               3 | Gerente de Tecnología |       1 | 2015-06-25    |              | 6200000
(3 rows)
```

### historial_sueldos (221 filas)

```
            Table "public.historial_sueldos"
   Column    |  Type   | Collation | Nullable | Default 
-------------+---------+-----------+----------+---------
 empleado_id | integer |           | not null | 
 desde       | date    |           | not null | 
 sueldo      | integer |           | not null | 
Indexes:
    "historial_sueldos_pkey" PRIMARY KEY, btree (empleado_id, desde)
Foreign-key constraints:
    "historial_sueldos_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleados(id)
```

Ejemplo:

```
 empleado_id |   desde    | sueldo  
-------------+------------+---------
           1 | 2012-08-21 | 6650000
           1 | 2013-11-30 | 7180000
           1 | 2014-11-23 | 7570000
(3 rows)
```

### proyectos (6 filas)

```
                Table "public.proyectos"
   Column    |  Type   | Collation | Nullable | Default 
-------------+---------+-----------+----------+---------
 id          | integer |           | not null | 
 nombre      | text    |           | not null | 
 inicio      | date    |           | not null | 
 fin         | date    |           |          | 
 presupuesto | bigint  |           | not null | 
Indexes:
    "proyectos_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "asignaciones" CONSTRAINT "asignaciones_proyecto_id_fkey" FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
```

Ejemplo:

```
 id |       nombre        |   inicio   |    fin     | presupuesto 
----+---------------------+------------+------------+-------------
  1 | Portal de clientes  | 2024-03-01 | 2025-02-28 |   180000000
  2 | Migración a la nube | 2024-09-02 | 2025-12-19 |   320000000
  3 | App de despacho     | 2025-04-01 |            |   145000000
(3 rows)
```

### asignaciones (67 filas)

```
               Table "public.asignaciones"
    Column    |  Type   | Collation | Nullable | Default 
--------------+---------+-----------+----------+---------
 empleado_id  | integer |           | not null | 
 proyecto_id  | integer |           | not null | 
 rol          | text    |           | not null | 
 horas_semana | integer |           | not null | 
Indexes:
    "asignaciones_pkey" PRIMARY KEY, btree (empleado_id, proyecto_id)
Check constraints:
    "asignaciones_horas_semana_check" CHECK (horas_semana >= 1 AND horas_semana <= 45)
Foreign-key constraints:
    "asignaciones_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    "asignaciones_proyecto_id_fkey" FOREIGN KEY (proyecto_id) REFERENCES proyectos(id)
```

Ejemplo:

```
 empleado_id | proyecto_id |        rol         | horas_semana 
-------------+-------------+--------------------+--------------
           2 |           2 | Administrador      |            8
           2 |           4 | Ingeniero de datos |           20
           3 |           2 | Arquitecto         |            4
(3 rows)
```

## colegio

Liceo con 6 cursos de enseñanza media, 7 asignaturas, alumnos y notas en escala chilena (1.0 a 7.0; se aprueba con 4.0): 2 semestres × 3 evaluaciones (la 3.ª del 2.º semestre aún no existe).

### cursos (6 filas)

```
                   Table "public.cursos"
    Column     |   Type   | Collation | Nullable | Default 
---------------+----------+-----------+----------+---------
 id            | integer  |           | not null | 
 nombre        | text     |           | not null | 
 nivel         | smallint |           | not null | 
 profesor_jefe | text     |           | not null | 
Indexes:
    "cursos_pkey" PRIMARY KEY, btree (id)
    "cursos_nombre_key" UNIQUE CONSTRAINT, btree (nombre)
Check constraints:
    "cursos_nivel_check" CHECK (nivel >= 1 AND nivel <= 4)
Referenced by:
    TABLE "alumnos" CONSTRAINT "alumnos_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES cursos(id)
```

Ejemplo:

```
 id |   nombre   | nivel |    profesor_jefe    
----+------------+-------+---------------------
  1 | 1° Medio A |     1 | Patricia Olivares
  2 | 1° Medio B |     1 | Hernán Tapia
  3 | 2° Medio A |     2 | Carmen Gloria Rojas
(3 rows)
```

### asignaturas (7 filas)

```
             Table "public.asignaturas"
 Column |   Type   | Collation | Nullable | Default 
--------+----------+-----------+----------+---------
 id     | integer  |           | not null | 
 nombre | text     |           | not null | 
 horas  | smallint |           | not null | 
Indexes:
    "asignaturas_pkey" PRIMARY KEY, btree (id)
    "asignaturas_nombre_key" UNIQUE CONSTRAINT, btree (nombre)
Referenced by:
    TABLE "notas" CONSTRAINT "notas_asignatura_id_fkey" FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
```

Ejemplo:

```
 id |   nombre   | horas 
----+------------+-------
  1 | Lenguaje   |     6
  2 | Matemática |     7
  3 | Historia   |     4
(3 rows)
```

### alumnos (171 filas)

```
                   Table "public.alumnos"
      Column      |  Type   | Collation | Nullable | Default 
------------------+---------+-----------+----------+---------
 id               | integer |           | not null | 
 rut              | text    |           | not null | 
 nombre           | text    |           | not null | 
 apellido         | text    |           | not null | 
 fecha_nacimiento | date    |           | not null | 
 curso_id         | integer |           | not null | 
 comuna           | text    |           | not null | 
Indexes:
    "alumnos_pkey" PRIMARY KEY, btree (id)
    "alumnos_rut_key" UNIQUE CONSTRAINT, btree (rut)
Foreign-key constraints:
    "alumnos_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES cursos(id)
Referenced by:
    TABLE "notas" CONSTRAINT "notas_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
```

Ejemplo:

```
 id |    rut     |  nombre  |     apellido      | fecha_nacimiento | curso_id |    comuna     
----+------------+----------+-------------------+------------------+----------+---------------
  1 | 22355406-7 | Isidora  | Pérez Pizarro     | 2011-09-18       |        1 | Lo Prado
  2 | 21791420-5 | Josefa   | Reyes Bravo       | 2011-12-21       |        1 | Quinta Normal
  3 | 21573953-8 | Trinidad | Gutiérrez Pizarro | 2011-07-01       |        1 | Santiago
(3 rows)
```

### notas (5985 filas)

```
                                Table "public.notas"
    Column     |     Type     | Collation | Nullable |           Default            
---------------+--------------+-----------+----------+------------------------------
 id            | integer      |           | not null | generated always as identity
 alumno_id     | integer      |           | not null | 
 asignatura_id | integer      |           | not null | 
 semestre      | smallint     |           | not null | 
 evaluacion    | smallint     |           | not null | 
 nota          | numeric(2,1) |           | not null | 
 fecha         | date         |           | not null | 
Indexes:
    "notas_pkey" PRIMARY KEY, btree (id)
    "notas_alumno_id_asignatura_id_semestre_evaluacion_key" UNIQUE CONSTRAINT, btree (alumno_id, asignatura_id, semestre, evaluacion)
Check constraints:
    "notas_evaluacion_check" CHECK (evaluacion >= 1 AND evaluacion <= 3)
    "notas_nota_check" CHECK (nota >= 1.0 AND nota <= 7.0)
    "notas_semestre_check" CHECK (semestre = ANY (ARRAY[1, 2]))
Foreign-key constraints:
    "notas_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
    "notas_asignatura_id_fkey" FOREIGN KEY (asignatura_id) REFERENCES asignaturas(id)
```

Ejemplo:

```
 id | alumno_id | asignatura_id | semestre | evaluacion | nota |   fecha    
----+-----------+---------------+----------+------------+------+------------
  1 |         1 |             1 |        1 |          1 |  5.2 | 2026-04-10
  2 |         1 |             1 |        1 |          2 |  6.0 | 2026-05-15
  3 |         1 |             1 |        1 |          3 |  5.7 | 2026-06-19
(3 rows)
```

## biblioteca

Biblioteca comunitaria: autores latinoamericanos, libros reales (con resumen para búsqueda de texto), relación libro_autor (N a M, hay antologías con varios autores), socios y préstamos (algunos atrasados y algunos nunca devueltos: fecha_devolucion NULL). Hay libros que nunca se han prestado.

### autores (22 filas)

```
                 Table "public.autores"
   Column   |   Type   | Collation | Nullable | Default 
------------+----------+-----------+----------+---------
 id         | integer  |           | not null | 
 nombre     | text     |           | not null | 
 pais       | text     |           | not null | 
 nacimiento | smallint |           |          | 
Indexes:
    "autores_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "libro_autor" CONSTRAINT "libro_autor_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES autores(id)
```

Ejemplo:

```
 id |      nombre      | pais  | nacimiento 
----+------------------+-------+------------
  1 | Gabriela Mistral | Chile |       1889
  2 | Pablo Neruda     | Chile |       1904
  3 | Isabel Allende   | Chile |       1942
(3 rows)
```

### libros (42 filas)

```
                 Table "public.libros"
   Column   |   Type   | Collation | Nullable | Default 
------------+----------+-----------+----------+---------
 id         | integer  |           | not null | 
 isbn       | text     |           | not null | 
 titulo     | text     |           | not null | 
 anio       | smallint |           | not null | 
 genero     | text     |           | not null | 
 paginas    | integer  |           |          | 
 ejemplares | smallint |           | not null | 1
 resumen    | text     |           |          | 
Indexes:
    "libros_pkey" PRIMARY KEY, btree (id)
    "libros_isbn_key" UNIQUE CONSTRAINT, btree (isbn)
Check constraints:
    "libros_ejemplares_check" CHECK (ejemplares >= 0)
Referenced by:
    TABLE "libro_autor" CONSTRAINT "libro_autor_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id)
    TABLE "prestamos" CONSTRAINT "prestamos_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id)
```

Ejemplo:

```
 id |     isbn      |                     titulo                      | anio | genero | paginas | ejemplares |                                       resumen                                        
----+---------------+-------------------------------------------------+------+--------+---------+------------+--------------------------------------------------------------------------------------
  1 | 9789560001009 | Desolación                                      | 1922 | Poesía |     248 |          1 | Primer libro de poemas de Mistral: el dolor, la maternidad y la naturaleza de Chile.
  2 | 9789560001375 | Tala                                            | 1938 | Poesía |     272 |          1 | Poemas sobre América, la muerte de la madre y la tierra.
  3 | 9789560001740 | Veinte poemas de amor y una canción desesperada | 1924 | Poesía |      96 |          1 | Poemario amoroso juvenil, uno de los más leídos en español.
(3 rows)
```

### libro_autor (48 filas)

```
             Table "public.libro_autor"
  Column  |  Type   | Collation | Nullable | Default 
----------+---------+-----------+----------+---------
 libro_id | integer |           | not null | 
 autor_id | integer |           | not null | 
Indexes:
    "libro_autor_pkey" PRIMARY KEY, btree (libro_id, autor_id)
Foreign-key constraints:
    "libro_autor_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES autores(id)
    "libro_autor_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id)
```

Ejemplo:

```
 libro_id | autor_id 
----------+----------
        1 |        1
        2 |        1
        3 |        2
(3 rows)
```

### socios (50 filas)

```
                 Table "public.socios"
   Column   |  Type   | Collation | Nullable | Default 
------------+---------+-----------+----------+---------
 id         | integer |           | not null | 
 rut        | text    |           | not null | 
 nombre     | text    |           | not null | 
 email      | text    |           |          | 
 comuna     | text    |           | not null | 
 fecha_alta | date    |           | not null | 
Indexes:
    "socios_pkey" PRIMARY KEY, btree (id)
    "socios_rut_key" UNIQUE CONSTRAINT, btree (rut)
Referenced by:
    TABLE "prestamos" CONSTRAINT "prestamos_socio_id_fkey" FOREIGN KEY (socio_id) REFERENCES socios(id)
```

Ejemplo:

```
 id |    rut     |           nombre           |           email           |  comuna  | fecha_alta 
----+------------+----------------------------+---------------------------+----------+------------
  1 | 17718802-6 | José Bravo Gutiérrez       | jose.bravo1@correo.cl     | Ñuñoa    | 2023-12-21
  2 | 21121466-K | Nicolás Sepúlveda Espinoza |                           | Ñuñoa    | 2025-05-06
  3 | 13839547-2 | Tomás Espinoza López       | tomas.espinoza3@gmail.com | Santiago | 2023-11-09
(3 rows)
```

### prestamos (320 filas)

```
                             Table "public.prestamos"
      Column      |  Type   | Collation | Nullable |           Default            
------------------+---------+-----------+----------+------------------------------
 id               | integer |           | not null | generated always as identity
 libro_id         | integer |           | not null | 
 socio_id         | integer |           | not null | 
 fecha_prestamo   | date    |           | not null | 
 fecha_limite     | date    |           | not null | 
 fecha_devolucion | date    |           |          | 
Indexes:
    "prestamos_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "prestamos_check" CHECK (fecha_limite > fecha_prestamo)
    "prestamos_check1" CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)
Foreign-key constraints:
    "prestamos_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES libros(id)
    "prestamos_socio_id_fkey" FOREIGN KEY (socio_id) REFERENCES socios(id)
```

Ejemplo:

```
 id | libro_id | socio_id | fecha_prestamo | fecha_limite | fecha_devolucion 
----+----------+----------+----------------+--------------+------------------
  1 |       39 |       50 | 2025-01-03     | 2025-01-17   | 2025-01-16
  2 |       25 |        3 | 2025-01-04     | 2025-01-18   | 2025-01-18
  3 |       40 |       49 | 2025-01-04     | 2025-01-18   | 2025-01-12
(3 rows)
```

## metro

Metro de Santiago: líneas, estaciones reales (con combinaciones: una estación puede estar en varias líneas vía linea_estacion), 6.000 tarjetas y 120.000 validaciones del primer semestre de 2026 (tabla grande para índices, EXPLAIN y particiones).

### lineas (5 filas)

```
             Table "public.lineas"
 Column | Type | Collation | Nullable | Default 
--------+------+-----------+----------+---------
 id     | text |           | not null | 
 nombre | text |           | not null | 
 color  | text |           | not null | 
Indexes:
    "lineas_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "linea_estacion" CONSTRAINT "linea_estacion_linea_id_fkey" FOREIGN KEY (linea_id) REFERENCES lineas(id)
```

Ejemplo:

```
 id | nombre  |  color   
----+---------+----------
 L1 | Línea 1 | rojo
 L2 | Línea 2 | amarillo
 L4 | Línea 4 | azul
(3 rows)
```

### estaciones (103 filas)

```
             Table "public.estaciones"
 Column |  Type   | Collation | Nullable | Default 
--------+---------+-----------+----------+---------
 id     | integer |           | not null | 
 nombre | text    |           | not null | 
 comuna | text    |           | not null | 
Indexes:
    "estaciones_pkey" PRIMARY KEY, btree (id)
    "estaciones_nombre_key" UNIQUE CONSTRAINT, btree (nombre)
Referenced by:
    TABLE "linea_estacion" CONSTRAINT "linea_estacion_estacion_id_fkey" FOREIGN KEY (estacion_id) REFERENCES estaciones(id)
    TABLE "validaciones" CONSTRAINT "validaciones_estacion_id_fkey" FOREIGN KEY (estacion_id) REFERENCES estaciones(id)
```

Ejemplo:

```
 id |  nombre   |  comuna  
----+-----------+----------
  1 | San Pablo | Lo Prado
  2 | Neptuno   | Lo Prado
  3 | Pajaritos | Lo Prado
(3 rows)
```

### linea_estacion (112 filas)

```
              Table "public.linea_estacion"
   Column    |   Type   | Collation | Nullable | Default 
-------------+----------+-----------+----------+---------
 linea_id    | text     |           | not null | 
 estacion_id | integer  |           | not null | 
 orden       | smallint |           | not null | 
Indexes:
    "linea_estacion_pkey" PRIMARY KEY, btree (linea_id, estacion_id)
    "linea_estacion_linea_id_orden_key" UNIQUE CONSTRAINT, btree (linea_id, orden)
Foreign-key constraints:
    "linea_estacion_estacion_id_fkey" FOREIGN KEY (estacion_id) REFERENCES estaciones(id)
    "linea_estacion_linea_id_fkey" FOREIGN KEY (linea_id) REFERENCES lineas(id)
```

Ejemplo:

```
 linea_id | estacion_id | orden 
----------+-------------+-------
 L1       |           1 |     1
 L1       |           2 |     2
 L1       |           3 |     3
(3 rows)
```

### tarjetas (6000 filas)

```
              Table "public.tarjetas"
 Column  |  Type  | Collation | Nullable | Default 
---------+--------+-----------+----------+---------
 id      | bigint |           | not null | 
 tipo    | text   |           | not null | 
 emitida | date   |           | not null | 
Indexes:
    "tarjetas_pkey" PRIMARY KEY, btree (id)
Check constraints:
    "tarjetas_tipo_check" CHECK (tipo = ANY (ARRAY['adulto'::text, 'estudiante'::text, 'adulto mayor'::text]))
Referenced by:
    TABLE "validaciones" CONSTRAINT "validaciones_tarjeta_id_fkey" FOREIGN KEY (tarjeta_id) REFERENCES tarjetas(id)
```

Ejemplo:

```
   id    |  tipo  |  emitida   
---------+--------+------------
 1000001 | adulto | 2018-02-07
 1000002 | adulto | 2018-03-16
 1000003 | adulto | 2018-04-22
(3 rows)
```

### validaciones (120000 filas)

```
                                 Table "public.validaciones"
   Column    |           Type           | Collation | Nullable |           Default            
-------------+--------------------------+-----------+----------+------------------------------
 id          | bigint                   |           | not null | generated always as identity
 tarjeta_id  | bigint                   |           | not null | 
 estacion_id | integer                  |           | not null | 
 ts          | timestamp with time zone |           | not null | 
 tarifa      | integer                  |           | not null | 
Indexes:
    "validaciones_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "validaciones_estacion_id_fkey" FOREIGN KEY (estacion_id) REFERENCES estaciones(id)
    "validaciones_tarjeta_id_fkey" FOREIGN KEY (tarjeta_id) REFERENCES tarjetas(id)
```

Ejemplo:

```
 id | tarjeta_id | estacion_id |           ts           | tarifa 
----+------------+-------------+------------------------+--------
  1 |    1001920 |          82 | 2026-06-21 08:31:17-04 |    870
  2 |    1003839 |          60 | 2026-06-11 09:02:34-04 |    390
  3 |    1005758 |          38 | 2026-06-01 07:33:51-04 |    260
(3 rows)
```

