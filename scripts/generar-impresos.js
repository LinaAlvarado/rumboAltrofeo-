// Genera impresos/impresos.pdf (tamaño carta): sopa de letras bíblica,
// laberinto para "Laberinto con lanas" y una hoja de soluciones.
// Uso: node scripts/generar-impresos.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'impresos');
const FUENTES = path.join(RAIZ, 'node_modules', '@fontsource');

// ---------- Azar con semilla (mismo resultado cada vez) ----------
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Sopa de letras ----------
const PALABRAS = ['NABUCODONOSOR', 'MELQUISEDEC', 'TABERNACULO', 'GETSEMANI', 'ZOROBABEL', 'MATUSALEN', 'FILISTEOS', 'EZEQUIEL'];
const N = 15;
// Direcciones: horizontales, verticales y diagonales, al derecho y al revés.
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

function contar(grid, w) {
  let n = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
    let ok = true;
    for (let i = 0; i < w.length && ok; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || grid[rr][cc] !== w[i]) ok = false;
    }
    if (ok) n++;
  }
  return n;
}

function intentarSopa(rnd) {
  const grid = Array.from({ length: N }, () => Array(N).fill(null));
  const pos = [];
  // Las palabras largas primero. Cada una recibe una dirección distinta a propósito:
  // 4 en diagonal, 3 al revés y solo 1 al derecho normal.
  const orden = [...PALABRAS].sort((a, b) => b.length - a.length);
  const dirsAsignadas = [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, -1], [-1, 0], [0, -1], [1, 0]];
  for (let i = dirsAsignadas.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [dirsAsignadas[i], dirsAsignadas[j]] = [dirsAsignadas[j], dirsAsignadas[i]];
  }
  for (let k = 0; k < orden.length; k++) {
    const w = orden[k];
    const [dr, dc] = dirsAsignadas[k];
    let puesto = false;
    for (let t = 0; t < 2000 && !puesto; t++) {
      const r = Math.floor(rnd() * N), c = Math.floor(rnd() * N);
      const rf = r + dr * (w.length - 1), cf = c + dc * (w.length - 1);
      if (rf < 0 || cf < 0 || rf >= N || cf >= N) continue;
      let ok = true;
      for (let i = 0; i < w.length && ok; i++) {
        const v = grid[r + dr * i][c + dc * i];
        if (v !== null && v !== w[i]) ok = false;
      }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
      pos.push({ w, r, c, dr, dc });
      puesto = true;
    }
    if (!puesto) return null;
  }
  // Señuelos: pedazos del comienzo de las palabras sueltos por ahí, para despistar.
  for (const w of PALABRAS) {
    const trozo = w.slice(0, 3 + Math.floor(rnd() * 2));
    for (let t = 0; t < 60; t++) {
      const [dr, dc] = DIRS[Math.floor(rnd() * DIRS.length)];
      const r = Math.floor(rnd() * N), c = Math.floor(rnd() * N);
      const rf = r + dr * (trozo.length - 1), cf = c + dc * (trozo.length - 1);
      if (rf < 0 || cf < 0 || rf >= N || cf >= N) continue;
      let libre = true;
      for (let i = 0; i < trozo.length; i++) if (grid[r + dr * i][c + dc * i] !== null) libre = false;
      if (!libre) continue;
      for (let i = 0; i < trozo.length; i++) grid[r + dr * i][c + dc * i] = trozo[i];
      break;
    }
  }
  // Relleno con letras de las mismas palabras (así no se ven "raras").
  const bolsa = PALABRAS.join('');
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === null) grid[r][c] = bolsa[Math.floor(rnd() * bolsa.length)];
  // Cada palabra debe aparecer exactamente una vez.
  if (PALABRAS.some((w) => contar(grid, w) !== 1)) return null;
  return { grid, pos };
}

function crearSopa() {
  for (let s = 1; s < 5000; s++) {
    const res = intentarSopa(azar(s * 7919));
    if (res) return res;
  }
  throw new Error('No se pudo armar la sopa');
}

// ---------- Laberinto ----------
const COLS = 7, FILAS = 9;

function crearLaberinto(rnd) {
  // muros[r][c] = {n,s,e,o} true si hay pared
  const m = Array.from({ length: FILAS }, () => Array.from({ length: COLS }, () => ({ n: true, s: true, e: true, o: true })));
  const visto = Array.from({ length: FILAS }, () => Array(COLS).fill(false));
  // "Árbol creciente" mitad y mitad: pasillos que serpentean pero con más bifurcaciones
  // y callejones sin salida que un laberinto de un solo trazo.
  const pila = [[0, 0]];
  visto[0][0] = true;
  const MOV = [['n', -1, 0, 's'], ['s', 1, 0, 'n'], ['e', 0, 1, 'o'], ['o', 0, -1, 'e']];
  while (pila.length) {
    const idx = rnd() < 0.5 ? pila.length - 1 : Math.floor(rnd() * pila.length);
    const [r, c] = pila[idx];
    const opciones = MOV.filter(([, dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      return rr >= 0 && cc >= 0 && rr < FILAS && cc < COLS && !visto[rr][cc];
    });
    if (!opciones.length) { pila.splice(idx, 1); continue; }
    const [lado, dr, dc, opuesto] = opciones[Math.floor(rnd() * opciones.length)];
    m[r][c][lado] = false;
    m[r + dr][c + dc][opuesto] = false;
    visto[r + dr][c + dc] = true;
    pila.push([r + dr, c + dc]);
  }
  m[0][0].n = false; // entrada arriba a la izquierda
  m[FILAS - 1][COLS - 1].s = false; // salida abajo a la derecha
  return m;
}

function resolver(m) {
  const prev = new Map();
  const cola = [[0, 0]];
  prev.set('0,0', null);
  while (cola.length) {
    const [r, c] = cola.shift();
    if (r === FILAS - 1 && c === COLS - 1) break;
    const vecinos = [];
    if (!m[r][c].n && r > 0) vecinos.push([r - 1, c]);
    if (!m[r][c].s && r < FILAS - 1) vecinos.push([r + 1, c]);
    if (!m[r][c].e) vecinos.push([r, c + 1]);
    if (!m[r][c].o) vecinos.push([r, c - 1]);
    for (const [rr, cc] of vecinos) if (!prev.has(rr + ',' + cc)) { prev.set(rr + ',' + cc, [r, c]); cola.push([rr, cc]); }
  }
  const camino = [];
  let p = [FILAS - 1, COLS - 1];
  while (p) { camino.unshift(p); p = prev.get(p[0] + ',' + p[1]); }
  return camino;
}

function elegirLaberinto() {
  // Término intermedio: el camino correcto recorre más o menos la mitad de las casillas,
  // con varios callejones sin salida, pero sin ser eterno.
  for (let s = 1; s < 5000; s++) {
    const m = crearLaberinto(azar(s * 104729));
    const camino = resolver(m);
    const total = COLS * FILAS;
    let giros = 0;
    for (let i = 2; i < camino.length; i++) {
      const a = [camino[i - 1][0] - camino[i - 2][0], camino[i - 1][1] - camino[i - 2][1]];
      const b = [camino[i][0] - camino[i - 1][0], camino[i][1] - camino[i - 1][1]];
      if (a[0] !== b[0] || a[1] !== b[1]) giros++;
    }
    // Sin rectas largas al comienzo: los primeros 4 pasos ya deben tener algún giro.
    const recto = camino.slice(0, 5).every(([, c]) => c === 0) || camino.slice(0, 5).every(([r]) => r === 0);
    if (!recto && giros >= 16 && camino.length >= total * 0.42 && camino.length <= total * 0.6) return { m, camino, giros };
  }
  throw new Error('No se pudo armar el laberinto');
}

// ---------- Dibujo ----------
function svgLaberinto(m, celda, grosor, camino) {
  const W = COLS * celda, H = FILAS * celda, pad = grosor;
  let lineas = '';
  for (let r = 0; r < FILAS; r++) for (let c = 0; c < COLS; c++) {
    const x = c * celda + pad, y = r * celda + pad;
    if (m[r][c].n) lineas += `<line x1="${x}" y1="${y}" x2="${x + celda}" y2="${y}"/>`;
    if (m[r][c].o) lineas += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + celda}"/>`;
    if (r === FILAS - 1 && m[r][c].s) lineas += `<line x1="${x}" y1="${y + celda}" x2="${x + celda}" y2="${y + celda}"/>`;
    if (c === COLS - 1 && m[r][c].e) lineas += `<line x1="${x + celda}" y1="${y}" x2="${x + celda}" y2="${y + celda}"/>`;
  }
  let ruta = '';
  if (camino) {
    const pts = [[pad + celda / 2, 0], ...camino.map(([r, c]) => [c * celda + pad + celda / 2, r * celda + pad + celda / 2]), [(COLS - 1) * celda + pad + celda / 2, H + pad * 2]];
    ruta = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#e63946" stroke-width="${celda * 0.18}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + pad * 2} ${H + pad * 2}" width="100%" height="100%">${ruta}<g stroke="#111" stroke-width="${grosor}" stroke-linecap="square">${lineas}</g></svg>`;
}

function tablaSopa(grid, pos, conSolucion) {
  const marcadas = new Set();
  if (conSolucion) for (const { w, r, c, dr, dc } of pos) for (let i = 0; i < w.length; i++) marcadas.add((r + dr * i) + ',' + (c + dc * i));
  return `<table class="sopa${conSolucion ? ' chica' : ''}">${grid.map((fila, r) => `<tr>${fila.map((l, c) => `<td class="${marcadas.has(r + ',' + c) ? 'on' : ''}">${l}</td>`).join('')}</tr>`).join('')}</table>`;
}

function html(sopa, lab) {
  const fuente = (f) => 'file:///' + path.join(FUENTES, f).replace(/\\/g, '/');
  const lista = [...PALABRAS].sort();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>
@font-face{font-family:Lilita;src:url('${fuente('lilita-one/files/lilita-one-latin-400-normal.woff2')}')}
@font-face{font-family:Nunito;font-weight:700;src:url('${fuente('nunito/files/nunito-latin-700-normal.woff2')}')}
@font-face{font-family:Nunito;font-weight:900;src:url('${fuente('nunito/files/nunito-latin-900-normal.woff2')}')}
@page{size:letter;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:Nunito,sans-serif;color:#111}
.hoja{width:8.5in;height:11in;padding:0.45in 0.5in;page-break-after:always;display:flex;flex-direction:column;align-items:center;overflow:hidden}
.hoja:last-child{page-break-after:auto}
h1{font-family:Lilita,sans-serif;font-weight:400;font-size:40px;margin:0 0 2px;letter-spacing:1px}
.sub{font-size:15px;font-weight:700;margin:0 0 14px;color:#444;text-align:center}
table.sopa{border-collapse:collapse;border:3px solid #111}
table.sopa td{width:0.48in;height:0.48in;text-align:center;vertical-align:middle;font-family:Nunito;font-weight:900;font-size:27px;border:1px solid #bbb;padding:0}
table.sopa.chica td{width:0.24in;height:0.24in;font-size:13px}
table.sopa td.on{background:#ffd166}
.palabras{margin-top:20px;display:grid;grid-template-columns:repeat(4,auto);gap:10px 22px;font-family:Lilita,sans-serif;font-size:19px;letter-spacing:.5px}
.palabras span{white-space:nowrap;display:flex;align-items:center;gap:6px}
.palabras span::before{content:'';width:15px;height:15px;border:2px solid #111;display:inline-block}
.lab{width:7.35in;height:9.3in}
.etq{font-family:Lilita,sans-serif;font-size:24px;width:7.35in;display:flex}
.sol{display:flex;gap:0.35in;align-items:flex-start;margin-top:10px}
.sol h2{font-family:Lilita,sans-serif;font-weight:400;font-size:20px;margin:0 0 6px}
.lab-sol{width:3.2in;height:4.05in}
.nota{font-size:12px;color:#555;margin-top:6px;max-width:3.6in}
</style></head><body>
<div class="hoja">
  <h1>SOPA DE LETRAS BÍBLICA</h1>
  <p class="sub">Encuentra las 8 palabras. Pueden estar al derecho, al revés, de arriba abajo, de abajo arriba o en diagonal.</p>
  ${tablaSopa(sopa.grid, sopa.pos, false)}
  <div class="palabras">${lista.map((w) => `<span>${w}</span>`).join('')}</div>
</div>
<div class="hoja">
  <h1>LABERINTO</h1>
  <div class="etq"><span>⬇ ENTRADA</span></div>
  <div class="lab">${svgLaberinto(lab.m, 100, 10, null)}</div>
  <div class="etq" style="justify-content:flex-end"><span>SALIDA ⬇</span></div>
</div>
<div class="hoja">
  <h1>SOLUCIONES</h1>
  <p class="sub">Solo para el moderador. No imprimas esta hoja para los equipos.</p>
  <div class="sol">
    <div><h2>Sopa de letras</h2>${tablaSopa(sopa.grid, sopa.pos, true)}
      <div class="nota">${sopa.pos.map(({ w, dr, dc }) => `${w}: ${dr === 0 ? (dc > 0 ? 'horizontal →' : 'horizontal al revés ←') : dc === 0 ? (dr > 0 ? 'vertical ↓' : 'vertical al revés ↑') : 'diagonal ' + (dr > 0 ? (dc > 0 ? '↘' : '↙') : (dc > 0 ? '↗' : '↖'))}`).join('<br>')}</div>
    </div>
    <div><h2>Laberinto</h2><div class="lab-sol">${svgLaberinto(lab.m, 100, 10, lab.camino)}</div></div>
  </div>
</div>
</body></html>`;
}

(async () => {
  const sopa = crearSopa();
  const lab = elegirLaberinto();
  fs.mkdirSync(SALIDA, { recursive: true });
  const archivoHtml = path.join(SALIDA, 'impresos.html');
  fs.writeFileSync(archivoHtml, html(sopa, lab));
  const navegadores = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const browser = await puppeteer.launch({ executablePath: navegadores.find((p) => fs.existsSync(p)), args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.goto('file:///' + archivoHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(SALIDA, 'impresos.pdf'), format: 'letter', printBackground: true, preferCSSPageSize: true });
  await page.setViewport({ width: 816, height: 1056 * 3 });
  await page.screenshot({ path: path.join(SALIDA, 'vista.png'), fullPage: true });
  await browser.close();
  console.log('Camino del laberinto:', lab.camino.length, 'de', COLS * FILAS, 'casillas,', lab.giros, 'giros');
  fs.copyFileSync(path.join(SALIDA, 'impresos.pdf'), path.join(RAIZ, 'public', 'impresos.pdf'));
  console.log('Listo:', path.join(SALIDA, 'impresos.pdf'), '(también en http://localhost:3000/impresos.pdf)');
})();
