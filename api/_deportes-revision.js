// Carteles deportivos nuevos sin emparejar → revisión humana.
//
// Desde feat/deportes-nuevos-a-revision, un cartel del feed de deportes que NO
// empareja con el programa de fiestas y cuyo origen_externo_id NO está en la
// lista de exclusión (los 36 presentes en el JSON en la fecha de corte, ver
// api/_datos/deportes-grandfathered.js) ya no se publica directo en
// eventos-externos.json: se inserta como borrador en la tabla `actividades` y
// pasa por la misma bandeja Pendientes de /admin que el contenido de Instagram.
//
// Reparto de responsabilidades a propósito:
//   - separarDeportesParaRevision() es PURA y la llama el feed (que es quien
//     clasifica y registra los contadores en ingesta_log).
//   - upsertDeportesEnRevision() escribe en Neon y la llama SOLO el cron
//     (api/sync-events.js). Nunca moverla al feed: obtenerActividadesDeportivas
//     la importan también scripts de diagnóstico (scripts/contar-duplicados*),
//     y un diagnóstico no debe crear borradores reales en la bandeja.
// La decisión es por ejecución, no de por vida: un cartel post-rama que
// empareje hoy y deje de emparejar mañana pasa a revisión en ese run (más
// seguro que el fail-soft de auto-publicarlo como tarjeta propia).

import { DEPORTES_GRANDFATHERED } from './_datos/deportes-grandfathered.js'

/**
 * Separa las actividades del feed de deportes en las que siguen la tubería del
 * JSON (emparejadas con el programa, o grandfathered) y las nuevas sin
 * emparejar que van a revisión humana.
 */
export function separarDeportesParaRevision(actividades) {
  const paraJson = []
  const paraRevision = []
  for (const a of actividades) {
    if (a.enriqueceEvento || DEPORTES_GRANDFATHERED.has(a.origen_externo_id)) {
      paraJson.push(a)
    } else {
      paraRevision.push(a)
    }
  }
  return { paraJson, paraRevision }
}

/**
 * Upsert de los carteles a revisión en la tabla `actividades` (nacen
 * 'borrador'). Mismo patrón que el webhook de noticias: el UPDATE no toca
 * `estado` (un archivado desde Pendientes no resucita al re-ejecutar el cron,
 * un publicado no vuelve a borrador) ni `publicado_en`. Los fallos por fila no
 * lanzan: se acumulan en `errores` y el llamador decide qué hacer con ellos.
 * Devuelve { creadas, actualizadas, errores }.
 */
export async function upsertDeportesEnRevision(sql, filas) {
  const resumen = { creadas: 0, actualizadas: 0, errores: [] }
  for (const a of filas) {
    try {
      const resultado = await sql`
        INSERT INTO actividades
          (origen_externo_id, titulo, categoria, fecha_evento, fecha_limite,
           lugar, imagen_url, url_fuente, estado)
        VALUES
          (${a.origen_externo_id}, ${a.titulo}, ${a.categoria || 'deporte'},
           ${a.fecha_evento || null}, ${a.fecha_limite || null},
           ${'Navalcarnero'}, ${a.imagen || null}, ${a.url_fuente || null},
           'borrador')
        ON CONFLICT (origen_externo_id)
        DO UPDATE SET
          titulo = EXCLUDED.titulo,
          fecha_evento = EXCLUDED.fecha_evento,
          fecha_limite = EXCLUDED.fecha_limite,
          imagen_url = COALESCE(EXCLUDED.imagen_url, actividades.imagen_url),
          url_fuente = EXCLUDED.url_fuente,
          actualizado_en = now()
        RETURNING (xmax = 0) AS insertada
      `
      if (resultado[0]?.insertada) resumen.creadas++
      else resumen.actualizadas++
    } catch (err) {
      resumen.errores.push(`deportes a revisión (${a.origen_externo_id}): ${err.message}`)
    }
  }
  return resumen
}
