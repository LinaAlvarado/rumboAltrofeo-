// Modos de carta. Cada modo define:
//   iniciar(ctx)                 prepara la carta (lo público en t.juego, lo de cada equipo en t.privado[eid],
//                                lo de la pantalla en t.pantalla y lo del moderador en t.secreto)
//   accion(ctx, eid, datos)      acción desde el celular de un equipo
//   moderador(ctx, datos)        acción del moderador (mostrar secuencia, siguiente palabra...)
//   alTiempo(ctx)                cuando el temporizador llega a cero
//   decidirDudosa(ctx, d, ok)    cuando el moderador acepta o rechaza una respuesta dudosa
const { validar } = require('./validar');
const { generarSopa, leerLinea, limpiar } = require('./sopa');

const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mezclar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const muestra = (arr, n) => mezclar(arr).slice(0, n);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const esDuelo = (ctx) => ctx.participantes.length > 1;
const otro = (ctx, eid) => ctx.participantes.find((x) => x !== eid);
const tieneLetras = (s) => /[a-záéíóúñ]/i.test(s || '');
const mezclarDistinto = (arr) => {
  if (arr.length < 2) return [...arr];
  let m;
  do { m = mezclar(arr); } while (m.every((x, i) => x === arr[i]));
  return m;
};

const BANDERAS = {
  Colombia: 'co', 'México': 'mx', Argentina: 'ar', Brasil: 'br', 'España': 'es',
  Israel: 'il', 'Japón': 'jp', Francia: 'fr', Italia: 'it', 'Estados Unidos': 'us',
  Grecia: 'gr', Suecia: 'se', Noruega: 'no', Jamaica: 'jm', 'Sudáfrica': 'za', 'Panamá': 'pa',
  Cuba: 'cu', 'Turquía': 'tr', Irlanda: 'ie', Ucrania: 'ua', Vietnam: 'vn', Nigeria: 'ng',
};

// Carrera: gana la respuesta correcta más temprana, pero si hay una dudosa
// anterior sin decidir, se espera al moderador (se respeta la hora exacta).
function resolverCarrera(lista) {
  const correctas = lista.filter((x) => x.estado === 'correcta').sort((a, b) => a.t - b.t);
  if (!correctas.length) return { ganador: null, esperando: lista.some((x) => x.estado === 'dudosa') };
  const g = correctas[0];
  if (lista.some((x) => x.estado === 'dudosa' && x.t < g.t)) return { ganador: null, esperando: true };
  return { ganador: g.eid, esperando: false };
}

function feedback(ctx, eid, texto, tipo = 'info') {
  const p = ctx.t.privado[eid] || (ctx.t.privado[eid] = {});
  p.feedback = { texto, tipo, n: (p.feedback?.n || 0) + 1 };
}

// ---------------------------------------------------------------- presencial
const presencial = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    if (carta.banco) {
      const [item] = ctx.tomar(carta.banco, 1);
      if (item) {
        t.secreto.panel = item;
        if (carta.mostrarEnPantalla && item.imagen) t.juego.imagen = item.imagen;
      }
    }
    if (carta.villano) {
      const otros = ctx.motor.activos().filter((q) => !ctx.participantes.includes(q.id));
      if (otros.length) { const v = azar(otros); t.juego.villano = { id: v.id, nombre: v.nombre }; }
    }
  },
};

// ---------------------------------------------------------------- palabra secreta
const palabra_secreta = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const n = carta.cantidad || 1;
    const mapear = (it) => (String(carta.banco).startsWith('canciones') ? { palabra: it.nombre, nota: it.artista, aceptadas: it.aceptadas } : it);
    const listas = {};
    if (carta.distintaPorEquipo) ctx.participantes.forEach((eid) => { listas[eid] = ctx.tomar(carta.banco, n).map(mapear); });
    else { const l = ctx.tomar(carta.banco, n).map(mapear); ctx.participantes.forEach((eid) => { listas[eid] = l; }); }
    if (!Object.values(listas)[0]?.length) throw new Error('Banco vacío');
    t.secreto.palabras = listas;
    t.juego = {
      cantidad: Object.values(listas)[0].length,
      enPanel: !!carta.enPanel,
      conProhibidas: !!carta.conProhibidas,
      adivinadorEscribe: !!carta.adivinadorEscribe,
      idx: {},
    };
    if (carta.enPanel) t.juego.idxPanel = 0;
    else ctx.participantes.forEach((eid) => { t.privado[eid] = { palabras: listas[eid] }; t.juego.idx[eid] = 0; });
    if (carta.adivinadorEscribe) t.secreto.carrera = [];
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo === 'siguiente' && !j.enPanel && t.privado[eid]) {
      j.idx[eid] = Math.min((j.idx[eid] || 0) + 1, t.privado[eid].palabras.length - 1);
    }
    if (d.tipo === 'adivinar' && j.adivinadorEscribe) {
      const obj = t.secreto.palabras[eid][0];
      const r = validar(d.texto, { respuesta: obj.palabra, aceptadas: obj.aceptadas });
      const entrada = { eid, t: Date.now(), estado: r, texto: String(d.texto).slice(0, 60) };
      t.secreto.carrera.push(entrada);
      if (r === 'dudosa') {
        ctx.dudosa({ equipoId: eid, texto: entrada.texto, esperado: obj.palabra, t: entrada.t, ref: t.secreto.carrera.length - 1 });
        feedback(ctx, eid, 'El moderador está revisando su respuesta…');
      } else if (r === 'incorrecta') feedback(ctx, eid, `"${entrada.texto}" no es. ¡Sigan intentando!`, 'mal');
      palabra_secreta.evaluarCarrera(ctx);
    }
  },
  evaluarCarrera(ctx) {
    const { t } = ctx;
    const { ganador, esperando } = resolverCarrera(t.secreto.carrera);
    t.juego.esperandoModerador = esperando;
    if (ganador) {
      const p = t.secreto.palabras[ganador][0].palabra;
      t.juego.solucion = p;
      ctx.terminar({ gana: [ganador], pierde: otro(ctx, ganador) ? [otro(ctx, ganador)] : [], texto: `¡${ctx.nombre(ganador)} adivinó "${p}"!` });
    }
  },
  decidirDudosa(ctx, d, ok) {
    const e = ctx.t.secreto.carrera[d.ref];
    if (!e) return;
    e.estado = ok ? 'correcta' : 'incorrecta';
    if (!ok) feedback(ctx, d.equipoId, 'El moderador no la aceptó. ¡Sigan intentando!', 'mal');
    palabra_secreta.evaluarCarrera(ctx);
  },
  moderador(ctx, d) {
    const j = ctx.t.juego;
    if (d.tipo === 'siguiente') {
      if (j.enPanel) j.idxPanel = Math.min(j.idxPanel + 1, j.cantidad - 1);
      else if (d.equipo && ctx.t.privado[d.equipo]) j.idx[d.equipo] = Math.min((j.idx[d.equipo] || 0) + 1, j.cantidad - 1);
    }
  },
};

// ---------------------------------------------------------------- opción múltiple
function construirPreguntas(ctx) {
  const { carta } = ctx;
  const n = carta.cantidad || 1;
  if (carta.completar) {
    const [it] = ctx.tomar(carta.banco, 1);
    const total = it.respuestas.length;
    return it.respuestas.map((r, k) => {
      let i = -1;
      const texto = it.contenido.replace(/___/g, () => { i++; return i === k ? '【 ? 】' : '____'; });
      return { texto, subtitulo: `Palabra ${k + 1} de ${total}`, opciones: mezclar(it.bancoPalabras), respuesta: r, cita: it.cita };
    });
  }
  if (carta.generador === 'banderas') {
    const banco = ctx.motor.datos.bancos.M13;
    const [it] = ctx.tomar('M13', n);
    const otros = muestra(banco.filter((b) => b.pais !== it.pais), 3).map((b) => b.pais);
    return [{ texto: '¿De qué país es esta bandera?', imagen: `img/banderas/${BANDERAS[it.pais]}.svg`, opciones: mezclar([it.pais, ...otros]), respuesta: it.pais }];
  }
  if (carta.generador === 'artista') {
    const canciones = ctx.tomar(carta.banco, n);
    const B = ctx.motor.datos.bancos;
    const artistas = [...new Set([...(B.ARTISTAS || []).map((a) => a.nombre), ...B.canciones.map((c) => c.artista).filter(Boolean)])];
    // Un dúo ("A y B") no aparece como opción falsa junto a A o a B
    const partes = (a) => String(a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/ y | & /).map((x) => x.trim());
    const choca = (a, b) => partes(a).some((p) => partes(b).includes(p));
    return canciones.map((c, k) => ({
      texto: '¿Quién canta esta canción?', subtitulo: `Canción ${k + 1}: escuchen`,
      opciones: mezclar([c.artista, ...muestra(artistas.filter((a) => !choca(a, c.artista)), 3)]),
      respuesta: c.artista, panel: `${c.nombre} (${c.artista})`,
    }));
  }
  if (carta.generador === 'emojis_cancion') {
    const todas = ctx.motor.datos.bancos.canciones;
    if (todas.length < 4) throw new Error('Faltan canciones');
    return ctx.tomar(carta.banco, n).map((c, k) => ({
      texto: c.emojis, grande: true, subtitulo: n > 1 ? `Canción ${k + 1} de ${n}` : '¿Qué canción es?',
      opciones: mezclar([c.nombre, ...muestra(todas.filter((x) => x.nombre !== c.nombre), 3).map((x) => x.nombre)]),
      respuesta: c.nombre,
    }));
  }
  return ctx.tomar(carta.banco, n).map((it) => {
    const vf = it.opciones.length === 2 && it.opciones.includes('Verdadero');
    return {
      texto: it.contenido, grande: !tieneLetras(it.contenido),
      opciones: vf ? ['Verdadero', 'Falso'] : mezclar(it.opciones),
      respuesta: it.respuesta, explicacion: it.explicacion, cita: it.cita,
    };
  });
}

const opcion_multiple = {
  iniciar(ctx) {
    opcion_multiple.preparar(ctx, construirPreguntas(ctx), false);
    // esperarSenal: primero leen la instrucción; el contenido aparece cuando el moderador da clic
    if (ctx.carta.esperarSenal) Object.assign(ctx.t.juego, { oculta: true, bloqueado: true, queAparece: ctx.carta.queAparece || 'la pregunta' });
  },
  moderador(ctx, d) {
    const j = ctx.t.juego;
    if (d.tipo === 'mostrar' && j.oculta) {
      j.oculta = false;
      j.bloqueado = false;
      j.t0 = Date.now();
      ctx.motor.tiempoIniciar();
    }
  },
  preparar(ctx, preguntas, bloqueado) {
    const { carta, t } = ctx;
    if (!preguntas.length) throw new Error('Sin preguntas');
    t.secreto.preguntas = preguntas;
    t.secreto.registro = {};
    const progreso = {};
    ctx.participantes.forEach((eid) => { t.secreto.registro[eid] = []; t.privado[eid] = { registro: [] }; progreso[eid] = 0; });
    Object.assign(t.juego, {
      preguntas: preguntas.map((p) => ({ texto: p.texto, opciones: p.opciones, imagen: p.imagen, grande: p.grande, subtitulo: p.subtitulo })),
      progreso, cantidad: preguntas.length,
      minimo: carta.minimo || preguntas.length,
      duelo: esDuelo(ctx), masAciertos: !!carta.ganaMasAciertos,
      bloqueado: !!bloqueado,
      t0: Date.now(),
    });
    const panel = preguntas.map((p) => p.panel).filter(Boolean);
    t.secreto.panel = panel.length ? { canciones: panel } : { respuestas: preguntas.map((p) => p.respuesta) };
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'responder' || j.bloqueado) return;
    const reg = t.secreto.registro[eid];
    if (!reg || Number(d.pregunta) !== reg.length || reg.length >= j.cantidad) return;
    const p = t.secreto.preguntas[reg.length];
    const opcion = Number(d.opcion);
    if (!(opcion >= 0 && opcion < p.opciones.length)) return;
    const item = { opcion, correcta: p.opciones[opcion] === p.respuesta, t: Date.now() };
    reg.push(item);
    t.privado[eid].registro.push(item);
    j.progreso[eid] = reg.length;
    opcion_multiple.evaluar(ctx, false);
  },
  evaluar(ctx, porTiempo) {
    const { t } = ctx;
    const j = t.juego;
    const reg = t.secreto.registro;
    const aciertos = (eid) => reg[eid].filter((x) => x.correcta).length;
    const fin = (v) => {
      j.solucion = t.secreto.preguntas.map((p) => ({ respuesta: p.respuesta, explicacion: p.explicacion, cita: p.cita }));
      j.registros = reg;
      ctx.terminar(v);
    };
    if (!j.duelo) {
      const eid = ctx.participantes[0];
      const a = aciertos(eid), faltan = j.cantidad - reg[eid].length;
      if (a >= j.minimo) fin({ gana: [eid], pierde: [], texto: `¡${a} de ${j.cantidad} correctas! Ganaron` });
      else if (a + faltan < j.minimo || porTiempo) fin({ gana: [], pierde: [eid], texto: `${a} de ${j.cantidad} correctas. Necesitaban ${j.minimo}` });
      return;
    }
    const [A, B] = ctx.participantes;
    if (j.masAciertos) {
      const listos = ctx.participantes.every((e) => reg[e].length >= j.cantidad);
      if (!listos && !porTiempo) return;
      const aA = aciertos(A), aB = aciertos(B);
      let g = null;
      if (aA !== aB) g = aA > aB ? A : B;
      else {
        const tA = reg[A].length >= j.cantidad ? reg[A][reg[A].length - 1].t : Infinity;
        const tB = reg[B].length >= j.cantidad ? reg[B][reg[B].length - 1].t : Infinity;
        if (tA !== tB) g = tA < tB ? A : B;
      }
      const txt = `${ctx.nombre(A)}: ${aA} · ${ctx.nombre(B)}: ${aB}`;
      if (g) fin({ gana: [g], pierde: [otro(ctx, g)], texto: `¡Ganó ${ctx.nombre(g)}! (${txt})` });
      else fin({ gana: [], pierde: [], texto: `Empate (${txt})` });
      return;
    }
    // El primero que responda bien
    const correctos = ctx.participantes.filter((e) => reg[e][0]?.correcta).sort((x, y) => reg[x][0].t - reg[y][0].t);
    if (correctos.length) {
      const g = correctos[0];
      fin({ gana: [g], pierde: [otro(ctx, g)], texto: `¡${ctx.nombre(g)} respondió bien primero!` });
    } else if (porTiempo || ctx.participantes.every((e) => reg[e].length >= 1)) {
      fin({ gana: [], pierde: [], texto: 'Nadie acertó: se quedan donde están' });
    }
  },
  alTiempo(ctx) { opcion_multiple.evaluar(ctx, true); },
};

// ---------------------------------------------------------------- escribir
function generarOperacion([min, max]) {
  for (;;) {
    const forma = rand(0, 3);
    const a = rand(2, 9), b = rand(2, 9), c = rand(1, 15);
    let texto, r;
    if (forma === 0) { texto = `${a} × ${b} + ${c}`; r = a * b + c; }
    else if (forma === 1) { texto = `${a} × ${b} − ${c}`; r = a * b - c; }
    else if (forma === 2) { texto = `${c} + ${a} × ${b}`; r = c + a * b; }
    else { const d = rand(2, 5), e = rand(2, 3); texto = `${a} × ${b} − ${d} × ${e}`; r = a * b - d * e; }
    if (r >= min && r <= max) return { texto, respuesta: String(r), numero: true };
  }
}

function construirItems(ctx) {
  const { carta } = ctx;
  const n = carta.rondas || carta.cantidad || 1;
  if (carta.generador === 'operacion') return Array.from({ length: n }, () => generarOperacion(carta.rango || [5, 50]));
  if (carta.generador === 'nombre_cancion') {
    return ctx.tomar(carta.banco, n).map((c, k) => ({ texto: `Canción ${k + 1}: escuchen y escriban el nombre`, respuesta: c.nombre, aceptadas: c.aceptadas, panel: `${c.nombre}${c.artista ? ' (' + c.artista + ')' : ''}` }));
  }
  if (carta.id === 'M18') {
    const [it] = ctx.tomar('M18', 1);
    return [{ texto: 'Escriban la clave del candado', pistas: it.pistas, respuesta: it.respuesta, numero: true, cita: it.cita }];
  }
  return ctx.tomar(carta.banco, n).map((it) => ({ texto: it.contenido, respuesta: it.respuesta, aceptadas: it.aceptadas }));
}

const escribir = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    if (carta.lista) return escribir.iniciarLista(ctx);
    const items = construirItems(ctx);
    if (!items.length) throw new Error('Sin contenido');
    t.secreto.items = items;
    const duelo = esDuelo(ctx);
    t.juego = {
      items: items.map((i) => ({ texto: i.texto, pistas: i.pistas })),
      duelo, numero: !!carta.numero || items[0].numero,
      intentos: carta.intentos || null,
      minimo: carta.minimo || items.length,
    };
    ctx.participantes.forEach((eid) => { t.privado[eid] = {}; });
    if (duelo) {
      // oculta: primero leen la instrucción; la ronda aparece cuando el moderador da la señal
      Object.assign(t.juego, { ronda: 0, oculta: true, rondas: items.map(() => ({ ganador: null })), ganados: Object.fromEntries(ctx.participantes.map((e) => [e, 0])), necesarias: Math.floor(items.length / 2) + 1 });
      t.secreto.carreras = items.map(() => []);
    } else {
      t.juego.estados = items.map(() => 'pendiente');
      t.juego.intentosUsados = items.map(() => 0);
    }
    t.secreto.panel = items.some((i) => i.panel) ? { canciones: items.map((i) => i.panel) } : { respuestas: items.map((i) => `${i.texto} → ${i.respuesta}`) };
  },
  iniciarLista(ctx) {
    const { carta, t } = ctx;
    const [it] = ctx.tomar(carta.banco, 1);
    t.secreto.palabras = it.palabras;
    t.secreto.panel = { palabras: it.palabras };
    t.juego = { lista: true, estado: 'listo', total: it.palabras.length, encontradas: [], minimo: carta.minimo || 6, verSegundos: carta.verSegundos || 20 };
    ctx.participantes.forEach((eid) => { t.privado[eid] = {}; });
  },
  moderador(ctx, d) {
    const { t } = ctx;
    const j = t.juego;
    if (j.lista && d.tipo === 'mostrar' && j.estado === 'listo') {
      j.estado = 'mostrando';
      t.pantalla.lista = t.secreto.palabras;
      j.finVer = Date.now() + j.verSegundos * 1000;
      ctx.programar('ver', j.verSegundos * 1000, () => { j.estado = 'escribir'; t.pantalla.lista = null; });
    }
    if (j.duelo && d.tipo === 'mostrar' && j.oculta) {
      j.oculta = false;
      ctx.motor.tiempoIniciar();
    }
    if (j.duelo && d.tipo === 'siguiente_ronda' && j.entreRondas) {
      escribir.siguienteRonda(ctx);
      if (ctx.t.etapa === 'carta') ctx.motor.tiempoIniciar();
    }
    if (j.duelo && d.tipo === 'saltar_ronda' && !j.oculta) escribir.siguienteRonda(ctx);
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (j.lista) return escribir.accionLista(ctx, eid, d);
    if (j.duelo) return escribir.accionDuelo(ctx, eid, d);
    const idx = j.estados.indexOf('pendiente');
    if (idx < 0 || Number(d.idx) !== idx) return;
    if (d.tipo === 'saltar') { j.estados[idx] = 'saltada'; escribir.evaluar(ctx, false); return; }
    if (d.tipo !== 'responder') return;
    const it = t.secreto.items[idx];
    const texto = String(d.texto ?? '').slice(0, 80);
    const r = validar(texto, it);
    if (r === 'correcta') { j.estados[idx] = 'correcta'; feedback(ctx, eid, '¡Correcto!', 'bien'); }
    else if (r === 'dudosa') {
      j.estados[idx] = 'dudosa';
      ctx.dudosa({ equipoId: eid, texto, esperado: it.respuesta, t: Date.now(), ref: idx });
      feedback(ctx, eid, 'El moderador revisará esa respuesta. Sigan con la siguiente.');
    } else {
      j.intentosUsados[idx]++;
      if (j.intentos && j.intentosUsados[idx] >= j.intentos) { j.estados[idx] = 'fallida'; feedback(ctx, eid, 'Incorrecto. Se acabaron los intentos', 'mal'); }
      else feedback(ctx, eid, j.intentos ? `Incorrecto. Les queda ${j.intentos - j.intentosUsados[idx]} intento` : 'Incorrecto. Intenten otra vez o salten', 'mal');
    }
    escribir.evaluar(ctx, false);
  },
  evaluar(ctx, porTiempo) {
    const { t } = ctx;
    const j = t.juego;
    const eid = ctx.participantes[0];
    if (porTiempo) j.estados = j.estados.map((e) => (e === 'pendiente' ? 'fallida' : e));
    const correctas = j.estados.filter((e) => e === 'correcta').length;
    const abiertas = j.estados.filter((e) => e === 'pendiente' || e === 'dudosa').length;
    const fin = (v) => { j.solucion = t.secreto.items.map((i) => i.respuesta); ctx.terminar(v); };
    if (correctas >= j.minimo) fin({ gana: [eid], pierde: [], texto: `¡${correctas} de ${j.items.length} correctas! Ganaron` });
    else if (correctas + abiertas < j.minimo) fin({ gana: [], pierde: [eid], texto: `${correctas} de ${j.items.length} correctas. Necesitaban ${j.minimo}` });
  },
  accionDuelo(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'responder' || Number(d.idx) !== j.ronda || j.rondas[j.ronda].ganador || j.entreRondas || j.oculta) return;
    const it = t.secreto.items[j.ronda];
    const texto = String(d.texto ?? '').slice(0, 80);
    const r = validar(texto, it);
    const carrera = t.secreto.carreras[j.ronda];
    carrera.push({ eid, t: Date.now(), estado: r, texto });
    if (r === 'dudosa') {
      ctx.dudosa({ equipoId: eid, texto, esperado: it.respuesta, t: Date.now(), ref: `${j.ronda}:${carrera.length - 1}` });
      feedback(ctx, eid, 'El moderador está revisando su respuesta…');
    } else if (r === 'incorrecta') feedback(ctx, eid, 'Incorrecto. ¡Rápido, otra vez!', 'mal');
    escribir.resolverRonda(ctx);
  },
  resolverRonda(ctx) {
    const { t } = ctx;
    const j = t.juego;
    const { ganador, esperando } = resolverCarrera(t.secreto.carreras[j.ronda]);
    j.esperandoModerador = esperando;
    if (!ganador) return;
    j.rondas[j.ronda].ganador = ganador;
    j.rondas[j.ronda].respuesta = t.secreto.items[j.ronda].respuesta;
    j.ganados[ganador]++;
    feedback(ctx, ganador, '¡Ganaron la ronda!', 'bien');
    const rival = otro(ctx, ganador);
    if (rival) feedback(ctx, rival, `${ctx.nombre(ganador)} ganó la ronda`, 'mal');
    if (j.ganados[ganador] >= j.necesarias) {
      j.solucion = t.secreto.items.map((i) => i.respuesta);
      ctx.terminar({ gana: [ganador], pierde: rival ? [rival] : [], texto: `¡Ganó ${ctx.nombre(ganador)}! (${ctx.participantes.map((e) => `${ctx.nombre(e)} ${j.ganados[e]}`).join(' · ')})` });
      return;
    }
    // La siguiente ronda sale cuando el moderador hace clic en "Siguiente"; mientras, el reloj se pausa
    j.entreRondas = true;
    ctx.motor.tiempoPausar(true);
  },
  siguienteRonda(ctx) {
    const { t } = ctx;
    const j = t.juego;
    j.entreRondas = false;
    if (j.ronda + 1 >= j.items.length) {
      const [A, B] = ctx.participantes;
      const g = j.ganados[A] === j.ganados[B] ? null : (j.ganados[A] > j.ganados[B] ? A : B);
      j.solucion = t.secreto.items.map((i) => i.respuesta);
      if (g) ctx.terminar({ gana: [g], pierde: [otro(ctx, g)], texto: `¡Ganó ${ctx.nombre(g)}!` });
      else ctx.terminar({ gana: [], pierde: [], texto: 'Empate: se quedan donde están' });
      return;
    }
    j.ronda++;
    ctx.participantes.forEach((e) => { if (t.privado[e]) t.privado[e].feedback = null; });
  },
  accionLista(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (j.estado !== 'escribir') return;
    if (d.tipo === 'terminamos') return escribir.evaluarLista(ctx, true);
    if (d.tipo !== 'palabra') return;
    const texto = String(d.texto ?? '').slice(0, 40);
    const p = t.secreto.palabras.find((w) => !j.encontradas.includes(w) && validar(texto, { respuesta: w }) === 'correcta');
    if (p) { j.encontradas.push(p); feedback(ctx, eid, `¡${p}! Llevan ${j.encontradas.length}`, 'bien'); }
    else feedback(ctx, eid, `"${texto}" no estaba en la lista (o ya la escribieron)`, 'mal');
    escribir.evaluarLista(ctx, false);
  },
  evaluarLista(ctx, cerrar) {
    const { t } = ctx;
    const j = t.juego;
    const eid = ctx.participantes[0];
    const n = j.encontradas.length;
    j.solucion = t.secreto.palabras;
    if (n >= j.minimo) ctx.terminar({ gana: [eid], pierde: [], texto: `¡Recordaron ${n} de ${j.total}!` });
    else if (cerrar) ctx.terminar({ gana: [], pierde: [eid], texto: `Recordaron ${n} de ${j.total}. Necesitaban ${j.minimo}` });
    else delete j.solucion;
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    if (j.lista) { if (j.estado === 'escribir') escribir.evaluarLista(ctx, true); return; }
    if (!j.duelo) escribir.evaluar(ctx, true);
    // En duelos al acabar el tiempo decide el moderador
  },
  decidirDudosa(ctx, d, ok) {
    const { t } = ctx;
    const j = t.juego;
    if (j.duelo) {
      const [ronda, k] = String(d.ref).split(':').map(Number);
      const e = t.secreto.carreras[ronda]?.[k];
      if (!e || ronda !== j.ronda) return;
      e.estado = ok ? 'correcta' : 'incorrecta';
      if (!ok) feedback(ctx, d.equipoId, 'El moderador no la aceptó', 'mal');
      escribir.resolverRonda(ctx);
      return;
    }
    if (j.estados[d.ref] !== 'dudosa') return;
    j.estados[d.ref] = ok ? 'correcta' : 'fallida';
    feedback(ctx, d.equipoId, ok ? `El moderador aceptó "${d.texto}"` : `El moderador no aceptó "${d.texto}"`, ok ? 'bien' : 'mal');
    escribir.evaluar(ctx, false);
  },
};

// ---------------------------------------------------------------- ordenar
const ordenar = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    let orden, titulo;
    if (carta.generador === 'frases' || carta.generador === 'coro') {
      const [c] = ctx.tomar(carta.banco, 1);
      orden = carta.generador === 'frases' ? c.frases : c.coro;
      titulo = c.nombre;
    } else {
      const [it] = ctx.tomar(carta.banco, 1);
      orden = it.orden;
      titulo = 'Del más antiguo al más reciente';
    }
    if (!orden || orden.length < 2) throw new Error('Sin elementos para ordenar');
    t.secreto.orden = orden;
    t.secreto.panel = { orden };
    t.juego = { items: mezclarDistinto(orden), titulo };
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'enviar' || j.enviado) return;
    const idx = (d.orden || []).map(Number);
    if (idx.length !== j.items.length || new Set(idx).size !== idx.length) return;
    j.enviado = idx.map((i) => j.items[i]);
    j.solucion = t.secreto.orden;
    const bien = j.enviado.every((x, i) => x === t.secreto.orden[i]);
    const correctas = j.enviado.filter((x, i) => x === t.secreto.orden[i]).length;
    ctx.terminar(bien ? { gana: [eid], pierde: [], texto: '¡Orden perfecto!' } : { gana: [], pierde: [eid], texto: `El orden no es correcto (${correctas} de ${j.items.length} en su lugar)` });
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    if (!j.enviado) { j.solucion = ctx.t.secreto.orden; ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: 'Se acabó el tiempo' }); }
  },
};

// ---------------------------------------------------------------- secuencia en pantalla
const secuencia_pantalla = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const s = carta.secuencia;
    const banco = ctx.motor.datos.bancos[carta.banco] || [];
    t.juego = { tipo: s.tipo, estado: 'listo' };
    if (s.tipo === 'letras') {
      t.juego.items = muestra(banco, s.cantidad).map((x) => x.letra);
      t.secreto.panel = { letras: t.juego.items.join(' ') };
    } else if (s.tipo === 'texto') {
      const [it] = ctx.tomar(carta.banco, 1);
      t.pantalla.texto = it.texto;
      t.juego.duracion = s.duracion;
      t.secreto.panel = { pose: it.texto };
    } else if (s.tipo === 'poses') {
      // Fotos al azar; cada una aparece cuando el moderador da clic
      const poses = ctx.tomar(carta.banco, s.cantidad || 3);
      t.secreto.poses = poses.map((x) => x.imagen);
      t.juego.paso = 0;
      t.juego.total = poses.length;
      t.juego.duracion = s.duracion;
      t.pantalla.imagen = null;
    } else if (s.tipo === 'simon') {
      const simon = mezclar(banco.filter((x) => !x.trampa));
      const trampas = mezclar(banco.filter((x) => x.trampa));
      const nT = Math.min(trampas.length, rand(3, 4));
      t.juego.items = mezclar([...simon.slice(0, s.cantidad - nT), ...trampas.slice(0, nT)]).map((x) => x.texto);
      t.juego.intervalo = s.intervalo;
      t.juego.manual = !!s.manual; // manual: cada orden sale con un clic del moderador
      t.secreto.panel = { ordenes: t.juego.items.map((x) => (x.startsWith('Simón dice') ? x : `${x} (TRAMPA)`)) };
    } else if (s.tipo === 'acciones') {
      t.juego.items = muestra(banco, s.cantidad).map((x) => x.texto);
      t.juego.intervalo = s.intervalo;
      t.secreto.panel = { acciones: t.juego.items.map((x, i) => `${i + 1}. ${x}`) };
    } else if (s.tipo === 'escena') {
      const [it] = ctx.tomar(carta.banco, 1);
      const celdas = mezclar([0, 1, 2, 3, 4, 5]);
      t.pantalla.escena = it.emojis.map((emoji, i) => {
        const c = celdas[i];
        return { emoji, x: 18 + (c % 3) * 32 + rand(-6, 6), y: 28 + Math.floor(c / 3) * 44 + rand(-6, 6) };
      });
      t.secreto.panel = { escena: it.emojis.join(' ') };
      t.juego.duracion = s.duracion;
    } else if (s.tipo === 'que_falta') {
      const mostrados = muestra(banco, s.cantidad);
      const falta = azar(mostrados);
      const nunca = banco.filter((x) => !mostrados.includes(x));
      const distractores = mezclar([...nunca, ...mezclar(mostrados.filter((x) => x !== falta))]).slice(0, 3);
      t.pantalla.items = mostrados.map((x) => ({ emoji: x.emoji, nombre: x.nombre }));
      t.secreto.falta = mostrados.indexOf(falta);
      t.juego.duracion = s.duracion;
      opcion_multiple.preparar(ctx, [{
        texto: '¿Qué objeto falta?', opciones: mezclar([falta, ...distractores]).map((x) => `${x.emoji} ${x.nombre}`),
        respuesta: `${falta.emoji} ${falta.nombre}`,
      }], true);
      t.juego.tipo = 'que_falta';
      t.juego.estado = 'listo';
    }
  },
  moderador(ctx, d) {
    const { t } = ctx;
    const j = t.juego;
    if (j.tipo === 'poses') {
      const mostrarPose = () => {
        t.pantalla.imagen = t.secreto.poses[j.paso];
        j.estado = 'mostrando';
        j.finVer = Date.now() + j.duracion * 1000;
        ctx.programar('ver', j.duracion * 1000, () => { j.estado = 'oculto'; t.pantalla.imagen = null; });
      };
      if (d.tipo === 'mostrar' && j.estado === 'listo') mostrarPose();
      else if (d.tipo === 'siguiente' && ['oculto', 'revelado'].includes(j.estado) && j.paso + 1 < j.total) { j.paso++; mostrarPose(); }
      else if (d.tipo === 'revelar' && j.estado === 'oculto') { j.estado = 'revelado'; t.pantalla.imagen = t.secreto.poses[j.paso]; }
      return;
    }
    if (j.manual) {
      if (d.tipo === 'mostrar' && j.estado === 'listo') { j.estado = 'mostrando'; j.paso = 0; return; }
      if (d.tipo === 'siguiente' && j.estado === 'mostrando') {
        if (j.paso + 1 < j.items.length) j.paso++;
        else j.estado = 'terminado';
        return;
      }
      if (d.tipo !== 'revelar') return;
    }
    if (d.tipo === 'revelar') { j.estado = 'revelado'; j.paso = j.items ? j.items.length : 0; return; }
    if (d.tipo !== 'mostrar' || j.estado === 'mostrando') return;
    j.estado = 'mostrando';
    j.inicio = Date.now();
    if (j.tipo === 'letras') return;
    if (j.tipo === 'texto' || j.tipo === 'escena') {
      j.finVer = Date.now() + j.duracion * 1000;
      ctx.programar('ver', j.duracion * 1000, () => { j.estado = 'oculto'; });
      return;
    }
    if (j.tipo === 'simon' || j.tipo === 'acciones') {
      j.paso = 0;
      const avanzar = () => {
        j.paso++;
        if (j.paso >= j.items.length) { ctx.programar('fin', j.intervalo * 1000, () => { j.estado = 'terminado'; }); return; }
        ctx.programar('paso', j.intervalo * 1000, avanzar);
      };
      ctx.programar('paso', j.intervalo * 1000, avanzar);
      return;
    }
    if (j.tipo === 'que_falta') {
      j.finVer = Date.now() + j.duracion * 1000;
      ctx.programar('ver', j.duracion * 1000, () => {
        j.estado = 'pregunta';
        j.bloqueado = false;
        t.pantalla.items = t.pantalla.items.map((x, i) => (i === t.secreto.falta ? null : x));
      });
    }
  },
  accion(ctx, eid, d) { if (ctx.t.juego.tipo === 'que_falta') opcion_multiple.accion(ctx, eid, d); },
  alTiempo(ctx) { if (ctx.t.juego.tipo === 'que_falta' && ctx.t.juego.estado === 'pregunta') opcion_multiple.evaluar(ctx, true); },
};

// ---------------------------------------------------------------- especial (Silla musical)
const especial = {
  iniciar(ctx) { ctx.t.juego = { todos: true }; },
};

// ---------------------------------------------------------------- sopa de letras
const sopa_letras = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const [it] = ctx.tomar(carta.banco, 1);
    const { grid, colocadas } = generarSopa(it.palabras, 12);
    t.secreto.colocadas = colocadas;
    t.secreto.panel = { palabras: it.palabras };
    t.juego = { grid, palabras: it.palabras.map(limpiar), encontradas: [], minimo: carta.minimo || it.palabras.length };
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'marcar' || !Array.isArray(d.a) || !Array.isArray(d.b)) return;
    const s = leerLinea(j.grid, d.a.map(Number), d.b.map(Number));
    if (!s) { feedback(ctx, eid, 'Marquen en línea recta', 'mal'); return; }
    const rev = [...s].reverse().join('');
    const w = j.palabras.find((p) => (p === s || p === rev) && !j.encontradas.some((e) => e.palabra === p));
    if (!w) { feedback(ctx, eid, 'Esa no es', 'mal'); return; }
    j.encontradas.push({ palabra: w, a: d.a, b: d.b });
    feedback(ctx, eid, `¡${w}!`, 'bien');
    if (j.encontradas.length >= j.minimo) {
      j.solucion = t.secreto.colocadas;
      ctx.terminar({ gana: [eid], pierde: [], texto: `¡Encontraron ${j.encontradas.length} de ${j.palabras.length}!` });
    }
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    j.solucion = ctx.t.secreto.colocadas;
    ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: `Encontraron ${j.encontradas.length} de ${j.palabras.length}. Necesitaban ${j.minimo}` });
  },
};

// ---------------------------------------------------------------- ahorcado
const soloLetras = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-ZÑ]/g, '');
const ahorcado = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const [it] = ctx.tomar(carta.banco, 1);
    const frase = String(it.palabra).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    t.secreto.frase = frase;
    t.secreto.panel = { frase, cita: it.cita };
    t.juego = { mascara: frase.replace(/[A-ZÑ]/g, '_'), usadas: [], errores: 0, max: carta.errores || 6, cita: null };
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    const frase = t.secreto.frase;
    if (d.tipo === 'letra') {
      const L = String(d.letra || '').toUpperCase();
      if (!/^[A-ZÑ]$/.test(L) || j.usadas.includes(L)) return;
      j.usadas.push(L);
      if (frase.includes(L)) j.mascara = [...frase].map((ch, i) => (ch === L ? ch : j.mascara[i])).join('');
      else j.errores++;
    } else if (d.tipo === 'resolver') {
      if (soloLetras(d.texto) === soloLetras(frase)) j.mascara = frase;
      else { j.errores++; feedback(ctx, eid, `"${String(d.texto).slice(0, 40)}" no es. Se suma un error`, 'mal'); }
    } else return;
    if (!j.mascara.includes('_')) { j.solucion = frase; j.cita = t.secreto.panel.cita; ctx.terminar({ gana: [eid], pierde: [], texto: `¡Lo lograron: ${frase}!` }); }
    else if (j.errores >= j.max) { j.solucion = frase; j.cita = t.secreto.panel.cita; ctx.terminar({ gana: [], pierde: [eid], texto: `El muñeco quedó completo. Era: ${frase}` }); }
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    j.solucion = ctx.t.secreto.frase;
    ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: `Se acabó el tiempo. Era: ${j.solucion}` });
  },
};

// ---------------------------------------------------------------- rompecabezas
const rompecabezas = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const [it] = ctx.tomar(carta.banco, 1);
    const perm = mezclarDistinto([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    t.secreto.item = it;
    t.secreto.panel = { escena: it.palabra };
    t.secreto.carrera = [];
    t.juego = { imagen: it.imagen, equipos: {} };
    ctx.participantes.forEach((eid) => {
      t.juego.equipos[eid] = { perm: [...perm], armado: false, correctas: perm.filter((p, i) => p === i).length };
      t.privado[eid] = {};
    });
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const e = t.juego.equipos[eid];
    if (!e) return;
    if (d.tipo === 'cambiar' && !e.armado) {
      const a = Number(d.a), b = Number(d.b);
      if (!(a >= 0 && a < 9 && b >= 0 && b < 9) || a === b) return;
      [e.perm[a], e.perm[b]] = [e.perm[b], e.perm[a]];
      e.correctas = e.perm.filter((p, i) => p === i).length;
      e.armado = e.correctas === 9;
      if (e.armado) feedback(ctx, eid, '¡Armado! Ahora escriban qué escena es', 'bien');
    } else if (d.tipo === 'nombre' && e.armado) {
      const it = t.secreto.item;
      const texto = String(d.texto ?? '').slice(0, 60);
      const r = validar(texto, { respuesta: it.palabra, aceptadas: it.aceptadas });
      t.secreto.carrera.push({ eid, t: Date.now(), estado: r, texto });
      if (r === 'dudosa') {
        ctx.dudosa({ equipoId: eid, texto, esperado: it.palabra, t: Date.now(), ref: t.secreto.carrera.length - 1 });
        feedback(ctx, eid, 'El moderador está revisando su respuesta…');
      } else if (r === 'incorrecta') feedback(ctx, eid, 'No es esa escena. ¡Intenten otra vez!', 'mal');
      rompecabezas.evaluar(ctx);
    }
  },
  evaluar(ctx) {
    const { t } = ctx;
    const { ganador, esperando } = resolverCarrera(t.secreto.carrera);
    t.juego.esperandoModerador = esperando;
    if (ganador) {
      t.juego.solucion = t.secreto.item.palabra;
      ctx.terminar({ gana: [ganador], pierde: otro(ctx, ganador) ? [otro(ctx, ganador)] : [], texto: `¡${ctx.nombre(ganador)} armó "${t.secreto.item.palabra}"!` });
    }
  },
  decidirDudosa(ctx, d, ok) {
    const e = ctx.t.secreto.carrera[d.ref];
    if (!e) return;
    e.estado = ok ? 'correcta' : 'incorrecta';
    if (!ok) feedback(ctx, d.equipoId, 'El moderador no la aceptó. ¡Intenten otra vez!', 'mal');
    rompecabezas.evaluar(ctx);
  },
  alTiempo(ctx) {
    if (!esDuelo(ctx)) ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: 'Se acabó el tiempo' });
  },
};

// ---------------------------------------------------------------- mosaico
const mosaico = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const emojis = ctx.motor.datos.bancos[carta.banco].map((x) => x.emoji);
    const grid = muestra(emojis, 9);
    t.secreto.grid = grid;
    t.secreto.panel = { mosaico: [grid.slice(0, 3).join(' '), grid.slice(3, 6).join(' '), grid.slice(6).join(' ')] };
    t.juego = { estado: 'listo', paleta: emojis, minimo: carta.minimo || 8, verSegundos: carta.verSegundos || 15 };
  },
  moderador(ctx, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'mostrar' || j.estado !== 'listo') return;
    j.estado = 'mostrando';
    j.finVer = Date.now() + j.verSegundos * 1000;
    t.pantalla.grid = t.secreto.grid;
    ctx.programar('ver', j.verSegundos * 1000, () => { j.estado = 'responder'; t.pantalla.grid = null; });
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'enviar' || j.estado !== 'responder' || !Array.isArray(d.grid) || d.grid.length !== 9) return;
    j.enviado = d.grid.map(String);
    j.solucion = t.secreto.grid;
    const n = j.enviado.filter((x, i) => x === t.secreto.grid[i]).length;
    j.correctas = n;
    ctx.terminar(n >= j.minimo ? { gana: [eid], pierde: [], texto: `¡${n} de 9 casillas correctas!` } : { gana: [], pierde: [eid], texto: `${n} de 9 casillas correctas. Necesitaban ${j.minimo}` });
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    if (j.estado === 'responder' && !j.enviado) { j.solucion = ctx.t.secreto.grid; ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: 'Se acabó el tiempo' }); }
  },
};

// ---------------------------------------------------------------- concéntrese
const concentrese = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const emojis = ctx.motor.datos.bancos[carta.banco].map((x) => x.emoji);
    const seis = muestra(emojis, 6);
    const cartas = mezclar([...seis, ...seis]);
    t.secreto.cartas = cartas;
    t.secreto.panel = { parejas: seis.join(' ') };
    t.juego = { estado: 'listo', caras: Array(12).fill(null), emparejadas: [], volteadas: [], intentos: 0, verSegundos: carta.verSegundos || 15 };
  },
  moderador(ctx, d) {
    const { t } = ctx;
    const j = t.juego;
    if (d.tipo !== 'mostrar' || j.estado !== 'listo') return;
    j.estado = 'mostrando';
    j.finVer = Date.now() + j.verSegundos * 1000;
    t.pantalla.cartas = t.secreto.cartas;
    ctx.programar('ver', j.verSegundos * 1000, () => { j.estado = 'jugando'; t.pantalla.cartas = null; });
  },
  accion(ctx, eid, d) {
    const { t } = ctx;
    const j = t.juego;
    const i = Number(d.i);
    if (d.tipo !== 'voltear' || j.estado !== 'jugando' || j.bloqueado) return;
    if (!(i >= 0 && i < 12) || j.emparejadas.includes(i) || j.volteadas.includes(i)) return;
    j.volteadas.push(i);
    j.caras[i] = t.secreto.cartas[i];
    if (j.volteadas.length < 2) return;
    j.intentos++;
    const [a, b] = j.volteadas;
    if (t.secreto.cartas[a] === t.secreto.cartas[b]) {
      j.emparejadas.push(a, b);
      j.volteadas = [];
      if (j.emparejadas.length === 12) ctx.terminar({ gana: [eid], pierde: [], texto: `¡Encontraron las 6 parejas en ${j.intentos} intentos!` });
    } else {
      j.bloqueado = true;
      ctx.programar('ocultar', 1100, () => {
        j.caras[a] = null; j.caras[b] = null; j.volteadas = []; j.bloqueado = false;
      });
    }
  },
  alTiempo(ctx) {
    const j = ctx.t.juego;
    j.caras = ctx.t.secreto.cartas;
    ctx.terminar({ gana: [], pierde: [ctx.participantes[0]], texto: `Se acabó el tiempo: encontraron ${j.emparejadas.length / 2} de 6 parejas` });
  },
};

// ---------------------------------------------------------------- automática
const automatica = {
  iniciar(ctx) {
    const { carta, t } = ctx;
    const texto = ctx.aplicarEfecto(carta.efecto, ctx.equipoId);
    t.juego.texto = texto;
    const tipo = carta.tipo === 'Bonus' ? 'gano' : carta.tipo === 'Penitencia' ? 'perdio' : 'neutral';
    ctx.terminar({ gana: [], pierde: [], sinMovimiento: true, tipo, texto });
  },
};

// ---------------------------------------------------------------- elección
const eleccion = {
  iniciar(ctx) {
    const { carta, t, motor } = ctx;
    const eid = ctx.equipoId;
    const q = motor.eq(eid);
    let opciones = [];
    if (carta.efecto === 'intercambio' || carta.efecto === 'ustedes_deciden') {
      opciones = motor.activos().filter((x) => x.id !== eid).map((x) => ({ valor: x.id, texto: x.nombre, detalle: `${x.camino} · casilla ${x.casilla}`, personaje: x.personaje }));
    } else if (carta.efecto === 'atajo') {
      opciones = Object.keys(motor.datos.tablero).filter((c) => c !== q.camino && !motor.caminoLleno(c, eid)).map((c) => ({ valor: c, texto: c, detalle: `casilla ${q.casilla}` }));
    }
    const elegir = carta.efecto === 'ustedes_deciden' ? 2 : 1;
    if (opciones.length < elegir) {
      ctx.terminar({ gana: [], pierde: [], sinMovimiento: true, texto: 'No hay suficientes equipos para esta carta' });
      return;
    }
    t.juego = { efecto: carta.efecto, opciones, elegir };
  },
  accion(ctx, eid, d) {
    const { t, motor } = ctx;
    const j = t.juego;
    if (d.tipo !== 'elegir' || j.elegido) return;
    const valores = (d.valores || []).map(String);
    if (valores.length !== j.elegir || new Set(valores).size !== valores.length) return;
    if (!valores.every((v) => j.opciones.some((o) => o.valor === v))) return;
    j.elegido = valores;
    const actor = ctx.equipoId;
    if (j.efecto === 'intercambio') {
      ctx.terminar({ gana: [], pierde: [], sinMovimiento: true, texto: ctx.aplicarEfecto('intercambio', actor, { con: valores[0] }) });
    } else if (j.efecto === 'atajo') {
      ctx.terminar({ gana: [], pierde: [], sinMovimiento: true, texto: ctx.aplicarEfecto('atajo', actor, { camino: valores[0] }) });
    } else if (j.efecto === 'ustedes_deciden') {
      t.duelo = valores;
      t.jueces = actor;
      t.avisos.push(`${motor.nombre(actor)} son los jueces del duelo entre ${valores.map((v) => motor.nombre(v)).join(' y ')}`);
      const [id] = ctx.sacarCartas('Random', 'Duelo', 1);
      ctx.iniciarCarta(id);
    }
  },
};

const MODOS = {
  presencial, palabra_secreta, opcion_multiple, escribir, ordenar, secuencia_pantalla,
  especial, sopa_letras, ahorcado, rompecabezas, mosaico, concentrese, automatica, eleccion,
};

module.exports = { MODOS, BANDERAS, generarOperacion };
