-- Recursos humanos de «Andes Digital SpA» (datos ficticios y deterministas). Sueldos brutos mensuales en CLP.

CREATE TABLE departamentos (
  id      integer PRIMARY KEY,
  nombre  text NOT NULL UNIQUE,
  ciudad  text NOT NULL
);

CREATE TABLE empleados (
  id               integer PRIMARY KEY,
  rut              text NOT NULL UNIQUE,
  nombre           text NOT NULL,
  apellido         text NOT NULL,
  email            text NOT NULL UNIQUE,
  departamento_id  integer REFERENCES departamentos (id),
  cargo            text NOT NULL,
  jefe_id          integer REFERENCES empleados (id),
  fecha_ingreso    date NOT NULL,
  fecha_salida     date,
  sueldo           integer NOT NULL CHECK (sueldo > 0)
);

CREATE TABLE historial_sueldos (
  empleado_id  integer NOT NULL REFERENCES empleados (id),
  desde        date NOT NULL,
  sueldo       integer NOT NULL,
  PRIMARY KEY (empleado_id, desde)
);

CREATE TABLE proyectos (
  id           integer PRIMARY KEY,
  nombre       text NOT NULL,
  inicio       date NOT NULL,
  fin          date,
  presupuesto  bigint NOT NULL
);

CREATE TABLE asignaciones (
  empleado_id   integer NOT NULL REFERENCES empleados (id),
  proyecto_id   integer NOT NULL REFERENCES proyectos (id),
  rol           text NOT NULL,
  horas_semana  integer NOT NULL CHECK (horas_semana BETWEEN 1 AND 45),
  PRIMARY KEY (empleado_id, proyecto_id)
);

INSERT INTO departamentos (id, nombre, ciudad) VALUES
  (1, 'Gerencia', 'Santiago'),
  (2, 'Finanzas', 'Santiago'),
  (3, 'Tecnología', 'Santiago'),
  (4, 'Ventas', 'Concepción'),
  (5, 'Operaciones', 'Valparaíso'),
  (6, 'Personas', 'Santiago');

INSERT INTO empleados (id, rut, nombre, apellido, email, departamento_id, cargo, jefe_id, fecha_ingreso, fecha_salida, sueldo) VALUES
  (1, '20716666-9', 'Benjamín', 'Pérez Díaz', 'benjamin.perez@andesdigital.cl', 1, 'Gerente general', NULL, '2012-08-21', NULL, 8900000),
  (2, '19870864-K', 'Rodrigo', 'Tapia Vergara', 'rodrigo.tapia@andesdigital.cl', 2, 'Gerente de Finanzas', 1, '2015-11-26', NULL, 5600000),
  (3, '11126285-3', 'Agustina', 'Núñez Cortés', 'agustina.nunez@andesdigital.cl', 3, 'Gerente de Tecnología', 1, '2015-06-25', NULL, 6200000),
  (4, '12827244-5', 'Florencia', 'Martínez Espinoza', 'florencia.martinez@andesdigital.cl', 4, 'Gerente de Ventas', 1, '2014-01-24', NULL, 5400000),
  (5, '9456578-2', 'Felipe', 'Cortés Espinoza', 'felipe.cortes@andesdigital.cl', 5, 'Gerente de Operaciones', 1, '2015-02-09', NULL, 5100000),
  (6, '12665399-9', 'Agustín', 'Torres Fuentes', 'agustin.torres@andesdigital.cl', 6, 'Gerente de Personas', 1, '2015-04-23', NULL, 4800000),
  (7, '16031633-0', 'Martín', 'Vásquez Araya', 'martin.vasquez@andesdigital.cl', 2, 'Jefe de Contabilidad', 2, '2020-05-02', NULL, 3200000),
  (8, '11723771-0', 'Rodrigo', 'Espinoza Muñoz', 'rodrigo.espinoza@andesdigital.cl', 2, 'Jefe de Tesorería', 2, '2016-12-05', NULL, 3100000),
  (9, '9994124-3', 'Cristóbal', 'Bravo Jara', 'cristobal.bravo@andesdigital.cl', 3, 'Jefe de Desarrollo', 3, '2017-04-30', NULL, 4200000),
  (10, '20747916-0', 'Maximiliano', 'González Núñez', 'maximiliano.gonzalez@andesdigital.cl', 3, 'Jefe de Datos', 3, '2017-10-28', NULL, 4100000),
  (11, '14738432-7', 'Rodrigo', 'Martínez Espinoza', 'rodrigo.martinez@andesdigital.cl', 3, 'Jefe de Infraestructura', 3, '2020-11-19', NULL, 3900000),
  (12, '16955593-1', 'Emilia', 'Sepúlveda Cáceres', 'emilia.sepulveda@andesdigital.cl', 4, 'Jefe de Ventas Zona Sur', 4, '2017-02-02', NULL, 3000000),
  (13, '10135546-2', 'Maximiliano', 'Vergara Flores', 'maximiliano.vergara@andesdigital.cl', 4, 'Jefe de Ventas Zona Centro', 4, '2017-07-29', NULL, 3100000),
  (14, '15417732-9', 'Emilia', 'Jara Contreras', 'emilia.jara@andesdigital.cl', 5, 'Jefe de Logística', 5, '2018-10-08', NULL, 2900000),
  (15, '15605300-7', 'Rodrigo', 'Gutiérrez Reyes', 'rodrigo.gutierrez@andesdigital.cl', 5, 'Jefe de Bodega', 5, '2017-05-10', NULL, 2300000),
  (16, '20026796-6', 'Florencia', 'Sánchez Gutiérrez', 'florencia.sanchez@andesdigital.cl', 6, 'Jefe de Reclutamiento', 6, '2019-12-07', NULL, 2700000),
  (17, '12492654-8', 'Paula', 'Castillo González', 'paula.castillo@andesdigital.cl', 2, 'Contador', 7, '2025-02-23', NULL, 1690000),
  (18, '8345384-2', 'Emilia', 'Fernández Reyes', 'emilia.fernandez@andesdigital.cl', 2, 'Contador', 7, '2025-03-25', NULL, 1940000),
  (19, '16118116-1', 'Rodrigo', 'Contreras Martínez', 'rodrigo.contreras@andesdigital.cl', 2, 'Contador', 7, '2025-02-01', NULL, 1840000),
  (20, '16644769-0', 'Martina', 'Fuentes Riquelme', 'martina.fuentes@andesdigital.cl', 2, 'Analista de tesorería', 8, '2025-12-15', NULL, 1590000),
  (21, '11932897-7', 'Isidora', 'Fuentes Morales', 'isidora.fuentes@andesdigital.cl', 2, 'Analista de tesorería', 8, '2025-02-21', NULL, 1720000),
  (22, '13143750-1', 'Constanza', 'Reyes Álvarez', 'constanza.reyes@andesdigital.cl', 3, 'Desarrollador', 9, '2020-12-21', '2025-11-30', 3140000),
  (23, '17140789-3', 'Cristóbal', 'Soto Flores', 'cristobal.soto@andesdigital.cl', 3, 'Desarrollador', 9, '2019-08-23', NULL, 2730000),
  (24, '8257039-K', 'Lucas', 'Olivares Rojas', 'lucas.olivares@andesdigital.cl', 3, 'Desarrollador', 9, '2019-01-30', NULL, 3340000),
  (25, '14736313-3', 'Lucas', 'López Vásquez', 'lucas.lopez@andesdigital.cl', 3, 'Desarrollador', 9, '2025-02-05', NULL, 1980000),
  (26, '9286628-9', 'Juan Pablo', 'Álvarez González', 'juan.alvarez@andesdigital.cl', 3, 'Desarrollador', 9, '2019-09-12', NULL, 3040000),
  (27, '18990213-1', 'Diego', 'Castillo Soto', 'diego.castillo@andesdigital.cl', 3, 'Desarrollador', 9, '2021-01-19', NULL, 2020000),
  (28, '9549288-6', 'Agustina', 'Vásquez Carrasco', 'agustina.vasquez@andesdigital.cl', 3, 'Desarrollador', 9, '2018-09-26', NULL, 1710000),
  (29, '15037495-2', 'Florencia', 'Araya Olivares', 'florencia.araya@andesdigital.cl', 3, 'Analista de datos', 10, '2020-08-29', NULL, 2600000),
  (30, '11647644-4', 'Tomás', 'Valenzuela Castro', 'tomas.valenzuela@andesdigital.cl', 3, 'Analista de datos', 10, '2023-12-13', NULL, 2450000),
  (31, '16400701-4', 'Felipe', 'Díaz Bravo', 'felipe.diaz@andesdigital.cl', 3, 'Analista de datos', 10, '2017-02-05', NULL, 2260000),
  (32, '12694929-4', 'Nicolás', 'Silva Sánchez', 'nicolas.silva@andesdigital.cl', 3, 'Analista de datos', 10, '2024-01-23', NULL, 2540000),
  (33, '13138519-6', 'Carolina', 'Riquelme Silva', 'carolina.riquelme@andesdigital.cl', 3, 'Ingeniero de datos', 10, '2023-11-12', NULL, 3090000),
  (34, '10030896-7', 'Martín', 'Reyes Bravo', 'martin.reyes@andesdigital.cl', 3, 'Ingeniero de datos', 10, '2024-12-23', NULL, 3150000),
  (35, '21863533-4', 'Trinidad', 'Martínez Pérez', 'trinidad.martinez@andesdigital.cl', 3, 'Administrador de sistemas', 11, '2019-11-29', NULL, 1850000),
  (36, '21476684-1', 'Camila', 'Torres Gutiérrez', 'camila.torres@andesdigital.cl', 3, 'Administrador de sistemas', 11, '2020-06-25', NULL, 2520000),
  (37, '14308229-6', 'Diego', 'Díaz Muñoz', 'diego.diaz@andesdigital.cl', 3, 'Administrador de sistemas', 11, '2022-06-09', '2026-03-31', 2030000),
  (38, '13257917-2', 'Rodrigo', 'Castro Tapia', 'rodrigo.castro@andesdigital.cl', 4, 'Ejecutivo de ventas', 12, '2020-12-10', NULL, 1400000),
  (39, '10569995-6', 'Valentina', 'Fuentes Cortés', 'valentina.fuentes@andesdigital.cl', 4, 'Ejecutivo de ventas', 12, '2024-09-04', NULL, 1410000),
  (40, '16650612-3', 'Javiera', 'Espinoza Olivares', 'javiera.espinoza@andesdigital.cl', 4, 'Ejecutivo de ventas', 12, '2019-04-01', NULL, 1460000),
  (41, '10017920-2', 'Francisco', 'Cortés Hernández', 'francisco.cortes@andesdigital.cl', 4, 'Ejecutivo de ventas', 12, '2023-04-04', NULL, 1290000),
  (42, '8979278-9', 'Josefa', 'Valenzuela Fernández', 'josefa.valenzuela@andesdigital.cl', 4, 'Ejecutivo de ventas', 13, '2024-12-27', NULL, 1080000),
  (43, '21135050-4', 'Trinidad', 'Vásquez Castillo', 'trinidad.vasquez@andesdigital.cl', 4, 'Ejecutivo de ventas', 13, '2022-10-02', NULL, 1200000),
  (44, '15728713-3', 'Emilia', 'Martínez Bravo', 'emilia.martinez@andesdigital.cl', 4, 'Ejecutivo de ventas', 13, '2023-03-17', NULL, 1160000),
  (45, '21194891-4', 'Antonia', 'Fuentes Araya', 'antonia.fuentes@andesdigital.cl', 4, 'Ejecutivo de ventas', 13, '2020-07-10', NULL, 1120000),
  (46, '12701513-9', 'Lucas', 'Sepúlveda Figueroa', 'lucas.sepulveda@andesdigital.cl', 5, 'Coordinador logístico', 14, '2023-04-23', NULL, 1590000),
  (47, '11992281-K', 'Lucas', 'González Figueroa', 'lucas.gonzalez@andesdigital.cl', 5, 'Coordinador logístico', 14, '2025-05-20', NULL, 1110000),
  (48, '20302301-4', 'Emilia', 'Riquelme Carrasco', 'emilia.riquelme@andesdigital.cl', 5, 'Operario de bodega', 15, '2022-12-12', NULL, 690000),
  (49, '10646002-7', 'Isidora', 'Núñez Castro', 'isidora.nunez@andesdigital.cl', 5, 'Operario de bodega', 15, '2020-02-20', NULL, 770000),
  (50, '21059133-8', 'Diego', 'Olivares Vergara', 'diego.olivares@andesdigital.cl', 5, 'Operario de bodega', 15, '2025-02-02', NULL, 850000),
  (51, '14477745-K', 'Emilia', 'Álvarez Torres', 'emilia.alvarez@andesdigital.cl', 5, 'Operario de bodega', 15, '2022-12-16', NULL, 840000),
  (52, '19520340-7', 'Valentina', 'Fernández Silva', 'valentina.fernandez@andesdigital.cl', 5, 'Operario de bodega', 15, '2019-01-06', NULL, 710000),
  (53, '17188620-1', 'Tomás', 'Carrasco Riquelme', 'tomas.carrasco@andesdigital.cl', 6, 'Analista de personas', 16, '2017-11-09', NULL, 1470000),
  (54, '15557675-8', 'Tomás', 'Araya Pérez', 'tomas.araya@andesdigital.cl', 6, 'Analista de personas', 16, '2018-09-06', NULL, 1540000),
  (55, '13936127-K', 'Rodrigo', 'Sepúlveda Cáceres', 'rodrigo.sepulveda@andesdigital.cl', NULL, 'Practicante', 9, '2026-06-15', NULL, 500000);

COPY historial_sueldos (empleado_id, desde, sueldo) FROM stdin;
1	2012-08-21	6650000
1	2013-11-30	7180000
1	2014-11-23	7570000
1	2016-02-08	8110000
1	2016-08-28	8700000
1	2018-10-14	8900000
2	2015-11-26	4180000
2	2017-03-29	4540000
2	2018-03-03	4880000
2	2019-05-15	5200000
2	2021-01-06	5650000
2	2022-03-24	5600000
3	2015-06-25	4630000
3	2016-07-17	4840000
3	2017-08-11	5250000
3	2018-11-18	5690000
3	2021-02-21	6050000
3	2022-07-23	6200000
4	2014-01-24	4040000
4	2015-01-21	4340000
4	2016-10-08	4720000
4	2018-02-17	4910000
4	2018-04-25	5230000
4	2020-07-06	5400000
5	2015-02-09	3810000
5	2016-07-24	4130000
5	2017-05-29	4310000
5	2018-03-19	4560000
5	2020-05-09	4750000
5	2020-05-08	5100000
6	2015-04-23	3590000
6	2016-09-17	3910000
6	2018-02-10	4250000
6	2019-07-07	4450000
6	2020-11-26	4760000
6	2020-07-25	4800000
7	2020-05-02	2530000
7	2021-07-16	2640000
7	2022-08-02	2870000
7	2023-06-04	3050000
7	2024-07-28	3200000
8	2016-12-05	2320000
8	2018-05-20	2510000
8	2019-09-05	2700000
8	2020-08-01	2870000
8	2021-09-10	3000000
8	2022-11-14	3100000
9	2017-04-30	3140000
9	2018-09-27	3410000
9	2019-06-05	3660000
9	2020-09-11	3890000
9	2022-06-15	4210000
9	2023-10-06	4200000
10	2017-10-28	3060000
10	2018-12-09	3220000
10	2020-08-07	3470000
10	2021-02-18	3730000
10	2023-08-22	3900000
10	2023-11-21	4100000
11	2020-11-19	3270000
11	2022-01-22	3490000
11	2023-03-27	3720000
11	2024-04-02	3900000
12	2017-02-02	2240000
12	2018-07-24	2360000
12	2019-07-24	2570000
12	2020-09-20	2740000
12	2021-06-09	2900000
12	2023-05-07	3000000
13	2017-07-29	2320000
13	2019-01-11	2460000
13	2020-04-26	2600000
13	2021-01-12	2800000
13	2022-06-21	2910000
13	2024-07-07	3100000
14	2018-10-08	2170000
14	2020-02-03	2270000
14	2020-09-29	2450000
14	2022-08-27	2610000
14	2023-08-19	2740000
14	2023-12-06	2900000
15	2017-05-10	1720000
15	2018-05-28	1870000
15	2019-11-26	2020000
15	2021-01-22	2160000
15	2021-06-10	2280000
15	2024-08-01	2300000
16	2019-12-07	2140000
16	2021-05-29	2270000
16	2022-06-14	2390000
16	2023-03-24	2520000
16	2024-12-28	2700000
17	2025-02-23	1690000
18	2025-03-25	1940000
19	2025-02-01	1840000
20	2025-12-15	1590000
21	2025-02-21	1720000
22	2020-12-21	2640000
22	2022-01-03	2860000
22	2023-03-01	3120000
22	2024-10-10	3140000
23	2019-08-23	2160000
23	2020-09-20	2310000
23	2021-12-16	2430000
23	2023-05-04	2550000
23	2024-03-01	2730000
24	2019-01-30	2500000
24	2020-05-22	2710000
24	2021-12-09	2910000
24	2022-04-26	3040000
24	2024-09-28	3170000
24	2025-10-20	3340000
25	2025-02-05	1980000
26	2019-09-12	2410000
26	2021-02-17	2620000
26	2021-12-26	2740000
26	2023-03-31	2860000
26	2025-02-08	3040000
27	2021-01-19	1700000
27	2022-03-01	1790000
27	2023-07-28	1870000
27	2024-03-31	2020000
28	2018-09-26	1280000
28	2019-10-04	1390000
28	2020-09-23	1470000
28	2022-05-02	1570000
28	2024-06-02	1650000
28	2025-06-21	1710000
29	2020-08-29	2180000
29	2021-10-16	2360000
29	2022-09-06	2470000
29	2024-10-22	2600000
30	2023-12-13	2310000
30	2025-02-17	2450000
31	2017-02-05	1690000
31	2018-04-30	1790000
31	2019-05-26	1950000
31	2021-02-17	2090000
31	2022-01-22	2240000
31	2024-06-23	2260000
32	2024-01-23	2400000
32	2025-02-24	2540000
33	2023-11-12	2920000
33	2024-11-08	3090000
34	2024-12-23	2970000
34	2026-03-01	3150000
35	2019-11-29	1470000
35	2020-12-30	1580000
35	2022-05-03	1650000
35	2023-03-16	1740000
35	2025-02-02	1850000
36	2020-06-25	2000000
36	2021-09-26	2170000
36	2023-03-14	2260000
36	2024-11-28	2360000
36	2024-06-04	2520000
37	2022-06-09	1810000
37	2023-11-02	1900000
37	2024-07-14	2030000
38	2020-12-10	1180000
38	2022-05-08	1240000
38	2023-08-11	1320000
38	2024-11-04	1400000
39	2024-09-04	1330000
39	2026-01-03	1410000
40	2019-04-01	1160000
40	2020-05-28	1220000
40	2021-08-12	1310000
40	2022-05-09	1400000
40	2024-08-20	1460000
41	2023-04-04	1150000
41	2024-05-03	1240000
41	2025-07-22	1290000
42	2024-12-27	1020000
42	2026-06-14	1080000
43	2022-10-02	1070000
43	2024-01-26	1150000
43	2025-08-11	1200000
44	2023-03-17	1030000
44	2024-05-05	1100000
44	2025-07-06	1160000
45	2020-07-10	890000
45	2021-08-28	950000
45	2022-09-12	1010000
45	2023-06-28	1050000
45	2025-05-17	1120000
46	2023-04-23	1420000
46	2024-05-23	1510000
46	2025-08-22	1590000
47	2025-05-20	1110000
48	2022-12-12	610000
48	2023-12-20	650000
48	2025-07-15	690000
49	2020-02-20	610000
49	2021-06-12	660000
49	2022-05-18	700000
49	2023-09-29	730000
49	2024-02-15	770000
50	2025-02-02	850000
51	2022-12-16	750000
51	2023-12-11	780000
51	2025-08-30	840000
52	2019-01-06	530000
52	2020-03-13	570000
52	2021-09-30	600000
52	2022-07-13	640000
52	2024-04-05	680000
52	2026-03-30	710000
53	2017-11-09	1100000
53	2019-01-16	1160000
53	2020-07-18	1210000
53	2021-08-23	1290000
53	2023-05-30	1390000
53	2023-02-11	1470000
54	2018-09-06	1150000
54	2019-12-28	1250000
54	2021-06-20	1340000
54	2021-10-05	1450000
54	2023-06-20	1520000
54	2024-06-06	1540000
55	2026-06-15	500000
\.

INSERT INTO proyectos (id, nombre, inicio, fin, presupuesto) VALUES
  (1, 'Portal de clientes', '2024-03-01', '2025-02-28', 180000000),
  (2, 'Migración a la nube', '2024-09-02', '2025-12-19', 320000000),
  (3, 'App de despacho', '2025-04-01', NULL, 145000000),
  (4, 'Data warehouse', '2025-06-02', NULL, 260000000),
  (5, 'Rediseño de bodegas', '2025-01-06', '2025-08-29', 95000000),
  (6, 'Plan de capacitación', '2026-01-05', NULL, 40000000);

INSERT INTO asignaciones (empleado_id, proyecto_id, rol, horas_semana) VALUES
  (2, 2, 'Administrador', 8),
  (2, 4, 'Ingeniero de datos', 20),
  (3, 2, 'Arquitecto', 4),
  (3, 4, 'Patrocinador', 2),
  (4, 1, 'Diseñador', 22),
  (5, 3, 'Desarrollador', 22),
  (5, 5, 'Operario', 16),
  (7, 2, 'Administrador', 8),
  (8, 4, 'Ingeniero de datos', 8),
  (10, 1, 'Desarrollador', 20),
  (10, 2, 'Administrador', 10),
  (10, 3, 'Desarrollador', 20),
  (11, 1, 'Desarrollador', 4),
  (11, 3, 'Líder técnico', 20),
  (11, 4, 'Analista de datos', 22),
  (12, 1, 'Desarrollador', 16),
  (13, 1, 'Diseñador', 20),
  (14, 5, 'Coordinador', 8),
  (15, 3, 'Desarrollador', 4),
  (15, 5, 'Operario', 12),
  (17, 4, 'Analista de datos', 10),
  (18, 2, 'Arquitecto', 16),
  (18, 4, 'Analista de datos', 12),
  (19, 2, 'Administrador', 12),
  (19, 4, 'Analista de datos', 16),
  (20, 2, 'Administrador', 4),
  (23, 1, 'Desarrollador', 10),
  (23, 2, 'Administrador', 20),
  (23, 3, 'Desarrollador', 16),
  (23, 4, 'Ingeniero de datos', 20),
  (25, 2, 'Administrador', 8),
  (25, 3, 'Desarrollador', 20),
  (25, 4, 'Analista de datos', 4),
  (26, 2, 'Arquitecto', 12),
  (26, 3, 'Desarrollador', 22),
  (27, 2, 'Administrador', 10),
  (27, 3, 'Líder técnico', 4),
  (28, 1, 'Desarrollador', 16),
  (28, 2, 'Administrador', 12),
  (28, 3, 'Desarrollador', 16),
  (28, 4, 'Analista de datos', 4),
  (29, 4, 'Ingeniero de datos', 20),
  (30, 3, 'Desarrollador', 16),
  (30, 4, 'Ingeniero de datos', 12),
  (31, 2, 'Arquitecto', 22),
  (31, 3, 'Desarrollador', 20),
  (31, 4, 'Ingeniero de datos', 8),
  (33, 2, 'Administrador', 22),
  (33, 4, 'Ingeniero de datos', 22),
  (34, 2, 'Arquitecto', 16),
  (34, 3, 'Desarrollador', 16),
  (35, 2, 'Arquitecto', 20),
  (36, 1, 'Diseñador', 8),
  (36, 3, 'Líder técnico', 12),
  (38, 1, 'Desarrollador', 16),
  (40, 1, 'Desarrollador', 10),
  (45, 1, 'Desarrollador', 20),
  (46, 3, 'Líder técnico', 12),
  (46, 5, 'Operario', 4),
  (47, 5, 'Coordinador', 12),
  (48, 3, 'Líder técnico', 16),
  (48, 5, 'Operario', 16),
  (49, 3, 'Líder técnico', 10),
  (50, 3, 'Desarrollador', 8),
  (52, 5, 'Operario', 4),
  (53, 6, 'Facilitador', 22),
  (54, 6, 'Facilitador', 20);
