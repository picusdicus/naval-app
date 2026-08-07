# Implementación: Panel "Mi Comercio" Mejorado

## Cambios realizados (7 de agosto de 2026)

### 1. Base de datos
**Archivo**: `db/schema.sql`

Se agregaron 5 nuevas columnas a la tabla `comercios_perfil` para las redes sociales:
- `linkedin` (text, hasta 255 caracteres)
- `facebook` (text, hasta 255 caracteres)
- `instagram` (text, hasta 255 caracteres)
- `twitter` (text, hasta 255 caracteres)
- `tiktok` (text, hasta 255 caracteres)

**Ejecución**: `npm run db:setup` aplicará los cambios (idempotente).

---

### 2. API Backend

#### Endpoint: `api/admin/comercio-perfil.js` (Edge)
**Cambios**:
- Foto principal ahora es **obligatoria** (validación server-side)
- Fotos adicionales: array de URLs (filtradas de valores vacíos)
- 5 nuevos campos de redes sociales (validación de longitud)
- Selects SQL actualizados para leer/escribir redes sociales

#### Endpoint: `api/admin/imagen-comercio-adicional.js` (Node - NUEVO)
**Función**: Subir múltiples fotos adicionales a Vercel Blob
- Método: `POST /api/admin/imagen-comercio-adicional`
- Auth: Requiere sesión de organización
- Input: Array de data URLs base64 (máx 5 imágenes, 3 MB c/u)
- Output: Array de URLs públicas de Blob
- Almacenamiento: `comercios/{comercio_id}/fotos/{n}.webp`
- Defensas: CSRF, autenticación, validación de tipo MIME, tamaño

**Credenciales de Blob**:
- Usa `BLOB_READ_WRITE_TOKEN` si está disponible (preferido en dev)
- Fallback a OIDC en producción (Vercel lo inyecta)
- Retorna 503 si no hay credenciales configuradas

---

### 3. Frontend

#### Componente: `src/components/admin/SelectorImagenesMultiples.jsx` (NUEVO)
**Funcionalidad**:
- Galería visual de imágenes seleccionadas (grid 5 columnas)
- Botón flotante para agregar fotos (cuando < 5)
- Botón de eliminar con overlay hover
- Validación local: formato (JPG/PNG/WebP), tamaño (3 MB)
- Lee archivos como data URLs (almacenadas en state React)

**Props**:
- `imagenes`: array de data URLs o URLs públicas ya subidas
- `onCargar`: callback con nuevo array de imagenes
- `maxImagenes`: máximo (default 5)
- `etiqueta`: texto de encabezado

#### Componente: `src/pages/panel/AdminComercioForm.jsx` (modificado)
**Cambios en la UI**:
1. **Foto Principal**:
   - Marcada como obligatoria (`*` rojo)
   - Usa `SelectorImagen` (subida directa a Blob)
   - Mensaje de error si no se cargó antes de guardar
   - Indicador visual si está cargada

2. **Fotos Adicionales**:
   - Usa nuevo `SelectorImagenesMultiples`
   - Permite cargar hasta 5 fotos
   - Visualización de miniaturas con delete

3. **Nueva sección: Redes Sociales**:
   - 5 campos de URL (Facebook, Instagram, Twitter/X, LinkedIn, TikTok)
   - Iconos de Material Symbols junto a cada campo
   - Opcional, máx 255 caracteres c/u
   - Validación de formato (tipo URL)

**Cambios en la lógica**:
- `guardar()` ahora valida foto principal (obligatoria)
- Si hay fotos adicionales en formato base64, llama a `/api/admin/imagen-comercio-adicional`
- Espera URLs subidas y las reemplaza antes de guardar el perfil
- Estados para los 5 nuevos campos de redes sociales
- Carga redes sociales desde perfil existente

**Estado local**:
```javascript
const [fotoPrincipal, setFotoPrincipal] = useState(null)  // URL Blob
const [fotos, setFotos] = useState([])                     // Array de URLs
const [linkedin, setLinkedin] = useState('')
const [facebook, setFacebook] = useState('')
const [instagram, setInstagram] = useState('')
const [twitter, setTwitter] = useState('')
const [tiktok, setTiktok] = useState('')
```

---

### 4. Flujo de Guardado Completo

```
1. Usuario carga foto principal → SelectorImagen sube a Blob inmediatamente
2. Usuario carga fotos adicionales → SelectorImagenesMultiples almacena como data URLs (no sube)
3. Usuario completa redes sociales + otros campos
4. Usuario hace clic "Guardar cambios":
   a. Validaciones locales (foto principal, longitudes, coordinadas)
   b. Si hay fotos adicionales en base64:
      - Envía POST a /api/admin/imagen-comercio-adicional
      - Espera respuesta con array de URLs
      - Reemplaza data URLs locales por URLs públicas
   c. Envía PUT a /api/admin/comercio-perfil con todos los datos
   d. Perfil se guarda en BD (upsert)
   e. Interfaz recarga datos desde respuesta
   f. Mensaje de éxito o error
```

---

### 5. Seguridad

#### Defensas en `api/admin/imagen-comercio-adicional.js`:
- ✅ Autenticación: `requerirSesion()` (token JWT)
- ✅ CSRF: `csrfInvalido()` por Origin
- ✅ Validación tipo MIME: solo JPG/PNG/WebP
- ✅ Validación tamaño: máx 3 MB por imagen
- ✅ Validación cantidad: máx 5 imágenes
- ✅ Validación formato: data URLs válidas con base64
- ✅ Validación ownership: comercio_id debe pertenece a la org

#### Defensas en `api/admin/comercio-perfil.js`:
- ✅ Foto principal obligatoria (server-side)
- ✅ Validación longitud de campos
- ✅ Validación coordenadas (números válidos)
- ✅ Filtrado de fotos vacías

---

### 6. Cambios en la BD

**Schema**:
```sql
ALTER TABLE comercios_perfil ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE comercios_perfil ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE comercios_perfil ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE comercios_perfil ADD COLUMN IF NOT EXISTS twitter text;
ALTER TABLE comercios_perfil ADD COLUMN IF NOT EXISTS tiktok text;
```

**Ejecución**: Idempotente, no causa problemas si ya existen.

---

### 7. Testing Local

1. Aplicar cambios de BD:
   ```bash
   npm run db:setup
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Acceder a `/panel` (requiere estar logueado como organización con comercio)

4. Ir a pestaña "Mi Comercio"

5. Probar:
   - ✓ Carga foto principal (obligatoria)
   - ✓ Agregar/eliminar fotos adicionales
   - ✓ Editar redes sociales
   - ✓ Guardar cambios
   - ✓ Recargar página y verificar persistencia

---

### 8. Pre-llenado de Datos del Comercio

**Flujo en `AdminComercioForm.jsx`**:
1. Al cargar el formulario, obtiene el `comercioId` desde la API
2. Busca el comercio en los JSONs (`comercios.json` + `servicios-locales.json`)
3. Si **no hay perfil guardado**:
   - Pre-llena campos con datos del JSON (dirección, teléfono, horarios, coordenadas, Instagram)
   - Usuario solo necesita agregar foto principal + completar redes + guardar
4. Si **ya hay perfil**:
   - Carga datos del perfil (tiene prioridad)
   - Pueden ser editados

**Campos pre-rellenados** (del JSON):
- `descripcion` (si existe)
- `horarios` (si existe, formato JSON)
- `foto` / `fotoPrincipal` (si existe)
- `fotos` (si existe, array)
- `web`, `telefono`, `direccion` (si existen)
- `lat`, `lng` (si existen)
- `instagram` (si existe)

---

### 9. Visualización en Perfil Público

**Cambios en `PerfilComercio.jsx`**:

1. **Foto Principal**:
   - Ya estaba funcionando, ahora siempre se muestra (perfil o JSON)
   - Reemplaza el icono de tienda gris

2. **Galería de Fotos Adicionales** (NUEVA):
   - Solo aparece si hay fotos en `fotos` array
   - Grid responsivo: 2 columnas en móvil, 3 en desktop
   - Hover effect: zoom suave `scale-105`
   - Soporte para URLs públicas de Blob

3. **Redes Sociales** (NUEVA):
   - Nueva sección "Síguenos en redes"
   - Botones con iconos y etiquetas
   - Solo aparece si hay al menos una red social
   - Cada botón abre en tab nueva
   - Diseño consistente con el sistema: borde, hover, terracota

**Ejemplo visual** (PerfilComercio):
```
┌─────────────────────────────────────┐
│        [Foto Principal]              │ ← 264px de alto
└─────────────────────────────────────┘

Título | Botón Editar

Sobre nosotros
─────────────────────

Horarios
─────────────────────

Contacto
✓ Teléfono
✓ Web
✓ Dirección
─────────────────────

Síguenos en redes          (NUEVO)
[Facebook] [Instagram] [Twitter]...
─────────────────────

Galería                    (NUEVO)
[Foto 1] [Foto 2] [Foto 3]
[Foto 4] [Foto 5]
─────────────────────

Ubicación (mapa)
─────────────────────
```

---

### 10. Consideraciones de Diseño

**Por qué foto principal es obligatoria**:
- La ficha de comercio sin foto es incompleta visualmente
- En el perfil público, reemplaza el icono gris y mejora la presentación
- Fuerza a los dueños a proporcionar contenido visual de calidad

**Por qué fotos adicionales no se suben en tiempo real**:
- El componente `SelectorImagenesMultiples` almacena data URLs localmente
- Solo se suben cuando se guarda el formulario completo (fewer requests)
- Si hay error, las fotos se pierden, pero el usuario puede reintentar

**Pre-llenado automático del formulario**:
- Busca el comercio en los JSONs y pre-llena campos disponibles
- Reduce fricción: el dueño no copia datos que ya están en la app
- Foto del JSON actúa de fallback si el perfil no tiene foto principal
- Los datos del perfil (si existe) siempre tienen prioridad

**Por qué redes sociales van en `comercios_perfil` y no en `organizaciones`**:
- El perfil enriquecido es específico del comercio, no de la org
- Una org puede tener contacto corporativo; un comercio tiene contactos propios
- Coherencia con otros campos (`descripcion`, `horarios`, `direccion`)

**Estructura de fotos en BD**:
- Se almacena como `jsonb` (array), no como columnas separadas
- Permite until 5+ en el futuro sin migración
- Índices no necesarios (búsquedas raras por foto)
- Galería en perfil público filtra `null`/vacíos automáticamente

**Redes sociales en perfil público**:
- Solo aparecen si están guardadas en el perfil
- Se muestran como botones, no como texto (mejor UX)
- Iconos de Material Symbols mantienen coherencia visual
- Enlaces abren en tab nueva (no pierden contexto de la app)

---

### 11. Cambios Adicionales (Octubre 7)

**Archivos Modificados**:
- `src/lib/comerciosHelper.js`: +5 campos de redes sociales en `datosComercios()`
- `src/pages/PerfilComercio.jsx`: +galería de fotos, +redes sociales, carga datos de perfil
- `src/pages/panel/AdminComercioForm.jsx`: pre-llenado automático con datos del JSON

**Comportamiento**:
1. Usuario abre `/panel` → pestaña "Mi Comercio"
2. Formulario carga y busca el comercio en JSON
3. Si es primera vez, pre-llena con datos estáticos (dirección, teléfono, etc.)
4. Usuario agrega foto principal obligatoria
5. (Opcional) Agrega fotos adicionales, redes sociales
6. Guarda → datos en BD, URLs de Blob en fotos adicionales
7. Usuario visita `/comercios/{id}` (perfil público)
8. Ve foto principal, galería de fotos, botones de redes sociales

---

### 12. Checklist de Deployment

- [ ] Ejecutar `npm run db:setup` en el entorno (aplica schema)
- [ ] `BLOB_READ_WRITE_TOKEN` debe estar en variables de Vercel
- [ ] Probar subida de foto principal en staging
- [ ] Probar subida de múltiples fotos adicionales
- [ ] Probar guardado de redes sociales
- [ ] Verificar que las URLs de fotos aparecen en el JSON respuesta
- [ ] Verificar que la ficha pública (`PerfilComercio`) muestra fotos y redes
