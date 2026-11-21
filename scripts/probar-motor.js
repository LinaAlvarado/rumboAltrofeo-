// Prueba automática del motor: juega cada carta y luego partidas completas al azar.
// Uso: node scripts/probar-motor.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Motor } = require('../lib/motor');
const datos = require('../data/juego.json');

const archivo = path.join(os.tmpdir(), 'rumbo-prueba-' + process.pid + '.json');
const m = new Motor({ datos, archivo });
const fallos = [];
const ok = (cond, msg) => { if (!cond) fallos.push(msg); };

function preparar(n = 3) {
  m.nuevaPartida();
  const pjs = datos.personajes.map((p) => p.archivo);
  for (let i = 0; i < n; i++) {
    const r = m.unirse({ codigo: m.estado.codigo, nombre: 'Equipo ' + (i + 1), personaje: pjs[i] });
    if (!r.ok) throw new Error(r.error);
  }
  ok(m.unirse({ codigo: m.estado.codigo, nombre: 'X', personaje: pjs[0] }).error, 'personaje repetido debe fallar');
  ok(m.unirse({ codigo: 'ZZZZ', nombre: 'Y', personaje: pjs[5] }).error, 'código malo debe fallar');
  m.iniciarInstructivo();
  m.iniciarQuienEmpieza();
  const ids = m.estado.equipos.map((q) => q.id);
  const p = datos.preguntasInicio[0];
  const bien = p.opciones.indexOf(p.respuesta);
  if (n === 3) {
    m.responderInicio(ids[2], bien);
    m.responderInicio(ids[0], (bien + 1) % 4);
    m.responderInicio(ids[1], bien);
    ok(m.estado.inicio.estado === 'resultado', 'inicio debe tener resultado');
    ok(m.estado.orden[0] === ids[2] && m.estado.orden[1] === ids[1] && m.estado.orden[2] === ids[0], 'orden de turnos por velocidad: ' + m.estado.orden);
  } else {
    // Nadie acierta en las 3 preguntas: sorteo
    for (let k = 0; k < 3; k++) {
      const pk = datos.preguntasInicio[k];
      const mal = (pk.opciones.indexOf(pk.respuesta) + 1) % 4;
      ids.forEach((id) => m.responderInicio(id, mal));
      if (k < 2) { ok(m.estado.inicio.estado === 'nadie', 'debería pasar a desempate'); m.siguientePreguntaInicio(); }
    }
    ok(m.estado.inicio.estado === 'resultado' && m.estado.inicio.sorteo, 'debería sortear');
  }
  m.iniciarEleccionCamino();
  ids.forEach((id, i) => m.elegirCamino(id, ['Mente', 'Creativo', 'Destreza', 'Música', 'Equipo'][i % 5]));
  m.empezarJuego();
  return ids;
}

// Juega la carta de forma "correcta" usando lo que sabe el servidor
function jugarCarta(A, B) {
  const t = m.estado.turno;
  const j = t.juego;
  const s = t.secreto;
  const modo = t.carta.modo;
  const acc = (eid, d) => m.accionCarta(eid, d);
  const judge = () => {
    if (modo === 'especial') m.juzgar('especial:' + A);
    else if (t.carta.tipo === 'Duelo') m.juzgar('gana:' + (t.duelo ? t.duelo[0] : A));
    else m.juzgar('ganaron');
  };
  switch (modo) {
    case 'opcion_multiple':
      if (j.oculta) { acc(A, { tipo: 'responder', pregunta: 0, opcion: 0 }); ok(!s.registro[A].length, 'oculta: no se responde antes de la señal'); m.accionModeradorCarta({ tipo: 'mostrar' }); ok(!j.oculta && !j.bloqueado, 'oculta: se muestra con la señal'); }
      s.preguntas.forEach((p, k) => acc(A, { tipo: 'responder', pregunta: k, opcion: j.preguntas[k].opciones.indexOf(p.respuesta) }));
      if (t.etapa === 'carta' && t.participantes.length > 1) s.preguntas.forEach((p, k) => acc(B, { tipo: 'responder', pregunta: k, opcion: 0 }));
      break;
    case 'escribir':
      if (j.lista) { j.estado = 'escribir'; s.palabras.forEach((w) => acc(A, { tipo: 'palabra', texto: w.toLowerCase() })); }
      else if (j.duelo) {
        for (let r = 0; r < s.items.length && t.etapa === 'carta'; r++) { if (r === 0) { ok(j.oculta, "duelo: la ronda 1 debe empezar oculta"); acc(A, { tipo: "responder", idx: 0, texto: s.items[0].respuesta }); ok(!j.rondas[0].ganador, "duelo: no se responde con la ronda oculta"); m.accionModeradorCarta({ tipo: "mostrar" }); } else { ok(j.entreRondas, "duelo: debe esperar al moderador entre rondas"); m.accionModeradorCarta({ tipo: "siguiente_ronda" }); ok(j.ronda === r && !j.oculta, "duelo: siguiente ronda visible"); } acc(A, { tipo: 'responder', idx: r, texto: s.items[r].respuesta }); }
      } else s.items.forEach((it, k) => acc(A, { tipo: 'responder', idx: k, texto: it.respuesta }));
      break;
    case 'ordenar': { const usados = new Set(); acc(A, { tipo: 'enviar', orden: s.orden.map((x) => { const i = j.items.findIndex((y, k) => y === x && !usados.has(k)); usados.add(i); return i; }) }); break; }
    case 'sopa_letras': s.colocadas.forEach((p) => t.etapa === 'carta' && acc(A, { tipo: 'marcar', a: p.b, b: p.a })); break;
    case 'ahorcado': [...new Set(s.frase.replace(/[^A-ZÑ]/g, ''))].forEach((L) => acc(A, { tipo: 'letra', letra: L })); break;
    case 'rompecabezas': {
      const e = j.equipos[A];
      for (let i = 0; i < 9; i++) { const k = e.perm.indexOf(i); if (k !== i) acc(A, { tipo: 'cambiar', a: i, b: k }); }
      acc(A, { tipo: 'nombre', texto: s.item.palabra });
      break;
    }
    case 'mosaico': m.accionModeradorCarta({ tipo: 'mostrar' }); j.estado = 'responder'; acc(A, { tipo: 'enviar', grid: s.grid }); break;
    case 'concentrese': {
      m.accionModeradorCarta({ tipo: 'mostrar' }); j.estado = 'jugando';
      const vistos = {};
      s.cartas.forEach((e, i) => (vistos[e] = vistos[e] || []).push(i));
      Object.values(vistos).forEach(([a, b]) => { acc(A, { tipo: 'voltear', i: a }); acc(A, { tipo: 'voltear', i: b }); });
      break;
    }
    case 'secuencia_pantalla':
      m.accionModeradorCarta({ tipo: 'mostrar' });
      if (j.tipo === 'poses') {
        const vistas = [t.pantalla.imagen];
        ok(j.estado === 'mostrando' && vistas[0], 'poses: la pose 1 debe mostrarse');
        for (let k = 1; k < j.total; k++) {
          j.estado = 'oculto'; t.pantalla.imagen = null; // como si pasaran los 10 segundos
          m.accionModeradorCarta({ tipo: 'siguiente' });
          ok(j.paso === k && j.estado === 'mostrando' && t.pantalla.imagen, `poses: la pose ${k + 1} debe mostrarse`);
          vistas.push(t.pantalla.imagen);
        }
        ok(j.total === 3 && new Set(vistas).size === 3, 'poses: deben ser 3 fotos distintas');
        judge();
      } else if (j.manual) {
        ok(j.estado === 'mostrando' && j.paso === 0, 'simón manual: la orden 1 debe mostrarse');
        for (let k = 1; k < j.items.length; k++) {
          m.accionModeradorCarta({ tipo: 'siguiente' });
          ok(j.paso === k, `simón manual: la orden ${k + 1} debe salir con clic`);
        }
        m.accionModeradorCarta({ tipo: 'siguiente' });
        ok(j.estado === 'terminado', 'simón manual: debe terminar tras la última orden');
        judge();
      } else if (j.tipo === 'que_falta') { j.bloqueado = false; const p = s.preguntas[0]; acc(A, { tipo: 'responder', pregunta: 0, opcion: j.preguntas[0].opciones.indexOf(p.respuesta) }); }
      else judge();
      break;
    case 'palabra_secreta':
      if (j.adivinadorEscribe) acc(A, { tipo: 'adivinar', texto: s.palabras[A][0].palabra });
      else { acc(A, { tipo: 'siguiente' }); judge(); }
      break;
    case 'eleccion':
      if (j && j.opciones) acc(A, { tipo: 'elegir', valores: j.opciones.slice(0, j.elegir).map((o) => o.valor) });
      if (m.estado.turno.etapa === 'carta') judge();
      break;
    case 'automatica': break;
    default: judge();
  }
}

// 1) Cada carta, una por una
let ids = preparar(3);
const [A, B] = ids;
for (const c of datos.cartas) {
  m.nuevoTurno(A);
  m.eq(A).casilla = c.tipo === 'Reto final' ? 10 : 5;
  const t = m.estado.turno;
  if (c.tipo === 'Duelo') t.duelo = [A, B];
  try {
    m.iniciarCarta(c.id);
    jugarCarta(A, B);
    const tt = m.estado.turno;
    const r = tt.resultado;
    ok(tt.etapa === 'resultado', `${c.id} (${c.modo}) no terminó: etapa ${tt.etapa}`);
    const esperaGano = ['Reto', 'Reto final', 'Duelo'].includes(c.tipo);
    if (esperaGano && r) ok(r.tipo === 'gano', `${c.id} (${c.modo}) jugada bien debería ganar: ${r.tipo} "${r.texto}"`);
    if (m.estado.fase === 'final') { m.estado.fase = 'juego'; m.estado.final = null; }
    m.limpiarTimers();
    m.estado.equipos.forEach((q) => { q.llego = false; q.casilla = 5; q.bonus = []; q.efectos = {}; });
  } catch (e) { fallos.push(`${c.id}: EXCEPCIÓN ${e.stack}`); }
}
console.log(`Cartas probadas: ${datos.cartas.length}`);

// 2) Validación de texto
const { validar } = require('../lib/validar');
const casos = [
  ['jerusalen', { respuesta: 'JERUSALEN' }, 'correcta'],
  ['Jerusalén', { respuesta: 'JERUSALEN' }, 'correcta'],
  ['jerusalem', { respuesta: 'JERUSALEN' }, 'correcta'],
  ['jeruslan', { respuesta: 'JERUSALEN' }, 'correcta'],
  ['jerus', { respuesta: 'JERUSALEN' }, 'dudosa'],
  ['pescado', { respuesta: 'JERUSALEN' }, 'incorrecta'],
  ['el arca de noe', { respuesta: 'arca', aceptadas: ['arca de Noé'] }, 'correcta'],
  ['  LA   PARÁBOLA ', { respuesta: 'PARABOLA' }, 'correcta'],
  ['10126', { respuesta: '10126', numero: true }, 'correcta'],
  ['10127', { respuesta: '10126', numero: true }, 'incorrecta'],
];
casos.forEach(([t, o, esp]) => ok(validar(t, o) === esp, `validar("${t}") = ${validar(t, o)}, esperaba ${esp}`));

// 3) Partidas completas al azar
let partidas = 0, turnos = 0;
for (let p = 0; p < 30; p++) {
  ids = preparar(2 + (p % 5));
  let guard = 0;
  while (m.estado.fase === 'juego' && guard++ < 600) {
    const t = m.estado.turno;
    try {
      if (t.etapa === 'dado') m.tirarDado(t.tiraEquipoId);
      else if (t.etapa === 'eleccion_dado') m.elegirDado(t.equipoId, 0);
      else if (t.etapa === 'casilla') m.resolverCasilla();
      else if (t.etapa === 'elegir_rival') m.elegirRival(t.equipoId, t.rivales[0]);
      else if (t.etapa === 'elegir_carta') m.elegirCarta(t.equipoId, Math.floor(Math.random() * t.numOpciones));
      else if (t.etapa === 'carta') {
        if (Math.random() < 0.5) jugarCarta(t.participantes[0], t.participantes[1] || t.participantes[0]);
        if (m.estado.turno.etapa === 'carta') m.juzgar(Math.random() < 0.6 ? 'ganaron' : 'perdieron');
      } else if (t.etapa === 'resultado') {
        const llego = m.estado.equipos.find((q) => q.llego);
        if (llego) { m.limpiarTimers(); m.terminarPartida(llego.id); break; }
        m.siguienteTurno(); turnos++;
      }
      m.estado.equipos.forEach((q) => ok(q.casilla >= 0 && q.casilla <= 11, 'casilla fuera de rango ' + q.casilla));
      const v = m.vista('jugador', ids[0]);
      ok(!v.turno || v.turno.secreto === undefined, 'la vista del jugador trae secretos');
      ok(!v.turno || v.turno.pantalla === undefined, 'la vista del jugador trae lo de la pantalla');
      ok(!v.equipos.some((q) => q.token), 'la vista trae tokens');
    } catch (e) { fallos.push(`Partida ${p}: EXCEPCIÓN en etapa ${t.etapa} carta ${t.carta && t.carta.id}: ${e.stack}`); break; }
  }
  m.limpiarTimers();
  if (m.estado.fase === 'final') partidas++;
}
console.log(`Partidas al azar terminadas: ${partidas}/30 · turnos jugados: ${turnos}`);

// 3b) Máximo 2 equipos por camino
m.nuevaPartida();
for (let i = 0; i < 4; i++) m.unirse({ codigo: m.estado.codigo, nombre: 'C' + i, personaje: datos.personajes[i].archivo });
m.iniciarInstructivo(); m.iniciarQuienEmpieza(); m.cerrarInicio();
while (m.estado.inicio.estado === 'nadie') { m.siguientePreguntaInicio(); m.cerrarInicio(); }
m.iniciarEleccionCamino();
const cs = m.estado.equipos.map((q) => q.id);
ok(m.elegirCamino(cs[0], 'Mente').ok && m.elegirCamino(cs[1], 'Mente').ok, 'dos equipos deben poder compartir camino');
ok(m.elegirCamino(cs[2], 'Mente').error, 'un tercer equipo no debe entrar a un camino con 2');
m.elegirCamino(cs[2], 'Equipo'); // cs[3] no elige: debe quedar en un camino vacío
m.empezarJuego();
const porCamino = {};
m.estado.equipos.forEach((q) => { porCamino[q.camino] = (porCamino[q.camino] || 0) + 1; });
ok(Object.values(porCamino).every((n) => n <= 2), 'ningún camino con más de 2: ' + JSON.stringify(porCamino));
m.limpiarTimers();

// 4) Terminar partida por el moderador con empate
ids = preparar(3);
m.estado.equipos.forEach((q) => { q.casilla = 7; });
m.terminarPartida(null);
ok(m.estado.final.empate === true, 'debería haber empate');

m.limpiarTimers();
try { fs.unlinkSync(archivo); } catch {}
if (fallos.length) { console.log(`\n✖ ${fallos.length} fallos:`); [...new Set(fallos)].slice(0, 40).forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\n✔ Todo bien');
process.exit(0);
