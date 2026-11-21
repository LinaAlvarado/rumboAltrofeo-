// Recorta los 10 aventureros de "Aventureros chibi de fantasía.png" (fondo blanco)
// y los guarda con fondo transparente como public/personajes/p01.png ... p10.png
// Uso: npm run personajes
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DIR = path.join(__dirname, '..', 'public', 'personajes');
const ORIGEN = path.join(DIR, 'Aventureros chibi de fantasía.png');
// En orden: fila de arriba de izquierda a derecha, luego fila de abajo
const NOMBRES = ['Caballero', 'Arquero', 'Guerrera', 'Clérigo', 'Sombra', 'Bárbara', 'Samurái', 'Druida', 'Pirata', 'Inventora'];
const TAM = 320;

(async () => {
  const { data, info } = await sharp(ORIGEN).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const blanco = (p) => data[p * 3] > 232 && data[p * 3 + 1] > 232 && data[p * 3 + 2] > 232;

  // 1) Fondo = blanco conectado con los bordes
  const fondo = new Uint8Array(N);
  const pila = [];
  for (let x = 0; x < W; x++) pila.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) pila.push(y * W, y * W + W - 1);
  while (pila.length) {
    const p = pila.pop();
    if (fondo[p] || !blanco(p)) continue;
    fondo[p] = 1;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) pila.push(p - 1);
    if (x < W - 1) pila.push(p + 1);
    if (y > 0) pila.push(p - W);
    if (y < H - 1) pila.push(p + W);
  }

  // 1b) Huecos blancos encerrados (ej.: entre el arco y el cuerpo): blanco puro y grandes
  const puro = (p) => data[p * 3] > 246 && data[p * 3 + 1] > 246 && data[p * 3 + 2] > 246;
  const visto = new Uint8Array(N);
  for (let p0 = 0; p0 < N; p0++) {
    if (fondo[p0] || visto[p0] || !puro(p0)) continue;
    const region = [], q = [p0]; visto[p0] = 1;
    while (q.length) {
      const p = q.pop(); region.push(p);
      const x = p % W, y = (p / W) | 0;
      for (const v of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (v >= 0 && !fondo[v] && !visto[v] && puro(v)) { visto[v] = 1; q.push(v); }
      }
    }
    if (region.length > 150) region.forEach((p) => { fondo[p] = 1; });
  }

  // 2) Piezas conectadas que no son fondo
  const comp = new Int32Array(N).fill(-1);
  const piezas = [];
  for (let p0 = 0; p0 < N; p0++) {
    if (fondo[p0] || comp[p0] >= 0) continue;
    const id = piezas.length;
    const q = [p0]; comp[p0] = id;
    let n = 0, minX = W, maxX = 0, minY = H, maxY = 0, sx = 0, sy = 0;
    while (q.length) {
      const p = q.pop(); n++;
      const x = p % W, y = (p / W) | 0;
      sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const v of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (v >= 0 && !fondo[v] && comp[v] < 0) { comp[v] = id; q.push(v); }
      }
    }
    piezas.push({ id, n, minX, maxX, minY, maxY, cx: sx / n, cy: sy / n });
  }

  // 3) Las 10 piezas más grandes son los personajes; las pequeñas se asignan al más cercano
  const grandes = [...piezas].sort((a, b) => b.n - a.n).slice(0, 10);
  const filaDe = (pz) => (pz.cy < H / 2 ? 0 : 1);
  grandes.sort((a, b) => filaDe(a) - filaDe(b) || a.cx - b.cx);
  const dueno = new Int32Array(piezas.length).fill(-1);
  grandes.forEach((g, i) => { dueno[g.id] = i; });
  for (const pz of piezas) {
    if (dueno[pz.id] >= 0 || pz.n < 40) continue;
    let mejor = -1, dMin = Infinity;
    grandes.forEach((g, i) => {
      const dx = Math.max(g.minX - pz.maxX, pz.minX - g.maxX, 0);
      const dy = Math.max(g.minY - pz.maxY, pz.minY - g.maxY, 0);
      const d = Math.hypot(dx, dy);
      if (d < dMin) { dMin = d; mejor = i; }
    });
    if (dMin < 40) dueno[pz.id] = mejor;
  }

  // 4) Cada personaje a un PNG cuadrado y transparente
  const meta = [];
  for (let i = 0; i < 10; i++) {
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (const pz of piezas) if (dueno[pz.id] === i) { minX = Math.min(minX, pz.minX); maxX = Math.max(maxX, pz.maxX); minY = Math.min(minY, pz.minY); maxY = Math.max(maxY, pz.maxY); }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (minY + y) * W + (minX + x);
      const o = (y * w + x) * 4;
      const mio = !fondo[p] && comp[p] >= 0 && dueno[comp[p]] === i;
      rgba[o] = data[p * 3]; rgba[o + 1] = data[p * 3 + 1]; rgba[o + 2] = data[p * 3 + 2]; rgba[o + 3] = mio ? 255 : 0;
    }
    const lado = Math.max(w, h) + 16;
    const recorte = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const archivo = `p${String(i + 1).padStart(2, '0')}.png`;
    const lienzo = await sharp({ create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: recorte, left: Math.floor((lado - w) / 2), top: lado - h - 8 }]).png().toBuffer();
    await sharp(lienzo).resize(TAM, TAM).png().toFile(path.join(DIR, archivo));
    meta.push({ archivo, nombre: NOMBRES[i] });
  }
  fs.writeFileSync(path.join(DIR, 'personajes.json'), JSON.stringify(meta, null, 2));
  console.log('Personajes:', meta.map((m) => m.nombre).join(', '));
})();
