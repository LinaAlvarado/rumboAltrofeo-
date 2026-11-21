/* Panel del moderador */
(function () {
  const { h, CAMINOS, TIPOS, avatar, htmlCarta, pintar } = RT;
  const $ = (s) => document.querySelector(s);
  let pin = sessionStorage.getItem('rt-pin') || '';
  let socket = null;
  let V = null, INFO = null, D = null;

  function pedirPin(error) {
    $('#login').classList.remove('oculto');
    $('#pin-error').classList.toggle('oculto', !error);
    $('#pin').focus();
  }
  $('#form-pin').addEventListener('submit', (e) => {
    e.preventDefault();
    pin = $('#pin').value.trim();
    sessionStorage.setItem('rt-pin', pin);
    iniciar();
  });

  function iniciar() {
    if (socket) socket.disconnect();
    socket = RT.conectar((cb) => cb({ rol: 'moderador', pin }));
    socket.on('pin_incorrecto', () => { sessionStorage.removeItem('rt-pin'); socket.disconnect(); pedirPin(true); });
    socket.on('estado', (v) => { $('#login').classList.add('oculto'); V = v; render(); });
    socket.on('timbre', () => { RT.activarAudio(); RT.sonidos.timbre(); RT.toast('⏰ ¡Tiempo!'); });
  }
  if (pin) iniciar(); else pedirPin(false);
  fetch('/api/datos').then((r) => r.json()).then((d) => { D = d; render(); });
  const cargarInfo = () => fetch('/api/info').then((r) => r.json()).then((i) => { INFO = i; render(); }).catch(() => {});
  cargarInfo();
  setInterval(() => { if (V && INFO && V.codigo !== INFO.codigo) cargarInfo(); }, 2000);
  addEventListener('click', () => RT.activarAudio(), { once: true });

  const mod = (tipo, extra = {}) => socket && socket.emit('mod', { tipo, ...extra });
  const eq = (id) => RT.equipo(V, id);
  const nom = (id) => h(eq(id)?.nombre || '?');

  // ---------- Render ----------
  function render() {
    if (!V) return;
    pintar($('#top'), `<div class="arcade">🏆 Moderador</div>
      <span class="fase-chip">${h(nombreFase(V.fase))}</span>
      <span class="info">Código: <b>${h(V.codigo)}</b></span>
      ${INFO ? `<span class="info">Celulares: <b>${h(INFO.urlCorta)}</b></span>` : ''}
      <span class="info"><a href="/pantalla" target="_blank">Abrir pantalla ↗</a></span>
      ${V.fase === 'juego' ? `<span class="info">Ronda <b>${V.ronda}</b></span>` : ''}`);
    let p = '';
    if (V.fase === 'lobby') p = faseLobby();
    else if (V.fase === 'instructivo') p = faseInstructivo();
    else if (V.fase === 'quien_empieza') p = faseInicio();
    else if (V.fase === 'eleccion_camino') p = faseCaminos();
    else if (V.fase === 'juego') p = faseJuego();
    else if (V.fase === 'final') p = faseFinal();
    pintar($('#principal'), p);
    pintar($('#lateral'), lateral());
    tick();
  }
  const nombreFase = (f) => ({ lobby: 'Lobby', instructivo: 'Instructivo', quien_empieza: '¿Quién empieza?', eleccion_camino: 'Elección de camino', juego: 'Juego', final: 'Final' }[f] || f);

  function faseLobby() {
    return `<div class="caja panel"><h3>Equipos conectados (${V.equipos.length}/6)</h3>
      ${V.equipos.length ? V.equipos.map((q) => `<div class="fila" style="padding:6px 0">${avatar(q.personaje, 40)}<b>${h(q.nombre)}</b><span class="muted">código ${h(q.codigoEquipo)}</span><button class="btn rojo chico" data-acc="quitar" data-id="${q.id}">Quitar</button></div>`).join('') : '<p class="muted">Todavía no hay equipos. Que escaneen el QR de la pantalla.</p>'}
      <div class="botones"><button class="btn verde grande" data-acc="mod" data-t="instructivo" ${V.equipos.length < 2 ? 'disabled' : ''}>Iniciar ▶ (instructivo)</button></div>
      ${V.equipos.length < 2 ? '<p class="muted">Se necesitan mínimo 2 equipos.</p>' : ''}
    </div>`;
  }

  function faseInstructivo() {
    return `<div class="caja panel"><h3>Instructivo</h3>
      <p>Pantalla ${V.instructivo + 1} de 5</p>
      <div class="botones"><button class="btn gris" data-acc="mod" data-t="instructivo_paso" data-delta="-1" ${V.instructivo === 0 ? 'disabled' : ''}>◀ Anterior</button>
      <button class="btn azul" data-acc="mod" data-t="instructivo_paso" data-delta="1" ${V.instructivo >= 4 ? 'disabled' : ''}>Siguiente ▶</button></div>
      <div class="botones"><button class="btn verde grande" data-acc="mod" data-t="quien_empieza">¿Quién empieza? ▶</button></div>
    </div>`;
  }

  function faseInicio() {
    const ini = V.inicio;
    if (!ini) return '';
    const resp = ini.respuestas || {};
    return `<div class="caja panel"><h3>${ini.indice === 0 ? '¿Quién empieza?' : `Desempate ${ini.indice + 1}`}</h3>
      <p class="grande">${h(ini.pregunta)}</p>
      <ol>${ini.opciones.map((o) => `<li>${h(o)}</li>`).join('')}</ol>
      <div class="secreto"><h4>Respuesta correcta</h4><div class="big">${h(V.inicio.correcta !== null ? ini.opciones[ini.correcta] : respuestaInicio(ini))}</div></div>
      <h3 style="margin-top:14px">Respuestas</h3>
      ${V.equipos.map((q) => { const r = resp[q.id]; return `<div class="fila">${avatar(q.personaje, 32)} ${h(q.nombre)}: ${r ? `${RT.ICONOS_OP[r.opcion]} ${h(ini.opciones[r.opcion])} · ${(r.ms / 1000).toFixed(1)} s` : '⏳'}</div>`; }).join('')}
      <div class="botones">
        ${ini.estado === 'pregunta' ? '<button class="btn naranja" data-acc="mod" data-t="inicio_cerrar">Cerrar respuestas</button>' : ''}
        ${ini.estado === 'nadie' ? '<button class="btn azul grande" data-acc="mod" data-t="inicio_siguiente">Pregunta de desempate ▶</button>' : ''}
        ${ini.estado === 'resultado' ? '<button class="btn verde grande" data-acc="mod" data-t="eleccion_camino">Elegir caminos ▶</button>' : ''}
      </div>
      ${ini.estado === 'resultado' ? `<p>Orden: ${ini.orden.map((id, i) => `${i + 1}. ${nom(id)}`).join(' · ')}</p>` : ''}
    </div>`;
  }
  function respuestaInicio(ini) { return ini.respuestaVisible || '(se ve al cerrar)'; }

  function faseCaminos() {
    return `<div class="caja panel"><h3>Elección de camino</h3>
      <p class="muted">Cada equipo elige en su celular. Si un celular falla, elijan aquí por ellos. Los que no elijan quedan en el camino con menos equipos.</p>
      ${V.equipos.map((q) => `<div class="fila" style="padding:6px 0">${avatar(q.personaje, 36)}<b style="min-width:140px">${h(q.nombre)}</b>${botonesCamino(q, 'camino_por')}</div>`).join('')}
      <div class="botones"><button class="btn verde grande" data-acc="mod" data-t="empezar">¡Empezar el juego! ▶</button></div>
    </div>`;
  }
  function botonesCamino(q, accion) {
    return `<span class="mini">${Object.entries(CAMINOS).map(([c, i]) => `<button class="${q.camino === c ? 'sel' : ''}" style="--c:${i.color}" title="${h(c)}" data-acc="${accion}" data-id="${q.id}" data-c="${h(c)}">${RT.svgIcono(i.svg, 18, 2.6)}</button>`).join('')}</span>`;
  }

  function faseFinal() {
    const f = V.final;
    return `<div class="caja panel"><h3>🏆 Final</h3>
      <p class="grande">${f.empate ? `Empate entre ${f.ganadores.map(nom).join(' y ')}` : `Ganó ${nom(f.ganadores[0])}`}</p>
      ${f.empate ? `<p class="muted">Hagan un duelo y marquen aquí el ganador:</p><div class="botones">${f.ganadores.map((id) => `<button class="btn oro" data-acc="mod" data-t="declarar_ganador" data-equipo="${id}">Ganó ${nom(id)}</button>`).join('')}</div>` : ''}
      <ol>${f.tabla.map((id) => `<li>${nom(id)} — ${eq(id).llego ? 'trofeo' : `casilla ${eq(id).casilla}`}</li>`).join('')}</ol>
      <div class="botones">
        <button class="btn gris" data-acc="mod" data-t="volver_al_juego">Volver al juego (seguir jugando)</button>
        <button class="btn rojo" data-acc="confirmar" data-t="nueva_partida" data-msg="¿Borrar todo y empezar una partida nueva?">Nueva partida</button>
      </div>
    </div>`;
  }

  // ---------- Juego ----------
  function faseJuego() {
    const t = V.turno;
    if (!t) return '';
    const q = eq(t.equipoId);
    let html = `<div class="caja panel"><h3>${avatar(q.personaje, 40)} Turno de ${h(q.nombre)} <span class="muted" style="font-family:var(--cuerpo)">· ${h(etapaTxt(t))}</span></h3>
      ${t.tiraEquipoId !== t.equipoId ? `<p>🎲 Dado ajeno: tira ${nom(t.tiraEquipoId)}</p>` : ''}
      ${(t.avisos || []).map((a) => `<div class="progreso" style="margin-bottom:6px">⚠️ ${h(a)}</div>`).join('')}`;
    if (t.etapa === 'dado') html += `<p>Esperando que tiren el dado en el celular.</p><div class="botones"><button class="btn azul" data-acc="mod" data-t="dado">🎲 Tirar el dado por ellos</button></div>`;
    if (t.etapa === 'eleccion_dado') html += `<p>Doble dado: ${t.dados.join(' y ')}</p><div class="botones">${t.dados.map((n, i) => `<button class="btn azul" data-acc="mod" data-t="elegir_dado" data-i="${i}">Elegir ${n}</button>`).join('')}</div>`;
    if (t.etapa === 'casilla') html += `<p>Sacó ${t.dado}: avanza a la casilla ${t.hasta} (${h(t.casillaTipo)})…</p>`;
    if (t.etapa === 'elegir_rival') html += `<p>Están eligiendo rival. Elegir por ellos:</p><div class="botones">${t.rivales.map((id) => `<button class="btn rojo" data-acc="mod" data-t="rival" data-rival="${id}">⚔️ ${nom(id)}</button>`).join('')}</div>`;
    if (t.etapa === 'elegir_carta') {
      const info = (t.secreto && t.secreto.opcionesInfo) || [];
      html += `<p>Están eligiendo una carta${t.duelo ? ` (duelo contra ${nom(t.duelo[1])})` : ''}. Vayan alistando el material. Si un celular falla, elijan por ellos:</p>
        <div class="opciones-mod">${info.map((c, i) => `<div class="op-mod"><button class="btn azul chico" data-acc="mod" data-t="carta" data-idx="${i}">Carta ${i + 1}</button><div><b>${h(c.id)} · ${h(c.nombre)}</b><div class="${c.material ? 'mat-si' : 'muted'}">🧰 ${c.material ? h(c.material) : 'Sin materiales'}</div></div></div>`).join('')}</div>`;
    }
    html += '</div>';
    if (t.etapa === 'carta') html += panelCarta(t);
    if (t.etapa === 'resultado') html += panelResultado(t);
    return html;
  }
  const etapaTxt = (t) => ({ dado: 'tirando el dado', eleccion_dado: 'eligiendo dado', casilla: 'moviendo la ficha', elegir_rival: 'eligiendo rival', elegir_carta: 'eligiendo carta', carta: 'jugando la carta', resultado: 'resultado' }[t.etapa] || t.etapa);

  function panelCarta(t) {
    const c = t.carta;
    const j = t.juego || {};
    const s = t.secreto || {};
    let html = `<div class="caja panel">
      <div class="fila" style="align-items:flex-start;gap:20px">
        <div style="flex:1;min-width:300px">${materialesCarta(c)}${htmlCarta(c)}${c.faltaContenido ? '<p class="muted">Esta carta se juega presencial (falta su contenido digital).</p>' : ''}</div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
          ${V.temporizador.totalMs > 0 ? `<div class="reloj" data-reloj>--</div>
          <div class="botones" style="justify-content:center">
            ${V.temporizador.corriendo ? '<button class="btn naranja" data-acc="mod" data-t="tiempo_pausar">⏸ Pausar</button>' : '<button class="btn verde" data-acc="mod" data-t="tiempo_iniciar">▶ Iniciar</button>'}
            <button class="btn gris" data-acc="mod" data-t="tiempo_reiniciar">↺</button>
          </div>
          <div class="botones" style="justify-content:center"><button class="btn gris chico" data-acc="mod" data-t="tiempo_ajustar" data-seg="-15">−15 s</button><button class="btn gris chico" data-acc="mod" data-t="tiempo_ajustar" data-seg="15">+15 s</button></div>` : `<div class="muted">Sin tiempo</div><button class="btn gris chico" data-acc="mod" data-t="tiempo_ajustar" data-seg="60">Poner 60 s</button>`}
        </div>
      </div>
      ${controlesModo(t, c, j)}
      ${verSecreto(t, s, j)}
      ${progreso(t, c, j, s)}
      ${juicio(t, c)}
    </div>`;
    return html;
  }

  function materialesCarta(c) {
    const lugar = c.seJuegaEn ? `<span>📍 ${h(c.seJuegaEn)}</span>` : '';
    if (!c.material) return `<div class="materiales vacio"><b>🧰 Materiales:</b> no necesita · ${lugar}</div>`;
    return `<div class="materiales"><div class="mat-tit">🧰 MATERIALES</div><div class="mat-lista">${c.material.split(/,s*/).map((m) => `<span>${h(m)}</span>`).join('')}</div><div class="mat-pie">${lugar}</div></div>`;
  }

  function controlesModo(t, c, j) {
    const b = [];
    if (c.modo === 'secuencia_pantalla' && j.tipo === 'poses') {
      const n = j.paso + 1;
      if (j.estado === 'listo') b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar pose 1 de ${j.total}</button>`);
      if (j.estado === 'mostrando') b.push(`<span class="muted">Mostrando pose ${n} de ${j.total}…</span>`);
      if (['oculto', 'revelado'].includes(j.estado) && n < j.total) b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"siguiente"}'>▶ Mostrar pose ${n + 1} de ${j.total}</button>`);
      if (j.estado === 'oculto') b.push(`<button class="btn gris" data-acc="carta_mod" data-d='{"tipo":"revelar"}'>Mostrar de nuevo la pose ${n} (para juzgar)</button>`);
    } else if (c.modo === 'secuencia_pantalla' && j.manual) {
      const n = (j.paso || 0) + 1;
      if (j.estado === 'listo') b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar orden 1 de ${j.items.length}</button>`);
      if (j.estado === 'mostrando') {
        b.push(n < j.items.length
          ? `<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"siguiente"}'>▶ Orden ${n + 1} de ${j.items.length}</button>`
          : `<button class="btn naranja grande" data-acc="carta_mod" data-d='{"tipo":"siguiente"}'>🏁 Terminar órdenes</button>`);
        b.push(`<span class="muted">En pantalla: orden ${n} de ${j.items.length}</span>`);
      }
      if (j.estado === 'terminado') b.push(`<button class="btn gris" data-acc="carta_mod" data-d='{"tipo":"revelar"}'>Mostrar todas (para juzgar)</button>`);
    } else if (c.modo === 'secuencia_pantalla') {
      if (j.estado === 'listo') b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar en pantalla</button>`);
      if (['oculto', 'terminado'].includes(j.estado)) b.push(`<button class="btn gris" data-acc="carta_mod" data-d='{"tipo":"revelar"}'>Mostrar de nuevo (para juzgar)</button>`);
      if (j.estado === 'mostrando') b.push('<span class="muted">Mostrando en pantalla…</span>');
    }
    if ((c.modo === 'mosaico' || c.modo === 'concentrese' || (c.modo === 'escribir' && j.lista)) && j.estado === 'listo') {
      b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar en pantalla</button>`);
    }
    if (c.modo === 'palabra_secreta') {
      if (j.enPanel && j.idxPanel < j.cantidad - 1) b.push(`<button class="btn azul" data-acc="carta_mod" data-d='{"tipo":"siguiente"}'>Siguiente palabra ▶</button>`);
    }
    if (c.modo === 'opcion_multiple' && j.oculta) b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar ${h(j.queAparece)}</button>`);
    if (c.modo === 'escribir' && j.duelo) {
      const cosa = j.numero ? 'operación' : 'ronda';
      if (j.oculta) b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"mostrar"}'>▶ Mostrar ${cosa} ${j.ronda + 1}</button>`);
      else if (j.entreRondas) b.push(`<button class="btn verde grande" data-acc="carta_mod" data-d='{"tipo":"siguiente_ronda"}'>▶ Siguiente ${cosa} (${j.ronda + 2} de ${j.items.length})</button>`);
    }
    if (c.modo === 'escribir' && j.duelo && !j.entreRondas && !j.oculta) b.push(`<button class="btn gris" data-acc="carta_mod" data-d='{"tipo":"saltar_ronda"}'>Saltar ronda (nadie la sacó)</button>`);
    if (!b.length) return '';
    return `<div class="botones">${b.join('')}</div>`;
  }

  const ETIQUETAS = { contenido: 'Contenido', respuesta: 'Respuesta', pistas: 'Pistas (léanlas una por una)', categoria: 'Categoría', frase: 'Frase', cita: 'Cita', palabra: 'Palabra', texto: 'Texto', imagen: 'Imagen', respuestas: 'Respuestas correctas', canciones: 'Canciones (pónganlas en orden)', palabras: 'Palabras', orden: 'Orden correcto', letras: 'Letras', pose: 'Pose', ordenes: 'Órdenes', acciones: 'Acciones en orden', escena: 'Escena', mosaico: 'Mosaico', parejas: 'Parejas', nota: 'Nota', aceptadas: 'También se acepta', prohibidas: 'Prohibidas', opciones: 'Opciones' };
  function verSecreto(t, s, j) {
    let html = '';
    const panel = s.panel;
    if (panel && typeof panel === 'object') {
      for (const [k, val] of Object.entries(panel)) {
        if (val === null || val === undefined || val === '' || (Array.isArray(val) && !val.length)) continue;
        if (k === 'imagen') html += `<h4>Dibujo</h4><img src="/${h(val)}" alt="">`;
        else if (Array.isArray(val)) html += `<h4>${h(ETIQUETAS[k] || k)}</h4><ol>${val.map((x) => `<li>${h(typeof x === 'object' ? JSON.stringify(x) : x)}</li>`).join('')}</ol>`;
        else html += `<h4>${h(ETIQUETAS[k] || k)}</h4><div class="${['respuesta', 'palabra', 'frase', 'categoria', 'pose', 'escena', 'letras', 'texto'].includes(k) ? 'big' : ''}">${h(val)}</div>`;
      }
    }
    if (s.palabras && !Array.isArray(s.palabras)) {
      for (const [id, lista] of Object.entries(s.palabras)) {
        const actual = j.enPanel ? j.idxPanel : (j.idx || {})[id];
        html += `<h4>${Object.keys(s.palabras).length > 1 ? `Palabras de ${nom(id)}` : 'Palabras'}</h4><ol>${lista.map((w, i) => `<li class="${i === actual ? 'actual' : ''}">${h(w.palabra)}${w.prohibidas ? ` <small>(prohibidas: ${h(w.prohibidas.join(', '))})</small>` : ''}${w.nota ? ` <small>${h(w.nota)}</small>` : ''}</li>`).join('')}</ol>`;
        if (!j.enPanel && j.cantidad > 1) html += `<button class="btn gris chico" data-acc="carta_mod" data-d='${h(JSON.stringify({ tipo: 'siguiente', equipo: id }))}'>Pasar palabra de ${nom(id)} ▶</button>`;
      }
    }
    if (s.preguntas && !(panel && panel.respuestas)) html += `<h4>Respuestas</h4><ol>${s.preguntas.map((p) => `<li>${h(p.respuesta)}</li>`).join('')}</ol>`;
    if (s.items && !(panel && (panel.respuestas || panel.canciones))) html += `<h4>Respuestas</h4><ol>${s.items.map((i) => `<li>${h(i.respuesta)}</li>`).join('')}</ol>`;
    if (s.frase && !(panel && panel.frase)) html += `<h4>Frase</h4><div class="big">${h(s.frase)}</div>`;
    if (!html) return '';
    return `<div class="secreto" style="margin-top:12px">${html}</div>`;
  }

  function progreso(t, c, j, s) {
    const l = [];
    if (c.modo === 'opcion_multiple' || (c.modo === 'secuencia_pantalla' && j.tipo === 'que_falta' && s.registro)) {
      for (const [id, reg] of Object.entries(s.registro || {})) l.push(`${nom(id)}: ${reg.map((x) => (x.correcta ? '✅' : '❌')).join(' ') || '—'} (${reg.length}/${j.cantidad})`);
    }
    if (c.modo === 'escribir') {
      if (j.lista) l.push(`Estado: ${j.estado} · encontradas ${j.encontradas.length}/${j.total}: ${h(j.encontradas.join(', '))}`);
      else if (j.duelo) l.push(`Ronda ${j.ronda + 1}/${j.items.length} · ${Object.entries(j.ganados).map(([id, n]) => `${nom(id)} ${n}`).join(' – ')}`);
      else l.push(`Estado: ${j.estados.join(', ')}`);
    }
    if (c.modo === 'sopa_letras') l.push(`Encontradas ${j.encontradas.length}/${j.palabras.length}: ${h(j.encontradas.map((e) => e.palabra).join(', '))}`);
    if (c.modo === 'ahorcado') l.push(`${h(j.mascara)} · errores ${j.errores}/${j.max} · letras: ${h(j.usadas.join(' '))}`);
    if (c.modo === 'rompecabezas') l.push(Object.entries(j.equipos).map(([id, e]) => `${nom(id)}: ${e.correctas}/9${e.armado ? ' ✅' : ''}`).join(' · '));
    if (c.modo === 'mosaico') l.push(`Estado: ${j.estado}`);
    if (c.modo === 'concentrese') l.push(`Estado: ${j.estado} · parejas ${j.emparejadas.length / 2}/6 · intentos ${j.intentos}`);
    if (c.modo === 'ordenar') l.push(j.enviado ? 'Enviado' : 'Ordenando…');
    if (j.villano) l.push(`😈 Villano elegido al azar: ${h(j.villano.nombre)}`);
    if (j.esperandoModerador) l.push('⏳ Hay una respuesta dudosa por decidir (panel derecho)');
    if (!l.length) return '';
    return `<div class="progreso" style="margin-top:12px">${l.map((x) => `<div>${x}</div>`).join('')}</div>`;
  }

  function juicio(t, c) {
    let b = '';
    if (c.modo === 'especial') {
      b = V.equipos.filter((q) => !q.llego).map((q) => `<button class="btn oro" data-acc="juzgar" data-v="especial:${q.id}">🪑 Ganó ${h(q.nombre)}</button>`).join('') + '<button class="btn gris" data-acc="juzgar" data-v="se_quedan">Nadie (se quedan)</button>';
    } else if (t.duelo) {
      b = t.duelo.map((id) => `<button class="btn verde" data-acc="juzgar" data-v="gana:${id}">🏆 Ganó ${nom(id)}</button>`).join('') + '<button class="btn gris" data-acc="juzgar" data-v="se_quedan">Empate / se quedan</button>';
    } else if (c.tipo === 'Penitencia') {
      b = '<button class="btn verde" data-acc="juzgar" data-v="cumplida">✅ Cumplida</button><button class="btn rojo" data-acc="juzgar" data-v="no_cumplida">❌ No cumplida</button><button class="btn gris" data-acc="juzgar" data-v="se_quedan">Se quedan</button>';
    } else {
      b = '<button class="btn verde" data-acc="juzgar" data-v="ganaron">✅ Ganaron</button><button class="btn rojo" data-acc="juzgar" data-v="perdieron">❌ Perdieron</button><button class="btn gris" data-acc="juzgar" data-v="se_quedan">Se quedan</button>';
    }
    const auto = ['opcion_multiple', 'escribir', 'ordenar', 'sopa_letras', 'ahorcado', 'rompecabezas', 'mosaico', 'concentrese'].includes(c.modo);
    return `<h3 style="margin-top:16px">Juzgar</h3>${auto ? '<p class="muted">Esta carta la valida el programa, pero pueden decidir ustedes si algo falla.</p>' : ''}<div class="botones juicio">${b}</div>`;
  }

  function panelResultado(t) {
    const r = t.resultado;
    return `<div class="caja panel">
      ${t.carta ? `<p class="muted">${h(t.carta.id)} · ${h(t.carta.nombre)}</p>` : ''}
      <p class="grande">${h(r.texto)}</p>
      ${(r.detalles || []).map((d) => `<p>${h(d)}</p>`).join('')}
      <p class="muted">Si se equivocaron al juzgar, corrijan moviendo las fichas en el panel derecho.</p>
      <div class="botones"><button class="btn verde grande" data-acc="mod" data-t="siguiente_turno">Siguiente turno ▶</button></div>
    </div>`;
  }

  // ---------- Lateral ----------
  function lateral() {
    let html = '';
    if (V.dudosas && V.dudosas.length) {
      html += `<div class="caja panel" style="border-color:var(--amarillo)"><h3>⏳ Respuestas dudosas</h3>${V.dudosas.map((d) => `
        <div class="dudosa"><div><b>${h(d.equipo)}</b> escribió: <span class="grande" style="font-size:20px">"${h(d.texto)}"</span><br><span class="muted">Correcta: ${h(d.esperado)} · ${new Date(d.t).toLocaleTimeString()}</span></div>
        <div style="display:flex;flex-direction:column;gap:6px"><button class="btn verde chico" data-acc="dudosa" data-id="${d.id}" data-ok="1">Aceptar</button><button class="btn rojo chico" data-acc="dudosa" data-id="${d.id}" data-ok="0">Rechazar</button></div></div>`).join('')}</div>`;
    }
    if (V.fase !== 'lobby') {
      const turnoId = V.turno ? V.turno.equipoId : null;
      const orden = V.orden && V.orden.length ? V.orden.map(eq).filter(Boolean) : V.equipos;
      html += `<div class="caja panel"><h3>Equipos</h3>${orden.map((q) => `
        <div class="eq-fila ${q.id === turnoId ? 'turno' : ''}">${avatar(q.personaje, 44)}<div>
          <div class="nom">${h(q.nombre)} ${q.llego ? '🏆' : ''} <span class="muted" style="font-family:var(--cuerpo)">código ${h(q.codigoEquipo)}</span></div>
          <div class="fila" style="gap:6px">
            <span class="casilla-ctrl"><button class="btn gris chico" data-acc="mover" data-id="${q.id}" data-d="-1">−</button><b>${Math.min(q.casilla, 10)}</b><button class="btn gris chico" data-acc="mover" data-id="${q.id}" data-d="1">+</button></span>
            ${botonesCamino(q, 'camino_mover')}
          </div>
          ${q.bonus && q.bonus.length ? `<div class="mini">${q.bonus.map((b, i) => `<button class="txt" title="Quitar" data-acc="quitar_bonus" data-id="${q.id}" data-i="${i}">${b.icono} ${h(b.nombre)} ✕</button>`).join('')}</div>` : ''}
          ${efectosTxt(q)}
        </div></div>`).join('')}</div>`;
    }
    if (V.fase === 'juego') {
      html += `<div class="caja panel"><h3>Controles</h3><div class="botones">
        <button class="btn azul chico" data-acc="confirmar" data-t="saltar_turno" data-msg="¿Saltar el turno actual?">⏭ Saltar turno</button>
        <button class="btn azul chico" data-acc="confirmar" data-t="repetir_turno" data-msg="¿Repetir el turno? La ficha vuelve a donde estaba al empezar el turno.">🔁 Repetir turno</button>
        <button class="btn naranja chico" data-acc="confirmar" data-t="terminar" data-msg="¿Terminar la partida ahora? Gana el equipo más cerca del trofeo.">🏁 Terminar partida</button>
      </div></div>`;
    }
    if (D && D.materiales && D.materiales.length) {
      html += `<div class="caja panel"><details><summary class="grande" style="font-size:20px;cursor:pointer">🧰 Materiales de toda la sesión</summary><table style="margin-top:8px">${D.materiales.map((m) => `<tr><td><b>${h(m.material)}</b><div class="muted">${h(m.seUsaEn || '')}</div></td><td style="text-align:right">${h(m.cantidad || '')}</td></tr>`).join('')}</table></details></div>`;
    }
    html += `<div class="caja panel"><h3>Partida</h3><div class="botones"><button class="btn rojo chico" data-acc="confirmar" data-t="nueva_partida" data-msg="¿Borrar TODO y empezar una partida nueva? Los equipos tendrán que volver a entrar.">🗑 Nueva partida</button></div>
      <div class="log">${(V.log || []).map((l) => `<div>${new Date(l.t).toLocaleTimeString()} · ${h(l.txt)}</div>`).join('')}</div></div>`;
    return html;
  }
  function efectosTxt(q) {
    const e = q.efectos || {};
    const l = [];
    if (e.dadoUno) l.push('dado roto');
    if (e.mediaFuerza) l.push('media fuerza');
    if (e.relojEnContra) l.push('reloj en contra');
    if (e.dadoAjeno) l.push('dado ajeno');
    if (e.alFinal) l.push('al final de la fila');
    if (e.intocablesHasta >= V.ronda) l.push('intocables');
    return l.length ? `<div class="muted">Efectos: ${l.join(', ')}</div>` : '';
  }

  // ---------- Acciones ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acc]');
    if (!b || b.disabled) return;
    const d = b.dataset;
    switch (d.acc) {
      case 'mod': {
        const extra = {};
        if (d.delta) extra.delta = Number(d.delta);
        if (d.i !== undefined) extra.i = Number(d.i);
        if (d.idx !== undefined) extra.idx = Number(d.idx);
        if (d.rival) extra.rival = d.rival;
        if (d.seg) extra.seg = Number(d.seg);
        if (d.equipo) extra.equipo = d.equipo;
        mod(d.t, extra);
        break;
      }
      case 'confirmar': if (confirm(d.msg)) mod(d.t); break;
      case 'quitar': if (confirm('¿Quitar este equipo?')) mod('quitar_equipo', { equipo: d.id }); break;
      case 'camino_por': mod('camino_por', { equipo: d.id, camino: d.c }); break;
      case 'camino_mover': if (confirm(`¿Mover a ${eq(d.id).nombre} al camino ${d.c}?`)) mod('mover', { equipo: d.id, camino: d.c }); break;
      case 'mover': { const q = eq(d.id); mod('mover', { equipo: d.id, casilla: Math.min(q.casilla, 10) + Number(d.d) }); break; }
      case 'quitar_bonus': mod('quitar_bonus', { equipo: d.id, i: Number(d.i) }); break;
      case 'juzgar': mod('juzgar', { veredicto: d.v }); break;
      case 'carta_mod': try { mod('carta_mod', { datos: JSON.parse(d.d) }); } catch (err) {} break;
      case 'dudosa': mod('dudosa', { id: d.id, aceptar: d.ok === '1' }); break;
      default: break;
    }
  });

  function tick() {
    if (!V) return;
    const ms = RT.restanteMs(V.temporizador);
    document.querySelectorAll('[data-reloj]').forEach((el) => {
      el.textContent = RT.fmtTiempo(ms);
      el.classList.toggle('alerta', V.temporizador.corriendo && ms <= 10000);
    });
  }
  setInterval(tick, 250);
})();
