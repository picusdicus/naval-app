// GET /api/noticias-instagram — noticias y alertas sincronizadas desde el
// Instagram del Ayuntamiento (tabla noticias_instagram, escrita por
// api/sync-instagram-noticias.js). Público y sin auth, con el mismo contrato
// que /api/eventos: cache CDN de 60 s y {noticias: []} con HTTP 200 si Neon
// cae, para que la sección Noticias (que también tiene el RSS estático) nunca
// se rompa.
//
// El shape de cada item replica el de src/data/noticias.json (id/titulo/fecha/
// resumen/contenido/url/autor) para que useNoticiasPublicas concatene sin
// adaptadores, más los campos propios de alerta (urgente/tipoAlerta/expiraEn).
// El filtrado de alertas vigentes es CLIENT-SIDE (una respuesta cacheable para
// todos); el OR del WHERE solo evita que una alerta viva más antigua que la
// ventana de historial desaparezca del feed.
export const config = { runtime: 'edge' }

import { obtenerSql } from './_db.js'
import { json } from './_http.js'

const DIAS_HISTORIAL = 60
const LIMITE = 100

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, 405)
  }

  try {
    const sql = obtenerSql()
    // to_char para no dejar que el driver convierta timestamptz a Date de JS
    // (arrastraría la zona horaria), mismo patrón que api/avisos.js.
    // El OR mantiene visibles fuera de la ventana de historial tanto una
    // alerta vigente como una actividad cuyo plazo sigue abierto.
    const filas = await sql`
      SELECT origen_externo_id, titulo, resumen, cuerpo, imagen_url, url, usuario,
             tipo, categoria, urgente, tipo_alerta,
             to_char(fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
             to_char(publicado_en, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS publicado_en,
             to_char(expira_en, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expira_en
      FROM noticias_instagram
      WHERE publicado_en >= now() - (${DIAS_HISTORIAL} || ' days')::interval
         OR (urgente AND expira_en > now())
         OR (tipo = 'actividad' AND fecha_limite >= CURRENT_DATE)
      ORDER BY publicado_en DESC
      LIMIT ${LIMITE}
    `

    const noticias = filas.map((f) => ({
      // 'ig-<shortCode>': no choca con los ids 'noticias-…' del RSS.
      id: f.origen_externo_id,
      titulo: f.titulo,
      fecha: (f.publicado_en || '').slice(0, 10),
      publicadoEn: f.publicado_en,
      resumen: f.resumen || '',
      contenido: f.cuerpo || '',
      url: f.url || '',
      autor: 'Ayuntamiento de Navalcarnero',
      imagen: f.imagen_url || '',
      tipo: f.tipo || 'noticia',
      categoria: f.categoria,
      fechaLimite: f.fecha_limite,
      urgente: f.urgente,
      tipoAlerta: f.tipo_alerta,
      expiraEn: f.expira_en,
      origen: 'instagram',
    }))

    return json({ noticias }, 200, {
      // max-age=0: el navegador no reutiliza por heurística; la CDN sí cachea.
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    })
  } catch (error) {
    console.error('No se pudieron leer las noticias de Instagram:', error)
    return json({ noticias: [], error: 'base-de-datos-no-disponible' })
  }
}
