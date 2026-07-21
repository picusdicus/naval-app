# Handoff — Rediseño "La Gaceta" (naval-app)

Documento de continuidad para arrancar un nuevo chat. Resume el **plan completo
de la feature**, lo ya hecho (Fases 0 y 1) y **la siguiente tarea** (Fase 2).

---

## Qué es esta feature

Migrar la UI de "En Navalcarnero" del sistema **"Civic Hearth"** (Material 3
verde/pergamino, LEGADO) al sistema **"La Gaceta"**: identidad editorial cálida
—serif expresiva (DM Serif Display), cuerpo Spectral, metadatos IBM Plex Mono,
acento **terracota `#b0472f`**, carteles con degradado + trama diagonal, estética
"impresa" en móvil y tarjetas redondeadas en escritorio—.

Es un **reskin incremental por fases**: cambia la capa visual y algún
refinamiento de interacción; **la lógica y el flujo de datos (Neon/Blob/JSON) no
se tocan**.

**Referencia de diseño viva:** `reference/gaceta/DESIGN.md` (tokens, tipografía,
componentes base, decisiones). ⚠️ `reference/` está **gitignorado** por convención
del repo, así que ese archivo vive solo en local — es la fuente de verdad del
sistema, léelo antes de tocar nada visual.

**Plan original completo:** `C:\Users\daniel.molino\.claude\plans\adjunto-readme-md-e-inicio-m-vil-dc-html-rippling-possum.md`

---

## Estado por fases

| Fase | Alcance | Estado | Rama / PR |
| --- | --- | --- | --- |
| 0 | Tokens, tipografía, animaciones, componentes base | ✅ hecho | `feature/redesign-gaceta-fase-0-foundation` · PR #2 |
| 1 | Público móvil (Inicio, Eventos, Comercios, Ficha, Noticias, Transporte, Asistente) + chrome/avisos/PWA | ✅ hecho | `feature/redesign-gaceta-fase-1-movil` · PR #3 |
| **2** | **Desktop público (Inicio "web cultural", mockup 4a) + Footer** | **⏭ SIGUIENTE** | — |
| 3 | Panel de organización (`/login`, `/registro`, `/panel`) | pendiente | — |
| 4 | Integraciones de modales de destacado | pendiente | — |
| 5 | Panel superadmin (`/admin`) | pendiente | — |
| 6 | Limpieza: borrar Civic Hearth + clases muertas | pendiente | — |

**Flujo de ramas (importante):** cada fase → su propia rama `feature/redesign-gaceta-fase-N-*` → **PR contra `develop`**. **NUNCA mergear a `main`** hasta que TODO el rediseño esté cerrado; entonces `develop` → `main`. Los PRs quedan abiertos a la espera de revisión; no se mergean solos.

---

## Fase 0 — fundación (hecho)

- `tailwind.config.js`: paleta Gaceta (`papel`, `tinta`, `terracota`, `ocre`,
  `oro`, `naranja`, `verde`, `filete`, `pardo`, `mudo`…), familias
  `font-serif-dm` / `font-serif-spectral` / `font-mono-ibm` / `font-logo`
  (Archivo Black, solo logo), escala (`text-hero-movil`, `text-hero-desktop`,
  `text-seccion`), sombras (`shadow-cartel`). Civic Hearth marcado `LEGADO`.
- `index.html`: Google Fonts nuevas + las legadas.
- `src/index.css`: keyframes `omRise/omFade/omSlide` (con guard de
  `prefers-reduced-motion`), tramas `.gz-trama` / `.gz-trama-clara`, foco visible
  terracota global (`:focus-visible`), y **componentes base `.gz-*`**
  (`gz-boton-tinta/-borde/-peligro/-pill`, `gz-tarjeta-impresa/-suave`,
  `gz-input/-suave/-bloqueado`, `gz-eyebrow`, `gz-label`, `gz-badge-oro/-verde/-error`,
  `gz-filete-doble`).
- `src/lib/gaceta.js`: `cartelDe(categoria)` → `{ fondo, trama }` (gradiente de
  cartel como fallback cuando un evento no tiene `imagen_url`).

## Fase 1 — público móvil (hecho)

- **Componente nuevo:** `src/components/Logo.jsx` (marca apilada, prop
  `sobre="claro|oscuro"`, prop `tamano`).
- **Chrome:** `Header`, `NavBar` (inferior), `MenuDrawer`, `Layout` (fondo papel).
- **Pantallas:** `Inicio` (rama móvil `md:hidden` Gaceta; rama escritorio
  `hidden md:block` **intacta a propósito** para Fase 2), `Eventos` (agenda por
  día), `Mapa`/Comercios (accordion; Leaflet intacto), `EventoDetalle`.
- **Sin mockup, migradas por coherencia:** `Noticias` + `NoticiaDetalle`,
  `Transporte`, `Asistente` + `AsistenteChat` + `AsistenteChatPanel`.
- **Compartidos:** `TarjetaDestacado`, `EventoFila`, `ComercioCard`,
  `ComercioDetalle`, `FiltrosCategoria`.
- **Avisos/PWA:** `CentroAvisos`, `DialogoBandeja`, `DialogoAvisos`,
  `InstallPrompt`, `OfflineIndicator`, `AccessScreen`, `CookieBanner`
  (cambiado a `localStorage` → no reaparece cada sesión).

**Decisiones de Fase 1 (respétalas):**
- El hero fotográfico móvil se sustituyó por el masthead editorial (fecha +
  clima + doble filete); la foto de Plaza de Segovia se queda en escritorio.
- Eventos abandona el "hero del primer próximo": siempre agenda por día; el
  realce lo da el carrusel de destacados.
- Ficha de evento: el título se superpone al cartel SOLO si no hay póster real;
  con imagen va debajo (no duplicarlo sobre un cartel que ya lo lleva).
- Avisos "Del municipio" en Inicio siguen siendo **estáticos** (no hay fuente de
  datos); reestilizados, no cableados a `noticias.json`.

---

## SIGUIENTE TAREA — Fase 2: desktop público

**Objetivo:** recomponer el **Inicio de escritorio** como "web cultural del
pueblo" (mockup `4a` del README de diseño) en lenguaje Gaceta, y migrar el
**Footer**. Con esto el público (móvil + escritorio) queda 100% Gaceta.

**Arranque sugerido:**
1. Crear rama desde `feature/redesign-gaceta-fase-1-movil` (o desde `develop` si
   la Fase 1 ya se mergeó): `feature/redesign-gaceta-fase-2-desktop`.
2. Leer `reference/gaceta/DESIGN.md` y la sección "5. Inicio · Desktop (4a)" del
   README de diseño original (tokens ya traducidos ahí).

**Trabajo concreto:**
- `src/pages/Inicio.jsx` → reescribir la rama `hidden md:block` (hoy sigue en
  Civic Hearth): nav sticky ya es Gaceta (Header), pero el cuerpo necesita:
  - **Carrusel inmersivo** de destacados full-bleed (`border-radius 24px`,
    `min-height 440px`, degradado + trama, badge pill + título enorme DM Serif
    itálica 62–92px, 2 botones pill, meta a la derecha). Nuevo componente
    sugerido: `src/components/destacados/CarruselDesktopInmersivo.jsx`
    (reutiliza `useDestacados` y la forma `tarjeta`; ver `CarruselDestacados` y
    `TarjetaDestacado` actuales — la tarjeta móvil ya es Gaceta pero el hero
    inmersivo de escritorio es otra composición).
  - **"Agenda de la semana"**: grid de 4 tarjetas de póster `3/4` redondeadas
    con sombra (`gz-tarjeta-suave` / `shadow-cartel`).
  - **Banda de comercios** (fondo `papel-calido`, grid 3 tarjetas con avatar-inicial).
  - **"Estado del municipio"**: 2 avisos (hoy hardcodeados, mantener) +
    tarjeta de clima (`useWeather`, hoy en `verde-bosque`).
  - **Footer** (`src/components/layout/Footer.jsx`, hoy `hidden md:block` en
    Civic Hearth): migrar a Gaceta.
- **NO tocar** la rama `md:hidden` (móvil, ya Gaceta).

**Verificación Fase 2:** `npm run build`, capturas a 1360px, accesibilidad
(foco, `prefers-reduced-motion`, contraste). No requiere e2e (no toca
Comercios/eventos/superadmin), pero re-correrlo no daña.

---

## Gotchas y convenciones (leer antes de tocar)

- **Opción B para componentes base:** móvil (impreso, recto, `border-tinta`) y
  desktop (redondeado, sombra) son **variantes con clases fijas**, no una prop de
  breakpoint. Pueden compartir archivo si el JSX es idéntico salvo clases.
- **NO crear tokens `vino` ni `crema`:** hay clases muertas (`text-vino`,
  `bg-crema-dark`) de una paleta anterior; definir esos nombres las reactivaría.
- **Carteles:** imagen real (`imagen_url`) sustituye la trama cuando existe;
  usar `cartelDe()` de `src/lib/gaceta.js` para el fallback. Los comercios **no
  tienen campo de imagen** → siempre color de categoría + icono.
- **Formas de datos que NO deben romperse:** evento (`id, titulo, fecha, hora,
  horaFin, lugar, categoria, origen, descripcion, imagen, fuente, entradas`),
  comercio (`id, nombre, categoria, cocina, lat, lng, direccion, telefono, web,
  horario, rating, totalReviews, precioNivel` — `web`, no `url`; `totalReviews`,
  no `reviews`), tarjeta destacado (`to, titulo, badge, imagen, imagenPos,
  colorCategoria, simbolo, lineas[{icono,texto}], item`). Props de
  `CarruselDestacados` (`items, tamano, columnas, soloCarrusel, onItemClick,
  seccion, visibles`) y `TarjetaDestacado` (`destacado, tamano, onClick, seccion`).
- **e2e (`npm run test:e2e`) y el rate-limit del login:** `api/login.js` y
  `api/admin/login.js` limitan a **5 intentos / 15 min por IP+email**
  (`_ratelimit.js`, falla-abierto sin Upstash). La suite completa hace más
  logins, así que si `.env.local` tiene `KV_REST_API_URL/TOKEN` (de un
  `vercel env pull`), los tests fallan en cascada con **429** (no es regresión
  del rediseño — todos los fallos son en login de `/panel` y `/admin`). Para una
  corrida verde: comentar temporalmente esas dos vars en `.env.local`, o correr
  los specs de uno en uno. **La Fase 1 no tiene e2e propios** (los specs son de
  panel/superadmin); su validación es visual.
- **Capturas de verificación:** arrancar `npm run dev -- --port <libre>
  --strictPort`, pasar el gate con `POST /api/acceso` (`APP_ACCESO_PASSWORD` de
  `.env.local`), Playwright ya es dependencia. `waitUntil: 'domcontentloaded'`
  (con `networkidle` no estabiliza por el polling de clima). Ojo: los links de
  `<dialog>` cerrados (bandeja de avisos) matchean `a[href^="/eventos/"]` → acota
  a `main`.

---

## Pendiente al cerrar esta sesión

- **PR #3** (Fase 1) abierto contra `develop`, a la espera de revisión/merge.
- **e2e en verde**: relanzar tras desbloquear el rate-limit del login (ver arriba).
  Los 15 fallos actuales son todos 429 de login, ninguno de Fase 1.
- Este archivo (`HANDOFF_REDISEÑO_GACETA.md`) está **sin commitear** — es un
  doc de trabajo; commitéalo, muévelo o bórralo según convenga.
