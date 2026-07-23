// Utilidades de NAVEGADOR para las notificaciones push (fase 1). Solo las usa
// la UI: la lógica compartida con el servidor (temas, mapeos) vive en
// temasPush.js.
//
// Las preferencias se duplican en localStorage únicamente para pintar la UI
// sin llamar al servidor en cada carga: la fuente de verdad es la fila de
// push_suscripciones en Neon.

import { validarTemas } from './temasPush.js'

const CLAVE_LOCAL = 'ncv_push_temas'
// Estado de la bandeja, POR DISPOSITIVO (las suscripciones son anónimas: no hay
// estado de lectura en Neon). Dos listas de `referencia_id`:
//   - leídos: avisos que el vecino ya marcó/abrió.
//   - ocultos: avisos que borró de ESTE dispositivo (no se tocan para los demás;
//     el aviso sigue en el feed global, solo se oculta aquí).
const CLAVE_LEIDOS = 'ncv_avisos_leidos'
const CLAVE_OCULTOS = 'ncv_avisos_ocultos'
// Marca de la primera versión (timestamp de última visita); se migra una vez.
const CLAVE_VISTO_LEGACY = 'ncv_push_visto'

function leerLista(clave) {
  try {
    const v = JSON.parse(localStorage.getItem(clave))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function guardarLista(clave, lista) {
  try {
    localStorage.setItem(clave, JSON.stringify(lista))
  } catch {
    // localStorage bloqueado: se perderá el estado de lectura, no es crítico.
  }
}

/** Ids de avisos marcados como leídos en este dispositivo. */
export function avisosLeidos() {
  return leerLista(CLAVE_LEIDOS)
}

/** Ids de avisos borrados (ocultos) en este dispositivo. */
export function avisosOcultos() {
  return leerLista(CLAVE_OCULTOS)
}

export function guardarLeidos(lista) {
  guardarLista(CLAVE_LEIDOS, lista)
}

export function guardarOcultos(lista) {
  guardarLista(CLAVE_OCULTOS, lista)
}

/** Timestamp de la primera versión (o null); para migrar el estado una sola vez. */
export function vistoLegacy() {
  try {
    return localStorage.getItem(CLAVE_VISTO_LEGACY)
  } catch {
    return null
  }
}

export function limpiarVistoLegacy() {
  try {
    localStorage.removeItem(CLAVE_VISTO_LEGACY)
  } catch {
    // Ídem.
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

/**
 * ¿Este navegador tiene una suscripción push real? Es la fuente de verdad del
 * estado "activado": la copia de localStorage solo pinta los temas, y si se
 * borra (limpieza del navegador) la baja debe seguir siendo posible.
 */
export async function haySuscripcionReal() {
  try {
    if (!soportaPush()) return false
    const registro = await navigator.serviceWorker.getRegistration()
    const suscripcion = await registro?.pushManager.getSubscription()
    return Boolean(suscripcion)
  } catch {
    return false
  }
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
