// Registro de observabilidad de la ingesta (tabla ingesta_log): cada pipeline
// (api/sync-events.js, api/sync-instagram.js, api/sync-instagram-noticias.js y
// api/_actividades-deportes-feed.js) inserta una fila al terminar con los
// contadores que ya llevaba en memoria durante el run. SOLO observabilidad:
// registrarIngesta jamás lanza — un fallo al insertar el log no puede romper
// la ingesta (se atrapa y se deja en console.error).
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
import { obtenerSql } from './_db.js'

// Tabla e índice idempotentes, mismo patrón que asegurarTablas en los
// webhooks: también están en db/schema.sql, pero así el log funciona aunque
// el esquema no se haya re-aplicado aún en un entorno.
let asegurada = false
async function asegurarTabla(sql) {
  if (asegurada) return
  await sql`CREATE TABLE IF NOT EXISTS ingesta_log (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fuente                 text NOT NULL,
    ejecutado_en           timestamptz NOT NULL DEFAULT now(),
    candidatos             integer NOT NULL DEFAULT 0,
    emparejados            integer NOT NULL DEFAULT 0,
    nuevos                 integer NOT NULL DEFAULT 0,
    descartados            integer NOT NULL DEFAULT 0,
    descartados_por_motivo jsonb NOT NULL DEFAULT '{}',
    CONSTRAINT ingesta_motivos_es_objeto CHECK (jsonb_typeof(descartados_por_motivo) = 'object')
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_ingesta_log_fuente_fecha
            ON ingesta_log (fuente, ejecutado_en DESC)`
  asegurada = true
}

/** Deja en `motivos` solo las cuentas > 0 (los ceros no aportan al desglose). */
export function motivosNoVacios(motivos) {
  return Object.fromEntries(
    Object.entries(motivos).filter(([, cuenta]) => Number(cuenta) > 0)
  )
}

/**
 * Inserta la fila de log de una ejecución de ingesta.
 * `motivos` es un objeto {"motivo textual": cuenta}; si no se pasa
 * `descartados`, se calcula como la suma de los motivos.
 */
export async function registrarIngesta({
  fuente,
  candidatos = 0,
  emparejados = 0,
  nuevos = 0,
  descartados = null,
  motivos = {},
}) {
  try {
    const limpios = motivosNoVacios(motivos)
    const totalDescartados =
      descartados ?? Object.values(limpios).reduce((suma, n) => suma + Number(n), 0)
    const sql = obtenerSql()
    await asegurarTabla(sql)
    await sql`
      INSERT INTO ingesta_log
        (fuente, candidatos, emparejados, nuevos, descartados, descartados_por_motivo)
      VALUES
        (${fuente}, ${candidatos}, ${emparejados}, ${nuevos}, ${totalDescartados},
         ${JSON.stringify(limpios)}::jsonb)
    `
  } catch (err) {
    console.error(`[ingesta_log] No se pudo registrar la ejecución de ${fuente}:`, err.message)
  }
}
