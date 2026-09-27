// Genera los conjuntos de datos del curso de PostgreSQL (public/pg/datasets/*.sql).
// Deterministas (generador pseudoaleatorio con semilla fija): siempre producen los mismos datos.
// Uso: node scripts/gen-datasets.mjs
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/pg/datasets");
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.weighted = (pairs) => { const tot = pairs.reduce((s, p) => s + p[1], 0); let x = f() * tot; for (const [v, w] of pairs) { x -= w; if (x < 0) return v; } return pairs[pairs.length - 1][0]; };
  return f;
}
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const copyVal = (v) => (v === null || v === undefined ? "\\N" : String(v).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n"));
const copy = (table, cols, rows) => `COPY ${table} (${cols.join(", ")}) FROM stdin;\n${rows.map((r) => r.map(copyVal).join("\t")).join("\n")}\n\\.\n`;
const values = (table, cols, rows) => `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${rows.map((r) => "  (" + r.map(q).join(", ") + ")").join(",\n")};\n`;
const pad = (n) => String(n).padStart(2, "0");
const date = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return date(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
const noAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** RUT chileno con dígito verificador válido (módulo 11). */
function rut(num) {
  let s = 0, m = 2;
  for (const d of String(num).split("").reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; }
  const r = 11 - (s % 11);
  const dv = r === 11 ? "0" : r === 10 ? "K" : String(r);
  return `${num}-${dv}`;
}

const NOMBRES_F = ["Camila", "Sofía", "Valentina", "Isidora", "Antonia", "Martina", "Javiera", "Catalina", "Constanza", "Fernanda", "Francisca", "Daniela", "María José", "Josefa", "Florencia", "Trinidad", "Agustina", "Emilia", "Paula", "Carolina"];
const NOMBRES_M = ["Benjamín", "Vicente", "Martín", "Matías", "Joaquín", "Agustín", "Tomás", "Cristóbal", "Sebastián", "Diego", "Nicolás", "Felipe", "José", "Juan Pablo", "Ignacio", "Maximiliano", "Lucas", "Gabriel", "Rodrigo", "Francisco"];
const APELLIDOS = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández", "Carrasco", "Cortés", "Núñez", "Jara", "Vergara", "Figueroa", "Riquelme", "Bravo", "Olivares", "Cáceres"];
const COMUNAS = [
  ["Santiago", "Metropolitana", 9], ["Providencia", "Metropolitana", 7], ["Ñuñoa", "Metropolitana", 7], ["Las Condes", "Metropolitana", 6], ["Maipú", "Metropolitana", 7],
  ["Puente Alto", "Metropolitana", 6], ["La Florida", "Metropolitana", 6], ["San Miguel", "Metropolitana", 3], ["Vitacura", "Metropolitana", 2], ["Peñalolén", "Metropolitana", 3],
  ["Valparaíso", "Valparaíso", 4], ["Viña del Mar", "Valparaíso", 5], ["Quilpué", "Valparaíso", 2], ["Concepción", "Biobío", 4], ["Talcahuano", "Biobío", 2],
  ["Temuco", "La Araucanía", 3], ["Antofagasta", "Antofagasta", 3], ["La Serena", "Coquimbo", 3], ["Coquimbo", "Coquimbo", 2], ["Rancagua", "O'Higgins", 2],
  ["Talca", "Maule", 2], ["Puerto Montt", "Los Lagos", 2], ["Valdivia", "Los Ríos", 2], ["Punta Arenas", "Magallanes", 1], ["Arica", "Arica y Parinacota", 1], ["Iquique", "Tarapacá", 1],
];
const pickComuna = (r) => r.weighted(COMUNAS.map((c) => [c, c[2]]));

function persona(r, i, used) {
  for (;;) {
    const fem = r() < 0.5;
    const nombre = r.pick(fem ? NOMBRES_F : NOMBRES_M);
    const ap1 = r.pick(APELLIDOS);
    let ap2 = r.pick(APELLIDOS);
    if (ap2 === ap1) ap2 = APELLIDOS[(APELLIDOS.indexOf(ap1) + 7) % APELLIDOS.length];
    const k = nombre + ap1 + ap2;
    if (used.has(k)) continue;
    used.add(k);
    return { nombre, apellido: `${ap1} ${ap2}`, ap1, fem, i };
  }
}

// ---------------------------------------------------------------- tienda
function tienda() {
  const r = rng(20260927);
  let sql = `-- Tienda Andes: comercio electrónico chileno (datos ficticios y deterministas).
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

`;
  const cats = [
    [1, "Tecnología", null], [2, "Computación", 1], [3, "Audio", 1], [4, "Accesorios", 1],
    [5, "Hogar", null], [6, "Cocina", 5], [7, "Decoración", 5],
    [8, "Deportes", null], [9, "Ciclismo", 8], [10, "Outdoor", 8],
    [11, "Libros", null], [12, "Alimentos", null], [13, "Café y té", 12],
  ];
  sql += values("categorias", ["id", "nombre", "padre_id"], cats) + "\n";
  const P = [
    ["COMP-001", "Notebook 14\" Ryzen 5", 2, 549990], ["COMP-002", "Monitor 24\" Full HD", 2, 129990], ["COMP-003", "Teclado mecánico", 2, 49990],
    ["COMP-004", "Mouse inalámbrico", 2, 14990], ["COMP-005", "Disco SSD 1 TB", 2, 69990], ["COMP-006", "Cámara web HD", 2, 29990],
    ["AUD-001", "Audífonos inalámbricos", 3, 39990], ["AUD-002", "Audífonos con cancelación de ruido", 3, 149990], ["AUD-003", "Parlante Bluetooth", 3, 34990],
    ["AUD-004", "Micrófono USB", 3, 59990], ["AUD-005", "Reproductor MP3", 3, 19990],
    ["ACC-001", "Cargador USB-C 65 W", 4, 24990], ["ACC-002", "Cable HDMI 2 m", 4, 6990], ["ACC-003", "Batería externa 20000 mAh", 4, 27990],
    ["ACC-004", "Funda para notebook", 4, 15990], ["ACC-005", "Hub USB-C 7 en 1", 4, 32990],
    ["COC-001", "Hervidor eléctrico", 6, 21990], ["COC-002", "Cafetera italiana", 6, 18990], ["COC-003", "Sartén antiadherente 28 cm", 6, 24990],
    ["COC-004", "Juego de cuchillos", 6, 39990], ["COC-005", "Batidora de mano", 6, 29990], ["COC-006", "Olla a presión", 6, 54990],
    ["DEC-001", "Lámpara de escritorio", 7, 19990], ["DEC-002", "Cojín de lana", 7, 12990], ["DEC-003", "Set de velas aromáticas", 7, 9990], ["DEC-004", "Espejo redondo", 7, 34990],
    ["CIC-001", "Bicicleta urbana aro 28", 9, 349990], ["CIC-002", "Casco de ciclismo", 9, 29990], ["CIC-003", "Luces LED para bicicleta", 9, 12990], ["CIC-004", "Candado en U", 9, 19990],
    ["OUT-001", "Mochila 40 L", 10, 49990], ["OUT-002", "Carpa para 2 personas", 10, 89990], ["OUT-003", "Saco de dormir", 10, 59990],
    ["OUT-004", "Botella térmica 1 L", 10, 16990], ["OUT-005", "Linterna frontal", 10, 13990],
    ["LIB-001", "Cien años de soledad", 11, 15990], ["LIB-002", "La casa de los espíritus", 11, 14990], ["LIB-003", "Veinte poemas de amor", 11, 8990],
    ["LIB-004", "Hijo de ladrón", 11, 12990], ["LIB-005", "Aprende SQL paso a paso", 11, 24990], ["LIB-006", "El principito", 11, 7990],
    ["CAF-001", "Café en grano 1 kg", 13, 19990], ["CAF-002", "Café molido 500 g", 13, 9990], ["CAF-003", "Té verde 100 bolsitas", 13, 5990],
    ["CAF-004", "Yerba mate 1 kg", 13, 6990], ["ALI-001", "Chocolate amargo 70 %", 12, 3490], ["ALI-002", "Miel de ulmo 500 g", 12, 8990],
    ["ALI-003", "Merkén 100 g", 12, 2990], ["ALI-004", "Aceite de oliva 1 L", 12, 11990],
  ];
  const neverSold = new Set(["DEC-004", "COC-006", "ACC-004"]);
  const inactive = new Set(["AUD-005"]);
  const prods = P.map(([sku, nombre, cat, precio], i) => {
    const costo = Math.round((precio * (0.52 + r() * 0.18)) / 10) * 10;
    const stock = inactive.has(sku) ? 0 : r() < 0.1 ? 0 : r.int(2, 120);
    const creado = addDays("2024-03-01", r.int(0, 500));
    return { id: i + 1, sku, nombre, cat, precio, costo, stock, activo: !inactive.has(sku), creado };
  });
  sql += values("productos", ["sku", "nombre", "categoria_id", "precio", "costo", "stock", "activo", "creado_en"], prods.map((p) => [p.sku, p.nombre, p.cat, p.precio, p.costo, p.stock, p.activo, p.creado])) + "\n";

  const used = new Set();
  const doms = ["gmail.com", "gmail.com", "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "correo.cl"];
  const clientes = [];
  for (let i = 1; i <= 60; i++) {
    const p = persona(r, i, used);
    const c = pickComuna(r);
    const email = r() < 0.1 ? null : `${noAccent(p.nombre.split(" ")[0])}.${noAccent(p.ap1)}${r() < 0.4 ? r.int(1, 99) : ""}@${r.pick(doms)}`;
    const tel = r() < 0.15 ? null : `+56 9 ${r.int(1000, 9999)} ${r.int(1000, 9999)}`;
    const sinComuna = r() < 0.05;
    clientes.push({ id: i, rut: rut(r.int(7_000_000, 24_999_999)), nombre: p.nombre, apellido: p.apellido, email, tel, comuna: sinComuna ? null : c[0], region: sinComuna ? null : c[1], alta: addDays("2024-01-05", r.int(0, 870)) });
  }
  // emails únicos
  const seen = new Set();
  for (const c of clientes) { if (c.email && seen.has(c.email)) c.email = c.email.replace("@", `${c.id}@`); if (c.email) seen.add(c.email); }
  sql += values("clientes", ["rut", "nombre", "apellido", "email", "telefono", "comuna", "region", "fecha_registro"], clientes.map((c) => [c.rut, c.nombre, c.apellido, c.email, c.tel, c.comuna, c.region, c.alta])) + "\n";

  // Pedidos: algunos clientes compran mucho, otros nunca
  const sinPedidos = new Set([7, 19, 23, 34, 41, 48, 55, 60]);
  const activos = clientes.filter((c) => !sinPedidos.has(c.id));
  const weight = new Map(activos.map((c) => [c.id, c.id % 11 === 0 ? 6 : c.id % 5 === 0 ? 3 : 1 + (c.id % 3)]));
  const pedidos = [];
  const items = [];
  const vendibles = prods.filter((p) => !neverSold.has(p.sku));
  for (let i = 1; i <= 420; i++) {
    let cli = r.weighted(activos.map((c) => [c, weight.get(c.id)]));
    let dia = addDays("2025-01-01", Math.floor(r() * 546));
    if (dia < cli.alta) dia = addDays(cli.alta, r.int(1, 30));
    if (dia > "2026-06-30") { cli = activos[i % activos.length]; dia = addDays("2026-01-01", r.int(0, 180)); if (dia < cli.alta) dia = cli.alta; }
    const hora = `${pad(r.weighted([[9, 1], [10, 2], [11, 2], [12, 2], [13, 2], [14, 1], [15, 1], [16, 1], [17, 1], [18, 2], [19, 3], [20, 3], [21, 3], [22, 2], [23, 1]]))}:${pad(r.int(0, 59))}:${pad(r.int(0, 59))}`;
    const reciente = dia >= "2026-06-20";
    const estado = reciente ? r.weighted([["pendiente", 3], ["pagado", 3], ["enviado", 2]]) : r.weighted([["entregado", 17], ["cancelado", 1]]);
    const metodo = estado === "pendiente" ? null : r.weighted([["debito", 5], ["credito", 4], ["transferencia", 2]]);
    const n = r.weighted([[1, 5], [2, 4], [3, 2], [4, 1]]);
    const elegidos = new Set();
    let total = 0;
    const its = [];
    while (elegidos.size < n) {
      const p = r.weighted(vendibles.map((x) => [x, x.cat === 11 || x.cat === 12 || x.cat === 13 ? 3 : x.precio > 200000 ? 0.4 : 1.5]));
      if (elegidos.has(p.id)) continue;
      elegidos.add(p.id);
      const cant = p.cat >= 11 ? r.weighted([[1, 5], [2, 3], [3, 1]]) : r.weighted([[1, 8], [2, 1]]);
      const precio = dia < "2025-07-01" && p.id % 4 === 0 ? Math.round((p.precio * 0.95) / 10) * 10 : p.precio;
      total += cant * precio;
      its.push([i, p.id, cant, precio]);
    }
    const rm = cli.region === "Metropolitana";
    const desp = total >= 50000 ? 0 : rm ? 3990 : 5990;
    pedidos.push({ id: i, cli: cli.id, fecha: `${dia} ${hora}`, estado, metodo, desp, dia });
    items.push(...its);
  }
  pedidos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const remap = new Map(pedidos.map((p, k) => [p.id, k + 1]));
  sql += copy("pedidos", ["cliente_id", "fecha", "estado", "metodo_pago", "costo_despacho"], pedidos.map((p) => [p.cli, p.fecha, p.estado, p.metodo, p.desp])) + "\n";
  items.sort((a, b) => remap.get(a[0]) - remap.get(b[0]) || a[1] - b[1]);
  sql += copy("pedido_items", ["pedido_id", "producto_id", "cantidad", "precio_unitario"], items.map((it) => [remap.get(it[0]), it[1], it[2], it[3]])) + "\n";

  // Reseñas de productos que el cliente compró y recibió
  const COM = {
    1: ["Excelente calidad, llegó antes de lo esperado.", "Funciona perfecto, muy recomendable.", "Buen producto por el precio.", "La batería dura menos de lo que dice la ficha.", "Llegó con la caja dañada, pero el producto funciona bien.", "No funcionó como esperaba; lo devolví.", "El sonido es muy bueno y la conexión Bluetooth es estable.", "Rápido y silencioso, ideal para trabajar."],
    5: ["Muy bonito, se ve tal cual la foto.", "Buena calidad de materiales.", "Cumple, aunque es más pequeño de lo que pensaba.", "Excelente para la cocina del día a día.", "Se rayó a la semana de uso, no lo recomiendo."],
    8: ["Perfecto para salir a pedalear por la ciudad.", "Muy cómoda y resistente para el trekking.", "Buena relación precio calidad.", "Aguantó lluvia y viento en Torres del Paine.", "La talla es más chica de lo normal."],
    11: ["Un clásico que hay que leer.", "Edición cuidada, buena tipografía.", "Me encantó, lo leí en dos días.", "Llegó impecable.", "Muy buena traducción de los ejemplos, aunque le faltan ejercicios."],
    12: ["Aroma intenso y sabor equilibrado.", "El mejor café que he probado en grano.", "Muy rico, lo vuelvo a comprar.", "Llegó bien envasado.", "Demasiado amargo para mi gusto."],
  };
  const raiz = (cat) => (cat <= 4 ? 1 : cat <= 7 ? 5 : cat <= 10 ? 8 : cat === 11 ? 11 : 12);
  const res = [];
  const ya = new Set();
  const entregados = pedidos.filter((p) => p.estado === "entregado");
  const byPed = new Map();
  for (const it of items) { const k = it[0]; if (!byPed.has(k)) byPed.set(k, []); byPed.get(k).push(it); }
  while (res.length < 150) {
    const ped = r.pick(entregados);
    const it = r.pick(byPed.get(ped.id));
    const k = ped.cli + "-" + it[1];
    if (ya.has(k)) continue;
    ya.add(k);
    const prod = prods[it[1] - 1];
    const nota = r.weighted([[5, 9], [4, 7], [3, 3], [2, 1], [1, 1]]);
    let com = r() < 0.12 ? null : r.pick(COM[raiz(prod.cat)]);
    if (com && nota <= 2) com = r.pick(["No funcionó como esperaba; lo devolví.", "Mala calidad, se rompió pronto.", "No lo recomiendo.", "Demasiado caro para lo que es."]);
    res.push([prod.id, ped.cli, nota, com, addDays(ped.dia, r.int(3, 40))]);
  }
  res.sort((a, b) => (a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : a[0] - b[0]));
  sql += copy("resenas", ["producto_id", "cliente_id", "nota", "comentario", "fecha"], res);
  return sql;
}

// ---------------------------------------------------------------- rrhh
function rrhh() {
  const r = rng(1810);
  let sql = `-- Recursos humanos de «Andes Digital SpA» (datos ficticios y deterministas). Sueldos brutos mensuales en CLP.

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

`;
  const deps = [[1, "Gerencia", "Santiago"], [2, "Finanzas", "Santiago"], [3, "Tecnología", "Santiago"], [4, "Ventas", "Concepción"], [5, "Operaciones", "Valparaíso"], [6, "Personas", "Santiago"]];
  sql += values("departamentos", ["id", "nombre", "ciudad"], deps) + "\n";
  // Estructura: CEO → gerentes → jefes → analistas
  const plan = [
    [1, "Gerente general", null, 1, 8900000],
    [2, "Gerente de Finanzas", 1, 2, 5600000], [3, "Gerente de Tecnología", 1, 3, 6200000], [4, "Gerente de Ventas", 1, 4, 5400000], [5, "Gerente de Operaciones", 1, 5, 5100000], [6, "Gerente de Personas", 1, 6, 4800000],
    [7, "Jefe de Contabilidad", 2, 2, 3200000], [8, "Jefe de Tesorería", 2, 2, 3100000],
    [9, "Jefe de Desarrollo", 3, 3, 4200000], [10, "Jefe de Datos", 3, 3, 4100000], [11, "Jefe de Infraestructura", 3, 3, 3900000],
    [12, "Jefe de Ventas Zona Sur", 4, 4, 3000000], [13, "Jefe de Ventas Zona Centro", 4, 4, 3100000],
    [14, "Jefe de Logística", 5, 5, 2900000], [15, "Jefe de Bodega", 5, 5, 2300000],
    [16, "Jefe de Reclutamiento", 6, 6, 2700000],
  ];
  const team = [[7, "Contador", 2, [1400000, 2000000], 3], [8, "Analista de tesorería", 2, [1300000, 1900000], 2], [9, "Desarrollador", 3, [1700000, 3400000], 7], [10, "Analista de datos", 3, [1600000, 3000000], 4], [10, "Ingeniero de datos", 3, [2200000, 3600000], 2], [11, "Administrador de sistemas", 3, [1500000, 2600000], 3], [12, "Ejecutivo de ventas", 4, [900000, 1600000], 4], [13, "Ejecutivo de ventas", 4, [950000, 1700000], 4], [14, "Coordinador logístico", 5, [1100000, 1600000], 2], [15, "Operario de bodega", 5, [650000, 850000], 5], [16, "Analista de personas", 6, [1200000, 1700000], 2]];
  const used = new Set();
  const emps = [];
  const add = (id, cargo, jefe, dep, sueldo, ingreso) => {
    const p = persona(r, id, used);
    const email = `${noAccent(p.nombre.split(" ")[0])}.${noAccent(p.ap1)}@andesdigital.cl`;
    emps.push({ id, rut: rut(r.int(8_000_000, 21_999_999)), nombre: p.nombre, apellido: p.apellido, email, dep, cargo, jefe, ingreso, salida: null, sueldo });
  };
  for (const [id, cargo, jefe, dep, sueldo] of plan) add(id, cargo, jefe, dep, sueldo, addDays(id === 1 ? "2012-03-01" : id <= 6 ? "2014-01-06" : "2016-02-01", r.int(0, id <= 6 ? 700 : 1800)));
  let id = 17;
  for (const [jefe, cargo, dep, [lo, hi], n] of team) for (let k = 0; k < n; k++) add(id++, cargo, jefe, dep, Math.round(r.int(lo, hi) / 10000) * 10000, addDays("2017-01-02", r.int(0, 3300)));
  // Un par de personas que ya no trabajan y una recién llegada sin departamento asignado
  emps.find((e) => e.id === 22).salida = "2025-11-30";
  emps.find((e) => e.id === 37).salida = "2026-03-31";
  add(id++, "Practicante", 9, null, 500000, "2026-06-15");
  // emails únicos
  const seen = new Set();
  for (const e of emps) { if (seen.has(e.email)) e.email = e.email.replace("@", `${e.id}@`); seen.add(e.email); }
  sql += values("empleados", ["id", "rut", "nombre", "apellido", "email", "departamento_id", "cargo", "jefe_id", "fecha_ingreso", "fecha_salida", "sueldo"], emps.map((e) => [e.id, e.rut, e.nombre, e.apellido, e.email, e.dep, e.cargo, e.jefe, e.ingreso, e.salida, e.sueldo])) + "\n";
  const hist = [];
  for (const e of emps) {
    const reaj = Math.min(5, Math.max(0, Math.floor(daysBetween(e.ingreso, "2026-06-30") / 540)));
    const fechas = [e.ingreso];
    for (let k = 1; k <= reaj; k++) fechas.push(addDays(e.ingreso, k * r.int(360, 540)));
    const valid = fechas.filter((f) => f <= (e.salida || "2026-06-30"));
    let s = Math.round((e.sueldo / Math.pow(1.06, valid.length - 1)) / 10000) * 10000;
    valid.forEach((f, k) => { hist.push([e.id, f, k === valid.length - 1 ? e.sueldo : s]); s = Math.round((s * (1.04 + r() * 0.05)) / 10000) * 10000; });
  }
  sql += copy("historial_sueldos", ["empleado_id", "desde", "sueldo"], hist) + "\n";
  const proys = [[1, "Portal de clientes", "2024-03-01", "2025-02-28", 180000000], [2, "Migración a la nube", "2024-09-02", "2025-12-19", 320000000], [3, "App de despacho", "2025-04-01", null, 145000000], [4, "Data warehouse", "2025-06-02", null, 260000000], [5, "Rediseño de bodegas", "2025-01-06", "2025-08-29", 95000000], [6, "Plan de capacitación", "2026-01-05", null, 40000000]];
  sql += values("proyectos", ["id", "nombre", "inicio", "fin", "presupuesto"], proys) + "\n";
  const asig = [];
  const roles = { 3: ["Desarrollador", "Líder técnico"], 4: ["Analista de datos", "Ingeniero de datos"], 2: ["Arquitecto", "Administrador"], 5: ["Coordinador", "Operario"], 1: ["Desarrollador", "Diseñador"], 6: ["Facilitador"] };
  for (const e of emps) {
    if (e.id === 1 || e.salida) continue;
    const opts = e.dep === 3 ? [1, 2, 3, 4] : e.dep === 5 ? [3, 5] : e.dep === 6 ? [6] : e.dep === 2 ? [2, 4] : e.dep === 4 ? [1] : [];
    for (const p of opts) if (r() < 0.45) asig.push([e.id, p, r.pick(roles[p]), r.pick([4, 8, 10, 12, 16, 20, 22])]);
  }
  asig.push([3, 2, "Patrocinador", 2], [3, 4, "Patrocinador", 2]);
  const seenA = new Set();
  const asigU = asig.filter((a) => { const k = a[0] + "-" + a[1]; if (seenA.has(k)) return false; seenA.add(k); return true; }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  sql += values("asignaciones", ["empleado_id", "proyecto_id", "rol", "horas_semana"], asigU);
  return sql;
}

// ---------------------------------------------------------------- colegio
function colegio() {
  const r = rng(777);
  let sql = `-- Liceo «Bicentenario Andes»: cursos, alumnos y notas (escala chilena de 1.0 a 7.0; se aprueba con 4.0). Datos ficticios.

CREATE TABLE cursos (
  id              integer PRIMARY KEY,
  nombre          text NOT NULL UNIQUE,
  nivel           smallint NOT NULL CHECK (nivel BETWEEN 1 AND 4),
  profesor_jefe   text NOT NULL
);

CREATE TABLE asignaturas (
  id      integer PRIMARY KEY,
  nombre  text NOT NULL UNIQUE,
  horas   smallint NOT NULL
);

CREATE TABLE alumnos (
  id                integer PRIMARY KEY,
  rut               text NOT NULL UNIQUE,
  nombre            text NOT NULL,
  apellido          text NOT NULL,
  fecha_nacimiento  date NOT NULL,
  curso_id          integer NOT NULL REFERENCES cursos (id),
  comuna            text NOT NULL
);

CREATE TABLE notas (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id      integer NOT NULL REFERENCES alumnos (id),
  asignatura_id  integer NOT NULL REFERENCES asignaturas (id),
  semestre       smallint NOT NULL CHECK (semestre IN (1, 2)),
  evaluacion     smallint NOT NULL CHECK (evaluacion BETWEEN 1 AND 3),
  nota           numeric(2,1) NOT NULL CHECK (nota BETWEEN 1.0 AND 7.0),
  fecha          date NOT NULL,
  UNIQUE (alumno_id, asignatura_id, semestre, evaluacion)
);

`;
  const cursos = [[1, "1° Medio A", 1, "Patricia Olivares"], [2, "1° Medio B", 1, "Hernán Tapia"], [3, "2° Medio A", 2, "Carmen Gloria Rojas"], [4, "2° Medio B", 2, "Luis Cáceres"], [5, "3° Medio A", 3, "Andrea Figueroa"], [6, "4° Medio A", 4, "Jorge Valenzuela"]];
  sql += values("cursos", ["id", "nombre", "nivel", "profesor_jefe"], cursos) + "\n";
  const asigs = [[1, "Lenguaje", 6], [2, "Matemática", 7], [3, "Historia", 4], [4, "Ciencias", 6], [5, "Inglés", 4], [6, "Educación Física", 2], [7, "Artes", 2]];
  sql += values("asignaturas", ["id", "nombre", "horas"], asigs) + "\n";
  const used = new Set();
  const alumnos = [];
  const talento = new Map();
  let id = 1;
  const comunas = ["Maipú", "Maipú", "Santiago", "Estación Central", "Cerrillos", "Pudahuel", "Lo Prado", "Quinta Normal"];
  for (const [cid, , nivel] of cursos) {
    const n = cid === 6 ? 24 : r.int(27, 32);
    for (let k = 0; k < n; k++) {
      const p = persona(r, id, used);
      const anio = 2026 - 14 - nivel + (r() < 0.12 ? -1 : 0);
      alumnos.push([id, rut(r.int(21_500_000, 24_900_000)), p.nombre, p.apellido, `${anio}-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`, cid, r.pick(comunas)]);
      talento.set(id, 4.2 + r() * 2.4 + (r() < 0.08 ? -1.0 : 0));
      id++;
    }
  }
  sql += values("alumnos", ["id", "rut", "nombre", "apellido", "fecha_nacimiento", "curso_id", "comuna"], alumnos) + "\n";
  const notas = [];
  const fechas = { 1: ["2026-04-10", "2026-05-15", "2026-06-19"], 2: ["2026-08-21", "2026-10-02", "2026-11-13"] };
  const dificultad = { 1: 0, 2: -0.45, 3: 0.1, 4: -0.25, 5: 0.05, 6: 0.6, 7: 0.45 };
  for (const a of alumnos) for (const [asid] of asigs) for (const sem of [1, 2]) for (const ev of [1, 2, 3]) {
    let v = talento.get(a[0]) + dificultad[asid] + (r() - 0.5) * 1.6 + (sem === 2 ? 0.1 : 0);
    v = Math.min(7, Math.max(1, Math.round(v * 10) / 10));
    notas.push([a[0], asid, sem, ev, v.toFixed(1), fechas[sem][ev - 1]]);
  }
  // Segundo semestre en curso: solo hay notas hasta septiembre (la 3.ª evaluación aún no existe)
  const filtradas = notas.filter((n) => !(n[2] === 2 && n[3] === 3));
  sql += copy("notas", ["alumno_id", "asignatura_id", "semestre", "evaluacion", "nota", "fecha"], filtradas);
  return sql;
}

// ---------------------------------------------------------------- biblioteca
function biblioteca() {
  const r = rng(1945);
  let sql = `-- Biblioteca comunitaria «Gabriela Mistral»: libros, autores, socios y préstamos (catálogo ficticio con obras reales).

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

`;
  const A = [
    [1, "Gabriela Mistral", "Chile", 1889], [2, "Pablo Neruda", "Chile", 1904], [3, "Isabel Allende", "Chile", 1942], [4, "Roberto Bolaño", "Chile", 1953],
    [5, "José Donoso", "Chile", 1924], [6, "María Luisa Bombal", "Chile", 1910], [7, "Alejandro Zambra", "Chile", 1975], [8, "Nicanor Parra", "Chile", 1914],
    [9, "Manuel Rojas", "Chile", 1896], [10, "Pedro Lemebel", "Chile", 1952], [11, "Marcela Serrano", "Chile", 1951], [12, "Hernán Rivera Letelier", "Chile", 1950],
    [13, "Nona Fernández", "Chile", 1971], [14, "Gabriel García Márquez", "Colombia", 1927], [15, "Julio Cortázar", "Argentina", 1914], [16, "Jorge Luis Borges", "Argentina", 1899],
    [17, "Mario Vargas Llosa", "Perú", 1936], [18, "Octavio Paz", "México", 1914], [19, "Laura Esquivel", "México", 1950], [20, "Juan Rulfo", "México", 1917],
    [21, "Vicente Huidobro", "Chile", 1893], [22, "Violeta Parra", "Chile", 1917],
  ];
  sql += values("autores", ["id", "nombre", "pais", "nacimiento"], A) + "\n";
  const L = [
    ["Desolación", 1922, "Poesía", 248, [1], "Primer libro de poemas de Mistral: el dolor, la maternidad y la naturaleza de Chile."],
    ["Tala", 1938, "Poesía", 272, [1], "Poemas sobre América, la muerte de la madre y la tierra."],
    ["Veinte poemas de amor y una canción desesperada", 1924, "Poesía", 96, [2], "Poemario amoroso juvenil, uno de los más leídos en español."],
    ["Canto general", 1950, "Poesía", 544, [2], "Épica poética de América Latina, su historia y su naturaleza."],
    ["Confieso que he vivido", 1974, "Memorias", 480, [2], "Memorias del poeta, desde Temuco hasta el exilio y el Nobel."],
    ["La casa de los espíritus", 1982, "Novela", 488, [3], "Saga de la familia Trueba a lo largo de varias generaciones en un país sin nombre."],
    ["Eva Luna", 1987, "Novela", 304, [3], "Una narradora huérfana cuenta su vida y la de un país agitado."],
    ["Paula", 1994, "Memorias", 368, [3], "Carta de una madre a su hija enferma, entre recuerdos familiares."],
    ["Los detectives salvajes", 1998, "Novela", 624, [4], "Dos poetas buscan a una escritora perdida en el desierto de Sonora."],
    ["2666", 2004, "Novela", 1128, [4], "Cinco partes alrededor de los crímenes de Santa Teresa, en la frontera mexicana."],
    ["Estrella distante", 1996, "Novela", 160, [4], "Un poeta aviador y los crímenes de la dictadura."],
    ["El obsceno pájaro de la noche", 1970, "Novela", 544, [5], "Una casa de ejercicios espirituales, monstruos y máscaras."],
    ["Coronación", 1957, "Novela", 256, [5], "La decadencia de una familia aristocrática de Santiago."],
    ["La amortajada", 1938, "Novela", 128, [6], "Una mujer muerta recorre su vida desde el ataúd."],
    ["La última niebla", 1934, "Novela", 96, [6], "Una mujer atrapada en un matrimonio sin amor imagina un amante en la niebla."],
    ["Bonsái", 2006, "Novela", 96, [7], "Breve historia de amor entre dos estudiantes que mienten sobre haber leído a Proust."],
    ["Formas de volver a casa", 2011, "Novela", 168, [7], "Un escritor recuerda su infancia en Maipú durante la dictadura."],
    ["Poemas y antipoemas", 1954, "Poesía", 176, [8], "Libro fundacional de la antipoesía."],
    ["Hijo de ladrón", 1951, "Novela", 352, [9], "Aniceto Hevia recorre Chile y Argentina en busca de su lugar."],
    ["Tengo miedo torero", 2001, "Novela", 208, [10], "La Loca del Frente se enamora de un joven que prepara un atentado en 1986."],
    ["Loco afán", 1996, "Crónica", 224, [10], "Crónicas sobre la disidencia sexual y el sida en el Chile de los noventa."],
    ["Nosotras que nos queremos tanto", 1991, "Novela", 320, [11], "Cuatro amigas conversan un verano sobre sus vidas."],
    ["La reina Isabel cantaba rancheras", 1994, "Novela", 208, [12], "La vida en una oficina salitrera del norte de Chile."],
    ["Space Invaders", 2013, "Novela", 80, [13], "Recuerdos de un grupo de compañeros de colegio en los años ochenta."],
    ["La dimensión desconocida", 2016, "Novela", 232, [13], "Una escritora reconstruye la historia de un agente de la dictadura."],
    ["Cien años de soledad", 1967, "Novela", 496, [14], "La historia de los Buendía y del pueblo de Macondo."],
    ["El amor en los tiempos del cólera", 1985, "Novela", 464, [14], "Florentino Ariza espera más de cincuenta años a Fermina Daza."],
    ["Crónica de una muerte anunciada", 1981, "Novela", 128, [14], "Todo el pueblo sabía que iban a matar a Santiago Nasar."],
    ["Rayuela", 1963, "Novela", 736, [15], "Horacio Oliveira entre París y Buenos Aires; se puede leer en distinto orden."],
    ["Bestiario", 1951, "Cuento", 176, [15], "Cuentos donde lo fantástico irrumpe en lo cotidiano."],
    ["Ficciones", 1944, "Cuento", 224, [16], "Laberintos, bibliotecas infinitas y espejos."],
    ["El Aleph", 1949, "Cuento", 208, [16], "Cuentos sobre la eternidad, la identidad y el infinito."],
    ["La ciudad y los perros", 1963, "Novela", 448, [17], "Cadetes de un colegio militar de Lima y un crimen encubierto."],
    ["La fiesta del Chivo", 2000, "Novela", 528, [17], "Los últimos días de la dictadura de Trujillo."],
    ["El laberinto de la soledad", 1950, "Ensayo", 352, [18], "Ensayo sobre la identidad mexicana."],
    ["Como agua para chocolate", 1989, "Novela", 256, [19], "Tita cocina sus emociones en cada receta."],
    ["Pedro Páramo", 1955, "Novela", 128, [20], "Juan Preciado busca a su padre en un pueblo de muertos."],
    ["El llano en llamas", 1953, "Cuento", 192, [20], "Cuentos del campo mexicano después de la revolución."],
    ["Altazor", 1931, "Poesía", 144, [21], "Viaje en paracaídas por el lenguaje: el gran poema del creacionismo."],
    ["Décimas", 1970, "Poesía", 240, [22], "Autobiografía en verso de Violeta Parra."],
    ["Antología de la poesía chilena", 2010, "Poesía", 420, [1, 2, 8, 21, 22], "Selección de poemas de las grandes voces de la poesía chilena."],
    ["Voces de mujeres", 2018, "Cuento", 300, [6, 11, 13], "Antología de narradoras chilenas del siglo XX y XXI."],
  ];
  const isbn = (n) => { const base = `978956${String(n).padStart(6, "0")}`; let s = 0; for (let i = 0; i < 12; i++) s += Number(base[i]) * (i % 2 ? 3 : 1); return base + ((10 - (s % 10)) % 10); };
  const libros = L.map((l, i) => [i + 1, isbn(100 + i * 37), l[0], l[1], l[2], l[3], r.weighted([[1, 5], [2, 3], [3, 1]]), l[5]]);
  libros[14][5] = null; // un libro sin nº de páginas registrado
  sql += values("libros", ["id", "isbn", "titulo", "anio", "genero", "paginas", "ejemplares", "resumen"], libros) + "\n";
  const la = [];
  L.forEach((l, i) => l[4].forEach((a) => la.push([i + 1, a])));
  sql += values("libro_autor", ["libro_id", "autor_id"], la) + "\n";
  const used = new Set();
  const socios = [];
  for (let i = 1; i <= 50; i++) {
    const p = persona(r, i, used);
    socios.push([i, rut(r.int(6_000_000, 23_000_000)), `${p.nombre} ${p.apellido}`, r() < 0.2 ? null : `${noAccent(p.nombre.split(" ")[0])}.${noAccent(p.ap1)}${i}@${r.pick(["gmail.com", "outlook.com", "correo.cl"])}`, r.pick(["Ñuñoa", "Ñuñoa", "Providencia", "La Reina", "Macul", "Santiago"]), addDays("2023-03-01", r.int(0, 1000))]);
  }
  sql += values("socios", ["id", "rut", "nombre", "email", "comuna", "fecha_alta"], socios) + "\n";
  const prest = [];
  const nuncaPrestados = new Set([12, 35]);
  const pesos = libros.map((l) => [l[0], nuncaPrestados.has(l[0]) ? 0 : l[4] === "Novela" ? 3 : 1.5]);
  for (let i = 0; i < 320; i++) {
    const socio = socios[r.weighted(socios.map((s, k) => [k, k % 7 === 0 ? 4 : 1]))];
    const libro = r.weighted(pesos);
    let f = addDays("2025-01-02", r.int(0, 540));
    if (f < socio[5]) f = addDays(socio[5], r.int(0, 20));
    const lim = addDays(f, 14);
    let dev = null;
    const hoy = "2026-06-30";
    if (lim < hoy || r() < 0.4) {
      const atraso = r.weighted([[0, 7], [1, 1], [2, 1]]);
      dev = atraso === 0 ? addDays(f, r.int(3, 14)) : addDays(lim, r.int(1, atraso === 1 ? 10 : 40));
      if (dev > hoy) dev = null;
      if (r() < 0.035) dev = null; // nunca devuelto
    }
    prest.push([libro, socio[0], f, lim, dev]);
  }
  prest.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] - b[0]));
  sql += copy("prestamos", ["libro_id", "socio_id", "fecha_prestamo", "fecha_limite", "fecha_devolucion"], prest);
  return sql;
}

// ---------------------------------------------------------------- metro
function metro() {
  let sql = `-- Validaciones de tarjetas en el Metro de Santiago (primer semestre de 2026). Datos ficticios y deterministas;
-- las estaciones son reales y las tarifas son aproximadas. Tabla grande para practicar índices, EXPLAIN y particiones.

CREATE TABLE lineas (
  id      text PRIMARY KEY,
  nombre  text NOT NULL,
  color   text NOT NULL
);

CREATE TABLE estaciones (
  id      integer PRIMARY KEY,
  nombre  text NOT NULL UNIQUE,
  comuna  text NOT NULL
);

CREATE TABLE linea_estacion (
  linea_id     text NOT NULL REFERENCES lineas (id),
  estacion_id  integer NOT NULL REFERENCES estaciones (id),
  orden        smallint NOT NULL,
  PRIMARY KEY (linea_id, estacion_id),
  UNIQUE (linea_id, orden)
);

CREATE TABLE tarjetas (
  id       bigint PRIMARY KEY,
  tipo     text NOT NULL CHECK (tipo IN ('adulto', 'estudiante', 'adulto mayor')),
  emitida  date NOT NULL
);

CREATE TABLE validaciones (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tarjeta_id   bigint NOT NULL REFERENCES tarjetas (id),
  estacion_id  integer NOT NULL REFERENCES estaciones (id),
  ts           timestamptz NOT NULL,
  tarifa       integer NOT NULL
);

`;
  sql += values("lineas", ["id", "nombre", "color"], [["L1", "Línea 1", "rojo"], ["L2", "Línea 2", "amarillo"], ["L4", "Línea 4", "azul"], ["L5", "Línea 5", "verde"], ["L6", "Línea 6", "morado"]]) + "\n";
  const L1 = [["San Pablo", "Lo Prado"], ["Neptuno", "Lo Prado"], ["Pajaritos", "Lo Prado"], ["Las Rejas", "Estación Central"], ["Ecuador", "Estación Central"], ["San Alberto Hurtado", "Estación Central"], ["Universidad de Santiago", "Estación Central"], ["Estación Central", "Estación Central"], ["Unión Latinoamericana", "Santiago"], ["República", "Santiago"], ["Los Héroes", "Santiago"], ["La Moneda", "Santiago"], ["Universidad de Chile", "Santiago"], ["Santa Lucía", "Santiago"], ["Universidad Católica", "Santiago"], ["Baquedano", "Providencia"], ["Salvador", "Providencia"], ["Manuel Montt", "Providencia"], ["Pedro de Valdivia", "Providencia"], ["Los Leones", "Providencia"], ["Tobalaba", "Providencia"], ["El Golf", "Las Condes"], ["Alcántara", "Las Condes"], ["Escuela Militar", "Las Condes"], ["Manquehue", "Las Condes"], ["Hernando de Magallanes", "Las Condes"], ["Los Dominicos", "Las Condes"]];
  const L2 = [["Vespucio Norte", "Huechuraba"], ["Zapadores", "Recoleta"], ["Dorsal", "Recoleta"], ["Einstein", "Recoleta"], ["Cementerios", "Recoleta"], ["Cerro Blanco", "Recoleta"], ["Patronato", "Recoleta"], ["Puente Cal y Canto", "Santiago"], ["Santa Ana", "Santiago"], ["Los Héroes", "Santiago"], ["Toesca", "Santiago"], ["Parque O'Higgins", "Santiago"], ["Rondizzoni", "Santiago"], ["Franklin", "Santiago"], ["El Llano", "San Miguel"], ["San Miguel", "San Miguel"], ["Lo Vial", "San Miguel"], ["Departamental", "San Miguel"], ["Ciudad del Niño", "San Miguel"], ["Lo Ovalle", "La Cisterna"], ["El Parrón", "La Cisterna"], ["La Cisterna", "La Cisterna"]];
  const L4 = [["Tobalaba", "Providencia"], ["Cristóbal Colón", "Las Condes"], ["Francisco Bilbao", "Providencia"], ["Príncipe de Gales", "La Reina"], ["Simón Bolívar", "La Reina"], ["Plaza Egaña", "La Reina"], ["Los Orientales", "Peñalolén"], ["Grecia", "Peñalolén"], ["Los Presidentes", "Peñalolén"], ["Quilín", "Macul"], ["Las Torres", "Macul"], ["Macul", "La Florida"], ["Vicuña Mackenna", "La Florida"], ["Vicente Valdés", "La Florida"], ["Rojas Magallanes", "La Florida"], ["Trinidad", "La Florida"], ["San José de la Estrella", "La Florida"], ["Los Quillayes", "La Florida"], ["Elisa Correa", "Puente Alto"], ["Hospital Sótero del Río", "Puente Alto"], ["Protectora de la Infancia", "Puente Alto"], ["Las Mercedes", "Puente Alto"], ["Plaza de Puente Alto", "Puente Alto"]];
  const L5 = [["Plaza de Maipú", "Maipú"], ["Santiago Bueras", "Maipú"], ["Del Sol", "Maipú"], ["Monte Tabor", "Maipú"], ["Las Parcelas", "Maipú"], ["Laguna Sur", "Pudahuel"], ["Barrancas", "Pudahuel"], ["Pudahuel", "Pudahuel"], ["San Pablo", "Lo Prado"], ["Lo Prado", "Lo Prado"], ["Blanqueado", "Quinta Normal"], ["Gruta de Lourdes", "Quinta Normal"], ["Quinta Normal", "Santiago"], ["Cumming", "Santiago"], ["Santa Ana", "Santiago"], ["Plaza de Armas", "Santiago"], ["Bellas Artes", "Santiago"], ["Baquedano", "Providencia"], ["Parque Bustamante", "Providencia"], ["Santa Isabel", "Santiago"], ["Irarrázaval", "Ñuñoa"], ["Ñuble", "Ñuñoa"], ["Rodrigo de Araya", "Macul"], ["Carlos Valdovinos", "Macul"], ["Camino Agrícola", "Macul"], ["San Joaquín", "San Joaquín"], ["Pedrero", "La Florida"], ["Mirador", "La Florida"], ["Bellavista de La Florida", "La Florida"], ["Vicente Valdés", "La Florida"]];
  const L6 = [["Cerrillos", "Cerrillos"], ["Lo Valledor", "Pedro Aguirre Cerda"], ["Presidente Pedro Aguirre Cerda", "Pedro Aguirre Cerda"], ["Franklin", "Santiago"], ["Bío Bío", "Santiago"], ["Ñuble", "Ñuñoa"], ["Estadio Nacional", "Ñuñoa"], ["Ñuñoa", "Ñuñoa"], ["Inés de Suárez", "Providencia"], ["Los Leones", "Providencia"]];
  const est = new Map();
  const le = [];
  for (const [lid, arr] of [["L1", L1], ["L2", L2], ["L4", L4], ["L5", L5], ["L6", L6]]) {
    arr.forEach(([n, c], k) => {
      if (!est.has(n)) est.set(n, { id: est.size + 1, n, c });
      le.push([lid, est.get(n).id, k + 1]);
    });
  }
  sql += values("estaciones", ["id", "nombre", "comuna"], [...est.values()].map((e) => [e.id, e.n, e.c])) + "\n";
  sql += values("linea_estacion", ["linea_id", "estacion_id", "orden"], le) + "\n";
  // Tarjetas y validaciones generadas en el servidor con fórmulas deterministas (sin random())
  sql += `INSERT INTO tarjetas (id, tipo, emitida)
SELECT 1000000 + g,
       CASE WHEN g % 10 < 7 THEN 'adulto' WHEN g % 10 < 9 THEN 'estudiante' ELSE 'adulto mayor' END,
       DATE '2018-01-01' + (g * 37 % 2900)
FROM generate_series(1, 6000) AS g;

-- 120 000 validaciones entre el 1 de enero y el 30 de junio de 2026, con horas punta en la mañana y la tarde
INSERT INTO validaciones (tarjeta_id, estacion_id, ts, tarifa)
SELECT 1000000 + 1 + (g * 7919 % 6000),
       1 + (g * 104729 % ${est.size}),
       TIMESTAMPTZ '2026-01-01 00:00:00' + ((g * 2654435761::bigint % 181) || ' days')::interval
         + (CASE WHEN g % 10 < 4 THEN 7 + (g % 3) WHEN g % 10 < 8 THEN 17 + (g % 3) ELSE 6 + (g * 13 % 17) END || ' hours')::interval
         + ((g * 31 % 60) || ' minutes')::interval + ((g * 17 % 60) || ' seconds')::interval,
       0
FROM generate_series(1::bigint, 120000::bigint) AS g;

-- Tarifas aproximadas: punta 870, valle 790, bajo 720; estudiante 260; adulto mayor 390
UPDATE validaciones v
SET tarifa = CASE t.tipo
               WHEN 'estudiante' THEN 260
               WHEN 'adulto mayor' THEN 390
               ELSE CASE WHEN extract(hour FROM v.ts) BETWEEN 7 AND 8 OR extract(hour FROM v.ts) BETWEEN 18 AND 19 THEN 870
                         WHEN extract(hour FROM v.ts) < 7 OR extract(hour FROM v.ts) >= 21 THEN 720
                         ELSE 790 END
             END
FROM tarjetas t
WHERE t.id = v.tarjeta_id;
`;
  return sql;
}

const sets = { tienda, rrhh, colegio, biblioteca, metro };
for (const [name, fn] of Object.entries(sets)) {
  const sql = fn();
  fs.writeFileSync(path.join(OUT, name + ".sql"), sql);
  console.log(name.padEnd(11), (sql.length / 1024).toFixed(1).padStart(6), "KB");
}
