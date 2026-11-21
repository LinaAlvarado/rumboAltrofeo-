/* Rumbo al Trofeo — utilidades compartidas por las 3 vistas */
(function () {
  // Íconos de línea (estilo Lucide, 24x24) para el tablero y la guía
  const SVG = {
    reto: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    duelo: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
    penitencia: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    bonus: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    sorpresa: '<path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    vacia: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    final: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    destreza: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    mente: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    creativo: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.7-1.7h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z"/><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>',
    musica: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    equipo: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    random: '<rect width="12" height="12" x="2" y="10" rx="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01"/><path d="M10 14h.01"/><path d="M15 6h.01"/><path d="M18 9h.01"/>',
  };
  const svgIcono = (nombre, tam = 24, grosor = 2.4) => `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round">${SVG[nombre] || ''}</svg>`;
  const TIPOS = {
    'Reto': { color: '#2f6bf0', icono: '⚡', svg: 'reto' },
    'Duelo': { color: '#e8343f', icono: '⚔️', svg: 'duelo' },
    'Penitencia': { color: '#d9521c', icono: '😬', svg: 'penitencia' },
    'Bonus': { color: '#1e9a4a', icono: '🎁', svg: 'bonus' },
    'Sorpresa': { color: '#f5c518', icono: '❓', svg: 'sorpresa', oscuro: true },
    'Vacía': { color: '#4a5468', icono: '💤', svg: 'vacia' },
    'Reto final': { color: '#f39c12', icono: '🏆', svg: 'final' },
  };
  const CAMINOS = {
    'Destreza': { color: '#ff9f1c', icono: '🤸', svg: 'destreza' },
    'Mente': { color: '#2ee6ff', icono: '🧠', svg: 'mente' },
    'Creativo': { color: '#ff4fd8', icono: '🎨', svg: 'creativo' },
    'Música': { color: '#b07bff', icono: '🎵', svg: 'musica' },
    'Equipo': { color: '#3ddc84', icono: '🤝', svg: 'equipo' },
  };
  // Casilla redonda: color del tipo, borde del color del camino, número opcional
  function casillaHTML(tipo, { tam = 78, num = null, borde = null, clase = '', extra = '' } = {}) {
    const t = TIPOS[tipo] || TIPOS.Reto;
    return `<div class="casilla ${tipo === 'Reto final' ? 'final' : ''} ${tipo === 'Vacía' ? 'vacia' : ''} ${clase}" ${extra} style="--c:${t.color};--cam:${borde || 'rgba(255,255,255,.85)'};width:${tam}px;height:${tam}px;color:${t.oscuro ? '#3a2600' : '#fff'}">${num !== null ? `<span class="num">${num}</span>` : ''}${svgIcono(t.svg, Math.round(tam * 0.5), 2.6)}</div>`;
  }
  const ICONOS_OP = ['▲', '◆', '●', '■'];

  const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Conexión ----------
  let offset = 0;
  function conectar(auth) {
    const socket = io({ auth, transports: ['websocket', 'polling'] });
    const marca = document.getElementById('conexion') || (() => {
      const d = document.createElement('div'); d.id = 'conexion'; d.textContent = 'Reconectando…'; document.body.appendChild(d); return d;
    })();
    socket.on('connect', () => {
      marca.classList.remove('on');
      const t0 = Date.now();
      socket.emit('hora', null, (srv) => { const t1 = Date.now(); offset = srv - (t0 + t1) / 2; });
    });
    socket.on('disconnect', () => marca.classList.add('on'));
    socket.on('connect_error', () => marca.classList.add('on'));
    socket.on('aviso', (m) => toast(m));
    return socket;
  }
  const ahora = () => Date.now() + offset;

  function restanteMs(tm) {
    if (!tm) return 0;
    if (tm.corriendo && tm.finEn) return Math.max(0, tm.finEn - ahora());
    return tm.restanteMs || 0;
  }
  function fmtTiempo(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : String(s);
  }

  // Pinta HTML solo si cambió (evita repetir animaciones y perder lo escrito)
  function pintar(el, html) {
    if (!el) return false;
    if (el.__html === html) return false;
    const guardados = {};
    let foco = null, sel = null;
    el.querySelectorAll('input[id], textarea[id]').forEach((i) => { guardados[i.id] = i.value; });
    if (document.activeElement && el.contains(document.activeElement) && document.activeElement.id) {
      foco = document.activeElement.id;
      try { sel = [document.activeElement.selectionStart, document.activeElement.selectionEnd]; } catch (e) { sel = null; }
    }
    el.innerHTML = html;
    el.__html = html;
    for (const [id, val] of Object.entries(guardados)) {
      const i = el.querySelector('#' + CSS.escape(id));
      if (i && i.dataset.limpiar !== '1') i.value = val;
    }
    if (foco) {
      const i = el.querySelector('#' + CSS.escape(foco));
      if (i) { i.focus(); if (sel) try { i.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    }
    return true;
  }

  // ---------- Piezas visuales ----------
  function avatar(archivo, tam = 64, extra = '') {
    if (!archivo) return '';
    return `<img class="avatar ${extra}" src="/personajes/${h(archivo)}" width="${tam}" height="${tam}" alt="">`;
  }

  const PUNTOS = { 1: [5], 2: [3, 7], 3: [3, 5, 7] };
  function dado(n, clase = '') {
    const p = PUNTOS[n] || [];
    let html = '';
    for (let i = 1; i <= 9; i++) html += p.includes(i) ? '<i></i>' : '<span></span>';
    return `<div class="dado ${clase}">${html}</div>`;
  }

  function htmlCarta(c, opts = {}) {
    if (!c) return '';
    const tipo = TIPOS[c.tipo] || TIPOS.Reto;
    const camino = CAMINOS[c.camino];
    const pie = [];
    if (c.tiempo) pie.push(`⏱️ ${c.tiempo} s`);
    if (c.material) pie.push(`🧰 ${h(c.material)}`);
    if (c.seJuegaEn) pie.push(`📍 ${h(c.seJuegaEn)}`);
    return `<div class="carta ${opts.clase || ''}" style="--c:${tipo.color}">
      <div class="cab">
        <span class="etiqueta" style="--c:${tipo.color}"><span class="emoji">${tipo.icono}</span> ${h(c.tipo).toUpperCase()}</span>
        ${camino ? `<span class="etiqueta" style="--c:${camino.color};color:#1a0b3b">${svgIcono(camino.svg, 18, 2.6)} ${h(c.camino)}</span>` : (c.camino === 'Todos' ? '' : '')}
      </div>
      <div class="nombre">${h(c.nombre)}</div>
      ${opts.sinInstrucciones ? '' : `<div class="instr">${h(c.instrucciones)}</div>`}
      ${c.comoSeGana ? `<div class="gana"><b>Cómo se gana:</b> ${h(c.comoSeGana)}</div>` : ''}
      ${pie.length && !opts.sinPie ? `<div class="pie">${pie.map((p) => `<span>${p}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  // Muñeco del ahorcado (SVG) con "errores" partes dibujadas de "max"
  function ahorcadoSVG(errores, max, color = '#fff') {
    const partes = [
      '<circle cx="150" cy="70" r="22"/>',
      '<line x1="150" y1="92" x2="150" y2="160"/>',
      '<line x1="150" y1="110" x2="120" y2="140"/>',
      '<line x1="150" y1="110" x2="180" y2="140"/>',
      '<line x1="150" y1="160" x2="125" y2="200"/>',
      '<line x1="150" y1="160" x2="175" y2="200"/>',
      '<line x1="138" y1="64" x2="146" y2="72"/><line x1="146" y1="64" x2="138" y2="72"/><line x1="154" y1="64" x2="162" y2="72"/><line x1="162" y1="64" x2="154" y2="72"/>',
      '<path d="M140 82 q10 -8 20 0" fill="none"/>',
    ];
    // Si el máximo es 6, las 6 partes del cuerpo; si es 8, se agregan ojos y boca
    const visibles = partes.slice(0, Math.min(errores, max)).join('');
    return `<svg viewBox="0 0 220 230" stroke="${color}" stroke-width="8" stroke-linecap="round" fill="none">
      <line x1="20" y1="220" x2="110" y2="220" stroke="#8f7bd1"/>
      <line x1="60" y1="220" x2="60" y2="20" stroke="#8f7bd1"/>
      <line x1="56" y1="20" x2="154" y2="20" stroke="#8f7bd1"/>
      <line x1="150" y1="20" x2="150" y2="48" stroke="#8f7bd1"/>
      <g stroke="${color}">${visibles}</g>
    </svg>`;
  }

  // ---------- Sonidos (Web Audio, sin archivos) ----------
  let audio = null;
  function activarAudio() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (audio && audio.state === 'suspended') audio.resume();
  }
  function tono(frec, dur = 0.15, tipo = 'square', vol = 0.15, cuando = 0) {
    if (!audio) return;
    const t = audio.currentTime + cuando;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = tipo; o.frequency.setValueAtTime(frec, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const sonidos = {
    timbre() { [0, .25, .5].forEach((d) => { tono(880, .2, 'square', .25, d); tono(660, .2, 'square', .2, d + .1); }); tono(440, .8, 'sawtooth', .2, .8); },
    dado() { for (let i = 0; i < 6; i++) tono(300 + Math.random() * 400, .05, 'triangle', .12, i * .06); },
    carta() { tono(520, .08, 'triangle', .15); tono(780, .12, 'triangle', .15, .08); },
    bien() { [523, 659, 784, 1046].forEach((f, i) => tono(f, .15, 'square', .14, i * .1)); },
    mal() { tono(300, .2, 'sawtooth', .15); tono(200, .35, 'sawtooth', .15, .18); },
    paso() { tono(660, .06, 'square', .08); },
    fanfarria() { [523, 523, 523, 659, 784, 659, 784, 1046].forEach((f, i) => tono(f, .22, 'square', .16, i * .16)); },
    tic() { tono(1200, .03, 'square', .06); },
  };

  // ---------- Confeti ----------
  function confeti(duracion = 5000) {
    const c = document.createElement('canvas');
    c.className = 'confeti';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const W = (c.width = innerWidth), H = (c.height = innerHeight);
    const colores = ['#ff3fd8', '#2ee6ff', '#ffd23f', '#3ddc84', '#ff9f1c', '#8b5cf6', '#fff'];
    const ps = Array.from({ length: 220 }, () => ({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.6, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4,
      r: 6 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: colores[Math.floor(Math.random() * colores.length)],
    }));
    const t0 = performance.now();
    (function cuadro(t) {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.vy += 0.03;
        if (p.y > H + 20 && t - t0 < duracion - 1500) { p.y = -20; p.vy = 2 + Math.random() * 3; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      }
      if (t - t0 < duracion) requestAnimationFrame(cuadro); else c.remove();
    })(t0);
  }

  function toast(msg, ms = 3500) {
    let cont = document.getElementById('toast');
    if (!cont) { cont = document.createElement('div'); cont.id = 'toast'; document.body.appendChild(cont); }
    const d = document.createElement('div');
    d.textContent = msg;
    cont.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  const equipo = (v, id) => (v.equipos || []).find((q) => q.id === id);

  window.RT = { TIPOS, CAMINOS, svgIcono, casillaHTML, ICONOS_OP, h, conectar, ahora, restanteMs, fmtTiempo, pintar, avatar, dado, htmlCarta, ahorcadoSVG, activarAudio, sonidos, confeti, toast, equipo };
})();
