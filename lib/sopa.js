// Generador de sopa de letras
const DIRECCIONES = [[0, 1], [1, 0], [1, 1], [-1, 1]]; // →, ↓, ↘, ↗
const LETRAS = 'ABCDEFGHIJLMNOPRSTUVZ';

function limpiar(p) {
  return p.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

function generarSopa(palabras, tam = 12) {
  for (let intento = 0; intento < 200; intento++) {
    const grid = Array.from({ length: tam }, () => Array(tam).fill(''));
    const colocadas = [];
    let ok = true;
    const orden = [...palabras].map(limpiar).sort((a, b) => b.length - a.length);
    for (const palabra of orden) {
      let puesta = false;
      for (let k = 0; k < 300 && !puesta; k++) {
        const [dr, dc] = DIRECCIONES[Math.floor(Math.random() * DIRECCIONES.length)];
        const r0 = Math.floor(Math.random() * tam), c0 = Math.floor(Math.random() * tam);
        const r1 = r0 + dr * (palabra.length - 1), c1 = c0 + dc * (palabra.length - 1);
        if (r1 < 0 || r1 >= tam || c1 < 0 || c1 >= tam) continue;
        let cabe = true;
        for (let i = 0; i < palabra.length; i++) {
          const ch = grid[r0 + dr * i][c0 + dc * i];
          if (ch && ch !== palabra[i]) { cabe = false; break; }
        }
        if (!cabe) continue;
        for (let i = 0; i < palabra.length; i++) grid[r0 + dr * i][c0 + dc * i] = palabra[i];
        colocadas.push({ palabra, a: [r0, c0], b: [r1, c1] });
        puesta = true;
      }
      if (!puesta) { ok = false; break; }
    }
    if (!ok) continue;
    for (let r = 0; r < tam; r++) for (let c = 0; c < tam; c++) {
      if (!grid[r][c]) grid[r][c] = LETRAS[Math.floor(Math.random() * LETRAS.length)];
    }
    return { grid: grid.map((f) => f.join('')), colocadas };
  }
  throw new Error('No se pudo generar la sopa de letras');
}

// Devuelve la palabra que forman las letras entre a y b (en línea recta), o null
function leerLinea(grid, a, b) {
  const [r0, c0] = a, [r1, c1] = b;
  const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
  const largo = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
  if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) return null;
  let s = '';
  for (let i = 0; i < largo; i++) {
    const fila = grid[r0 + dr * i];
    if (!fila) return null;
    s += fila[c0 + dc * i];
  }
  return s;
}

module.exports = { generarSopa, leerLinea, limpiar };
