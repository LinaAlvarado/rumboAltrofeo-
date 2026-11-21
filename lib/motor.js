// Motor del juego: estado de la partida, fases, turnos, cartas y resultados.
const fs = require('fs');
const crypto = require('crypto');
const { MODOS } = require('./modos');

const CAMINOS_REALES = ['Destreza', 'Mente', 'Creativo', 'Música', 'Equipo'];
const TIPOS_COMUNES = ['Penitencia', 'Bonus', 'Sorpresa'];
const ESPERA_MOVIMIENTO_MS = 2600;
const MAX_POR_CAMINO = 2;

const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mezclar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const clonar = (o) => JSON.parse(JSON.stringify(o));
const codigoCorto = (largo, letras = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789') =>
  Array.from({ length: largo }, () => letras[crypto.randomInt(letras.length)]).join('');

function estadoInicial() {
  return {
    version: 1,
    codigo: codigoCorto(4),
    fase: 'lobby', // lobby | instructivo | quien_empieza | eleccion_camino | juego | final
    equipos: [],
    instructivo: 0,
    inicio: null,
    orden: [],
    turnoIdx: 0,
    ronda: 1,
    contTurnos: 0,
    turno: null,
    usadas: [],
    usadosBanco: {},
    temporizador: { totalMs: 0, restanteMs: 0, corriendo: false, finEn: null },
    dudosas: [],
    final: null,
    log: [],
  };
}

class Motor {
  constructor({ datos, archivo, alCambiar, alEvento }) {
    this.datos = datos;
    this.archivo = archivo;
    this.alCambiar = alCambiar || (() => {});
    this.alEvento = alEvento || (() => {});
    this.timers = new Map();
    this.estado = estadoInicial();
    this.cargar();
  }

  // ---------- Persistencia ----------
  cargar() {
    try {
      if (fs.existsSync(this.archivo)) {
        this.estado = Object.assign(estadoInicial(), JSON.parse(fs.readFileSync(this.archivo, 'utf8')));
        this.recuperarTrasReinicio();
        console.log(`Partida recuperada de ${this.archivo} (fase: ${this.estado.fase})`);
      }
    } catch (e) {
      console.error('No se pudo leer el estado guardado, se empieza una partida nueva:', e.message);
      this.estado = estadoInicial();
    }
  }

  guardar() {
    try {
      const tmp = this.archivo + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.estado));
      fs.renameSync(tmp, this.archivo);
    } catch (e) { console.error('Error guardando estado:', e.message); }
  }

  cambio() { this.guardar(); this.alCambiar(); }

  recuperarTrasReinicio() {
    const t = this.estado.turno;
    const tm = this.estado.temporizador;
    if (tm.corriendo) {
      const resta = tm.finEn - Date.now();
      if (resta > 0) this.programarFinTiempo(resta);
      else { tm.corriendo = false; tm.restanteMs = 0; tm.finEn = null; }
    }
    if (!t) return;
    if (t.etapa === 'casilla') this.resolverCasilla();
    if (t.etapa === 'carta' && t.juego) {
      // Las secuencias en pantalla se pierden al reiniciar: vuelven a "listo"
      const j = t.juego;
      if (j.estado === 'mostrando') { j.estado = 'listo'; if (t.pantalla) { t.pantalla.grid = null; t.pantalla.cartas = null; t.pantalla.lista = null; } }
      if (j.volteadas && j.volteadas.length) { j.volteadas.forEach((i) => { j.caras[i] = null; }); j.volteadas = []; j.bloqueado = false; }
      if (j.entreRondas) j.entreRondas = false;
    }
  }

  nuevaPartida() {
    this.limpiarTimers();
    this.estado = estadoInicial();
    this.cambio();
  }

  // ---------- Utilidades ----------
  eq(id) { return this.estado.equipos.find((e) => e.id === id); }
  activos() { return this.estado.equipos.filter((e) => !e.llego); }
  nombre(id) { return this.eq(id)?.nombre ?? '?'; }
  carta(id) { return this.datos.cartas.find((c) => c.id === id); }
  log(txt) {
    this.estado.log.unshift({ t: Date.now(), txt });
    this.estado.log.length = Math.min(this.estado.log.length, 60);
  }
  programar(clave, ms, fn) {
    this.cancelar(clave);
    this.timers.set(clave, setTimeout(() => { this.timers.delete(clave); fn(); }, ms));
  }
  cancelar(clave) { if (this.timers.has(clave)) { clearTimeout(this.timers.get(clave)); this.timers.delete(clave); } }
  limpiarTimers() { for (const t of this.timers.values()) clearTimeout(t); this.timers.clear(); }

  // Toma n elementos de un banco, prefiriendo los que no han salido en la partida
  tomar(banco, n = 1) {
    const lista = this.datos.bancos[banco] || [];
    if (!lista.length) return [];
    const usados = this.estado.usadosBanco[banco] || [];
    let libres = lista.map((_, i) => i).filter((i) => !usados.includes(i));
    if (libres.length < n) { libres = lista.map((_, i) => i); this.estado.usadosBanco[banco] = []; }
    const elegidos = mezclar(libres).slice(0, n);
    this.estado.usadosBanco[banco] = [...(this.estado.usadosBanco[banco] || []), ...elegidos];
    return elegidos.map((i) => clonar(lista[i]));
  }

  // ---------- Lobby ----------
  unirse({ codigo, nombre, personaje }) {
    const e = this.estado;
    if (String(codigo || '').toUpperCase().trim() !== e.codigo) return { error: 'Código incorrecto' };
    if (e.fase !== 'lobby') return { error: 'La partida ya empezó. Pueden ver el tablero en la pantalla.', espectador: true };
    nombre = String(nombre || '').trim().slice(0, 22);
    if (!nombre) return { error: 'Escriban el nombre del equipo' };
    if (e.equipos.length >= 6) return { error: 'Ya hay 6 equipos (es el máximo)' };
    if (e.equipos.some((q) => q.nombre.toLowerCase() === nombre.toLowerCase())) return { error: 'Ya hay un equipo con ese nombre' };
    if (!this.datos.personajes.some((p) => p.archivo === personaje)) return { error: 'Elijan un personaje' };
    if (e.equipos.some((q) => q.personaje === personaje)) return { error: 'Ese personaje ya está tomado. Elijan otro.' };
    let codigoEquipo;
    do { codigoEquipo = String(crypto.randomInt(100, 1000)); } while (e.equipos.some((q) => q.codigoEquipo === codigoEquipo));
    const equipo = {
      id: 'e' + crypto.randomBytes(3).toString('hex'),
      nombre, personaje,
      token: crypto.randomBytes(12).toString('hex'),
      codigoEquipo,
      camino: null, casilla: 0, llego: false,
      bonus: [], efectos: {},
    };
    e.equipos.push(equipo);
    this.log(`Entró el equipo ${nombre}`);
    this.cambio();
    return { ok: true, equipo };
  }

  recuperar({ codigoEquipo, token }) {
    const q = token
      ? this.estado.equipos.find((x) => x.token === token)
      : this.estado.equipos.find((x) => x.codigoEquipo === String(codigoEquipo || '').trim());
    if (!q) return { error: token ? 'Sesión vencida' : 'No hay un equipo con ese código' };
    return { ok: true, equipo: q };
  }

  quitarEquipo(id) {
    if (this.estado.fase !== 'lobby') return;
    this.estado.equipos = this.estado.equipos.filter((q) => q.id !== id);
    this.cambio();
  }

  // ---------- Instructivo ----------
  iniciarInstructivo() {
    if (this.estado.equipos.length < 2) return { error: 'Se necesitan mínimo 2 equipos' };
    this.estado.fase = 'instructivo';
    this.estado.instructivo = 0;
    this.cambio();
    return { ok: true };
  }
  pasoInstructivo(delta) {
    this.estado.instructivo = Math.max(0, Math.min(4, this.estado.instructivo + delta));
    this.cambio();
  }

  // ---------- ¿Quién empieza? ----------
  iniciarQuienEmpieza() {
    this.estado.fase = 'quien_empieza';
    this.abrirPreguntaInicio(0);
  }
  abrirPreguntaInicio(indice) {
    const p = this.datos.preguntasInicio[indice];
    this.estado.inicio = {
      indice, estado: 'pregunta', t0: Date.now(),
      pregunta: p.pregunta, opciones: p.opciones,
      respuestas: {}, correcta: null, orden: null, sorteo: false, respuestaVisible: p.respuesta,
    };
    this.log(`Pregunta de inicio ${indice + 1}`);
    this.cambio();
  }
  responderInicio(eid, opcion) {
    const ini = this.estado.inicio;
    if (this.estado.fase !== 'quien_empieza' || !ini || ini.estado !== 'pregunta') return;
    if (ini.respuestas[eid]) return; // solo cuenta la primera
    ini.respuestas[eid] = { opcion: Number(opcion), ms: Date.now() - ini.t0 };
    if (Object.keys(ini.respuestas).length >= this.estado.equipos.length) this.cerrarInicio();
    else this.cambio();
  }
  cerrarInicio() {
    const ini = this.estado.inicio;
    if (!ini || ini.estado !== 'pregunta') return;
    const p = this.datos.preguntasInicio[ini.indice];
    const correctaIdx = p.opciones.indexOf(p.respuesta);
    ini.correcta = correctaIdx;
    const filas = this.estado.equipos.map((q) => {
      const r = ini.respuestas[q.id];
      return { id: q.id, acerto: !!r && r.opcion === correctaIdx, ms: r ? r.ms : Infinity };
    });
    const hayAcierto = filas.some((f) => f.acerto);
    if (!hayAcierto) {
      if (ini.indice < this.datos.preguntasInicio.length - 1) {
        ini.estado = 'nadie';
        this.log('Nadie acertó la pregunta de inicio');
        this.cambio();
        return;
      }
      ini.orden = mezclar(this.estado.equipos.map((q) => q.id));
      ini.sorteo = true;
    } else {
      const acertaron = filas.filter((f) => f.acerto).sort((a, b) => a.ms - b.ms);
      const fallaron = filas.filter((f) => !f.acerto).sort((a, b) => a.ms - b.ms);
      ini.orden = [...acertaron, ...fallaron].map((f) => f.id);
    }
    ini.estado = 'resultado';
    this.estado.orden = ini.orden;
    this.log(`Orden de turnos: ${ini.orden.map((id) => this.nombre(id)).join(', ')}`);
    this.cambio();
  }
  siguientePreguntaInicio() {
    const ini = this.estado.inicio;
    if (!ini || ini.estado !== 'nadie') return;
    this.abrirPreguntaInicio(ini.indice + 1);
  }

  // ---------- Elección de camino ----------
  iniciarEleccionCamino() {
    if (!this.estado.orden.length) this.estado.orden = this.estado.equipos.map((q) => q.id);
    this.estado.fase = 'eleccion_camino';
    this.cambio();
  }
  // Máximo 2 equipos por camino
  caminoLleno(camino, excepto) {
    return this.estado.equipos.filter((q) => q.camino === camino && q.id !== excepto).length >= MAX_POR_CAMINO;
  }
  elegirCamino(eid, camino) {
    if (this.estado.fase !== 'eleccion_camino') return {};
    if (!this.datos.tablero[camino]) return {};
    const q = this.eq(eid);
    if (!q) return {};
    if (q.camino === camino) return { ok: true };
    if (this.caminoLleno(camino, eid)) return { error: `El camino ${camino} ya tiene ${MAX_POR_CAMINO} equipos. Elijan otro.` };
    q.camino = camino;
    q.casilla = 0;
    this.log(`${q.nombre} eligió el camino ${camino}`);
    this.cambio();
    return { ok: true };
  }

  // ---------- Juego ----------
  empezarJuego() {
    const e = this.estado;
    // Los que no eligieron quedan en el camino con menos equipos
    for (const q of e.equipos) {
      if (q.camino) continue;
      const cuantos = (c) => e.equipos.filter((x) => x.camino === c).length;
      q.camino = Object.keys(this.datos.tablero).sort((a, b) => cuantos(a) - cuantos(b))[0];
      q.casilla = 0;
    }
    e.fase = 'juego';
    e.turnoIdx = 0;
    e.ronda = 1;
    this.log('¡Empieza el juego!');
    this.nuevoTurno(e.orden[0]);
  }

  nuevoTurno(eid) {
    const e = this.estado;
    this.cancelar('mover');
    this.cancelarTimersCarta();
    this.tiempoDetener(0);
    const q = this.eq(eid);
    const t = {
      n: ++e.contTurnos,
      equipoId: eid,
      tiraEquipoId: eid,
      etapa: 'dado',
      dado: null, dados: null,
      desde: q.casilla, hasta: null, casillaTipo: null,
      duelo: null,
      numOpciones: 0, cartaElegidaIdx: null,
      carta: null, juego: null,
      privado: {}, pantalla: null, secreto: {},
      resultado: null, avisos: [],
    };
    e.turno = t;
    if (q.efectos.dadoAjeno) {
      delete q.efectos.dadoAjeno;
      const otros = this.activos().filter((x) => x.id !== eid);
      if (otros.length) {
        t.tiraEquipoId = azar(otros).id;
        t.avisos.push(`Dado ajeno: ${this.nombre(t.tiraEquipoId)} tira el dado por ${q.nombre}`);
      }
    }
    this.log(`Turno de ${q.nombre}`);
    if (q.casilla >= 10) {
      // Se quedaron en la casilla 10: vuelven a intentar el reto final sin tirar el dado
      t.hasta = 10;
      t.casillaTipo = this.datos.tablero[q.camino][9];
      t.avisos.push('Vuelven a intentar el Reto final');
      this.resolverCasilla();
      return;
    }
    this.cambio();
  }

  puedeActuar(eid, quien) {
    return quien === 'moderador' || quien === eid;
  }

  tirarDado(quien) {
    const t = this.estado.turno;
    if (this.estado.fase !== 'juego' || !t || t.etapa !== 'dado') return;
    if (!this.puedeActuar(t.tiraEquipoId, quien)) return;
    const q = this.eq(t.equipoId);
    const tirar = () => (q.efectos.dadoUno ? 1 : 1 + crypto.randomInt(3));
    const doble = q.bonus.findIndex((b) => b.efecto === 'doble_dado');
    if (doble >= 0) {
      q.bonus.splice(doble, 1);
      t.dados = [tirar(), tirar()];
      if (q.efectos.dadoUno) { delete q.efectos.dadoUno; t.avisos.push('Dado roto: solo puede salir 1'); }
      t.etapa = 'eleccion_dado';
      t.avisos.push('Doble dado: elijan el resultado');
      this.cambio();
      return;
    }
    const n = tirar();
    if (q.efectos.dadoUno) { delete q.efectos.dadoUno; t.avisos.push('Dado roto: solo puede salir 1'); }
    this.mover(n);
  }

  elegirDado(quien, i) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'eleccion_dado' || !this.puedeActuar(t.equipoId, quien)) return;
    const n = t.dados[Number(i)];
    if (!n) return;
    this.mover(n);
  }

  mover(n) {
    const t = this.estado.turno;
    const q = this.eq(t.equipoId);
    t.dado = n;
    t.desde = q.casilla;
    t.hasta = Math.min(10, q.casilla + n);
    q.casilla = t.hasta;
    t.casillaTipo = this.datos.tablero[q.camino][t.hasta - 1];
    t.etapa = 'casilla';
    this.log(`${q.nombre} sacó ${n} y avanza a la casilla ${t.hasta} (${t.casillaTipo})`);
    this.cambio();
    const nTurno = t.n;
    this.programar('mover', ESPERA_MOVIMIENTO_MS, () => {
      if (this.estado.turno && this.estado.turno.n === nTurno && this.estado.turno.etapa === 'casilla') this.resolverCasilla();
    });
  }

  resolverCasilla() {
    const t = this.estado.turno;
    const tipo = t.casillaTipo;
    if (tipo === 'Vacía') {
      t.etapa = 'resultado';
      t.resultado = { tipo: 'neutral', texto: 'Casilla vacía: ¡descansan!', gana: [], pierde: [] };
      this.cambio();
      return;
    }
    if (tipo === 'Reto' || tipo === 'Reto final') {
      this.prepararOpciones(tipo);
      return;
    }
    if (tipo === 'Duelo') {
      t.etapa = 'elegir_rival';
      t.rivales = this.candidatosDuelo(t.equipoId);
      this.cambio();
      return;
    }
    if (TIPOS_COMUNES.includes(tipo)) {
      const [id] = this.sacarCartas(null, tipo, 1);
      this.iniciarCarta(id);
    }
  }

  candidatosDuelo(eid) {
    const r = this.estado.ronda;
    const otros = this.activos().filter((x) => x.id !== eid);
    const libres = otros.filter((x) => !(x.efectos.intocablesHasta >= r));
    return (libres.length ? libres : otros).map((x) => x.id);
  }

  elegirRival(quien, rivalId) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'elegir_rival' || !this.puedeActuar(t.equipoId, quien)) return;
    if (!t.rivales.includes(rivalId)) return;
    t.duelo = [t.equipoId, rivalId];
    this.log(`${this.nombre(t.equipoId)} reta a ${this.nombre(rivalId)}`);
    this.prepararOpciones('Duelo');
  }

  // Saca n cartas del mazo. Prefiere las del camino que no han salido;
  // si no alcanzan, usa de otros caminos del mismo tipo; y si tampoco, repite.
  sacarCartas(camino, tipo, n) {
    const usadas = this.estado.usadas;
    const delTipo = this.datos.cartas.filter((c) => c.tipo === tipo);
    let propias;
    if (TIPOS_COMUNES.includes(tipo)) propias = delTipo;
    else if (!camino || camino === 'Random') propias = delTipo.filter((c) => CAMINOS_REALES.includes(c.camino));
    else propias = delTipo.filter((c) => c.camino === camino);
    const elegidas = [];
    const llenar = (lista) => {
      for (const c of mezclar(lista)) {
        if (elegidas.length >= n) break;
        if (!elegidas.includes(c.id)) elegidas.push(c.id);
      }
    };
    llenar(propias.filter((c) => !usadas.includes(c.id)));
    llenar(delTipo.filter((c) => !usadas.includes(c.id)));
    llenar(propias);
    llenar(delTipo);
    return elegidas;
  }

  prepararOpciones(tipo) {
    const t = this.estado.turno;
    const q = this.eq(t.equipoId);
    t.secreto.opciones = this.sacarCartas(q.camino, tipo, 4);
    t.numOpciones = t.secreto.opciones.length;
    t.etapa = 'elegir_carta';
    this.cambio();
  }

  elegirCarta(quien, idx) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'elegir_carta' || !this.puedeActuar(t.equipoId, quien)) return;
    const id = t.secreto.opciones[Number(idx)];
    if (!id) return;
    t.cartaElegidaIdx = Number(idx);
    this.iniciarCarta(id);
  }

  iniciarCarta(id) {
    const t = this.estado.turno;
    const c = clonar(this.carta(id));
    if (!this.estado.usadas.includes(id)) this.estado.usadas.push(id);
    const q = this.eq(t.equipoId);
    let tiempo = c.tiempo;
    if ((c.tipo === 'Reto' || c.tipo === 'Reto final') && c.modo !== 'especial') {
      if (q.efectos.relojEnContra) {
        delete q.efectos.relojEnContra;
        if (tiempo) { tiempo = Math.max(10, tiempo - 15); t.avisos.push('Reloj en contra: tienen 15 segundos menos'); }
      }
      if (q.efectos.mediaFuerza) {
        delete q.efectos.mediaFuerza;
        t.avisos.push('Media fuerza: solo juega la mitad del equipo, y los demás equipos eligen quiénes');
      }
      const ref = q.bonus.findIndex((b) => b.efecto === 'refuerzo');
      if (ref >= 0) {
        q.bonus.splice(ref, 1);
        t.avisos.push('Refuerzo: pueden pedir ayuda a una persona de otro equipo');
      }
    }
    t.carta = {
      id: c.id, camino: c.camino, tipo: c.tipo, nombre: c.nombre,
      instrucciones: c.instrucciones, comoSeGana: c.comoSeGana,
      tiempo, material: c.material, seJuegaEn: c.seJuegaEn,
      modo: c.modo, faltaContenido: !!c.faltaContenido,
    };
    t.participantes = t.duelo || [t.equipoId];
    t.juego = {};
    t.privado = {};
    t.pantalla = {};
    t.secreto = { ...t.secreto, panel: null };
    t.etapa = 'carta';
    this.tiempoDetener(tiempo ? tiempo * 1000 : 0);
    this.log(`Carta: ${c.id} ${c.nombre}`);
    const modo = MODOS[c.modo] || MODOS.presencial;
    try {
      modo.iniciar(this.ctx(c));
    } catch (err) {
      console.error(`Error iniciando ${c.id} en modo ${c.modo}, se juega presencial:`, err);
      t.carta.modo = 'presencial';
      t.juego = {}; t.privado = {}; t.pantalla = {};
      MODOS.presencial.iniciar(this.ctx({ ...c, modo: 'presencial', banco: null }));
    }
    if (this.estado.turno === t && t.etapa === 'carta') this.cambio();
  }

  // Contexto que reciben los modos de carta
  ctx(cartaCompleta) {
    const motor = this;
    const t = this.estado.turno;
    return {
      motor, t,
      carta: cartaCompleta || this.carta(t.carta.id),
      participantes: t.participantes,
      equipoId: t.equipoId,
      tomar: (banco, n) => motor.tomar(banco, n),
      terminar: (v) => motor.terminarCarta(v),
      programar: (clave, ms, fn) => {
        const n = t.n;
        motor.programar('carta:' + clave, ms, () => {
          if (motor.estado.turno && motor.estado.turno.n === n && motor.estado.turno.etapa === 'carta') { fn(); motor.cambio(); }
        });
      },
      dudosa: (d) => motor.agregarDudosa(d),
      nombre: (id) => motor.nombre(id),
      aplicarEfecto: (efecto, eid, extra) => motor.aplicarEfecto(efecto, eid, extra),
      iniciarCarta: (id) => motor.iniciarCarta(id),
      sacarCartas: (c, tipo, n) => motor.sacarCartas(c, tipo, n),
      cambio: () => motor.cambio(),
    };
  }

  cancelarTimersCarta() {
    for (const k of [...this.timers.keys()]) if (k.startsWith('carta:')) this.cancelar(k);
  }

  accionCarta(quien, datos) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'carta') return;
    const modo = MODOS[t.carta.modo] || MODOS.presencial;
    if (quien !== 'moderador' && !this.puedeJugarCarta(quien)) return;
    const eid = quien === 'moderador' ? ((datos && datos.equipo) || t.equipoId) : quien;
    if (modo.accion) {
      modo.accion(this.ctx(), eid, datos || {});
      if (this.estado.turno === t) this.cambio();
    }
  }

  puedeJugarCarta(eid) {
    const t = this.estado.turno;
    if (t.carta.modo === 'eleccion') return eid === t.equipoId;
    return t.participantes.includes(eid);
  }

  accionModeradorCarta(datos) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'carta') return;
    const modo = MODOS[t.carta.modo] || MODOS.presencial;
    if (modo.moderador) {
      modo.moderador(this.ctx(), datos || {});
      if (this.estado.turno === t) this.cambio();
    }
  }

  // Juicio del moderador: ganaron | perdieron | se_quedan | gana:<id> | cumplida | no_cumplida | especial:<id>
  juzgar(veredicto) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'carta') return;
    const eid = t.equipoId;
    const otro = (id) => (t.duelo || []).find((x) => x !== id);
    if (veredicto === 'ganaron' || veredicto === 'cumplida') this.terminarCarta({ gana: [eid], pierde: [], texto: null, porModerador: true });
    else if (veredicto === 'perdieron' || veredicto === 'no_cumplida') this.terminarCarta({ gana: [], pierde: [eid], texto: null, porModerador: true });
    else if (veredicto === 'se_quedan') this.terminarCarta({ gana: [], pierde: [], texto: 'Se quedan donde están', porModerador: true });
    else if (veredicto.startsWith('gana:')) {
      const g = veredicto.slice(5);
      this.terminarCarta({ gana: [g], pierde: otro(g) ? [otro(g)] : [], texto: null, porModerador: true });
    } else if (veredicto.startsWith('especial:')) {
      const g = veredicto.slice(9);
      if (!this.eq(g)) return;
      const [bonusId] = this.sacarCartas(null, 'Bonus', 1);
      const b = this.carta(bonusId);
      const txt = this.aplicarEfecto(b.efecto, g);
      this.terminarCarta({ gana: [g], pierde: [], sinMovimiento: true, texto: `¡${this.nombre(g)} gana la Silla musical! Bonus: ${b.nombre}. ${txt}` });
    }
  }

  retroceder(eid) {
    const q = this.eq(eid);
    const escudo = q.bonus.findIndex((b) => b.efecto === 'escudo');
    if (escudo >= 0) {
      q.bonus.splice(escudo, 1);
      return `¡El escudo salvó a ${q.nombre}!`;
    }
    if (q.casilla > 0) q.casilla -= 1;
    return `${q.nombre} retrocede 1 casilla`;
  }

  terminarCarta(v) {
    const t = this.estado.turno;
    if (!t || t.etapa !== 'carta') return;
    this.cancelarTimersCarta();
    this.tiempoPausar(true);
    const c = t.carta;
    const eid = t.equipoId;
    const gana = v.gana || [], pierde = v.pierde || [];
    const detalles = [];
    let tipoRes = 'neutral';
    let llego = false;
    if (!v.sinMovimiento) {
      if (c.tipo === 'Duelo') {
        pierde.forEach((p) => detalles.push(this.retroceder(p)));
        if (gana.length) tipoRes = gana.includes(eid) ? 'gano' : 'perdio';
        if (gana.length && t.jueces) tipoRes = 'neutral';
      } else if (c.tipo === 'Reto final') {
        if (gana.includes(eid)) { llego = true; tipoRes = 'gano'; }
        else if (pierde.includes(eid)) { tipoRes = 'perdio'; detalles.push('Se quedan en la casilla 10 y lo intentan en su próximo turno'); }
      } else {
        if (pierde.includes(eid)) { detalles.push(this.retroceder(eid)); tipoRes = 'perdio'; }
        else if (gana.includes(eid)) tipoRes = 'gano';
      }
    } else if (gana.length) tipoRes = 'gano';
    if (v.tipo) tipoRes = v.tipo;
    let texto = v.texto;
    if (!texto) {
      if (c.tipo === 'Duelo' && gana.length) texto = `¡Ganó ${gana.map((g) => this.nombre(g)).join(' y ')}!`;
      else if (c.tipo === 'Penitencia') texto = pierde.includes(eid) ? 'No cumplieron la penitencia' : '¡Penitencia cumplida!';
      else if (tipoRes === 'gano') texto = c.tipo === 'Reto final' ? '¡Ganaron el reto final!' : '¡Ganaron el reto!';
      else if (tipoRes === 'perdio') texto = 'Perdieron el reto';
      else texto = 'Nadie gana';
    }
    t.resultado = { tipo: tipoRes, texto, detalles, gana, pierde, generico: !v.texto };
    t.etapa = 'resultado';
    if (this.estado.turno.juego) this.estado.turno.juego.terminado = true;
    this.log(`${c.id}: ${texto}${detalles.length ? ' · ' + detalles.join(' · ') : ''}`);
    if (llego) {
      const q = this.eq(eid);
      q.llego = true;
      q.casilla = 11;
      this.cambio();
      this.programar('final', 2500, () => this.terminarPartida(eid));
      return;
    }
    this.cambio();
  }

  aplicarEfecto(efecto, eid, extra = {}) {
    const q = this.eq(eid);
    const r = this.estado.ronda;
    switch (efecto) {
      case 'dado_uno': q.efectos.dadoUno = true; return 'En su próximo turno el dado solo puede dar 1';
      case 'media_fuerza': q.efectos.mediaFuerza = true; return 'En su próximo reto solo juega la mitad del equipo';
      case 'reloj_en_contra': q.efectos.relojEnContra = true; return 'En su próximo reto tendrán 15 segundos menos';
      case 'dado_ajeno': q.efectos.dadoAjeno = true; return 'En su próximo turno, otro equipo tira el dado por ellos';
      case 'al_final': q.efectos.alFinal = true; return 'En la próxima ronda juegan de últimos';
      case 'sin_escudo':
        if (q.bonus.length) { const n = q.bonus.map((b) => b.nombre).join(', '); q.bonus = []; return `Pierden sus bonus guardados (${n})`; }
        if (q.casilla > 0) q.casilla -= 1;
        return 'No tenían bonus: retroceden 1';
      case 'impulso': q.casilla = Math.min(10, q.casilla + 1); return `${q.nombre} avanza 1 casilla`;
      case 'escudo': q.bonus.push({ efecto, nombre: 'Escudo', icono: '🛡️' }); return 'Guardan el Escudo: se salvan del próximo retroceso';
      case 'doble_dado': q.bonus.push({ efecto, nombre: 'Doble dado', icono: '🎲' }); return 'Guardan el Doble dado para su próximo turno';
      case 'refuerzo': q.bonus.push({ efecto, nombre: 'Refuerzo', icono: '🤝' }); return 'Guardan el Refuerzo para su próximo reto';
      case 'intocables': q.efectos.intocablesHasta = r + 1; return 'Nadie puede retarlos a duelo hasta el final de la siguiente ronda';
      case 'viento_en_contra':
        return this.activos().filter((x) => x.id !== eid).map((x) => this.retroceder(x.id)).join(' · ') || 'No hay otros equipos';
      case 'mala_racha': return this.retroceder(eid);
      case 'regalo_rival': {
        const act = this.activos();
        const min = Math.min(...act.map((x) => x.casilla));
        const ult = act.filter((x) => x.casilla === min);
        ult.forEach((x) => { x.casilla = Math.min(10, x.casilla + 1); });
        return `Avanza 1 casilla: ${ult.map((x) => x.nombre).join(', ')}`;
      }
      case 'intercambio': {
        const o = this.eq(extra.con);
        if (!o) return '';
        [q.casilla, o.casilla] = [o.casilla, q.casilla];
        return `${q.nombre} y ${o.nombre} cambian de casilla`;
      }
      case 'atajo': {
        if (!this.datos.tablero[extra.camino]) return '';
        q.camino = extra.camino;
        return `${q.nombre} se pasa al camino ${extra.camino} en la casilla ${q.casilla}`;
      }
      default: return '';
    }
  }

  siguienteTurno() {
    const e = this.estado;
    if (e.fase !== 'juego') return;
    this.cancelarTimersCarta();
    if (!this.activos().length) return;
    let guard = 0;
    do {
      e.turnoIdx++;
      if (e.turnoIdx >= e.orden.length) {
        e.turnoIdx = 0;
        e.ronda++;
        const alFinal = e.orden.filter((id) => this.eq(id)?.efectos.alFinal);
        if (alFinal.length) {
          e.orden = [...e.orden.filter((id) => !alFinal.includes(id)), ...alFinal];
          alFinal.forEach((id) => { delete this.eq(id).efectos.alFinal; });
        }
      }
    } while (this.eq(e.orden[e.turnoIdx])?.llego && ++guard < 20);
    this.nuevoTurno(e.orden[e.turnoIdx]);
  }

  repetirTurno() {
    const t = this.estado.turno;
    if (!t || this.estado.fase !== 'juego') return;
    const q = this.eq(t.equipoId);
    if (t.desde !== null && t.desde !== undefined && !q.llego) q.casilla = t.desde;
    this.nuevoTurno(t.equipoId);
  }

  // ---------- Moderador: fichas ----------
  moverFicha(eid, casilla, camino) {
    const q = this.eq(eid);
    if (!q) return;
    if (casilla !== undefined && casilla !== null) q.casilla = Math.max(0, Math.min(10, Number(casilla)));
    if (camino && this.datos.tablero[camino]) q.camino = camino;
    if (q.llego && q.casilla <= 10) q.llego = false;
    this.log(`Moderador movió a ${q.nombre}: ${q.camino} casilla ${q.casilla}`);
    this.cambio();
  }
  quitarBonus(eid, i) {
    const q = this.eq(eid);
    if (!q) return;
    q.bonus.splice(Number(i), 1);
    this.cambio();
  }

  terminarPartida(ganadorId) {
    const e = this.estado;
    this.cancelarTimersCarta();
    this.tiempoDetener(0);
    const tabla = [...e.equipos].sort((a, b) => (b.llego - a.llego) || (b.casilla - a.casilla)).map((q) => q.id);
    let ganadores;
    if (ganadorId) ganadores = [ganadorId];
    else {
      const max = Math.max(...e.equipos.map((q) => q.casilla));
      ganadores = e.equipos.filter((q) => q.casilla === max).map((q) => q.id);
    }
    e.final = { ganadores, empate: ganadores.length > 1, tabla, porTrofeo: !!ganadorId };
    e.fase = 'final';
    this.log(ganadores.length > 1 ? 'Empate: se decide con un duelo' : `¡Ganó ${this.nombre(ganadores[0])}!`);
    this.cambio();
  }

  // Para desempatar después de terminar: el moderador elige el ganador
  declararGanador(eid) {
    if (!this.estado.final || !this.eq(eid)) return;
    this.estado.final.ganadores = [eid];
    this.estado.final.empate = false;
    this.cambio();
  }

  volverAlJuego() {
    if (this.estado.fase !== 'final') return;
    this.estado.fase = 'juego';
    this.estado.final = null;
    this.estado.equipos.forEach((q) => { if (q.casilla > 10) { q.casilla = 10; q.llego = false; } });
    this.siguienteTurno();
  }

  // ---------- Temporizador ----------
  programarFinTiempo(ms) {
    this.programar('reloj', ms, () => {
      const tm = this.estado.temporizador;
      tm.corriendo = false; tm.restanteMs = 0; tm.finEn = null;
      this.alEvento('timbre');
      const t = this.estado.turno;
      if (t && t.etapa === 'carta') {
        const modo = MODOS[t.carta.modo];
        if (modo && modo.alTiempo) modo.alTiempo(this.ctx());
      }
      this.cambio();
    });
  }
  tiempoIniciar() {
    const tm = this.estado.temporizador;
    if (tm.corriendo || tm.restanteMs <= 0) return;
    tm.corriendo = true;
    tm.finEn = Date.now() + tm.restanteMs;
    this.programarFinTiempo(tm.restanteMs);
    this.cambio();
  }
  tiempoPausar(silencioso) {
    const tm = this.estado.temporizador;
    if (!tm.corriendo) return;
    this.cancelar('reloj');
    tm.restanteMs = Math.max(0, tm.finEn - Date.now());
    tm.corriendo = false;
    tm.finEn = null;
    if (!silencioso) this.cambio();
  }
  tiempoDetener(ms) {
    this.cancelar('reloj');
    this.estado.temporizador = { totalMs: ms, restanteMs: ms, corriendo: false, finEn: null };
  }
  tiempoReiniciar() {
    const tm = this.estado.temporizador;
    this.tiempoDetener(tm.totalMs);
    this.cambio();
  }
  tiempoAjustar(seg) {
    const tm = this.estado.temporizador;
    const corriendo = tm.corriendo;
    if (corriendo) this.tiempoPausar(true);
    tm.restanteMs = Math.max(0, tm.restanteMs + seg * 1000);
    if (tm.restanteMs > tm.totalMs) tm.totalMs = tm.restanteMs;
    if (corriendo && tm.restanteMs > 0) { this.tiempoIniciar(); return; }
    this.cambio();
  }

  // ---------- Respuestas dudosas ----------
  agregarDudosa(d) {
    const t = this.estado.turno;
    this.estado.dudosas.push({ id: crypto.randomBytes(4).toString('hex'), turnoN: t.n, ...d, equipo: this.nombre(d.equipoId) });
  }
  decidirDudosa(id, aceptar) {
    const e = this.estado;
    const d = e.dudosas.find((x) => x.id === id);
    if (!d) return;
    e.dudosas = e.dudosas.filter((x) => x.id !== id);
    const t = e.turno;
    if (t && t.n === d.turnoN && t.etapa === 'carta') {
      const modo = MODOS[t.carta.modo];
      if (modo && modo.decidirDudosa) modo.decidirDudosa(this.ctx(), d, !!aceptar);
    }
    this.cambio();
  }

  // ---------- Vistas ----------
  vista(rol, eid) {
    const e = this.estado;
    const v = clonar(e);
    const ahora = Date.now();
    v.ahora = ahora;
    v.yo = rol === 'jugador' && eid ? eid : null;
    v.equipos.forEach((q) => { delete q.token; if (rol !== 'moderador' && q.id !== eid) delete q.codigoEquipo; });
    if (v.inicio && rol !== 'moderador' && v.inicio.estado === 'pregunta') {
      // Los equipos solo ven quién respondió, no qué
      for (const k of Object.keys(v.inicio.respuestas)) v.inicio.respuestas[k] = { respondio: true };
    }
    if (v.inicio && rol !== 'moderador') delete v.inicio.respuestaVisible;
    if (rol !== 'moderador') {
      delete v.dudosas;
      delete v.usadosBanco;
      if (v.turno) {
        delete v.turno.secreto;
        const priv = v.turno.privado || {};
        v.turno.privado = eid && priv[eid] ? priv[eid] : null;
        if (rol !== 'pantalla') delete v.turno.pantalla;
      }
    } else {
      if (v.turno && v.turno.secreto && v.turno.secreto.opciones) {
        v.turno.secreto.opcionesInfo = v.turno.secreto.opciones.map((id) => { const c = this.carta(id); return { id, nombre: c.nombre, material: c.material, tiempo: c.tiempo, seJuegaEn: c.seJuegaEn }; });
      }
    }
    return v;
  }
}

module.exports = { Motor, mezclar, azar, CAMINOS_REALES, MAX_POR_CAMINO };
