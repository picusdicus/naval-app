// GET /api/bus-times?codStop=… — tiempos de espera en tiempo real del CRTM.
// Edge Function: solo usa fetch/Request/Response, así que no consume una de las
// 12 Serverless Functions del plan Hobby.
export const config = { runtime: 'edge' }

const CRTM_API_BASE = 'https://www.crtm.es/widgets/api/'

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const codStop = new URL(req.url).searchParams.get('codStop')

  if (!codStop) {
    return json({ error: 'codStop is required' }, 400)
  }

  // Defensa en profundidad: los códigos de parada del CRTM son numéricos (a
  // veces con separadores). Validamos el formato antes de reenviarlo a su API
  // para no propagar entrada arbitraria del cliente.
  if (!/^[0-9_]{1,12}$/.test(codStop)) {
    return json({ error: 'codStop no válido' }, 400)
  }

  try {
    const respuesta = await fetch(
      `${CRTM_API_BASE}GetStopsTimes.php?codStop=${encodeURIComponent(codStop)}`
    )

    // Siempre 200 con la respuesta del CRTM: el frontend gestiona los errores
    // de parseo sin romper la página.
    return json(await respuesta.json())
  } catch (error) {
    console.error('Error fetching from CRTM:', error)
    return json({ error: 'Failed to fetch real-time data' })
  }
}
