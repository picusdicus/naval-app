# Actividades con Scraping de URLs

## Resumen

El webhook `api/sync-instagram-noticias.js` ahora detecta URLs en posts municipales de Instagram, scrapea las páginas en cuestión y extrae automáticamente actividades (deportes, talleres, becas) usando Claude, creando múltiples filas en la tabla `actividades` — una por actividad.

## Flujo

### 1. Detección de URL
```javascript
function detectarUrl(caption) {
  const match = caption.match(/(https?:\/\/[^\s]+)/);
  return match ? match[1] : null
}
```

Si el caption contiene una URL, se captura la primera que encuentre.

### 2. Scraping
```javascript
async function scrapearUrl(url) {
  const response = await fetch(url, { timeout: 10000 })
  const html = await response.text()
  return html.substring(0, 51200) // Limitar a 50 KB
}
```

Se descarga el HTML de la URL con timeout de 10s. Limitado a 50 KB para no saturar.

### 3. Extracción con Claude
```javascript
async function extraerActividadesDeHTML(html, publicadoEn) {
  // Claude recibe el HTML y retorna actividades estructuradas
  // Campos: titulo, categoria, fechaLimite, horario, lugar
}
```

Claude analiza el HTML y extrae actividades con estructura JSON:
- **titulo**: nombre de la actividad (ej: "Torneo de Fútbol 7 Infantil")
- **categoria**: `deporte|talleres|infantil|mayores|educacion|ayudas|empleo|general`
- **fechaLimite**: `YYYY-MM-DD` del plazo de inscripción (o null)
- **horario**: ej `"19:30-22:30h"` (opcional)
- **lugar**: ubicación o instalación (opcional)

### 4. Almacenamiento
Cada actividad extraída se inserta en `actividades`:

```sql
INSERT INTO actividades (
  origen_externo_id, titulo, categoria, fecha_limite,
  horario, lugar, imagen_url, url_fuente, publicado_en
)
VALUES (...)
ON CONFLICT (origen_externo_id) DO UPDATE SET ...
```

**ID único**: `ig-{shortCode}-{index}` — permite múltiples actividades del mismo post sin choques.

## Separación de Tablas

### `noticias_instagram`
- **Contenido**: noticias + alertas urgentes municipales
- **Campos**: titulo, resumen, cuerpo, urgente, tipo_alerta, expira_en
- **Vigencia**: alertas se filtran client-side (urgente + expira_en > ahora)
- **Endpoint**: `GET /api/noticias-instagram`

### `actividades`
- **Contenido**: inscripciones, plazos, talleres, becas, deportes
- **Campos**: titulo, categoria, fecha_limite, horario, lugar, url_fuente
- **Vigencia**: se filtran client-side (fecha_limite >= hoy o NULL)
- **Endpoint**: `GET /api/actividades`

## Endpoints Públicos

### `GET /api/noticias-instagram`
```javascript
{
  "noticias": [
    {
      "id": "uuid",
      "origen_externo_id": "ig-DbYfnCpDZHS",
      "titulo": "Vacaciones seguras...",
      "resumen": "...",
      "cuerpo": "...",
      "imagen_url": "blob-url",
      "urgente": false,
      "tipo_alerta": null,
      "publicado_en": "2026-07-29T16:00:19Z",
      "expira_en": null
    }
  ]
}
```

**Cache**: 60s en CDN  
**Fail-open**: devuelve `{noticias: []}` si Neon cae

### `GET /api/actividades`
```javascript
{
  "actividades": [
    {
      "id": "uuid",
      "origen_externo_id": "ig-Dbkgr2hkqCv-0",
      "titulo": "Torneo de Fútbol 7 Infantil",
      "categoria": "deporte",
      "fecha_limite": "2026-08-20",
      "horario": "10:00h",
      "lugar": "Campos Los Manzanos",
      "imagen_url": "blob-url",
      "url_fuente": "https://navalcarnero.es/...",
      "publicado_en": "2026-08-03T08:00:36Z"
    }
  ]
}
```

**Orden**: por fecha_limite ASC (las que cierren primero primero)  
**Cache**: 60s en CDN  
**Fail-open**: devuelve `{actividades: []}` si Neon cae

## Hooks React

### `useActividades()` (nuevo)
```javascript
const { actividades, proximasACaducar, cargando } = useActividades()
```

- **actividades**: todas las vigentes, ordenadas por plazo
- **proximasACaducar**: próximas a caducar en ≤ 7 días (para franja en UI)
- **cargando**: boolean mientras se traen datos

### `useNoticiasPublicas()` (modificado)
Ya no retorna actividades (antes las filtraba de noticias_instagram). Ahora:
- **noticias**: solo noticias + alertas (tipo !== 'actividad')
- **actividades**: quitado (usar `useActividades` en su lugar)
- **alertas**: avisos urgentes vigentes
- **cargando**: boolean

## Ejemplo Real

### Post de Instagram
Caption:
```
¡Ya está aquí la programación deportiva de agosto de las Fiestas Patronales 2026!
Si quieres participar en alguna de las actividades con inscripción previa, 
consulta los plazos y no te quedes sin tu plaza.

Toda la información, fechas e inscripciones 👇
https://navalcarnero.es/navalcarnero/prensa/programacion-deportiva-fiestas-patronales-2026/
```

### Flujo
1. **Webhook recibe el post** con caption + URL
2. **detectarUrl()** extrae `https://navalcarnero.es/navalcarnero/prensa/...`
3. **scrapearUrl()** trae el HTML de la página oficial
4. **Claude extrae 10 actividades** (fútbol 7, tenis, ping pong, baloncesto, etc):
   ```
   {
     "titulo": "Torneo de Fútbol 7 Infantil",
     "categoria": "deporte",
     "fechaLimite": "2026-08-20",
     "horario": "10:00h",
     "lugar": "Campos Los Manzanos"
   },
   {
     "titulo": "Torneo de Tenis",
     "categoria": "deporte",
     "fechaLimite": "2026-08-25",
     "horario": "Por determinar",
     "lugar": "Polideportivos varios"
   },
   // ... 8 más
   ```
5. **Webhook crea 10 filas** en `actividades`:
   - `ig-Dbkgr2hkqCv-0` → Fútbol 7
   - `ig-Dbkgr2hkqCv-1` → Tenis
   - ... etc
6. **Deploy automático** (Vercel detecta el commit al schema)
7. **UI muestra**:
   - En `/actividades`: todas las 10, ordenadas por fecha de plazo
   - En franja "Últimos días": Tenis (caduca 25-ago, hoy es 3-ago = 22 días... espera, sería solo si fuera ≤ 7)

## Robustez

### Manejo de Errores
- **URL no detectable**: post se procesa como noticia (sin actividades)
- **Scraping falla**: error logueable, webhook continúa con otros posts
- **Claude retorna JSON mal formado**: actividades vacías, webhook continúa
- **Imagen no se sube a Blob**: actividad sin foto, nunca descartada
- **DB cae**: endpoint retorna `{actividades: []}` con 200 (fail-open)

### IDs Únicos
- `origen_externo_id = "ig-{shortCode}-{index}"`
- Si un post tiene 5 deportes, hay 5 filas con índices 0-4
- Permite upserts sin duplicar aunque se re-scrapee

### Límites
- **Scraping**: 50 KB máximo (trunca HTML grande)
- **Timeout**: 10 segundos por URL
- **Validación**: whitelists de categoria, regex de fechas
- **Cuota Anthropic**: 1 llamada a Claude por post con URL (razonable)

## Configuración Required

### Environment Variables
```
NOTICIAS_SYNC_SECRET=<secret>  # Auth del webhook (Bearer token)
ANTHROPIC_API_KEY=...          # Para Claude
DATABASE_URL=...               # Neon
BLOB_READ_WRITE_TOKEN=...      # Vercel Blob (para imágenes)
APIFY_TOKEN=...                # (opcional) Para leer dataset de Apify
```

### Apify
El webhook de la task `noticias-instagram` debe apuntar a `/api/sync-instagram-noticias`:
```
POST https://naval-app.vercel.app/api/sync-instagram-noticias
Headers:
  Authorization: Bearer ${NOTICIAS_SYNC_SECRET}
```

## Monitoreo

El resumen del webhook ahora incluye:
```json
{
  "timestamp": "2026-08-03T12:00:00Z",
  "recibidos": 5,
  "analizados": 5,
  "noticias": 2,
  "actividades": 8,
  "creadas": 10,
  "actualizadas": 0,
  "imagenesSubidas": 8,
  "errores": []
}
```

- **noticias**: rows insertadas en noticias_instagram
- **actividades**: actividades extraídas (sum de todas) — útil para medir si el scraping funciona
- **imagenesSubidas**: fotos subidas a Blob

## Interfaz de Usuario (próxima fase)

### `/actividades` (nueva página)
Muestra todas las actividades vigentes:
- Franja "Últimos días de plazo" (proximasACaducar, snap horizontal)
- Lista general con chips de categoría, ordenada por publicado_en DESC
- Estado vacío cuando no hay inscripciones abiertas

### Detalle de actividad
- Badge "Actividad · {categoria}"
- Fila "Plazo hasta el X" (con color ámbar si ≤ 5 días)
- Datos: horario, lugar, url_fuente (enlace a la programación oficial)

### Links
- `MenuDrawer`: nuevo enlace a `/actividades`
- `Noticias.jsx`: cambiar "Ver actividades pendientes" para usar `useActividades`

## Decisiones de Diseño

**¿Por qué no crear eventos en eventos_usuario?**
- Las actividades son "información a propósito de inscribirse", no eventos puntuales de agenda
- Los eventos (`eventos_usuario`) pertenecen a orgs y se pueden publicar/archivar
- Las actividades son datos municipales fugaces (caducan solas por fecha_limite)
- Separación clara en la UI: eventos = agenda, actividades = inscripciones

**¿Por qué scraping + Claude en el webhook y no en tiempo de lectura?**
- El scraping es costoso (red, HTML grande, timeout de 10s)
- Mejor hacerlo una sola vez en la inserción (webhook 1x/día)
- Lectura es rápida: actividades ya estructuradas en la BD

**¿Por qué no un cron aparte para actividades?**
- Están atadas a los posts de Instagram, no a un horario independiente
- El webhook de Apify ya dispara el sync; agregar otro cron es overhead innecesario
- El triaje (noticia vs actividad) y el scraping ocurren en el mismo flujo

**¿Por qué imagen_url en actividades si no se muestra en la ficha?**
- Futura flexibilidad: podría mostrarse en un carrusel si hay varias
- Reutiliza la foto del post (primera imagen del carousel)
- Bajo costo: columna nullable, se omite si no hay imagen
