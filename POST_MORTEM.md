# Post-mortem — En Navalcarnero

> **Retrospectiva de proyecto** (no de un incidente concreto). Cubre la
> construcción de la app desde el commit inicial hasta la fase Destacados.
> Objetivo: dejar por escrito qué se hizo, qué salió bien, qué costó más de lo
> previsto y qué acciones concretas quedan pendientes. Redactado el 17-07-2026.

## Ficha del proyecto

| Dato | Valor |
| --- | --- |
| Periodo | 2026-07-07 → 2026-07-17 (10 días) |
| Commits | 86 |
| Código | ~8.800 líneas `src/`, ~3.300 `api/`, ~600 e2e |
| Componentes React | 53 `.jsx` |
| Endpoints API | 21 (+ 6 módulos `_*` compartidos) |
| Tablas Neon | 6 (organizaciones, codigos_invitacion, usuarios, eventos_usuario, analytics, destacados) |
| Ramas | ~30 (la mayoría de feature, muchas ya obsoletas) |
| Stack | Vite + React 18 + Tailwind v3 · Vercel (Edge + Serverless) · Neon Postgres · Vercel Blob · Anthropic SDK |

## Línea temporal (por hitos, leída del historial de git)

1. **Base pública** — agenda de eventos, guía de comercios con Leaflet,
   noticias, transporte (buses CRTM), asistente IA. Datos en JSON estático.
2. **PWA** — manifest, service worker, install prompt, página offline.
3. **Candado de acceso** — pantalla de contraseña para vecinos.
4. **Sincronización automática de eventos** — Vercel Cron + GitHub API
   (reescrito varias veces por el EROFS de Vercel: `2c904e5`, `7da415e`).
5. **Base de datos y gestión** — esquema Neon, auth con JWT httpOnly, CRUD de
   eventos, subida de carteles a Blob.
6. **Migración a Edge Runtime + WebCrypto** — el episodio más costoso (ver
   abajo).
7. **Multi-tenant** — registro con códigos de invitación, panel de
   organización, superadmin, analíticas (Umami + propias).
8. **Destacados** — producto de pago en 4 fases, autoservicio desde `/panel`.

## Qué salió bien

- **Arquitectura de datos coherente y bien documentada.** `CLAUDE.md` es
  excepcionalmente detallado: decisiones, gotchas y trade-offs quedaron
  escritos *en el momento*, no reconstruidos después. Es la razón por la que
  el proyecto es mantenible pese a la velocidad.
- **Seguridad multi-tenant sólida desde el diseño.** El slug de organización
  siempre sale del JWT firmado, nunca del request: aislar por diseño en vez de
  por comprobaciones dispersas evitó toda una clase de fugas.
- **SQL parametrizado en el 100 % de los endpoints.** Cero concatenación.
- **Degradación elegante como principio.** `/api/eventos` y `/api/destacados`
  devuelven `{...: []}` con HTTP 200 si Neon cae: la parte pública nunca se
  rompe por la base de datos. Buen criterio para una app de servicio.
- **Tests e2e reales, sin mocks.** Suben un blob de verdad, tocan Neon de
  verdad y limpian tras de sí. Poca cantidad, pero prueban lo que importa.
- **Fuente única de verdad app↔asistente.** `_knowledge.js` importa los mismos
  JSON que la UI, así que el chatbot no se desincroniza del contenido visible.

## Qué salió mal / costó más de lo previsto

### Incidente 1 — La migración a Edge Runtime (la más cara)

Una tanda de commits de puro diagnóstico lo delata: `909adf9` (WIP endpoints
de test), `6ab7efb`, `d42fefc` ("isolation test"), `420cd5e` ("isolation test
2"), `48e88c7` (revertir 9 endpoints). La causa raíz: `@vercel/blob` arrastra
`undici`, que usa builtins de Node que el Edge Runtime no tiene, y el fallo se
manifestaba en el *bundling*, no en una excepción clara. Se resolvió bien
(imagen.js se quedó en Node, el resto en Edge) y quedó documentado, pero costó
media docena de commits a ciegas.
**Lección:** ante un fallo de plataforma opaco, aislar por bisección desde el
principio en vez de migrar en bloque. Y verificar la compatibilidad de runtime
de cada dependencia *antes* de elegir dónde corre el handler.

### Incidente 2 — El cron de sync quedó silenciosamente roto

`api/sync-events.js` valida la cabecera `x-vercel-cron-secret`, que Vercel no
envía (manda `Authorization: Bearer`). Efecto doble: o el check pasa para
cualquiera (si `CRON_SECRET` no está puesta), o el propio cron recibe 401 y la
sincronización lleva sin ejecutarse desde entonces. Nadie lo notó porque **no
hay observabilidad del cron**: un fallo diario silencioso no avisa.
**Lección:** todo job programado necesita señal de vida (alerta si no corre en
24 h) y un test que valide el mecanismo de auth con la forma real de la
petición de Vercel. (Detallado en `SEGURIDAD.md` #3.)

### Incidente 3 — El lint nunca funcionó

`package.json` declara `npm run lint`, pero no hay `eslint.config.js` en la
raíz: el comando falla desde el día 1. Se arrastró todo el proyecto sin
linter efectivo.
**Lección:** un script que no se puede ejecutar es peor que no tenerlo — da
falsa sensación de cobertura. Añadir la config o quitar el script.

### Incidente 4 — CI configurado y luego perdido

Hay commits que montan CI (`6c38857` "Configurar pipeline de CI con GitHub
Actions", `54b9f4b` "cobertura de admin-super en CI"), pero **no hay ningún
fichero bajo `.github/` en el árbol actual** (`git ls-files` no devuelve
nada). El pipeline se configuró en una rama que no llegó a la línea principal,
o se eliminó. Resultado: los e2e no se ejecutan automáticamente.
**Lección:** verificar que la infraestructura de CI está *en la rama que
despliega*, no solo en la rama donde se creó.

## Deuda técnica acumulada

- **Seguridad (crítico para uso municipal):** candado de acceso client-side,
  hashing SHA-256 sin salt, sin rate-limiting, sin cabeceras de seguridad/CSP.
  Todo inventariado en `SEGURIDAD.md` — es la deuda más urgente.
- **Estilos huérfanos.** `CLAUDE.md` ya avisa: `Asistente.jsx` y algunas
  tablas de admin usan clases (`text-vino`, `success`…) que no existen en el
  Tailwind actual. Estilos que silenciosamente no aplican.
- **Ficheros sueltos en la raíz.** `test-bus-times.js`, `test-bus-times.mjs`,
  `test-db.mjs`, `test-scroll-verify.mjs`, `verify-api-data.js`,
  `verify-transporte.js` — scripts de depuración manual que deberían estar en
  `scripts/` o borrarse.
- **~30 ramas, la mayoría obsoletas.** Cuesta distinguir lo vivo de lo muerto.
  Podar las ya mergeadas.
- **Modelo del asistente descuadrado.** `chat.js` usa `claude-sonnet-4-6` por
  defecto; `CLAUDE.md` documenta `claude-opus-4-8`.
- **Sin migraciones versionadas.** El esquema evoluciona con `ALTER TABLE ...
  IF NOT EXISTS` al final de `schema.sql`; funciona para este tamaño, pero no
  hay historial ni rollback de cambios de esquema.
- **`npm run lint` roto** (ver Incidente 3).

## Métrica de proceso

- **Ritmo:** ~8,6 commits/día durante 10 días. Alta velocidad sostenida.
- **Flujo de ramas:** feature branch → `develop` → `main`. `main` y `develop`
  están hoy sincronizadas. El modelo funcionó, pero generó muchas ramas sin
  limpiar.
- **Documentación al día:** varios commits `docs:`/`CLAUDE.md update`
  intercalados con las features, no al final. Es lo que mantiene el proyecto
  legible.

## Acciones concretas (priorizadas)

| Prioridad | Acción | Referencia |
| --- | --- | --- |
| P0 | Corregir auth del cron `sync-events` y añadir alerta de vida | SEGURIDAD.md #3 |
| P0 | Mover el candado de acceso a servidor; migrar a PBKDF2 | SEGURIDAD.md #1, #2 |
| P0 | Rate-limiting en login/registro/track (WAF de Vercel) | SEGURIDAD.md #4 |
| P1 | Restaurar CI (e2e en cada PR) y verificar que vive en la rama de deploy | Incidente 4 |
| P1 | Añadir `eslint.config.js` o retirar el script `lint` | Incidente 3 |
| P1 | Cabeceras de seguridad + CSP en `vercel.json` | SEGURIDAD.md #5 |
| P2 | Limpiar ficheros de depuración de la raíz | Deuda técnica |
| P2 | Podar ramas obsoletas | Deuda técnica |
| P2 | Alinear modelo del asistente (`chat.js` ↔ `CLAUDE.md`) | Deuda técnica |
| P2 | Corregir clases Tailwind huérfanas | Deuda técnica |
| P3 | Observabilidad general: alertas de errores y de crons | Incidentes 2, 4 |
| P3 | Base legal RGPD/aviso legal antes del uso municipal | SEGURIDAD.md |

## Conclusión

Diez días, una app de servicio municipal funcional con área pública, gestión
multi-tenant, asistente IA y un producto de pago. El diseño de datos y la
disciplina de documentación son el gran acierto y lo que sostiene la
velocidad. La contrapartida es previsible al ritmo alcanzado: seguridad
pendiente de endurecer, automatización (CI/lint/observabilidad) a medio hacer
e higiene de repositorio acumulada. Nada de esto es estructural; son las
tareas P0-P1 de la tabla las que separan "prototipo avanzado" de "servicio
municipal en producción".
