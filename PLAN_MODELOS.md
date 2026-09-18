# Plan: modelos intercambiables y comparativa calidad/precio

Estado: **plan aprobado, sin ejecutar** (2026-09-17). Cada fase es una rama propia
que se ejecuta en su propia sesión. Este documento es la única fuente de
contexto que necesita esa sesión: léelo entero antes de empezar una fase y
actualiza la sección **Estado de las fases** al terminarla.

## Objetivo

Poder elegir, por feature y sin tocar código, qué modelo de qué proveedor
(Anthropic, OpenAI, Google, Kimi/Moonshot u otro host de pesos abiertos)
ejecuta cada llamada de IA del proyecto, y disponer de un arnés reproducible
que mida calidad, estabilidad y coste de cada candidato sobre datos reales,
para decidir con números en vez de con impresiones.

## Decisiones ya tomadas (no reabrir)

1. **Capa de abstracción: AI SDK de Vercel (`ai`) con proveedores directos**,
   NO AI Gateway. El usuario tiene claves y saldo propios en Anthropic y
   OpenAI y quiere que le facturen ellos. El AI SDK es la misma capa en ambos
   casos: si algún día interesan los logs unificados del Gateway, se cambia
   la fábrica de modelos, no los handlers.
2. **Un módulo único sabe de proveedores**: `api/_modelos.js`. El resto del
   código pide `modeloDe('instagram-eventos')` y recibe un modelo del AI SDK.
   El módulo lee una variable por feature con formato `proveedor/modelo` y
   construye el modelo con el paquete del proveedor, tomando la clave de la
   env var de ese proveedor. Proveedores que nacen soportados: `anthropic`,
   `openai`, `google` y un genérico compatible con OpenAI (`openai-compatible`)
   que cubre Moonshot (Kimi) y cualquier host de modelos abiertos con solo
   una URL base y una clave.
3. **Se mantiene el principio de un modelo aislado por feature** (lección del
   incidente 2026-08-31: una variable compartida cambió el modelo de una
   feature que no se quería tocar). Variables nuevas, con fallback en código
   al modelo que hoy usa cada feature:

   | Feature | Variable nueva | Fallback (= hoy) | Sustituye a |
   | --- | --- | --- | --- |
   | Eventos de Instagram (`api/sync-instagram.js`) | `MODELO_INSTAGRAM_EVENTOS` | `anthropic/claude-opus-5` | `ANTHROPIC_MODEL_INSTAGRAM_EVENTOS` |
   | Triaje de noticias/actividades (`api/sync-instagram-noticias.js`) | `MODELO_TRIAJE_NOTICIAS` | `anthropic/claude-haiku-4-5` | `ANTHROPIC_MODEL` |
   | Documentos enlazados HTML/PDF/carrusel (`api/_actividades-parser.js`, 3 llamadas) | `MODELO_DOCUMENTOS` | `anthropic/claude-haiku-4-5` | `ANTHROPIC_MODEL` |
   | Fecha por visión de carteles deportivos (`api/_deportes-fecha-vision.js`) | `MODELO_DEPORTES_VISION` | `anthropic/claude-opus-4-8` | `ANTHROPIC_MODEL_DEPORTES_VISION` |
   | Folleto de talleres en PDF (`api/_talleres-parser.js`) | `MODELO_TALLERES_PDF` | `anthropic/claude-opus-4-8` | `ANTHROPIC_MODEL_TALLERES_PDF` |
   | Asistente (`api/chat.js`, desactivado) | `MODELO_CHAT` | `anthropic/claude-opus-4-8` | `ANTHROPIC_MODEL` |

   Ojo: el valor efectivo hoy en producción de `ANTHROPIC_MODEL` es
   `claude-haiku-4-5` (está en `.env` y en Vercel), no el fallback del código.
   Los fallbacks de la tabla reflejan lo que corre de verdad.
4. **Claves por proveedor** en env: `ANTHROPIC_API_KEY` (existe),
   `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `MOONSHOT_API_KEY` (+
   `MOONSHOT_BASE_URL`). Todas sin prefijo `VITE_`, todas añadidas a
   `VARIABLES_API` en `vite.config.js`. Solo hace falta la clave del
   proveedor que se use; una feature configurada con un proveedor sin clave
   debe fallar con un mensaje claro al arrancar la llamada, no a mitad.
5. **Los prompts, los esquemas JSON y la validación en servidor NO cambian**
   en la migración. Son la parte portable y verificada; el AI SDK acepta los
   esquemas actuales con `jsonSchema()` sin reescribirlos en Zod.
6. **Orden: arnés primero, migración después, comparativa al final.** Sin el
   arnés no se puede distinguir "el SDK traduce mal" de "el modelo acierta
   menos". Cada fase tiene su verificación cerrada antes de la siguiente.
7. **Criterio de aceptación de un modelo para producción**: no es "acierta",
   es "acierta lo mismo en dos ejecuciones seguidas y sin falsos positivos".
   Un falso positivo en eventos nace `publicado` y entra en el digest push.
   Es la lección de la prueba de `cdcb163` (Haiku: 12 eventos en una
   ejecución y 4 en la otra con la misma entrada) y del año inventado del
   2026-08-31.

## Inventario de llamadas (lo que hay que migrar)

| Fichero | Llamadas | Entrada | Capacidades de la API que usa |
| --- | --- | --- | --- |
| `api/sync-instagram.js` (`pedirExtraccion`) | 1 | texto + hasta 40 imágenes base64 (`MAX_IMAGENES_VISION`) | JSON por esquema (`output_config`), caché del system prompt (`cache_control`), `stop_reason` refusal/max_tokens, `usage` (lo lee el script de coste) |
| `api/sync-instagram-noticias.js` (`extraerNoticias`) | 1 | texto | JSON por esquema, `stop_reason` |
| `api/_actividades-parser.js` | 3 (`validarConClaude`, `extraerDeDocumento`, `extraerDeCarrusel`) | texto / PDF como `document` base64 / imágenes | JSON por esquema, `stop_reason` |
| `api/_deportes-fecha-vision.js` (`extraerFechaDeCartel`) | 1 | 1 imagen | JSON por esquema, `usage` |
| `api/_talleres-parser.js` | 1 | PDF como `document` | JSON por esquema, `usage` |
| `api/chat.js` | 1 | texto | **streaming** (`messages.stream`), caché |

Scripts que también instancian el SDK: `scripts/reprocesar-post-DcIj1xrj0tG.mjs`
(rescate puntual, fuera del alcance: se deja con el SDK viejo o se borra) y
`scripts/probar-vision-baja-descartada.mjs` (inyecta un extractor falso, no
llama a la API; no cambia).

Traducción de cada capacidad al AI SDK (verificar contra
`node_modules/ai/docs/` en el momento de implementar, no desde memoria —
regla del skill `vercel:ai-sdk`):

- JSON por esquema → `generateText({ output: Output.object({ schema: jsonSchema(ESQUEMA) }) })`.
  Falla con `NoObjectGeneratedError` si el JSON no valida: sustituye al
  `JSON.parse` + `stop_reason` actuales. Mapear `finishReason` a los tres
  sitios que hoy distinguen refusal/max_tokens.
- Imagen y PDF → partes `{ type: 'file', mediaType, data }` en el mensaje de
  usuario. Anthropic, OpenAI y Google aceptan PDF; Kimi solo desde K2.7.
- Caché de prompt → `providerOptions.anthropic.cacheControl` en el bloque de
  system (verificar el nombre exacto en los docs del proveedor). Solo aporta
  en eventos y es marginal (1,2 k tokens de prompt frente a ~60 k de
  imágenes por run): si complica, se elimina.
- `usage` → `result.usage` (`inputTokens`, `outputTokens`, y los de caché en
  `providerMetadata`). Lo consumen el script de coste y `_deportes-fecha-vision`.
- Streaming (`chat.js`) → `streamText`. Última prioridad, está desactivado.

Dialectos de esquema: OpenAI en modo estricto exige `additionalProperties:
false` y todas las propiedades en `required`; Anthropic rechaza `maxItems`;
Google tiene sus propias restricciones. Los esquemas del proyecto ya cumplen
lo más estricto (nacieron contra Anthropic), pero **cada esquema se prueba
contra cada proveedor una vez** en la fase 2. `type: ['string', 'null']` es el
patrón de nulable que usan; comprobar que los tres lo aceptan.

## Consumo medido y precios de referencia (2026-09-17)

Volúmenes (medidos en el proyecto, no estimados salvo donde se indica):

| Feature | Por ejecución | Ejecuciones/año | Tokens/año |
| --- | --- | --- | --- |
| Eventos IG con visión | 61 k entrada (15 posts, ~60 imágenes a 800 px, `cdcb163`) + ~3 k salida | 365 (Ayuntamiento) + 52 (Cultura, ~25 k) | 23,6 M / 1,2 M |
| Triaje noticias | ~5,3 k entrada (prompt 1,5 k × 2 lotes + captions) + ~4 k salida (estimado) | 417 | 2,2 M / 1,7 M |
| Deportes visión | 23,3 k + 0,5 k | ~60 en temporada | 1,4 M / 0,03 M |
| PDF talleres/documentos | 6,6 k + 2,6 k | 2-5 | despreciable |

Coste anual estimado (USD) por modelo, precios del catálogo de AI Gateway de
ese día (son los de lista de cada proveedor):

| Modelo | $/M entrada / salida | Eventos | Noticias | Deportes | Total |
| --- | --- | --- | --- | --- | --- |
| **Hoy**: Opus 5 / Haiku 4.5 / Opus 4.8 | 5/25 · 1/5 · 5/25 | 147 | 11 | 8 | **166** |
| Sonnet 5 | 2 / 10 | 59 | 21 | 3 | 83 |
| Haiku 4.5 | 1 / 5 | 30 | 11 | 1,5 | 42 |
| GPT-5.4 | 2,5 / 15 | 77 | 26 | 4 | 107 |
| GPT-5.4 mini | 0,75 / 4,5 | 23 | 9 | 1 | 33 |
| GPT-5 mini | 0,25 / 2 | 8 | 4 | 0,4 | 12 |
| Gemini 3.8 Flash | 0,75 / 3,75 | 22 | 8 | 1 | 31 |
| Gemini 3.5 Flash-Lite | 0,3 / 2,5 | 10 | 5 | 0,5 | 16 |
| Kimi K3 | 3 / 15 | 88 | 32 | 4 | 124 |
| Kimi K2.6 | 0,95 / 4 | 27 | 9 | 1,3 | 37 |
| Kimi K2.5 | 0,6 / 3 | 18 | 6,4 | 0,9 | 25 |

Lecturas: el 90 % del gasto es la extracción de eventos y el 95 % de sus
tokens son imágenes; es el único sitio donde cambiar de modelo mueve la
aguja. Los tokens de imagen se cuentan distinto por proveedor (Anthropic por
píxeles, OpenAI por teselas, Google por bloques de 768 px): la columna de
eventos puede desviarse un 30-50 % fuera de Anthropic, y el arnés la corrige
con el `usage` real. Un ahorro de 90-130 $/año no compensa un solo falso
positivo publicado con push: la calidad manda.

Candidatos con visión a probar en eventos: Sonnet 5, GPT-5.4 mini, Gemini 3.8
Flash, Kimi K2.6 (y K2.5). Para noticias (solo texto) vale cualquiera,
incluidos Kimi K2 y GPT-5 mini. Para PDF: Anthropic, OpenAI, Google y Kimi
K2.7+/K3. Antes de usar un id de modelo, obtener el id exacto del proveedor
directo (no el del catálogo del Gateway, que puede diferir).

## Fases

### Fase 1 — Arnés de comparación (`feat/bench-modelos`)

Sin tocar producción ni el SDK: mide con el código actual y fija la línea
base. Entregables:

1. **Dataset fijo** en `scripts/bench/datasets/`: posts reales de Apify
   (JSON tal cual llega al webhook) de al menos dos runs del Ayuntamiento y
   uno de Cultura, incluyendo el del 2026-09-13/16 (contiene el cartel-programa
   del CETAN `DdEMenXnDIM`, el cartel paraguas `DdTqSAniDjH`, Marcha del
   Corazón, Oficina Móvil, la despedida de fiestas) y el del 2026-09-03 usado
   en `cdcb163` (2 eventos reales: Matiné y Feria). **Las URLs del CDN de
   Instagram caducan**: las imágenes del dataset se reemplazan por URLs
   estables. Primero las que ya están en Blob (`instagram/<shortCode>.jpg`,
   `-c<i>`); las que falten se suben una sola vez al prefijo `bench/`
   (contar los `put()`: cuota de 2 000 Advanced Requests/mes). No meter
   JPGs en el repo.
2. **Verdad de referencia** por dataset (`*.verdad.json`), validada a mano:
   para cada post, `{shortCode, esperado: 'evento'|'actividad'|'noticia'|'nada',
   eventos: [{fecha, hora, lugar, titulo}]}`. Las filas ya validadas en Neon
   (Pendientes publicados, eventos vivos) son el punto de partida, no la
   verdad: revisarlas.
3. **Script `npm run bench:modelos -- --feature=<f> --modelos=a,b,c
   [--ejecuciones=2]`** en `scripts/bench/bench-modelos.mjs`. Por modelo y
   ejecución: corre la extracción de esa feature sobre el dataset y compara
   con la verdad. Métricas: posts bien clasificados, falsos positivos (lo
   grave), falsos negativos, campos exactos (fecha, hora, lugar, título por
   `titulosEquivalentes`), **estabilidad** (diferencia entre ejecuciones),
   latencia, tokens y coste (tabla `scripts/bench/precios.json` mantenida a
   mano, con fecha). Salida: tabla en consola y JSON en
   `scripts/bench/resultados/<fecha>-<feature>.json` (gitignored salvo los
   que se quieran conservar como evidencia).
4. **Cero efectos secundarios**: el bench importa `extraerEventos` /
   `validarExtraccion` (ya exportadas) y sus equivalentes de noticias
   (habrá que exportar `extraerNoticias`), nunca `procesar()` ni los
   handlers. No carga `DATABASE_URL` ni credenciales de Blob (así ni
   `ingesta_log` ni Blob se tocan aunque una función los busque) ni envía
   email. Usa `.env` solo para las claves de proveedor.
5. En esta fase el bench acepta solo modelos de Anthropic (el SDK actual).
   El parámetro `--modelos` ya tiene el formato `proveedor/modelo` para no
   cambiar la interfaz en la fase 3.

Aceptación: línea base publicada en este documento con Opus 5 y Haiku 4.5 en
eventos y noticias, dos ejecuciones cada uno, y el bench reproduce el
resultado conocido de `cdcb163` (Opus 5: 2 eventos idénticos en ambas
ejecuciones, 0 falsos positivos, sobre el dataset del 3-sep) y el del
2026-09-17 (8 funciones del CETAN, 4/4).

### Fase 2 — Migración al AI SDK (`feat/ai-sdk-proveedores`)

Cambio **sin variación de comportamiento**, feature a feature, con el arnés
como prueba de que el mismo modelo da lo mismo antes y después.

1. `npm i ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google
   @ai-sdk/openai-compatible`. Leer `node_modules/ai/docs/` antes de escribir
   una línea (los APIs del SDK han cambiado varias veces; nada de memoria).
2. `api/_modelos.js`: `modeloDe(feature)` según la tabla de variables de
   arriba, más `descripcionDe(feature)` para logs (`proveedor/modelo` en
   uso). Node y Edge-safe en la importación (los handlers que lo usan son
   todos Node, pero el módulo no debe arrastrar nada que rompa un import
   accidental desde Edge).
3. Migrar en este orden, ejecutando el bench tras cada uno con el modelo de
   producción de esa feature (resultados idénticos = aceptado):
   eventos IG → triaje noticias → `_actividades-parser` (3 llamadas) →
   deportes visión → talleres PDF → `chat.js` (streaming; opcional, está
   desactivado y puede quedar para otra rama).
4. Sustituir `ANTHROPIC_MODEL*` por las variables nuevas en `.env`,
   `.env.example`, `VARIABLES_API` y en Vercel (Production). Mantener
   durante una versión la lectura de las viejas como fallback con un
   `console.warn`, y retirarlas en la fase 3.
5. Retirar `@anthropic-ai/sdk` de `package.json` cuando no quede ningún
   import (comprobar `scripts/`).
6. Documentar en CLAUDE.md: sección nueva "Modelos por feature
   (`api/_modelos.js`)" que sustituye a las menciones dispersas de
   `ANTHROPIC_MODEL*`, y actualizar las secciones que las citan (Instagram
   sync, deportes visión, talleres PDF, asistente).

Verificación en producción, regla de siempre: desplegar y esperar al
siguiente run real de Apify (10:00 UTC) — la fila de `ingesta_log` debe
tener los mismos órdenes de magnitud que las anteriores y ningún motivo
"lote de extracción con error". Copiar del `.env` real TODAS las variables de
modelo al verificar en local, no solo la credencial.

### Fase 3 — Comparativa y elección (`feat/comparativa-modelos`)

1. Obtener claves de los proveedores a comparar (OpenAI ya existe; Google AI
   Studio tiene capa gratuita; Moonshot para Kimi) y ponerlas en `.env`
   (nunca en Vercel hasta decidir).
2. Ejecutar el bench por feature con los candidatos de la sección de precios,
   dos ejecuciones cada uno, y pegar las tablas en este documento.
3. Decidir por feature con el criterio 7. Un modelo entra en producción solo
   si iguala a la línea base en falsos positivos (0) y en estabilidad, y
   entonces gana el más barato.
4. Cambiar la variable en Vercel, verificar con el run real siguiente, y
   anotar aquí fecha, modelo anterior, modelo nuevo y motivo.
5. Retirar los fallbacks a `ANTHROPIC_MODEL*`.

## Fuera de alcance (deliberado)

- AI Gateway y BYOK: no aporta al usuario mientras facture directo; se puede
  añadir en `_modelos.js` en una tarde si algún día interesan sus logs.
- Cambiar prompts o esquemas para adaptarlos a un modelo concreto. Si un
  candidato necesita otro prompt para rendir, eso es una rama aparte con su
  propia verificación, y el bench debe poder ejecutar prompts alternativos
  antes de plantearla.
- El dedup de imágenes de un cartel-programa en Blob (8 `put()` al mismo
  blob), anotado en CLAUDE.md: es Blob, no IA.

## Estado de las fases

| Fase | Rama | Estado | Fecha | Notas |
| --- | --- | --- | --- | --- |
| 1 Arnés | `feat/bench-modelos` | **construido; aceptación a medias** | 2026-09-18 | Bench, preparación de datasets, precios y línea base sobre el dataset del 3-sep hechos. Pendiente para cerrar: (a) revisar juntos `2026-09-03-ayuntamiento.verdad.json` (las decisiones marcadas REVISAR, sobre todo si una crónica es "noticia" o "nada"); (b) el dataset del 13/16-sep (CETAN) y uno de Cultura — hacen falta los JSON de esos runs, y **prepararlos el mismo día del run**: las URLs del CDN caducan a los ~4 días; (c) re-scrape de los 15 posts del 3-sep (task de Apify con sus URLs) para recuperar las 38 fotos perdidas y levantar los 3 `ignorar`. |
| 2 Migración | `feat/ai-sdk-proveedores` | pendiente | | |
| 3 Comparativa | `feat/comparativa-modelos` | pendiente | | |

### Línea base (fase 1, 2026-09-18)

Dataset `2026-09-03-ayuntamiento` (los 15 posts de `cdcb163`), commit
`71c2f65` + los cambios de esta rama, dos ejecuciones por modelo, precios de
`scripts/bench/precios.json` (2026-09-17). JSON de evidencia:
`scripts/bench/resultados/2026-09-18-{eventos,noticias}.json`.

**Limitación que condiciona toda la tabla de eventos**: de las 52 fotos del
run solo 14 sobreviven (las que algún webhook subió a Blob); las 38 restantes
caducaron en el CDN de Instagram el 7-sep. Los 3 posts cuyo cartel decisivo se
perdió (`Dc0WIVqFUNv`, `DcxppU9jXrU`, `DcvZaG-j_Zo`) van marcados `ignorar` y
no puntúan, así que las cuentas son sobre 12 posts. Los 3 carteles que sí
llegan al modelo (matinés, Gala de la Danza, feria) se leyeron a ojo para
fijar la verdad: son 14 funciones esperadas, no los "2 eventos" de `cdcb163`,
porque desde `106392b` el prompt pide un evento por función del cartel-programa
(11 actuaciones de las matinés + 2 días de Gala + la feria).

**Eventos** (`--feature=eventos`):

| modelo | ejecuciones | aciertos | FP | FN | estable | latencia | tokens | coste/run | campos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| anthropic/claude-opus-5 | 2/2 | 12/12 | 0 | 0 | no (44 %) | 33.4 s | 46998 / 3708 | $0.3199 | emparejados 12–13/14 · título 6–10 · fecha 12–13 · hora 12–13 · lugar 11–12 · sobrantes 0–1 |
| anthropic/claude-haiku-4-5 | 2/2 | 11/12 | 1 | 0 | no (6 %) | 11.3 s | 41499 / 1119 | $0.0471 | emparejados 2–12/14 · título 1–4 · fecha 2–12 · hora 1–9 · lugar 1–11 · sobrantes 0–1 |

Lectura:

- **Reproduce lo conocido de `cdcb163`**: Opus 5 acierta la clasificación de
  los 12 posts en las dos ejecuciones con 0 falsos positivos; Haiku 4.5 mete
  un falso positivo en cada ejecución (una crónica distinta cada vez:
  `Dc0cKywjDue` la presentación taurina de ayer, `DcyL-v_jaIu` el patinaje
  de ayer — exactamente el modo de fallo que llegó a producción) y en una
  ejecución saca 13 items y en la otra 5, con títulos corrompidos
  ("la cuarangada", "dj feloti").
- **La estabilidad "no (44 %)" de Opus no es de clasificación sino de
  redacción/granularidad**: en las dos ejecuciones detecta los mismos 3 posts
  y las mismas fechas, pero una vez separa "Grupo Línea 12" y "DJ Maru" como
  dos funciones del día 6 y otra los junta en una, y a veces antepone "Matiné
  musical:" al título. La firma de estabilidad es estricta a propósito
  (`shortCode|fecha|título normalizado`); el JSON lista los items que
  difieren. Para el criterio 7 del plan, lo que hay que mirar es FP y
  clasificación por post (idénticas), no esa cifra sola.
- Coste medido por run: $0.32 (Opus) frente a $0.047 (Haiku), con solo 14
  de 52 imágenes; el run completo real ronda los $0.33 de `cdcb163`.

**Noticias** (`--feature=noticias`, solo texto):

| modelo | aciertos | FP | FN | estable | latencia | tokens | coste/run | campos |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| anthropic/claude-opus-5 | 6–8/12 | 4–6 | 0 | no (78 %) | 37.2 s | 10061 / 4837 | $0.1712 | tipo 3/3 · urgente 2 · categoría 0 · plazo 0 |
| anthropic/claude-haiku-4-5 | 10–12/12 | 0–2 | 0 | no (60 %) | 6.3 s | 7872 / 1152 | $0.0136 | tipo 3/3 · urgente 3 · categoría 0 · plazo 0 |

Lectura:

- Las 3 noticias reales (autobuses, Punto Violeta, calor) las sacan los dos
  modelos siempre, con el tipo correcto; los 2 posts de evento los rechazan
  los dos. Toda la diferencia está en las **crónicas** de actos ya celebrados
  (voleibol, presentación taurina, jumping, juegos populares, patinaje) y en
  el comunicado sobre Ceuta: Opus 5 los publica como noticia (4–6 de 6),
  Haiku 4.5 casi nunca (0–2). La verdad los fija como "nada" (así se comportó
  producción con Haiku y así se documentó el criterio editorial de
  ago-2026: balances sin dato práctico se descartan) — **es la primera
  decisión de la revisión conjunta**: si se decidiera que una crónica es
  noticia, la tabla se invierte.
- Ninguno de los dos es estable en esa frontera: cada uno cambia de opinión
  entre ejecuciones sobre 2 crónicas. En `urgente`, Opus marcó una vez los
  cambios de autobús como alerta (la verdad dice no urgente; también
  marcado REVISAR).
- Sin actividades ni plazos en este dataset: `categoría` y `plazo` quedan a
  0/0 hasta tener un run con inscripciones.

**Qué falta para dar la fase por aceptada** (ver Estado de las fases): el
dataset del 13/16-sep con el cartel-programa del CETAN (8 funciones, 4/4) y
uno de Cultura, la revisión conjunta de la verdad y, si se quiere una tabla
de eventos con todas las imágenes, el re-scrape del run del 3-sep.

### Resultados de la comparativa (rellenar en la fase 3)

_(tablas por feature y decisión)_
