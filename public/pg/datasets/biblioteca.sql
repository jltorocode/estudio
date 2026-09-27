-- Biblioteca comunitaria «Gabriela Mistral»: libros, autores, socios y préstamos (catálogo ficticio con obras reales).

CREATE TABLE autores (
  id          integer PRIMARY KEY,
  nombre      text NOT NULL,
  pais        text NOT NULL,
  nacimiento  smallint
);

CREATE TABLE libros (
  id         integer PRIMARY KEY,
  isbn       text NOT NULL UNIQUE,
  titulo     text NOT NULL,
  anio       smallint NOT NULL,
  genero     text NOT NULL,
  paginas    integer,
  ejemplares smallint NOT NULL DEFAULT 1 CHECK (ejemplares >= 0),
  resumen    text
);

CREATE TABLE libro_autor (
  libro_id  integer NOT NULL REFERENCES libros (id),
  autor_id  integer NOT NULL REFERENCES autores (id),
  PRIMARY KEY (libro_id, autor_id)
);

CREATE TABLE socios (
  id          integer PRIMARY KEY,
  rut         text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  email       text,
  comuna      text NOT NULL,
  fecha_alta  date NOT NULL
);

CREATE TABLE prestamos (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libro_id          integer NOT NULL REFERENCES libros (id),
  socio_id          integer NOT NULL REFERENCES socios (id),
  fecha_prestamo    date NOT NULL,
  fecha_limite      date NOT NULL,
  fecha_devolucion  date,
  CHECK (fecha_limite > fecha_prestamo),
  CHECK (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)
);

INSERT INTO autores (id, nombre, pais, nacimiento) VALUES
  (1, 'Gabriela Mistral', 'Chile', 1889),
  (2, 'Pablo Neruda', 'Chile', 1904),
  (3, 'Isabel Allende', 'Chile', 1942),
  (4, 'Roberto Bolaño', 'Chile', 1953),
  (5, 'José Donoso', 'Chile', 1924),
  (6, 'María Luisa Bombal', 'Chile', 1910),
  (7, 'Alejandro Zambra', 'Chile', 1975),
  (8, 'Nicanor Parra', 'Chile', 1914),
  (9, 'Manuel Rojas', 'Chile', 1896),
  (10, 'Pedro Lemebel', 'Chile', 1952),
  (11, 'Marcela Serrano', 'Chile', 1951),
  (12, 'Hernán Rivera Letelier', 'Chile', 1950),
  (13, 'Nona Fernández', 'Chile', 1971),
  (14, 'Gabriel García Márquez', 'Colombia', 1927),
  (15, 'Julio Cortázar', 'Argentina', 1914),
  (16, 'Jorge Luis Borges', 'Argentina', 1899),
  (17, 'Mario Vargas Llosa', 'Perú', 1936),
  (18, 'Octavio Paz', 'México', 1914),
  (19, 'Laura Esquivel', 'México', 1950),
  (20, 'Juan Rulfo', 'México', 1917),
  (21, 'Vicente Huidobro', 'Chile', 1893),
  (22, 'Violeta Parra', 'Chile', 1917);

INSERT INTO libros (id, isbn, titulo, anio, genero, paginas, ejemplares, resumen) VALUES
  (1, '9789560001009', 'Desolación', 1922, 'Poesía', 248, 1, 'Primer libro de poemas de Mistral: el dolor, la maternidad y la naturaleza de Chile.'),
  (2, '9789560001375', 'Tala', 1938, 'Poesía', 272, 1, 'Poemas sobre América, la muerte de la madre y la tierra.'),
  (3, '9789560001740', 'Veinte poemas de amor y una canción desesperada', 1924, 'Poesía', 96, 1, 'Poemario amoroso juvenil, uno de los más leídos en español.'),
  (4, '9789560002112', 'Canto general', 1950, 'Poesía', 544, 1, 'Épica poética de América Latina, su historia y su naturaleza.'),
  (5, '9789560002488', 'Confieso que he vivido', 1974, 'Memorias', 480, 1, 'Memorias del poeta, desde Temuco hasta el exilio y el Nobel.'),
  (6, '9789560002853', 'La casa de los espíritus', 1982, 'Novela', 488, 1, 'Saga de la familia Trueba a lo largo de varias generaciones en un país sin nombre.'),
  (7, '9789560003225', 'Eva Luna', 1987, 'Novela', 304, 1, 'Una narradora huérfana cuenta su vida y la de un país agitado.'),
  (8, '9789560003591', 'Paula', 1994, 'Memorias', 368, 1, 'Carta de una madre a su hija enferma, entre recuerdos familiares.'),
  (9, '9789560003966', 'Los detectives salvajes', 1998, 'Novela', 624, 1, 'Dos poetas buscan a una escritora perdida en el desierto de Sonora.'),
  (10, '9789560004338', '2666', 2004, 'Novela', 1128, 1, 'Cinco partes alrededor de los crímenes de Santa Teresa, en la frontera mexicana.'),
  (11, '9789560004703', 'Estrella distante', 1996, 'Novela', 160, 1, 'Un poeta aviador y los crímenes de la dictadura.'),
  (12, '9789560005076', 'El obsceno pájaro de la noche', 1970, 'Novela', 544, 2, 'Una casa de ejercicios espirituales, monstruos y máscaras.'),
  (13, '9789560005441', 'Coronación', 1957, 'Novela', 256, 1, 'La decadencia de una familia aristocrática de Santiago.'),
  (14, '9789560005816', 'La amortajada', 1938, 'Novela', 128, 2, 'Una mujer muerta recorre su vida desde el ataúd.'),
  (15, '9789560006189', 'La última niebla', 1934, 'Novela', NULL, 2, 'Una mujer atrapada en un matrimonio sin amor imagina un amante en la niebla.'),
  (16, '9789560006554', 'Bonsái', 2006, 'Novela', 96, 1, 'Breve historia de amor entre dos estudiantes que mienten sobre haber leído a Proust.'),
  (17, '9789560006929', 'Formas de volver a casa', 2011, 'Novela', 168, 1, 'Un escritor recuerda su infancia en Maipú durante la dictadura.'),
  (18, '9789560007292', 'Poemas y antipoemas', 1954, 'Poesía', 176, 1, 'Libro fundacional de la antipoesía.'),
  (19, '9789560007667', 'Hijo de ladrón', 1951, 'Novela', 352, 3, 'Aniceto Hevia recorre Chile y Argentina en busca de su lugar.'),
  (20, '9789560008039', 'Tengo miedo torero', 2001, 'Novela', 208, 1, 'La Loca del Frente se enamora de un joven que prepara un atentado en 1986.'),
  (21, '9789560008404', 'Loco afán', 1996, 'Crónica', 224, 3, 'Crónicas sobre la disidencia sexual y el sida en el Chile de los noventa.'),
  (22, '9789560008770', 'Nosotras que nos queremos tanto', 1991, 'Novela', 320, 3, 'Cuatro amigas conversan un verano sobre sus vidas.'),
  (23, '9789560009142', 'La reina Isabel cantaba rancheras', 1994, 'Novela', 208, 2, 'La vida en una oficina salitrera del norte de Chile.'),
  (24, '9789560009517', 'Space Invaders', 2013, 'Novela', 80, 2, 'Recuerdos de un grupo de compañeros de colegio en los años ochenta.'),
  (25, '9789560009883', 'La dimensión desconocida', 2016, 'Novela', 232, 1, 'Una escritora reconstruye la historia de un agente de la dictadura.'),
  (26, '9789560010254', 'Cien años de soledad', 1967, 'Novela', 496, 1, 'La historia de los Buendía y del pueblo de Macondo.'),
  (27, '9789560010629', 'El amor en los tiempos del cólera', 1985, 'Novela', 464, 2, 'Florentino Ariza espera más de cincuenta años a Fermina Daza.'),
  (28, '9789560010995', 'Crónica de una muerte anunciada', 1981, 'Novela', 128, 2, 'Todo el pueblo sabía que iban a matar a Santiago Nasar.'),
  (29, '9789560011367', 'Rayuela', 1963, 'Novela', 736, 2, 'Horacio Oliveira entre París y Buenos Aires; se puede leer en distinto orden.'),
  (30, '9789560011732', 'Bestiario', 1951, 'Cuento', 176, 2, 'Cuentos donde lo fantástico irrumpe en lo cotidiano.'),
  (31, '9789560012104', 'Ficciones', 1944, 'Cuento', 224, 1, 'Laberintos, bibliotecas infinitas y espejos.'),
  (32, '9789560012470', 'El Aleph', 1949, 'Cuento', 208, 2, 'Cuentos sobre la eternidad, la identidad y el infinito.'),
  (33, '9789560012845', 'La ciudad y los perros', 1963, 'Novela', 448, 1, 'Cadetes de un colegio militar de Lima y un crimen encubierto.'),
  (34, '9789560013217', 'La fiesta del Chivo', 2000, 'Novela', 528, 1, 'Los últimos días de la dictadura de Trujillo.'),
  (35, '9789560013583', 'El laberinto de la soledad', 1950, 'Ensayo', 352, 1, 'Ensayo sobre la identidad mexicana.'),
  (36, '9789560013958', 'Como agua para chocolate', 1989, 'Novela', 256, 1, 'Tita cocina sus emociones en cada receta.'),
  (37, '9789560014320', 'Pedro Páramo', 1955, 'Novela', 128, 2, 'Juan Preciado busca a su padre en un pueblo de muertos.'),
  (38, '9789560014696', 'El llano en llamas', 1953, 'Cuento', 192, 2, 'Cuentos del campo mexicano después de la revolución.'),
  (39, '9789560015068', 'Altazor', 1931, 'Poesía', 144, 1, 'Viaje en paracaídas por el lenguaje: el gran poema del creacionismo.'),
  (40, '9789560015433', 'Décimas', 1970, 'Poesía', 240, 1, 'Autobiografía en verso de Violeta Parra.'),
  (41, '9789560015808', 'Antología de la poesía chilena', 2010, 'Poesía', 420, 2, 'Selección de poemas de las grandes voces de la poesía chilena.'),
  (42, '9789560016171', 'Voces de mujeres', 2018, 'Cuento', 300, 1, 'Antología de narradoras chilenas del siglo XX y XXI.');

INSERT INTO libro_autor (libro_id, autor_id) VALUES
  (1, 1),
  (2, 1),
  (3, 2),
  (4, 2),
  (5, 2),
  (6, 3),
  (7, 3),
  (8, 3),
  (9, 4),
  (10, 4),
  (11, 4),
  (12, 5),
  (13, 5),
  (14, 6),
  (15, 6),
  (16, 7),
  (17, 7),
  (18, 8),
  (19, 9),
  (20, 10),
  (21, 10),
  (22, 11),
  (23, 12),
  (24, 13),
  (25, 13),
  (26, 14),
  (27, 14),
  (28, 14),
  (29, 15),
  (30, 15),
  (31, 16),
  (32, 16),
  (33, 17),
  (34, 17),
  (35, 18),
  (36, 19),
  (37, 20),
  (38, 20),
  (39, 21),
  (40, 22),
  (41, 1),
  (41, 2),
  (41, 8),
  (41, 21),
  (41, 22),
  (42, 6),
  (42, 11),
  (42, 13);

INSERT INTO socios (id, rut, nombre, email, comuna, fecha_alta) VALUES
  (1, '17718802-6', 'José Bravo Gutiérrez', 'jose.bravo1@correo.cl', 'Ñuñoa', '2023-12-21'),
  (2, '21121466-K', 'Nicolás Sepúlveda Espinoza', NULL, 'Ñuñoa', '2025-05-06'),
  (3, '13839547-2', 'Tomás Espinoza López', 'tomas.espinoza3@gmail.com', 'Santiago', '2023-11-09'),
  (4, '18978575-5', 'Francisca Morales Araya', 'francisca.morales4@outlook.com', 'La Reina', '2024-10-09'),
  (5, '11044735-3', 'José Díaz Silva', 'jose.diaz5@outlook.com', 'La Reina', '2024-04-27'),
  (6, '10269465-1', 'Gabriel Flores Reyes', 'gabriel.flores6@gmail.com', 'Providencia', '2024-12-17'),
  (7, '12284771-3', 'Maximiliano Castillo Carrasco', NULL, 'Ñuñoa', '2025-03-06'),
  (8, '21189783-K', 'Juan Pablo Gutiérrez Tapia', 'juan.gutierrez8@gmail.com', 'Providencia', '2025-03-05'),
  (9, '21518575-3', 'Martina Gutiérrez Silva', NULL, 'Ñuñoa', '2024-04-29'),
  (10, '11081840-8', 'Sofía Olivares González', 'sofia.olivares10@correo.cl', 'Santiago', '2025-11-02'),
  (11, '16399985-4', 'Francisco Riquelme Cortés', 'francisco.riquelme11@correo.cl', 'Providencia', '2023-03-17'),
  (12, '9645867-3', 'Francisca González Pérez', 'francisca.gonzalez12@outlook.com', 'Ñuñoa', '2024-06-06'),
  (13, '15133266-8', 'Sebastián Fuentes Díaz', 'sebastian.fuentes13@correo.cl', 'Ñuñoa', '2025-03-10'),
  (14, '12295921-K', 'Gabriel Sánchez Rojas', NULL, 'Ñuñoa', '2024-09-24'),
  (15, '14182616-6', 'Francisca Valenzuela Hernández', 'francisca.valenzuela15@gmail.com', 'Ñuñoa', '2023-11-16'),
  (16, '18182951-6', 'Catalina López Gutiérrez', NULL, 'Macul', '2025-09-17'),
  (17, '15403219-3', 'Vicente Martínez Olivares', 'vicente.martinez17@correo.cl', 'Ñuñoa', '2023-12-14'),
  (18, '11617795-1', 'Javiera Reyes Sepúlveda', 'javiera.reyes18@correo.cl', 'Ñuñoa', '2025-01-16'),
  (19, '11647086-1', 'Maximiliano Pizarro Rodríguez', 'maximiliano.pizarro19@gmail.com', 'Macul', '2024-08-27'),
  (20, '17401311-K', 'Gabriel González Silva', NULL, 'La Reina', '2023-04-28'),
  (21, '18123366-4', 'Agustín Martínez Torres', 'agustin.martinez21@gmail.com', 'Ñuñoa', '2023-11-18'),
  (22, '6662910-4', 'Agustín Díaz Carrasco', 'agustin.diaz22@outlook.com', 'Ñuñoa', '2025-05-28'),
  (23, '6690860-7', 'Sofía Fuentes Tapia', 'sofia.fuentes23@correo.cl', 'Santiago', '2023-09-21'),
  (24, '12134761-K', 'Camila Rodríguez Araya', 'camila.rodriguez24@outlook.com', 'Providencia', '2024-03-23'),
  (25, '22609957-3', 'Agustín Morales Contreras', 'agustin.morales25@outlook.com', 'Providencia', '2024-10-30'),
  (26, '9231856-7', 'José Olivares López', 'jose.olivares26@outlook.com', 'Ñuñoa', '2025-09-23'),
  (27, '19172673-1', 'Josefa Soto Silva', 'josefa.soto27@gmail.com', 'Santiago', '2023-06-06'),
  (28, '6960393-9', 'Daniela Fernández Castillo', NULL, 'Macul', '2024-02-18'),
  (29, '16484635-0', 'Isidora Castillo Vergara', 'isidora.castillo29@outlook.com', 'La Reina', '2025-01-25'),
  (30, '18100483-5', 'Francisca Rojas Sánchez', 'francisca.rojas30@correo.cl', 'Santiago', '2023-11-03'),
  (31, '13711167-5', 'Carolina Bravo Tapia', NULL, 'Macul', '2024-08-15'),
  (32, '7804533-7', 'Joaquín Díaz Morales', 'joaquin.diaz32@correo.cl', 'Macul', '2025-07-18'),
  (33, '17184304-9', 'Cristóbal Tapia Pizarro', 'cristobal.tapia33@gmail.com', 'Ñuñoa', '2024-05-31'),
  (34, '12587869-5', 'Gabriel Bravo Hernández', 'gabriel.bravo34@outlook.com', 'Macul', '2025-06-13'),
  (35, '13072457-4', 'Felipe Olivares Díaz', 'felipe.olivares35@gmail.com', 'Ñuñoa', '2023-08-23'),
  (36, '14403359-0', 'Agustina Riquelme Gutiérrez', 'agustina.riquelme36@gmail.com', 'Santiago', '2023-05-30'),
  (37, '21360605-0', 'Trinidad Cáceres Sánchez', NULL, 'Santiago', '2023-09-20'),
  (38, '10272682-0', 'Joaquín Flores Espinoza', NULL, 'Ñuñoa', '2024-11-05'),
  (39, '18632451-K', 'Valentina Castillo Rojas', 'valentina.castillo39@outlook.com', 'Ñuñoa', '2024-05-02'),
  (40, '12928467-6', 'Felipe Sánchez Figueroa', 'felipe.sanchez40@correo.cl', 'Ñuñoa', '2024-07-31'),
  (41, '9867838-7', 'Vicente Vásquez Gutiérrez', 'vicente.vasquez41@gmail.com', 'Ñuñoa', '2023-07-19'),
  (42, '13107211-2', 'Isidora Bravo Martínez', 'isidora.bravo42@outlook.com', 'Macul', '2024-11-16'),
  (43, '10742832-1', 'Camila Contreras Carrasco', NULL, 'Ñuñoa', '2025-04-06'),
  (44, '20486331-8', 'Carolina Castillo Núñez', 'carolina.castillo44@correo.cl', 'Ñuñoa', '2025-06-04'),
  (45, '6131612-4', 'Martín Olivares López', 'martin.olivares45@outlook.com', 'Ñuñoa', '2024-08-24'),
  (46, '6391105-4', 'Constanza Figueroa Vergara', 'constanza.figueroa46@outlook.com', 'Santiago', '2023-10-28'),
  (47, '21084367-1', 'José Cáceres Díaz', NULL, 'La Reina', '2024-12-26'),
  (48, '16198678-K', 'Fernanda Fernández Cáceres', 'fernanda.fernandez48@correo.cl', 'Ñuñoa', '2024-11-20'),
  (49, '12007005-3', 'Valentina Sánchez Morales', 'valentina.sanchez49@gmail.com', 'La Reina', '2023-09-13'),
  (50, '21306180-1', 'Paula Figueroa Fernández', NULL, 'Ñuñoa', '2024-08-12');

COPY prestamos (libro_id, socio_id, fecha_prestamo, fecha_limite, fecha_devolucion) FROM stdin;
39	50	2025-01-03	2025-01-17	2025-01-16
25	3	2025-01-04	2025-01-18	2025-01-18
40	49	2025-01-04	2025-01-18	2025-01-12
14	15	2025-01-06	2025-01-20	2025-01-10
21	37	2025-01-07	2025-01-21	2025-01-18
16	14	2025-01-14	2025-01-28	2025-01-18
41	28	2025-01-16	2025-01-30	2025-01-25
2	20	2025-01-17	2025-01-31	\N
28	20	2025-01-24	2025-02-07	2025-02-15
22	29	2025-01-29	2025-02-12	2025-02-12
7	17	2025-01-31	2025-02-14	2025-02-10
32	36	2025-02-02	2025-02-16	2025-02-09
41	15	2025-02-02	2025-02-16	2025-02-14
24	37	2025-02-11	2025-02-25	2025-02-19
21	15	2025-02-13	2025-02-27	2025-02-19
19	40	2025-02-17	2025-03-03	2025-03-11
6	50	2025-02-18	2025-03-04	2025-02-28
16	50	2025-02-18	2025-03-04	\N
3	33	2025-02-26	2025-03-12	2025-03-16
2	21	2025-02-27	2025-03-13	2025-04-14
28	11	2025-02-28	2025-03-14	2025-04-05
27	29	2025-03-04	2025-03-18	2025-03-28
19	1	2025-03-05	2025-03-19	2025-03-13
28	39	2025-03-05	2025-03-19	2025-03-21
21	18	2025-03-10	2025-03-24	2025-04-02
13	21	2025-03-14	2025-03-28	2025-03-22
39	1	2025-03-14	2025-03-28	2025-03-19
22	33	2025-03-16	2025-03-30	2025-03-20
38	29	2025-03-17	2025-03-31	2025-03-25
14	15	2025-03-19	2025-04-02	\N
26	15	2025-03-19	2025-04-02	2025-04-01
37	36	2025-03-19	2025-04-02	2025-03-27
36	11	2025-03-20	2025-04-03	2025-04-30
27	46	2025-03-21	2025-04-04	2025-05-09
11	8	2025-03-24	2025-04-07	2025-04-14
25	31	2025-03-26	2025-04-09	2025-04-02
5	13	2025-03-29	2025-04-12	2025-04-02
23	21	2025-03-30	2025-04-13	2025-04-08
7	15	2025-04-02	2025-04-16	2025-04-10
25	18	2025-04-14	2025-04-28	2025-04-25
30	23	2025-04-17	2025-05-01	2025-04-24
40	29	2025-04-17	2025-05-01	2025-04-26
42	30	2025-04-17	2025-05-01	2025-04-24
14	19	2025-04-18	2025-05-02	2025-05-01
39	1	2025-04-20	2025-05-04	2025-04-29
19	8	2025-04-21	2025-05-05	2025-04-24
20	50	2025-04-21	2025-05-05	2025-05-04
29	29	2025-04-22	2025-05-06	2025-05-05
31	21	2025-04-22	2025-05-06	2025-04-27
22	43	2025-04-24	2025-05-08	2025-04-27
9	31	2025-04-27	2025-05-11	2025-04-30
17	41	2025-04-28	2025-05-12	2025-05-09
16	11	2025-04-29	2025-05-13	2025-05-06
5	43	2025-05-01	2025-05-15	2025-05-13
13	36	2025-05-01	2025-05-15	2025-05-24
17	15	2025-05-01	2025-05-15	2025-06-18
16	41	2025-05-05	2025-05-19	2025-05-10
19	21	2025-05-05	2025-05-19	2025-05-08
7	28	2025-05-08	2025-05-22	2025-05-21
2	50	2025-05-12	2025-05-26	2025-05-22
36	2	2025-05-14	2025-05-28	2025-06-02
25	42	2025-05-21	2025-06-04	2025-05-29
25	41	2025-05-24	2025-06-07	2025-06-03
8	23	2025-05-25	2025-06-08	2025-05-28
33	13	2025-05-26	2025-06-09	\N
22	45	2025-05-27	2025-06-10	2025-06-01
13	43	2025-05-28	2025-06-11	\N
7	22	2025-05-29	2025-06-12	2025-06-06
7	22	2025-05-29	2025-06-12	2025-06-11
15	50	2025-05-31	2025-06-14	2025-06-10
20	43	2025-05-31	2025-06-14	2025-06-03
26	50	2025-06-01	2025-06-15	2025-06-12
34	22	2025-06-01	2025-06-15	2025-06-07
36	22	2025-06-02	2025-06-16	2025-06-18
11	22	2025-06-04	2025-06-18	2025-06-11
15	22	2025-06-04	2025-06-18	2025-07-15
31	44	2025-06-04	2025-06-18	2025-06-10
26	1	2025-06-05	2025-06-19	2025-06-13
2	22	2025-06-06	2025-06-20	2025-06-10
34	15	2025-06-08	2025-06-22	2025-06-13
19	22	2025-06-09	2025-06-23	2025-06-19
13	27	2025-06-11	2025-06-25	2025-07-30
37	14	2025-06-11	2025-06-25	2025-06-17
34	29	2025-06-12	2025-06-26	2025-06-26
28	22	2025-06-16	2025-06-30	\N
25	22	2025-06-17	2025-07-01	2025-07-10
13	1	2025-06-20	2025-07-04	2025-07-17
13	9	2025-06-20	2025-07-04	2025-07-08
14	20	2025-06-20	2025-07-04	2025-07-01
13	17	2025-06-21	2025-07-05	2025-06-29
29	21	2025-06-21	2025-07-05	2025-07-05
11	1	2025-06-22	2025-07-06	2025-07-01
23	8	2025-07-01	2025-07-15	2025-07-15
25	23	2025-07-02	2025-07-16	2025-07-09
37	7	2025-07-02	2025-07-16	2025-07-06
24	15	2025-07-04	2025-07-18	2025-07-10
6	3	2025-07-05	2025-07-19	\N
29	36	2025-07-06	2025-07-20	2025-07-20
9	29	2025-07-12	2025-07-26	2025-07-29
3	19	2025-07-13	2025-07-27	2025-07-27
23	5	2025-07-13	2025-07-27	2025-08-31
11	31	2025-07-15	2025-07-29	2025-07-22
28	9	2025-07-15	2025-07-29	2025-07-28
4	47	2025-07-17	2025-07-31	2025-07-30
13	15	2025-07-17	2025-07-31	2025-07-30
15	32	2025-07-19	2025-08-02	2025-07-27
19	7	2025-07-19	2025-08-02	2025-07-31
17	8	2025-07-20	2025-08-03	2025-08-01
20	34	2025-07-20	2025-08-03	2025-07-25
16	35	2025-07-28	2025-08-11	2025-08-11
18	12	2025-07-28	2025-08-11	2025-08-21
42	32	2025-07-29	2025-08-12	2025-08-06
18	2	2025-07-30	2025-08-13	2025-08-13
37	32	2025-07-30	2025-08-13	2025-08-15
10	43	2025-07-31	2025-08-14	2025-08-22
27	15	2025-08-02	2025-08-16	2025-08-24
27	28	2025-08-02	2025-08-16	2025-08-16
37	39	2025-08-03	2025-08-17	2025-08-07
10	42	2025-08-05	2025-08-19	2025-08-18
19	42	2025-08-05	2025-08-19	2025-08-14
36	13	2025-08-07	2025-08-21	2025-09-22
19	36	2025-08-16	2025-08-30	2025-09-20
22	44	2025-08-17	2025-08-31	2025-08-20
36	43	2025-08-17	2025-08-31	2025-08-21
15	8	2025-08-20	2025-09-03	2025-09-02
27	22	2025-08-20	2025-09-03	2025-08-24
39	1	2025-08-20	2025-09-03	2025-09-23
19	37	2025-08-21	2025-09-04	2025-09-12
27	18	2025-08-27	2025-09-10	2025-09-10
10	45	2025-08-28	2025-09-11	2025-09-03
28	17	2025-08-28	2025-09-11	2025-09-08
9	27	2025-08-29	2025-09-12	2025-09-08
28	31	2025-09-02	2025-09-16	2025-09-09
20	22	2025-09-03	2025-09-17	2025-09-17
7	1	2025-09-05	2025-09-19	2025-09-09
16	47	2025-09-05	2025-09-19	\N
19	3	2025-09-08	2025-09-22	2025-09-15
31	37	2025-09-08	2025-09-22	2025-09-13
19	12	2025-09-09	2025-09-23	2025-09-18
16	15	2025-09-10	2025-09-24	2025-09-21
33	24	2025-09-10	2025-09-24	2025-09-13
29	8	2025-09-11	2025-09-25	2025-09-14
1	9	2025-09-14	2025-09-28	2025-10-06
10	21	2025-09-14	2025-09-28	2025-09-28
23	7	2025-09-14	2025-09-28	2025-09-23
15	12	2025-09-16	2025-09-30	2025-09-22
17	37	2025-09-16	2025-09-30	2025-09-19
36	15	2025-09-16	2025-09-30	2025-09-29
6	15	2025-09-18	2025-10-02	2025-09-22
25	43	2025-09-18	2025-10-02	2025-09-22
38	16	2025-09-20	2025-10-04	2025-09-24
6	43	2025-09-23	2025-10-07	2025-09-26
36	16	2025-09-27	2025-10-11	2025-09-30
27	3	2025-09-30	2025-10-14	\N
31	15	2025-09-30	2025-10-14	2025-10-23
22	43	2025-10-02	2025-10-16	2025-10-11
9	48	2025-10-03	2025-10-17	2025-10-08
26	4	2025-10-05	2025-10-19	2025-10-18
9	9	2025-10-06	2025-10-20	2025-10-16
13	8	2025-10-07	2025-10-21	2025-10-21
28	26	2025-10-09	2025-10-23	2025-10-22
39	47	2025-10-14	2025-10-28	2025-11-27
41	40	2025-10-15	2025-10-29	2025-10-28
11	40	2025-10-17	2025-10-31	2025-10-30
10	25	2025-10-19	2025-11-02	2025-10-26
18	37	2025-10-20	2025-11-03	\N
21	48	2025-10-25	2025-11-08	2025-11-03
36	36	2025-10-27	2025-11-10	2025-11-09
37	22	2025-10-27	2025-11-10	2025-11-11
14	37	2025-10-30	2025-11-13	2025-11-05
9	10	2025-11-02	2025-11-16	2025-11-09
28	21	2025-11-03	2025-11-17	2025-11-17
4	31	2025-11-05	2025-11-19	2025-11-15
1	29	2025-11-09	2025-11-23	2025-12-07
22	23	2025-11-11	2025-11-25	2025-11-19
5	45	2025-11-12	2025-11-26	2025-11-27
7	22	2025-11-13	2025-11-27	2025-11-22
21	22	2025-11-13	2025-11-27	2025-11-16
22	20	2025-11-13	2025-11-27	2025-11-26
14	1	2025-11-14	2025-11-28	2025-11-24
38	1	2025-11-14	2025-11-28	2025-11-22
27	29	2025-11-17	2025-12-01	2025-11-25
9	44	2025-11-19	2025-12-03	2025-11-28
11	6	2025-11-20	2025-12-04	2025-11-25
27	10	2025-11-22	2025-12-06	2025-11-26
34	39	2025-11-24	2025-12-08	2026-01-15
37	50	2025-11-24	2025-12-08	2025-12-05
26	13	2025-11-25	2025-12-09	\N
16	39	2025-11-26	2025-12-10	2025-12-09
15	20	2025-11-27	2025-12-11	2025-12-04
39	41	2025-11-28	2025-12-12	2025-12-12
22	50	2025-12-01	2025-12-15	2025-12-11
33	16	2025-12-01	2025-12-15	2025-12-17
25	20	2025-12-02	2025-12-16	2025-12-15
33	8	2025-12-02	2025-12-16	2025-12-10
1	34	2025-12-04	2025-12-18	2025-12-10
34	47	2025-12-04	2025-12-18	2025-12-07
20	31	2025-12-10	2025-12-24	2025-12-19
17	14	2025-12-13	2025-12-27	2026-01-02
28	43	2025-12-17	2025-12-31	2025-12-31
19	50	2025-12-19	2026-01-02	2025-12-29
22	8	2025-12-20	2026-01-03	2026-01-01
36	27	2025-12-20	2026-01-03	2026-01-02
34	7	2025-12-21	2026-01-04	2026-01-17
42	20	2025-12-21	2026-01-04	2026-01-01
9	50	2025-12-27	2026-01-10	2026-01-06
21	24	2025-12-27	2026-01-10	2026-01-23
28	44	2025-12-30	2026-01-13	2026-01-10
40	15	2026-01-02	2026-01-16	2026-02-25
39	45	2026-01-03	2026-01-17	2026-01-14
37	15	2026-01-04	2026-01-18	2026-01-16
1	44	2026-01-08	2026-01-22	2026-01-11
22	43	2026-01-14	2026-01-28	2026-02-22
14	48	2026-01-16	2026-01-30	2026-01-23
38	1	2026-01-17	2026-01-31	2026-01-25
33	48	2026-01-21	2026-02-04	2026-02-01
15	4	2026-01-26	2026-02-09	2026-02-09
26	43	2026-01-27	2026-02-10	2026-02-08
14	20	2026-01-29	2026-02-12	2026-02-03
33	36	2026-01-30	2026-02-13	2026-02-07
41	46	2026-01-31	2026-02-14	2026-02-06
10	45	2026-02-01	2026-02-15	2026-02-06
13	1	2026-02-02	2026-02-16	2026-02-25
25	22	2026-02-05	2026-02-19	2026-02-08
37	15	2026-02-05	2026-02-19	2026-02-10
9	22	2026-02-06	2026-02-20	2026-02-20
30	4	2026-02-08	2026-02-22	2026-02-22
14	36	2026-02-09	2026-02-23	2026-03-15
14	22	2026-02-10	2026-02-24	2026-03-14
2	37	2026-02-11	2026-02-25	2026-02-23
1	29	2026-02-13	2026-02-27	2026-02-23
41	37	2026-02-14	2026-02-28	2026-02-28
24	17	2026-02-16	2026-03-02	2026-02-24
40	8	2026-02-17	2026-03-03	2026-02-27
20	22	2026-02-18	2026-03-04	2026-02-28
29	21	2026-02-22	2026-03-08	2026-03-02
14	47	2026-02-28	2026-03-14	2026-03-08
26	32	2026-02-28	2026-03-14	2026-03-12
17	2	2026-03-01	2026-03-15	2026-03-05
31	29	2026-03-04	2026-03-18	2026-03-16
2	22	2026-03-05	2026-03-19	2026-03-28
30	24	2026-03-05	2026-03-19	2026-03-18
10	21	2026-03-06	2026-03-20	2026-03-14
3	40	2026-03-08	2026-03-22	2026-03-18
20	45	2026-03-08	2026-03-22	2026-03-17
25	47	2026-03-10	2026-03-24	2026-03-23
33	50	2026-03-11	2026-03-25	2026-03-17
19	36	2026-03-13	2026-03-27	2026-04-20
8	8	2026-03-15	2026-03-29	2026-03-23
9	49	2026-03-16	2026-03-30	2026-03-26
22	31	2026-03-17	2026-03-31	2026-03-21
15	48	2026-03-18	2026-04-01	2026-03-24
5	16	2026-03-19	2026-04-02	2026-04-04
20	43	2026-03-20	2026-04-03	2026-03-28
37	38	2026-03-21	2026-04-04	2026-03-24
20	26	2026-03-22	2026-04-05	2026-04-08
22	50	2026-03-22	2026-04-05	2026-04-13
9	30	2026-03-25	2026-04-08	2026-04-01
41	9	2026-03-26	2026-04-09	2026-04-18
21	48	2026-03-27	2026-04-10	2026-04-11
16	29	2026-03-29	2026-04-12	\N
30	50	2026-04-03	2026-04-17	2026-04-16
39	32	2026-04-03	2026-04-17	2026-04-13
27	31	2026-04-05	2026-04-19	2026-04-10
19	6	2026-04-06	2026-04-20	2026-04-12
11	15	2026-04-10	2026-04-24	2026-04-23
17	50	2026-04-10	2026-04-24	2026-04-16
15	1	2026-04-11	2026-04-25	2026-04-30
40	35	2026-04-11	2026-04-25	2026-04-24
28	40	2026-04-12	2026-04-26	2026-04-23
11	36	2026-04-16	2026-04-30	2026-04-22
28	27	2026-04-16	2026-04-30	2026-04-29
37	22	2026-04-16	2026-04-30	2026-04-21
11	2	2026-04-18	2026-05-02	2026-04-27
7	49	2026-04-20	2026-05-04	2026-05-17
22	50	2026-04-20	2026-05-04	2026-05-15
10	36	2026-04-24	2026-05-08	2026-04-29
23	15	2026-04-25	2026-05-09	2026-05-09
23	50	2026-04-25	2026-05-09	2026-05-06
34	33	2026-04-28	2026-05-12	2026-05-30
37	45	2026-04-28	2026-05-12	2026-05-06
19	49	2026-04-29	2026-05-13	2026-05-09
37	29	2026-04-30	2026-05-14	2026-05-14
33	36	2026-05-01	2026-05-15	2026-05-14
40	38	2026-05-01	2026-05-15	2026-05-12
15	21	2026-05-03	2026-05-17	2026-06-19
37	29	2026-05-04	2026-05-18	2026-05-17
25	36	2026-05-11	2026-05-25	2026-05-25
29	1	2026-05-11	2026-05-25	2026-05-15
36	18	2026-05-11	2026-05-25	2026-05-23
8	31	2026-05-14	2026-05-28	2026-05-28
14	29	2026-05-14	2026-05-28	2026-06-05
29	50	2026-05-14	2026-05-28	2026-05-21
37	14	2026-05-14	2026-05-28	2026-05-23
1	16	2026-05-15	2026-05-29	2026-05-18
25	3	2026-05-15	2026-05-29	2026-05-28
10	44	2026-05-16	2026-05-30	\N
10	10	2026-05-16	2026-05-30	2026-05-30
33	15	2026-05-18	2026-06-01	2026-05-23
20	15	2026-05-21	2026-06-04	2026-05-24
36	22	2026-05-24	2026-06-07	2026-06-15
39	24	2026-05-24	2026-06-07	2026-05-31
37	24	2026-05-26	2026-06-09	2026-06-09
11	8	2026-06-01	2026-06-15	2026-06-13
37	8	2026-06-01	2026-06-15	2026-06-16
29	25	2026-06-02	2026-06-16	2026-06-06
42	20	2026-06-02	2026-06-16	2026-06-15
38	15	2026-06-07	2026-06-21	2026-06-20
16	15	2026-06-08	2026-06-22	2026-06-12
5	15	2026-06-09	2026-06-23	2026-06-21
25	50	2026-06-10	2026-06-24	\N
25	11	2026-06-11	2026-06-25	2026-06-14
10	29	2026-06-13	2026-06-27	\N
28	39	2026-06-17	2026-07-01	\N
10	1	2026-06-22	2026-07-06	\N
38	8	2026-06-22	2026-07-06	\N
7	1	2026-06-23	2026-07-07	\N
15	36	2026-06-24	2026-07-08	\N
2	2	2026-06-25	2026-07-09	\N
19	19	2026-06-26	2026-07-10	\N
\.
