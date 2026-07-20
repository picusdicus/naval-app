// Utilidades de NAVEGADOR para las notificaciones push (fase 1). Solo las usa
// la UI: la lógica compartida con el servidor (temas, mapeos) vive en
// temasPush.js.
//
// Las preferencias se duplican en localStorage únicamente para pintar la UI
// sin llamar al servidor en cada carga: la fuente de verdad es la fila de
// push_suscripciones en Neon.

import { validarTemas } from './temasPush.js'

const CLAVE_LOCAL = 'ncv_push_temas'
// Marca de tiempo (ISO) de la última vez que el vecino abrió la bandeja: todo
// aviso posterior cuenta como "no leído". Vive solo en el cliente porque las
// suscripciones son anónimas (no hay estado de lectura por dispositivo en Neon).
const CLAVE_VISTO = 'ncv_push_visto'

/** Instante de la última apertura de la bandeja (ISO), o null si nunca se abrió. */
export function vistoLocal() {
  try {
    return localStorage.getItem(CLAVE_VISTO)
  } catch {
    return null
  }
}

/** Marca la bandeja como leída hasta ahora (se llama al abrirla). */
export function marcarVisto() {
  try {
    localStorage.setItem(CLAVE_VISTO, new Date().toISOString())
  } catch {
    // localStorage bloqueado: se perderá el "no leído", no es crítico.
  }
}

/** ¿El navegador soporta Web Push? (en iOS, solo dentro de la PWA instalada). */
export function soportaPush() {
  return (
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
}

/** iPhone/iPad (el iPadOS de escritorio se delata por ser "Mac" táctil). */
export function esIOS() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** ¿La app corre instalada en pantalla de inicio (modo standalone)? */
export function esPWAInstalada() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
}

/** Temas guardados localmente (o null si no hay suscripción hecha desde aquí). */
export function prefsLocales() {
  try {
    return validarTemas(JSON.parse(localStorage.getItem(CLAVE_LOCAL)))
  } catch {
    return null
  }
}

function guardarPrefsLocales(temas) {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(temas))
  } catch {
    // localStorage lleno o bloqueado: la suscripción del servidor sigue valiendo.
  }
}

function borrarPrefsLocales() {
  try {
    localStorage.removeItem(CLAVE_LOCAL)
  } catch {
    // Ídem.
  }
}

// La clave VAPID pública viaja base64url; PushManager la quiere en bytes.
function claveAUint8Array(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const crudo = atob(base64)
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

/**
 * Pide permiso (SIEMPRE debe llamarse desde un gesto del usuario), suscribe el
 * dispositivo y da de alta/actualiza en el servidor. Lanza Error con mensaje
 * en castellano si algo impide suscribirse.
 */
export async function suscribir(temas) {
  const registro = await navigator.serviceWorker.getRegistration()
  if (!registro) {
    // En dev el service worker no se registra (guard de import.meta.env.PROD).
    throw new Error('Las notificaciones solo están disponibles en la app publicada.')
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    throw new Error('Sin el permiso de notificaciones del navegador no podemos avisarte.')
  }

  const clavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!clavePublica) {
    throw new Error('Los avisos no están configurados en el servidor.')
  }

  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: claveAUint8Array(clavePublica),
  })

  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suscripcion: suscripcion.toJSON(), temas }),
  })
  if (!res.ok) {
    const datos = await res.json().catch(() => ({}))
    throw new Error(datos.error || 'No se pudo guardar la suscripción.')
  }

  guardarPrefsLocales(temas)
}

/** Baja: borra la fila del servidor, desuscribe el navegador y limpia local. */
export async function desuscribir() {
  const registro = await navigator.serviceWorker.getRegistration()
  const suscripcion = await registro?.pushManager.getSubscription()
  if (suscripcion) {
    // Primero el servidor: si fallara después, el envío limpiará la fila al
    // recibir 410 del push service (limpieza inline).
    await fetch('/api/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: suscripcion.endpoint }),
    }).catch(() => {})
    await suscripcion.unsubscribe().catch(() => {})
  }
  borrarPrefsLocales()
}
