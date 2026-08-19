# BUG B — Propuesta de solución: origen_externo_id inestable

## Análisis del problema

El `origen_externo_id` actual genera IDs con dos componentes distintos:
- **Parte estable**: `ig-{shortCode}` (el post de Instagram)
- **Parte inestable**: `{slug-del-titulo}` (derivado de cómo Claude redacta el título en esa ejecución)

Ejemplo: `ig-DcIj1xrj0tG-tardeo-deportivo-aquazumba-y-bano-con-dj-piwi`

Esto genera dos problemas independientes que causan duplicados:

### 1. Deriva de título entre ejecuciones (MISMO POST, MISMO EVENTO)
- **Ejecución 1**: Claude extrae "Tardeo deportivo aquazumba y baño" → slug `tardeo-deportivo-aquazumba-y-bano`
- **Ejecución 2**: Claude extrae "Tardeo deportivo aquazumba y baño con DJ Piwi" → slug `tardeo-deportivo-aquazumba-y-bano-con-dj-piwi`
- **Resultado**: Dos filas con `origen_externo_id` distintos → INSERT en vez de UPDATE → Duplicado

**Evidencia**: "Tardeo deportivo aquazumba y baño" vs "Tardeo deportivo aquazumba y baño con DJ Piwi" (×2)

### 2. Mismo evento en posts distintos (DISTINTO POST, MISMO EVENTO)
- **Post 1** (shortCode `ABC123`): Programa completo con 39 actividades → "Carrera Popular de Navalcarnero XXXVII" → `ig-ABC123-carrera-popular`
- **Post 2** (shortCode `XYZ789`): Recordatorio de actividad individual → "Carrera Popular de Navalcarnero XXXVII" → `ig-XYZ789-carrera-popular`
- **Resultado**: Dos filas con `origen_externo_id` distintos (porque shortCode es distinto) → Duplicado

**Evidencia**: "Carrera Popular de Navalcarnero XXXVII edición" (×2) desde posts diferentes

---

## Soluciones consideradas

### Opción 1: `imagen_origen_id` como identidad (RECOMENDADO para carruseles)
**Solo aplica a hijas de carrusel con `imagen_origen_id`** (el media id/shortcode de Instagram dentro del Sidecar):
- ✓ Estable incluso si el título cambia
- ✓ Único por foto dentro del post
- ✓ No depende de cómo Claude redacte el título
- **Limitación**: Solo para fotos de carrusel; actividades sin imagen no aplican

### Opción 2: `url_fuente + titulo_normalizado + fecha` (ROBUSTO para documentos)
**Identidad por documento HTML/PDF + actividad**:
- ✓ Reconoce el mismo evento en múltiples posts que enlazan el mismo documento
- ✓ Título normalizado (sin números, sin mayúsculas, deduplicación de espacios) es más estable que slug derivado
- ✓ Fecha es el anclaje final (si el título cambia pero la fecha es idéntica, sigue siendo el mismo evento)
- **Limitación**: Frágil si Claude extrae fechas diferentes para la misma actividad (poco probable con las instrucciones actuales)

### Opción 3: Hibrido (RECOMENDADO FINAL)
**Combinar ambas estrategias según la fuente**:
1. **Para hijas de carrusel (tienen `imagen_origen_id`)**: Usar `ig-{shortCode}-imagen-{imagen_origen_id}` como identidad primaria
2. **Para actividades de documento (HTML/PDF, sin imagen id)**: Usar `{url_fuente_hash}-{titulo_normalizado}-{fecha}` 
3. **Fallback**: Si hay conflicto, incluir slug por seguridad pero como sufijo, no como identidad

---

## Propuesta elegida: Opción 3 (Hibrida)

### Cambio de estrategia

**Antes (actual)**:
```
ig-{shortCode}-{slug-titulo}
// Problema: slug cambia si Claude redacta distinto el título
```

**Después (propuesto)**:
```
// Hijas de carrusel (imagen_origen_id disponible):
ig-{shortCode}-img-{imagen_origen_id}

// Actividades de documento (sin imagen_origen_id):
doc-{hash(url_fuente)}-{fecha}-{titulo_normalizado}
// Donde hash(url_fuente) = primeros 8 caracteres de SHA256 en base36
// Donde titulo_normalizado = título sin números de orden, sin mayúsculas, deduplicado de espacios
```

### Ventajas

1. **Idempotencia**: Misma actividad, mismo documento, siempre el mismo ID
2. **Multiples posts del mismo documento**: Los reconoce como la misma actividad (solo vía `url_fuente`)
3. **Cambios de título**: No generan nuevas filas
4. **Cambios de imagen**: No generan nuevas filas (la foto ya está en Blob, solo se reutiliza)
5. **Migración transparente**: Las nuevas filas usan el nuevo formato; las viejas quedan como están

### Migración y limpieza

**Duplicados actuales**: 
- De la página de programación deportiva: 6 pares + 1 trío duplicados
- Globales: "Carrera Popular" ×2

**Plan de acción**:
1. Implementar nuevo ID en el código sin migrar viejas filas (coexisten)
2. Nuevo upsert por `origen_externo_id` nuevo, las viejas nunca se actualizan
3. Luego, manualmente (o en un cron futuro): detectar duplicados reales (mismo `url_fuente` + titulo normalizado + fecha), mantener la más reciente, dejar una nota de que fue deduplicada

### Implementación detallada

```javascript
// En sync-instagram-noticias.js

// 1. Normalizar título para dedup
const normalizarTitulo = (t) => {
  return t
    .replace(/^\d+\.\s+/, '')          // quitar "39. "
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')              // deduplica espacios
}

// 2. Hash de URL (primeros 8 chars de SHA256 en base36 para compactar)
const hashUrlFuente = (url) => {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(url).digest('base36').slice(0, 8)
}

// 3. Generar nuevo ID según fuente
const generarOrigemExternoId = (source, data) => {
  switch(source) {
    case 'carrusel':
      // Hija de carrusel con imagen id
      return `ig-${data.shortCode}-img-${data.imagenOrigenId}`
    
    case 'documento':
      // Actividad de documento (HTML/PDF) sin imagen id
      const urlHash = hashUrlFuente(data.urlFuente)
      const titoNorm = normalizarTitulo(data.titulo)
      return `doc-${urlHash}-${data.fechaLimite || '?'}-${titoNorm.slice(0, 48)}`
    
    case 'triaje':
      // La actividad del triaje del post (fila única)
      return `ig-${data.shortCode}`
    
    default:
      throw new Error(`Fuente desconocida: ${source}`)
  }
}
```

---

## Verificación esperada

### Post-implementación (Bug B arreglado):
1. ✓ Represar mismo post 2 veces → UPDATE, no INSERT (mismos datos)
2. ✓ Dos posts enlazan el mismo documento → Son reconocidos como las mismas actividades
3. ✓ Título cambia entre extracciones → Sigue siendo la misma actividad (fecha + url estables)
4. ✓ Carrusel con 5 fotos → 5 filas con IDs distintos (cada foto su ID) sin colisiones

---

## Preguntas pendientes

1. ¿Conservamos las viejas filas duplicadas o hacemos limpieza ahora?
2. ¿El hash de URL se calcula en Node server-side o en el cliente?
3. ¿Queremos logging de dedup cuando dos posts enlazan la misma página?

---

## Cronología propuesta

1. Implementar generador de ID híbrido
2. Verificar Bug B arreglado (test con posts duplicados)
3. Documentar cambio en CLAUDE.md y ACTIVIDADES_SCRAPING.md
4. Decidir sobre limpieza de duplicados históricos
