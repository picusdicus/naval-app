# Puesta en marcha del endurecimiento de seguridad

> Checklist de lo que hay que hacer **manualmente** antes de desplegar los
> cambios de seguridad (commit `422a9cc`, rama `feature/seguridad-improvements`).
> El código ya está hecho y verificado; esto son altas de servicios y
> configuración. Sigue los pasos en orden.

## 1. Alta de Upstash Redis (la única suscripción nueva)

Da soporte al rate-limiting (el "portero"). Tier gratuito de sobra.

**Desde el Marketplace de Vercel (recomendado, inyecta las variables solo):**
1. Dashboard de Vercel → proyecto `naval-app` → pestaña **Storage** (o
   **Integrations** → Marketplace).
2. Busca **Upstash → Redis** → *Create / Add*.
3. Crea la base de datos Redis en región **Europa** (p. ej. `eu-west-1`):
   latencia baja y argumento de residencia de datos para el sector público.
4. Conéctala al proyecto `naval-app`. Vercel inyecta las variables solo.
5. **Verifica el nombre exacto** de las variables inyectadas: el código lee
   `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Si la integración las
   inyecta con otro nombre, copia sus valores a esos dos en Settings →
   Environment Variables.

**Coste:** gratis hasta 10.000 comandos/día; el rate-limiting gasta ~2-3 por
login. Sobra de largo.

> Si Upstash **no** está configurado, el sistema hace *fail-open* (no limita) y
> no rompe nada — pero entonces **no hay protección de fuerza bruta**. En
> producción es obligatorio.

## 2. Generar los secretos

En Git Bash:

```bash
openssl rand -base64 32   # valor para CRON_SECRET
```

- **`CRON_SECRET`** → el valor generado. **Obligatorio**: sin él, el cron de
  sincronización rechaza todo (falla cerrado).
- **`APP_ACCESO_PASSWORD`** → la contraseña del candado del portal vecinal (la
  que teclean los vecinos). La eliges tú; puede ser memorizable.

## 3. Configurar las variables en Vercel

Vercel → proyecto → **Settings → Environment Variables**:

| Variable | Valor | Entornos |
| --- | --- | --- |
| `CRON_SECRET` | el `openssl rand` de arriba | Production, Preview |
| `APP_ACCESO_PASSWORD` | la contraseña del portal que elijas | Production, Preview, Development |
| `UPSTASH_REDIS_REST_URL` | inyectada por Upstash (verifica que existe) | todas |
| `UPSTASH_REDIS_REST_TOKEN` | inyectada por Upstash (verifica que existe) | todas |

Y **elimina** la vieja `VITE_APP_PASSWORD` (su prefijo `VITE_` la exponía en el
navegador y ya no se usa).

## 4. Actualizar el entorno local (dev y tests)

En `.env.local` (o `.env`):
- **Añade** `APP_ACCESO_PASSWORD=` con la misma contraseña del portal (los e2e la
  necesitan).
- **Añade** `CRON_SECRET=` si quieres probar el cron en local.
- `UPSTASH_*` es opcional en local (sin ellas no hay rate-limit en dev, cómodo
  para desarrollar).
- **Quita** `VITE_APP_PASSWORD`.

Lo más limpio es sincronizar desde Vercel:
```bash
npx vercel env pull .env.local
```

## 5. Ejecutar los tests e2e

Con `APP_ACCESO_PASSWORD` en `.env.local`:
```bash
npm run test:e2e
```
No se corrieron automáticamente porque tocan Neon y Blob reales y necesitan esa
clave nueva. Los tres specs afectados ya están adaptados (`imagen-evento`,
`perfil-organizacion`, y el helper `abrirCandado` en `e2e/entorno.js`). Si
alguno falla, casi seguro falta `APP_ACCESO_PASSWORD` en el entorno.

## 6. Desplegar y vigilar la CSP

1. Haz un **deploy de preview** (push de la rama o `vercel`).
2. Navega por **todo**: mapa (tiles OpenStreetMap), fuentes, imágenes de eventos
   (Vercel Blob), asistente, y que Umami siga registrando.
3. Abre DevTools → consola. La CSP está en **Report-Only**: solo *avisa*, no
   bloquea. Si aparece una violación de un origen legítimo que falte, se añade a
   la CSP.
4. Cuando esté limpia unos días, **promuévela a activa** cambiando en
   `vercel.json` la clave `Content-Security-Policy-Report-Only` por
   `Content-Security-Policy`. Es un cambio de una palabra.

## 7. Verificar el cron tras fijar `CRON_SECRET`

Vercel → proyecto → **Logs / Cron Jobs**: la ejecución diaria de
`/api/sync-events` (07:00 UTC) debe devolver **200**, no 401. Un 401 significa
que `CRON_SECRET` no está bien puesta.

## Cosas que pasan solas (no hay que hacer nada)

- **Contraseñas de usuarios existentes**: se migran a PBKDF2 automáticamente en
  su próximo login. No hay que tocar la base de datos ni resetear a nadie.
- **Sesiones abiertas**: al desplegar, las cookies cambian de nombre
  (`__Host-`) en producción, así que gestores y vecinos tendrán que **volver a
  iniciar sesión / reintroducir el candado una vez**. Efecto único y esperado.

## Recordatorios (de la fase de análisis)

- Para uso municipal necesitas el **plan Vercel Pro** (~20 $/mes + consumo), por
  licencia comercial, no por capacidad. Ver `ARQUITECTURA_ESCALABILIDAD.md`.
- Queda pendiente el **papeleo legal (RGPD / aviso legal)**: trabajo jurídico,
  no técnico. Ver `SEGURIDAD.md` (sección de cumplimiento).

---

Referencias: [SEGURIDAD.md](SEGURIDAD.md) (auditoría completa),
[FLUJO_SEGURIDAD.md](FLUJO_SEGURIDAD.md) (explicación en simple),
[ARQUITECTURA_ESCALABILIDAD.md](ARQUITECTURA_ESCALABILIDAD.md) (Vercel/coste).
