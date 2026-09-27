-- Tienda Andes: comercio electrónico chileno (datos ficticios y deterministas).
-- Precios en pesos chilenos (CLP, enteros). Fechas en la zona horaria de Chile.

CREATE TABLE categorias (
  id        integer PRIMARY KEY,
  nombre    text NOT NULL UNIQUE,
  padre_id  integer REFERENCES categorias (id)
);

CREATE TABLE productos (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku           text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  categoria_id  integer NOT NULL REFERENCES categorias (id),
  precio        integer NOT NULL CHECK (precio > 0),
  costo         integer NOT NULL CHECK (costo > 0),
  stock         integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo        boolean NOT NULL DEFAULT true,
  creado_en     date NOT NULL
);

CREATE TABLE clientes (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rut             text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  apellido        text NOT NULL,
  email           text UNIQUE,
  telefono        text,
  comuna          text,
  region          text,
  fecha_registro  date NOT NULL
);

CREATE TABLE pedidos (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id      integer NOT NULL REFERENCES clientes (id),
  fecha           timestamptz NOT NULL,
  estado          text NOT NULL CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  metodo_pago     text CHECK (metodo_pago IN ('debito', 'credito', 'transferencia')),
  costo_despacho  integer NOT NULL DEFAULT 0
);

CREATE TABLE pedido_items (
  pedido_id        integer NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  producto_id      integer NOT NULL REFERENCES productos (id),
  cantidad         integer NOT NULL CHECK (cantidad > 0),
  precio_unitario  integer NOT NULL CHECK (precio_unitario > 0),
  PRIMARY KEY (pedido_id, producto_id)
);

CREATE TABLE resenas (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  producto_id  integer NOT NULL REFERENCES productos (id),
  cliente_id   integer NOT NULL REFERENCES clientes (id),
  nota         smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario   text,
  fecha        date NOT NULL
);

COMMENT ON TABLE productos IS 'Catálogo de la tienda (precios en CLP)';
COMMENT ON TABLE pedido_items IS 'Detalle de cada pedido: el precio se guarda tal como estaba al comprar';

INSERT INTO categorias (id, nombre, padre_id) VALUES
  (1, 'Tecnología', NULL),
  (2, 'Computación', 1),
  (3, 'Audio', 1),
  (4, 'Accesorios', 1),
  (5, 'Hogar', NULL),
  (6, 'Cocina', 5),
  (7, 'Decoración', 5),
  (8, 'Deportes', NULL),
  (9, 'Ciclismo', 8),
  (10, 'Outdoor', 8),
  (11, 'Libros', NULL),
  (12, 'Alimentos', NULL),
  (13, 'Café y té', 12);

INSERT INTO productos (sku, nombre, categoria_id, precio, costo, stock, activo, creado_en) VALUES
  ('COMP-001', 'Notebook 14" Ryzen 5', 2, 549990, 343590, 37, true, '2024-04-09'),
  ('COMP-002', 'Monitor 24" Full HD', 2, 129990, 77810, 84, true, '2025-06-20'),
  ('COMP-003', 'Teclado mecánico', 2, 49990, 28900, 16, true, '2024-08-30'),
  ('COMP-004', 'Mouse inalámbrico', 2, 14990, 8030, 28, true, '2024-06-12'),
  ('COMP-005', 'Disco SSD 1 TB', 2, 69990, 39280, 20, true, '2025-03-03'),
  ('COMP-006', 'Cámara web HD', 2, 29990, 17500, 6, true, '2024-03-18'),
  ('AUD-001', 'Audífonos inalámbricos', 3, 39990, 21530, 93, true, '2024-06-14'),
  ('AUD-002', 'Audífonos con cancelación de ruido', 3, 149990, 78860, 55, true, '2025-05-19'),
  ('AUD-003', 'Parlante Bluetooth', 3, 34990, 18930, 17, true, '2024-05-12'),
  ('AUD-004', 'Micrófono USB', 3, 59990, 37460, 62, true, '2024-09-27'),
  ('AUD-005', 'Reproductor MP3', 3, 19990, 13020, 0, false, '2024-07-27'),
  ('ACC-001', 'Cargador USB-C 65 W', 4, 24990, 14880, 11, true, '2024-06-06'),
  ('ACC-002', 'Cable HDMI 2 m', 4, 6990, 3660, 23, true, '2025-02-20'),
  ('ACC-003', 'Batería externa 20000 mAh', 4, 27990, 17970, 47, true, '2024-12-23'),
  ('ACC-004', 'Funda para notebook', 4, 15990, 10500, 0, true, '2024-04-04'),
  ('ACC-005', 'Hub USB-C 7 en 1', 4, 32990, 21090, 63, true, '2025-01-07'),
  ('COC-001', 'Hervidor eléctrico', 6, 21990, 14700, 78, true, '2025-06-06'),
  ('COC-002', 'Cafetera italiana', 6, 18990, 12570, 22, true, '2024-07-26'),
  ('COC-003', 'Sartén antiadherente 28 cm', 6, 24990, 15120, 73, true, '2024-07-18'),
  ('COC-004', 'Juego de cuchillos', 6, 39990, 27810, 71, true, '2025-01-05'),
  ('COC-005', 'Batidora de mano', 6, 29990, 20060, 0, true, '2024-08-11'),
  ('COC-006', 'Olla a presión', 6, 54990, 31070, 84, true, '2024-09-06'),
  ('DEC-001', 'Lámpara de escritorio', 7, 19990, 11270, 60, true, '2024-08-10'),
  ('DEC-002', 'Cojín de lana', 7, 12990, 8720, 65, true, '2024-12-01'),
  ('DEC-003', 'Set de velas aromáticas', 7, 9990, 6320, 0, true, '2025-02-15'),
  ('DEC-004', 'Espejo redondo', 7, 34990, 22420, 38, true, '2025-02-13'),
  ('CIC-001', 'Bicicleta urbana aro 28', 9, 349990, 185600, 89, true, '2025-01-16'),
  ('CIC-002', 'Casco de ciclismo', 9, 29990, 20370, 47, true, '2024-12-18'),
  ('CIC-003', 'Luces LED para bicicleta', 9, 12990, 8540, 69, true, '2025-03-08'),
  ('CIC-004', 'Candado en U', 9, 19990, 13800, 23, true, '2024-04-07'),
  ('OUT-001', 'Mochila 40 L', 10, 49990, 31980, 52, true, '2024-03-18'),
  ('OUT-002', 'Carpa para 2 personas', 10, 89990, 54120, 37, true, '2024-11-28'),
  ('OUT-003', 'Saco de dormir', 10, 59990, 39190, 13, true, '2025-05-29'),
  ('OUT-004', 'Botella térmica 1 L', 10, 16990, 11030, 87, true, '2024-05-01'),
  ('OUT-005', 'Linterna frontal', 10, 13990, 9290, 102, true, '2024-10-12'),
  ('LIB-001', 'Cien años de soledad', 11, 15990, 9680, 35, true, '2024-04-11'),
  ('LIB-002', 'La casa de los espíritus', 11, 14990, 9530, 68, true, '2025-05-30'),
  ('LIB-003', 'Veinte poemas de amor', 11, 8990, 4980, 0, true, '2025-07-02'),
  ('LIB-004', 'Hijo de ladrón', 11, 12990, 7650, 90, true, '2024-06-20'),
  ('LIB-005', 'Aprende SQL paso a paso', 11, 24990, 13600, 38, true, '2024-09-13'),
  ('LIB-006', 'El principito', 11, 7990, 4420, 69, true, '2024-06-03'),
  ('CAF-001', 'Café en grano 1 kg', 13, 19990, 11160, 83, true, '2024-10-30'),
  ('CAF-002', 'Café molido 500 g', 13, 9990, 5630, 55, true, '2025-07-06'),
  ('CAF-003', 'Té verde 100 bolsitas', 13, 5990, 3950, 32, true, '2024-12-26'),
  ('CAF-004', 'Yerba mate 1 kg', 13, 6990, 4790, 106, true, '2024-10-18'),
  ('ALI-001', 'Chocolate amargo 70 %', 12, 3490, 1840, 0, true, '2025-06-03'),
  ('ALI-002', 'Miel de ulmo 500 g', 12, 8990, 5270, 40, true, '2025-07-03'),
  ('ALI-003', 'Merkén 100 g', 12, 2990, 1870, 0, true, '2025-01-15'),
  ('ALI-004', 'Aceite de oliva 1 L', 12, 11990, 7420, 101, true, '2024-08-21');

INSERT INTO clientes (rut, nombre, apellido, email, telefono, comuna, region, fecha_registro) VALUES
  ('19501525-2', 'Lucas', 'Castro Núñez', 'lucas.castro@hotmail.com', NULL, 'Santiago', 'Metropolitana', '2025-04-12'),
  ('23322749-8', 'Benjamín', 'Contreras Bravo', 'benjamin.contreras@gmail.com', NULL, 'La Serena', 'Coquimbo', '2024-08-07'),
  ('16517822-K', 'Agustina', 'Reyes Pizarro', 'agustina.reyes66@gmail.com', '+56 9 3173 6076', 'Talcahuano', 'Biobío', '2025-09-14'),
  ('10043950-6', 'Florencia', 'Castro Cáceres', 'florencia.castro@gmail.com', '+56 9 7082 2177', 'Santiago', 'Metropolitana', '2025-01-02'),
  ('17003121-0', 'Francisca', 'López Fuentes', 'francisca.lopez85@correo.cl', '+56 9 3687 7644', NULL, NULL, '2026-02-05'),
  ('24272963-3', 'Lucas', 'Sánchez González', 'lucas.sanchez@gmail.com', '+56 9 8756 5943', 'Punta Arenas', 'Magallanes', '2024-04-25'),
  ('20391055-K', 'Diego', 'Contreras Fernández', 'diego.contreras@gmail.com', '+56 9 1391 3243', 'Las Condes', 'Metropolitana', '2026-04-21'),
  ('13714546-4', 'Sebastián', 'Bravo Contreras', 'sebastian.bravo@gmail.com', '+56 9 8210 8660', 'Concepción', 'Biobío', '2025-12-13'),
  ('17032687-3', 'Sofía', 'Gutiérrez Hernández', 'sofia.gutierrez@gmail.com', '+56 9 8909 1696', 'Providencia', 'Metropolitana', '2024-02-09'),
  ('13503262-K', 'Emilia', 'Álvarez Morales', NULL, '+56 9 3448 7558', 'Ñuñoa', 'Metropolitana', '2025-07-28'),
  ('13608573-5', 'Trinidad', 'Sánchez Bravo', NULL, '+56 9 9976 8192', 'Maipú', 'Metropolitana', '2025-06-12'),
  ('21801480-1', 'Nicolás', 'Cortés Riquelme', 'nicolas.cortes83@correo.cl', '+56 9 6172 6532', 'Concepción', 'Biobío', '2024-09-23'),
  ('8892072-4', 'Cristóbal', 'Reyes Vergara', 'cristobal.reyes@hotmail.com', '+56 9 8086 9052', 'La Florida', 'Metropolitana', '2025-07-17'),
  ('15500657-9', 'Carolina', 'Castro Reyes', NULL, '+56 9 3517 6147', 'Ñuñoa', 'Metropolitana', '2025-09-18'),
  ('18820529-1', 'Constanza', 'Rodríguez Muñoz', 'constanza.rodriguez84@outlook.com', '+56 9 9475 4639', 'San Miguel', 'Metropolitana', '2024-09-03'),
  ('13523656-K', 'Maximiliano', 'Silva Jara', 'maximiliano.silva@yahoo.com', '+56 9 9021 7616', 'Puente Alto', 'Metropolitana', '2025-02-10'),
  ('16617431-7', 'Isidora', 'Torres Sánchez', 'isidora.torres@outlook.com', '+56 9 2164 1557', 'Temuco', 'La Araucanía', '2025-09-14'),
  ('18732147-6', 'Florencia', 'Contreras Flores', 'florencia.contreras@correo.cl', '+56 9 1649 2205', 'Puente Alto', 'Metropolitana', '2024-08-18'),
  ('14376274-2', 'Tomás', 'Hernández Vásquez', 'tomas.hernandez93@outlook.com', NULL, 'Las Condes', 'Metropolitana', '2024-09-07'),
  ('10252700-3', 'Francisca', 'Gutiérrez Castro', 'francisca.gutierrez@outlook.com', NULL, 'Maipú', 'Metropolitana', '2024-12-11'),
  ('10947822-9', 'Florencia', 'Figueroa Martínez', 'florencia.figueroa@gmail.com', '+56 9 9706 1036', 'La Florida', 'Metropolitana', '2025-07-21'),
  ('9022735-1', 'José', 'Martínez Morales', 'jose.martinez@outlook.com', '+56 9 3262 3546', 'Talca', 'Maule', '2025-03-19'),
  ('11845807-9', 'Ignacio', 'Araya Tapia', 'ignacio.araya54@outlook.com', '+56 9 4480 8665', 'Las Condes', 'Metropolitana', '2025-06-04'),
  ('20177868-9', 'Nicolás', 'Vergara Flores', NULL, '+56 9 5231 2718', 'Ñuñoa', 'Metropolitana', '2025-04-30'),
  ('10505161-1', 'Sofía', 'Gutiérrez Pizarro', 'sofia.gutierrez86@hotmail.com', '+56 9 6616 6099', 'Vitacura', 'Metropolitana', '2025-04-04'),
  ('13667152-9', 'Catalina', 'Castro Tapia', 'catalina.castro@gmail.com', '+56 9 1544 7640', 'Peñalolén', 'Metropolitana', '2025-01-04'),
  ('17363400-5', 'Matías', 'Núñez Carrasco', 'matias.nunez@gmail.com', '+56 9 4020 9092', 'Talcahuano', 'Biobío', '2025-04-15'),
  ('24358085-4', 'Lucas', 'Pizarro Reyes', 'lucas.pizarro9@yahoo.com', '+56 9 6838 1724', 'Las Condes', 'Metropolitana', '2024-05-26'),
  ('16494896-K', 'Catalina', 'Núñez Fernández', 'catalina.nunez@gmail.com', '+56 9 2127 5342', 'Santiago', 'Metropolitana', '2025-11-21'),
  ('14221701-5', 'Isidora', 'López González', 'isidora.lopez@gmail.com', '+56 9 6516 3810', 'La Serena', 'Coquimbo', '2025-03-19'),
  ('7973125-0', 'Daniela', 'Álvarez López', 'daniela.alvarez@yahoo.com', '+56 9 7998 5687', 'La Florida', 'Metropolitana', '2025-11-24'),
  ('18052494-0', 'Sofía', 'Tapia Fuentes', NULL, '+56 9 1384 3660', 'Puente Alto', 'Metropolitana', '2026-03-28'),
  ('12943152-0', 'Emilia', 'Cortés Gutiérrez', 'emilia.cortes@gmail.com', '+56 9 3693 4831', 'Valdivia', 'Los Ríos', '2024-07-29'),
  ('12605669-9', 'Francisca', 'Silva Pizarro', 'francisca.silva43@outlook.com', NULL, 'Providencia', 'Metropolitana', '2024-03-07'),
  ('22979899-5', 'Matías', 'Sánchez Figueroa', 'matias.sanchez58@gmail.com', '+56 9 9827 3366', 'Las Condes', 'Metropolitana', '2024-02-25'),
  ('15153712-K', 'Tomás', 'Torres Fuentes', 'tomas.torres8@hotmail.com', '+56 9 3529 9736', 'Santiago', 'Metropolitana', '2024-03-31'),
  ('24673147-0', 'Agustina', 'Gutiérrez Vásquez', 'agustina.gutierrez@hotmail.com', '+56 9 7397 3547', 'Santiago', 'Metropolitana', '2024-08-17'),
  ('7575095-1', 'Tomás', 'López Castillo', 'tomas.lopez47@gmail.com', '+56 9 1311 7366', 'Ñuñoa', 'Metropolitana', '2026-02-15'),
  ('7536522-5', 'Agustina', 'Araya Núñez', 'agustina.araya@gmail.com', '+56 9 4309 6708', 'Santiago', 'Metropolitana', '2024-12-17'),
  ('15369651-9', 'Emilia', 'Jara Castro', 'emilia.jara@gmail.com', '+56 9 3878 7239', 'Talca', 'Maule', '2024-11-21'),
  ('15073971-3', 'Francisco', 'Soto Araya', 'francisco.soto@gmail.com', '+56 9 7838 4804', 'Puente Alto', 'Metropolitana', '2026-01-09'),
  ('14444128-1', 'Tomás', 'Rojas González', 'tomas.rojas@hotmail.com', '+56 9 6547 9381', 'Providencia', 'Metropolitana', '2025-03-27'),
  ('15705121-0', 'Trinidad', 'Díaz Olivares', 'trinidad.diaz31@gmail.com', '+56 9 7267 9601', 'Ñuñoa', 'Metropolitana', '2025-09-06'),
  ('23670660-5', 'Camila', 'Martínez Castro', 'camila.martinez58@gmail.com', '+56 9 2790 9738', 'Santiago', 'Metropolitana', '2025-01-11'),
  ('16394449-9', 'Sofía', 'Morales Contreras', 'sofia.morales@correo.cl', NULL, 'Puerto Montt', 'Los Lagos', '2026-04-02'),
  ('23936203-6', 'Cristóbal', 'Valenzuela Jara', 'cristobal.valenzuela@gmail.com', '+56 9 4034 9873', 'Valparaíso', 'Valparaíso', '2024-08-10'),
  ('11226722-0', 'Antonia', 'Pizarro Núñez', 'antonia.pizarro72@outlook.com', '+56 9 8543 5439', 'Las Condes', 'Metropolitana', '2025-06-05'),
  ('16711445-8', 'Ignacio', 'Vásquez Reyes', 'ignacio.vasquez@yahoo.com', NULL, 'La Florida', 'Metropolitana', '2024-12-24'),
  ('18665665-2', 'Fernanda', 'Díaz Hernández', 'fernanda.diaz41@hotmail.com', NULL, 'Providencia', 'Metropolitana', '2025-02-17'),
  ('20647146-8', 'Rodrigo', 'Sepúlveda Castillo', 'rodrigo.sepulveda@hotmail.com', NULL, 'Puente Alto', 'Metropolitana', '2025-11-25'),
  ('22420537-6', 'María José', 'Rodríguez López', 'maria.rodriguez@gmail.com', '+56 9 9877 1102', 'La Florida', 'Metropolitana', '2025-07-17'),
  ('9736468-0', 'Javiera', 'Contreras Sánchez', 'javiera.contreras87@gmail.com', '+56 9 4894 5946', 'Ñuñoa', 'Metropolitana', '2025-01-16'),
  ('10004890-6', 'Agustina', 'López Díaz', 'agustina.lopez61@hotmail.com', '+56 9 8785 9523', 'Punta Arenas', 'Magallanes', '2024-12-07'),
  ('18285694-0', 'Javiera', 'Sánchez Vergara', 'javiera.sanchez60@gmail.com', '+56 9 8178 3060', 'Las Condes', 'Metropolitana', '2024-03-16'),
  ('11042113-3', 'Josefa', 'Espinoza Torres', 'josefa.espinoza36@outlook.com', '+56 9 8933 3260', 'Rancagua', 'O''Higgins', '2026-01-29'),
  ('13385140-2', 'Lucas', 'Fuentes Vásquez', 'lucas.fuentes31@gmail.com', NULL, 'Santiago', 'Metropolitana', '2025-01-21'),
  ('17440472-0', 'Valentina', 'Sánchez Figueroa', 'valentina.sanchez@yahoo.com', NULL, 'Las Condes', 'Metropolitana', '2024-07-10'),
  ('16564584-7', 'Josefa', 'Olivares Cortés', 'josefa.olivares14@correo.cl', '+56 9 1704 1633', 'Maipú', 'Metropolitana', '2025-11-17'),
  ('23052867-5', 'Agustina', 'Soto Martínez', 'agustina.soto21@gmail.com', '+56 9 2752 8353', 'Peñalolén', 'Metropolitana', '2024-05-30'),
  ('12644193-2', 'Ignacio', 'Olivares Contreras', 'ignacio.olivares57@gmail.com', '+56 9 6724 6908', 'Quilpué', 'Valparaíso', '2025-11-06');

COPY pedidos (cliente_id, fecha, estado, metodo_pago, costo_despacho) FROM stdin;
26	2025-01-13 21:10:03	cancelado	credito	3990
40	2025-01-16 12:39:59	entregado	debito	5990
33	2025-01-18 20:24:35	entregado	credito	0
20	2025-01-19 13:18:03	entregado	credito	3990
37	2025-01-19 23:38:09	entregado	debito	3990
57	2025-01-23 22:41:44	entregado	debito	3990
33	2025-01-24 18:02:21	entregado	credito	5990
53	2025-01-24 22:37:28	entregado	credito	0
33	2025-01-25 12:36:46	entregado	credito	0
44	2025-01-26 23:30:18	entregado	credito	3990
40	2025-01-27 22:30:11	entregado	credito	5990
44	2025-01-28 10:41:13	entregado	debito	0
20	2025-01-30 20:21:13	entregado	debito	0
2	2025-01-31 10:32:34	entregado	debito	0
18	2025-02-04 18:16:15	cancelado	credito	3990
40	2025-02-04 20:38:17	entregado	debito	5990
33	2025-02-06 23:42:25	entregado	debito	0
52	2025-02-07 21:42:20	entregado	debito	3990
35	2025-02-09 15:54:17	entregado	credito	3990
44	2025-02-14 18:27:38	entregado	debito	3990
20	2025-02-16 12:04:51	entregado	debito	3990
53	2025-02-16 19:13:04	entregado	debito	5990
44	2025-02-20 20:04:26	entregado	debito	0
49	2025-02-26 18:54:56	entregado	debito	0
20	2025-02-26 20:23:16	entregado	transferencia	0
59	2025-03-02 12:09:58	entregado	transferencia	3990
15	2025-03-03 14:16:52	entregado	credito	3990
16	2025-03-04 20:29:02	entregado	credito	0
15	2025-03-09 16:42:41	entregado	credito	3990
53	2025-03-13 19:21:07	entregado	credito	5990
33	2025-03-14 18:30:21	entregado	credito	0
4	2025-03-16 18:49:59	entregado	debito	0
16	2025-03-20 19:15:22	entregado	debito	0
26	2025-03-25 16:06:35	entregado	transferencia	3990
22	2025-03-28 20:03:57	entregado	credito	5990
15	2025-03-29 20:28:07	entregado	credito	3990
59	2025-04-03 12:20:23	entregado	transferencia	3990
22	2025-04-03 21:33:22	entregado	debito	5990
22	2025-04-04 20:24:05	entregado	credito	0
42	2025-04-06 13:01:32	entregado	debito	0
37	2025-04-07 15:33:54	entregado	credito	3990
15	2025-04-07 16:44:16	entregado	transferencia	3990
42	2025-04-09 10:28:04	entregado	debito	3990
12	2025-04-09 21:17:11	entregado	credito	0
28	2025-04-10 10:49:09	entregado	debito	3990
42	2025-04-10 20:55:10	entregado	transferencia	3990
22	2025-04-12 19:55:51	entregado	transferencia	5990
25	2025-04-12 21:02:38	entregado	debito	0
26	2025-04-13 10:04:15	entregado	debito	0
30	2025-04-13 14:57:25	entregado	credito	5990
46	2025-04-13 19:16:34	entregado	credito	0
59	2025-04-14 23:43:30	entregado	debito	3990
25	2025-04-16 19:10:24	entregado	credito	0
27	2025-04-16 21:22:20	entregado	credito	5990
39	2025-04-19 20:22:38	entregado	transferencia	3990
4	2025-04-20 20:05:32	entregado	debito	3990
2	2025-04-23 16:48:38	entregado	credito	5990
44	2025-04-27 12:45:23	entregado	debito	3990
1	2025-04-28 13:40:06	entregado	credito	0
4	2025-04-28 15:13:17	entregado	debito	3990
1	2025-05-01 17:38:02	entregado	transferencia	3990
1	2025-05-03 10:44:03	entregado	credito	3990
2	2025-05-03 16:39:45	entregado	debito	0
59	2025-05-04 15:38:56	entregado	debito	3990
33	2025-05-07 20:11:33	entregado	transferencia	5990
16	2025-05-10 14:21:01	entregado	debito	3990
25	2025-05-11 18:48:00	entregado	transferencia	0
2	2025-05-11 20:22:30	entregado	credito	0
22	2025-05-12 14:26:27	entregado	debito	0
56	2025-05-12 19:05:00	entregado	debito	0
25	2025-05-18 16:45:47	entregado	credito	3990
52	2025-05-18 19:29:44	entregado	credito	3990
49	2025-05-20 22:02:41	entregado	debito	3990
33	2025-05-21 10:46:47	entregado	debito	5990
33	2025-05-21 20:48:44	entregado	credito	0
37	2025-05-24 12:56:49	entregado	debito	0
59	2025-05-24 19:08:53	entregado	credito	3990
26	2025-05-25 22:56:19	entregado	credito	0
44	2025-05-26 21:07:54	entregado	credito	3990
40	2025-05-27 23:23:20	entregado	credito	5990
25	2025-05-28 21:11:45	entregado	credito	3990
28	2025-05-30 13:59:48	entregado	debito	0
2	2025-05-30 14:46:20	entregado	credito	0
20	2025-05-30 20:15:45	entregado	debito	0
40	2025-06-03 23:59:53	entregado	debito	5990
56	2025-06-04 18:40:16	entregado	debito	3990
2	2025-06-04 22:15:46	entregado	debito	0
47	2025-06-08 20:13:52	entregado	debito	0
2	2025-06-09 10:53:46	entregado	debito	5990
59	2025-06-10 21:27:14	entregado	credito	3990
11	2025-06-15 13:01:20	entregado	debito	3990
11	2025-06-16 17:13:27	entregado	credito	3990
44	2025-06-17 12:13:35	entregado	transferencia	3990
59	2025-06-17 12:41:02	entregado	debito	3990
37	2025-06-17 14:11:00	entregado	debito	3990
44	2025-06-19 16:51:47	entregado	debito	0
15	2025-06-22 11:24:45	entregado	credito	3990
47	2025-06-26 10:28:05	entregado	credito	3990
15	2025-06-26 18:48:45	entregado	credito	0
11	2025-06-26 20:18:49	entregado	transferencia	0
11	2025-06-27 11:02:11	entregado	credito	0
16	2025-06-27 14:17:51	entregado	debito	3990
11	2025-06-29 10:12:07	entregado	credito	3990
44	2025-07-03 11:18:18	entregado	debito	0
47	2025-07-03 13:57:39	entregado	debito	0
11	2025-07-04 20:14:22	entregado	credito	3990
11	2025-07-06 21:00:18	entregado	transferencia	3990
35	2025-07-06 22:07:07	entregado	transferencia	0
27	2025-07-07 17:31:27	cancelado	debito	5990
39	2025-07-07 19:45:47	entregado	transferencia	0
56	2025-07-07 23:48:37	cancelado	debito	3990
18	2025-07-12 19:41:05	entregado	debito	3990
35	2025-07-16 21:35:05	entregado	credito	0
36	2025-07-17 11:55:35	entregado	debito	3990
33	2025-07-18 11:45:58	entregado	credito	0
44	2025-07-21 12:18:39	entregado	credito	0
13	2025-07-23 19:25:39	entregado	debito	3990
2	2025-07-24 10:24:46	entregado	credito	5990
28	2025-07-25 20:03:45	entregado	transferencia	0
25	2025-07-28 10:52:37	entregado	transferencia	3990
13	2025-07-28 21:04:53	entregado	debito	3990
13	2025-07-29 19:19:48	entregado	credito	0
22	2025-07-30 20:19:33	entregado	debito	5990
11	2025-08-01 14:56:04	entregado	debito	0
11	2025-08-01 20:17:11	cancelado	credito	3990
13	2025-08-02 22:25:46	entregado	debito	0
33	2025-08-04 10:54:18	entregado	credito	5990
52	2025-08-08 20:07:07	entregado	transferencia	3990
30	2025-08-09 11:33:36	entregado	debito	5990
21	2025-08-11 14:18:30	entregado	transferencia	0
30	2025-08-14 15:23:02	entregado	credito	0
44	2025-08-15 18:58:22	cancelado	debito	3990
44	2025-08-16 18:54:47	entregado	transferencia	3990
11	2025-08-18 12:17:01	entregado	debito	3990
47	2025-08-18 20:27:46	entregado	debito	3990
10	2025-08-18 21:23:35	entregado	transferencia	3990
20	2025-08-19 18:40:24	entregado	credito	3990
10	2025-08-20 16:20:50	entregado	debito	0
26	2025-08-20 21:08:14	entregado	credito	3990
20	2025-08-20 23:57:01	entregado	credito	3990
49	2025-08-22 17:29:01	entregado	debito	3990
33	2025-08-23 14:59:21	entregado	debito	0
10	2025-08-24 19:48:57	entregado	debito	0
46	2025-08-25 15:30:24	entregado	debito	5990
53	2025-08-26 13:02:53	entregado	credito	0
52	2025-09-03 19:05:37	entregado	debito	3990
4	2025-09-05 20:42:08	entregado	debito	0
43	2025-09-11 10:18:07	entregado	credito	0
18	2025-09-12 11:34:11	entregado	credito	0
53	2025-09-12 13:27:32	entregado	debito	0
11	2025-09-13 20:01:44	entregado	debito	3990
20	2025-09-16 09:53:11	entregado	credito	3990
33	2025-09-16 20:53:17	entregado	debito	0
15	2025-09-17 21:59:55	entregado	debito	0
56	2025-09-19 09:48:19	entregado	debito	3990
15	2025-09-20 15:18:45	entregado	credito	0
52	2025-09-20 15:38:46	entregado	debito	0
3	2025-09-21 11:02:29	entregado	debito	0
22	2025-09-22 12:12:56	entregado	credito	5990
47	2025-09-22 20:47:44	entregado	credito	3990
15	2025-09-23 23:55:18	entregado	transferencia	3990
43	2025-09-25 09:53:43	entregado	debito	0
10	2025-09-26 09:21:37	entregado	credito	0
53	2025-09-26 19:20:11	entregado	transferencia	0
17	2025-09-29 15:00:25	entregado	debito	0
44	2025-10-02 20:52:07	entregado	debito	0
56	2025-10-04 09:36:20	entregado	credito	3990
12	2025-10-04 20:01:39	entregado	debito	0
11	2025-10-05 17:25:10	entregado	transferencia	0
9	2025-10-06 15:59:53	entregado	debito	0
14	2025-10-09 11:31:23	entregado	credito	3990
14	2025-10-10 18:35:27	entregado	debito	3990
17	2025-10-11 13:04:58	entregado	debito	0
44	2025-10-11 17:46:25	entregado	credito	0
44	2025-10-11 21:06:29	entregado	transferencia	0
33	2025-10-12 21:08:30	entregado	debito	5990
2	2025-10-13 14:49:16	entregado	debito	0
17	2025-10-14 12:58:05	entregado	debito	0
2	2025-10-22 20:19:21	entregado	credito	5990
20	2025-10-23 22:42:51	entregado	debito	3990
43	2025-10-27 10:28:41	entregado	debito	0
13	2025-10-28 11:32:20	cancelado	credito	0
44	2025-10-29 11:47:51	entregado	debito	3990
47	2025-10-31 13:33:54	entregado	credito	0
17	2025-11-03 14:58:59	entregado	debito	0
35	2025-11-04 12:47:50	entregado	debito	3990
33	2025-11-07 09:19:49	entregado	transferencia	5990
13	2025-11-11 22:13:22	entregado	debito	0
52	2025-11-13 09:41:40	entregado	debito	3990
11	2025-11-13 21:52:01	entregado	credito	0
44	2025-11-13 22:22:30	entregado	credito	0
2	2025-11-15 12:04:38	entregado	credito	5990
12	2025-11-15 13:09:08	entregado	transferencia	0
43	2025-11-16 11:21:16	entregado	credito	3990
26	2025-11-17 12:23:10	entregado	credito	3990
33	2025-11-22 21:37:58	entregado	debito	0
29	2025-11-23 13:54:40	cancelado	debito	0
58	2025-11-24 10:25:16	entregado	debito	0
58	2025-11-25 11:06:31	entregado	transferencia	0
50	2025-11-26 17:56:44	entregado	credito	0
40	2025-11-26 20:52:24	entregado	credito	0
50	2025-11-27 14:39:13	cancelado	debito	0
50	2025-12-01 18:29:21	entregado	credito	3990
14	2025-12-01 21:00:28	entregado	debito	0
4	2025-12-03 16:51:24	entregado	transferencia	3990
50	2025-12-04 19:20:41	entregado	debito	0
10	2025-12-04 20:24:04	entregado	credito	3990
56	2025-12-04 22:42:52	entregado	debito	3990
31	2025-12-05 10:12:39	entregado	transferencia	0
50	2025-12-05 18:55:47	entregado	transferencia	3990
22	2025-12-06 11:04:30	entregado	credito	0
58	2025-12-06 12:14:36	entregado	transferencia	3990
58	2025-12-06 16:31:06	entregado	debito	3990
49	2025-12-06 19:01:48	entregado	credito	0
47	2025-12-06 20:39:07	entregado	credito	3990
29	2025-12-08 19:19:29	entregado	debito	3990
58	2025-12-09 16:06:50	entregado	debito	0
33	2025-12-10 20:35:27	cancelado	credito	5990
53	2025-12-12 20:00:51	entregado	debito	5990
50	2025-12-13 13:15:27	entregado	credito	0
29	2025-12-13 22:10:52	entregado	debito	0
16	2025-12-14 13:37:03	entregado	credito	3990
31	2025-12-14 21:10:57	entregado	credito	3990
2	2025-12-15 19:35:48	entregado	credito	5990
44	2025-12-17 13:15:41	entregado	debito	3990
29	2025-12-17 13:51:57	entregado	transferencia	0
44	2025-12-17 15:58:09	entregado	debito	0
8	2025-12-18 18:11:47	entregado	debito	5990
50	2025-12-19 10:40:12	entregado	credito	0
59	2025-12-20 11:11:03	entregado	credito	0
8	2025-12-20 20:13:34	entregado	debito	5990
11	2025-12-20 20:35:00	cancelado	debito	3990
26	2025-12-21 12:13:34	entregado	debito	0
29	2025-12-21 13:01:08	entregado	credito	3990
17	2025-12-21 13:26:42	entregado	credito	5990
30	2025-12-21 19:19:51	entregado	debito	5990
50	2025-12-25 21:39:24	entregado	credito	3990
50	2025-12-26 13:34:10	entregado	credito	3990
22	2025-12-27 11:08:38	entregado	debito	5990
8	2025-12-27 20:50:34	cancelado	transferencia	5990
49	2025-12-30 19:24:28	entregado	debito	0
8	2025-12-30 21:39:45	entregado	credito	5990
16	2025-12-31 22:10:49	entregado	debito	3990
8	2026-01-01 22:27:09	entregado	transferencia	5990
1	2026-01-02 12:46:53	entregado	credito	3990
3	2026-01-03 20:15:30	entregado	debito	0
40	2026-01-05 12:10:28	entregado	credito	5990
35	2026-01-07 12:00:46	entregado	debito	3990
29	2026-01-08 17:36:52	entregado	credito	0
8	2026-01-08 19:56:46	entregado	credito	0
57	2026-01-11 12:20:27	entregado	credito	3990
17	2026-01-11 18:03:13	entregado	transferencia	5990
33	2026-01-11 19:29:13	entregado	credito	5990
8	2026-01-12 12:18:28	entregado	debito	5990
49	2026-01-12 19:43:43	cancelado	debito	3990
10	2026-01-13 22:40:38	entregado	credito	0
14	2026-01-14 18:15:07	entregado	debito	0
52	2026-01-15 19:50:00	entregado	debito	0
10	2026-01-16 12:33:29	entregado	debito	3990
11	2026-01-19 17:01:40	entregado	credito	3990
6	2026-01-20 12:21:13	entregado	transferencia	5990
58	2026-01-24 20:51:10	entregado	debito	3990
9	2026-01-25 20:07:59	entregado	credito	3990
40	2026-01-26 18:38:16	entregado	debito	5990
50	2026-01-26 22:56:57	entregado	debito	0
40	2026-01-27 19:31:35	entregado	transferencia	0
47	2026-01-29 22:44:14	entregado	transferencia	3990
35	2026-01-30 10:04:12	entregado	credito	3990
10	2026-01-31 11:27:52	entregado	debito	3990
40	2026-02-01 10:54:32	entregado	transferencia	0
22	2026-02-01 15:57:51	entregado	debito	5990
12	2026-02-01 21:31:09	entregado	credito	5990
56	2026-02-04 09:58:51	entregado	debito	0
44	2026-02-04 13:54:12	entregado	debito	3990
44	2026-02-04 13:58:48	entregado	debito	0
13	2026-02-04 15:58:46	entregado	debito	0
2	2026-02-05 12:05:34	entregado	debito	5990
5	2026-02-05 18:33:18	entregado	credito	5990
4	2026-02-07 19:25:51	entregado	debito	0
28	2026-02-09 10:06:51	entregado	debito	3990
1	2026-02-09 19:58:13	entregado	debito	3990
5	2026-02-10 14:14:39	cancelado	debito	0
43	2026-02-10 20:09:24	entregado	credito	3990
5	2026-02-13 19:33:01	entregado	debito	5990
11	2026-02-14 11:00:54	entregado	transferencia	3990
5	2026-02-16 09:38:21	entregado	debito	5990
2	2026-02-18 19:26:15	entregado	debito	0
33	2026-02-19 10:05:21	entregado	credito	0
25	2026-02-19 11:11:13	entregado	debito	0
40	2026-02-19 19:26:40	entregado	transferencia	5990
25	2026-02-21 12:36:02	entregado	debito	3990
38	2026-02-21 15:40:06	entregado	debito	0
5	2026-02-21 22:47:04	entregado	debito	5990
26	2026-02-22 12:32:28	entregado	credito	3990
5	2026-02-23 12:06:37	entregado	debito	5990
38	2026-02-24 21:29:20	entregado	debito	0
44	2026-02-25 19:57:04	entregado	credito	0
53	2026-02-27 10:47:24	entregado	debito	5990
5	2026-02-27 22:54:08	entregado	credito	0
5	2026-02-28 09:05:24	entregado	debito	0
22	2026-02-28 20:08:28	entregado	debito	5990
8	2026-03-01 10:09:29	entregado	debito	5990
47	2026-03-02 16:52:58	entregado	debito	3990
5	2026-03-02 20:11:05	entregado	credito	5990
15	2026-03-02 21:18:27	entregado	debito	0
36	2026-03-03 16:14:39	cancelado	credito	0
53	2026-03-03 19:44:29	entregado	transferencia	0
57	2026-03-03 19:48:00	cancelado	debito	0
8	2026-03-05 11:12:27	entregado	debito	0
12	2026-03-06 10:40:25	entregado	debito	5990
5	2026-03-06 18:57:36	entregado	credito	0
28	2026-03-06 22:36:10	entregado	transferencia	3990
47	2026-03-07 19:59:56	entregado	transferencia	3990
14	2026-03-07 20:40:14	entregado	credito	3990
38	2026-03-08 12:17:38	entregado	credito	3990
46	2026-03-08 20:16:58	entregado	debito	0
16	2026-03-10 23:48:12	entregado	credito	3990
5	2026-03-11 10:32:21	entregado	credito	5990
14	2026-03-11 21:30:06	cancelado	debito	0
2	2026-03-11 21:38:19	entregado	credito	0
17	2026-03-17 11:28:20	entregado	debito	0
51	2026-03-19 18:58:47	entregado	credito	3990
33	2026-03-20 10:30:14	entregado	credito	0
25	2026-03-20 12:48:42	entregado	credito	0
28	2026-03-23 13:13:24	entregado	debito	0
50	2026-03-23 22:25:01	entregado	credito	0
50	2026-03-25 21:25:51	entregado	debito	0
13	2026-03-29 20:53:59	entregado	debito	3990
32	2026-03-31 15:52:27	entregado	debito	0
44	2026-03-31 20:00:24	entregado	transferencia	0
40	2026-03-31 20:45:42	entregado	debito	0
35	2026-04-01 16:05:36	entregado	debito	0
32	2026-04-03 20:47:17	entregado	transferencia	3990
2	2026-04-04 21:44:59	entregado	debito	0
45	2026-04-05 13:11:09	entregado	transferencia	0
46	2026-04-05 20:52:08	entregado	debito	5990
38	2026-04-05 21:32:16	entregado	credito	0
45	2026-04-07 13:20:56	entregado	debito	5990
45	2026-04-07 15:57:59	entregado	transferencia	5990
46	2026-04-07 18:55:07	entregado	credito	0
22	2026-04-08 19:29:58	entregado	credito	5990
45	2026-04-08 21:03:44	entregado	debito	5990
32	2026-04-09 20:14:50	entregado	transferencia	3990
4	2026-04-09 21:41:50	entregado	credito	3990
46	2026-04-13 21:36:03	entregado	credito	0
32	2026-04-14 21:35:45	entregado	credito	3990
31	2026-04-14 21:59:39	entregado	debito	0
59	2026-04-15 09:46:39	entregado	transferencia	3990
59	2026-04-16 13:51:24	entregado	debito	0
45	2026-04-16 14:56:36	cancelado	debito	5990
11	2026-04-17 10:40:29	entregado	debito	3990
59	2026-04-17 16:15:34	entregado	debito	0
32	2026-04-18 10:25:43	entregado	debito	3990
8	2026-04-18 20:40:42	entregado	debito	0
46	2026-04-18 21:45:24	entregado	transferencia	0
44	2026-04-21 10:49:28	entregado	credito	0
45	2026-04-21 20:44:10	cancelado	debito	5990
45	2026-04-22 19:18:57	entregado	debito	0
32	2026-04-22 21:52:22	entregado	debito	3990
32	2026-04-23 16:22:37	entregado	transferencia	0
14	2026-04-24 19:03:44	entregado	transferencia	3990
45	2026-04-25 23:57:38	entregado	debito	0
45	2026-04-26 10:19:39	cancelado	debito	5990
32	2026-04-27 09:14:50	cancelado	debito	0
45	2026-04-28 09:42:53	entregado	transferencia	5990
29	2026-04-29 10:54:27	entregado	debito	3990
52	2026-05-02 10:54:22	entregado	credito	3990
2	2026-05-02 18:18:40	entregado	debito	5990
59	2026-05-02 20:33:00	entregado	credito	0
1	2026-05-04 11:38:58	cancelado	debito	3990
11	2026-05-05 10:10:37	entregado	debito	3990
21	2026-05-05 18:02:21	entregado	credito	0
50	2026-05-08 09:58:09	entregado	debito	3990
33	2026-05-10 22:38:49	entregado	debito	0
50	2026-05-11 18:29:21	entregado	debito	3990
4	2026-05-12 12:29:06	entregado	debito	0
52	2026-05-12 21:42:49	entregado	debito	3990
13	2026-05-14 12:33:23	entregado	credito	0
29	2026-05-14 13:11:23	cancelado	credito	3990
11	2026-05-14 17:24:25	entregado	credito	3990
44	2026-05-16 13:55:23	entregado	debito	3990
9	2026-05-16 18:02:46	entregado	credito	3990
38	2026-05-19 16:50:48	entregado	debito	3990
26	2026-05-20 20:26:59	entregado	transferencia	3990
44	2026-05-21 16:11:13	entregado	transferencia	0
35	2026-05-22 17:05:36	entregado	debito	3990
32	2026-05-22 23:14:18	entregado	debito	0
33	2026-05-23 11:53:28	entregado	transferencia	5990
28	2026-05-23 19:58:46	entregado	debito	3990
29	2026-05-24 13:56:51	entregado	debito	3990
25	2026-05-26 21:01:07	entregado	credito	0
24	2026-05-29 13:17:01	cancelado	debito	0
17	2026-05-30 17:26:37	entregado	credito	5990
4	2026-05-31 13:11:47	entregado	transferencia	0
51	2026-05-31 22:21:53	entregado	credito	3990
33	2026-06-02 23:01:19	entregado	transferencia	0
21	2026-06-03 13:16:31	entregado	credito	3990
36	2026-06-03 22:32:56	entregado	credito	3990
44	2026-06-04 17:41:55	entregado	debito	3990
4	2026-06-04 21:13:06	entregado	credito	0
52	2026-06-05 10:16:45	entregado	debito	3990
42	2026-06-05 10:37:13	entregado	credito	0
50	2026-06-09 21:44:42	entregado	debito	0
21	2026-06-10 11:42:34	entregado	debito	3990
25	2026-06-10 17:30:42	entregado	transferencia	0
10	2026-06-10 18:28:49	entregado	debito	0
8	2026-06-11 21:43:16	entregado	debito	5990
5	2026-06-12 21:17:28	entregado	debito	0
1	2026-06-13 16:21:07	entregado	debito	0
26	2026-06-14 20:32:51	entregado	transferencia	0
33	2026-06-15 15:29:55	entregado	debito	5990
57	2026-06-17 19:41:11	entregado	credito	0
43	2026-06-17 23:35:22	entregado	debito	3990
33	2026-06-20 21:52:12	pendiente	\N	0
56	2026-06-21 13:01:32	enviado	debito	3990
45	2026-06-21 13:29:50	pagado	debito	5990
38	2026-06-21 18:21:44	enviado	debito	3990
49	2026-06-25 13:36:54	pendiente	\N	3990
26	2026-06-25 17:22:27	pagado	credito	0
58	2026-06-28 20:41:53	pendiente	\N	3990
\.

COPY pedido_items (pedido_id, producto_id, cantidad, precio_unitario) FROM stdin;
1	12	1	23740
1	29	1	12990
2	44	1	5690
2	49	1	11990
3	3	1	49990
3	23	1	19990
3	38	2	8990
4	42	2	19990
4	46	1	3490
5	43	2	9990
6	18	2	18990
7	46	2	3490
8	9	2	34990
8	16	1	31340
8	43	1	9990
9	9	1	34990
9	25	2	9990
10	37	2	14990
10	48	1	2840
11	45	1	6990
11	48	2	2840
12	12	1	23740
12	33	1	59990
12	48	1	2840
13	7	1	39990
13	11	1	19990
13	24	1	12340
13	42	1	19990
14	13	1	6990
14	16	1	31340
14	36	1	15190
15	12	1	23740
15	39	1	12990
16	47	1	8990
17	24	1	12340
17	31	1	49990
18	13	1	6990
19	44	1	5690
20	29	1	12990
20	37	1	14990
20	44	1	5690
20	48	2	2840
21	23	1	19990
21	45	1	6990
22	11	1	19990
22	43	2	9990
23	31	1	49990
23	37	1	14990
24	35	1	13990
24	36	1	15190
24	39	2	12990
25	9	1	34990
25	34	1	16990
25	38	3	8990
25	47	1	8990
26	12	1	23740
26	25	1	9990
26	35	1	13990
27	43	3	9990
28	31	2	49990
28	36	1	15190
28	43	1	9990
29	13	1	6990
30	29	2	12990
31	4	1	14240
31	7	1	39990
31	41	1	7990
31	47	3	8990
32	17	1	21990
32	18	2	18990
33	6	1	29990
33	9	1	34990
33	49	1	11990
34	44	1	5690
34	49	2	11990
35	39	3	12990
35	48	1	2840
36	48	3	2840
37	4	1	14240
38	24	1	12340
39	4	1	14240
39	5	1	69990
40	32	1	85490
40	40	3	23740
41	39	1	12990
42	4	1	14240
42	44	1	5690
43	29	1	12990
43	36	1	15190
44	40	3	23740
45	18	1	18990
45	36	1	15190
46	46	1	3490
47	6	1	29990
48	5	1	69990
48	19	2	24990
48	36	1	15190
48	47	1	8990
49	6	1	29990
49	31	1	49990
50	4	1	14240
50	41	1	7990
51	2	1	129990
51	23	1	19990
52	46	3	3490
53	8	2	142490
53	9	1	34990
53	32	1	85490
53	42	3	19990
54	16	1	31340
55	48	2	2840
56	25	1	9990
56	47	1	8990
56	48	3	2840
57	25	1	9990
58	4	1	14240
58	16	1	31340
59	2	1	129990
59	43	2	9990
59	47	2	8990
59	48	2	2840
60	44	1	5690
61	38	1	8990
62	46	2	3490
63	8	1	142490
63	39	1	12990
63	43	1	9990
64	29	1	12990
64	39	2	12990
65	38	3	8990
65	45	1	6990
66	18	1	18990
67	3	1	49990
67	44	1	5690
67	45	1	6990
67	48	1	2840
68	2	1	129990
68	36	1	15190
69	9	1	34990
69	12	1	23740
69	38	1	8990
70	2	1	129990
70	39	1	12990
71	7	1	39990
71	46	2	3490
71	48	1	2840
72	31	1	49990
73	7	1	39990
74	34	1	16990
75	1	1	549990
75	11	1	19990
76	2	1	129990
76	7	1	39990
77	24	1	12340
78	10	1	59990
78	20	1	37990
78	39	1	12990
79	11	1	19990
80	12	1	23740
80	19	1	24990
81	45	1	6990
82	11	1	19990
82	24	1	12340
82	34	1	16990
82	44	1	5690
83	14	2	27990
83	18	2	18990
83	42	1	19990
84	7	1	39990
84	8	1	142490
84	36	2	15190
85	35	1	13990
85	47	1	8990
86	28	1	28490
87	5	1	69990
88	32	1	85490
89	30	1	19990
89	45	1	6990
90	29	1	12990
91	29	1	12990
91	49	2	11990
92	4	1	14240
92	14	1	27990
93	43	1	9990
94	36	1	15190
94	43	2	9990
95	45	1	6990
96	9	2	34990
96	47	1	8990
97	36	2	15190
98	42	2	19990
99	9	1	34990
99	32	2	85490
99	33	1	59990
100	20	2	37990
100	43	2	9990
101	2	1	129990
101	12	1	23740
102	23	1	19990
103	41	1	7990
104	6	1	29990
104	7	1	39990
105	14	1	27990
105	21	1	29990
105	39	1	12990
105	45	1	6990
106	43	1	9990
106	47	1	8990
106	48	1	2990
107	29	1	12990
108	13	1	6990
108	42	2	19990
108	45	1	6990
109	39	2	12990
110	20	1	39990
110	42	2	19990
111	6	1	29990
112	36	2	15990
113	9	2	34990
113	13	1	6990
113	40	3	24990
114	30	1	19990
115	33	1	59990
116	6	1	29990
116	42	2	19990
116	46	2	3490
117	47	3	8990
118	19	1	24990
118	49	1	11990
119	7	2	39990
120	29	1	12990
121	6	1	29990
122	17	1	21990
122	42	2	19990
122	45	1	6990
123	47	2	8990
124	10	1	59990
124	45	2	6990
125	36	1	15990
126	9	1	34990
126	17	1	21990
127	20	1	39990
127	47	1	8990
128	37	1	14990
128	47	2	8990
129	49	3	11990
130	17	1	21990
130	20	1	39990
131	1	1	549990
131	11	1	19990
131	44	1	5990
132	7	1	39990
132	43	1	9990
133	40	1	24990
134	45	3	6990
135	44	2	5990
136	46	2	3490
137	17	1	21990
137	38	1	8990
138	5	1	69990
138	28	1	29990
138	40	2	24990
138	47	1	8990
139	39	2	12990
140	38	2	8990
141	21	1	29990
142	6	1	29990
142	18	1	18990
142	30	2	19990
143	8	1	149990
144	24	1	12990
145	33	1	59990
145	37	1	14990
145	42	1	19990
146	43	2	9990
147	10	1	59990
147	23	1	19990
147	41	2	7990
148	8	1	149990
148	43	1	9990
148	45	1	6990
149	8	2	149990
149	36	1	15990
149	39	1	12990
150	2	1	129990
150	43	1	9990
151	24	1	12990
151	41	2	7990
151	44	1	5990
152	30	1	19990
153	18	1	18990
153	31	1	49990
154	2	1	129990
154	37	2	14990
154	42	3	19990
154	44	2	5990
155	36	1	15990
156	12	1	24990
156	33	1	59990
157	21	1	29990
157	33	1	59990
158	21	1	29990
158	42	1	19990
158	43	2	9990
159	43	1	9990
160	48	3	2990
161	23	1	19990
162	9	1	34990
162	16	1	32990
162	17	1	21990
162	42	2	19990
163	8	2	149990
163	43	2	9990
163	48	1	2990
164	7	1	39990
164	21	1	29990
165	9	1	34990
165	13	1	6990
165	43	2	9990
166	6	1	29990
166	19	1	24990
166	36	1	15990
166	43	1	9990
167	45	1	6990
168	1	2	549990
168	39	3	12990
168	41	1	7990
169	27	1	349990
169	35	1	13990
170	32	1	89990
170	46	2	3490
171	6	1	29990
171	48	1	2990
172	7	1	39990
173	33	1	59990
173	39	1	12990
174	23	1	19990
174	31	1	49990
175	2	1	129990
175	37	2	14990
176	23	1	19990
176	44	1	5990
177	11	2	19990
177	19	1	24990
178	7	2	39990
179	35	1	13990
180	23	1	19990
181	6	1	29990
181	19	2	24990
181	37	1	14990
181	49	3	11990
182	10	2	59990
182	19	1	24990
182	21	1	29990
183	7	1	39990
184	8	1	149990
184	21	1	29990
184	36	1	15990
185	1	1	549990
186	23	1	19990
187	21	1	29990
187	37	1	14990
188	28	2	29990
188	37	2	14990
188	38	3	8990
188	40	1	24990
189	18	1	18990
189	35	1	13990
189	38	1	8990
189	41	1	7990
190	32	1	89990
191	5	1	69990
191	36	1	15990
191	44	1	5990
192	42	2	19990
193	2	1	129990
193	42	2	19990
194	14	1	27990
194	43	1	9990
195	48	1	2990
196	14	1	27990
196	37	1	14990
196	41	1	7990
196	45	2	6990
197	18	1	18990
197	19	1	24990
197	27	1	349990
198	8	1	149990
198	10	1	59990
198	44	2	5990
198	46	2	3490
199	34	1	16990
199	41	2	7990
199	42	2	19990
200	10	1	59990
201	11	1	19990
201	28	2	29990
201	48	1	2990
201	49	1	11990
202	28	1	29990
202	32	1	89990
202	39	3	12990
202	41	1	7990
203	42	1	19990
204	7	1	39990
204	20	1	39990
205	38	2	8990
206	20	1	39990
206	32	1	89990
206	33	1	59990
206	42	1	19990
207	30	1	19990
207	39	1	12990
208	31	1	49990
209	33	1	59990
209	47	1	8990
210	41	1	7990
210	47	2	8990
211	2	2	129990
212	9	1	34990
213	36	2	15990
214	13	1	6990
214	20	2	39990
214	46	2	3490
214	47	2	8990
215	46	1	3490
216	45	1	6990
217	3	1	49990
217	12	1	24990
217	13	2	6990
218	47	1	8990
219	12	1	24990
219	37	1	14990
219	48	3	2990
220	6	1	29990
220	16	1	32990
220	33	1	59990
221	30	1	19990
221	42	2	19990
221	44	2	5990
221	46	2	3490
222	31	1	49990
223	12	1	24990
224	14	1	27990
224	47	2	8990
225	36	1	15990
226	6	1	29990
226	12	1	24990
226	32	1	89990
227	25	2	9990
227	34	1	16990
227	37	2	14990
228	21	1	29990
229	33	1	59990
230	12	2	24990
230	41	1	7990
231	47	3	8990
232	13	1	6990
232	39	1	12990
232	41	2	7990
233	25	1	9990
233	28	1	29990
233	29	1	12990
233	48	2	2990
234	39	1	12990
235	38	1	8990
236	38	1	8990
236	48	1	2990
237	37	1	14990
238	3	1	49990
239	20	1	39990
240	16	1	32990
240	49	1	11990
241	16	1	32990
241	17	1	21990
242	43	1	9990
243	12	1	24990
243	41	1	7990
244	37	2	14990
245	39	2	12990
245	45	1	6990
246	20	1	39990
246	49	1	11990
247	24	2	12990
247	44	2	5990
248	39	1	12990
249	34	1	16990
249	37	1	14990
249	39	2	12990
250	2	1	129990
250	35	1	13990
250	37	2	14990
250	46	2	3490
251	24	1	12990
252	45	3	6990
252	48	1	2990
253	7	1	39990
254	38	1	8990
255	25	1	9990
255	36	1	15990
256	14	1	27990
256	40	2	24990
256	44	2	5990
256	47	2	8990
257	20	2	39990
257	27	1	349990
258	7	1	39990
258	14	1	27990
258	41	2	7990
258	47	2	8990
259	16	1	32990
259	39	1	12990
260	24	2	12990
261	44	2	5990
262	44	3	5990
262	48	2	2990
263	48	3	2990
264	13	1	6990
264	37	1	14990
265	16	1	32990
265	25	1	9990
265	35	1	13990
266	6	1	29990
266	36	2	15990
267	36	1	15990
268	21	1	29990
269	45	3	6990
270	7	1	39990
270	30	1	19990
271	11	1	19990
271	45	2	6990
272	9	1	34990
273	12	1	24990
273	30	1	19990
273	41	1	7990
274	28	1	29990
275	3	1	49990
275	35	1	13990
275	41	1	7990
276	10	1	59990
276	36	2	15990
276	39	2	12990
276	43	1	9990
277	16	1	32990
278	17	1	21990
278	48	2	2990
279	11	1	19990
279	33	1	59990
279	36	1	15990
280	40	2	24990
281	11	1	19990
281	45	2	6990
282	2	1	129990
282	20	1	39990
283	45	2	6990
284	19	1	24990
284	25	1	9990
285	46	1	3490
285	47	2	8990
286	4	1	14990
286	25	1	9990
287	12	1	24990
287	17	1	21990
287	29	1	12990
287	36	1	15990
288	4	1	14990
288	32	2	89990
288	38	1	8990
288	39	2	12990
289	8	1	149990
289	38	1	8990
289	42	1	19990
290	49	1	11990
291	48	1	2990
292	2	1	129990
292	3	1	49990
292	36	3	15990
292	46	1	3490
293	12	1	24990
293	48	1	2990
294	25	1	9990
295	45	1	6990
296	3	1	49990
296	33	1	59990
296	39	1	12990
296	40	2	24990
297	10	1	59990
297	38	2	8990
298	38	3	8990
298	45	1	6990
299	10	1	59990
299	13	1	6990
299	48	2	2990
300	3	2	49990
300	8	1	149990
300	49	1	11990
301	14	1	27990
302	23	1	19990
303	12	1	24990
304	11	1	19990
305	4	1	14990
305	29	1	12990
305	49	3	11990
306	12	2	24990
306	27	1	349990
306	32	1	89990
307	8	1	149990
308	5	1	69990
308	34	1	16990
308	45	2	6990
309	6	2	29990
310	25	1	9990
310	47	3	8990
311	2	1	129990
312	9	1	34990
313	42	2	19990
313	48	1	2990
314	37	1	14990
315	20	1	39990
316	9	1	34990
316	19	1	24990
317	39	1	12990
318	4	1	14990
318	9	1	34990
319	8	1	149990
319	14	1	27990
319	41	2	7990
320	18	2	18990
320	23	1	19990
320	46	1	3490
321	21	1	29990
321	40	2	24990
321	43	3	9990
322	4	1	14990
322	49	1	11990
323	24	1	12990
323	42	2	19990
323	48	2	2990
324	30	1	19990
324	37	1	14990
324	40	2	24990
325	36	1	15990
325	40	2	24990
326	33	1	59990
327	4	1	14990
327	5	1	69990
327	16	1	32990
327	33	2	59990
328	14	1	27990
329	11	2	19990
329	31	1	49990
329	46	2	3490
330	11	1	19990
330	42	1	19990
330	46	3	3490
330	47	3	8990
331	39	1	12990
331	40	2	24990
331	47	1	8990
332	27	1	349990
333	14	1	27990
333	44	1	5990
334	5	1	69990
335	10	1	59990
335	48	1	2990
336	6	1	29990
336	39	1	12990
337	8	1	149990
338	23	1	19990
338	49	1	11990
339	41	1	7990
340	3	1	49990
340	36	3	15990
340	46	1	3490
341	37	1	14990
342	14	1	27990
342	41	2	7990
343	14	1	27990
343	25	1	9990
344	12	1	24990
345	32	1	89990
345	35	1	13990
346	23	1	19990
347	31	1	49990
347	40	1	24990
347	46	1	3490
348	11	1	19990
348	17	1	21990
349	7	2	39990
349	42	1	19990
350	29	1	12990
351	29	1	12990
351	42	1	19990
352	36	3	15990
352	47	1	8990
353	36	1	15990
353	49	2	11990
354	6	1	29990
354	31	1	49990
355	16	1	32990
355	33	1	59990
356	23	1	19990
356	37	1	14990
356	40	2	24990
356	42	1	19990
357	42	1	19990
358	40	1	24990
358	42	2	19990
359	35	2	13990
360	2	1	129990
360	28	1	29990
361	21	1	29990
362	38	1	8990
362	40	2	24990
362	47	1	8990
363	24	1	12990
363	46	2	3490
364	31	1	49990
364	46	3	3490
365	12	1	24990
365	42	1	19990
366	19	1	24990
366	43	1	9990
367	23	1	19990
368	17	1	21990
369	14	1	27990
369	40	1	24990
370	21	1	29990
371	4	1	14990
371	29	1	12990
372	25	1	9990
372	36	2	15990
372	43	1	9990
372	45	2	6990
373	43	2	9990
374	7	1	39990
374	9	1	34990
375	48	1	2990
376	7	1	39990
376	13	1	6990
376	46	2	3490
377	13	1	6990
377	16	1	32990
377	44	1	5990
377	46	1	3490
378	28	1	29990
378	30	1	19990
378	36	3	15990
379	39	1	12990
380	42	1	19990
381	19	1	24990
382	45	1	6990
383	35	1	13990
384	25	2	9990
384	44	3	5990
385	28	1	29990
385	33	1	59990
386	41	2	7990
387	3	1	49990
387	19	1	24990
388	46	1	3490
389	4	1	14990
390	43	1	9990
390	47	1	8990
391	4	1	14990
391	14	1	27990
391	37	2	14990
391	40	1	24990
392	6	2	29990
392	23	1	19990
392	33	1	59990
392	48	2	2990
393	11	1	19990
394	8	1	149990
394	24	1	12990
395	34	1	16990
396	5	1	69990
396	45	2	6990
397	12	1	24990
398	28	1	29990
399	24	1	12990
399	36	2	15990
400	7	1	39990
400	40	2	24990
400	41	2	7990
401	25	2	9990
401	28	1	29990
402	10	1	59990
403	14	2	27990
404	37	1	14990
405	1	1	549990
405	28	2	29990
405	34	1	16990
406	9	2	34990
406	12	1	24990
407	41	1	7990
407	48	1	2990
408	14	1	27990
408	34	2	16990
409	10	1	59990
410	8	1	149990
411	25	2	9990
412	5	1	69990
413	9	1	34990
413	44	2	5990
414	9	1	34990
414	33	1	59990
414	47	2	8990
415	44	1	5990
416	7	1	39990
416	25	1	9990
417	36	2	15990
418	42	2	19990
419	5	1	69990
419	25	1	9990
419	29	1	12990
420	13	1	6990
420	36	2	15990
\.

COPY resenas (producto_id, cliente_id, nota, comentario, fecha) FROM stdin;
44	40	4	El mejor café que he probado en grano.	2025-01-30
47	40	2	\N	2025-02-26
36	49	1	No funcionó como esperaba; lo devolví.	2025-03-04
44	35	5	Aroma intenso y sabor equilibrado.	2025-03-04
42	20	1	Demasiado caro para lo que es.	2025-03-05
38	20	2	No lo recomiendo.	2025-03-07
13	52	5	La batería dura menos de lo que dice la ficha.	2025-03-10
25	59	5	Muy bonito, se ve tal cual la foto.	2025-03-10
43	53	4	El mejor café que he probado en grano.	2025-03-10
13	15	4	Funciona perfecto, muy recomendable.	2025-03-22
17	4	4	Cumple, aunque es más pequeño de lo que pensaba.	2025-03-23
35	59	5	Perfecto para salir a pedalear por la ciudad.	2025-03-27
31	16	4	La talla es más chica de lo normal.	2025-04-06
39	37	4	Llegó impecable.	2025-04-14
36	28	3	Edición cuidada, buena tipografía.	2025-04-16
29	53	4	\N	2025-04-19
16	27	4	\N	2025-04-20
5	22	5	Rápido y silencioso, ideal para trabajar.	2025-04-21
18	28	3	Excelente para la cocina del día a día.	2025-05-03
40	12	5	Llegó impecable.	2025-05-03
48	22	4	Demasiado amargo para mi gusto.	2025-05-03
6	22	5	Buen producto por el precio.	2025-05-07
44	4	5	Aroma intenso y sabor equilibrado.	2025-05-17
47	1	5	Llegó bien envasado.	2025-05-17
46	1	4	Aroma intenso y sabor equilibrado.	2025-05-18
48	4	4	Muy rico, lo vuelvo a comprar.	2025-05-21
31	52	5	Aguantó lluvia y viento en Torres del Paine.	2025-05-27
7	25	4	No funcionó como esperaba; lo devolví.	2025-05-30
2	37	5	El sonido es muy bueno y la conexión Bluetooth es estable.	2025-06-04
11	44	5	\N	2025-06-15
34	33	5	Muy cómoda y resistente para el trekking.	2025-06-16
28	56	3	Perfecto para salir a pedalear por la ciudad.	2025-06-19
43	59	4	Demasiado amargo para mi gusto.	2025-06-20
43	44	2	Demasiado caro para lo que es.	2025-06-23
24	59	3	Muy bonito, se ve tal cual la foto.	2025-06-26
7	44	3	Buen producto por el precio.	2025-07-11
36	15	3	Edición cuidada, buena tipografía.	2025-07-11
29	59	4	La talla es más chica de lo normal.	2025-07-13
32	47	5	Buena relación precio calidad.	2025-07-16
45	37	5	Aroma intenso y sabor equilibrado.	2025-07-18
33	33	1	\N	2025-07-24
41	11	5	Muy buena traducción de los ejemplos, aunque le faltan ejercicios.	2025-07-26
29	25	4	Aguantó lluvia y viento en Torres del Paine.	2025-08-01
17	13	4	Buena calidad de materiales.	2025-08-05
43	11	5	Llegó bien envasado.	2025-08-05
6	44	4	Buen producto por el precio.	2025-08-10
7	28	4	No funcionó como esperaba; lo devolví.	2025-08-16
44	30	5	Llegó bien envasado.	2025-08-21
1	30	5	El sonido es muy bueno y la conexión Bluetooth es estable.	2025-08-25
45	13	4	Muy rico, lo vuelvo a comprar.	2025-08-27
40	44	3	\N	2025-09-01
20	21	4	Se rayó a la semana de uso, no lo recomiendo.	2025-09-02
6	33	5	El sonido es muy bueno y la conexión Bluetooth es estable.	2025-09-03
49	30	5	Demasiado amargo para mi gusto.	2025-09-04
17	21	2	\N	2025-09-05
43	52	4	Llegó bien envasado.	2025-09-08
5	10	4	No funcionó como esperaba; lo devolví.	2025-09-13
43	43	3	El mejor café que he probado en grano.	2025-09-16
40	10	4	Muy buena traducción de los ejemplos, aunque le faltan ejercicios.	2025-09-22
36	18	5	Edición cuidada, buena tipografía.	2025-09-27
21	53	4	Se rayó a la semana de uso, no lo recomiendo.	2025-10-05
36	56	5	Un clásico que hay que leer.	2025-10-07
42	43	4	El mejor café que he probado en grano.	2025-10-16
11	2	4	Llegó con la caja dañada, pero el producto funciona bien.	2025-10-17
43	22	5	Llegó bien envasado.	2025-10-19
23	15	5	Muy bonito, se ve tal cual la foto.	2025-10-22
27	11	2	No funcionó como esperaba; lo devolví.	2025-10-28
33	52	4	Muy cómoda y resistente para el trekking.	2025-10-28
7	14	4	No funcionó como esperaba; lo devolví.	2025-11-19
34	58	3	\N	2025-12-02
2	12	5	Rápido y silencioso, ideal para trabajar.	2025-12-03
42	50	4	El mejor café que he probado en grano.	2025-12-12
45	33	3	Demasiado amargo para mi gusto.	2025-12-13
44	29	4	El mejor café que he probado en grano.	2025-12-17
46	47	4	Demasiado amargo para mi gusto.	2025-12-19
47	49	4	Muy rico, lo vuelvo a comprar.	2025-12-19
5	44	5	No funcionó como esperaba; lo devolví.	2025-12-22
41	59	5	Muy buena traducción de los ejemplos, aunque le faltan ejercicios.	2025-12-26
41	50	5	Un clásico que hay que leer.	2025-12-26
10	50	2	No lo recomiendo.	2025-12-27
45	29	5	El mejor café que he probado en grano.	2025-12-29
32	29	4	Aguantó lluvia y viento en Torres del Paine.	2025-12-30
20	49	1	Mala calidad, se rompió pronto.	2025-12-31
47	50	3	Llegó bien envasado.	2026-01-03
37	8	1	No lo recomiendo.	2026-01-04
9	58	4	No funcionó como esperaba; lo devolví.	2026-01-09
17	49	5	Muy bonito, se ve tal cual la foto.	2026-01-14
36	44	5	Llegó impecable.	2026-01-16
39	35	3	Edición cuidada, buena tipografía.	2026-01-17
35	8	5	\N	2026-01-25
21	8	4	Buena calidad de materiales.	2026-01-26
34	29	4	\N	2026-01-27
3	50	2	Demasiado caro para lo que es.	2026-01-28
24	11	3	Se rayó a la semana de uso, no lo recomiendo.	2026-01-29
38	8	3	\N	2026-01-29
43	8	5	Aroma intenso y sabor equilibrado.	2026-02-04
39	10	5	Llegó impecable.	2026-02-07
45	17	5	Muy rico, lo vuelvo a comprar.	2026-02-08
27	14	5	La talla es más chica de lo normal.	2026-02-11
16	10	1	\N	2026-02-13
36	40	4	\N	2026-02-13
30	40	5	Aguantó lluvia y viento en Torres del Paine.	2026-02-14
7	33	5	La batería dura menos de lo que dice la ficha.	2026-02-15
8	25	5	La batería dura menos de lo que dice la ficha.	2026-02-24
44	58	5	Llegó bien envasado.	2026-02-26
39	33	2	Mala calidad, se rompió pronto.	2026-03-02
45	5	4	Demasiado amargo para mi gusto.	2026-03-04
11	1	2	No lo recomiendo.	2026-03-06
14	22	2	No funcionó como esperaba; lo devolví.	2026-03-07
47	11	5	Muy rico, lo vuelvo a comprar.	2026-03-09
45	43	5	Llegó bien envasado.	2026-03-13
9	28	3	Rápido y silencioso, ideal para trabajar.	2026-03-16
48	47	4	Demasiado amargo para mi gusto.	2026-03-16
29	2	5	Aguantó lluvia y viento en Torres del Paine.	2026-03-23
49	15	3	El mejor café que he probado en grano.	2026-03-26
42	47	4	Demasiado amargo para mi gusto.	2026-03-27
2	5	4	Rápido y silencioso, ideal para trabajar.	2026-03-29
43	17	2	No lo recomiendo.	2026-03-30
33	50	4	Buena relación precio calidad.	2026-04-03
23	8	3	Muy bonito, se ve tal cual la foto.	2026-04-07
5	2	4	Llegó con la caja dañada, pero el producto funciona bien.	2026-04-09
37	14	4	Edición cuidada, buena tipografía.	2026-04-10
11	32	4	Buen producto por el precio.	2026-04-20
39	40	3	Muy buena traducción de los ejemplos, aunque le faltan ejercicios.	2026-04-20
7	59	1	Demasiado caro para lo que es.	2026-04-23
14	13	5	No funcionó como esperaba; lo devolví.	2026-04-26
40	45	2	No funcionó como esperaba; lo devolví.	2026-04-28
23	32	4	Excelente para la cocina del día a día.	2026-05-03
16	46	3	Buen producto por el precio.	2026-05-04
19	29	5	Cumple, aunque es más pequeño de lo que pensaba.	2026-05-05
43	29	5	Demasiado amargo para mi gusto.	2026-05-05
35	46	1	Demasiado caro para lo que es.	2026-05-11
31	8	5	La talla es más chica de lo normal.	2026-05-13
25	32	5	Excelente para la cocina del día a día.	2026-05-16
40	59	5	Edición cuidada, buena tipografía.	2026-05-20
17	2	4	\N	2026-05-27
48	50	4	Aroma intenso y sabor equilibrado.	2026-05-29
40	25	4	Un clásico que hay que leer.	2026-06-01
9	33	4	\N	2026-06-03
43	50	4	El mejor café que he probado en grano.	2026-06-09
45	9	3	Aroma intenso y sabor equilibrado.	2026-06-10
34	51	4	Aguantó lluvia y viento en Torres del Paine.	2026-06-11
7	4	5	Llegó con la caja dañada, pero el producto funciona bien.	2026-06-16
14	5	5	Rápido y silencioso, ideal para trabajar.	2026-06-20
14	50	4	La batería dura menos de lo que dice la ficha.	2026-06-25
28	52	4	Muy cómoda y resistente para el trekking.	2026-06-27
8	26	5	Llegó con la caja dañada, pero el producto funciona bien.	2026-07-05
10	42	4	Excelente calidad, llegó antes de lo esperado.	2026-07-12
28	25	2	\N	2026-07-14
37	21	1	No lo recomiendo.	2026-07-20
\.
