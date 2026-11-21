// Genera data/juego.json a partir de "Rumbo al Trofeo.xlsx"
// Uso: npm run datos
// Las cartas se cambian editando el Excel y volviendo a correr este script.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const EXCEL = path.join(RAIZ, 'Rumbo al Trofeo.xlsx');
const SALIDA = path.join(RAIZ, 'data', 'juego.json');

const wb = XLSX.readFile(EXCEL);
const filas = (hoja) => {
  if (!wb.Sheets[hoja]) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: null })
    .slice(1)
    .filter((f) => f.some((c) => c !== null && String(c).trim() !== ''));
};
const txt = (v) => (v === null || v === undefined ? null : String(v).trim());

// Frases con comas internas que no se deben partir al separar opciones
const PROTEGIDAS = ['Sadrac, Mesac y Abed-nego'];
const lista = (v) => {
  if (!v) return [];
  let s = String(v);
  PROTEGIDAS.forEach((p, i) => { s = s.split(p).join(`§${i}§`); });
  return s.split(',').map((x) => x.trim()).filter(Boolean)
    .map((x) => x.replace(/§(\d+)§/g, (_, i) => PROTEGIDAS[+i]));
};
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------- Tablero ----------
const tablero = {};
const caminos = [];
for (const f of filas('Tablero')) {
  const nombre = txt(f[0]);
  tablero[nombre] = f.slice(2, 12).map(txt);
  caminos.push({ nombre, tema: txt(f[1]) });
}

// ---------- Mazo ----------
const cartas = filas('Mazo de cartas').filter((f) => txt(f[0])).map((f) => ({
  id: txt(f[0]),
  camino: txt(f[1]),
  tipo: txt(f[2]),
  nombre: txt(f[3]),
  instrucciones: txt(f[4]),
  comoSeGana: txt(f[5]),
  tiempo: f[6] === null ? null : Number(f[6]),
  material: txt(f[7]),
  seJuegaEn: txt(f[8]),
}));

// ---------- Bancos del Excel ----------
const bancos = {};
const agregar = (clave, item) => { (bancos[clave] = bancos[clave] || []).push(item); };

// Banco Mente
for (const f of filas('Banco Mente')) {
  const carta = txt(f[0]);
  const contenido = txt(f[2]);
  const opciones = lista(f[3]);
  const respuesta = txt(f[4]);
  const cita = txt(f[5]);
  const aceptadas = lista(f[6]);
  if (['M01', 'M05', 'M09', 'M10', 'M14', 'M15'].includes(carta)) {
    // Opción múltiple: la respuesta debe coincidir con una opción.
    // "Salmos (150)" -> "Salmos"; "Falso (fue en el río Jordán)" -> "Falso" + explicación
    let correcta = opciones.find((o) => sinTildes(o) === sinTildes(respuesta));
    if (!correcta) correcta = opciones.find((o) => sinTildes(respuesta).startsWith(sinTildes(o)));
    if (!correcta) throw new Error(`${carta}: la respuesta "${respuesta}" no está en las opciones (${opciones.join(' | ')})`);
    const m = respuesta.match(/\((.*)\)/);
    agregar(carta, { contenido, opciones, respuesta: correcta, explicacion: m ? m[1] : null, cita });
  } else if (carta === 'M02') {
    agregar(carta, { contenido, respuesta, cita });
  } else if (carta === 'M03') {
    agregar(carta, { nombre: contenido, palabras: lista(f[3]).map((p) => p.toUpperCase()) });
  } else if (carta === 'M04') {
    agregar(carta, { contenido, respuesta, aceptadas });
  } else if (carta === 'M06') {
    // El plan reemplaza este banco por objetos con emoji (ver CONTENIDO_EXTRA)
  } else if (carta === 'M07') {
    agregar(carta, { contenido, bancoPalabras: opciones, respuestas: lista(respuesta), cita });
  } else if (carta === 'M08') {
    const pistas = contenido.split(/Pista \d+:/).map((x) => x.trim()).filter(Boolean);
    agregar(carta, { pistas, respuesta, cita });
  } else if (carta === 'M16') {
    agregar(carta, { nombre: contenido, orden: lista(respuesta) });
  } else if (carta === 'M17') {
    agregar(carta, { nombre: contenido, palabras: lista(f[3]) });
  } else if (carta === 'M18') {
    const pistas = contenido.split(/Pista \d+:/).map((x) => x.trim()).filter(Boolean);
    agregar(carta, { pistas, numeros: lista(f[3]), respuesta: String(respuesta), cita });
  } else {
    agregar(carta, { contenido, opciones, respuesta, cita, aceptadas });
  }
}

// Banco Creativo
for (const f of filas('Banco Creativo')) {
  const carta = txt(f[0]);
  const palabra = txt(f[2]);
  const nota = txt(f[3]);
  const aceptadas = lista(f[4]);
  const item = { palabra };
  if (carta === 'C06') item.prohibidas = lista(nota);
  else if (carta === 'C14') item.cita = nota;
  else if (nota) item.nota = nota;
  if (aceptadas.length) item.aceptadas = aceptadas;
  agregar(carta, item);
}

// Banco Música: palabras de reserva (para MU10 Palabra cantada)
for (const f of filas('Banco Música')) agregar('MU10', { palabra: txt(f[2]) });

// Banco Equipo: frases de Teléfono roto
for (const f of filas('Banco Equipo')) agregar(txt(f[0]), { frase: txt(f[2]), cita: txt(f[3]) });

// Canciones: hoja "Banco Canciones" (en el Excel principal o en Canciones.xlsx) con columnas
// Nombre | Artista | Emojis | 4 frases seguidas (separadas por /) | 8 frases del coro (separadas por /) | Otras formas del nombre
const EXCEL_CANCIONES = path.join(RAIZ, 'Canciones.xlsx');
let filasCanciones = filas('Banco Canciones');
if (!filasCanciones && fs.existsSync(EXCEL_CANCIONES)) {
  const wbc = XLSX.readFile(EXCEL_CANCIONES);
  const hoja = wbc.Sheets['Banco Canciones'] || wbc.Sheets[wbc.SheetNames[0]];
  filasCanciones = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null }).slice(1).filter((f) => f.some((c) => c !== null && String(c).trim() !== ''));
}
bancos.canciones = (filasCanciones || []).filter((f) => txt(f[0])).map((f) => ({
  nombre: txt(f[0]),
  artista: txt(f[1]),
  emojis: txt(f[2]),
  frases: (txt(f[3]) || '').split('/').map((x) => x.trim()).filter(Boolean),
  coro: (txt(f[4]) || '').split('/').map((x) => x.trim()).filter(Boolean),
  aceptadas: lista(f[5]),
}));
// Sub-bancos: cada carta usa solo las canciones que tienen lo que necesita
bancos.canciones_emojis = bancos.canciones.filter((c) => c.emojis);
bancos.canciones_frases = bancos.canciones.filter((c) => c.frases.length >= 4);
bancos.canciones_coro = bancos.canciones.filter((c) => c.coro.length >= 4);

// ---------- Contenido del plan (no está en el Excel) ----------
const CONTENIDO_EXTRA = {
  DE05: 'A B C D E L M P R S T V'.split(' ').map((letra) => ({ letra })),
  // Fotos de poses que pasó Lina (public/img/poses). Cada vez salen 3 al azar.
  DE14: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ imagen: `img/poses/pose${n}.jpg`, texto: `Pose ${n}` })),
  DE18: ['Simón dice manos arriba', 'Toquen el piso', 'Simón dice salten', 'Siéntense', 'Simón dice toquen su nariz', 'Aplaudan', 'Simón dice den una vuelta', 'Simón dice manos a la cabeza', 'Levanten un pie', 'Simón dice abrazo de grupo', 'Agáchense', 'Simón dice toquen algo azul']
    .map((texto) => ({ texto, trampa: !texto.startsWith('Simón dice') })),
  E15: ['Aplaudir', 'Tocarse la cabeza', 'Saltar', 'Girar', 'Agacharse', 'Levantar los brazos', 'Tocarse los hombros', 'Zapatear', 'Chasquear los dedos', 'Cruzar los brazos', 'Tocarse las rodillas', 'Señalar el techo'].map((texto) => ({ texto })),
  M06: [['🚢', 'Arca'], ['📜', 'Tablas de la ley'], ['🔥', 'Zarza ardiente'], ['🐟', 'Pez'], ['🍞', 'Pan'], ['👑', 'Corona'], ['🪜', 'Escalera'], ['🕊️', 'Paloma'], ['⭐', 'Estrella'], ['🐑', 'Oveja'], ['🦁', 'León'], ['🐍', 'Serpiente']].map(([emoji, nombre]) => ({ emoji, nombre })),
  E13: [['🚢', '🕊️', '🌈', '☀️', '🦒', '🌳'], ['🧒', '🪨', '🧔', '⛰️', '🐑', '☁️'], ['🐋', '🧔', '🌊', '⛵', '🌙', '⭐']].map((emojis) => ({ emojis })),
  EMOJIS_EQ: ['🚢', '🕊️', '🐟', '👑', '⭐', '🐑', '🍞', '🔥', '🦁', '🐍', '🌈', '📜'].map((emoji) => ({ emoji })),
  // Banderas menos comunes (Lina pidió quitar las muy conocidas)
  M13: [['🇬🇷', 'Grecia'], ['🇸🇪', 'Suecia'], ['🇳🇴', 'Noruega'], ['🇯🇲', 'Jamaica'], ['🇿🇦', 'Sudáfrica'], ['🇵🇦', 'Panamá'], ['🇨🇺', 'Cuba'], ['🇹🇷', 'Turquía'], ['🇮🇪', 'Irlanda'], ['🇺🇦', 'Ucrania'], ['🇻🇳', 'Vietnam'], ['🇳🇬', 'Nigeria']].map(([emoji, pais]) => ({ emoji, pais })),
  M12: ['Libros del Antiguo Testamento', 'Los 12 apóstoles', 'Mujeres de la Biblia', 'Animales que aparecen en la Biblia', 'Ciudades bíblicas', 'Profetas', 'Reyes de Israel'].map((categoria) => ({ categoria })),
  DE01: [{ imagen: 'img/casa-cartas.svg', texto: 'Casa de cartas de 3 pisos' }],
  E12: [['img/dibujo-casa.svg', 'Casa'], ['img/dibujo-arbol-sol.svg', 'Árbol con sol'], ['img/dibujo-barco.svg', 'Barco'], ['img/dibujo-cara.svg', 'Cara feliz']].map(([imagen, texto]) => ({ imagen, texto })),
  C12: [['img/escena-arca.svg', 'El arca de Noé', ['arca', 'arca de noe', 'noe', 'noe y el arca']], ['img/escena-david-goliat.svg', 'David y Goliat', ['david', 'goliat', 'david contra goliat']], ['img/escena-jonas.svg', 'Jonás y el gran pez', ['jonas', 'jonas y el pez', 'jonas y la ballena']]]
    .map(([imagen, palabra, aceptadas]) => ({ imagen, palabra, aceptadas })),
};
// De dónde salió cada banco (para la página de revisión)
const origenBancos = {};
Object.keys(bancos).forEach((k) => { origenBancos[k] = 'excel'; });
Object.keys(CONTENIDO_EXTRA).forEach((k) => { origenBancos[k] = 'plan'; });
['DE01', 'E12', 'C12'].forEach((k) => { origenBancos[k] = 'dibujo'; });
origenBancos.canciones_emojis = 'claude';
origenBancos.DE14 = 'fotos';
Object.assign(bancos, CONTENIDO_EXTRA);

// ---------- Preguntas de inicio ----------
const preguntasInicio = [
  { pregunta: '¿Quién fue el padre de Matusalén, el hombre que más años vivió?', opciones: ['Lamec', 'Enoc', 'Set', 'Jared'], respuesta: 'Enoc' },
  { pregunta: '¿Cuántos hijos tuvo Jacob, que formaron las tribus de Israel?', opciones: ['7', '10', '12', '14'], respuesta: '12' },
  { pregunta: '¿Cuál es el libro más corto del Antiguo Testamento?', opciones: ['Rut', 'Abdías', 'Jonás', 'Nahúm'], respuesta: 'Abdías' },
];

// ---------- Clasificación de cartas (modo y configuración) ----------
// modo: cómo lo resuelve la app. Si el modo aún no existe o falta contenido, la carta se juega como "presencial".
const P = { modo: 'presencial' };
const CLASIFICACION = {
  // Destreza
  DE01: { modo: 'presencial', banco: 'DE01', mostrarEnPantalla: true },
  DE02: { modo: 'presencial', villano: true },
  DE03: P, DE04: P, DE06: P, DE07: P, DE08: P, DE09: P, DE10: P, DE11: P, DE12: P, DE15: P, DE16: P, DE17: P,
  DE05: { modo: 'secuencia_pantalla', banco: 'DE05', secuencia: { tipo: 'letras', cantidad: 5, juntas: true } },
  DE14: {
    modo: 'secuencia_pantalla', banco: 'DE14', secuencia: { tipo: 'poses', cantidad: 3, duracion: 10 },
    instrucciones: 'Se juegan 3 poses. En pantalla aparece por 10 segundos la foto de un grupo de personas en una pose. Luego desaparece y ambos equipos la imitan de memoria con sus cuerpos. Participan todos los integrantes.',
    comoSeGana: 'El equipo que copie mejor más poses (decide el moderador).',
  },
  DE18: {
    modo: 'secuencia_pantalla', banco: 'DE18', secuencia: { tipo: 'simon', cantidad: 10, intervalo: 2, manual: true },
    instrucciones: 'La pantalla lanza 10 órdenes rápidas, una por una: el moderador decide cuándo sale cada una (ej.: ¡Manos arriba!, ¡Toquen algo azul!, ¡Todos agachados!, ¡Abrazo de grupo!). Todo el equipo debe hacerlas. Algunas son trampa porque no empiezan con "Simón dice": esas no se hacen.',
  },
  DE13: { modo: 'escribir', generador: 'operacion', rango: [5, 50], numero: true, rondas: 3 },

  // Mente
  M01: { modo: 'opcion_multiple', banco: 'M01', cantidad: 3, minimo: 2 },
  M05: { modo: 'opcion_multiple', banco: 'M05', cantidad: 5, minimo: 4 },
  M07: { modo: 'opcion_multiple', banco: 'M07', cantidad: 1, completar: true, esperarSenal: true, queAparece: 'el versículo' },
  M09: { modo: 'opcion_multiple', banco: 'M09', cantidad: 1, esperarSenal: true, queAparece: 'la pregunta' },
  M10: { modo: 'opcion_multiple', banco: 'M10', cantidad: 1 },
  M13: { modo: 'opcion_multiple', banco: 'M13', cantidad: 1, generador: 'banderas' },
  M14: { modo: 'opcion_multiple', banco: 'M14', cantidad: 5, ganaMasAciertos: true },
  M15: { modo: 'opcion_multiple', banco: 'M15', cantidad: 5, minimo: 4 },
  M02: { modo: 'presencial', banco: 'M02', panel: true },
  M08: { modo: 'presencial', banco: 'M08', panel: true },
  M12: { modo: 'presencial', banco: 'M12', panel: true },
  M04: { modo: 'escribir', banco: 'M04', cantidad: 3, minimo: 2 },
  M11: { modo: 'escribir', generador: 'operacion', rango: [5, 50], numero: true, cantidad: 1 },
  M17: { modo: 'escribir', banco: 'M17', lista: true, verSegundos: 20, minimo: 6 },
  M18: { modo: 'escribir', banco: 'M18', numero: true, intentos: 2 },
  M16: { modo: 'ordenar', banco: 'M16' },
  M06: { modo: 'secuencia_pantalla', banco: 'M06', secuencia: { tipo: 'que_falta', cantidad: 10, duracion: 15 } },
  M03: { modo: 'sopa_letras', banco: 'M03', minimo: 6 },

  // Creativo
  C01: { modo: 'palabra_secreta', banco: 'C01', cantidad: 3 },
  C03: { modo: 'palabra_secreta', banco: 'C03', cantidad: 1 },
  C05: { modo: 'palabra_secreta', banco: 'C05', cantidad: 3 },
  C06: { modo: 'palabra_secreta', banco: 'C06', cantidad: 3, conProhibidas: true },
  C07: { modo: 'palabra_secreta', banco: 'C07', cantidad: 3 },
  C08: { modo: 'palabra_secreta', banco: 'C08', cantidad: 1 },
  C09: { modo: 'palabra_secreta', banco: 'C02', cantidad: 1, ambosEquipos: true, adivinadorEscribe: true },
  C11: { modo: 'palabra_secreta', banco: 'C06', cantidad: 1, ambosEquipos: true, conProhibidas: true },
  C15: { modo: 'palabra_secreta', banco: 'C15', cantidad: 1 },
  C16: { modo: 'palabra_secreta', banco: 'C16', cantidad: 1 },
  C02: { modo: 'palabra_secreta', banco: 'C02', cantidad: 3, enPanel: true },
  C10: P, C13: P,
  C04: { modo: 'ahorcado', banco: 'C04', errores: 6 },
  C14: { modo: 'ahorcado', banco: 'C14', errores: 8 },
  C12: { modo: 'rompecabezas', banco: 'C12' },

  // Música (todas usan el banco de canciones)
  MU02: P, MU06: P, MU07: P, MU08: P,
  MU10: { modo: 'presencial', banco: 'MU10', panel: true },
  MU03: { modo: 'especial' },
  MU01: { modo: 'palabra_secreta', banco: 'canciones', cantidad: 3, requiereCanciones: true },
  MU12: { modo: 'palabra_secreta', banco: 'canciones', cantidad: 1, ambosEquipos: true, distintaPorEquipo: true, requiereCanciones: true },
  MU13: { modo: 'palabra_secreta', banco: 'canciones', cantidad: 6, requiereCanciones: true },
  MU05: { modo: 'opcion_multiple', banco: 'canciones', generador: 'artista', cantidad: 3, minimo: 2, panelCancion: true, requiereCanciones: true },
  MU11: { modo: 'opcion_multiple', banco: 'canciones_emojis', generador: 'emojis_cancion', cantidad: 1, requiereCanciones: true },
  MU15: { modo: 'opcion_multiple', banco: 'canciones_emojis', generador: 'emojis_cancion', cantidad: 3, minimo: 3, requiereCanciones: true },
  MU09: { modo: 'escribir', banco: 'canciones', generador: 'nombre_cancion', rondas: 3, panelCancion: true, requiereCanciones: true },
  MU14: { modo: 'escribir', banco: 'canciones', generador: 'nombre_cancion', cantidad: 5, minimo: 3, panelCancion: true, requiereCanciones: true },
  MU04: { modo: 'ordenar', banco: 'canciones_frases', generador: 'frases', requiereCanciones: true },
  MU16: { modo: 'ordenar', banco: 'canciones_coro', generador: 'coro', requiereCanciones: true },

  // Equipo
  E01: P, E02: P, E03: P, E04: P, E05: P, E06: P, E08: P, E09: P, E10: P, E11: P,
  E07: { modo: 'presencial', banco: 'E07', panel: true },
  E12: { modo: 'presencial', banco: 'E12', panel: true },
  E13: { modo: 'secuencia_pantalla', banco: 'E13', secuencia: { tipo: 'escena', cantidad: 1, duracion: 10 } },
  E15: { modo: 'secuencia_pantalla', banco: 'E15', secuencia: { tipo: 'acciones', cantidad: 8, intervalo: 2.5 } },
  E14: { modo: 'mosaico', banco: 'EMOJIS_EQ', verSegundos: 15, minimo: 8 },
  E16: { modo: 'concentrese', banco: 'EMOJIS_EQ', verSegundos: 15 },

  // Mazo común
  P04: { modo: 'automatica', efecto: 'dado_uno' },
  P06: { modo: 'automatica', efecto: 'media_fuerza' },
  P08: { modo: 'automatica', efecto: 'reloj_en_contra' },
  P09: { modo: 'automatica', efecto: 'dado_ajeno' },
  P10: { modo: 'automatica', efecto: 'al_final' },
  P12: { modo: 'automatica', efecto: 'sin_escudo' },
  B01: { modo: 'automatica', efecto: 'impulso' },
  B02: { modo: 'automatica', efecto: 'escudo', guardable: true },
  B03: { modo: 'automatica', efecto: 'doble_dado', guardable: true },
  B04: { modo: 'automatica', efecto: 'intocables' },
  B05: { modo: 'automatica', efecto: 'refuerzo', guardable: true },
  S02: { modo: 'automatica', efecto: 'viento_en_contra' },
  S03: { modo: 'automatica', efecto: 'mala_racha' },
  S06: { modo: 'automatica', efecto: 'regalo_rival' },
  P01: P, P02: P, P03: P, P05: P, P07: P, P11: P,
  S01: { modo: 'eleccion', efecto: 'intercambio' },
  S04: { modo: 'eleccion', efecto: 'atajo' },
  S05: { modo: 'eleccion', efecto: 'ustedes_deciden' },
};

const avisos = [];
for (const c of cartas) {
  const conf = CLASIFICACION[c.id];
  if (!conf) {
    avisos.push(`${c.id} no tiene modo: se juega como presencial`);
    Object.assign(c, { modo: 'presencial' });
    continue;
  }
  Object.assign(c, JSON.parse(JSON.stringify(conf)));
  if (c.banco && (!bancos[c.banco] || bancos[c.banco].length === 0)) {
    avisos.push(`${c.id} (${c.nombre}): falta el banco "${c.banco}", se juega como presencial`);
    c.modoOriginal = c.modo;
    c.modo = 'presencial';
    c.faltaContenido = true;
  }
}

const reglas = filas('Reglas').map((f) => txt(f[0])).filter(Boolean);
const materiales = (filas('Materiales') || []).filter((f) => txt(f[0])).map((f) => ({ material: txt(f[0]), cantidad: txt(f[1]), seUsaEn: txt(f[2]) }));
const personajesPath = path.join(RAIZ, 'public', 'personajes', 'personajes.json');
const personajes = fs.existsSync(personajesPath) ? JSON.parse(fs.readFileSync(personajesPath, 'utf8')) : [];

const juego = { tablero, caminos, cartas, bancos, origenBancos, preguntasInicio, personajes, reglas, materiales };
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(juego, null, 2));

// ---------- Reporte ----------
const porTipo = {};
cartas.forEach((c) => { porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; });
const porModo = {};
cartas.forEach((c) => { porModo[c.modo] = (porModo[c.modo] || 0) + 1; });
console.log(`✔ data/juego.json generado`);
console.log(`  Cartas: ${cartas.length}`, porTipo);
console.log(`  Modos:`, porModo);
console.log(`  Caminos: ${Object.keys(tablero).length} (${Object.entries(tablero).map(([k, v]) => `${k}:${v.length}`).join(', ')})`);
console.log(`  Bancos: ${Object.keys(bancos).length} (${Object.entries(bancos).map(([k, v]) => `${k}:${v.length}`).join(', ')})`);
console.log(`  Preguntas de inicio: ${preguntasInicio.length} · Personajes: ${personajes.length} · Reglas: ${reglas.length}`);
if (avisos.length) { console.log(`\n⚠ Avisos (${avisos.length}):`); avisos.forEach((a) => console.log('  - ' + a)); }
