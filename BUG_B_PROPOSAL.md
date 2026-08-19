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

## Solución propuesta: Usar `imagen_origen_id` como identidad

### El fundamento

Las imágenes de la galería municipal tienen nombres estables, asignados por el maquetador:
```
13.-fin-plazo-TENIS-DE-MESA-27-de-agosto.jpg
25.-torneo-de-futbol-7-infantil-25-agosto.jpg
```

Estos nombres **no los genera Claude**, los proporciona la página municipal. No cambian entre ejecuciones. Cada foto tiene un `id` estable dentro del Sidecar de Instagram (el `media_id` o `shortcode` de la hija).

**Ya tenemos `imagen_origen_id` en la tabla** — es el media id/shortcode de la foto dentro del carrusel. Lo que falta es usarlo como parte de la identidad.

### Estrategia híbrida por fuente

#### **Para actividades de galería (tienen foto → tienen `imagen_origen_id`)**
```
ig-{shortCode}-img-{imagen_origen_id}
```

**Ventajas**:
- ✓ Estable: la foto es la misma, el id no cambia
- ✓ Único: cada foto de cada carrusel tiene un id distinto dentro de Instagram
- ✓ No depende de cómo Claude redacte el título

**Cobertura**: Cubre la **inmensa mayoría** de actividades — todas las que vienen de galerías municipales.

#### **Para actividades sin imagen (caso minoritario)**
```
doc-{hash(url_fuente)}-{posicion-en-documento}
```

Donde `posicion-en-documento` es el índice ordinal en el PDF/HTML (la posición que da la página, no Claude).

**Ventajas**:
- ✓ URL + posición es única per documento
- ✓ La posición la asigna la página, no el modelo
- ✓ No hay colisión: si hay 4 eventos el 28 de agosto, tienen posiciones distintas

**Tratamiento**: Caso minoritario que se puede resolver después.

---

## Por qué la propuesta anterior NO funciona

La propuesta descartada era:
```
doc-{hash(url_fuente)}-{fecha}-{titulo_normalizado}
```

**Falla por colisión**: El 28 de agosto en el programa hay:
1. Torneo de fútbol 7 infantil
2. Tenis de mesa
3. Juegos deportivos para niños
4. Torneo de mus

Con `doc-{hash}-28-agosto` (sin título), las **cuatro serían el mismo id** y se irían pisando unas a otras, **destruyendo datos** (peor que tener dos filas duplicadas).

Incluir título normalizado no lo salva: "Tardeo aquazumba" y "Tardeo aquazumba con DJ Piwi" normalizan distinto igual.

---

## Implementación

### 1. Hijas de carrusel (priori tario)
```javascript
// En sync-instagram-noticias.js, al construir filasActividades
const idDeHija = (h, usados) => {
  if (h.imagenOrigenId) {
    // Actividad de galería: id estable por foto
    return `ig-${item.shortCode}-img-${h.imagenOrigenId}`
  }
  // Fallback a título (caso minoritario)
  return `ig-${item.shortCode}-${sufijoDe(h.titulo, usados)}`
}
```

### 2. Fila única (triaje del post)
```javascript
crearFilaUnica ? [
  {
    origenId: `ig-${item.shortCode}`,  // Post único
    ...
  }
] : []
```

### 3. Documentos (futuro)
```javascript
// Para PDFs/HTML sin imagen_origen_id:
// doc-{hash(url_fuente)}-{posicion_ordinal}
// A tratar una vez resueltas las galerías
```

---

## Migración y limpieza

**Duplicados actuales**: 
- De la página de programación deportiva: 6 pares + 1 trío
- Globales: "Carrera Popular" ×2

**Plan de acción**:
1. Implementar nuevo ID en el código
2. Nuevo upsert por `origen_externo_id` nuevo → filas nuevas (viejas nunca se actualizan)
3. Luego, manualmente o con un script: detectar duplicados reales (mismo `url_fuente` + titulo normalizado + fecha), mantener la más reciente, marcar la antigua como `archivado`

### No forzar deduplicación automática
Si ahora mismo haces un `DELETE` de duplicados antiguos, luego que el webhook reprocese puede recriar filas con el `origen_externo_id` viejo. Mejor:
- Dejar viejas filas con su viejo id
- Nuevas filas nacen con nuevo id
- Coexisten hasta que se limpien manualmente
- Zero riesgo de recrear lo que ya se borró

---

## Verificación esperada

### Post-implementación (Bug B arreglado):
1. ✓ Represar mismo post 2 veces → UPDATE, no INSERT (mismos datos)
2. ✓ Dos posts enlazan el mismo documento (sin cambiar fotos) → Mismos `imagen_origen_id`, mismo id, UPDATE
3. ✓ Carrusel con 5 fotos → 5 filas con IDs distintos (`…-img-ABC`, `…-img-DEF`, etc) sin colisiones
4. ✓ Actividad sin foto (documento) → cae a fallback de título (caso minoritario, a pulir después)

---

## Próximos pasos

1. **Implementar cambio**: Usar `imagen_origen_id` como parte del id de galerías
2. **Verificar**: Reprocesar página programa con 39 actividades
3. **Limpiar**: Deduplicar filas antiguas manually después
4. **Documentar**: Actualizar ACTIVIDADES_SCRAPING.md con criterio definitivo
