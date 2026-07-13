# Integración de Umami Analytics

Guía completa para desplegar y conectar Umami a Navalcarnero Vecinal.

---

## 1. Desplegar Umami en Vercel

```bash
# Clona el repo oficial (es Next.js, no necesitas tocarlo)
git clone https://github.com/umami-software/umami.git umami-navalcarnero
cd umami-navalcarnero
npm install

# Despliega con Vercel CLI
npx vercel --prod
```

Durante el asistente de Vercel, añade estas **env vars**:

| Variable       | Valor                                                                    |
|----------------|--------------------------------------------------------------------------|
| `DATABASE_URL` | Connection string de tu nueva base de datos Neon (ver paso 1b)           |
| `APP_SECRET`   | String aleatorio largo — genera con `openssl rand -hex 32`              |

### 1b. Base de datos Neon para Umami

1. Ve a [neon.tech](https://neon.tech) → **New Project**
2. Nombre: `umami-navalcarnero` (proyecto **separado** del de la app)
3. Copia la *pooled connection string* (con `?sslmode=require`)
4. Pégala como `DATABASE_URL` en las env vars de Vercel

Umami inicializará el schema automáticamente en el primer arranque.

### 1c. Configuración inicial de Umami

1. Abre `https://tu-umami.vercel.app` → login con `admin` / `umami`
2. **Cambia la contraseña inmediatamente** (Settings → Profile)
3. Ve a **Settings → Websites → Add website**
   - Nombre: `Navalcarnero Vecinal`
   - Domain: `navalcarnero-vecinal.vercel.app`
4. Copia el **Website ID** (UUID) que aparece en el snippet de tracking
5. Ve a **Settings → API Keys → Create** → copia el token generado

---

## 2. Configurar env vars en tu app principal

### `.env` (desarrollo local)

```env
# Umami tracking (expuesto al frontend — prefijo VITE_ requerido)
VITE_UMAMI_SCRIPT_URL=https://tu-umami.vercel.app/script.js
VITE_UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Umami API (solo servidor — sin prefijo VITE_)
UMAMI_API_URL=https://tu-umami.vercel.app
UMAMI_API_TOKEN=tu-api-token-de-umami
UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> ⚠️ `VITE_UMAMI_WEBSITE_ID` y `UMAMI_WEBSITE_ID` tienen el mismo valor UUID,
> pero uno va al frontend (para el script de tracking) y otro al servidor (para la API).

### Variables en Vercel (producción)

Añade las mismas 5 variables en:
**Vercel Dashboard → tu proyecto → Settings → Environment Variables**

No añadas el prefijo `VITE_` a las variables de servidor — Vercel ya las gestiona correctamente.

---

## 3. Modificar `index.html`

Añade este bloque en el `<head>`, justo antes de `</head>`:

```html
<!-- Umami Analytics — autohosted, privacy-first, GDPR-compliant -->
<!-- Variables sustituidas por Vite en build time -->
<script
  defer
  src="%VITE_UMAMI_SCRIPT_URL%"
  data-website-id="%VITE_UMAMI_WEBSITE_ID%"
  data-domains="navalcarnero-vecinal.vercel.app"
></script>
```

El atributo `data-domains` evita que Umami trackee tus visitas locales en `localhost`.

---

## 4. Añadir `UmamiStats` al panel `/admin/super`

En tu página `src/pages/admin/SuperAdmin.jsx` (o como se llame), importa y usa el componente:

```jsx
import UmamiStats from "../../components/admin/UmamiStats";

// Dentro del JSX de la sección analytics:
<UmamiStats
  umamiDashboardUrl="https://tu-umami.vercel.app/websites/TU_WEBSITE_ID"
/>
```

---

## 5. Trackear eventos personalizados

El hook `useUmami` permite enviar eventos desde cualquier componente:

```jsx
import { useUmami } from "../../lib/useUmami";

function Asistente() {
  const { trackEvent } = useUmami();

  function handleSendMessage(message) {
    trackEvent("chat_question", { length: message.length });
    // ... lógica de envío
  }
}
```

Eventos recomendados para convencer a comercios:

| Evento                | Cuándo dispararlo                                    |
|-----------------------|------------------------------------------------------|
| `chat_question`       | Cada pregunta al asistente IA                        |
| `business_search`     | Al filtrar el directorio por categoría               |
| `business_view`       | Al abrir el detalle de un comercio                   |
| `event_click`         | Al ver el detalle de un evento                       |
| `route_search`        | Al buscar paradas o líneas de bus                    |
| `news_read`           | Al abrir una noticia completa                        |

---

## 6. Cómo funciona el proxy API (`api/analytics/umami-stats.js`)

El panel admin no llama a Umami directamente desde el navegador (eso expondría tu token).
En su lugar:

```
Navegador → GET /api/analytics/umami-stats?period=7d
            → Vercel Function → Umami API (con token seguro)
            → JSON de vuelta al navegador
```

La respuesta se cachea 5 minutos (`Cache-Control: max-age=300`) para no saturar Umami.

---

## Arquitectura final

```
┌─────────────────────────────────────────┐
│  Navalcarnero Vecinal (Vercel)           │
│                                          │
│  index.html                              │
│    └─ <script> → umami.vercel.app/script │  pageviews automáticos
│                                          │
│  src/lib/useUmami.js                     │  eventos personalizados
│    └─ window.umami.track(...)            │
│                                          │
│  api/analytics/umami-stats.js           │
│    └─ fetch(umami API, Bearer token)    │  métricas en el admin
│                                          │
│  src/components/admin/UmamiStats.jsx    │
│    └─ fetch(/api/analytics/umami-stats) │  UI en /admin/super
└─────────────────────────────────────────┘
            │ datos enviados a
            ▼
┌─────────────────────────────────────────┐
│  Umami (proyecto separado en Vercel)    │
│    └─ Neon DB "umami-navalcarnero"      │
└─────────────────────────────────────────┘
```