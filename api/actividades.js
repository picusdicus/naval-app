export const config = { runtime: 'edge' };

import { obtenerSql } from './_db.js';
import { json } from './_http.js';

/**
 * GET /api/actividades
 * Retorna las actividades vigentes (plazo abierto o sin plazo conocido).
 * Vigencia: fecha_limite IS NULL OR fecha_limite >= CURRENT_DATE.
 * Ordenadas por fecha_limite ASC (las que cierren primero primero).
 * Cacheable: 60s en CDN.
 * Falla abierto: devuelve {actividades: []} con 200 si Neon está caído.
 */
export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const sql = obtenerSql();
    const rows = await sql`
      SELECT
        id,
        origen_externo_id,
        titulo,
        descripcion,
        categoria,
        fecha_limite,
        horario,
        lugar,
        imagen_url,
        url_fuente,
        publicado_en
      FROM actividades
      WHERE fecha_limite IS NULL OR fecha_limite >= CURRENT_DATE
      ORDER BY fecha_limite ASC NULLS LAST, publicado_en DESC
    `;

    // Convertir Date objects a strings ISO
    const actividades = rows.map((a) => ({
      ...a,
      fecha_limite: a.fecha_limite ? a.fecha_limite.toISOString().split('T')[0] : null,
      publicado_en: a.publicado_en?.toISOString?.() || a.publicado_en,
    }));

    const res = json({ actividades });
    res.headers.set('Cache-Control', 'public, max-age=60');
    return res;
  } catch (err) {
    console.error('[actividades] Error:', err.message);
    const res = json({ actividades: [] });
    res.headers.set('Cache-Control', 'public, max-age=60');
    return res;
  }
}
