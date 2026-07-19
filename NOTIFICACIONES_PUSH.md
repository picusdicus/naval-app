# Notificaciones push para vecinos

> **Estado: fase 1 IMPLEMENTADA (julio 2026).** Suscripción anónima por temas,
> `POST/DELETE /api/push`, digest diario en el cron, handlers del service
> worker y diálogo de opt-in en Eventos. Las fases 2 (favoritos/recordatorios)
> y 3 (cuenta de vecino) siguen sin abordar. Decisiones tomadas al implementar:
>
> - **Eventos de Neon en el digest**: entran en el mismo digest del cron (no
>   hay disparo al publicar); el estado "ya avisado" es la columna
>   `eventos_usuario.notificado_en` (NULL = pendiente de avisar).
> - **Lista de organizadores**: endpoint público `GET /api/organizadores`
>   (slug+nombre de orgs activas) + fijos en `ORGANIZADORES_FIJOS`; se descartó
>   derivarla de los eventos cargados.
> - El detalle operativo vive en la sección "Notificaciones push" de CLAUDE.md.

## Qué es

Permitir que los vecinos (usuarios sin organización) reciban notificaciones
push de la agenda de eventos en su móvil u ordenador, eligiendo de qué quieren
recibir avisos: todos los eventos, solo ciertas categorías (cultura,
mercado...) o solo ciertos organizadores (por ejemplo, solo el Teatro TYL TYL).

La app ya es una PWA instalable con service worker, y Web Push es un estándar
gratuito (sin Firebase ni servicios de pago), así que la feature encaja en el
stack actual (Vercel + Neon) sin infraestructura nueva.

## Decisión clave: suscripción anónima primero, cuenta después

Una suscripción push es un objeto anónimo por dispositivo: para "avísame de
eventos de teatro" no hacen falta email ni contraseña. Eso divide la feature
en dos opciones:

- **Opción A — suscripción anónima (recomendada como fase 1).** Botón
  "Recibir avisos" → permiso del navegador → elegir temas → fila en una tabla
  de suscripciones. Cero fricción, sin gestión de contraseñas, entrega el 90 %
  del valor.
- **Opción B — cuenta de vecino completa (fase posterior).** Registro/login
  sin código de invitación, sesión larga, perfil. Lo que aporta *de más*:
  sincronizar preferencias y favoritos entre dispositivos y ser base de
  futuras funciones personales. El esquema ya la contempla (`usuarios` acepta
  `rol='vecino'` sin organización), pero arrastra requisitos previos serios
  (ver "Deudas que bloquean la Opción B").

La tabla de suscripciones nace con `usuario_id uuid NULL`: cuando en el futuro
el vecino se registre, sus suscripciones anónimas se le adjuntan sin migración.

## Preferencias: temas mixtos (categoría + organizador)

Cada evento de las tres fuentes (curados `ev-…`, externos `tyltyl-…`/
`aytocult-…`, Neon `bd-…`) es atribuible a una categoría y a un organizador.
Ninguna dimensión basta por separado: los eventos externos vienen todos
hardcodeados como `categoria: 'cultura'` en `scripts/fetch-eventos.mjs`, así
que "solo cultura" filtra poco; en cambio "solo TYL TYL" es un filtro nítido.
Las preferencias se modelan como una lista plana de **temas**:

| Tema | Significado |
| --- | --- |
| `todos` | cualquier evento nuevo |
| `cat:<categoria>` | por categoría de la taxonomía de la app |
| `org:<slug>` | por organizador (`org:tyl-tyl`, `org:ayuntamiento`, orgs de Neon) |

Una suscripción recibe un evento si su lista de temas interseca con los temas
del evento (o contiene `todos`).

### El matiz del TYL TYL: doble identidad

El TYL TYL entra en la app por dos caminos: su API de WordPress
(`tyltyl-…`, `fuente: 'TYL TYL'`) **y** los eventos que publique desde su
panel como organización de Neon (`bd-…`, slug `tyl-tyl`). El tema
`org:tyl-tyl` debe cubrir ambos, así que hace falta un mapeo fuente-externa ↔
slug de organización (hoy una sola entrada: `'TYL TYL'` ↔ `tyl-tyl`). Si no se
contempla desde el día 1, el suscriptor se pierde la mitad de la programación
del teatro.

La lista de organizadores de la UI debe ser semi-fija (Ayuntamiento, TYL TYL,
más las organizaciones activas de Neon), **no** derivada de qué fuentes tienen
eventos en el JSON en ese momento (el TYL TYL para en verano y desaparecería
del selector). Para las orgs de Neon hará falta o un endpoint público mínimo
(`slug` + `nombre` de las activas) o derivarlas de los eventos ya cargados en
el navegador, asumiendo que solo aparecen orgs con eventos publicados.

## Arquitectura técnica

Web Push estándar con VAPID. Piezas:

| Pieza | Detalle |
| --- | --- |
| Claves VAPID | Se generan una vez; 2 env vars nuevas (la pública sí puede llevar prefijo `VITE_`, la privada no) |
| Tabla `push_suscripciones` | `endpoint` (UNIQUE), claves `p256dh`/`auth`, `temas` (jsonb o text[]), `usuario_id uuid NULL`, `creada_en`. Añadirla a `TABLAS` en `api/_db.js` o el health check no la vigila |
| Endpoint `POST/DELETE /api/push` | Edge; alta/baja/actualización de la suscripción del dispositivo |
| Service worker | Añadir handlers `push` (mostrar notificación) y `notificationclick` (abrir la URL del evento) a `public/service-worker.js` — hoy solo hace caching |
| Envío servidor | Librería `web-push` (npm). **Solo runtime Node**, no Edge: se une al grupo de excepciones Node ya existente (`chat.js`, `sync-events.js`, `imagen.js`) |
| UI de opt-in | Diálogo con tres modos: "Todos" / chips de categorías / chips de organizadores. Duplicar las preferencias en localStorage para pintar la UI sin pedirle nada al servidor |

### Disparador: digest diario enganchado al cron existente

`/api/sync-events` (cron diario 07:00 UTC) ya calcula `agregados` — los
eventos nuevos detectados en las fuentes externas. El envío de fase 1 es un
digest diario desde ese mismo cron: etiquetar cada evento nuevo con sus temas
(`cat:` + `org:` resueltos desde `fuente` / prefijo del id) y enviar a cada
suscripción cuyos temas intersequen. Para los eventos de organizaciones
(Neon) hay dos opciones: incluirlos en el mismo digest comparando contra la
última ejecución, o disparar al publicar (`POST`/`PATCH → publicado` en
`api/admin/eventos.js` llamando a un módulo de envío Node). El digest agrupa,
evita spam y no toca los handlers Edge — es el punto de partida.

Mantenimiento: los endpoints de push caducan; cuando el envío devuelve
404/410, se borra la fila inline. Sin cron de limpieza aparte.

Volumen: enviar es una petición HTTP por suscripción. Para el tamaño del
municipio (cientos/pocos miles de suscriptores) cabe de sobra en una función
con el timeout actual de Vercel enviando en lotes concurrentes; no hace falta
cola hasta un orden de magnitud más.

## Restricción de producto: iOS

Safari soporta Web Push desde iOS 16.4 **solo si la PWA está instalada en la
pantalla de inicio** — en la pestaña del navegador no existe. El flujo iOS es
"instala la app → luego activa avisos", y el `InstallPrompt.jsx` existente
pasa de extra a puerta de entrada de la feature. Además el permiso de
notificaciones debe pedirse desde un gesto del usuario (click), nunca al
cargar. En Android y escritorio funciona sin instalar.

## Fases

1. **Fase 1 — push anónima por temas (esfuerzo bajo).** Tabla, claves VAPID,
   handlers del SW, `POST/DELETE /api/push`, módulo de envío Node en el cron
   (digest diario), UI de opt-in en Eventos + guía de instalación iOS.
2. **Fase 2 — favoritos y recordatorios.** Marcar eventos concretos y recibir
   "mañana: <evento>". Necesita un segundo cron (o ampliar el existente) y
   verificar que los ids externos son estables entre regeneraciones del JSON.
3. **Fase 3 — cuenta de vecino (solo si hay demanda real de valor de
   cuenta).** Registro sin código, sesión larga, verificación de email,
   adopción de las suscripciones anónimas del dispositivo.

## Deudas que bloquean la Opción B (cuenta de vecino)

No afectan a la fase 1, pero deben resolverse antes de abrir registro público:

- **Hash de contraseñas.** `hashPassword()` en `api/_auth.js` es SHA-256 sin
  salt — tolerable para gestores invitados, inaceptable para registro masivo.
  Migrar a PBKDF2 (WebCrypto, compatible Edge) con re-hash transparente en el
  login.
- **Sesión de 8 horas.** Pensada para gestores; un vecino necesita sesiones
  largas (30–90 días) para su rol.
- **Registro abierto = abuso posible.** Rate-limiting y, idealmente,
  verificación de email — primera dependencia de envío de emails del proyecto.
- **El candado global (`AccessScreen` + `VITE_APP_PASSWORD`) choca con el
  registro abierto.** Decidir si el login de vecino lo sustituye, conviven o
  desaparece. Decisión de producto previa, no técnica.

## Nota de negocio

"N vecinos están suscritos a tus avisos" es una métrica que refuerza el
modelo de destacados y renovaciones: guardar el tema con el slug del
organizador desde el principio (aunque la UI de fase 1 solo ofrezca TYL TYL y
Ayuntamiento) deja ese dato acumulándose gratis, igual que ya hace
`clic_destacado`.
