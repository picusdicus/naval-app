// GET /api/admin/eventos — eventos de la organización del usuario autenticado.
//
// Lee la misma fuente única que la agenda pública y el asistente
// (src/data/eventos*.json), filtrando por la organización que publica cada
// evento. El slug sale del JWT firmado, no de la petición: nadie puede pedir
// los eventos de otra organización cambiando un parámetro.
import eventosCurados from '../../src/data/eventos.json' with { type: 'json' }
import eventosExternos from '../../src/data/eventos-externos.json' with { type: 'json' }
import { requerirSesion } from '../_auth.js'

// Cada organización se reconoce por el campo `fuente` que escriben los
// scripts de importación (scripts/fetch-eventos.mjs).
const ORGANIZACIONES = {
  'tyl-tyl': { nombre: 'Teatro TYL TYL', fuente: 'TYL TYL' },
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  let sesion
  try {
    sesion = requerirSesion(req, res)
  } catch (error) {
    // Falta ADMIN_JWT_SECRET: sin secreto no hay sesión que valga.
    console.error('Sesión mal configurada:', error.message)
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!sesion) return

  const organizacion = ORGANIZACIONES[sesion.organizacionSlug]
  if (!organizacion) {
    return res.status(404).json({ error: 'La organización de tu cuenta ya no existe.' })
  }

  const hoy = hoyISO()
  const eventos = [...eventosCurados, ...eventosExternos]
    .filter((evento) => evento.fuente === organizacion.fuente)
    .map(({ id, titulo, fecha, hora, lugar, categoria, url }) => ({
      id,
      titulo,
      fecha,
      hora,
      lugar,
      categoria,
      url,
      // Todo lo que llega de las fuentes externas ya está publicado; los
      // borradores llegarán cuando se puedan crear eventos desde el panel.
      estado: 'publicado',
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  return res.status(200).json({
    organizacion: { nombre: organizacion.nombre, slug: sesion.organizacionSlug },
    eventos,
    resumen: {
      total: eventos.length,
      proximos: eventos.filter((e) => e.fecha >= hoy).length,
      pasados: eventos.filter((e) => e.fecha < hoy).length,
    },
  })
}
