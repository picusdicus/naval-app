// Archivado automático de los talleres cuyo curso ya terminó.
//
// Lo llama el cron (`api/sync-events.js`, primer paso del handler) una vez al
// día. NO borra nada: `estado = 'archivado'` los saca de la web pública —
// `GET /api/talleres` filtra por `estado = 'publicado'` — y los deja visibles
// en el panel del superadmin, que lista todos los estados, por si hay que
// consultarlos o reutilizarlos el curso siguiente. Mismo criterio que
// `eventos_ocultos` o el DELETE de Pendientes: archivar antes que eliminar.
//
// El guion bajo evita que Vercel lo despliegue como endpoint propio.

import { esCursoAnterior } from '../src/lib/talleres.js'

/**
 * Archiva los talleres publicados de cursos anteriores al vigente.
 *
 * Idempotente por construcción: el filtro `estado = 'publicado'` hace que una
 * segunda pasada no encuentre nada (los ya archivados quedan fuera), así que
 * correrlo en cada ejecución del cron no reprocesa ni falla.
 *
 * El "¿es de un curso pasado?" se decide en JS y no en SQL a propósito:
 * `talleres.curso` es texto libre sin CHECK, y `esCursoAnterior()` es la misma
 * función que verifican los tests de los límites (31 de julio / 1 de agosto).
 * Duplicar esa regla en SQL abriría la puerta a que las dos discrepasen.
 *
 * @param {*} sql cliente de Neon
 * @param {Date} hoy inyectable para poder verificar sin tocar el reloj
 * @returns {Promise<{archivados: number, talleres: {id, nombre, curso}[]}>}
 */
export async function archivarTalleresDeCursosPasados(sql, hoy = new Date()) {
  const publicados = await sql`
    SELECT id, nombre, curso
    FROM talleres
    WHERE estado = 'publicado' AND curso IS NOT NULL AND curso <> ''
  `

  const caducados = publicados.filter((t) => esCursoAnterior(t.curso, hoy))
  if (caducados.length === 0) return { archivados: 0, talleres: [] }

  // Un solo UPDATE con todos los ids: el driver HTTP de Neon manda una
  // sentencia por petición, así que uno por taller serían N viajes.
  const ids = caducados.map((t) => t.id)
  await sql`
    UPDATE talleres
    SET estado = 'archivado', actualizado_en = now()
    WHERE id = ANY(${ids})
  `

  return {
    archivados: ids.length,
    talleres: caducados.map((t) => ({ id: t.id, nombre: t.nombre, curso: t.curso })),
  }
}
