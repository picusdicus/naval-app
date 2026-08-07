export const config = { runtime: 'edge' };

import { obtenerSql } from './_db.js';
import { json } from './_http.js';

// Ventana de vigencia de una actividad SIN plazo conocido: sin este corte, una
// fila con fecha_limite NULL sería visible para siempre (no hay cron de
// limpieza — la vigencia se calcula en lectura, como en todo el proyecto).
const DIAS_SIN_PLAZO = 45;
const LIMITE = 100;

/**
 * GET /api/actividades
 * Retorna las actividades vigentes: plazo abierto (fecha_limite >= hoy) o,
 * sin plazo conocido, publicadas en los últimos DIAS_SIN_PLAZO días.
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
    // to_char para que el driver no convierta date/timestamptz en Date de JS
    // (arrastraría la zona horaria), mismo patrón que api/noticias-instagram.js.
    const actividades = await sql`
      SELECT
        id,
        origen_externo_id,
        titulo,
        descripcion,
        categoria,
        to_char(fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
        horario,
        lugar,
        imagen_url,
        url_fuente,
        to_char(publicado_en, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS publicado_en
      FROM actividades
      WHERE estado = 'publicado'
        AND (fecha_limite >= CURRENT_DATE
             OR (fecha_limite IS NULL
                 AND publicado_en >= now() - (${DIAS_SIN_PLAZO} || ' days')::interval))
      ORDER BY fecha_limite ASC NULLS LAST, publicado_en DESC
      LIMIT ${LIMITE}
    `;

    const res = json({ actividades });
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (err) {
    console.error('[actividades] Error:', err.message);
    const res = json({ actividades: [] });
    res.headers.set('Cache-Control', 'public, max-age=60');
    return res;
  }
}
