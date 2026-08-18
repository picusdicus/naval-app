# Sincronización de contenidos — En Navalcarnero

Cómo entra el contenido externo (eventos, noticias, avisos y actividades) en la app, de principio a fin. Este documento es autocontenido: sirve como referencia para entender la arquitectura sin leer el código.

## Visión general

La app tiene dos mecanismos de ingesta y cuatro tipos de contenido:

| Contenido | Fuente | Mecanismo | Dónde se guarda | Dónde se ve |
| --- | --- | --- | --- | --- |
| Eventos de agenda | API del Teatro TYL TYL + RSS de cultura del Ayuntamiento | Cron diario (07:00 UTC) | `src/data/eventos-externos.json` (commit a GitHub) | Eventos |
| Eventos de agenda | Instagram (`cultura_navalcarnero` y `ayuntamientonavalcarnero`) | Webhook de Apify → Claude | Neon, tabla `eventos_usuario` | Eventos |
| Noticias de prensa | RSS de prensa del Ayuntamiento | Cron diario (el mismo) | `src/data/noticias.json` (commit a GitHub) | Noticias |
| Noticias / avisos urgentes / actividades | Instagram (ambas cuentas) | Webhook de Apify → Claude (triaje de 3 vías) | Neon, tabla `noticias_instagram` | Noticias, Avisos, Actividades |

Regla de diseño que explica el reparto: **lo que puede esperar al ciclo commit → redeploy va a JSON estático; lo que no (alertas urgentes, actividades con plazo) va a Neon** y se sirve por API con cache CDN de 60 s.

## 1. Cron diario — `api/sync-events.js`

Vercel Cron Job (`vercel.json`: `0 7 * * *`, o sea 07:00 UTC diario). Auth: `Authorization: Bearer <CRON_SECRET>`, comparación en tiempo constante, **falla cerrado** si falta la env.

Pasos, en orden:

1. **Eventos externos**: descarga el catálogo del TYL TYL (API WordPress "The Events Calendar", paginada) y el RSS de cultura del Ayuntamiento. Los eventos del TYL TYL llevan `categoria: 'cultura'` y `subcategoria: 'teatro'` fijadas sin IA (todo su catálogo es teatro).
2. **Combina sin duplicados** y ordena por fecha.
3. **Noticias de prensa**: regenera el contenido de `noticias.json` desde el RSS de prensa (`api/_noticias-feed.js`, compartido con `npm run fetch:noticias`). Fail-soft: si falla, se loguea y no rompe el resto.
4. **Commit a GitHub**: compara con los ficheros actuales (leídos vía GitHub API — el filesystem de Vercel es de solo lectura) y, si hay cambios, hace **un único commit** con ambos JSON (Git Data API). Vercel detecta el commit y redespliega; ahí el JSON nuevo pasa a estar en disco.
5. **Digest push**: anuncia por Web Push los eventos nuevos (externos futuros + filas de Neon `publicado` con `notificado_en IS NULL`), registra cada aviso en `push_avisos` (la bandeja in-app) y rellena `notificado_en`. Un fallo de push nunca rompe la sincronización.

Env: `CRON_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPO`, y las VAPID para el push (opcionales: sin ellas se salta el envío con un log).

## 2. Scraping de Instagram — montaje en Apify

Actor **`apify/instagram-scraper`** (devuelve `shortCode` + fotos), en **dos tasks separadas**, cada una con su input, su schedule y sus **webhooks a nivel de task** (nunca de actor: un webhook de actor se dispararía para todas las tasks y cruzaría los flujos):

| Task | Perfil scrapeado | Schedule | Webhooks (al terminar) |
| --- | --- | --- | --- |
| `eventos-cultura` | `cultura_navalcarnero` | lunes | `/api/sync-instagram?secret=<INSTAGRAM_SYNC_SECRET>` y `/api/sync-instagram-noticias?secret=<NOTICIAS_SYNC_SECRET>` |
| `noticias-instagram` | `ayuntamientonavalcarnero` | diario | los mismos dos |

Cada cuenta dispara **ambos** endpoints porque las dos publican contenido de los dos tipos: el Ayuntamiento anuncia eventos de agenda (cine de verano…) y cultura abre plazos de inscripción a talleres (actividades). Los prompts son complementarios — eventos exige fecha+hora+lugar y descarta inscripciones; noticias/actividades descarta eventos puntuales — así que un mismo post nunca acaba duplicado en las dos tablas.

Los webhooks aceptan el payload estándar de Apify (`resource.defaultDatasetId` → el endpoint descarga el dataset con `APIFY_TOKEN`) o, para pruebas manuales, un array de posts directo / `{posts: []}` en el body.

Detalle importante de los posts: el campo **`alt`** (descripción automática de la imagen que genera Instagram) viaja a Claude junto al caption en ambos webhooks. Los carteles municipales suelen llevar fecha/hora/lugar solo en la imagen, y sin el `alt` esos posts no se reconocerían.

**Carruseles (`type: "Sidecar"`): el `alt` del post padre es inútil.** Instagram le pone siempre la misma fórmula genérica ("Photo by Ayuntamiento de Navalcarnero on August 03, 2026.") sin ningún dato del cartel — el contenido real vive en el `alt` de cada foto (`childPosts[].alt`). `normalizarPost()` (`api/_instagram.js`) construye el `alt` que llega a Claude uniendo el del padre (si dice algo) con el de cada hija marcado `[Imagen N]` (N = posición real en el carrusel, así una foto sin alt útil no desplaza la numeración de las siguientes), descartando la fórmula genérica de Instagram y con un tope de 10 fotos / ~4000 caracteres para no disparar tokens en carruseles largos. En un post de foto única el resultado es idéntico al `alt` del padre — no cambia nada. Esto es solo texto: **no se manda visión** (imágenes) en esta ruta, y **no hay fan-out** — un post sigue siendo un registro (salvo el camino ya existente y aparte de documentos/carrusel enlazados del webhook de noticias, que sí produce varias filas por post; ver `ACTIVIDADES_SCRAPING.md`). Un carrusel puede anunciar varias actividades (una por foto) y hoy solo entra la primera que Claude devuelva para ese `shortCode` — trocear un post en varios registros es un cambio aparte, no este.

## 3. Webhook de eventos — `api/sync-instagram.js`

Convierte posts en eventos de la agenda. Node (el SDK de Anthropic y `@vercel/blob` no funcionan en Edge).

- **Auth**: `Bearer <INSTAGRAM_SYNC_SECRET>` o `?secret=`, tiempo constante, falla cerrado.
- **Extracción con Claude** (`claude-opus-4-8`, override `ANTHROPIC_MODEL`, structured outputs): un post es evento SOLO si tiene fecha + hora + lugar explícitos (caption o `alt`). Devuelve `titulo`, `fecha`, `hora`, `lugar`, `categoria` (taxonomía de la agenda: `cultura|deporte|fiestas|gastronomia|infantil|mercado`), `subcategoria` y `descripcion`.
- **Subcategoría de cultura**: si `categoria = 'cultura'`, Claude afina con `teatro|cine|musica|danza|exposicion|otros` (whitelist `SUBCATEGORIAS_CULTURA` en `src/lib/eventos.js`, compartida con la UI). No son categorías de primer nivel a propósito: los temas de push `cat:cultura`, los filtros y el perfil de las organizaciones siguen funcionando como paraguas. La subcategoría solo alimenta los **sub-chips** de la página Eventos.
- **Re-validación en servidor** (nunca se confía en el modelo): regex de fecha/hora, whitelists, shortCode contra los posts realmente enviados, truncados de longitud.
- **Imagen**: la primera foto del post se sube a Vercel Blob en `instagram/<shortCode>.<ext>` (las URLs del CDN de Instagram caducan). Si falla, el evento entra sin foto y el UPDATE conserva la imagen previa. **Solo la primera**: a diferencia del webhook de noticias, los eventos se quedan con una sola foto a propósito (no hay galería en la ficha de un evento).
- **Atribución**: `ORG_POR_USUARIO` mapea el autor del post a una organización auto-provisionada — `cultura_navalcarnero` → "Cultura Navalcarnero" (`cultura-navalcarnero`), `ayuntamientonavalcarnero` → "Ayuntamiento de Navalcarnero" (`ayuntamiento`). El evento sale en la ficha con "Organiza: <org>" y es suscribible por tema de push `org:<slug>`.
- **Upsert en `eventos_usuario`** por `origen_externo_id = 'ig-<shortCode>'` (índice único parcial): re-ejecutar actualiza, no duplica. Filas nuevas nacen `publicado` con `notificado_en NULL` → **el digest del cron las anuncia solo**. El UPDATE no toca `estado` (un evento archivado a mano no resucita) ni `notificado_en` (editar no re-notifica).

## 4. Webhook de noticias/actividades — `api/sync-instagram-noticias.js`

Mismo molde (Node, `Bearer <NOTICIAS_SYNC_SECRET>` o `?secret=`, secreto propio para rotación independiente). Hace un **triaje de tres vías** con Claude:

1. **`tipo: 'noticia'`** — información municipal: obras, comunicados, gestión de emergencias, balances.
   - Puede ser además **alerta urgente** (`urgente = true`) SOLO si comunica una interrupción concreta de servicio o una instrucción de seguridad accionable AHORA (corte de agua/luz/calle con fecha, "eviten la zona", evacuaciones). Lo informativo-institucional ("visita de ministros al puesto de mando") NO es urgente.
   - `tipo_alerta`: `incendio|corte_agua|corte_luz|trafico|emergencia|general`. `expira_en`: del caption ("hasta las 14:00"); sin fin conocido, publicado + 24 h.
2. **`tipo: 'actividad'`** — algo a lo que el vecino puede **apuntarse o solicitar**: inscripciones a talleres, cursos, campamentos, escuelas deportivas, viajes, ayudas, becas, bolsas de empleo.
   - `categoria`: `deporte|talleres|infantil|mayores|educacion|ayudas|empleo|general`.
   - `fecha_limite`: fin del plazo (YYYY-MM-DD) si el post lo indica; NULL si no.
   - Una actividad **nunca es urgente** (el servidor lo fuerza aunque el modelo se equivoque).
3. **Descartes**: eventos de agenda puntuales (los cubre el otro webhook — ojo, un plazo de inscripción a una actividad continuada NO es un evento), felicitaciones, efemérides, sorteos, promoción.

Igual que en eventos: re-validación server-side completa (coherencias urgente⇔tipo_alerta⇔expira_en y tipo⇔categoria⇔fecha_limite, whitelists con fallback a `general`, truncados, shortCode), y upsert en `noticias_instagram` por `origen_externo_id = 'ig-<shortCode>'` que re-escribe todo salvo las imágenes (COALESCE si la subida falló esta vez).

**Galería completa del carrusel**: a diferencia del webhook de eventos, aquí se sube el post entero — un post "Sidecar" puede traer varias fotos con información distinta cada una (el de instalaciones deportivas, una foto por instalación con su horario y dirección), y quedarse solo con la primera perdía ese contenido. `todasLasImagenes(post)` (`api/_instagram.js`) hace el mismo baile de campos entre actores que `primeraImagen`, pero devolviendo el array completo. Cada foto (hasta `MAX_IMAGENES_POST = 12`) se sube a Blob: la primera en `instagram-noticias/<shortCode>.<ext>` (nombre histórico, sin tocar) y el resto en `instagram-noticias/<shortCode>-<n>.<ext>` (`subirImagen(..., sufijo)`); las subidas de un mismo post se paralelizan, nunca entre posts. `imagen_url` sigue siendo solo la primera; `imagenes_url` (jsonb) guarda el array completo en orden — `NULL` en filas antiguas o posts de imagen única.

**Sin push a propósito**: las noticias/alertas/actividades no disparan notificaciones — un aviso municipal debe verlo cualquier visitante, no solo los suscritos.

## 5. Lectura pública (API) — contrato común

Los tres GET comparten contrato: Edge, sin auth, cache CDN 60 s, y **`{lista: []}` con HTTP 200 si Neon cae** — la UI estática nunca se rompe por la base de datos.

- **`GET /api/eventos`** — filas `publicado` de `eventos_usuario` con JOIN a su organización, mismo shape que los JSON de eventos (ids prefijados `bd-<uuid>` para no chocar). Incluye `subcategoria`.
- **`GET /api/noticias-instagram`** — últimos 60 días / 100 items; el OR del WHERE mantiene visibles fuera de esa ventana las **alertas vigentes** (`urgente AND expira_en > now()`) y las **actividades con plazo abierto** (`fecha_limite >= CURRENT_DATE`). Shape compatible con `noticias.json` + `imagen`, `imagenes` (array completo del carrusel, siempre `[]` si no hay — nunca `null`), `tipo`, `categoria`, `fechaLimite`, `urgente`, `tipoAlerta`, `expiraEn`.
- **`GET /api/avisos`** — historial de avisos push (bandeja), fuera del alcance de este doc.

## 6. Hooks del cliente y superficies

- **`src/lib/useEventosPublicos.js`** — mezcla `eventos.json` (curado) + `eventos-externos.json` (cron) + Neon, con **dedup** (`src/lib/dedupEventos.js`): un evento de Neon con misma fecha y título equivalente que uno estático se fusiona en la tarjeta estática (la de Neon solo rellena huecos: imagen, descripción… y `subcategoria`). El id del duplicado queda en `idsSecundarios` para que deep-links y destacados sigan resolviendo.
- **Página Eventos** — chips de categoría; con **Cultura** activo aparecen los **sub-chips** (Teatro, Cine, Música, Danza, Exposiciones, Otros — solo los presentes en los datos). Los eventos de cultura sin subcategoría siguen visibles bajo "Todo cultura".
- **`src/lib/useNoticiasPublicas.js`** — mezcla RSS + Neon y expone:
  - `noticias`: último mes, orden desc, **sin** las actividades.
  - `alertas`: urgentes vigentes (`expiraEn > ahora`) — al caducar desaparecen solas, sin cron.
  - `actividades`: plazo abierto (o sin plazo conocido), ordenadas por fecha de publicación descendente — al pasar el plazo desaparecen solas.
- **Página Noticias** — sección "Avisos del municipio" (solo alertas vigentes) + listado de noticias (que excluye los avisos activos para no duplicar).
- **Página Actividades** (`/actividades`, enlazada en el menú lateral) — franja "Últimos días de plazo" arriba (plazos que cierran en ≤ 7 días, deslizable, en terracota) y debajo la lista por fecha de publicación, con chip de categoría y badge de plazo ("Plazo hasta el X"; a ≤5 días, "Quedan N días" en terracota). Vacía con mensaje claro si no hay inscripciones abiertas.
- **Detalle** (`/noticias/:id`) — resuelve tanto noticias como actividades (deep-links `ig-…`); en actividades muestra badge "Actividad · <categoría>", la fila "Plazo" y vuelve a `/actividades`. Con `imagenes.length > 1` monta `GaleriaNoticia` (`src/components/noticias/GaleriaNoticia.jsx`) en vez de la imagen suelta: móvil navega por swipe (scroll nativo con snap), escritorio con flechas + contador, sin autoplay — aquí se lee, no se ojea. **Decisión**: la galería solo vive en el detalle, no en el listado — un scroll horizontal dentro de cada tarjeta de `Noticias.jsx` chocaría con el scroll vertical de una lista de escaneo (y ya hay un carrusel, el de destacados, en esa jerarquía visual). El listado se queda con la primera foto y un contador discreto en la esquina (icono `collections` + nº total) cuando hay más de una — mismo patrón que la cuadrícula de perfil de Instagram.
- **Inicio** — franja "Estado del municipio" alimentada por `alertas`.

## 7. Tablas implicadas (Neon)

- **`eventos_usuario`** — eventos del panel de organizaciones + los del webhook de Instagram. Campos clave para la sincronización: `origen_externo_id` (`ig-<shortCode>`, único parcial), `subcategoria`, `estado`, `notificado_en`.
- **`noticias_instagram`** — todo lo del webhook de noticias: `origen_externo_id` (único), `tipo` (`noticia|actividad`), `categoria`, `fecha_limite`, `urgente`, `tipo_alerta`, `expira_en`, `publicado_en`, `imagen_url`, `imagenes_url` (jsonb, array del carrusel completo; `imagenes_url[0] === imagen_url`; `NULL` en filas antiguas).
- **`push_avisos`** / **`push_suscripciones`** — bandeja e infraestructura push (las alimenta el cron, no los webhooks de Instagram).

El schema canónico está en `db/schema.sql` (`npm run db:setup`, idempotente); ambos webhooks además aseguran sus columnas/tablas inline en cada ejecución, así que un deploy con columnas nuevas no depende de una migración manual… pero los GET sí las seleccionan, de modo que **hay que aplicar el schema en prod antes del deploy**.

## 8. Variables de entorno

| Variable | Usada por | Notas |
| --- | --- | --- |
| `CRON_SECRET` | `sync-events` | Obligatoria; el cron falla cerrado sin ella |
| `GITHUB_TOKEN`, `GITHUB_REPO` | `sync-events` | Commit de los JSON regenerados |
| `INSTAGRAM_SYNC_SECRET` | `sync-instagram` | Obligatoria; falla cerrado |
| `NOTICIAS_SYNC_SECRET` | `sync-instagram-noticias` | Obligatoria; independiente para rotar por separado |
| `APIFY_TOKEN` | ambos webhooks | Para descargar el dataset del webhook |
| `ANTHROPIC_API_KEY` (+ `ANTHROPIC_MODEL` opcional) | ambos webhooks | Extracción con Claude |
| `DATABASE_URL` | todo | Inyectada por la integración Neon/Vercel |
| `BLOB_READ_WRITE_TOKEN` | webhooks (imágenes) | En Vercel puede sustituirla OIDC |
| `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | digest push del cron | Opcionales: sin ellas el envío se salta con un log |

Ninguna lleva prefijo `VITE_` salvo la clave pública VAPID (pública por diseño). En dev, toda env nueva que lea un handler debe añadirse a `VARIABLES_API` en `vite.config.js`.

## 9. Propiedades del sistema (las que evitan sustos)

- **Idempotencia en todas partes**: re-lanzar el cron o un webhook actualiza, nunca duplica (upserts por id de origen; commit solo si hay diff).
- **Caducidades sin cron**: alertas (`expira_en`) y actividades (`fecha_limite`) dejan de mostrarse por filtro en lectura; no hay ningún job de limpieza.
- **Fail-soft en cadena**: cada fuente falla por separado (el RSS caído no rompe el TYL TYL; el push caído no rompe el commit; Neon caída no rompe la UI estática).
- **Nunca se confía en el modelo**: todo lo que devuelve Claude se re-valida contra whitelists, regex y los posts realmente enviados antes de tocar la base.
- **Ediciones no re-notifican**: `notificado_en` y `estado` se preservan en los UPDATE.
