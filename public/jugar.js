/* Celular de cada equipo */
(function () {
  const { h, CAMINOS, TIPOS, ICONOS_OP, avatar, dado, htmlCarta, pintar } = RT;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const params = new URLSearchParams(location.search);
  const CODIGO_URL = (params.get('c') || '').toUpperCase();
  let token = localStorage.getItem('rt-token');
  let socket = conectar();
  let V = null;
  let personajes = [];
  let caminosInfo = [];
  // Estado local de la interfaz (se reinicia en cada turno/carta)
  let L = nuevoLocal();
  let clave = null;
  let error = '';
  let personajeSel = null;

  function nuevoLocal() {
    return { ver: false, orden: [], sopaIni: null, rompeSel: null, mosaico: Array(9).fill(null), mosaicoSel: 0, eleccion: [], rodando: false, cartaSel: null };
  }

  function conectar() {
    const s = RT.conectar((cb) => cb({ rol: 'jugador', token }));
    s.on('estado', (v) => { V = v; render(); });
    s.on('sesion_vencida', () => { localStorage.removeItem('rt-token'); token = null; });
    s.on('timbre', () => { if (navigator.vibrate) navigator.vibrate([300, 100, 300]); RT.toast('⏰ ¡Se acabó el tiempo!'); });
    return s;
  }
  function reconectarCon(nuevo) {
    token = nuevo;
    if (nuevo) localStorage.setItem('rt-token', nuevo); else localStorage.removeItem('rt-token');
    socket.disconnect();
    socket = conectar();
  }

  fetch('/api/datos').then((r) => r.json()).then((d) => { personajes = d.personajes; caminosInfo = d.caminos; render(); });

  const enviar = (tipo, extra = {}) => socket.emit('accion', { tipo, ...extra });
  const juego = (datos) => enviar('juego', { datos });
  const yo = () => (V ? RT.equipo(V, V.yo) : null);

  // ---------- Pantallas ----------
  function render() {
    if (!V) return;
    const q = yo();
    renderCabecera(q);
    let html;
    if (!q) html = pantallaEntrar();
    else if (V.fase === 'lobby' || V.fase === 'instructivo') html = pantallaEspera(q);
    else if (V.fase === 'quien_empieza') html = pantallaInicio(q);
    else if (V.fase === 'eleccion_camino') html = pantallaCamino(q);
    else if (V.fase === 'juego') html = pantallaJuego(q);
    else if (V.fase === 'final') html = pantallaFinal(q);
    pintar(app, html || '');
    tick();
  }

  function renderCabecera(q) {
    if (!q) { pintar($('#cabecera'), ''); return; }
    const c = CAMINOS[q.camino];
    pintar($('#cabecera'), `${avatar(q.personaje, 44)}<div><div class="n">${h(q.nombre)}</div><div class="c">${c ? `<span style="color:${c.color};vertical-align:-3px">${RT.svgIcono(c.svg, 15, 2.6)}</span> ${h(q.camino)} · casilla ${Math.min(q.casilla, 10)}/10` : `Código del equipo: ${h(q.codigoEquipo || '')}`}</div></div><div class="bon emoji">${(q.bonus || []).map((b) => b.icono).join('')}</div>`);
  }

  function pantallaEntrar() {
    const tomados = V.equipos.map((q) => q.personaje);
    const codigoOk = CODIGO_URL && CODIGO_URL === V.codigo;
    if (V.fase !== 'lobby') {
      return `<div class="centro">
        <div class="arcade" style="font-size:30px">RUMBO AL TROFEO</div>
        <div class="emoji" style="font-size:70px">📺</div>
        <div class="t2">La partida ya empezó</div>
        <p class="sub">Pueden ver el tablero en la pantalla.<br>Si ya tenían equipo, entren con su código:</p>
        ${formRecuperar()}
        ${error ? `<div class="error">${h(error)}</div>` : ''}
      </div>`;
    }
    return `<div class="pila">
      <div class="arcade" style="font-size:32px;text-align:center;margin-top:8px">RUMBO AL TROFEO 🏆</div>
      ${codigoOk ? '' : `<div><label>Código de la partida (está en la pantalla)</label><input id="in-codigo" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" value="${h(CODIGO_URL)}" placeholder="Ej: K7PX"></div>`}
      <div><label>Nombre del equipo</label><input id="in-nombre" type="text" maxlength="22" autocomplete="off" placeholder="Ej: Los Leones" data-enter="unirse"></div>
      <div><label>Elijan su personaje</label>
        <div class="personajes">${personajes.map((p) => `<div class="pj ${tomados.includes(p.archivo) ? 'tomado' : ''} ${personajeSel === p.archivo ? 'sel' : ''}" data-acc="pj" data-pj="${h(p.archivo)}" title="${h(p.nombre)}">${avatar(p.archivo, 60)}</div>`).join('')}</div>
      </div>
      ${error ? `<div class="error">${h(error)}</div>` : ''}
      <button class="btn verde grande bloque" data-acc="unirse">¡ENTRAR!</button>
      <details><summary>¿Ya tenían equipo? Entren con su código</summary><div style="margin-top:10px">${formRecuperar()}</div></details>
    </div>`;
  }
  function formRecuperar() {
    return `<div class="fila" style="width:100%"><input id="in-cod-eq" type="tel" maxlength="3" placeholder="Código de 3 números" data-enter="recuperar"><button class="btn azul" data-acc="recuperar">Entrar</button></div>`;
  }

  function pantallaEspera(q) {
    return `<div class="centro">
      <div class="flotar">${avatar(q.personaje, 150)}</div>
      <div class="t1">${h(q.nombre)}</div>
      <div class="t2 latido" style="color:var(--cian)">Esperando a que inicie el juego</div>
      <p class="sub">${V.fase === 'instructivo' ? '👀 Miren la pantalla: el moderador está explicando cómo se juega' : 'Miren la pantalla mientras entran los demás equipos'}</p>
      <div class="panel" style="padding:14px 20px"><div class="sub">Código de su equipo (por si se sale el celular)</div><div class="codigo-eq">${h(q.codigoEquipo)}</div></div>
      <button class="btn gris chico" data-acc="salir">Salir de este equipo</button>
    </div>`;
  }

  function pantallaInicio(q) {
    const ini = V.inicio;
    if (!ini) return '';
    const mia = ini.respuestas[q.id];
    if (ini.estado === 'pregunta') {
      if (mia) return `<div class="centro"><div class="emoji" style="font-size:80px">✅</div><div class="t1">¡Respuesta enviada!</div><p class="sub">Miren la pantalla</p></div>`;
      return `<div class="centro" style="justify-content:flex-start">
        <div class="t1">Selecciona la respuesta correcta</div>
        <p class="sub">La pregunta está en la pantalla. ¡Gana el más rápido!</p>
        <div class="colores">${[0, 1, 2, 3].map((i) => `<button class="color-btn op-${i}" data-acc="inicio" data-i="${i}">${ICONOS_OP[i]}</button>`).join('')}</div>
      </div>`;
    }
    if (ini.estado === 'nadie') return `<div class="centro"><div class="emoji" style="font-size:80px">🤔</div><div class="t1">¡Nadie acertó!</div><p class="sub">Atentos: viene la pregunta de desempate</p></div>`;
    const pos = ini.orden.indexOf(q.id) + 1;
    const acerto = mia && mia.opcion === ini.correcta;
    return `<div class="centro"><div class="emoji" style="font-size:80px">${ini.sorteo ? '🎲' : acerto ? '🎉' : '😅'}</div>
      <div class="t1">${ini.sorteo ? 'El orden se sorteó' : acerto ? '¡Correcto!' : 'Esta vez no'}</div>
      <div class="hex" style="width:90px;height:100px;font-size:40px">${pos}°</div>
      <p class="sub">Ese es su lugar en el orden de turnos</p></div>`;
  }

  function pantallaCamino(q) {
    return `<div class="pila">
      <div class="t1">Elijan su camino</div>
      <p class="sub">Pueden cambiarlo hasta que el moderador empiece el juego. Máximo 2 equipos por camino.</p>
      <div class="caminos">${caminosInfo.map((c) => {
        const info = CAMINOS[c.nombre];
        const otros = V.equipos.filter((x) => x.camino === c.nombre && x.id !== q.id);
        const lleno = otros.length >= 2;
        return `<button class="camino-btn ${q.camino === c.nombre ? 'sel' : ''} ${lleno ? 'lleno' : ''}" style="--c:${info.color}" data-acc="camino" data-c="${h(c.nombre)}" ${lleno ? 'disabled' : ''}><span class="ico-cam">${RT.svgIcono(info.svg, 40, 2.2)}</span>${h(c.nombre)}<small>${lleno ? '🔒 Lleno' : h(c.tema)}</small>${otros.length ? `<small>${otros.map((x) => h(x.nombre)).join(', ')}</small>` : ''}</button>`;
      }).join('')}</div>
      ${q.camino ? `<div class="feedback bien">Eligieron ${h(q.camino)}. ¡Esperen la señal!</div>` : ''}
    </div>`;
  }

  function pantallaFinal(q) {
    const f = V.final;
    if (!f) return '';
    const gane = f.ganadores.includes(q.id);
    const pos = f.tabla.indexOf(q.id) + 1;
    const gan = f.ganadores.map((id) => RT.equipo(V, id)).filter(Boolean);
    return `<div class="centro">
      <div class="arcade" style="font-size:44px">${f.empate ? '¡EMPATE!' : gane ? '¡GANARON!' : 'GAME OVER'}</div>
      ${gan.map((g) => `<div class="flotar">${avatar(g.personaje, 130)}</div><div class="t1">${h(g.nombre)}</div>`).join('')}
      <p class="sub">${f.empate ? 'Se decide con un duelo' : gane ? '¡Llegaron al trofeo! 🏆' : `Quedaron de ${pos}° lugar`}</p>
    </div>`;
  }

  // ---------- Juego ----------
  function pantallaJuego(q) {
    const t = V.turno;
    if (!t) return '';
    const k = `${t.n}|${t.carta ? t.carta.id : ''}`;
    if (k !== clave) { clave = k; L = nuevoLocal(); }
    const turnoQ = RT.equipo(V, t.equipoId);
    const esMio = t.equipoId === q.id;
    const yoTiro = t.tiraEquipoId === q.id;
    const retado = t.duelo && t.duelo.includes(q.id) && !esMio;

    if (t.etapa === 'dado') {
      if (yoTiro) {
        return `<div class="centro mi-turno" style="padding:20px">
          <div class="t1">${esMio ? '¡Es su turno!' : `¡Tiren el dado por ${h(turnoQ.nombre)}!`}</div>
          ${(t.avisos || []).map((a) => `<div class="feedback info">${h(a)}</div>`).join('')}
          <button class="dado-btn" data-acc="dado" ${L.rodando ? 'disabled' : ''}>${dado(L.rodando ? 3 : 1, L.rodando ? 'rodando' : 'latido')}</button>
          <button class="btn verde grande" data-acc="dado" ${L.rodando ? 'disabled' : ''}>${L.rodando ? 'Tirando…' : 'TIRAR EL DADO'}</button>
        </div>`;
      }
      return esperaTurno(turnoQ, 'va a tirar el dado');
    }
    if (t.etapa === 'eleccion_dado') {
      if (esMio) return `<div class="centro"><div class="t1">🎲 Doble dado</div><p class="sub">Elijan el resultado</p><div class="fila">${t.dados.map((n, i) => `<button class="dado-btn" data-acc="elegir_dado" data-i="${i}">${dado(n, 'rebote')}</button>`).join('')}</div></div>`;
      return esperaTurno(turnoQ, 'está eligiendo su dado');
    }
    if (t.etapa === 'casilla') {
      const ti = TIPOS[t.casillaTipo] || TIPOS.Reto;
      if (esMio) return `<div class="centro">${t.dado ? dado(t.dado, 'rebote') : ''}<div class="t1">${t.dado ? `Avanzaron ${t.dado} casilla${t.dado > 1 ? 's' : ''}` : ''}</div><div class="t1" style="color:${ti.color}">Cayeron en ${ti.icono} ${h(t.casillaTipo).toUpperCase()}</div><p class="sub">Miren cómo se mueve su ficha en la pantalla</p></div>`;
      return esperaTurno(turnoQ, `avanza ${t.dado || ''} → ${ti.icono} ${h(t.casillaTipo)}`);
    }
    if (t.etapa === 'elegir_rival') {
      if (esMio) {
        return `<div class="pila"><div class="t1" style="color:var(--rojo)">⚔️ Cayeron en DUELO</div><p class="sub">¿Contra qué equipo juegan?</p>
          ${t.rivales.map((id) => { const r = RT.equipo(V, id); return `<button class="rival-btn" data-acc="rival" data-id="${h(id)}">${avatar(r.personaje, 50)} ${h(r.nombre)}</button>`; }).join('')}</div>`;
      }
      return esperaTurno(turnoQ, 'está eligiendo contra quién juega un duelo… ⚔️');
    }
    if (t.etapa === 'elegir_carta') {
      const ti = TIPOS[t.casillaTipo] || TIPOS.Reto;
      if (esMio) {
        return `<div class="pila"><div class="t1" style="color:${ti.color}">Cayeron en ${ti.icono} ${h(t.casillaTipo).toUpperCase()}</div>
          ${t.duelo ? `<p class="sub">Duelo contra ${h(RT.equipo(V, t.duelo[1])?.nombre)}</p>` : ''}
          <p class="sub">Toquen una carta</p>
          <div class="dorsos-cel">${Array.from({ length: t.numOpciones }, (_, i) => `<div class="carta-dorso voltear-in" style="animation-delay:${i * 0.1}s" data-acc="carta" data-i="${i}">?</div>`).join('')}</div></div>`;
      }
      if (retado) return `<div class="centro"><div class="te-retaron latido">¡Te retaron!</div><div class="emoji" style="font-size:90px">⚔️</div><p class="sub">${h(turnoQ.nombre)} los retó a un duelo y está eligiendo la carta</p></div>`;
      return esperaTurno(turnoQ, 'está eligiendo una carta');
    }
    if (t.etapa === 'carta') return pantallaCarta(q, t, turnoQ, esMio, retado);
    if (t.etapa === 'resultado') return pantallaResultado(q, t, turnoQ);
    return '';
  }

  function esperaTurno(turnoQ, que) {
    return `<div class="centro"><div class="sub">Turno de</div>${avatar(turnoQ.personaje, 110)}<div class="t1">${h(turnoQ.nombre)}</div><p class="sub">${que}</p><p class="sub">👀 Miren la pantalla</p></div>`;
  }

  const INTERACTIVOS = ['opcion_multiple', 'escribir', 'ordenar', 'sopa_letras', 'ahorcado', 'rompecabezas', 'mosaico', 'concentrese', 'eleccion'];

  function pantallaCarta(q, t, turnoQ, esMio, retado) {
    const c = t.carta;
    const j = t.juego || {};
    const participa = c.modo === 'eleccion' ? esMio : c.modo === 'especial' ? true : (t.participantes || []).includes(q.id);
    let html = '';
    if (retado) html += `<div class="te-retaron">¡Te retaron!</div><p class="sub" style="margin-top:-6px">Duelo contra ${h(RT.equipo(V, t.duelo.find((x) => x !== q.id))?.nombre)}</p>`;
    if (t.jueces === q.id) html += `<div class="feedback info">🧑‍⚖️ Ustedes son los jueces de este duelo</div>`;
    if (j.villano && j.villano.id === q.id) html += `<div class="feedback mal">😈 ¡Ustedes son el villano! Escojan a una persona</div>`;
    if (!participa) {
      html += `<div class="sub">Turno de ${h(turnoQ.nombre)}</div><div class="carta-mini">${TIPOS[c.tipo]?.icono || ''} <b>${h(c.nombre)}</b></div><div class="centro" style="min-height:40dvh"><div class="emoji" style="font-size:70px">👀</div><div class="t2">Miren la pantalla</div></div>`;
      return `<div class="pila">${html}</div>`;
    }
    (t.avisos || []).forEach((a) => { html += `<div class="feedback info">${h(a)}</div>`; });
    const reloj = V.temporizador && V.temporizador.totalMs > 0 ? `<div class="fila" style="justify-content:center;font-family:var(--titulo);font-size:26px">⏱️ <span data-reloj>--</span></div>` : '';
    const ui = modoUI(q, t, c, j, t.privado || {});
    if (INTERACTIVOS.includes(c.modo) || (c.modo === 'secuencia_pantalla' && j.tipo === 'que_falta' && j.estado === 'pregunta')) {
      html += `<div class="carta-mini">${TIPOS[c.tipo]?.icono || ''} <b>${h(c.nombre)}</b></div>${reloj}${ui}<details><summary>Ver la carta completa</summary><div style="margin-top:10px">${htmlCarta(c)}</div></details>`;
    } else {
      html += `${htmlCarta(c, { clase: 'voltear-in' })}${reloj}${ui}`;
    }
    return `<div class="pila">${html}</div>`;
  }

  function fb(p) {
    return p && p.feedback ? `<div class="feedback ${h(p.feedback.tipo)}" data-n="${p.feedback.n}">${h(p.feedback.texto)}</div>` : '';
  }
  const campo = (tipo, placeholder, numero, extra = '') => `<div class="fila"><input id="in-resp" type="${numero ? 'tel' : 'text'}" autocomplete="off" placeholder="${h(placeholder)}" data-enter="texto" ${extra}><button class="btn verde" data-acc="texto" data-tipo="${tipo}">Enviar</button></div>`;

  function modoUI(q, t, c, j, p) {
    switch (c.modo) {
      case 'presencial':
        return `<div class="feedback info">¡Hagan el reto! ${c.tipo === 'Penitencia' ? 'El moderador marca si la cumplieron.' : 'El moderador decide.'}</div>`;
      case 'especial':
        return `<div class="feedback info">🪑 ¡Juegan todos los equipos! Elijan 2 participantes y vayan al centro.</div>`;
      case 'palabra_secreta': {
        if (j.enPanel) return `<div class="feedback info">🤫 El moderador tiene la palabra. ¡Prepárense!</div>`;
        const lista = p.palabras || [];
        const i = (j.idx || {})[q.id] || 0;
        const w = lista[i];
        if (!w) return '';
        const cosa = c.camino === 'Música' ? 'Canción' : 'Palabra';
        let html = `<div class="sub">${cosa} ${i + 1} de ${lista.length} · ${j.adivinadorEscribe ? 'el adivinador NO debe mirar' : 'que no la vea quien adivina'}</div>
          <div class="secreto ${L.ver ? '' : 'tapado'}" data-acc="ver">${L.ver
            ? `<div class="palabra">${h(w.palabra)}</div>${w.nota && !/^(Personaje|Profesión|Palabra difícil)/.test(w.nota) ? `<div class="nota">${h(w.nota)}</div>` : w.nota ? `<div class="nota">${h(w.nota)}</div>` : ''}${w.prohibidas ? `<div class="prohibidas">${w.prohibidas.map((x) => `<span>${h(x)}</span>`).join('')}</div><div class="nota">No pueden decir estas palabras</div>` : ''}<div class="nota">(toquen para tapar)</div>`
            : '<div class="palabra">🤫 Toquen para ver</div>'}</div>`;
        if (i < lista.length - 1) html += `<button class="btn morado bloque" data-acc="juego" data-d='{"tipo":"siguiente"}'>Siguiente ${cosa.toLowerCase()} ▶</button>`;
        if (j.adivinadorEscribe) html += `<div class="t2" style="margin-top:6px">Adivinador: escriban aquí</div>${campo('adivinar', '¿Qué es?', false)}${fb(p)}`;
        return html;
      }
      case 'opcion_multiple': return uiPregunta(q, j, p);
      case 'escribir': return uiEscribir(q, j, p);
      case 'ordenar': {
        if (j.enviado) return `<div class="feedback info">Orden enviado</div>`;
        const restantes = j.items.map((x, i) => i).filter((i) => !L.orden.includes(i));
        return `<div class="sub">${h(j.titulo || '')}: toquen en orden, del primero al último</div>
          ${L.orden.map((i, k) => `<div class="ord-item elegido"><b>${k + 1}.</b>${h(j.items[i])}</div>`).join('')}
          ${restantes.map((i) => `<button class="ord-item" data-acc="ord_add" data-i="${i}">${h(j.items[i])}</button>`).join('')}
          <div class="fila"><button class="btn gris chico" data-acc="ord_undo" ${L.orden.length ? '' : 'disabled'}>↩ Deshacer</button><button class="btn gris chico" data-acc="ord_reset" ${L.orden.length ? '' : 'disabled'}>Reiniciar</button></div>
          <button class="btn verde grande bloque" data-acc="ord_enviar" ${L.orden.length === j.items.length ? '' : 'disabled'}>Enviar orden</button>`;
      }
      case 'secuencia_pantalla':
        if (j.tipo === 'que_falta' && j.estado === 'pregunta') return uiPregunta(q, j, p);
        return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">👀</div><div class="t2">¡Miren la pantalla!</div></div>`;
      case 'sopa_letras': return uiSopa(j, p);
      case 'ahorcado': return uiAhorcado(j, p);
      case 'rompecabezas': {
        const e = j.equipos[q.id];
        if (!e) return '';
        return `<div class="sub">${e.armado ? '¡Armado!' : 'Toquen dos piezas para cambiarlas de lugar'} · ${e.correctas}/9</div>
          <div class="rompe-cel">${e.perm.map((pz, i) => `<button class="${L.rompeSel === i ? 'sel' : ''}" data-acc="rompe" data-i="${i}" style="background-image:url('/${h(j.imagen)}');background-position:${(pz % 3) * 50}% ${Math.floor(pz / 3) * 50}%"></button>`).join('')}</div>
          ${e.armado ? `<div class="t2">¿Qué escena es?</div>${campo('nombre', 'Escriban la escena', false)}` : ''}${fb(p)}`;
      }
      case 'mosaico': {
        if (j.estado !== 'responder') return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">👀</div><div class="t2">${j.estado === 'mostrando' ? '¡Memoricen el mosaico!' : 'Miren la pantalla: el mosaico aparece 15 segundos'}</div></div>`;
        if (j.enviado) return `<div class="feedback info">Mosaico enviado</div>`;
        return `<div class="sub">Toquen una casilla y luego el ícono</div>
          <div class="grid-cel" style="grid-template-columns:repeat(3,1fr)">${L.mosaico.map((x, i) => `<button class="${x ? '' : 'vacio'} ${L.mosaicoSel === i ? 'sel' : ''}" data-acc="mos_celda" data-i="${i}">${x || '?'}</button>`).join('')}</div>
          <div class="paleta">${j.paleta.map((e) => `<button data-acc="mos_emoji" data-e="${h(e)}">${e}</button>`).join('')}</div>
          <button class="btn verde grande bloque" data-acc="mos_enviar" ${L.mosaico.every(Boolean) ? '' : 'disabled'}>Enviar mosaico</button>`;
      }
      case 'concentrese':
        if (j.estado !== 'jugando') return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">👀</div><div class="t2">${j.estado === 'mostrando' ? '¡Memoricen las cartas!' : 'Miren la pantalla: las cartas aparecen 15 segundos'}</div></div>`;
        return `<div class="sub">Por turnos, cada integrante elige un par · Parejas: ${j.emparejadas.length / 2}/6</div>
          <div class="grid-cel" style="grid-template-columns:repeat(4,1fr)">${j.caras.map((x, i) => `<button class="${x ? (j.emparejadas.includes(i) ? 'par' : '') : 'dorso'}" data-acc="voltear" data-i="${i}">${x || '?'}</button>`).join('')}</div>`;
      case 'eleccion': {
        if (!j.opciones) return '';
        const titulos = { intercambio: '¿Con qué equipo cambian de casilla?', atajo: '¿A qué camino se pasan?', ustedes_deciden: 'Elijan 2 equipos para un duelo' };
        return `<div class="t2">${titulos[j.efecto] || 'Elijan'}</div>
          ${j.opciones.map((o) => `<button class="rival-btn ${L.eleccion.includes(o.valor) ? 'sel' : ''}" style="border-color:var(--cian)" data-acc="eleg" data-v="${h(o.valor)}">${o.personaje ? avatar(o.personaje, 44) : `<span style="color:${CAMINOS[o.valor]?.color || '#fff'}">${CAMINOS[o.valor] ? RT.svgIcono(CAMINOS[o.valor].svg, 34, 2.4) : ''}</span>`} <span>${h(o.texto)}<br><small style="font-family:var(--cuerpo);font-size:13px;color:var(--texto2)">${h(o.detalle || '')}</small></span></button>`).join('')}
          ${j.elegir > 1 ? `<button class="btn verde grande bloque" data-acc="eleg_ok" ${L.eleccion.length === j.elegir ? '' : 'disabled'}>Confirmar</button>` : ''}`;
      }
      default: return '';
    }
  }

  function uiPregunta(q, j, p) {
    if (j.oculta) return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">📖</div><div class="t2">Lean la instrucción. ${h(j.queAparece.charAt(0).toUpperCase() + j.queAparece.slice(1))} aparece cuando el moderador dé la señal</div></div>`;
    if (j.bloqueado) return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">👀</div><div class="t2">Miren la pantalla…</div></div>`;
    const reg = p.registro || [];
    const k = reg.length;
    const ultimo = reg[k - 1];
    const fbUlt = ultimo ? `<div class="feedback ${ultimo.correcta ? 'bien' : 'mal'}" data-k="${k}">${ultimo.correcta ? '✅ ¡Correcto!' : '❌ Incorrecto'}</div>` : '';
    if (k >= j.cantidad) return `${fbUlt}<div class="centro" style="min-height:25dvh"><div class="t2">¡Listo! Esperando el resultado…</div></div>`;
    const pr = j.preguntas[k];
    return `${j.cantidad > 1 ? fbUlt : ''}
      <div class="sub">${pr.subtitulo ? h(pr.subtitulo) : j.cantidad > 1 ? `Pregunta ${k + 1} de ${j.cantidad}` : ''}</div>
      ${pr.imagen ? `<img src="/${h(pr.imagen)}" style="width:100%;border-radius:10px;border:4px solid #fff" alt="">` : ''}
      <div class="${pr.grande ? 'emojis-cel' : 't2'}" style="${pr.grande ? '' : 'font-family:var(--cuerpo);font-weight:900;font-size:21px'}">${h(pr.texto)}</div>
      ${pr.opciones.map((o, i) => `<button class="op-btn op-${i % 4}" data-acc="juego" data-d='${h(JSON.stringify({ tipo: 'responder', pregunta: k, opcion: i }))}'><span class="ic">${ICONOS_OP[i % 4]}</span>${h(o)}</button>`).join('')}`;
  }

  function uiEscribir(q, j, p) {
    if (j.lista) {
      if (j.estado !== 'escribir') return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">🧠</div><div class="t2">${j.estado === 'mostrando' ? '¡Memoricen las palabras de la pantalla!' : 'Miren la pantalla: las palabras aparecen 20 segundos'}</div></div>`;
      return `<div class="t2">Escriban las palabras que recuerden, una por una</div>${campo('palabra', 'Una palabra', false, 'data-limpiar="1"')}${fb(p)}
        <div class="chips">${j.encontradas.map((w) => `<span class="ok">${h(w)}</span>`).join('')}</div>
        <div class="sub">Llevan ${j.encontradas.length} de ${j.total} · necesitan ${j.minimo}</div>
        <button class="btn naranja bloque" data-acc="juego" data-d='{"tipo":"terminamos"}'>Ya no recordamos más</button>`;
    }
    if (j.duelo) {
      if (j.oculta) return `<div class="centro" style="min-height:30dvh"><div class="emoji" style="font-size:70px">${j.numero ? '🧮' : '🎵'}</div><div class="t2">Lean la instrucción. ${j.numero ? 'La operación aparece' : 'La ronda empieza'} cuando el moderador dé la señal</div></div>`;
      const it = j.items[j.ronda];
      const g = j.rondas[j.ronda].ganador;
      return `<div class="sub">Ronda ${j.ronda + 1} de ${j.items.length} · ${Object.entries(j.ganados).map(([id, n]) => `${h(RT.equipo(V, id)?.nombre)} ${n}`).join(' – ')}</div>
        <div class="grande-cel">${h(it.texto)}${j.numero ? ' = ?' : ''}</div>
        ${g || j.entreRondas ? `<div class="feedback ${g === q.id ? 'bien' : 'mal'}">${g === q.id ? '¡Ganaron la ronda!' : `Ronda para ${h(RT.equipo(V, g)?.nombre)}`}</div>` : `${campo('responder', j.numero ? 'Resultado' : 'Respuesta', j.numero, `data-idx="${j.ronda}"`)}${fb(p)}`}`;
    }
    const idx = j.estados.indexOf('pendiente');
    const iconos = { correcta: '✅', fallida: '❌', saltada: '⏭️', dudosa: '⏳', pendiente: '✏️' };
    const estado = `<div class="estado-items">${j.estados.map((e) => iconos[e]).join(' ')}</div>`;
    if (idx < 0) return `${estado}${fb(p)}<div class="feedback info">Esperando al moderador…</div>`;
    const it = j.items[idx];
    return `${estado}
      ${it.pistas ? `<div class="emoji" style="font-size:44px;text-align:center">🔒</div>${it.pistas.map((pi, i) => `<div class="carta-mini">${i + 1}. ${h(pi)}</div>`).join('')}` : `<div class="grande-cel">${h(it.texto)}</div>`}
      ${campo('responder', j.numero ? 'Número' : 'Respuesta', j.numero, `data-idx="${idx}"`)}
      ${fb(p)}
      ${j.intentos ? `<div class="sub">Intentos: ${j.intentosUsados[idx]} de ${j.intentos}</div>` : `<button class="btn gris chico" data-acc="juego" data-d='${h(JSON.stringify({ tipo: 'saltar', idx }))}'>Saltar ⏭️</button>`}
      <div class="sub">Necesitan ${j.minimo} de ${j.items.length}</div>`;
  }

  function uiSopa(j, p) {
    const marcadas = new Set();
    (j.encontradas || []).forEach((e) => {
      const [r0, c0] = e.a, [r1, c1] = e.b;
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
      const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      for (let i = 0; i <= n; i++) marcadas.add(`${r0 + dr * i},${c0 + dc * i}`);
    });
    const enc = j.encontradas.map((e) => e.palabra);
    const ini = L.sopaIni ? L.sopaIni.join(',') : '';
    return `<div class="sub">Toquen la primera y la última letra de cada palabra · ${enc.length}/${j.palabras.length} (necesitan ${j.minimo})</div>
      <div class="sopa-cel" style="grid-template-columns:repeat(${j.grid.length},1fr)">${j.grid.map((fila, r) => [...fila].map((ch, c) => `<button class="${marcadas.has(`${r},${c}`) ? 'ok' : ''} ${ini === `${r},${c}` ? 'ini' : ''}" data-acc="sopa" data-r="${r}" data-c="${c}">${ch}</button>`).join('')).join('')}</div>
      <div class="chips">${j.palabras.map((w) => `<span class="${enc.includes(w) ? 'ok' : ''}">${h(w)}</span>`).join('')}</div>${fb(p)}`;
  }

  function uiAhorcado(j, p) {
    const letras = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
    return `<div class="ahorcado-cel">${RT.ahorcadoSVG(j.errores, j.max)}<div class="sub">Errores<br><b style="font-size:30px;color:#fff">${j.errores}/${j.max}</b></div></div>
      <div class="mascara-cel">${String(j.mascara).split(' ').map((w) => `<div class="p">${[...w].map((ch) => `<span>${ch === '_' ? '' : h(ch)}</span>`).join('')}</div>`).join('')}</div>
      <div class="sub">Por turnos, cada integrante elige una letra</div>
      <div class="teclado">${letras.map((l) => {
        const usada = j.usadas.includes(l);
        const cls = usada ? (j.mascara.includes(l) ? 'si' : 'no') : '';
        return `<button class="${cls}" data-acc="letra" data-l="${l}" ${usada ? 'disabled' : ''}>${l}</button>`;
      }).join('')}</div>
      <details><summary>¿Ya saben la respuesta completa?</summary><div style="margin-top:10px">${campo('resolver', 'Escríbanla completa', false)}<div class="sub" style="margin-top:6px">Si se equivocan, se suma un error</div></div></details>${fb(p)}`;
  }

  function pantallaResultado(q, t, turnoQ) {
    const r = t.resultado;
    if (!r) return '';
    let cls = 'neutral', titulo = '¡Listo!';
    if (r.gana.includes(q.id)) { cls = 'gano'; titulo = t.carta && t.carta.tipo === 'Reto final' ? '¡AL TROFEO! 🏆' : '¡GANARON!'; }
    else if (r.pierde.includes(q.id)) { cls = 'perdio'; titulo = 'Perdieron'; }
    else if (t.equipoId === q.id && r.tipo !== 'neutral') { cls = r.tipo; titulo = r.tipo === 'gano' ? '¡Bien!' : 'Uy…'; }
    const involucrado = t.equipoId === q.id || (t.duelo || []).includes(q.id);
    const sig = siguiente();
    return `<div class="centro">
      ${involucrado ? `<div class="resultado-cel ${cls} rebote">${titulo}</div>` : `<div class="sub">Turno de ${h(turnoQ.nombre)}</div>`}
      ${t.carta ? `<div class="carta-mini">${TIPOS[t.carta.tipo]?.icono || ''} <b>${h(t.carta.nombre)}</b></div>` : ''}
      <div class="t2">${h(r.texto || '')}</div>
      ${(r.detalles || []).map((d) => `<div class="feedback info">${h(d)}</div>`).join('')}
      ${sig ? `<p class="sub">Siguiente turno: <b style="color:#fff">${h(sig.nombre)}</b>${sig.id === q.id ? ' ¡Son ustedes!' : ''}</p>` : ''}
    </div>`;
  }

  function siguiente() {
    if (!V.orden || !V.orden.length) return null;
    for (let i = 1; i <= V.orden.length; i++) {
      const q = RT.equipo(V, V.orden[(V.turnoIdx + i) % V.orden.length]);
      if (q && !q.llego) return q;
    }
    return null;
  }

  // ---------- Acciones ----------
  const acciones = {
    pj(d) { personajeSel = d.pj; error = ''; app.__html = null; render(); },
    unirse() {
      const nombre = ($('#in-nombre') || {}).value || '';
      const codigo = CODIGO_URL && CODIGO_URL === V.codigo ? CODIGO_URL : (($('#in-codigo') || {}).value || '');
      if (!nombre.trim()) { error = 'Escriban el nombre del equipo'; app.__html = null; render(); return; }
      if (!personajeSel) { error = 'Elijan un personaje'; app.__html = null; render(); return; }
      socket.emit('unirse', { codigo, nombre, personaje: personajeSel }, (r) => {
        if (r && r.ok) { error = ''; token = r.token; localStorage.setItem('rt-token', r.token); }
        else { error = (r && r.error) || 'No se pudo entrar'; if (/personaje/i.test(error)) personajeSel = null; app.__html = null; render(); }
      });
    },
    recuperar() {
      const cod = ($('#in-cod-eq') || {}).value || '';
      socket.emit('recuperar', { codigoEquipo: cod }, (r) => {
        if (r && r.ok) { error = ''; token = r.token; localStorage.setItem('rt-token', r.token); }
        else { error = (r && r.error) || 'No se pudo entrar'; app.__html = null; render(); }
      });
    },
    salir() {
      if (!confirm('¿Salir de este equipo en este celular? El equipo sigue en la partida y pueden volver con el código.')) return;
      reconectarCon(null);
    },
    inicio(d) { enviar('inicio_responder', { opcion: Number(d.i) }); if (navigator.vibrate) navigator.vibrate(40); },
    camino(d) { enviar('camino', { camino: d.c }); },
    dado() {
      if (L.rodando) return;
      L.rodando = true; app.__html = null; render();
      if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 30]);
      setTimeout(() => enviar('dado'), 700);
      setTimeout(() => { if (L.rodando) { L.rodando = false; app.__html = null; render(); } }, 5000);
    },
    elegir_dado(d) { enviar('elegir_dado', { i: Number(d.i) }); },
    rival(d) { enviar('rival', { rival: d.id }); },
    carta(d) { enviar('carta', { idx: Number(d.i) }); },
    juego(d) { try { juego(JSON.parse(d.d)); } catch (e) {} },
    ver() { L.ver = !L.ver; app.__html = null; render(); },
    texto(d, btn) {
      const input = btn.parentElement.querySelector('input');
      const texto = input ? input.value.trim() : '';
      if (!texto) return;
      const datos = { tipo: d.tipo, texto };
      if (input.dataset.idx !== undefined) datos.idx = Number(input.dataset.idx);
      juego(datos);
      input.value = '';
    },
    ord_add(d) { L.orden.push(Number(d.i)); app.__html = null; render(); },
    ord_undo() { L.orden.pop(); app.__html = null; render(); },
    ord_reset() { L.orden = []; app.__html = null; render(); },
    ord_enviar() { juego({ tipo: 'enviar', orden: L.orden }); },
    sopa(d) {
      const rc = [Number(d.r), Number(d.c)];
      if (!L.sopaIni) L.sopaIni = rc;
      else if (L.sopaIni[0] === rc[0] && L.sopaIni[1] === rc[1]) L.sopaIni = null;
      else { juego({ tipo: 'marcar', a: L.sopaIni, b: rc }); L.sopaIni = null; }
      app.__html = null; render();
    },
    letra(d) { juego({ tipo: 'letra', letra: d.l }); },
    rompe(d) {
      const i = Number(d.i);
      if (L.rompeSel === null) L.rompeSel = i;
      else if (L.rompeSel === i) L.rompeSel = null;
      else { juego({ tipo: 'cambiar', a: L.rompeSel, b: i }); L.rompeSel = null; }
      app.__html = null; render();
    },
    mos_celda(d) { L.mosaicoSel = Number(d.i); app.__html = null; render(); },
    mos_emoji(d) {
      if (L.mosaicoSel === null) return;
      L.mosaico[L.mosaicoSel] = d.e;
      const sig = L.mosaico.findIndex((x, i) => !x && i > L.mosaicoSel);
      const libre = sig >= 0 ? sig : L.mosaico.findIndex((x) => !x);
      L.mosaicoSel = libre >= 0 ? libre : L.mosaicoSel;
      app.__html = null; render();
    },
    mos_enviar() { if (L.mosaico.every(Boolean)) juego({ tipo: 'enviar', grid: L.mosaico }); },
    voltear(d) { juego({ tipo: 'voltear', i: Number(d.i) }); },
    eleg(d) {
      const j = V.turno.juego;
      if (j.elegir === 1) { juego({ tipo: 'elegir', valores: [d.v] }); return; }
      if (L.eleccion.includes(d.v)) L.eleccion = L.eleccion.filter((x) => x !== d.v);
      else if (L.eleccion.length < j.elegir) L.eleccion.push(d.v);
      app.__html = null; render();
    },
    eleg_ok() { juego({ tipo: 'elegir', valores: L.eleccion }); },
  };

  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b || b.disabled) return;
    const fn = acciones[b.dataset.acc];
    if (fn) fn(b.dataset, b);
  });
  app.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('[data-enter]');
    if (!inp) return;
    e.preventDefault();
    const btn = inp.parentElement.querySelector('[data-acc]') || app.querySelector(`[data-acc="${inp.dataset.enter}"]`);
    if (btn) btn.click();
  });

  // Vibrar cuando empieza mi turno
  let ultimoTurnoVibrado = null;
  function tick() {
    if (!V) return;
    const ms = RT.restanteMs(V.temporizador);
    document.querySelectorAll('[data-reloj]').forEach((el) => { el.textContent = RT.fmtTiempo(ms); });
    const t = V.turno;
    if (V.fase === 'juego' && t && t.etapa === 'dado' && t.tiraEquipoId === V.yo && ultimoTurnoVibrado !== t.n) {
      ultimoTurnoVibrado = t.n;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }
  setInterval(tick, 250);
})();
