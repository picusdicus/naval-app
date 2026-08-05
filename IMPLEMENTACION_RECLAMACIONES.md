# Implementación: Reclamación y Gestión de Comercios + Botón Compartir

**Fecha:** 31 de julio de 2026  
**Status:** ✅ Completado  
**Ramas:** feature/reclamacion-comercios, feature/boton-compartir

## Resumen Ejecutivo

Se ha implementado un sistema completo para que los dueños de comercios reclamen sus fichas y gestionen su perfil enriquecido, así como un botón nativo de compartir la app. 

### Flujo Principal

1. **Reclamación Anónima** → Dueño rellena formulario (anónimo, con reCAPTCHA v3 + rate-limit)
2. **Aprobación Superadmin** → `/admin` pestaña "Reclamaciones" revisa y aprueba
3. **Org Automática** → Se crea org con tipo cultural si el comercio es de ocio_cultura
4. **Código Generado** → Superadmin genera código vinculado al comercio_id
5. **Registro** → Dueño se registra con ese código
6. **Panel** → `/panel` pestaña "Mi comercio" para editar perfil enriquecido
7. **Público** → `/comercios/:id` muestra perfil con datos del JSON como fallback

---

## Estructura de Cambios

### Fase 0: Base de Datos (`db/schema.sql`)

Añadidas 2 tablas + 1 columna:

```sql
-- Solicitudes de reclamación anónimas
CREATE TABLE IF NOT EXISTS solicitudes_reclamacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id text NOT NULL,
  nombre text NOT NULL,
  email text NOT NULL,
  telefono text,
  mensaje text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' 
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Perfil enriquecido de comercio
CREATE TABLE IF NOT EXISTS comercios_perfil (
  comercio_id text PRIMARY KEY,
  organizacion_id uuid REFERENCES organizaciones(id) ON DELETE CASCADE,
  descripcion text,
  horarios jsonb,
  foto_principal text,
  fotos jsonb,
  web text,
  telefono text,
  direccion text,
  lat numeric,
  lng numeric,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Vinculación de código con comercio
ALTER TABLE codigos_invitacion ADD COLUMN IF NOT EXISTS comercio_id text;
```

### Fase 1: Endpoints de API

#### `api/solicitar-reclamacion.js` (Edge, POST público)
- Recibir: `{ comercioId, nombre, email, telefono, mensaje, recaptchaToken }`
- Validaciones: reCAPTCHA v3 score >= 0.5, rate-limit 5/hora por IP
- INSERT en `solicitudes_reclamacion` con `estado='pendiente'`

#### `api/super/reclamaciones.js` (Edge, GET/PATCH superadmin)
- GET: listar solicitudes (filtrado por estado)
- PATCH: aprobar → crea org + vincula + genera código
- **Tipo cultural:** Si categoría == 'ocio_cultura', org nace con `categoria_defecto='cultura'`

#### `api/admin/comercio-perfil.js` (Edge, GET/PUT org-scoped)
- GET: obtiene perfil del comercio de la org
- PUT: upsert del perfil (descripción, horarios, fotos, contacto, ubicación)
- Validaciones: longitudes, formato de horarios, coordenadas

#### `api/admin/imagen-comercio.js` (Node, POST)
- Sube imágenes a Vercel Blob
- Rutas: `comercios/<id>/principal.webp` + `comercios/<id>/fotos/<n>.webp`

#### `api/comercios.js` (Edge, GET público)
- Obtiene perfil del comercio por ID
- Fallback: si no existe, retorna `{ perfil: null }`

### Fase 2: Helpers

#### `src/lib/comerciosHelper.js`
- `datoComercio(perfil, json, campo)` → precedencia perfil > json
- `datosComercios(perfil, json)` → merge completo
- `buscarComercioEnJson(id, comercios, servicios)` → búsqueda

#### `src/lib/imageOptimizer.js`
- `optimizarImagen(file, maxWidth)` → redimensiona + convierte a WebP
- `validarImagen(file, maxMB)` → valida tipo y tamaño

#### `src/lib/horarios.js`
- `horarioValido(horarios)` → valida estructura JSON
- `formatearHorarios(horarios)` → texto legible
- `horariosVacios()` → inicializa con 7 días

#### `src/lib/useRecaptcha.js`
- Hook React: `useRecaptcha()` → `{ getToken(action), cargando, error }`

### Fase 3: Modificación de Auth

**`api/registro.js`:**
- Lee `comercio_id` del código de invitación
- Si presente: `UPDATE organizaciones SET comercio_id = ...`
- Org queda vinculada automáticamente

### Fase 4: Panel del Dueño

**`src/pages/panel/AdminComercioForm.jsx`:**
- Nueva pestaña en `/panel` → "Mi comercio"
- Campos: foto principal, descripción, horarios (7 días), fotos adicionales, web, teléfono, dirección, lat/lng
- GET/PUT a `/api/admin/comercio-perfil`

**Modificado `src/pages/panel/AdminPanel.jsx`:**
- Nueva pestaña con icono `storefront`
- Renderiza `AdminComercioForm`

### Fase 5: Superadmin

**`src/components/admin/super/TableReclamaciones.jsx`:**
- Lista solicitudes con filtros (pendiente/aprobada/rechazada)
- Botones [Aprobar] [Rechazar]
- Muestra código generado (copiable) al aprobar
- Foto pequeña + detalle de solicitante + mensaje

**Modificado `src/pages/admin/AdminSuperPanel.jsx`:**
- Nueva pestaña "Reclamaciones"
- Importa `TableReclamaciones`

### Fase 6: Vistas Públicas

**`src/components/directorio/DialogoReclamarComercio.jsx`:**
- Modal anónimo sin auth
- Campos: nombre, email, teléfono (opt), mensaje
- reCAPTCHA v3 + POST a `/api/solicitar-reclamacion`
- Confirmación al enviar

**`src/pages/PerfilComercio.jsx`:**
- Ruta: `/comercios/:id`
- Busca comercio en JSONs + carga perfil si existe
- Secciones: encabezado, descripción, horarios, contacto, mapa
- Botón "Reclamar comercio" si no tiene perfil

**Modificado `src/App.jsx`:**
- Nueva ruta: `<Route path="/comercios/:id" element={<PerfilComercio />} />`
- Importa `PerfilComercio`

### Fase 7: Botón Compartir

**`src/components/BotonCompartir.jsx`:**
- Share API nativa en móvil (WhatsApp, Telegram, etc.)
- Fallback escritorio: popover con "Copiar enlace" + "WhatsApp Web"
- URL: `VITE_APP_URL` o `window.location.origin`
- Texto: "Descubre la app de los vecinos de Navalcarnero 👉 [URL]"

**Modificado `src/pages/Inicio.jsx`:**
- Importa `BotonCompartir`
- Monta en hero (móvil) bajo el masthead

---

## Variables de Entorno Necesarias

```env
# Reclamaciones
RECAPTCHA_SECRET_KEY=tu_secret_key_v3
VITE_RECAPTCHA_SITE_KEY=tu_site_key_v3

# Compartir (opcional, fallback a window.location.origin)
VITE_APP_URL=https://naval-app-one.vercel.app
```

---

## Testing / Verificación

### Local (npm run dev)

1. **Reclamación anónima:**
   ```bash
   curl -X POST http://localhost:5173/api/solicitar-reclamacion \
     -H "Content-Type: application/json" \
     -d '{
       "comercioId":"gpl_123",
       "nombre":"Juan García",
       "email":"juan@example.com",
       "telefono":"+34612345678",
       "mensaje":"Tengo el NIF...",
       "recaptchaToken":"test_token"
     }'
   ```

2. **Aprobar desde superadmin:**
   - Ir a `/admin` → "Reclamaciones" → [Aprobar]
   - Copiar código generado

3. **Registrar con código:**
   - Ir a `/registro`
   - Usar código del paso anterior
   - La org quedará vinculada al `comercio_id`

4. **Editar perfil:**
   - `/panel` → "Mi comercio" → llenar formulario
   - Guardar cambios

5. **Ver perfil público:**
   - `/comercios/gpl_123` (debe mostrar foto + descripción)
   - Sin perfil: mostrar JSON + botón "Reclamar"

6. **Compartir:**
   - `/` (Inicio)
   - Móvil: botón abre Share API
   - Escritorio: popover con opciones

### E2E (npm run test:e2e)

Pendiente: agregar specs en `e2e/` para el flujo completo (reclamación → aprobación → registro → panel).

---

## Decisiones de Arquitectura

1. **Tipo Cultural Automático:** Si el comercio tiene `categoria='ocio_cultura'`, la org creada nace con `categoria_defecto='cultura'`, permitiéndole publicar eventos como org cultural de inmediato.

2. **Precedencia Fallback:** El perfil siempre gana sobre el JSON, campo a campo. Esto permite enriquecimiento gradual sin sobreescribir datos estáticos.

3. **Horarios Estructurados:** JSON `[{dia, abierto, apertura, cierre}]` permite búsquedas futuras ("abierto ahora") sin sacrificar legibilidad.

4. **Rate-Limit + reCAPTCHA:** Doble defensa contra bots en reclamación anónima.

5. **Share API Nativa:** Móvil siempre prefiere nativo; escritorio popover simple sin deps pesadas.

---

## Próximos Pasos (No Bloqueantes)

- [ ] E2E specs para flujo completo
- [ ] Upload de fotos de galería en formulario (UI hecha, lógica de upload pendiente)
- [ ] Búsqueda de comercios por "abierto ahora" (helper de horarios existe)
- [ ] Renovación automática de destacados vía Stripe (destacados v2)
- [ ] Notificaciones push cuando se aprueba una reclamación

---

## Archivos Creados (12 archivos)

```
api/
├── solicitar-reclamacion.js          (anónimo, reCAPTCHA + rate-limit)
├── comercios.js                       (público, obtener perfil)
├── super/
│   ├── reclamaciones.js               (GET/PATCH, gestión reclamaciones)
│   └── _codigo.js                     (generador de códigos)
└── admin/
    ├── comercio-perfil.js             (GET/PUT, perfil org-scoped)
    └── imagen-comercio.js             (POST, subida a Blob)

src/
├── lib/
│   ├── comerciosHelper.js             (helpers de precedencia)
│   ├── imageOptimizer.js              (optimización browser)
│   ├── horarios.js                    (validación/formateo)
│   └── useRecaptcha.js                (hook reCAPTCHA)
├── components/
│   ├── directorio/
│   │   └── DialogoReclamarComercio.jsx (formulario anónimo)
│   └── BotonCompartir.jsx             (Share API + popover)
└── pages/
    ├── PerfilComercio.jsx             (GET /comercios/:id)
    └── panel/
        └── AdminComercioForm.jsx      (formulario edición)
```

## Archivos Modificados (6 archivos)

```
db/schema.sql                          (+3 crear tablas/columnas)
api/registro.js                        (vincular comercio_id)
src/App.jsx                            (ruta /comercios/:id)
src/pages/Inicio.jsx                   (montar BotonCompartir)
src/pages/panel/AdminPanel.jsx         (pestaña "Mi comercio")
src/pages/admin/AdminSuperPanel.jsx    (pestaña "Reclamaciones")
```

---

## Notas de Implementación

- **Edge vs Node:** Endpoints de crypto/auth en Edge; `imagen-comercio.js` en Node por @vercel/blob
- **Sin migraciones:** Las tablas se crean en `npm run db:setup`; en Vercel se ejecutan al siguiente deploy
- **SameSite cookies:** Ya configurado en `_auth.js`, no requiere cambios
- **Dedup JSON↔Neon:** Ya existe en `dedupEventos.js`; comercios_perfil es adicional sin conflictos

---

**Validación:** ✅ Sintaxis JSX/JS OK | ✅ Imports resueltos | ✅ Schema SQL coherente | ✅ Sin breaking changes
