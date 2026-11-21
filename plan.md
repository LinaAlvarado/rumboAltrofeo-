# Plan: Rumbo al Trofeo
Fecha: 2026-11-20
Lee primero `spec.md`. Este plan dice CÓMO construirlo, en orden de prioridad, para tenerlo listo mañana con TODAS las cartas.

## Reglas de oro para mañana
1. Primero un juego que funcione de principio a fin. Después los mini juegos. Después el estilo.
2. **Ninguna carta se esconde.** Toda carta tiene un modo de respaldo `presencial`: se muestra en pantalla, el moderador ve el contenido en su panel y juzga. Así, si un mini juego no alcanza a quedar, la carta igual sale.
3. Si algo se complica más de 30 minutos, se usa el respaldo y se sigue con lo siguiente.
4. Las cartas visuales usan emojis, texto grande o dibujos SVG simples hechos por la IA. No se espera a tener ilustraciones.

## Decisiones técnicas

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Servidor | Node.js con Express y Socket.io | Tiempo real entre las 3 vistas con muy poco código |
| Frontend | HTML, CSS y JavaScript sin framework (o React con Vite si la IA lo maneja mejor), servido por el mismo servidor | Menos piezas, menos cosas que fallen |
| Dónde corre | En el portátil conectado al videobeam. Los celulares entran por el Wi-Fi local con la IP del portátil (ej.: `http://192.168.1.20:3000/jugar`) | No depende de internet en el salón |
| Estado | En memoria en el servidor, y se guarda en `estado.json` en cada cambio | Si el servidor se reinicia, la partida se recupera |
| Datos | `data/juego.json`, generado desde `Rumbo al Trofeo.xlsx` | Las cartas se cambian editando el Excel y volviendo a generar el JSON |
| Rutas | `/pantalla` (proyección), `/moderador` (panel, con un PIN simple), `/jugar` (celulares) | Una sola app, tres vistas |
| QR | Librería `qrcode`, apuntando a `/jugar` con la IP local | Los equipos entran escaneando |

Plan B de red: si el Wi-Fi del salón no deja que los celulares vean el portátil, se crea un punto de acceso desde el portátil o desde un celular y todos se conectan ahí. Probarlo antes de la sesión.

## Estructura de datos

`data/juego.json` sale de las pestañas del Excel:

```json
{
  "tablero": {
    "Destreza": ["Reto","Duelo","Vacía","Bonus","Reto","Penitencia","Duelo","Vacía","Reto","Reto final"]
  },
  "cartas": [
    {
      "id": "M01", "camino": "Mente", "tipo": "Reto", "nombre": "Trivia rápida",
      "instrucciones": "...", "comoSeGana": "...", "tiempo": 60,
      "material": null, "seJuegaEn": "Celular",
      "modo": "opcion_multiple", "banco": "M01"
    }
  ],
  "bancos": {
    "M01": [ { "contenido": "¿...?", "opciones": ["7","40","100","150"], "respuesta": "40", "aceptadas": [] } ]
  },
  "preguntasInicio": [
    { "pregunta": "¿Quién fue el padre de Matusalén...?", "opciones": ["Lamec","Enoc","Set","Jared"], "respuesta": "Enoc" }
  ],
  "personajes": ["p01.png"],
  "reglas": ["..."]
}
```

- `modo` NO está en el Excel: la IA lo agrega con la sección "Clasificación de cartas".
- `tipo`: Reto, Duelo, Reto final, Penitencia, Bonus, Sorpresa. Las cartas con camino "Todos" son el mazo común.
- Los bancos que faltan en el Excel se agregan con la sección "Contenido para cargar".
- Las 3 preguntas de inicio se copian del documento de definiciones.

## Modos de carta

| Modo | Qué hace la app | Quién resuelve |
| --- | --- | --- |
| `presencial` | Muestra la carta en pantalla y celular. Si tiene palabra, pista o imagen, la muestra solo en el panel del moderador | Moderador |
| `palabra_secreta` | Muestra una palabra del banco SOLO en el celular del equipo (o en el panel del moderador si la carta lo dice). Los demás adivinan en voz alta | Moderador |
| `opcion_multiple` | Pregunta y 4 opciones (o Verdadero/Falso). En duelos responden ambos y gana el más rápido correcto | Programa |
| `escribir` | El equipo escribe la respuesta. Validación del spec, con cola de casos dudosos | Programa y moderador |
| `ordenar` | Elementos desordenados para arrastrar en orden | Programa |
| `automatica` | Aplica el efecto sola | Programa |
| `eleccion` | El equipo elige algo (camino, rival, equipo con quien cambiar) y se aplica | Programa |
| `secuencia_pantalla` | Muestra en la pantalla elementos uno tras otro con tiempo (órdenes, letras, operaciones, emojis a memorizar) | Moderador |
| `especial` | Silla musical: el moderador elige el equipo ganador y recibe un bonus | Moderador |
| `sopa_letras` | Cuadrícula generada con las palabras del banco; el equipo marca palabras arrastrando | Programa |
| `ahorcado` | Casillas de la frase, teclado de letras, muñeco que se dibuja con cada error | Programa |
| `rompecabezas` | Imagen partida en 9 piezas para intercambiar tocando dos piezas | Programa |
| `mosaico` | Cuadrícula 3 x 3 de emojis que se muestra 15 s; luego el equipo elige el emoji de cada casilla | Programa |
| `concentrese` | 12 cartas (6 parejas de emojis) que se muestran 15 s y luego se voltean | Programa |

## Clasificación de cartas

**Destreza**
- `presencial`: DE01 (la IA dibuja en SVG una casa de cartas de 3 pisos y se muestra en pantalla), DE03, DE04, DE06, DE07, DE08, DE09, DE10, DE11, DE12, DE15, DE16, DE17.
- `presencial` + el programa elige al azar el equipo villano: DE02.
- `secuencia_pantalla`: DE05 (5 letras al azar de la lista de la carta), DE14 (texto grande de la pose, ver contenido), DE18 (órdenes de Simón dice).
- `escribir` número, 3 rondas: DE13 (operaciones generadas al azar, resultados entre 5 y 50).

**Mente**
- `opcion_multiple`: M01, M05, M07 (elegir las palabras faltantes), M09, M10, M13 (banderas con emojis), M14, M15.
- `presencial` con contenido en el panel del moderador: M02 (acertijos), M08 (pistas), M12 (categorías bíblicas).
- `escribir`: M04 (anagramas), M11 (operaciones generadas), M17 (lista visible 20 s, luego escriben), M18 (clave numérica, 2 intentos).
- `ordenar`: M16.
- `secuencia_pantalla` + `opcion_multiple`: M06 (10 emojis 15 s, luego desaparece uno y eligen cuál faltó).
- `sopa_letras`: M03.

**Creativo**
- `palabra_secreta` en el celular: C01, C03, C05, C06 (con sus 3 prohibidas), C07, C08, C09 (ambos equipos; el adivinador escribe), C11 (ambos equipos), C15, C16.
- `palabra_secreta` en el panel del moderador: C02.
- `presencial`: C10, C13.
- `ahorcado`: C04 (6 errores), C14 (8 errores).
- `rompecabezas`: C12 (la IA dibuja 3 escenas sencillas en SVG: el arca, David y Goliat, Jonás y el pez).

**Música**
- `presencial`: MU02, MU06, MU07, MU08, MU10.
- `especial`: MU03.
- `palabra_secreta`: MU01, MU12, MU13 (nombre de canción).
- `opcion_multiple`: MU05 (artista), MU11 y MU15 (emojis de canción).
- `escribir`: MU09, MU14 (nombre de canción).
- `ordenar`: MU04 (4 frases), MU16 (8 frases del coro).
- Todas usan el banco de canciones de la sección siguiente.

**Equipo**
- `presencial`: E01, E02, E03, E04, E05, E06, E08, E09, E10, E11.
- `presencial` con frase en el panel del moderador: E07.
- `presencial` con dibujo en el panel del moderador: E12 (la IA dibuja 4 figuras simples en SVG: casa, árbol con sol, barco, cara feliz).
- `secuencia_pantalla`: E13 (escena de 6 emojis ubicados en la pantalla por 10 s), E15 (acciones).
- `mosaico`: E14.
- `concentrese`: E16.

**Mazo común**
- `automatica`: P04, P06, P08, P09, P10, P12, B01, B02, B03, B04, B05, S02, S03, S06.
- `presencial` (el moderador marca Cumplida / No cumplida): P01, P02, P03, P05, P07, P11.
- `eleccion`: S01, S04, S05.

## Contenido para cargar

Ya está en el Excel: bancos de Mente, Creativo, Equipo, las preguntas y frases. Lo siguiente se agrega al JSON:

- **Personajes:** recortar 10 personajes de la imagen de pixel art y guardarlos como `public/personajes/p01.png` a `p10.png`.
- **Canciones (Lina las escribe):** para cada canción de la playlist: nombre, artista, emojis (Claude los propone con la lista de nombres), 4 frases seguidas y las 8 frases del coro.
- **DE18 Simón dice:** Simón dice manos arriba · Toquen el piso · Simón dice salten · Siéntense · Simón dice toquen su nariz · Aplaudan · Simón dice den una vuelta · Simón dice manos a la cabeza · Levanten un pie · Simón dice abrazo de grupo · Agáchense · Simón dice toquen algo azul.
- **E15 Acciones:** aplaudir · tocarse la cabeza · saltar · girar · agacharse · levantar los brazos · tocarse los hombros · zapatear · chasquear los dedos · cruzar los brazos · tocarse las rodillas · señalar el techo.
- **DE14 Poses (texto en pantalla):** Pirámide humana sentada · La ola · Foto oficial de equipo de fútbol · Selfie grupal exagerada · Estatuas de superhéroes · Foto de graduación.
- **M06 Objetos:** 🚢 Arca · 📜 Tablas de la ley · 🔥 Zarza ardiente · 🐟 Pez · 🍞 Pan · 👑 Corona · 🪜 Escalera · 🕊️ Paloma · ⭐ Estrella · 🐑 Oveja · 🦁 León · 🐍 Serpiente.
- **E13 Escenas de 6 emojis:** 🚢 🕊️ 🌈 ☀️ 🦒 🌳 · 🧒 🪨 🧔 ⛰️ 🐑 ☁️ · 🐋 🧔 🌊 ⛵ 🌙 ⭐.
- **E14 y E16 Emojis:** 🚢 🕊️ 🐟 👑 ⭐ 🐑 🍞 🔥 🦁 🐍 🌈 📜.
- **M13 Banderas:** 🇨🇴 Colombia · 🇲🇽 México · 🇦🇷 Argentina · 🇧🇷 Brasil · 🇪🇸 España · 🇮🇱 Israel · 🇯🇵 Japón · 🇫🇷 Francia · 🇮🇹 Italia · 🇺🇸 Estados Unidos.
- **M12 Categorías bíblicas:** libros del Antiguo Testamento · los 12 apóstoles · mujeres de la Biblia · animales que aparecen en la Biblia · ciudades bíblicas · profetas · reyes de Israel.

## Fases de construcción

Cada fase termina con una prueba. No se pasa a la siguiente sin que la anterior funcione. Tiempo total estimado: 11 a 13 horas.

### Fase 0. Preparación (30 min)
1. Proyecto Node con Express y Socket.io.
2. Script `npm run datos` que lee `Rumbo al Trofeo.xlsx`, agrega los modos y el contenido de arriba, y genera `data/juego.json`.
3. Prueba: el JSON tiene 107 cartas, 6 caminos de 10 casillas y todos los bancos.

### Fase 1. Lobby y conexión (1 h)
1. Las 3 rutas con una pantalla básica.
2. QR y código en `/pantalla`.
3. En `/jugar`: nombre del equipo y personaje (10, sin repetir).
4. Fichas en `/pantalla`; lista de equipos y botón Iniciar en `/moderador`.
5. Reconexión al recargar.
6. Prueba: 3 celulares entran, recargan y siguen en su equipo.

### Fase 2. Inicio de partida (1 h)
1. Instructivo de 4 a 5 pantallas que avanza el moderador.
2. Pregunta de inicio con colores e íconos, desempates y orden por velocidad.
3. Elección de camino antes del primer turno.
4. Prueba: el orden de turnos sale bien con 3 celulares.

### Fase 3. Núcleo del juego (2 h 30 min)
1. Tablero con 6 caminos de 10 casillas y el trofeo al centro.
2. Turnos, dado de 3 caras, movimiento con tope en la casilla 10.
3. Las 4 cartas boca abajo para elegir. Modos `presencial` y `automatica`, y casilla Vacía.
4. Moderador: Ganaron, Perdieron, Se quedan, temporizador en pantalla.
5. Retroceder, bonus guardados, reto final, trofeo, pantalla final, Terminar partida.
6. Guardado en `estado.json` y recuperación.
7. **Respaldo:** todas las cartas cuyo modo aún no exista se juegan como `presencial`.
8. Prueba: una partida completa de principio a fin. **Desde aquí todas las cartas ya salen.**

### Fase 4. Cartas en el celular (2 h)
1. Duelos con elección de rival y "¡Te retaron!".
2. `opcion_multiple`, `palabra_secreta`, `escribir` (con validación y casos dudosos), `ordenar`, `eleccion`.
3. Prueba: una carta de cada modo.

### Fase 5. Moderador completo (45 min)
1. Mover fichas, saltar y repetir turno, jugar el turno desde el panel si un celular falla.
2. `especial` (Silla musical) y villano al azar.

### Fase 6. Mini juegos (2 h 30 min)
En este orden, del más fácil al más difícil:
1. `secuencia_pantalla` (20 min)
2. `ahorcado` (30 min)
3. `mosaico` (25 min)
4. `concentrese` (30 min)
5. `rompecabezas` (25 min)
6. `sopa_letras` (30 min)
7. Prueba: jugar cada mini juego una vez. Si alguno falla, su carta sigue saliendo en modo `presencial`.

### Fase 7. Estilo (1 h 30 min)
1. Estilo de `referencia-estilo.png`: fondo morado oscuro, neón, botones con relieve, insignias hexagonales, texto tipo arcade.
2. Animaciones: dado, volteo de cartas, ficha que avanza, celebración final.
3. Todo legible desde el fondo del salón.

### Ensayo general (obligatorio, 45 min antes de la sesión)
1. Portátil conectado al videobeam y al Wi-Fi del salón.
2. 4 celulares reales, 3 turnos de cada tipo de casilla.
3. Recargar un celular y la pantalla a mitad de partida.
4. Probar el plan B de red.

## Mensaje para empezar con la IA

Copia esto en la IA de código junto con `spec.md`, `plan.md`, `Rumbo al Trofeo.xlsx` y `referencia-estilo.png`:

> Vamos a construir "Rumbo al Trofeo" para usarlo mañana. Lee spec.md (qué hace) y plan.md (cómo se construye). Trabaja fase por fase en el orden del plan. Al terminar cada fase, dime cómo probarla y espera mi confirmación antes de seguir. No agregues funcionalidades que no estén en el spec. Respeta las reglas de oro: ninguna carta se esconde, y si algo se complica, la carta usa el modo presencial. Empieza por la Fase 0.
