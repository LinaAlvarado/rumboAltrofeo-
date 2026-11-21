# Spec: Rumbo al Trofeo
Fecha: 2026-11-20

## Overview
Rumbo al Trofeo es un juego híbrido para dinámicas presenciales con jóvenes de 14 a 24 años. Un tablero se proyecta en la pared y cada equipo juega desde un celular: tira el dado, elige cartas y responde trivias. Los retos se hacen en persona dentro del salón. Un moderador dirige la partida y juzga los resultados. Gana el primer equipo que llega al trofeo, en el centro del tablero.

## Usuarios objetivo
- **Moderador:** la persona que dirige la dinámica. Hoy organiza los juegos a mano, sin una forma de llevar el puntaje ni de mostrarlo a todos.
- **Equipos:** de 4 a 6 grupos de jóvenes, cada uno con un celular. Ven el tablero en la pared y juegan su turno desde el celular.
- **Público:** todos los presentes miran la pantalla proyectada.

## Alcance

### La v1 SÍ hace
1. **Tres vistas sincronizadas en tiempo real:** pantalla de proyección, panel del moderador y celular de cada equipo.
2. **La partida completa:** lobby, instructivo, pregunta para decidir quién empieza, elección de camino, turnos con dado, cartas, resultados y pantalla final.
3. **Todos los tipos de casilla:** reto, duelo, penitencia, bonus, sorpresa, vacía y reto final, con las cartas del archivo de datos.
4. **Controles del moderador:** juzgar, temporizador, mover fichas a mano, saltar turno, terminar la partida y decidir respuestas dudosas.

### La v1 NO hace
- Editor de cartas ni de preguntas dentro de la app. Las cartas se cambian editando el archivo de datos.
- Cuentas, contraseñas ni registro de usuarios.
- Guardar el historial de partidas o estadísticas.
- Varias partidas al mismo tiempo. Hay una sola partida activa.
- Reproducir música. El moderador pone la playlist por fuera de la app.
- Esconder cartas. Todas las cartas del mazo salen en el juego. Si a una carta le falta su versión digital o su contenido, se juega en modo presencial: la carta se muestra, el moderador ve el contenido en su panel y juzga.

## Comportamiento esperado

### 1. Lobby
- La pantalla de proyección muestra el nombre del juego y un código QR con un código corto para entrar.
- Cada equipo escanea el QR, escribe el nombre del equipo y elige un personaje entre 10 opciones. Un personaje ya elegido no se puede repetir.
- A medida que entran, las fichas de los equipos aparecen en la pantalla.
- Los celulares quedan en espera con el mensaje "Esperando a que inicie el juego".
- El moderador ve la lista de equipos conectados y el botón para iniciar. Se necesitan mínimo 2 equipos y máximo 6.

### 2. Instructivo
- El moderador avanza una presentación corta en la pantalla: cómo se juega, los tipos de casilla y un ejemplo de lo que se ve en el celular.
- Los celulares siguen en el lobby.

### 3. ¿Quién empieza?
- La pantalla muestra "¡Veamos quién empieza el juego!" con una pregunta y 4 opciones, cada una con un color y un ícono.
- En cada celular aparece "Selecciona la respuesta correcta" con solo los 4 colores e íconos, sin texto.
- Empieza el equipo que acierte más rápido. El orden de turnos sale de ahí: primero los que acertaron, del más rápido al más lento, y al final los que fallaron, también por velocidad.
- Si nadie acierta, sale la pregunta de desempate 2, y si tampoco, la 3. Si sigue sin ganador, el orden se sortea.
- La pantalla muestra el orden de turnos resultante.

### 4. Elección de camino
- Antes de su primer turno, cada equipo elige en su celular uno de los 5 caminos: Destreza, Mente, Creativo, Música o Equipo. Dos equipos pueden compartir camino.
- La elección se ve en la pantalla y la ficha se coloca al inicio de ese camino.

### 5. Turno
- En todas las pantallas sale "Turno: [nombre del equipo]".
- En el celular de ese equipo aparece un dado animado de 3 caras. Lo tocan y sale 1, 2 o 3.
- El celular dice "Avanzaste X casillas" y en la pantalla la ficha se mueve sola.
- Si el dado los pasa de la casilla 10, se quedan en la 10.
- Según la casilla donde caen, pasa lo de la tabla siguiente.
- El resultado sale en la pantalla y en el celular del equipo.
- Luego sale "Siguiente turno: [equipo]" y se repite.

### 6. Qué pasa en cada casilla

| Casilla | Qué ve el equipo | Quién resuelve | Resultado |
| --- | --- | --- | --- |
| Reto | "Caíste en RETO" y 4 cartas boca abajo animadas. Tocan una y se voltea. La misma carta sale en la pantalla | El moderador, o el programa si la carta se responde en el celular | Ganan: se quedan. Pierden: retroceden 1 |
| Duelo | Eligen contra qué equipo juegan. Al otro le sale "¡Te retaron!" | El moderador marca quién ganó, o el programa si se responde en el celular | El que pierde retrocede 1 |
| Penitencia | Sale la carta | El moderador marca si la cumplieron, o el programa la aplica si es automática | Si no la cumplen, retroceden 1 |
| Bonus o sorpresa | Sale la carta. Si implica elegir (a qué camino pasarse, con quién cambiar), eligen en el celular | El programa la aplica | Según la carta |
| Vacía | "Descansa" | Nadie | Pasa al siguiente turno |
| Reto final (casilla 10) | Igual que un reto | Igual que un reto | Si ganan, llegan al trofeo. Si pierden, se quedan en la 10 y lo intentan en su siguiente turno |

- Las cartas salen al azar del mazo del camino del equipo.
- Bonus, sorpresas y penitencias salen de un mazo común para todos los caminos.
- Una carta que ya salió no se repite en la misma partida mientras queden otras del mismo tipo.
- **Temporizador:** cuando una carta tiene tiempo, el moderador lo inicia cuando el equipo está listo, y se ve grande en la pantalla. Al llegar a cero suena un aviso.
- **Carta especial Silla musical:** juegan todos los equipos. El equipo que gane recibe una carta de bonus al azar, y nadie retrocede.
- **Mini juegos en el celular:** sopa de letras, ahorcado, rompecabezas, mosaico de memoria y concéntrese se juegan dentro de la app, con su pantalla propia.
- **Cartas visuales:** las cartas que muestran imágenes (objetos, poses, escenas, banderas, íconos) usan emojis o texto grande, para que funcionen sin ilustraciones.
- **Bonus guardados:** el Escudo y otros bonus que se guardan se ven junto a la ficha del equipo hasta que se usan.

### 7. Respuestas escritas en el celular
Cuando una carta pide escribir texto libre, el programa la valida así:
1. Ignora mayúsculas, tildes, espacios de más y artículos (el, la, los, de).
2. Acepta las respuestas alternativas que tenga la carta en el archivo de datos.
3. Acepta errores de escritura de 1 o 2 letras.
4. Si no pasa pero se parece, la respuesta le aparece al moderador con los botones Aceptar o Rechazar. La hora exacta en que el equipo respondió se respeta para decidir quién fue primero.

### 8. Panel del moderador
- Ve el estado de la partida, de quién es el turno y la carta actual con su respuesta correcta.
- Botones para juzgar: **Ganaron**, **Perdieron** y **Se quedan** (por si hubo un error).
- Inicia, pausa y reinicia el temporizador.
- Puede mover cualquier ficha a mano, saltar un turno, repetir un turno y terminar la partida.
- Aceptar o rechazar respuestas dudosas.
- Si un celular deja de funcionar, puede jugar el turno de ese equipo desde su panel: tirar el dado y elegir por ellos.

### 9. Final
- Cuando un equipo gana el reto final, o el moderador termina la partida, sale una pantalla de celebración con el ganador y la tabla de posiciones.
- Si el moderador termina la partida antes, gana el equipo más cerca del trofeo. Si hay empate, la pantalla lo indica para que el moderador lo decida con un duelo.

### 10. Estilo visual
Estilo de videojuego arcade: fondo oscuro morado con brillos neón, botones grandes con relieve (verde, morado, naranja), insignias hexagonales, barras de progreso y textos grandes tipo "GAME OVER". El tablero tiene profundidad, con casillas iluminadas por color según su tipo. Los personajes son pixel art. La referencia está en `referencia-estilo.png`. Todo debe leerse bien proyectado en una pared desde el fondo del salón.

## Errores y seguridad
- **Un celular se desconecta:** el equipo vuelve a entrar con el mismo código y recupera su lugar, su ficha y sus bonus.
- **La pantalla de proyección se recarga:** vuelve a mostrar la partida tal como estaba.
- **Dos equipos eligen el mismo personaje al mismo tiempo:** gana el primero y al otro le sale que ya está tomado.
- **Un equipo toca dos veces el dado o elige dos cartas:** solo cuenta la primera acción.
- **Alguien entra con el código cuando ya empezó la partida:** puede ver el tablero, pero no unirse como equipo nuevo.
- **No hay cartas disponibles de un tipo:** el programa usa una carta de otro camino del mismo tipo.
- **El moderador se equivoca al juzgar:** puede corregirlo moviendo la ficha a mano.
- **Seguridad:** solo el panel del moderador puede juzgar, mover fichas y ver las respuestas correctas. Los celulares de los equipos nunca reciben la respuesta correcta antes de responder.

## Éxito
- Se juega una partida completa de 4 a 6 equipos, de 7:15 a 8:30, sin que el moderador tenga que reiniciar la app.
- Cada equipo logra entrar desde su celular en menos de 1 minuto.
- Cuando un equipo tira el dado o elige una carta, la pantalla proyectada lo muestra en menos de 1 segundo.
- Al final hay un ganador claro en pantalla.

## V2
- Editor de cartas y preguntas dentro del panel del moderador.
- Marcar materiales disponibles antes de la sesión para que el juego excluya solo las cartas que no se pueden jugar.
- Reemplazar los emojis de las cartas visuales por ilustraciones propias.
- Reproducir la música desde la app.
- Historial de partidas y estadísticas.
- Varias partidas al mismo tiempo con salas distintas.
