// Genera los dibujos SVG de las cartas visuales (DE01, E12, C12) y las banderas (M13).
// Uso: node scripts/generar-imagenes.js
const fs = require('fs');
const path = require('path');
const IMG = path.join(__dirname, '..', 'public', 'img');
const BAN = path.join(IMG, 'banderas');
fs.mkdirSync(BAN, { recursive: true });
const svg = (w, h, cuerpo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${cuerpo}</svg>`;

// ---------- DE01: casa de cartas de 3 pisos ----------
function carta(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7a1022" stroke-width="12" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8283f" stroke-width="8" stroke-linecap="round"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="2" stroke-dasharray="6 6"/>`;
}
let casa = '<rect width="600" height="520" fill="#f5f0ff"/><rect y="470" width="600" height="50" fill="#c9b37a"/>';
const piso = (y, n, x0) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * 130;
    s += carta(bx, y, bx + 55, y - 130) + carta(bx + 110, y, bx + 55, y - 130);
  }
  return s;
};
const plano = (y, n, x0) => {
  let s = '';
  for (let i = 0; i < n; i++) { const bx = x0 + 55 + i * 130; s += carta(bx, y, bx + 130, y); }
  return s;
};
casa += piso(470, 3, 45) + plano(336, 2, 45) + piso(330, 2, 110) + plano(196, 1, 110) + piso(190, 1, 175);
casa += '<text x="300" y="40" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="30" fill="#3a1a8f">Casa de cartas de 3 pisos</text>';
fs.writeFileSync(path.join(IMG, 'casa-cartas.svg'), svg(600, 520, casa));

// ---------- E12: dibujos sencillos (línea negra) ----------
const trazo = 'fill="none" stroke="#111" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"';
const fondo = '<rect width="400" height="400" fill="#fff"/>';
fs.writeFileSync(path.join(IMG, 'dibujo-casa.svg'), svg(400, 400, `${fondo}<g ${trazo}><rect x="90" y="180" width="220" height="170"/><path d="M70 190 L200 70 L330 190"/><rect x="175" y="260" width="50" height="90"/><rect x="110" y="210" width="45" height="45"/><rect x="245" y="210" width="45" height="45"/><rect x="250" y="95" width="30" height="55"/></g>`));
fs.writeFileSync(path.join(IMG, 'dibujo-arbol-sol.svg'), svg(400, 400, `${fondo}<g ${trazo}><rect x="140" y="230" width="40" height="130"/><circle cx="160" cy="180" r="80"/><circle cx="320" cy="80" r="35"/><path d="M320 25v-15M320 150v-15M265 80h-15M390 80h-15M282 42l-10-10M368 128l-10-10M358 42l10-10M272 128l10-10"/><path d="M40 360h330"/></g>`));
fs.writeFileSync(path.join(IMG, 'dibujo-barco.svg'), svg(400, 400, `${fondo}<g ${trazo}><path d="M70 260h260l-40 60H110z"/><path d="M200 260V60"/><path d="M200 70l100 160H200"/><path d="M200 90l-80 140h80"/><path d="M30 350q30-20 60 0t60 0t60 0t60 0t60 0t60 0"/></g>`));
fs.writeFileSync(path.join(IMG, 'dibujo-cara.svg'), svg(400, 400, `${fondo}<g ${trazo}><circle cx="200" cy="200" r="150"/><circle cx="145" cy="160" r="14" fill="#111"/><circle cx="255" cy="160" r="14" fill="#111"/><path d="M120 235q80 90 160 0"/></g>`));

// ---------- C12: escenas para el rompecabezas (300x300, colores fuertes) ----------
const arca = `
<defs><linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset="1" stop-color="#c9f0ff"/></linearGradient></defs>
<rect width="300" height="300" fill="url(#cielo)"/>
<circle cx="250" cy="50" r="28" fill="#ffd23f"/>
<g fill="none" stroke-width="10"><path d="M20 190 A130 130 0 0 1 280 190" stroke="#ff4d6d"/><path d="M32 190 A118 118 0 0 1 268 190" stroke="#ff9f1c"/><path d="M44 190 A106 106 0 0 1 256 190" stroke="#ffd23f"/><path d="M56 190 A94 94 0 0 1 244 190" stroke="#3ddc84"/><path d="M68 190 A82 82 0 0 1 232 190" stroke="#2ea8ff"/><path d="M80 190 A70 70 0 0 1 220 190" stroke="#8b5cf6"/></g>
<path d="M0 230 Q40 215 80 230 T160 230 T240 230 T320 230 V300 H0Z" fill="#1468c4"/>
<path d="M40 200 H260 L235 250 H65Z" fill="#8a4b1f" stroke="#4a2408" stroke-width="4"/>
<rect x="95" y="160" width="110" height="42" fill="#c07a3a" stroke="#4a2408" stroke-width="4"/>
<path d="M85 162 L150 128 L215 162Z" fill="#7a3d12" stroke="#4a2408" stroke-width="4"/>
<rect x="110" y="172" width="18" height="18" fill="#ffe08a"/><rect x="172" y="172" width="18" height="18" fill="#ffe08a"/>
<g fill="#ffcc33"><rect x="222" y="150" width="10" height="55"/><ellipse cx="234" cy="146" rx="13" ry="9"/></g>
<g fill="#9aa0a6"><ellipse cx="62" cy="190" rx="22" ry="14"/><path d="M44 182 q-12 -6 -18 6" stroke="#9aa0a6" stroke-width="7" fill="none"/></g>
<g fill="#fff" stroke="#333" stroke-width="2"><path d="M60 70 q15 -14 30 0 q-15 6 -30 0z"/><path d="M72 66 l-14 -12 l20 6z"/></g>
<path d="M88 68 l10 2" stroke="#3ddc84" stroke-width="4"/>
<path d="M0 262 Q40 250 80 262 T160 262 T240 262 T320 262" stroke="#9fd8ff" stroke-width="5" fill="none"/>`;
fs.writeFileSync(path.join(IMG, 'escena-arca.svg'), svg(300, 300, arca));

const david = `
<rect width="300" height="300" fill="#ffd9a0"/>
<circle cx="60" cy="55" r="30" fill="#ff9f1c"/>
<path d="M0 120 Q80 90 160 120 T300 110 V300 H0Z" fill="#c9a26b"/>
<path d="M0 210 Q100 190 200 215 T300 205 V300 H0Z" fill="#7cb342"/>
<g><rect x="185" y="70" width="70" height="120" rx="12" fill="#8d8d8d" stroke="#444" stroke-width="4"/>
<circle cx="220" cy="55" r="28" fill="#e0a878" stroke="#444" stroke-width="4"/>
<path d="M190 48 Q220 10 250 48Z" fill="#9e9e9e" stroke="#444" stroke-width="4"/>
<rect x="190" y="185" width="22" height="70" fill="#6d4c41"/><rect x="228" y="185" width="22" height="70" fill="#6d4c41"/>
<rect x="255" y="60" width="10" height="150" fill="#5d4037"/><path d="M250 60 l10 -30 l10 30z" fill="#bdbdbd"/>
<circle cx="210" cy="52" r="4" fill="#222"/><circle cx="230" cy="52" r="4" fill="#222"/><path d="M208 70 h24" stroke="#222" stroke-width="4"/></g>
<g><circle cx="80" cy="175" r="16" fill="#f1c27d" stroke="#5a3a1a" stroke-width="3"/>
<rect x="68" y="190" width="24" height="40" rx="6" fill="#2ea8ff"/>
<rect x="70" y="228" width="8" height="28" fill="#f1c27d"/><rect x="82" y="228" width="8" height="28" fill="#f1c27d"/>
<path d="M90 198 L118 160" stroke="#f1c27d" stroke-width="7" stroke-linecap="round"/>
<path d="M118 160 q14 -10 22 6" stroke="#5d4037" stroke-width="3" fill="none"/></g>
<circle cx="168" cy="120" r="7" fill="#616161"/>
<path d="M140 150 q12 -16 24 -26" stroke="#fff" stroke-width="3" stroke-dasharray="4 5" fill="none"/>
<g fill="#4e7d1f"><circle cx="20" cy="250" r="16"/><circle cx="280" cy="255" r="18"/><circle cx="140" cy="265" r="12"/></g>`;
fs.writeFileSync(path.join(IMG, 'escena-david-goliat.svg'), svg(300, 300, david));

const jonas = `
<defs><linearGradient id="mar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ea8ff"/><stop offset="1" stop-color="#0b2a66"/></linearGradient></defs>
<rect width="300" height="300" fill="url(#mar)"/>
<rect width="300" height="60" fill="#ffd9a0"/><circle cx="240" cy="30" r="20" fill="#ff9f1c"/>
<path d="M0 60 Q25 50 50 60 T100 60 T150 60 T200 60 T250 60 T300 60 V70 H0Z" fill="#9fd8ff"/>
<path d="M20 70 q30 -30 60 0" fill="#8a4b1f"/><rect x="48" y="30" width="4" height="36" fill="#4a2408"/><path d="M52 32 l22 22 h-22z" fill="#fff"/>
<g><ellipse cx="150" cy="185" rx="115" ry="65" fill="#5c6bc0" stroke="#283593" stroke-width="5"/>
<path d="M255 185 l40 -45 v90z" fill="#5c6bc0" stroke="#283593" stroke-width="5"/>
<path d="M45 200 Q100 245 190 215" fill="#c5cae9"/>
<circle cx="80" cy="160" r="10" fill="#fff"/><circle cx="78" cy="160" r="5" fill="#111"/>
<path d="M36 195 q30 10 60 0" stroke="#283593" stroke-width="5" fill="none"/>
<path d="M140 120 q10 -30 0 -50 M150 122 q20 -25 25 -45 M130 122 q-10 -25 -20 -40" stroke="#bbdefb" stroke-width="5" fill="none" stroke-linecap="round"/></g>
<g><circle cx="150" cy="180" r="12" fill="#f1c27d" stroke="#5a3a1a" stroke-width="3"/><rect x="140" y="191" width="20" height="28" rx="5" fill="#ff7043"/>
<path d="M140 196 l-14 -14 M160 196 l14 -14" stroke="#f1c27d" stroke-width="6" stroke-linecap="round"/></g>
<g fill="#ffd23f"><path d="M30 265 l14 -8 v16z"/><circle cx="24" cy="265" r="7"/><path d="M250 270 l14 -8 v16z"/><circle cx="244" cy="270" r="7"/></g>
<g fill="#3ddc84"><path d="M100 300 q5 -30 -5 -45 q15 15 12 45z"/><path d="M200 300 q-6 -34 6 -50 q-14 20 -8 50z"/></g>
<g fill="#e1f5fe" opacity=".7"><circle cx="230" cy="110" r="5"/><circle cx="240" cy="95" r="3"/><circle cx="60" cy="110" r="4"/></g>`;
fs.writeFileSync(path.join(IMG, 'escena-jonas.svg'), svg(300, 300, jonas));

// ---------- M13: banderas (simplificadas) ----------
const W = 300, H = 200;
const ban = {
  co: `<rect width="300" height="100" fill="#FCD116"/><rect y="100" width="300" height="50" fill="#003893"/><rect y="150" width="300" height="50" fill="#CE1126"/>`,
  mx: `<rect width="100" height="200" fill="#006847"/><rect x="100" width="100" height="200" fill="#fff"/><rect x="200" width="100" height="200" fill="#CE1126"/><circle cx="150" cy="100" r="26" fill="#8c5a2b"/><path d="M128 112 q22 22 44 0" stroke="#006847" stroke-width="6" fill="none"/>`,
  ar: `<rect width="300" height="200" fill="#74ACDF"/><rect y="66.6" width="300" height="66.6" fill="#fff"/><circle cx="150" cy="100" r="18" fill="#F6B40E" stroke="#85340A" stroke-width="2"/>`,
  br: `<rect width="300" height="200" fill="#009C3B"/><path d="M150 22 L278 100 L150 178 L22 100Z" fill="#FFDF00"/><circle cx="150" cy="100" r="46" fill="#002776"/><path d="M106 92 q44 -14 88 14" stroke="#fff" stroke-width="7" fill="none"/>`,
  es: `<rect width="300" height="200" fill="#AA151B"/><rect y="50" width="300" height="100" fill="#F1BF00"/><rect x="70" y="78" width="30" height="44" rx="4" fill="#AA151B" stroke="#8c6a00" stroke-width="3"/>`,
  il: `<rect width="300" height="200" fill="#fff"/><rect y="22" width="300" height="26" fill="#0038b8"/><rect y="152" width="300" height="26" fill="#0038b8"/><g fill="none" stroke="#0038b8" stroke-width="7"><path d="M150 62 L183 119 H117Z"/><path d="M150 138 L117 81 H183Z"/></g>`,
  jp: `<rect width="300" height="200" fill="#fff"/><circle cx="150" cy="100" r="60" fill="#BC002D"/>`,
  fr: `<rect width="100" height="200" fill="#0055A4"/><rect x="100" width="100" height="200" fill="#fff"/><rect x="200" width="100" height="200" fill="#EF4135"/>`,
  it: `<rect width="100" height="200" fill="#009246"/><rect x="100" width="100" height="200" fill="#fff"/><rect x="200" width="100" height="200" fill="#CE2B37"/>`,
  us: (() => {
    let s = '<rect width="300" height="200" fill="#fff"/>';
    for (let i = 0; i < 13; i += 2) s += `<rect y="${(i * 200) / 13}" width="300" height="${200 / 13}" fill="#B22234"/>`;
    s += `<rect width="130" height="${(7 * 200) / 13}" fill="#3C3B6E"/>`;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) s += `<circle cx="${12 + c * 21 + (r % 2) * 10}" cy="${12 + r * 20}" r="4" fill="#fff"/>`;
    return s;
  })(),
};
// Banderas menos comunes (las que usa M13 ahora)
const estrella = (cx, cy, R, giro = -90, color = '#fff') => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.382 : R;
    const a = ((giro + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
};
Object.assign(ban, {
  gr: (() => {
    const h = 200 / 9;
    let s = '<rect width="300" height="200" fill="#0D5EAF"/>';
    for (let i = 1; i < 9; i += 2) s += `<rect y="${i * h}" width="300" height="${h}" fill="#fff"/>`;
    s += `<rect width="${5 * h}" height="${5 * h}" fill="#0D5EAF"/><rect y="${2 * h}" width="${5 * h}" height="${h}" fill="#fff"/><rect x="${2 * h}" width="${h}" height="${5 * h}" fill="#fff"/>`;
    return s;
  })(),
  se: '<rect width="300" height="200" fill="#006AA7"/><rect x="94" width="38" height="200" fill="#FECC00"/><rect y="81" width="300" height="38" fill="#FECC00"/>',
  no: '<rect width="300" height="200" fill="#BA0C2F"/><rect x="82" width="54" height="200" fill="#fff"/><rect y="73" width="300" height="54" fill="#fff"/><rect x="95" width="28" height="200" fill="#00205B"/><rect y="86" width="300" height="28" fill="#00205B"/>',
  jm: '<rect width="300" height="200" fill="#000"/><path d="M0 0 H300 L150 100Z" fill="#009B3A"/><path d="M0 200 H300 L150 100Z" fill="#009B3A"/><path d="M0 0 L300 200 M300 0 L0 200" stroke="#FED100" stroke-width="26"/>',
  za: '<rect width="300" height="100" fill="#E03C31"/><rect y="100" width="300" height="100" fill="#001489"/><path d="M0 0 L110 100 L300 100 M0 200 L110 100" stroke="#fff" stroke-width="67" fill="none"/><path d="M0 0 L110 100 L300 100 M0 200 L110 100" stroke="#007749" stroke-width="40" fill="none"/><path d="M0 40 L66 100 L0 160Z" fill="#FFB81C"/><path d="M0 58 L46 100 L0 142Z" fill="#000"/>',
  pa: '<rect width="300" height="200" fill="#fff"/><rect x="150" width="150" height="100" fill="#DA121A"/><rect y="100" width="150" height="100" fill="#072357"/>' + estrella(75, 50, 24, -90, '#072357') + estrella(225, 150, 24, -90, '#DA121A'),
  cu: (() => {
    let s = '<rect width="300" height="200" fill="#fff"/>';
    for (const i of [0, 2, 4]) s += `<rect y="${i * 40}" width="300" height="40" fill="#002A8F"/>`;
    return s + '<path d="M0 0 L150 100 L0 200Z" fill="#CF142B"/>' + estrella(50, 100, 26);
  })(),
  tr: '<rect width="300" height="200" fill="#E30A17"/><circle cx="112" cy="100" r="50" fill="#fff"/><circle cx="125" cy="100" r="40" fill="#E30A17"/>' + estrella(178, 100, 22, 180),
  ie: '<rect width="100" height="200" fill="#169B62"/><rect x="100" width="100" height="200" fill="#fff"/><rect x="200" width="100" height="200" fill="#FF883E"/>',
  ua: '<rect width="300" height="100" fill="#0057B7"/><rect y="100" width="300" height="100" fill="#FFD700"/>',
  vn: '<rect width="300" height="200" fill="#DA251D"/>' + estrella(150, 100, 62, -90, '#FFFF00'),
  ng: '<rect width="100" height="200" fill="#008751"/><rect x="100" width="100" height="200" fill="#fff"/><rect x="200" width="100" height="200" fill="#008751"/>',
});
for (const [k, cuerpo] of Object.entries(ban)) fs.writeFileSync(path.join(BAN, `${k}.svg`), svg(W, H, cuerpo));
console.log('Imágenes generadas en public/img');
