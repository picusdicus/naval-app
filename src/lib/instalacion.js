// Instalación de la PWA: captura compartida de `beforeinstallprompt` y
// detección de plataforma. El navegador emite ese evento UNA vez y solo a
// quien esté escuchando en ese momento, así que se captura aquí a nivel de
// módulo (importado desde main.jsx, antes de montar React) y tanto el banner
// (InstallPrompt) como el botón "Instalar app" del menú lateral consumen la
// misma captura. En iOS el evento no existe — ahí la única vía es el menú
// compartir de Safari, y lo que se ofrece son instrucciones.
import { esIOS } from './push.js'

let promptCapturado = null
const oyentes = new Set()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    promptCapturado = e
    oyentes.forEach((cb) => cb(e))
  })
}

/** ¿Hay un prompt nativo capturado y sin usar? */
export function hayPromptDeInstalacion() {
  return promptCapturado !== null
}

/**
 * Avisa cuando el navegador emita el evento (o de inmediato si ya llegó).
 * Devuelve la función de baja, lista para el cleanup de un useEffect.
 */
export function suscribirPromptInstalacion(cb) {
  oyentes.add(cb)
  if (promptCapturado) cb(promptCapturado)
  return () => oyentes.delete(cb)
}

/**
 * Lanza el diálogo nativo de instalación de Chrome/Edge. Devuelve el
 * `outcome` ('accepted' | 'dismissed'), o null si no había prompt capturado
 * (Safari, Firefox, o el prompt ya se consumió — prompt() solo puede
 * llamarse una vez por evento; si el usuario lo descarta, Chrome vuelve a
 * emitir beforeinstallprompt más adelante y se recaptura solo).
 */
export async function pedirInstalacionNativa() {
  if (!promptCapturado) return null
  const evento = promptCapturado
  promptCapturado = null
  evento.prompt()
  const { outcome } = await evento.userChoice
  return outcome
}

/**
 * Safari en iOS/iPadOS. Chrome/Firefox/Edge/Opera en iOS usan el mismo motor
 * pero se delatan en el user agent (CriOS/FxiOS/EdgiOS/OPiOS|OPT) y colocan
 * el botón de compartir en otro sitio — las instrucciones deben distinguirlos.
 */
export function esSafariEnIOS() {
  return esIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(navigator.userAgent)
}
