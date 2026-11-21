/* Pantalla de proyección */
(function () {
  const { h, TIPOS, CAMINOS, ICONOS_OP, avatar, dado, htmlCarta, pintar } = RT;
  const $ = (s) => document.querySelector(s);
  const socket = RT.conectar({ rol: 'pantalla' });
  let V = null, D = null, INFO = null;
  const SOLO_TABLERO = new URLSearchParams(location.search).has('tablero');
  const prev = { etapa: null, n: null, fase: null, resultadoN: null };

  // ---------- Escala del escenario ----------
  function escalar() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    $('#escenario').style.transform = `scale(${s}) translate(-50%, -50%)`;
  }
  addEventListener('resize', escalar);
  escalar();

  // ---------- Activar sonido ----------
  const act = $('#activar');
  if (sessionStorage.getItem('rt-activado')) act.classList.add('oculto');
  addEventListener('click', () => {
    RT.activarAudio();
    if (!act.classList.contains('oculto')) {
      act.classList.add('oculto');
      sessionStorage.setItem('rt-activado', '1');
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    }
  });
  addEventListener('keydown', (e) => { if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {}); RT.activarAudio(); });

  // ---------- Geometría del tablero: caminos en espiral hacia el trofeo ----------
  // Cada camino arranca afuera y gira media vuelta (180°) mientras se acerca al centro.
  // Los caminos arrancan repartidos en el círculo (5 caminos: cada 72°) y no se chocan.
  const ORDEN_CAMINOS = ['Destreza', 'Mente', 'Creativo', 'Música', 'Equipo'];
  const PASO = 360 / ORDEN_CAMINOS.length;
  const LADOS = Object.fromEntries(ORDEN_CAMINOS.map((c, i) => [c, i]));
  const CX = 960, CY = 580;          // centro (trofeo)
  const R1 = 440, R10 = 188;         // radio de la casilla 1 y de la 10 (en px verticales)
  const GIRO = 180;                  // grados que gira cada camino
  const SX = 1.52;                   // estiramiento horizontal (la pantalla es más ancha que alta)
  const ANG0 = 10;                   // ángulo donde arranca el primer camino (ninguna salida queda arriba al centro ni sobre los equipos)
  const polar = (ang, r) => { const a = (ang * Math.PI) / 180; return { x: CX + r * Math.cos(a) * SX, y: CY + r * Math.sin(a) }; };
  const espiral = (p, f) => polar(ANG0 + p * PASO + GIRO * f, R1 - (R1 - R10) * f);
  // Posiciones a la misma distancia a lo largo de la curva (para que no se amontonen adentro)
  const RUTAS = {};
  ORDEN_CAMINOS.forEach((camino, p) => {
    const N = 600;
    const muestras = [];
    let largo = 0;
    for (let i = 0; i <= N; i++) {
      const pt = espiral(p, i / N);
      if (i) largo += Math.hypot(pt.x - muestras[i - 1].x, pt.y - muestras[i - 1].y);
      muestras.push({ ...pt, l: largo });
    }
    const casillas = [];
    for (let k = 0; k < 10; k++) {
      const meta = (largo * k) / 9;
      casillas.push(muestras.find((m) => m.l >= meta - 0.01) || muestras[N]);
    }
    RUTAS[camino] = { casillas, muestras, salida: null };
  });
  // La salida de cada camino busca un lugar libre cerca de su casilla 1:
  // sin tocar casillas, la guía (arriba derecha), los equipos (abajo izquierda) ni el título.
  const ZONAS_OCUPADAS = [
    { x1: 0, y1: 0, x2: 450, y2: 92 },         // título
    { x1: 670, y1: 0, x2: 1250, y2: 98 },      // aviso de turno
    { x1: 1690, y1: 0, x2: 1920, y2: 92 },     // ronda
    { x1: 1600, y1: 90, x2: 1920, y2: 310 },   // guía de casillas
    { x1: 0, y1: 630, x2: 335, y2: 1080 },     // equipos
  ];
  const todasCasillas = Object.values(RUTAS).flatMap((r) => r.casillas);
  const libre = (x, y) => {
    const w = 78, hh = 40; // media caja de la salida
    if (x - w < 8 || x + w > 1912 || y - hh < 8 || y + hh > 1072) return false;
    if (ZONAS_OCUPADAS.some((z) => x + w > z.x1 && x - w < z.x2 && y + hh > z.y1 && y - hh < z.y2)) return false;
    if (Math.hypot((x - CX) / 1.2, y - CY) < 190) return false;
    return todasCasillas.every((c) => Math.abs(c.x - x) > w + 44 || Math.abs(c.y - y) > hh + 44);
  };
  ORDEN_CAMINOS.forEach((camino) => {
    const r = RUTAS[camino];
    const [c1, c2] = r.casillas;
    let ux = c1.x - CX, uy = c1.y - CY;
    const n = Math.hypot(ux, uy); ux /= n; uy /= n;
    const tx = c1.x - c2.x, ty = c1.y - c2.y, tn = Math.hypot(tx, ty);
    const dirs = [[ux, uy]];
    for (const g of [30, -30, 60, -60, 90, -90, 120, -120]) {
      const a = (g * Math.PI) / 180;
      dirs.push([ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)]);
    }
    dirs.splice(1, 0, [tx / tn, ty / tn]);
    let elegido = null;
    for (const d of [118, 140, 165, 195]) {
      for (const [dx, dy] of dirs) { const x = c1.x + dx * d, y = c1.y + dy * d; if (libre(x, y)) { elegido = { x, y }; break; } }
      if (elegido) break;
    }
    r.salida = elegido || { x: c1.x + ux * 118, y: c1.y + uy * 118 };
    todasCasillas.push(r.salida);
  });
  function pos(camino, k) {
    if (k >= 11 || !RUTAS[camino]) return { x: CX, y: CY };
    if (k === 0) return RUTAS[camino].salida;
    return RUTAS[camino].casillas[k - 1];
  }

  function construirTablero() {
    let svg = '<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>';
    let html = '';
    for (const camino of ORDEN_CAMINOS) {
      const col = CAMINOS[camino].color;
      const r = RUTAS[camino];
      const s = r.salida;
      const pts = [`${s.x},${s.y}`, `${r.casillas[0].x},${r.casillas[0].y}`, ...r.muestras.filter((_, i) => i % 6 === 0).map((m) => `${m.x.toFixed(1)},${m.y.toFixed(1)}`), `${r.casillas[9].x},${r.casillas[9].y}`, `${CX},${CY}`];
      svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="34" stroke-opacity=".28" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`;
      svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="16" stroke-opacity=".35" stroke-linecap="round" stroke-linejoin="round"/>`;
      html += `<div class="salida" style="left:${s.x}px;top:${s.y}px;--c:${col}">${RT.svgIcono(CAMINOS[camino].svg, 30, 2.4)}${h(camino).toUpperCase()}</div>`;
      (D.tablero[camino] || []).forEach((tipo, i) => {
        const p = pos(camino, i + 1);
        html += `<div class="tablero-casilla" style="left:${p.x}px;top:${p.y}px">${RT.casillaHTML(tipo, { tam: tipo === 'Reto final' ? 92 : 80, num: i + 1, borde: col, extra: `data-k="${h(camino)}:${i + 1}"` })}</div>`;
      });
    }
    $('#caminos-svg').innerHTML = svg;
    $('#casillas').innerHTML = html;
    document.querySelector('#trofeo .trofeo-icono').innerHTML = RT.svgIcono('final', 108, 2);
    // Guía de casillas
    pintar($('#leyenda'), Object.entries(TIPOS).map(([k]) => `<div class="it">${RT.casillaHTML(k, { tam: 34 })}${k}</div>`).join(''));
  }

  // ---------- Fichas ----------
  const fichas = {};
  const ultimo = {};
  const OFFS = {
    1: [[0, 0]], 2: [[-20, 0], [20, 0]], 3: [[-24, 4], [24, 4], [0, -16]],
    4: [[-22, 6], [22, 6], [-22, -22], [22, -22]], 5: [[-30, 6], [0, 6], [30, 6], [-15, -22], [15, -22]], 6: [[-30, 6], [0, 6], [30, 6], [-30, -22], [0, -22], [30, -22]],
  };
  function renderFichas(v) {
    const cont = $('#fichas');
    const visibles = v.equipos.filter((q) => q.camino);
    const grupos = {};
    visibles.forEach((q) => { const k = q.llego || q.casilla > 10 ? 'trofeo' : `${q.camino}:${q.casilla}`; (grupos[k] = grupos[k] || []).push(q); });
    const turnoId = v.fase === 'juego' && v.turno ? v.turno.equipoId : null;
    for (const [k, lista] of Object.entries(grupos)) {
      const offs = OFFS[Math.min(lista.length, 6)];
      lista.forEach((q, i) => {
        let el = fichas[q.id];
        if (!el) {
          el = document.createElement('div');
          el.className = 'ficha';
          cont.appendChild(el);
          fichas[q.id] = el;
        }
        const bonus = (q.bonus || []).map((b) => b.icono).join('');
        const html = `${avatar(q.personaje, 82)}<div class="tag">${h(q.nombre)}</div>${bonus ? `<div class="bonus emoji">${bonus}</div>` : ''}`;
        if (el.__html !== html) { el.innerHTML = html; el.__html = html; }
        el.style.setProperty('--cam', CAMINOS[q.camino]?.color || '#fff');
        el.classList.toggle('turno', q.id === turnoId);
        const [ox, oy] = offs[i] || [0, 0];
        const casilla = k === 'trofeo' ? 11 : q.casilla;
        moverFicha(q.id, el, q.camino, casilla, ox, oy);
      });
    }
    for (const id of Object.keys(fichas)) {
      if (!visibles.some((q) => q.id === id)) { fichas[id].remove(); delete fichas[id]; delete ultimo[id]; }
    }
  }
  function moverFicha(id, el, camino, casilla, ox, oy) {
    const u = ultimo[id];
    const colocar = (k, dx, dy) => { const p = pos(camino, k); el.style.left = p.x + dx + 'px'; el.style.top = (k === 0 ? Math.max(p.y + dy - 26, 92) : p.y + dy) + 'px'; };
    if (u && u.camino === camino && u.casilla === casilla) {
      if (!el.__pasos) colocar(casilla, ox, oy);
      return;
    }
    clearTimeout(el.__timer);
    if (u && u.camino === camino && casilla > u.casilla && casilla - u.casilla <= 3 && casilla <= 10) {
      const pasos = [];
      for (let k = u.casilla + 1; k <= casilla; k++) pasos.push(k);
      el.__pasos = true;
      const paso = () => {
        const k = pasos.shift();
        colocar(k, pasos.length ? 0 : ox, pasos.length ? 0 : oy);
        el.classList.remove('salto'); void el.offsetWidth; el.classList.add('salto');
        RT.sonidos.paso();
        if (pasos.length) el.__timer = setTimeout(paso, 520);
        else el.__pasos = false;
      };
      el.__timer = setTimeout(paso, 700);
    } else {
      el.__pasos = false;
      colocar(casilla, ox, oy);
    }
    ultimo[id] = { camino, casilla };
  }

  // ---------- Barra superior y equipos ----------
  function siguienteEquipo(v) {
    if (!v.orden || !v.orden.length) return null;
    for (let i = 1; i <= v.orden.length; i++) {
      const id = v.orden[(v.turnoIdx + i) % v.orden.length];
      const q = RT.equipo(v, id);
      if (q && !q.llego) return q;
    }
    return null;
  }

  function estadoTurno(t) {
    switch (t.etapa) {
      case 'dado': return '¡Tiren el dado!';
      case 'eleccion_dado': return 'Eligiendo dado';
      case 'casilla': return `Avanzan ${t.dado || ''}`;
      case 'elegir_rival': return 'Eligiendo rival';
      case 'elegir_carta': return 'Eligiendo carta';
      case 'carta': return t.carta ? t.carta.nombre : 'Jugando';
      case 'resultado': return 'Resultado';
      default: return '';
    }
  }

  function renderBarra(v) {
    const t = v.turno;
    let pill = '';
    if (v.fase === 'juego' && t) {
      const q = RT.equipo(v, t.equipoId);
      pill = `<div class="pill-turno"><small>TURNO</small>${avatar(q.personaje, 58)}${h(q.nombre)}<span class="estado">${h(estadoTurno(t))}</span></div>`;
    }
    pintar($('#turno-pill'), pill);
    let der = '';
    if (v.temporizador && v.temporizador.totalMs > 0 && v.fase === 'juego') der += `<div class="reloj-mini" data-reloj="mini">--</div>`;
    if (v.fase === 'juego') der += `<div style="display:flex;align-items:center;gap:10px">RONDA <span class="hex" style="width:56px;height:62px;font-size:28px">${v.ronda}</span></div>`;
    pintar($('#barra-der'), der);
  }

  function renderEquipos(v) {
    if (!['juego', 'final'].includes(v.fase)) { pintar($('#equipos'), ''); return; }
    const orden = v.orden && v.orden.length ? v.orden.map((id) => RT.equipo(v, id)).filter(Boolean) : v.equipos;
    const turnoId = v.fase === 'juego' && v.turno ? v.turno.equipoId : null;
    const html = orden.map((q) => {
      const c = CAMINOS[q.camino] || { color: '#8f7bd1', svg: '' };
      const casilla = Math.min(q.casilla, 10);
      return `<div class="eq ${q.id === turnoId ? 'turno' : ''}" style="--cam:${c.color}">
        <div class="av">${avatar(q.personaje, 54)}</div>
        <div class="fila1"><span class="n">${h(q.nombre)}</span><span class="pos">${casilla}/10</span></div>
        <div class="fila2">${c.svg ? RT.svgIcono(c.svg, 16, 2.4) : ''}${h(q.camino || '')}${q.bonus && q.bonus.length ? `<span class="bonus emoji">${q.bonus.map((b) => b.icono).join('')}</span>` : ''}</div>
        <div class="barra"><i style="width:${casilla * 10}%"></i></div>
        ${q.llego ? '<div class="llego">🏆 ¡LLEGÓ!</div>' : ''}
      </div>`;
    }).join('');
    pintar($('#equipos'), html);
  }

  // ---------- Fases ----------
  function capaLobby(v) {
    const vacios = Math.max(0, 6 - v.equipos.length);
    return `<div class="pantalla-completa">
      <div class="lobby-titulo arcade">RUMBO AL <span style="color:var(--amarillo)">TROFEO</span> <span class="emoji">🏆</span></div>
      <div class="lobby">
        <div class="qr-caja panel">
          <div class="neon-cian titulo" style="font-size:40px">¡Escanea para entrar!</div>
          ${INFO ? `<img src="${INFO.qr}" alt="QR">` : '<div style="width:440px;height:440px"></div>'}
          <div class="url">${INFO ? h(INFO.urlCorta) : ''}</div>
          <div style="font-size:26px;color:var(--texto2)">Código</div>
          <div class="codigo">${h(v.codigo)}</div>
        </div>
        <div class="lobby-equipos panel">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2 style="font-size:54px">Equipos</h2>
            <span class="hex" style="width:90px;height:100px;font-size:34px">${v.equipos.length}/6</span>
          </div>
          <div class="lobby-grid">
            ${v.equipos.map((q) => `<div class="lobby-eq aparecer">${avatar(q.personaje, 140)}<div class="n">${h(q.nombre)}</div></div>`).join('')}
            ${Array.from({ length: vacios }, () => '<div class="lobby-eq vacio">?</div>').join('')}
          </div>
          <div class="sub latido" style="margin-top:auto">${v.equipos.length < 2 ? 'Se necesitan mínimo 2 equipos' : '¡Esperando a que el moderador inicie el juego!'}</div>
        </div>
      </div>
    </div>`;
  }

  function capaInstructivo(v) {
    const paso = v.instructivo;
    const TOTAL = 5;
    const casillaMini = (tipo, tam = 84) => RT.casillaHTML(tipo, { tam });
    let titulo = '', cuerpo = '', pie = '';
    if (paso === 0) {
      titulo = '¿Cómo se juega?';
      const pasos = [
        ['Elijan un camino', `Cada equipo escoge 1 de los ${D.caminos.length} caminos.`, `<div class="mini-caminos">${Object.values(CAMINOS).map((c) => `<span style="--c:${c.color};color:${c.color}">${RT.svgIcono(c.svg, 46, 2.3)}</span>`).join('')}</div>`],
        ['Tiren el dado', 'En su turno, desde el celular. Sale 1, 2 o 3.', `<div class="flotar">${dado(3)}</div>`],
        ['Cumplan la casilla', 'Retos, duelos, bonus, sorpresas…', `<div class="mini-casillas">${casillaMini('Reto')}${casillaMini('Duelo')}${casillaMini('Bonus')}</div>`],
        ['¡Lleguen al trofeo!', 'Ganen el Reto final de la casilla 10.', '<div class="emoji flotar" style="font-size:170px;filter:drop-shadow(0 0 30px rgba(255,210,63,.8))">🏆</div>'],
      ];
      cuerpo = `<div class="pasos">${pasos.map(([b, p, vis], i) => `${i ? '<div class="flecha">›</div>' : ''}<div class="paso panel aparecer" style="animation-delay:${i * 0.12}s"><span class="hex">${i + 1}</span><div class="vis">${vis}</div><b>${b}</b><p>${p}</p></div>`).join('')}</div>`;
      pie = 'Gana el primer equipo que llegue al trofeo, en el centro del tablero.';
    } else if (paso === 1) {
      titulo = `Los ${D.caminos.length} caminos`;
      cuerpo = `<div class="caminos-instr">${D.caminos.map((c, i) => { const info = CAMINOS[c.nombre]; return `<div class="camino-instr panel aparecer" style="--c:${info.color};animation-delay:${i * 0.08}s"><div class="ico" style="color:${info.color}">${RT.svgIcono(info.svg, 78, 2.1)}</div><div><b>${h(c.nombre)}</b><p>${h(c.tema)}</p></div></div>`; }).join('')}</div>
        <div class="regla-chip">👥 Máximo 2 equipos por camino</div>`;
      pie = 'Las cartas de cada reto salen del camino que eligieron.';
    } else if (paso === 2) {
      titulo = 'Tipos de casilla';
      const info = {
        'Reto': ['Eligen 1 de 4 cartas boca abajo.', [['si', '✅ Ganan: se quedan'], ['no', '❌ Pierden: retroceden 1']]],
        'Duelo': ['Eligen contra qué equipo juegan.', [['si', '✅ El que gana se queda'], ['no', '❌ El que pierde retrocede 1']]],
        'Penitencia': ['Una prueba que deben cumplir.', [['si', '✅ La cumplen: se quedan'], ['no', '❌ Si no: retroceden 1']]],
        'Bonus': ['Una ayuda para su equipo.', [['si', '🎁 Avanzar, escudo, doble dado…']]],
        'Sorpresa': ['Puede ser buena… o no tanto.', [['', '❓ Cambios, atajos, retrocesos']]],
        'Vacía': ['No pasa nada.', [['', '💤 ¡Descansan!']]],
        'Reto final': ['La casilla 10, junto al trofeo.', [['si', '🏆 Ganan: ¡llegan al trofeo!'], ['no', '🔁 Pierden: lo intentan otra vez']]],
      };
      cuerpo = `<div class="tipos-instr">${Object.entries(TIPOS).map(([k, t], i) => `<div class="tipo-instr panel aparecer" style="--c:${t.color};animation-delay:${i * 0.06}s">${casillaMini(k, 100)}<b>${k}</b><p>${info[k][0]}</p><div class="res-chips">${info[k][1].map(([c, x]) => `<span class="${c}">${x}</span>`).join('')}</div></div>`).join('')}
        <div class="tipo-instr panel aparecer" style="--c:var(--cian);animation-delay:.42s"><div class="emoji" style="font-size:80px;height:106px">⏱️</div><b>Tiempo</b><p>Los retos tienen temporizador y se ve aquí en grande.</p><div class="res-chips"><span>El moderador lo inicia</span></div></div></div>`;
    } else if (paso === 3) {
      titulo = 'En su celular';
      const tel = (n, cap, contenido) => `<div class="tel-cap aparecer" style="animation-delay:${n * 0.12}s"><div class="telefono">${contenido}</div><span class="hex">${n}</span><p>${cap}</p></div>`;
      cuerpo = `<div class="celulares">
        ${tel(1, 'Tiren el dado cuando sea su turno', `<div class="t">¡Es su turno!</div><div class="flotar" style="margin:40px 0">${dado(2)}</div><div class="btn verde" style="font-size:24px">TIRAR EL DADO</div>`)}
        <div class="flecha">›</div>
        ${tel(2, 'Elijan 1 de 4 cartas boca abajo', `<div class="t">Cayeron en <span style="color:var(--azul)">⚡ RETO</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">${'<div class="carta-dorso" style="width:118px;height:160px;font-size:44px;border-width:4px">?</div>'.repeat(4)}</div>`)}
        <div class="flecha">›</div>
        ${tel(3, 'Respondan, adivinen y jueguen', `<div class="t neon" style="font-size:36px">¡Te retaron!</div><div style="display:flex;flex-direction:column;gap:12px;width:100%;margin-top:14px">${['▲ Jonás', '◆ Daniel', '● Pedro', '■ Elías'].map((o, i) => `<div class="opcion op-${i}" style="font-size:24px;min-height:0;padding:14px 16px;border-radius:14px">${o}</div>`).join('')}</div>`)}
      </div>`;
      pie = 'Trivias, palabras secretas y mini juegos también salen en el celular.';
    } else {
      titulo = '¡Listos para jugar!';
      const b = (cls, e, n, p) => `<div class="bonus-carta panel ${cls}"><span class="emoji">${e}</span><b>${n}</b><p>${p}</p></div>`;
      cuerpo = `<div class="final-instr">
        <div class="bonus-cartas aparecer">
          ${b('', '🛡️', 'Escudo', 'Los salva del próximo retroceso')}
          ${b('', '🎲', 'Doble dado', 'Tiran dos veces y eligen')}
          ${b('', '🤝', 'Refuerzo', 'Ayuda de alguien de otro equipo')}
          ${b('sorp', '🔀', 'Intercambio', 'Cambian de casilla con otro equipo')}
          ${b('sorp', '🪑', 'Silla musical', '¡Juegan todos los equipos!')}
          ${b('pen', '🗿', 'Penitencias', 'Estatuas, equipo mudo, dado roto…')}
        </div>
        <div class="reglas-oro panel aparecer" style="animation-delay:.15s"><h3>Reglas de oro</h3><ul>
          <li><span class="emoji">🧑‍⚖️</span><span>El <b style="color:var(--amarillo)">moderador</b> es el juez: su decisión es final.</span></li>
          <li><span class="emoji">📱</span><span>Solo juega el celular del equipo en turno.</span></li>
          <li><span class="emoji">🎒</span><span>Los bonus guardados se ven junto a su ficha.</span></li>
          <li><span class="emoji">🏁</span><span>Si se acaba el tiempo, gana el equipo más cerca del trofeo.</span></li>
          <li><span class="emoji">🎉</span><span>¡Jueguen limpio y diviértanse!</span></li>
        </ul></div>
      </div>`;
    }
    const deco = ['🏆', '🎲', '⭐', '⚡', '🎁', '⚔️'].map((e, i) => `<span style="left:${[4, 88, 10, 82, 47, 93][i]}%;top:${[18, 12, 78, 74, 90, 46][i]}%;animation-delay:${i * 0.5}s">${e}</span>`).join('');
    return `<div class="instructivo">
      <div class="instr-deco">${deco}</div>
      <div class="instr-top"><span class="instr-chip">INSTRUCTIVO · ${paso + 1}/${TOTAL}</span><div class="logo arcade" style="font-size:34px">RUMBO AL <span>TROFEO</span> <span class="emoji">🏆</span></div><div class="instr-prog">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i <= paso ? 'on' : ''}"></i>`).join('')}</div></div>
      <h2 class="instr-titulo arcade rebote" data-p="${paso}">${titulo}</h2>
      <div class="instr-cuerpo">${cuerpo}</div>
      ${pie ? `<div class="instr-pie">${pie}</div>` : ''}
    </div>`;
  }

  function capaInicio(v) {
    const ini = v.inicio;
    if (!ini) return '';
    const resp = ini.respuestas || {};
    const ops = ini.opciones.map((o, i) => {
      let cls = '';
      if (ini.estado !== 'pregunta' && ini.correcta !== null) cls = i === ini.correcta ? 'correcta' : 'apagada';
      return `<div class="opcion op-${i} ${cls}"><span class="ic">${ICONOS_OP[i]}</span>${h(o)}</div>`;
    }).join('');
    let pie = '';
    if (ini.estado === 'pregunta') {
      pie = `<div class="inicio-avatares">${v.equipos.map((q) => `<div class="inicio-av ${resp[q.id] ? 'listo' : ''}">${avatar(q.personaje, 90)}<span>${h(q.nombre)}</span><span>${resp[q.id] ? '✅' : '⏳'}</span></div>`).join('')}</div>`;
    } else if (ini.estado === 'nadie') {
      pie = `<div class="grande-txt neon latido">¡Nadie acertó! Va la pregunta de desempate ${ini.indice + 2}</div>`;
    } else {
      pie = `<div class="orden-lista">${ini.orden.map((id, i) => {
        const q = RT.equipo(v, id);
        const r = resp[id];
        const acerto = r && r.opcion === ini.correcta;
        return `<div class="orden-fila panel aparecer" style="animation-delay:${i * 0.15}s"><span class="pos">${i + 1}°</span>${avatar(q.personaje, 70)}<span>${h(q.nombre)}</span><span>${ini.sorteo ? '🎲' : r ? `${acerto ? '✅' : '❌'} ${(r.ms / 1000).toFixed(1)} s` : '—'}</span></div>`;
      }).join('')}</div>${ini.sorteo ? '<div class="sub">Nadie acertó en las 3 preguntas: el orden se sorteó</div>' : ''}`;
    }
    const titulo = ini.estado === 'resultado' ? 'Orden de turnos' : ini.indice === 0 ? '¡Veamos quién empieza el juego!' : `Pregunta de desempate ${ini.indice + 1}`;
    return `<div class="pantalla-completa" style="gap:30px">
      <h2 class="arcade" style="font-size:66px">${titulo}</h2>
      ${ini.estado !== 'resultado' ? `<div class="pregunta" style="max-width:1500px">${h(ini.pregunta)}</div><div class="opciones" style="max-width:1500px">${ops}</div>` : ''}
      ${pie}
    </div>`;
  }

  function capaCaminos(v) {
    const pendientes = v.equipos.filter((q) => !q.camino);
    return `<div class="pantalla-completa" style="gap:30px">
      <h2 class="arcade" style="font-size:70px">¡Elijan su camino!</h2>
      <div class="sub" style="margin-top:-14px">Máximo 2 equipos por camino</div>
      <div class="caminos-grid">${D.caminos.map((c) => {
        const info = CAMINOS[c.nombre];
        const aqui = v.equipos.filter((q) => q.camino === c.nombre);
        const lleno = aqui.length >= 2;
        return `<div class="camino-card panel ${lleno ? 'lleno' : ''}" style="--c:${info.color}"><span class="cupo">${lleno ? 'LLENO' : `${aqui.length}/2`}</span><span class="ico-cam" style="color:${info.color}">${RT.svgIcono(info.svg, 70, 2.2)}</span><b>${h(c.nombre)}</b><p>${h(c.tema)}</p><div class="avs">${aqui.map((q) => `<div style="display:flex;flex-direction:column;align-items:center;font-size:20px">${avatar(q.personaje, 80, 'rebote')}${h(q.nombre)}</div>`).join('')}</div></div>`;
      }).join('')}</div>
      <div class="sub">${pendientes.length ? `Faltan: ${pendientes.map((q) => h(q.nombre)).join(', ')}` : '¡Todos listos! El moderador da la señal'}</div>
    </div>`;
  }

  function capaFinal(v) {
    const f = v.final;
    if (!f) return '';
    const gan = f.ganadores.map((id) => RT.equipo(v, id)).filter(Boolean);
    return `<div class="pantalla-completa" style="gap:24px">
      <div class="arcade ${f.empate ? '' : 'latido'}" style="font-size:${f.empate ? 110 : 140}px">${f.empate ? '¡EMPATE!' : '¡GANADOR!'}</div>
      <div style="display:flex;gap:60px">${gan.map((q) => `<div class="final-ganador rebote">${avatar(q.personaje, 260)}<div class="titulo neon" style="font-size:64px">${h(q.nombre)}</div></div>`).join('')}</div>
      ${f.empate ? '<div class="sub">Empate: se decide con un duelo</div>' : ''}
      <div class="final-tabla">${f.tabla.map((id, i) => {
        const q = RT.equipo(v, id);
        return `<div class="orden-fila panel" style="grid-template-columns:80px 70px 1fr 260px;padding:6px 20px"><span class="pos">${i + 1}°</span>${avatar(q.personaje, 60)}<span>${h(q.nombre)}</span><span style="text-align:right">${q.llego ? '🏆 Trofeo' : `${CAMINOS[q.camino] ? `<span style="color:${CAMINOS[q.camino].color};vertical-align:middle">${RT.svgIcono(CAMINOS[q.camino].svg, 30, 2.4)}</span>` : ''} casilla ${q.casilla}`}</span></div>`;
      }).join('')}</div>
    </div>`;
  }

  // ---------- Juego: modales ----------
  function quienes(v) {
    const t = v.turno;
    if (t.carta && t.carta.modo === 'especial') return `<div class="quienes"><span class="quien"><span class="emoji" style="font-size:54px">🪑</span> ¡TODOS LOS EQUIPOS!</span></div>`;
    const ps = (t.duelo || [t.equipoId]).map((id) => RT.equipo(v, id)).filter(Boolean);
    const caja = (q) => `<span class="quien">${avatar(q.personaje, 76)}${h(q.nombre)}</span>`;
    let html = ps.map(caja).join('<span class="vs">VS</span>');
    if (t.jueces) html += `<div class="jueces">🧑‍⚖️ Jueces: ${h(RT.equipo(v, t.jueces)?.nombre)}</div>`;
    return `<div class="quienes">${html}</div>`;
  }

  function avisos(t) {
    if (!t.avisos || !t.avisos.length) return '';
    return `<div class="avisos">${t.avisos.map((a) => `<div class="aviso">⚠️ ${h(a)}</div>`).join('')}</div>`;
  }

  function capaJuego(v) {
    const t = v.turno;
    if (!t) return '';
    if (t.etapa === 'elegir_rival') {
      const q = RT.equipo(v, t.equipoId);
      return `<div class="velo"></div><div class="modal panel solo aparecer"><div style="display:flex;flex-direction:column;align-items:center;gap:30px">
        <div class="arcade" style="font-size:120px;color:var(--rojo)">⚔️ ¡DUELO!</div>
        <div class="grande-txt">${h(q.nombre)} elige a quién retar…</div>
        <div style="display:flex;gap:40px">${t.rivales.map((id) => { const r = RT.equipo(v, id); return `<div class="lobby-eq">${avatar(r.personaje, 120)}<div class="n">${h(r.nombre)}</div></div>`; }).join('')}</div>
      </div></div>`;
    }
    if (t.etapa === 'elegir_carta') {
      const q = RT.equipo(v, t.equipoId);
      const tipo = t.casillaTipo;
      const ti = TIPOS[tipo] || TIPOS.Reto;
      return `<div class="velo"></div><div class="modal panel solo aparecer"><div style="display:flex;flex-direction:column;align-items:center;gap:34px">
        <div class="arcade" style="font-size:100px;color:${ti.color}"><span class="emoji">${ti.icono}</span> ${h(tipo).toUpperCase()}</div>
        ${quienes(v)}
        <div class="dorsos">${Array.from({ length: t.numOpciones }, (_, i) => `<div class="carta-dorso voltear-in" style="animation-delay:${i * 0.12}s">?</div>`).join('')}</div>
        <div class="grande-txt latido" style="font-size:44px">${h(q.nombre)} está eligiendo una carta…</div>
      </div></div>`;
    }
    // Carta en juego y resultado: pantalla dividida en dos.
    // Izquierda: equipo(s), reloj y carta. Derecha: la prueba (gráficos) y luego el resultado.
    if ((t.etapa === 'carta' || t.etapa === 'resultado') && t.carta) {
      return `<div class="velo"></div><div class="modal panel dividido">
        <div class="lado-izq">
          <div id="m-quienes"></div>
          <div id="m-reloj"></div>
          <div id="m-carta" class="m-carta"></div>
        </div>
        <div class="lado-der" id="m-der"></div>
      </div>`;
    }
    return '';
  }

  function zonaCarta(v) {
    const t = v.turno;
    const c = t.carta;
    return `${avisos(t)}<div class="contenido-modo">${contenidoModo(v, t, c, t.juego || {}, t.pantalla || {})}</div>`;
  }
  // Tamaño de letra de la carta según lo largo del texto, para que siempre quepa
  function claseLargo(c) {
    const n = (c.instrucciones || '').length + (c.comoSeGana || '').length;
    return n > 420 ? 'larga' : n > 260 ? 'media' : '';
  }

  const cuentaAtras = (fin) => (fin ? `<div class="cuenta" data-fin="${fin}">…</div>` : '');

  function contenidoModo(v, t, c, j, p) {
    const nombre = (id) => h(RT.equipo(v, id)?.nombre);
    switch (c.modo) {
      case 'presencial': {
        let html = '';
        if (j.imagen) html += `<img class="imagen-carta" src="/${h(j.imagen)}" alt="">`;
        if (j.villano) html += `<div class="grande-txt">😈 Villano: <span class="neon">${h(j.villano.nombre)}</span></div><div class="sub">Ese equipo escoge a una persona</div>`;
        if (!html) html = `<div class="grande-txt">¡A jugar!</div><div class="sub">${c.tipo === 'Penitencia' ? 'El moderador marca si la cumplieron' : 'El moderador decide quién gana'}</div>`;
        return html;
      }
      case 'palabra_secreta': {
        let html = `<div class="emoji" style="font-size:130px">🤫</div><div class="grande-txt">${j.enPanel ? 'El moderador tiene la palabra' : 'La palabra secreta está en el celular'}</div>`;
        if (!j.enPanel && j.cantidad > 1) html += `<div class="marcador">${Object.entries(j.idx || {}).map(([id, i]) => `<div>${nombre(id)}: palabra <b style="font-size:50px">${i + 1}</b>/${j.cantidad}</div>`).join('')}</div>`;
        if (j.enPanel && j.cantidad > 1) html += `<div class="sub">Palabra ${j.idxPanel + 1} de ${j.cantidad}</div>`;
        if (j.adivinadorEscribe) html += `<div class="sub">El adivinador escribe su respuesta en el celular</div>`;
        if (j.esperandoModerador) html += `<div class="aviso">⏳ El moderador está revisando una respuesta</div>`;
        return html;
      }
      case 'opcion_multiple': return vistaPregunta(v, j);
      case 'escribir': return vistaEscribir(v, j, p);
      case 'ordenar':
        return `<div class="sub">${h(j.titulo || '')}</div><div class="items-lista">${j.items.map((x) => `<div>🔀 ${h(x)}</div>`).join('')}</div><div class="sub latido">¡Ordénenlas en el celular!</div>`;
      case 'secuencia_pantalla': return vistaSecuencia(v, j, p);
      case 'especial':
        return `<div class="emoji flotar" style="font-size:160px">🪑🎵</div><div class="grande-txt neon">¡SILLA MUSICAL!</div><div class="sub">Cada equipo elige 2 participantes. ¡El último sentado gana un bonus!</div>
          <div style="display:flex;gap:20px">${v.equipos.filter((q) => !q.llego).map((q) => avatar(q.personaje, 90)).join('')}</div>`;
      case 'sopa_letras': return vistaSopa(j);
      case 'ahorcado':
        return `<div class="ahorcado-fila">${RT.ahorcadoSVG(j.errores, j.max)}<div style="display:flex;flex-direction:column;gap:24px;align-items:center">${mascara(j.mascara)}<div class="usadas">${(j.usadas || []).join(' ')}</div><div class="cuenta">Errores: ${j.errores} de ${j.max}</div></div></div>`;
      case 'rompecabezas':
        return `<div style="display:flex;gap:50px">${Object.entries(j.equipos).map(([id, e]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <div class="titulo" style="font-size:34px">${nombre(id)}</div>${rompe(j.imagen, e.perm)}<div class="cuenta">${e.armado ? '✅ ¡Armado!' : `${e.correctas}/9 piezas`}</div></div>`).join('')}</div>
          ${j.esperandoModerador ? '<div class="aviso">⏳ El moderador está revisando una respuesta</div>' : ''}`;
      case 'mosaico':
        if (j.estado === 'listo') return `<div class="grande-txt">Memoricen el mosaico</div><div class="sub">Aparece ${j.verSegundos} segundos cuando el moderador dé la señal</div>${gridEmojis(Array(9).fill(null), 3, 'dorso')}`;
        if (j.estado === 'mostrando') return `${gridEmojis(p.grid || [], 3)}${cuentaAtras(j.finVer)}`;
        return `${gridEmojis(Array(9).fill('?'), 3, 'vacio')}<div class="sub latido">¡Armen el mosaico en el celular!</div>`;
      case 'concentrese': {
        if (j.estado === 'listo') return `<div class="grande-txt">Memoricen las 12 cartas</div><div class="sub">Aparecen ${j.verSegundos} segundos cuando el moderador dé la señal</div>`;
        if (j.estado === 'mostrando') return `${gridEmojis(p.cartas || [], 4)}${cuentaAtras(j.finVer)}`;
        return `${gridEmojis(j.caras.map((x) => x), 4, 'dorso', j.emparejadas)}<div class="cuenta">Parejas: ${j.emparejadas.length / 2} de 6 · Intentos: ${j.intentos}</div>`;
      }
      case 'automatica': return `<div class="grande-txt">${h(j.texto || '')}</div>`;
      case 'eleccion':
        return `<div class="grande-txt">${nombre(t.equipoId)} está eligiendo…</div><div class="items-lista">${(j.opciones || []).map((o) => `<div>${o.personaje ? avatar(o.personaje, 50) : ''} ${h(o.texto)} <span style="color:var(--texto2);font-size:24px">${h(o.detalle || '')}</span></div>`).join('')}</div>`;
      default: return '';
    }
  }

  function vistaPregunta(v, j) {
    if (!j.preguntas) return '';
    const ids = Object.keys(j.progreso || {});
    let k = 0;
    if (!j.duelo) k = Math.min(j.progreso[ids[0]] || 0, j.cantidad - 1);
    else if (!j.masAciertos) k = 0;
    const p = j.preguntas[k];
    let html = '';
    if (j.cantidad > 1 && !j.masAciertos) html += `<div class="sub">${p.subtitulo ? h(p.subtitulo) : `Pregunta ${k + 1} de ${j.cantidad}`}</div>`;
    else if (p.subtitulo) html += `<div class="sub">${h(p.subtitulo)}</div>`;
    if (j.masAciertos) {
      html += `<div class="grande-txt">${j.cantidad} preguntas seguidas</div><div class="marcador">${ids.map((id) => `<div>${avatar(RT.equipo(v, id)?.personaje, 60)} <b>${j.progreso[id]}</b>/${j.cantidad}</div>`).join('')}</div><div class="sub">Respondan en el celular</div>`;
      return html;
    }
    if (p.imagen) html += `<img class="bandera" src="/${h(p.imagen)}" alt="">`;
    html += `<div class="pregunta ${p.grande ? 'emojis' : ''}">${h(p.texto)}</div>`;
    html += `<div class="opciones">${p.opciones.map((o, i) => `<div class="opcion op-${i % 4}"><span class="ic">${ICONOS_OP[i % 4]}</span>${h(o)}</div>`).join('')}</div>`;
    if (j.duelo) html += `<div class="marcador" style="font-size:30px">${ids.map((id) => `<div>${h(RT.equipo(v, id)?.nombre)} ${j.progreso[id] ? '✅ respondió' : '⏳'}</div>`).join('')}</div>`;
    if (j.bloqueado) html = `<div class="grande-txt">Esperen la señal…</div>`;
    if (j.oculta) html = `<div class="emoji" style="font-size:120px">📖</div><div class="grande-txt">Lean la instrucción</div><div class="sub">${h(j.queAparece.charAt(0).toUpperCase() + j.queAparece.slice(1))} aparece cuando el moderador dé la señal</div>`;
    return html;
  }

  function vistaEscribir(v, j, p) {
    if (j.lista) {
      if (j.estado === 'listo') return `<div class="emoji" style="font-size:120px">🧠</div><div class="grande-txt">Memoricen ${j.total} palabras</div><div class="sub">Aparecen ${j.verSegundos} segundos cuando el moderador dé la señal</div>`;
      if (j.estado === 'mostrando') return `<div class="lista-palabras" style="max-width:1000px">${(p.lista || []).map((w) => `<span style="font-size:52px;padding:12px 26px">${h(w)}</span>`).join('')}</div>${cuentaAtras(j.finVer)}`;
      return `<div class="grande-txt">¡Escriban en el celular las que recuerden!</div><div class="marcador"><div>Llevan <b>${j.encontradas.length}</b> de ${j.total}</div></div><div class="sub">Necesitan ${j.minimo}</div>`;
    }
    if (j.duelo) {
      const it = j.items[j.ronda];
      const ganador = j.rondas[j.ronda].ganador;
      if (j.oculta) {
        return `<div class="sub">Ronda ${j.ronda + 1} de ${j.items.length}</div>
          <div class="emoji" style="font-size:120px">${j.numero ? '🧮' : '🎵'}</div>
          <div class="grande-txt">Lean la instrucción</div>
          <div class="sub">${j.numero ? 'La operación aparece' : 'La ronda empieza'} cuando el moderador dé la señal</div>`;
      }
      const resp = ganador && j.numero ? `<div class="grande-txt">Respuesta: ${h(j.rondas[j.ronda].respuesta)}</div>` : '';
      return `<div class="sub">Ronda ${j.ronda + 1} de ${j.items.length}</div>
        <div class="${j.numero ? 'operacion' : 'grande-txt'}">${h(it.texto)}${j.numero && !ganador ? ' = ?' : ''}</div>${resp}
        ${ganador ? `<div class="grande-txt neon">¡Ronda para ${h(RT.equipo(v, ganador)?.nombre)}!</div>` : '<div class="sub latido">¡El primero en escribirlo bien en el celular gana la ronda!</div>'}
        <div class="marcador">${Object.entries(j.ganados).map(([id, n]) => `<div>${avatar(RT.equipo(v, id)?.personaje, 64)} <b>${n}</b></div>`).join('<span class="vs" style="color:var(--rojo)">–</span>')}</div>
        ${j.esperandoModerador ? '<div class="aviso">⏳ El moderador está revisando una respuesta</div>' : ''}`;
    }
    const it0 = j.items[0];
    if (it0 && it0.pistas) {
      return `<div class="emoji" style="font-size:120px">🔒</div><div class="items-lista">${it0.pistas.map((pi, i) => `<div>${i + 1}. ${h(pi)}</div>`).join('')}</div><div class="sub">Junten los números en orden y escriban la clave en el celular${j.intentos ? ` · ${j.intentos} intentos` : ''}</div>`;
    }
    const iconos = { correcta: '✅', fallida: '❌', saltada: '⏭️', dudosa: '⏳', pendiente: '✏️' };
    const actual = j.estados.indexOf('pendiente');
    return `${actual >= 0 ? `<div class="${j.numero ? 'operacion' : 'grande-txt'}" style="${j.numero ? '' : 'font-size:90px;letter-spacing:8px'}">${h(j.items[actual].texto)}</div>` : ''}
      <div class="items-lista" style="max-width:700px">${j.items.map((it, i) => `<div class="${j.estados[i] === 'correcta' ? 'ok' : j.estados[i] === 'fallida' ? 'mal' : ''}">${iconos[j.estados[i]]} ${h(it.texto)}</div>`).join('')}</div>
      <div class="sub">Necesitan ${j.minimo} de ${j.items.length}</div>`;
  }

  function vistaSecuencia(v, j, p) {
    switch (j.tipo) {
      case 'letras':
        if (j.estado === 'listo') return `<div class="grande-txt">Prepárense para buscar…</div><div class="sub">5 letras: un objeto del salón por cada letra</div>`;
        return `<div class="letras-grandes">${j.items.map((l, i) => `<span class="rebote" style="animation-delay:${i * 0.15}s">${h(l)}</span>`).join('')}</div><div class="sub">¡Traigan un objeto que empiece por cada letra!</div>`;
      case 'texto':
        if (j.estado === 'listo') return `<div class="emoji" style="font-size:120px">📸</div><div class="grande-txt">Memoricen la pose</div><div class="sub">Aparece ${j.duracion} segundos</div>`;
        if (j.estado === 'mostrando' || j.estado === 'revelado') return `<div class="emoji" style="font-size:120px">📸</div><div class="orden-simon">${h(p.texto || '')}</div>${j.estado === 'mostrando' ? cuentaAtras(j.finVer) : ''}`;
        return `<div class="grande-txt neon">¡Ahora imítenla con sus cuerpos!</div>`;
      case 'poses': {
        const n = (j.paso || 0) + 1;
        if (j.estado === 'listo') return `<div class="emoji" style="font-size:120px">📸</div><div class="grande-txt">Memoricen la pose</div><div class="sub">Son ${j.total} poses. Cada una aparece ${j.duracion} segundos cuando el moderador dé la señal</div>`;
        if (j.estado === 'mostrando' || j.estado === 'revelado') return `<div class="sub">Pose ${n} de ${j.total}</div><img class="foto-pose" src="/${h(p.imagen || '')}" alt="">${j.estado === 'mostrando' ? cuentaAtras(j.finVer) : ''}`;
        return `<div class="sub">Pose ${n} de ${j.total}</div><div class="emoji" style="font-size:120px">🕺</div><div class="grande-txt neon">¡Ahora imítenla con sus cuerpos!</div>`;
      }
      case 'simon':
      case 'acciones': {
        if (j.estado === 'listo') return j.tipo === 'simon'
          ? `<div class="emoji" style="font-size:120px">🗣️</div><div class="grande-txt">¡Atentos!</div><div class="sub">Solo hagan las órdenes que empiecen con <b style="color:var(--amarillo)">"SIMÓN DICE"</b></div>`
          : `<div class="emoji" style="font-size:120px">🕺</div><div class="grande-txt">Memoricen ${j.items.length} acciones</div><div class="sub">Aparecen una sola vez, una tras otra</div>`;
        if (j.estado === 'terminado') return `<div class="grande-txt neon">${j.tipo === 'simon' ? '¡Terminó!' : '¡Ahora háganlas todas en orden!'}</div>`;
        if (j.estado === 'revelado') return `<div class="items-lista" style="max-width:800px">${j.items.map((x, i) => `<div>${i + 1}. ${h(x)}</div>`).join('')}</div>`;
        const it = j.items[Math.min(j.paso || 0, j.items.length - 1)];
        const txt = j.tipo === 'simon' && it.startsWith('Simón dice')
          ? `<span style="color:var(--amarillo)">SIMÓN DICE</span><br>${h(it.slice(11))}` : h(it);
        return `<div class="sub">${(j.paso || 0) + 1} de ${j.items.length}</div><div class="orden-simon pop" style="font-size:110px" data-k="${j.paso}">${txt}</div>`;
      }
      case 'escena':
        if (j.estado === 'listo') return `<div class="emoji" style="font-size:120px">🖼️</div><div class="grande-txt">Memoricen la escena</div><div class="sub">Aparece ${j.duracion} segundos</div>`;
        if (j.estado === 'mostrando' || j.estado === 'revelado') return `<div class="escena-caja">${(p.escena || []).map((e) => `<span class="emoji" style="left:${e.x}%;top:${e.y}%">${e.emoji}</span>`).join('')}</div>${j.estado === 'mostrando' ? cuentaAtras(j.finVer) : ''}`;
        return `<div class="grande-txt neon">¡A dibujar de memoria!</div><div class="sub">Cada integrante dibuja al menos un elemento</div>`;
      case 'que_falta':
        if (j.estado === 'listo') return `<div class="emoji" style="font-size:120px">👀</div><div class="grande-txt">Memoricen 10 objetos</div><div class="sub">Luego desaparece uno</div>`;
        if (j.estado === 'mostrando') return `${gridObjetos(p.items || [])}${cuentaAtras(j.finVer)}`;
        return `${gridObjetos(p.items || [])}<div class="grande-txt neon latido">¿Qué objeto falta? Respondan en el celular</div>`;
      default: return '';
    }
  }

  function gridObjetos(items) {
    return `<div class="grid-emojis chico" style="grid-template-columns:repeat(5,1fr)">${items.map((x) => (x ? `<span title="${h(x.nombre)}">${x.emoji}</span>` : '<span class="vacio">?</span>')).join('')}</div>`;
  }
  function gridEmojis(items, cols, claseVacio = 'dorso', marcadas = []) {
    return `<div class="grid-emojis ${cols > 3 ? 'chico' : ''}" style="grid-template-columns:repeat(${cols},1fr)">${items.map((x, i) => {
      if (x === null || x === undefined) return `<span class="${claseVacio}">${claseVacio === 'dorso' ? '?' : ''}</span>`;
      if (x === '?') return `<span class="vacio">?</span>`;
      return `<span style="${marcadas.includes(i) ? 'box-shadow:0 0 0 5px var(--verde),0 7px 0 #1f9a55' : ''}">${x}</span>`;
    }).join('')}</div>`;
  }
  function mascara(m) {
    return `<div class="mascara">${String(m).split(' ').map((w) => `<div class="palabra">${[...w].map((ch) => `<span>${ch === '_' ? '' : h(ch)}</span>`).join('')}</div>`).join('')}</div>`;
  }
  function rompe(img, perm) {
    return `<div class="rompe">${perm.map((pz) => `<div style="background-image:url('/${h(img)}');background-position:${(pz % 3) * 50}% ${Math.floor(pz / 3) * 50}%"></div>`).join('')}</div>`;
  }
  function vistaSopa(j) {
    const marcadas = new Set();
    (j.encontradas || []).forEach((e) => {
      const [r0, c0] = e.a, [r1, c1] = e.b;
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
      const n = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
      for (let i = 0; i <= n; i++) marcadas.add(`${r0 + dr * i},${c0 + dc * i}`);
    });
    const encontradas = (j.encontradas || []).map((e) => e.palabra);
    return `<div class="sopa-wrap" style="display:flex;gap:40px;align-items:center">
      <div class="sopa" style="grid-template-columns:repeat(${j.grid.length},1fr)">${j.grid.map((fila, r) => [...fila].map((ch, c) => `<span class="${marcadas.has(`${r},${c}`) ? 'ok' : ''}">${ch}</span>`).join('')).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:16px;align-items:center;max-width:420px"><div class="lista-palabras">${j.palabras.map((w) => `<span class="${encontradas.includes(w) ? 'ok' : ''}">${h(w)}</span>`).join('')}</div><div class="cuenta">${encontradas.length} de ${j.palabras.length} · necesitan ${j.minimo}</div></div>
    </div>`;
  }

  // Pantalla de resultado: título grande, equipos involucrados con lo que les pasó,
  // explicación, respuesta correcta (si aplica) y quién sigue.
  function zonaResultado(v) {
    const t = v.turno;
    const r = t.resultado;
    const c = t.carta;
    const j = t.juego || {};
    const ti = TIPOS[c.tipo] || TIPOS.Reto;
    const eq = (id) => RT.equipo(v, id);
    const esDuelo = !!t.duelo;
    const auto = c.modo === 'automatica' || c.modo === 'eleccion';

    // Título
    let titulo, cls = r.tipo;
    if (auto) { titulo = `${ti.icono} ${c.nombre}`; cls = c.tipo === 'Bonus' ? 'gano' : c.tipo === 'Penitencia' ? 'perdio' : 'neutral'; }
    else if (c.modo === 'especial' && r.gana.length) { titulo = `¡GANÓ ${eq(r.gana[0])?.nombre}!`; cls = 'gano'; }
    else if (esDuelo && r.gana.length) { titulo = `¡GANÓ ${eq(r.gana[0])?.nombre}!`; cls = 'gano'; }
    else if (esDuelo) { titulo = 'EMPATE'; cls = 'neutral'; }
    else if (c.tipo === 'Penitencia') { titulo = r.pierde.length ? 'NO LA CUMPLIERON' : r.gana.length ? '¡CUMPLIDA!' : 'SE QUEDAN'; }
    else if (c.tipo === 'Reto final' && r.tipo === 'gano') titulo = '¡AL TROFEO!';
    else titulo = r.tipo === 'gano' ? '¡GANARON!' : r.tipo === 'perdio' ? '¡PERDIERON!' : 'SE QUEDAN';

    // Equipos involucrados y lo que les pasó
    const detalles = [...(r.detalles || [])];
    const movDe = (q) => {
      const i = detalles.findIndex((d) => d.includes(q.nombre));
      if (i < 0) return null;
      const d = detalles.splice(i, 1)[0];
      return d.includes('escudo') ? `<span class="res-mov escudo">🛡️ El escudo los salvó</span>` : `<span class="res-mov atras">⬅️ Retroceden 1</span>`;
    };
    let ids = esDuelo ? t.duelo : [t.equipoId];
    if (c.modo === 'especial' && r.gana.length) ids = r.gana;
    let equipos = '';
    if (!auto) {
      equipos = `<div class="res-equipos">${ids.map((id) => {
        const q = eq(id);
        if (!q) return '';
        const gana = r.gana.includes(id);
        const pierde = r.pierde.includes(id);
        let mov = movDe(q);
        if (!mov && gana && c.modo === 'especial') mov = '<span class="res-mov ok">🎁 ¡Ganan un bonus!</span>';
        if (!mov && gana) mov = c.tipo === 'Reto final' && !esDuelo ? '<span class="res-mov ok">🏆 ¡Llegan al trofeo!</span>' : '<span class="res-mov ok">✅ Se quedan</span>';
        if (!mov && pierde && c.tipo === 'Reto final') mov = '<span class="res-mov">🔁 Lo intentan en su próximo turno</span>';
        if (!mov && !gana && !pierde) mov = '<span class="res-mov">➖ Se quedan</span>';
        return `<div class="res-eq ${gana ? 'gana' : ''} ${pierde ? 'pierde' : ''} rebote">${gana ? '<span class="corona emoji">👑</span>' : ''}${avatar(q.personaje, 170)}<div class="n">${h(q.nombre)}</div>${mov || ''}</div>`;
      }).join('')}</div>`;
    }

    // Texto explicativo (sin repetir el título)
    const texto = !r.generico && r.texto ? `<div class="res-texto">${h(r.texto)}</div>` : '';
    const extra = detalles.length ? `<div class="avisos" style="justify-content:center">${detalles.map((d) => `<span class="res-mov">${h(d)}</span>`).join('')}</div>` : '';

    // Respuesta correcta
    let sol = '';
    if (j.solucion) {
      let items = [];
      if (c.modo === 'opcion_multiple' || (c.modo === 'secuencia_pantalla' && j.tipo === 'que_falta')) {
        items = j.solucion.map((s) => `${h(s.respuesta)}${s.explicacion ? ` <small>(${h(s.explicacion)})</small>` : ''}`);
      } else if (c.modo === 'mosaico') {
        sol = `<div class="res-sol panel"><h4>Así era el mosaico</h4>${gridEmojis(j.solucion, 3).replace('grid-emojis', 'grid-emojis chico')}</div>`;
      } else if (Array.isArray(j.solucion) && typeof j.solucion[0] === 'string') {
        items = j.solucion.map((s, i) => (c.modo === 'ordenar' ? `${i + 1}. ${h(s)}` : h(s)));
      } else if (typeof j.solucion === 'string') {
        items = [`${h(j.solucion)}${j.cita ? ` <small>${h(j.cita)}</small>` : ''}`];
      }
      if (items.length) sol = `<div class="res-sol panel"><h4>${items.length > 1 ? 'Respuestas correctas' : 'Respuesta correcta'}</h4><div class="lista">${items.map((x) => `<span>${x}</span>`).join('')}</div></div>`;
    }

    const sig = siguienteEquipo(v);
    const llego = v.equipos.some((q) => q.llego);
    return `
      <div class="arcade res-titulo ${cls} rebote">${h(titulo)}</div>
      ${equipos}
      ${texto}
      ${extra}
      ${sol}
      ${sig && !llego ? `<div class="res-sig">Siguiente turno ▶ ${avatar(sig.personaje, 66)} ${h(sig.nombre)}</div>` : ''}`;
  }

  // ---------- Dado y banners sobre el tablero ----------
  // El dado y los avisos del turno aparecen en el centro, sobre el trofeo, para no tapar casillas
  function renderDadoCapa(v) {
    const t = v.turno;
    let html = '';
    if (v.fase === 'juego' && t) {
      const q = RT.equipo(v, t.equipoId);
      const tira = RT.equipo(v, t.tiraEquipoId);
      const cab = `<div class="cp-eq">${avatar(q.personaje, 64)}<span>${h(q.nombre)}</span></div>`;
      if (t.etapa === 'dado') {
        // Arriba ya dice "¡Tiren el dado!"; solo se avisa aquí si otro equipo tira por ellos
        if (t.tiraEquipoId !== t.equipoId) html = `<div class="centro-pop">${cab}<div class="cp-txt">Dado ajeno</div><div class="cp-sub">Tira ${h(tira.nombre)}</div></div>`;
      } else if (t.etapa === 'eleccion_dado') {
        html = `<div class="centro-pop">${cab}<div style="display:flex;gap:16px">${t.dados.map((n) => dado(n, 'rebote')).join('')}</div><div class="cp-txt">Doble dado: eligen</div></div>`;
      } else if (t.etapa === 'casilla') {
        const ti = TIPOS[t.casillaTipo] || TIPOS.Reto;
        html = `<div class="centro-pop" data-n="${t.n}">${cab}${t.dado ? dado(t.dado, 'rebote') : ''}<div class="cp-txt">${t.dado ? `¡Avanzan ${t.dado}!` : 'Reto final'}</div><div class="cp-tipo" style="--c:${ti.color};color:${ti.oscuro ? '#3a2600' : '#fff'}">${RT.svgIcono(ti.svg, 26, 2.6)} ${h(t.casillaTipo)}</div></div>`;
      } else if (t.etapa === 'resultado' && !t.carta) {
        const sig = siguienteEquipo(v);
        html = `<div class="centro-pop">${cab}<div style="color:#cbd5e1">${RT.svgIcono('vacia', 70, 2.4)}</div><div class="cp-txt">¡Descansan!</div>${sig ? `<div class="cp-sub">Sigue ${h(sig.nombre)}</div>` : ''}</div>`;
      }
    }
    pintar($('#dado-capa'), html);
  }

  // ---------- Render principal ----------
  function render() {
    const v = V;
    if (!v || !D) return;
    renderBarra(v);
    renderEquipos(v);
    renderFichas(v);
    renderDadoCapa(v);
    document.querySelectorAll('.casilla.activa').forEach((e) => e.classList.remove('activa'));
    if (v.fase === 'juego' && v.turno && v.turno.hasta) {
      const q = RT.equipo(v, v.turno.equipoId);
      const el = document.querySelector(`.casilla[data-k="${CSS.escape(q.camino + ':' + v.turno.hasta)}"]`);
      if (el && v.turno.etapa !== 'dado') el.classList.add('activa');
    }
    let capa = '';
    if (v.fase === 'lobby') capa = capaLobby(v);
    else if (v.fase === 'instructivo') capa = capaInstructivo(v);
    else if (v.fase === 'quien_empieza') capa = capaInicio(v);
    else if (v.fase === 'eleccion_camino') capa = capaCaminos(v);
    else if (v.fase === 'juego') capa = capaJuego(v);
    else if (v.fase === 'final') capa = capaFinal(v);
    // /pantalla?tablero muestra solo el tablero (para revisarlo antes de jugar)
    if (SOLO_TABLERO && v.fase !== 'juego') capa = '';
    pintar($('#capa'), capa);
    if (v.fase === 'juego' && v.turno && v.turno.carta && (v.turno.etapa === 'carta' || v.turno.etapa === 'resultado')) {
      const t = v.turno;
      const conReloj = t.etapa === 'carta' && v.temporizador && v.temporizador.totalMs > 0;
      pintar($('#m-quienes'), quienes(v));
      pintar($('#m-reloj'), conReloj ? '<div class="reloj-grande" data-reloj="grande">--</div>' : '');
      pintar($('#m-carta'), `<div class="voltear-in" data-n="${t.n}-${t.carta.id}">${htmlCarta(t.carta, { clase: claseLargo(t.carta) })}</div>`);
      pintar($('#m-der'), t.etapa === 'carta' ? zonaCarta(v) : `<div class="res">${zonaResultado(v)}</div>`);
    }
    efectos(v);
    tick();
  }

  // Sonidos y celebraciones según lo que cambió
  function efectos(v) {
    const t = v.turno;
    if (v.fase === 'final' && prev.fase !== 'final') { RT.sonidos.fanfarria(); RT.confeti(8000); }
    if (t) {
      if (t.n !== prev.n || t.etapa !== prev.etapa) {
        if (t.etapa === 'casilla') RT.sonidos.dado();
        if (t.etapa === 'carta' && prev.etapa !== 'carta') RT.sonidos.carta();
        if (t.etapa === 'resultado' && t.resultado && t.carta) {
          const r = t.resultado;
          if (r.tipo === 'gano' || (t.carta.tipo === 'Duelo' && r.gana.length)) RT.sonidos.bien();
          else if (r.tipo === 'perdio') RT.sonidos.mal();
          if (t.carta.tipo === 'Reto final' && r.tipo === 'gano') RT.confeti(4000);
        }
      }
      prev.n = t.n; prev.etapa = t.etapa;
    }
    prev.fase = v.fase;
  }

  // Relojes y cuentas regresivas
  let ultimoSeg = null;
  function tick() {
    if (!V) return;
    const tm = V.temporizador;
    const ms = RT.restanteMs(tm);
    document.querySelectorAll('[data-reloj]').forEach((el) => {
      el.textContent = RT.fmtTiempo(ms);
      el.classList.toggle('alerta', tm.corriendo && ms <= 10000 && ms > 0);
      el.classList.toggle('cero', ms <= 0 && tm.totalMs > 0);
      el.classList.toggle('pausa', !tm.corriendo);
    });
    const seg = Math.ceil(ms / 1000);
    if (tm.corriendo && seg <= 5 && seg > 0 && seg !== ultimoSeg) RT.sonidos.tic();
    ultimoSeg = seg;
    document.querySelectorAll('[data-fin]').forEach((el) => {
      const r = Math.max(0, Number(el.dataset.fin) - RT.ahora());
      el.textContent = `⏳ ${Math.ceil(r / 1000)} s`;
    });
  }
  setInterval(tick, 200);

  socket.on('estado', (v) => { V = v; render(); });
  socket.on('timbre', () => { RT.sonidos.timbre(); RT.toast('⏰ ¡TIEMPO!'); });

  async function cargarInfo() {
    try { INFO = await (await fetch('/api/info')).json(); } catch (e) { setTimeout(cargarInfo, 3000); }
    render();
  }
  fetch('/api/datos').then((r) => r.json()).then((d) => { D = d; construirTablero(); render(); });
  cargarInfo();
  // El código cambia con cada partida nueva: refrescar el QR
  setInterval(() => { if (V && INFO && V.codigo !== INFO.codigo) cargarInfo(); }, 2000);
})();
