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
node scripts/bajar-fuentes.mjs               # fuentes autoalojadas (una vez)
node scripts/sembrar.mjs                     # contenido de arranque
ADMIN_PASSWORD=loquesea node server.js       # http://127.0.0.1:3101
```

El frente público está en `src/web/` y se genera con
`node scripts/importar-web.mjs <carpeta web/ del diseño>`: copia solo lo que
publican las páginas y les agrega `?v=` a los CSS y JS.

## Tests

Ninguno necesita internet; los que levantan el router usan un puerto libre de
127.0.0.1 y una base descartable.

```bash
node scripts/test-portero.mjs        # sitio cerrado: quién pasa y quién ve el cartel
node scripts/test-web-nueva.mjs      # páginas, archivos publicados, Próximamente y redirecciones
node scripts/test-cielo-portada.mjs  # el cielo de hoy y la línea de tiempo, con reloj fijo
node scripts/test-suscripcion.mjs    # la suscripción mensual y /privacidad
node scripts/test-cielo.mjs          # cálculos derivados
node scripts/test-efemerides.mjs     # el motor, cruzado contra astronomy-engine
node scripts/test-geo.mjs            # ciudades y zona horaria histórica
```

## Las piezas que importan

- **`src/lib/efemerides.js`**: la única fuente de posiciones planetarias.
  Swiss Ephemeris 2.10.03 en WebAssembly, con los archivos DE441.
- **`src/lib/cielo.js`**: cálculos derivados (elementos, modalidades, tensión).
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
- Las fuentes tipográficas de `src/estatico/fuentes/` conservan la licencia de
  sus autores (SIL Open Font License).
