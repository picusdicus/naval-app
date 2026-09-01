// GET    /api/super/fusiones        — lista las fusiones manuales (para el panel)
// POST   /api/super/fusiones         — fusiona { referenciaPrincipal, referenciaSecundaria }
// DELETE /api/super/fusiones?ref=…    — deshace una fusión (ref = la secundaria)
//
// Fusión manual de eventos (issue #27): el superadmin decide que dos entradas
// de la agenda son el mismo acto cuando el matcher automático no las une. Aquí
// solo se guarda/borra el par de ids públicos en `fusiones_eventos`; la fusión
// se aplica CLIENT-SIDE en cada lectura (aplicarFusionesManuales), así que es
// persistente entre crons y reversible con el DELETE. El panel lee este GET
// (auth, sin cache de CDN) y no el público /api/fusiones-eventos, para ver el
// efecto de un POST/DELETE al instante sin esperar los 60 s de cache.
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, leerJson, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'

export const config = { runtime: 'edge' }

// Mismo alfabeto y longitud que eventos_ocultos y destacados: ids opacos de
// eventos (ev-…, fiestas-…, bd-<uuid>, ig-…), nunca espacios ni control.
const REFERENCIA_REGEX = /^[A-Za-z0-9._/-]+$/

function referenciaValida(ref) {
  return typeof ref === 'string' && ref.length > 0 && ref.length <= 200 && REFERENCIA_REGEX.test(ref)
}

async function asegurarTabla(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS fusiones_eventos (
      referencia_secundaria text PRIMARY KEY,
      referencia_principal  text NOT NULL,
      creado_en             timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT fusion_no_reflexiva CHECK (referencia_secundaria <> referencia_principal)
    )
  `
}

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  try {
    const sql = obtenerSql()

    if (req.method === 'GET') {
      let filas
      try {
        filas = await sql`
          SELECT referencia_principal, referencia_secundaria
          FROM fusiones_eventos
          ORDER BY creado_en DESC
        `
      } catch {
        // La tabla puede no existir aún si nunca se fusionó nada.
        filas = []
      }
      return json({
        fusiones: filas.map((f) => ({
          principal: f.referencia_principal,
          secundaria: f.referencia_secundaria,
        })),
      })
    }

    if (req.method === 'POST') {
      const { referenciaPrincipal, referenciaSecundaria } = await leerJson(req)
      if (!referenciaValida(referenciaPrincipal) || !referenciaValida(referenciaSecundaria)) {
        return json({ error: 'Referencia de evento no válida.' }, 400)
      }
      if (referenciaPrincipal === referenciaSecundaria) {
        return json({ error: 'Un evento no puede fusionarse consigo mismo.' }, 400)
      }
      await asegurarTabla(sql)

      // Veto de cadenas (A←B←C): la resolución en cliente es de un solo salto
      // a propósito — una cadena dejaría fusiones a medio aplicar.
      const [principalAbsorbido] = await sql`
        SELECT referencia_principal FROM fusiones_eventos
        WHERE referencia_secundaria = ${referenciaPrincipal}
      `
      if (principalAbsorbido) {
        return json(
          { error: 'El evento principal ya está fusionado dentro de otro evento. Deshaz esa fusión primero, o fusiona directamente sobre aquel.' },
          409,
        )
      }
      const [secundariaConFusiones] = await sql`
        SELECT 1 FROM fusiones_eventos
        WHERE referencia_principal = ${referenciaSecundaria}
        LIMIT 1
      `
      if (secundariaConFusiones) {
        return json(
          { error: 'El evento elegido como duplicado ya absorbe otras fusiones. Deshazlas primero, o elígelo a él como principal.' },
          409,
        )
      }
      const [existente] = await sql`
        SELECT referencia_principal FROM fusiones_eventos
        WHERE referencia_secundaria = ${referenciaSecundaria}
      `
      if (existente && existente.referencia_principal !== referenciaPrincipal) {
        return json({ error: 'Ese evento ya está fusionado dentro de otro. Deshaz esa fusión primero.' }, 409)
      }

      // Idempotente: repetir la misma fusión no cambia nada.
      await sql`
        INSERT INTO fusiones_eventos (referencia_principal, referencia_secundaria)
        VALUES (${referenciaPrincipal}, ${referenciaSecundaria})
        ON CONFLICT (referencia_secundaria) DO NOTHING
      `
      return json({
        fusionado: true,
        fusion: { principal: referenciaPrincipal, secundaria: referenciaSecundaria },
      })
    }

    if (req.method === 'DELETE') {
      const { ref } = queryDe(req)
      if (!referenciaValida(ref)) return json({ error: 'Referencia de evento no válida.' }, 400)
      await asegurarTabla(sql)
      await sql`DELETE FROM fusiones_eventos WHERE referencia_secundaria = ${ref}`
      return json({ deshecho: true, referenciaSecundaria: ref })
    }

    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en /api/super/fusiones:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }
}
