// Envío de notificaciones push (digest diario). SOLO runtime Node: la librería
// `web-push` necesita el crypto de Node, así que este módulo se une al grupo de
// excepciones Node (chat.js, sync-events.js, imagen.js) y NUNCA debe importarse
// desde un handler Edge. El guion bajo evita que Vercel lo despliegue.
//
// Mantenimiento inline: cuando el push service responde 404/410 el endpoint ha
// caducado y la fila se borra aquí mismo — no hay cron de limpieza aparte.

import webpush from 'web-push'
import { obtenerSql } from './_db.js'
import { interseca } from '../src/lib/temasPush.js'

const TAMANO_LOTE = 25

function vapidConfigurado() {
  // La clave pública lleva prefijo VITE_ (el navegador la necesita para
  // suscribirse); la privada jamás debe llevarlo.
  const publica = process.env.VITE_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:directorio@navalcarnero.example',
    publica,
    privada
  )
  return true
}

// Notificación del digest para una suscripción: personalizada si le toca un
// solo evento, agrupada si son varios (el digest agrupa para evitar spam).
function cargaUtil(eventos) {
  if (eventos.length === 1) {
    const ev = eventos[0]
    return {
      titulo: `Nuevo evento: ${ev.titulo}`,
      cuerpo: [ev.fecha, ev.lugar].filter(Boolean).join(' · '),
      icono: ev.imagen || '/logo.png',
      url: `/eventos/${ev.id}`,
    }
  }
  const titulos = eventos.slice(0, 3).map((e) => e.titulo).join(' · ')
  return {
    titulo: `${eventos.length} eventos nuevos en Navalcarnero`,
    cuerpo: titulos + (eventos.length > 3 ? '…' : ''),
    icono: '/logo.png',
    url: '/eventos',
  }
}

/**
 * Envía el digest a las suscripciones cuyos temas intersecan con los de algún
 * evento de `eventos` (cada evento debe traer `temas: []` ya resueltos, además
 * de id/titulo/fecha/lugar/imagen). Lotes concurrentes de TAMANO_LOTE.
 *
 * Devuelve { enviadas, fallidas, caducadasBorradas, suscripciones } y nunca
 * lanza por fallos de envío individuales — el cron no debe romperse por esto.
 */
export async function enviarDigest(eventos) {
  // `configurado: false` avisa al llamador de que no hubo intento de envío
  // (sin claves VAPID): así el cron no marca los eventos como notificados.
  const resumen = { configurado: false, enviadas: 0, fallidas: 0, caducadasBorradas: 0, suscripciones: 0 }
  if (!vapidConfigurado()) {
    console.warn('Push: faltan VITE_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY, no se envía nada.')
    return resumen
  }
  resumen.configurado = true
  if (!eventos.length) return resumen

  const sql = obtenerSql()
  const suscripciones = await sql`
    SELECT endpoint, p256dh, auth, temas FROM push_suscripciones
  `
  resumen.suscripciones = suscripciones.length
  if (!suscripciones.length) return resumen

  // Emparejar cada suscripción con los eventos que le interesan.
  const envios = []
  for (const sus of suscripciones) {
    const suyos = eventos.filter((ev) => interseca(sus.temas, ev.temas))
    if (suyos.length) envios.push({ sus, payload: JSON.stringify(cargaUtil(suyos)) })
  }

  const caducadas = []
  for (let i = 0; i < envios.length; i += TAMANO_LOTE) {
    const lote = envios.slice(i, i + TAMANO_LOTE)
    const resultados = await Promise.allSettled(
      lote.map(({ sus, payload }) =>
        webpush.sendNotification(
          { endpoint: sus.endpoint, keys: { p256dh: sus.p256dh, auth: sus.auth } },
          payload
        )
      )
    )
    resultados.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        resumen.enviadas++
        return
      }
      const status = r.reason?.statusCode
      if (status === 404 || status === 410) {
        caducadas.push(lote[j].sus.endpoint)
      } else {
        resumen.fallidas++
        console.error('Push: fallo al enviar:', status || r.reason?.message)
      }
    })
  }

  if (caducadas.length) {
    await sql`DELETE FROM push_suscripciones WHERE endpoint = ANY(${caducadas})`
    resumen.caducadasBorradas = caducadas.length
  }

  return resumen
}
