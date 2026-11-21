// Validación de respuestas escritas (spec, sección 7)
// 1. Ignora mayúsculas, tildes, espacios de más y artículos.
// 2. Acepta respuestas alternativas.
// 3. Acepta errores de 1 o 2 letras.
// 4. Si no pasa pero se parece, queda "dudosa" para el moderador.

const ARTICULOS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'y', 'al']);

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p && !ARTICULOS.has(p))
    .join('');
}

function distancia(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * @returns {'correcta'|'dudosa'|'incorrecta'}
 */
function validar(texto, { respuesta, aceptadas = [], numero = false }) {
  if (numero) {
    const a = String(texto ?? '').replace(/[^0-9-]/g, '');
    const b = String(respuesta).replace(/[^0-9-]/g, '');
    return a !== '' && a === b ? 'correcta' : 'incorrecta';
  }
  const dado = normalizar(texto);
  if (!dado) return 'incorrecta';
  const candidatos = [respuesta, ...(aceptadas || [])].map(normalizar).filter(Boolean);
  let mejor = 'incorrecta';
  for (const c of candidatos) {
    if (dado === c) return 'correcta';
    const d = distancia(dado, c);
    const tolerancia = c.length <= 3 ? 0 : c.length <= 5 ? 1 : 2;
    if (d <= tolerancia) return 'correcta';
    const parecido = d <= Math.max(3, Math.round(c.length * 0.4)) ||
      (dado.length >= 3 && (c.includes(dado) || dado.includes(c)));
    if (parecido) mejor = 'dudosa';
  }
  return mejor;
}

module.exports = { validar, normalizar, distancia };
