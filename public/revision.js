/* Rumbo al Trofeo — página de revisión: todo el contenido y lo que falta */
(function () {
  const { TIPOS, CAMINOS, svgIcono, h } = window.RT;
  const $ = (s) => document.querySelector(s);
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let D = null;
  const filtro = { texto: '', camino: 'todos', estado: 'todas', tipo: 'todos' };

  const ORDEN = ['Destreza', 'Mente', 'Creativo', 'Música', 'Equipo', 'Todos'];
  const NOMBRE_GRUPO = { Todos: 'Mazo común (penitencias, bonus y sorpresas)' };
  const CAMINO_TODOS = { color: '#6d5fa3', svg: 'random' };

  const MODOS = {
    presencial: 'Presencial: la dirige el moderador',
    palabra_secreta: 'Palabra secreta en el celular',
    opcion_multiple: 'Preguntas con opciones en el celular',
    escribir: 'Escriben la respuesta en el celular',
    ordenar: 'Ordenar en el celular',
    secuencia_pantalla: 'Se muestra en la pantalla',
    especial: 'Especial: el moderador elige el ganador',
    sopa_letras: 'Sopa de letras en el celular',
    ahorcado: 'Ahorcado en el celular',
    rompecabezas: 'Rompecabezas en el celular',
    mosaico: 'Mosaico de memoria (pantalla y celular)',
    concentrese: 'Concéntrese (pantalla y celular)',
    automatica: 'Automática: la app aplica el efecto',
    eleccion: 'El equipo elige en el celular',
  };
  const GENERADORES = {
    operacion: 'Las operaciones se generan solas al azar (resultados entre 5 y 50). No necesita contenido.',
    banderas: 'Usa la lista de banderas.',
    artista: 'Usa el banco de canciones. Las opciones falsas son otros artistas de la misma playlist.',
    emojis_cancion: 'Usa los emojis de cada canción del banco de canciones.',
    nombre_cancion: 'Usa los nombres del banco de canciones (el moderador pone la intro en el parlante).',
    frases: 'Usa las 4 frases seguidas de cada canción.',
    coro: 'Usa las 8 frases del coro de cada canción.',
  };
  const ORIGEN = {
    excel: 'Sale de tu Excel',
    plan: 'Sale de la lista del plan',
    dibujo: 'Dibujos que hice yo (según el plan)',
    fotos: 'Fotos que pasaste tú',
    claude: 'Lista que armé yo',
  };

  // ---------- Estado de cada carta ----------
  function estadoCarta(c) {
    if (c.faltaContenido) return 'falta';
    const origen = c.banco && D.origenBancos ? D.origenBancos[c.banco] : null;
    if (origen === 'dibujo' || origen === 'claude') return 'revisar';
    return 'lista';
  }
  const ETIQUETA_ESTADO = { falta: 'Falta contenido', revisar: 'Revísalo', lista: 'Lista' };

  // ---------- Materiales ----------
  const PALABRAS_VACIAS = new Set(['por', 'integrante', 'integrantes', 'equipo', 'varias', 'iguales', 'juegos', 'juego', 'menos', 'que', 'una', 'uno', 'dos', 'con', 'tipo', 'especial', 'pegados', 'huecos', 'amarradas', 'impreso', 'impresos', 'impresas', 'recortadas', 'partida', 'cada']);
  function materialesFaltantesEnHoja() {
    const hoja = sinTildes(D.materiales.map((m) => m.material).join(' | '));
    const faltan = {};
    for (const c of D.cartas) {
      if (!c.material) continue;
      for (const parte of c.material.split(/,| y | o /)) {
        const palabras = sinTildes(parte).replace(/\(.*?\)/g, '').split(/[^a-zñ]+/).filter((w) => w.length > 3 && !PALABRAS_VACIAS.has(w));
        for (const w of palabras) {
          const raiz = w.slice(0, Math.max(4, w.length - 2));
          if (!hoja.includes(raiz)) {
            faltan[w] = faltan[w] || { palabra: w, cartas: [] };
            if (!faltan[w].cartas.some((x) => x.id === c.id)) faltan[w].cartas.push(c);
          }
        }
      }
    }
    return Object.values(faltan);
  }
  const HACER_A_MANO = /impres|recortad|pegados|amarrad/i;

  function bloqueMateriales() {
    const extras = materialesFaltantesEnHoja();
    const fila = (clave, nombre, detalle, clase = '', tag = '') => {
      const hecho = leer('rev-mat:' + clave) === '1';
      return `<label class="mat ${hecho ? 'hecho' : ''} ${clase}"><input type="checkbox" data-mat="${h(clave)}" ${hecho ? 'checked' : ''}><span><span class="nom">${h(nombre)}</span>${tag}</span><small>${detalle}</small></label>`;
    };
    const filas = D.materiales.map((m) => fila(m.material, m.material, `${h(m.cantidad || '')}${m.seUsaEn ? ' · ' + h(m.seUsaEn) : ''}`, '', HACER_A_MANO.test(m.material) ? '<span class="tag">hay que hacerlo</span>' : '')).join('');
    const filasExtra = extras.map((x) => fila('extra:' + x.palabra, x.palabra[0].toUpperCase() + x.palabra.slice(1), `No está en la hoja de Materiales. Sale en ${x.cartas.map((c) => `${h(c.id)} ${h(c.nombre)} (“${h(c.material)}”)`).join(', ')}`, 'extra')).join('');
    const total = D.materiales.length + extras.length;
    const hechos = [...D.materiales.map((m) => m.material), ...extras.map((x) => 'extra:' + x.palabra)].filter((k) => leer('rev-mat:' + k) === '1').length;
    return `<section class="bloque borde-material" id="materiales">
      <h2>Materiales por conseguir <span class="marca material" id="mat-cuenta">${hechos} de ${total} listos</span></h2>
      <p class="sub">Marca lo que ya tengas. Se guarda en este navegador.</p>
      ${extras.length ? `<h3 style="font-size:18px;margin:6px 0 8px">Faltan en tu hoja de Materiales</h3><div class="mats" style="margin-bottom:14px">${filasExtra}</div><h3 style="font-size:18px;margin:6px 0 8px">De tu hoja de Materiales</h3>` : ''}
      <div class="mats">${filas}</div>
    </section>`;
  }

  // ---------- Lo que falta ----------
  function bloquesPendientes() {
    const faltan = D.cartas.filter((c) => c.faltaContenido);
    const enlaces = (lista) => `<div class="chips">${lista.map((c) => `<button class="chip link" data-ir="${h(c.id)}">${h(c.id)} · ${h(c.nombre)}</button>`).join('')}</div>`;
    let html = '';

    if (faltan.length) {
      const bancosFaltan = [...new Set(faltan.map((c) => c.banco))];
      const soloCanciones = bancosFaltan.every((b) => String(b).startsWith('canciones'));
      const hayCanciones = (D.bancos.canciones || []).length > 0;
      const titulo = !soloCanciones ? 'Pásame el contenido que falta' : hayCanciones ? 'Faltan las letras de algunas canciones' : 'Pásame las canciones';
      const explicacion = hayCanciones
        ? `<p style="margin:14px 0 4px">Abre <b>Canciones.xlsx</b> (en la carpeta del juego) y, en las canciones que quieras usar, llena:</p>
        <ul style="margin:0 0 8px;padding-left:22px">
          <li><b>4 frases seguidas</b> de la letra, separadas con <b>/</b> (para “Ordena la letra”).</li>
          <li><b>8 frases del coro</b>, separadas con <b>/</b> (para “Ordena el coro completo”).</li>
        </ul>
        <p class="sub" style="margin:0">Con 3 o 4 canciones alcanza. Guarda el archivo, corre <b>npm run datos</b> y recarga esta página.</p>`
        : `<p style="margin:14px 0 4px"><b>Qué necesito por cada canción de la playlist</b> (mínimo 6, ideal 12):</p>
        <div class="tabla-scroll"><table class="formato">
          <tr><th>Nombre</th><th>Artista</th><th>Emojis</th><th>4 frases seguidas</th><th>8 frases del coro</th><th>Otras formas de escribir el nombre</th></tr>
          <tr><td>Obligatorio</td><td>Obligatorio</td><td>Opcional: los propongo yo</td><td>Separadas con /</td><td>Separadas con /</td><td>Opcional, separadas con coma</td></tr>
        </table></div>`;
      html += `<section class="bloque borde-falta" id="pend-canciones">
        <h2>${titulo} <span class="marca falta">${faltan.length} ${faltan.length === 1 ? 'carta esperando' : 'cartas esperando'}</span></h2>
        <p class="sub">Mientras no estén, estas cartas igual se juegan, pero como presencial: el moderador las dirige a mano y la app no valida nada.</p>
        ${enlaces(faltan)}
        ${soloCanciones ? explicacion : `<div class="chips">${bancosFaltan.map((b) => `<span class="chip">Banco ${h(b)}</span>`).join('')}</div>`}
      </section>`;
    }

    if (D.preguntasInicioProvisionales) {
      html += `<section class="bloque borde-falta" id="pend-inicio">
        <h2>Pásame las 3 preguntas de inicio <span class="marca falta">provisionales</span></h2>
        <p class="sub">El plan dice que salen del documento de definiciones. Mientras tanto se usan estas, que puse yo. Si te sirven, dime y las dejo.</p>
        <div class="banco"><ol>${D.preguntasInicio.map((p) => `<li><div class="item-ppal">${h(p.pregunta)}</div><div class="item-sec">${p.opciones.map((o) => `<span class="chip ${o === p.respuesta ? 'ok' : ''}">${o === p.respuesta ? '✓ ' : ''}${h(o)}</span>`).join('')}</div></li>`).join('')}</ol></div>
      </section>`;
    }

    // Contenido que hice yo
    const dibujos = Object.entries(D.origenBancos || {}).filter(([, o]) => o === 'dibujo').flatMap(([k]) => (D.bancos[k] || []).map((it) => ({ ...it, banco: k })));
    const emojis = Object.entries(D.origenBancos || {}).some(([k, o]) => o === 'claude' && k === 'canciones_emojis') ? (D.bancos.canciones_emojis || []) : [];
    const cartasRevisar = D.cartas.filter((c) => estadoCarta(c) === 'revisar');
    if (dibujos.length || emojis.length) {
      html += `<section class="bloque borde-revisar" id="pend-revisar">
        <h2>Revisa lo que agregué yo <span class="marca revisar">dale un vistazo</span></h2>
        <p class="sub">No estaba en tu Excel. Si algo no te gusta, dime qué cambiar.</p>
        ${dibujos.length ? `<p style="margin:0 0 8px"><b>Dibujos</b></p><div class="dibujos">${dibujos.map((d) => `<figure><img src="/${h(d.imagen)}" alt=""><figcaption>${h(d.palabra || d.texto || '')}<br><small style="color:var(--tinta2)">${h(d.banco)}</small></figcaption></figure>`).join('')}</div>` : ''}
        ${emojis.length ? `<p style="margin:14px 0 6px"><b>Emojis de las canciones</b> (para “Emojis en duelo” y “Emojis triple”). Si alguno no te convence, cámbialo en la columna Emojis de Canciones.xlsx.</p><div class="chips">${emojis.map((c) => `<span class="chip"><span style="font-size:18px">${h(c.emojis)}</span> ${h(c.nombre)}</span>`).join('')}</div>` : ''}
        ${cartasRevisar.length ? `<p style="margin:14px 0 6px"><b>Cartas que los usan</b></p>${enlaces(cartasRevisar)}` : ''}
      </section>`;
    }
    return html;
  }

  // ---------- Contenido de un banco ----------
  const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  function itemHTML(it) {
    const ppal = it.contenido || it.palabra || it.frase || it.texto || it.nombre || it.categoria || it.pais || it.letra || '';
    const emo = it.emoji || (it.emojis ? lista(it.emojis).join(' ') : '');
    let sec = '';
    if (it.opciones && it.opciones.length) {
      sec += lista(it.opciones).map((o) => `<span class="chip ${o === it.respuesta ? 'ok' : ''}">${o === it.respuesta ? '✓ ' : ''}${h(o)}</span>`).join('');
    } else if (it.respuesta !== undefined && it.respuesta !== null) {
      sec += `<span class="chip ok">✓ ${h(it.respuesta)}</span>`;
    }
    if (it.respuestas) sec += `<span>Faltan:</span>${lista(it.respuestas).map((r) => `<span class="chip ok">✓ ${h(r)}</span>`).join('')}`;
    if (it.bancoPalabras) sec += `<span>Para elegir:</span>${lista(it.bancoPalabras).map((r) => `<span class="chip">${h(r)}</span>`).join('')}`;
    if (it.palabras) sec += lista(it.palabras).map((p) => `<span class="chip">${h(p)}</span>`).join('');
    if (it.orden) sec += lista(it.orden).map((p, i) => `<span class="chip">${i + 1}. ${h(p)}</span>`).join('');
    if (it.numeros) sec += `<span>Números:</span>${lista(it.numeros).map((p) => `<span class="chip">${h(p)}</span>`).join('')}`;
    if (it.prohibidas) sec += `<span>Prohibidas:</span>${lista(it.prohibidas).map((p) => `<span class="chip trampa">${h(p)}</span>`).join('')}`;
    if (it.aceptadas && lista(it.aceptadas).length) sec += `<span>También vale:</span>${lista(it.aceptadas).map((p) => `<span class="chip">${h(p)}</span>`).join('')}`;
    if (it.trampa) sec += '<span class="chip trampa">Trampa: no dice “Simón dice”</span>';
    if (it.explicacion) sec += `<span>(${h(it.explicacion)})</span>`;
    if (it.nota) sec += `<span>${h(it.nota)}</span>`;
    if (it.artista) sec += `<span>${h(it.artista)}</span>`;
    if (it.frases && it.frases.length) sec += `<span>Frases:</span>${it.frases.map((p) => `<span class="chip">${h(p)}</span>`).join('')}`;
    if (it.coro && it.coro.length) sec += `<span>Coro:</span>${it.coro.map((p) => `<span class="chip">${h(p)}</span>`).join('')}`;
    if (it.cita) sec += `<span>📖 ${h(it.cita)}</span>`;
    const pistas = it.pistas ? `<ol style="margin:4px 0 0;padding-left:20px;display:block">${it.pistas.map((p) => `<li>${h(p)}</li>`).join('')}</ol>` : '';
    return `<li><div class="item-ppal">${emo ? `<span class="emo">${h(emo)}</span>` : ''}${h(ppal)}</div>${pistas}${it.imagen ? `<img class="item-img" src="/${h(it.imagen)}" alt="">` : ''}${sec ? `<div class="item-sec">${sec}</div>` : ''}</li>`;
  }

  function bancoHTML(c) {
    let html = '';
    if (c.generador && GENERADORES[c.generador]) html += `<div class="aviso info">${GENERADORES[c.generador]}</div>`;
    if (!c.banco) return html;
    const items = D.bancos[c.banco] || [];
    if (!items.length) return html;
    const otras = D.cartas.filter((o) => o.banco === c.banco && o.id !== c.id);
    const porJugada = c.cantidad ? ` · usa ${c.cantidad} por jugada` : '';
    const origen = D.origenBancos && D.origenBancos[c.banco] ? ORIGEN[D.origenBancos[c.banco]] : '';
    html += `<div class="banco"><h4>Contenido (${items.length}${porJugada})${origen ? ' · ' + origen : ''}${otras.length ? ` · lo comparte con ${otras.map((o) => h(o.id)).join(', ')}` : ''}</h4><ol>${items.map(itemHTML).join('')}</ol></div>`;
    return html;
  }

  // ---------- Una carta ----------
  function cartaHTML(c) {
    const est = estadoCarta(c);
    const t = TIPOS[c.tipo] || TIPOS.Reto;
    const modoReal = c.modoOriginal || c.modo;
    const modoTexto = MODOS[modoReal] || modoReal;
    let avisos = '';
    if (est === 'falta') avisos += `<div class="aviso falta"><b>Falta contenido:</b> necesita el banco “${h(c.banco)}”. Por ahora se juega como presencial (la app iba a: ${h(modoTexto.toLowerCase())}).</div>`;
    if (est === 'revisar') avisos += `<div class="aviso revisar"><b>Revísalo:</b> el contenido de esta carta lo hice yo. Mira que te guste.</div>`;
    if (c.material) avisos += `<div class="aviso material"><b>Material:</b> ${h(c.material)}</div>`;
    return `<details class="carta" id="c-${h(c.id)}" data-id="${h(c.id)}">
      <summary>
        <span class="id">${h(c.id)}</span>
        <span class="nom">${h(c.nombre)}</span>
        <span class="tipo" style="--c:${t.color}${t.oscuro ? ';color:#3a2600' : ''}">${h(c.tipo)}</span>
        <span class="modo">${h(modoTexto)}</span>
        <span class="der">${c.material ? '<span class="marca material">Material</span>' : ''}<span class="marca ${est}">${ETIQUETA_ESTADO[est]}</span></span>
      </summary>
      <div class="cuerpo">
        <p class="txt">${h(c.instrucciones || '')}</p>
        ${c.comoSeGana ? `<p class="txt"><b>Cómo se gana:</b> ${h(c.comoSeGana)}</p>` : ''}
        <div class="datos">${c.tiempo ? `<span><b>Tiempo:</b> ${c.tiempo} s</span>` : ''}${c.seJuegaEn ? `<span><b>Se juega en:</b> ${h(c.seJuegaEn)}</span>` : ''}${c.villano ? '<span><b>Villano:</b> la app elige un equipo al azar</span>' : ''}${c.guardable ? '<span><b>Se puede guardar</b> para usar después</span>' : ''}</div>
        ${avisos}
        ${bancoHTML(c)}
      </div>
    </details>`;
  }

  // ---------- Filtros y lista ----------
  function pasaFiltro(c) {
    if (filtro.camino !== 'todos' && c.camino !== filtro.camino) return false;
    if (filtro.tipo !== 'todos' && c.tipo !== filtro.tipo) return false;
    const est = estadoCarta(c);
    if (filtro.estado === 'falta' && est !== 'falta') return false;
    if (filtro.estado === 'revisar' && est !== 'revisar') return false;
    if (filtro.estado === 'lista' && est !== 'lista') return false;
    if (filtro.estado === 'material' && !c.material) return false;
    if (filtro.texto) {
      const items = c.banco ? D.bancos[c.banco] || [] : [];
      const todo = sinTildes([c.id, c.nombre, c.instrucciones, c.comoSeGana, c.material, c.tipo, JSON.stringify(items)].join(' '));
      if (!filtro.texto.split(/\s+/).every((p) => todo.includes(p))) return false;
    }
    return true;
  }

  function renderLista() {
    const visibles = D.cartas.filter(pasaFiltro);
    let html = '';
    for (const camino of ORDEN) {
      const cartas = visibles.filter((c) => c.camino === camino);
      if (!cartas.length) continue;
      const cam = CAMINOS[camino] || CAMINO_TODOS;
      html += `<h2 class="grupo"><span class="ic" style="--c:${cam.color}">${svgIcono(cam.svg, 22, 2.4)}</span>${h(NOMBRE_GRUPO[camino] || camino)} <small style="font:800 14px Nunito,sans-serif;color:var(--tinta2)">${cartas.length}</small></h2>`;
      html += cartas.map(cartaHTML).join('');
    }
    // Cartas de caminos que no estén en el orden
    const resto = visibles.filter((c) => !ORDEN.includes(c.camino));
    if (resto.length) html += `<h2 class="grupo">Otras</h2>${resto.map(cartaHTML).join('')}`;
    $('#lista').innerHTML = html || '<div class="vacio">Ninguna carta coincide con los filtros.</div>';
    $('#cuenta').textContent = `${visibles.length} de ${D.cartas.length} cartas`;
  }

  function renderFiltros() {
    const b = (grupo, valor, texto, extra = '') => `<button class="f ${filtro[grupo] === valor ? 'on' : ''}" data-f="${grupo}" data-v="${h(valor)}">${extra}${texto}</button>`;
    const n = (fn) => D.cartas.filter(fn).length;
    $('#f-estado').innerHTML = [
      b('estado', 'todas', 'Todas'),
      b('estado', 'falta', `Falta contenido (${n((c) => estadoCarta(c) === 'falta')})`),
      b('estado', 'revisar', `Revísalo (${n((c) => estadoCarta(c) === 'revisar')})`),
      b('estado', 'material', `Con material (${n((c) => c.material)})`),
      b('estado', 'lista', `Listas (${n((c) => estadoCarta(c) === 'lista')})`),
    ].join('');
    $('#f-camino').innerHTML = b('camino', 'todos', 'Todos los caminos') + ORDEN.map((c) => b('camino', c, c === 'Todos' ? 'Mazo común' : c, `<span class="pt" style="--c:${(CAMINOS[c] || CAMINO_TODOS).color}"></span>`)).join('')
      + `<select id="f-tipo" class="f" aria-label="Tipo de carta"><option value="todos">Todos los tipos</option>${Object.keys(TIPOS).filter((t) => D.cartas.some((c) => c.tipo === t)).map((t) => `<option ${filtro.tipo === t ? 'selected' : ''}>${h(t)}</option>`).join('')}</select>`;
  }

  function render() {
    const n = (fn) => D.cartas.filter(fn).length;
    const falta = n((c) => estadoCarta(c) === 'falta');
    const revisar = n((c) => estadoCarta(c) === 'revisar');
    $('#app').innerHTML = `
      <header class="top">
        <div><h1>Revisión de contenido</h1><p>Todas las cartas con sus preguntas, palabras y respuestas. Arriba está lo que falta.</p></div>
        <div class="acciones" style="display:flex;gap:8px"><button class="btn" id="abrir-todas">Abrir todas</button><button class="btn" id="imprimir">Imprimir</button></div>
      </header>
      <div class="cifras">
        <button class="cifra falta" data-ir-estado="falta"><b>${falta}</b>cartas sin contenido</button>
        <button class="cifra revisar" data-ir-estado="revisar"><b>${revisar}</b>cartas para revisar</button>
        <button class="cifra material" data-ir-estado="material"><b>${n((c) => c.material)}</b>cartas con material</button>
        <button class="cifra lista" data-ir-estado="lista"><b>${n((c) => estadoCarta(c) === 'lista')}</b>cartas listas</button>
      </div>
      ${bloquesPendientes()}
      ${bloqueMateriales()}
      <div class="filtros" id="filtros">
        <input type="search" id="buscar" placeholder="Buscar en cartas, preguntas y respuestas…" value="${h(filtro.texto)}">
        <div class="fila-filtros" id="f-estado"></div>
        <div class="fila-filtros"><span id="f-camino" style="display:contents"></span><span class="cuenta" id="cuenta"></span></div>
      </div>
      <div id="lista"></div>`;
    renderFiltros();
    renderLista();
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]');
    if (f && f.tagName === 'BUTTON') { filtro[f.dataset.f] = f.dataset.v; renderFiltros(); renderLista(); return; }
    const ir = e.target.closest('[data-ir]');
    if (ir) {
      Object.assign(filtro, { texto: '', camino: 'todos', estado: 'todas', tipo: 'todos' });
      $('#buscar').value = '';
      renderFiltros(); renderLista();
      const d = document.getElementById('c-' + ir.dataset.ir);
      if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const est = e.target.closest('[data-ir-estado]');
    if (est) { filtro.estado = est.dataset.irEstado; renderFiltros(); renderLista(); $('#filtros').scrollIntoView({ behavior: 'smooth' }); return; }
    if (e.target.id === 'imprimir') { window.print(); return; }
    if (e.target.id === 'abrir-todas') {
      const todas = [...document.querySelectorAll('details.carta')];
      const abrir = todas.some((d) => !d.open);
      todas.forEach((d) => { d.open = abrir; });
      e.target.textContent = abrir ? 'Cerrar todas' : 'Abrir todas';
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-mat]')) {
      guardar('rev-mat:' + e.target.dataset.mat, e.target.checked ? '1' : '0');
      e.target.closest('.mat').classList.toggle('hecho', e.target.checked);
      const total = document.querySelectorAll('[data-mat]').length;
      const hechos = document.querySelectorAll('[data-mat]:checked').length;
      $('#mat-cuenta').textContent = `${hechos} de ${total} listos`;
    }
    if (e.target.id === 'f-tipo') { filtro.tipo = e.target.value; renderLista(); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'buscar') { filtro.texto = sinTildes(e.target.value.trim()); renderLista(); }
  });
  window.addEventListener('beforeprint', () => document.querySelectorAll('details.carta').forEach((d) => { d.open = true; }));

  // ---------- Carga con PIN ----------
  async function cargar(pin) {
    const r = await fetch('/api/revision', { headers: { 'x-pin': pin } });
    if (r.status === 401) return false;
    if (!r.ok) throw new Error('No se pudo cargar el contenido');
    D = await r.json();
    try { sessionStorage.setItem('rev-pin', pin); } catch (e) { /* sin almacenamiento */ }
    $('#login').classList.add('oculto');
    $('#app').classList.remove('oculto');
    render();
    return true;
  }
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await cargar($('#pin').value.trim());
    $('#pin-error').classList.toggle('oculto', ok);
  });
  let guardado = null;
  try { guardado = sessionStorage.getItem('rev-pin'); } catch (e) { /* nada */ }
  (guardado ? cargar(guardado) : Promise.resolve(false)).then((ok) => { if (!ok) $('#login').classList.remove('oculto'); })
    .catch((err) => { document.body.innerHTML = `<p style="padding:20px">${err.message}</p>`; });
})();
