// Endpoint para recibir sugerencias, ideas, eventos y altas de comercios desde la sección pública.
//
//   POST /api/sugerencias  { tipo, ...datos }  → procesa y acepta la sugerencia
//                                                (por ahora en dev se simula; en prod
//                                                enviará email o guardará en DB)

import { json, leerJson, csrfInvalido, rechazoCsrf } from './_http.js'
import { limitar, obtenerIp, respuesta429 } from './_ratelimit.js'

export const config = { runtime: 'edge' }

const TIPOS_VALIDOS = ['idea', 'evento', 'comercio', 'error']

export default async function handler(req) {
  if (csrfInvalido(req)) return rechazoCsrf()

  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  // Rate-limit por IP: máx 5 sugerencias por hora para evitar spam
  const ip = obtenerIp(req)
  const limite = await limitar({ clave: `sugerencias:ip:${ip}`, limite: 5, ventanaS: 60 * 60 })
  if (!limite.ok) return respuesta429(limite.resetEnS)

  const datos = await leerJson(req)

  // Validar tipo
  const { tipo } = datos
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return json({ error: 'Tipo de sugerencia no válido' }, 400)
  }

  // Validaciones específicas por tipo
  if (tipo === 'comercio') {
    const { nombre, direccion, tipo: tipoNegocio, horarios } = datos
    if (!nombre?.trim()) return json({ error: 'El nombre es obligatorio' }, 400)
    if (!direccion?.trim()) return json({ error: 'La dirección es obligatoria' }, 400)
    if (!horarios?.trim()) return json({ error: 'Los horarios son obligatorios' }, 400)
    if (!tipoNegocio) return json({ error: 'El tipo de negocio es obligatorio' }, 400)
  } else {
    const { titulo } = datos
    if (!titulo?.trim()) return json({ error: 'El título es obligatorio' }, 400)
  }

  // TODO: En producción:
  // - Guardar en base de datos (tabla `sugerencias`)
  // - O enviar email a admin
  // - O integrar con servicio de formularios externo (Formspree, etc.)

  console.log(`[sugerencias] ${tipo} recibida:`, {
    tipo,
    ip,
    timestamp: new Date().toISOString(),
    datos: {
      titulo: datos.titulo,
      nombre: datos.nombre,
      tipo: datos.tipo,
    },
  })

  return json({ ok: true, mensaje: 'Sugerencia recibida correctamente' }, 200)
}
