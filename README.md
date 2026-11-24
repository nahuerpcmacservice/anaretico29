# Anaretico 29

Código fuente del sitio **anaretico29.com**: astrología financiera, mundial y
empresarial.

Se publica para cumplir la licencia **AGPL-3.0-or-later** de Swiss Ephemeris,
el motor de cálculo astronómico que usa el sitio (ver [Licencias](#licencias)).

## Cómo corre

Node ≥ 22, ESM, Express 5 + SQLite (`better-sqlite3`). El HTML se sirve desde el
servidor, sin paso de build.

```bash
npm install
node scripts/importar-ciudades.mjs --apply   # padrón de ciudades (una vez)
node scripts/bajar-fuentes.mjs               # fuentes del panel y del cartel (una vez)
node scripts/bajar-fuentes-web.mjs           # fuentes de la web nueva (una vez; quedan en src/web/assets/fuentes/)
node scripts/sembrar.mjs                     # contenido de arranque
ADMIN_PASSWORD=loquesea node server.js       # http://127.0.0.1:3101
```

El frente público está en `src/web/` y se genera con
`node scripts/importar-web.mjs <carpeta web/ del diseño>`: copia solo lo que
publican las páginas y les agrega `?v=` a los CSS y JS.

El sitio no junta datos de los visitantes: no hay suscripción por mail ni
formularios que guarden algo, y las fuentes se sirven desde el propio sitio
(el navegador no le pide nada a Google Fonts).

### La carta natal y la carta del momento (`/carta`)

- La calcula el servidor (`src/lib/carta.js`) y la pantalla la dibuja.
  `POST /api/carta` con `{ "fecha": "AAAA-MM-DD", "hora": "HH:MM", "lugar": "Ciudad, país" }`
  en JSON devuelve la carta natal; `GET /api/carta/momento`, la del momento
  (Buenos Aires, el minuto en curso; se puede cachear hasta que termina ese
  minuto). Los errores vuelven con 400 y `{ "campo", "mensaje" }`; **sin hora
  no hay carta**.
- Los datos de nacimiento **no viajan en ninguna dirección que llegue al
  servidor**: el formulario de la portada lleva a `/carta#fecha=…&hora=…&lugar=…`
  (lo que va después del `#` no se manda) y la página pide la carta por POST.
  La respuesta sale con `cache-control: no-store`; nada se guarda ni se
  registra. Contra los robots hay un freno en memoria por huella con sal de la
  IP (la IP no se guarda).
- Criterios: tropical, Placidus, casa por intervalos entre cúspides, balance
  de 50 puntos, aspectos solo entre los diez planetas con orbes 8/8/6/6/4
  (`src/lib/criterios.js`).
- **«Descargar mi carta en PDF»** usa la impresión del navegador (hoja
  `@media print`); no hay servicios de terceros.
- **Límite**: 2 cartas natales cada 7 días por navegador, contadas en el
  navegador (`localStorage`, ventana corrida de 7 días; volver a calcular los
  mismos datos no cuenta otra vez). La carta del momento no tiene límite.

## Tests

Ninguno necesita internet; los que levantan el router usan un puerto libre de
127.0.0.1 y una base descartable.

```bash
node scripts/test-portero.mjs        # sitio cerrado: quién pasa y quién ve el cartel
node scripts/test-web-nueva.mjs      # páginas, archivos publicados, Próximamente y redirecciones
node scripts/test-cielo-portada.mjs  # el cielo de hoy y la línea de tiempo, con reloj fijo
node scripts/test-suscripcion.mjs    # sin datos de visitantes: no hay suscripción ni /privacidad
node scripts/test-criterios.mjs      # criterios de cálculo (pesos, orbes, tensión) y la portada
node scripts/test-cielo.mjs          # cálculos derivados
node scripts/test-efemerides.mjs     # el motor, cruzado contra astronomy-engine
node scripts/test-geo.mjs            # ciudades y zona horaria histórica
node scripts/test-carta.mjs          # la carta: referencias, orbes, casas, balance, API, pantalla, PDF y límite
```

## Las piezas que importan

- **`src/lib/efemerides.js`**: la única fuente de posiciones planetarias.
  Swiss Ephemeris 2.10.03 en WebAssembly, con los archivos DE441.
- **`src/lib/criterios.js`**: los criterios de cálculo de Anaretico 29 en un
  solo lugar (pesos del balance de 50 y de 36 puntos, orbes, tensión,
  dominante y empates, aplicativo/separativo).
- **`src/lib/cielo.js`**: cálculos derivados (elementos, modalidades, tensión).
- **`src/lib/carta.js`**: la carta natal y la del momento, en el JSON que lee
  la pantalla (`window.A29Carta`).
- **`src/lib/geo.js`**: ciudad → coordenadas y huso horario vigente en la
  fecha. Todo local: los datos de nacimiento no salen a ningún tercero.

## Licencias

- **Código** (todo lo que es programa: `server.js`, `src/**/*.js`, `scripts/`,
  y el HTML, CSS y JavaScript de `src/web/` en tanto código): **AGPL-3.0-or-later**,
  ver [`LICENSE`](LICENSE). Swiss Ephemeris es © Astrodienst AG y se usa bajo
  esa misma licencia.
- **Contenidos**: los textos, fotografías, imágenes, ilustraciones, videos, el
  logo y la marca «Anaretico 29» son © Fernando Javier Pérez, **todos los
  derechos reservados**. No están incluidos en la AGPL y no pueden reutilizarse
  sin su autorización.
- Las fuentes tipográficas de `src/estatico/fuentes/` y `src/web/assets/fuentes/`
  conservan la licencia de sus autores (SIL Open Font License 1.1; el texto de
  cada una está en `src/web/assets/fuentes/OFL-*.txt`).
