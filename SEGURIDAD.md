# Auditoría de seguridad

> **Estado: informe de auditoría (julio 2026).** Análisis de la superficie
> completa (27 endpoints API, autenticación, subida de imágenes, frontend,
> cabeceras HTTP y configuración) sin modificar código. Recoge las
> vulnerabilidades detectadas ordenadas por gravedad, con su solución, pensado
> para un despliegue de uso municipal (referencias a ENS / CCN-STIC y OWASP).

## Resumen

La base es sólida: SQL siempre parametrizado, aislamiento multi-tenant por JWT
firmado, React sin `innerHTML`, secretos fuera de git y comparaciones en tiempo
constante. Quedan **4 vulnerabilidades altas**, **4 medias** y varias
carencias de cumplimiento que un despliegue institucional exige resolver.

| # | Gravedad | Título | Esfuerzo |
| --- | --- | --- | --- |
| 1 | 🔴 Alta | Candado de acceso decorativo (contraseña en el bundle) | Medio |
| 2 | 🔴 Alta | Hash de contraseñas SHA-256 sin salt | Medio |
| 3 | 🔴 Alta | Cron `sync-events` roto y abierto a la vez | Bajo |
| 4 | 🔴 Alta | Sin rate-limiting en login/registro/track | Medio |
| 5 | 🟠 Media | Faltan cabeceras de seguridad HTTP (CSP incluida) | Medio |
| 6 | 🟠 Media | Cookie no `__Host-`, sin defensa CSRF explícita | Bajo |
| 7 | 🟠 Media | Asistente IA: inyección de prompt y coste | Medio |
| 8 | 🟠 Media | Fuga de detalle de error en `chat.js` | Bajo |

---

## 🔴 Altas

### 1. El candado de acceso es decorativo: la contraseña viaja en el bundle

`src/components/AccessScreen.jsx` compara
`password === import.meta.env.VITE_APP_PASSWORD` **en el cliente**. Cualquier
variable `VITE_*` se incrusta en texto plano en el JS de producción: basta
abrir DevTools y buscarla. Además la "sesión" es
`localStorage.setItem('ncv_access', 'true')`, que se puede escribir a mano en
la consola sin conocer la contraseña.

**Solución.** Mover la verificación al servidor: un `POST /api/acceso` (Edge)
que compare contra una env var **sin** prefijo `VITE_` en tiempo constante
(reutilizando `igualSeguro` de `api/_auth.js`) y emita una cookie httpOnly
firmada con caducidad larga (payload `{rol:'vecino-anonimo'}`). Toda la
infraestructura de firma/verificación de `_auth.js` ya existe. Si el candado
es solo para la beta y va a desaparecer al abrir la app al público, la
alternativa honesta es documentarlo como cosmético y no presentarlo como
control de acceso.

### 2. Hash de contraseñas SHA-256 sin salt

`hashPassword()` en `api/_auth.js` es un SHA-256 pelado. Sin salt, dos usuarios
con la misma contraseña comparten hash, y una filtración de la tabla
`usuarios` se rompe con rainbow tables/GPU en minutos. Para un sistema
municipal es incumplimiento directo de las guías CCN-STIC.

**Solución.** PBKDF2 con WebCrypto (disponible en Edge): salt aleatorio de 16
bytes por usuario, ≥310.000 iteraciones (recomendación OWASP para
PBKDF2-SHA256), formato almacenado `pbkdf2$<iter>$<salt>$<hash>`. Migración
transparente: en el login, si el hash es del formato viejo y la contraseña es
correcta, re-hashear y actualizar la fila. Los usuarios inactivos que no
migren en unas semanas se fuerzan a restablecer contraseña.

### 3. El cron `/api/sync-events` está roto y abierto a la vez

`api/sync-events.js` comprueba la cabecera `x-vercel-cron-secret`, **que Vercel
no envía** — Vercel manda `Authorization: Bearer <CRON_SECRET>`. Según la
configuración:

- Si `CRON_SECRET` **no** está definida: `undefined !== undefined` es `false`,
  el check pasa **para cualquiera**. Un tercero puede invocar el endpoint a
  voluntad: consume la API de GitHub con el token, genera commits en `main` y
  dispara redeploys (denegación de servicio barata + ruido en el histórico).
- Si **sí** está definida: el propio cron de Vercel recibe 401 y la
  sincronización diaria lleva sin funcionar desde que se añadió el check
  (verificar en los logs).

**Solución.** Leer la cabecera correcta y **fallar cerrado** si el secreto no
está configurado:

```js
const auth = req.headers['authorization']
if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).json({ error: 'No autorizado' })
}
```

Definir `CRON_SECRET` en Vercel pasa a ser obligatorio.

### 4. Cero rate-limiting en login, registro y superadmin

`POST /api/login`, `/api/admin/login` y `/api/registro` no limitan intentos:
permiten fuerza bruta de credenciales y de códigos de invitación.
`/api/analytics/track` es un `INSERT` público sin control: cualquiera puede
inflar la tabla `analytics` indefinidamente (relleno de disco + envenenamiento
de métricas). El único endpoint con límite es `chat.js`, y su limitador en
memoria no sirve en serverless: cada instancia tiene su propio `Map`, así que
el límite real es 10 × (nº de instancias).

**Solución.** Rate-limiting compartido. En Vercel lo natural es **Vercel
Firewall / WAF** (rate rules por ruta, sin código) o **BotID** en los
endpoints de auth. Si se prefiere en app, contador en Neon o Upstash Redis con
clave `ip+ruta` y ventana deslizante. Para login, backoff progresivo por
email/IP. Para `track`, tope por IP y validación de `tipoEvento` contra lista
blanca.

---

## 🟠 Medias

### 5. Faltan cabeceras de seguridad HTTP (incluida CSP)

No hay bloque `headers` en `vercel.json` ni CSP. Sin ellas, no hay segunda
capa ante XSS, clickjacking o sniffing — de los primeros puntos que audita una
revisión ENS/CCN-STIC en un dominio institucional.

**Solución.** Bloque `headers` en `vercel.json` para todas las rutas:

- `Content-Security-Policy` — el reto real. Hoy se cargan fuentes e iconos de
  `fonts.googleapis.com`/`gstatic.com`, el script de Umami desde otra URL,
  tiles de Leaflet (OpenStreetMap) e imágenes de Vercel Blob. La CSP debe
  listar esos orígenes explícitamente (`default-src 'self'`; `img-src 'self'
  https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org
  data:`; `font-src https://fonts.gstatic.com`; etc.). Empezar en
  `Content-Security-Policy-Report-Only` para no romper nada.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictiva (geolocalización solo si la usa el mapa).

Al introducir CSP, el `<script type="module">` y el de Umami de `index.html`
necesitarán nonce o hash.

### 6. La cookie de sesión no es `__Host-` y carece de defensa CSRF explícita

La cookie es `SameSite=Lax`, que mitiga CSRF en la práctica, pero las
mutaciones (POST/PUT/DELETE) no validan `Origin`/`Referer` ni usan token
anti-CSRF, y `Lax` deja pasar navegaciones top-level.

**Solución.** Validar la cabecera `Origin` contra el host propio en todos los
handlers que mutan estado (rechazar si no coincide) y renombrar la cookie al
prefijo `__Host-` (fuerza `Secure` + `Path=/` + sin `Domain`). Considerar
`SameSite=Strict` para la cookie de gestión.

### 7. El asistente IA es vector de inyección de prompt y de coste

`api/chat.js` reenvía el historial del cliente al modelo sin más filtro que el
recorte a 10 mensajes. Un usuario puede intentar prompt-injection (extraer el
system prompt, hacer que el bot hable con autoridad en nombre del Ayuntamiento)
y, sin rate-limit efectivo (ver #4), inflar la factura de Anthropic. Nota
menor: el modelo por defecto `claude-sonnet-4-6` en el código no coincide con
`claude-opus-4-8` que documenta CLAUDE.md — alinear.

**Solución.** Rate-limit persistente por IP (ver #4), tope de longitud por
mensaje, reforzar en el system prompt que no emita información no verificada ni
hable como autoridad oficial, y un descargo visible ("respuestas orientativas,
verifica en la sede electrónica").

### 8. Fuga de detalle de error en `chat.js`

`api/chat.js` devuelve `detalle: err.message` al cliente, que puede filtrar
internals (nombres de modelo, límites de cuota, trazas del SDK).

**Solución.** Loguear el detalle en servidor y devolver al cliente solo un
mensaje genérico, como ya hace el resto de endpoints.

---

## 🟡 Bajas / cumplimiento legal

- **Sin política de privacidad ni base legal (RGPD/LOPDGDD).** La app recoge
  analytics, emails de gestores y (con la feature push) preferencias de
  vecinos. Un servicio municipal necesita aviso legal, política de privacidad,
  base jurídica del tratamiento y, para push, consentimiento explícito.
  Requisito legal, no técnico.
- **Política CORS de la API sin definir** — los endpoints no fijan cabeceras
  CORS; el riesgo es limitado, pero conviene declararla explícitamente.
- **Dependencias sin auditoría automatizada.** No hay `npm audit` en CI ni
  Dependabot. Añadir escaneo de dependencias.
- **Validación de entradas opacas** — `codStop` en `bus-times.js` (se reenvía
  a la API del CRTM) y `referencia_id` en destacados (texto opaco guardado en
  BD): validar formato aunque hoy no haya inyección directa.

---

## Lo que ya está bien

Para el informe de cara al Ayuntamiento, la aplicación ya cumple:

- SQL siempre parametrizado vía template tags de Neon (sin concatenación) en
  los 27 endpoints.
- Aislamiento multi-tenant correcto: el slug de organización sale del JWT
  firmado, nunca del request, así que otra organización es un 404, no una
  fuga.
- JWT HS256 con verificación de firma y caducidad en tiempo constante.
- Guards de sesión/superadmin aplicados en todos los endpoints `admin/*` y
  `super/*`.
- Validación de tipo/tamaño y sanitización de nombre de fichero en la subida
  de imágenes.
- React escapa por defecto; no hay `dangerouslySetInnerHTML` ni `innerHTML` en
  todo `src/`.
- Secretos correctamente en `.gitignore`; sin credenciales commiteadas.
- Cookies de sesión `httpOnly` (inaccesibles desde JavaScript) con `Secure` en
  producción.
- El proxy de Umami mantiene las credenciales en servidor: el navegador solo
  ve el JSON agregado.

---

## Orden de corrección sugerido

1. **#3 (cron)** — cambio de unas líneas, tapa un agujero explotable ya.
2. **#8 (fuga de error)** — trivial.
3. **#5 (cabeceras/CSP)** — `vercel.json`, empezando en modo report-only.
4. **#4 (rate-limiting)** — WAF de Vercel cubre login/registro/track sin código.
5. **#1 (candado servidor)** — reutiliza `_auth.js`.
6. **#2 (PBKDF2)** — con migración transparente en el login.
7. **#6, #7** — endurecimiento incremental.
8. **Cumplimiento legal** — en paralelo, es trabajo de producto/jurídico.
