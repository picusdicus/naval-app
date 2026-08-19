# Actividades: Scraping, Extracción y Consolidación

## Resumen de trabajo completado (Agosto 2026)

### 1. **Consolidación de Actividades en Eventos** ✓
Actividades y eventos ahora son una única sección unificada en `/eventos`:
- Categoría nueva: "Talleres" (`#9B5A7A`) en la taxonomía de eventos
- Las actividades se muestran como eventos con `categoria='talleres'`
- Deep links de actividades → `/eventos?categorias=talleres`
- La página de `/actividades` fue eliminada
- Navegación actualizada (menuú, header, navbar)

**Verificación**: Las actividades aparecen correctamente en `/eventos?categorias=talleres` ordenadas por fecha límite.

---

## Bugs identificados y en progreso

### BUG A — HTML Truncation (RESUELTO)
**Problema**: Páginas con 39+ actividades se truncaban a 50 KB, perdiendo la galería al final de la página.

**Causa**: `descargarDocumento()` en `sync-instagram-noticias.js` limitaba a 51,200 bytes antes de extraer contenido.

**Solución implementada** (commit 56f7cdb):
1. ✓ Aumentar límite a 300 KB (`MAX_HTML_BYTES = 300_000`)
2. ✓ Extraer contenido principal del artículo (div `.entrada` de WordPress) **antes** de aplicar límite
3. ✓ Descartar header/menu/sidebar/footer para maximizar contenido útil
4. ✓ Añadir logging visible cuando ocurre truncamiento
5. ✓ Logging de conteo de candidatos en `parseHtmlInteligente()`

**Verificación pendiente**: Reprocesar la página de programación deportiva para confirmar que se detectan **39 actividades completas**, incluyendo las del final (ajedrez, tiro al plato, galgos, voleibol, patinaje, calistenia, acuatlón).

---

### BUG B — origen_externo_id inestable (PROPUESTA DOCUMENTADA)
**Problema**: El ID de actividad genera duplicados por dos causas independientes:
1. Deriva de título entre ejecuciones (Claude redacta distinto)
2. Mismo evento en múltiples posts

**Estructura actual**:
```
ig-{shortCode}-{slug-del-titulo}
// Problema: slug cambia si Claude redacta distinto el título
```

**Solución propuesta (BUG_B_PROPOSAL.md)**: Opción 3 híbrida
- **Hijas de carrusel** (con `imagen_origen_id`): `ig-{shortCode}-img-{imagen_origen_id}`
- **Actividades de documento** (HTML/PDF): `doc-{hash(url_fuente)}-{fecha}-{titulo_normalizado}`
- Idempotencia: Misma actividad siempre = mismo ID
- Reconoce eventos en múltiples posts que enlazan el mismo documento

**Próximos pasos**:
1. Decidir sobre implementación de Bug B
2. Decidir sobre limpieza de duplicados históricos (hay 6+ pares actuales)
3. Implementar y verificar idempotencia

---

## Detalles técnicos: Extracción de actividades desde URL

### Arquitectura

Flujo: Post Instagram → `api/sync-instagram-noticias.js` → Descarga URL → `api/_actividades-parser.js` → Claude → Upsert en `actividades` tabla

### Descarga y recorte de HTML (`descargarDocumento`)

```javascript
// Antes (TRUNCABA):
const html = await response.text()
return { tipo: 'html', html: html.substring(0, 51200) }

// Después (MEJORADO):
const MAX_HTML_BYTES = 300_000 // 300 KB
let html = await response.text()

// Extraer artículo principal (WordPress)
const match = html.match(/<div[^>]*class="[^"]*entrada[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
if (match && match[1].length > 1000) {
  html = match[1] // Descarta chrome de la página
  console.log(`[descargarDocumento] Contenido extraído: ${original} → ${html.length} bytes`)
}

// Aplicar límite DESPUÉS del recorte
if (html.length > MAX_HTML_BYTES) {
  console.warn(`[descargarDocumento] HTML truncado: ${html.length} → ${MAX_HTML_BYTES} bytes`)
  html = html.substring(0, MAX_HTML_BYTES)
}
```

### Parsing de HTML (`parseHtmlInteligente`)

**Estrategia 1**: Galería WordPress (imágenes con alt text como títulos)
```javascript
const galeriaItems = doc.querySelectorAll('.gallery-item img')
// Extrae alt text y lazy-loaded URLs
```

**Estrategia 2**: Fallback a cualquier imagen con alt text descriptivo
```javascript
const imgs = doc.querySelectorAll('img[alt]')
// Filtra logos, iconos de redes, etc
```

**Límite de candidatos**: 50 para no saturar Claude (con warning si se excede)

### Validación con Claude

Transforma candidatos (solo títulos) en actividades estructuradas:
- `titulo`: Limpio, sin números de orden, sin mayúsculas gritadas
- `categoria`: Whitelist [`deporte`, `talleres`, `infantil`, `mayores`, `educacion`, `ayudas`, `empleo`, `general`]
- `fechaLimite`: YYYY-MM-DD (fecha de prueba o plazo de inscripción)
- `horario`: Hora si el título la indica
- `lugar`: Instalación si el título la indica

**Validación server-side**: Re-valida todos los valores antes de guardar (nunca confiar en modelo)

### Mapeo a Eventos (`useEventosPublicos`)

```javascript
const eventosDeActividades = actividades
  .filter((a) => a.fecha_limite) // Solo con plazo
  .map((a) => ({
    id: a.id,
    titulo: a.titulo,
    fecha: a.fecha_limite,        // Fecha principal (no publicado_en)
    hora: a.horario,              // Extraído de alt text
    lugar: a.lugar,
    categoria: 'talleres',         // Nueva categoría
    descripcion: a.descripcion || '',
    imagen: a.imagen_url,
    url: a.url_fuente,
    origen: 'actividad',
    fechaLimite: a.fecha_limite,   // Metadato
    publicadoEn: a.publicado_en,   // Metadato
  }))
```

---

## Presupuesto de Vercel Blob

Las imágenes de actividades se suben a `instagram-actividades/{shortCode}(-<sufijo>).{ext}`:
- **Límite por activity**: 1 imagen (fila de tabla `actividades`)
- **Límite por post Sidecar**: Hasta 6 fotos máximo (`MAX_IMAGENES_POST = 6`)
- **Estrategia de ahorro**: 
  - Reutiliza blob ya subido si la actividad ya existe
  - Consulta Neon antes de subir (nunca a Blob directamente)
  - Si carga de imagen falla, la actividad se guarda igual con `imagen_url = NULL`

Ver "Presupuesto de Vercel Blob" en CLAUDE.md para más detalles.

---

## Ambiente: Tablas y Schemas

### Tabla `actividades`

```sql
CREATE TABLE actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_externo_id text NOT NULL UNIQUE,  -- Clave de idempotencia
  titulo text NOT NULL,
  descripcion text,
  categoria text CHECK (categoria = ANY(ARRAY['deporte', 'talleres', ...]))
  fecha_limite date NOT NULL,             -- Plazo de inscripción
  horario text,                           -- Ej: "19:30h"
  lugar text,                             -- Ej: "Piscina municipal"
  imagen_url text,                        -- URL en Blob o NULL
  imagen_origen_id text,                  -- ID estable (photo id en carrusel)
  url_fuente text,                        -- URL del documento/post original
  estado text CHECK (estado = ANY(...)),  -- 'borrador' o 'publicado'
  publicado_en timestamptz,               -- Cuándo se sincronizó
  creado_en timestamptz DEFAULT now(),
  actualizado_en timestamptz DEFAULT now()
);

CREATE INDEX idx_actividades_origen ON actividades (origen_externo_id);
CREATE INDEX idx_actividades_fecha_limite ON actividades (fecha_limite DESC);
```

### Visión cliente (`GET /api/actividades`)

```json
{
  "actividades": [
    {
      "id": "uuid",
      "titulo": "Tardeo deportivo aquazumba y baño",
      "categoria": "deporte",
      "fecha_limite": "2026-08-20",
      "horario": "19:30h",
      "lugar": "Piscina municipal",
      "imagen_url": "https://...",
      "url_fuente": "...",
      "publicado_en": "2026-08-17T08:00:50Z"
    }
  ]
}
```

---

## Decisiones de diseño

### 1. **Actividades como eventos con categoría "Talleres"**
✓ Ventaja: Una única sección de agenda, filtrable
✓ Mantiene taxonomía de eventos limpia
✓ Deep links resueltos (`/eventos/:id`)

### 2. **Fecha límite como fecha principal del evento**
✓ Correcto: Ordena actividades por cuándo cierran (relevancia para el usuario)
✗ Alternativa descartada: Usar `publicado_en` (solo importa para historial)

### 3. **Sin histórico de campañas en destacados**
La tabla `destacados` usa `UNIQUE (tipo, referencia_id)`, así que reutiliza filas.
Rationale: Simplifica modelo, no hay renovación automática aún (futura con Stripe)

### 4. **Imagen: Blob URL municipal vs Blob upload**
- **HTML/PDF extraído**: Usa URL municipal si está en `<img src>` (estable)
- **Fallback**: Blob de foto del post Instagram (sube si falta)
- **Carrusel**: Una foto por actividad, con `imagen_origen_id` para identidad estable

---

## Testing

### Test E2E (`e2e/imagen-evento.spec.js`)
Sube cartel de evento a Blob y verifica que se guarda la URL.

### Test manual (pendiente para Bug A)
```bash
# Reprocesar página de programación deportiva
# Verificar en logs: 39 candidatos, 39 validados
# Verificar en DB: todas las actividades presentes, incluidas del final
```

---

## Futuros

- **Bug B**: Idempotencia robusta con IDs híbridos
- **Destacados con Stripe**: Renovación automática, historial de campañas
- **Analytics**: Clic en destacados desde `/eventos`
- **Notificaciones**: Push para nuevas actividades con plazo ≤ 7 días
