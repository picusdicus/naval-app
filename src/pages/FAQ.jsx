import { useState } from 'react'
import MIcon from '../components/MIcon.jsx'

const preguntas = [
  {
    numero: '01',
    titulo: '¿Para qué sirve la app?',
    respuesta:
      'Es la plaza digital del pueblo. Navalcarnero en tu bolsillo: aquí encuentras todo lo que pasa hoy en tu comunidad. En Eventos tienes la agenda cultural completa; en Comercios, el directorio de negocios locales; en Noticias, los avisos del Ayuntamiento (obras, servicios, cambios en la ciudad). Y el Asistente IA te ayuda a entender trámites municipales sin salir de la app.',
  },
  {
    numero: '02',
    titulo: '¿Cómo instalo la app en mi teléfono?',
    respuesta: `Puedes guardarla como icono en la pantalla de inicio sin descargarla de una tienda. En Android: toca el botón ⋮ del navegador, elige "Instalar app" y sigue las instrucciones. En iPhone: toca el icono de compartir, elige "Añadir a pantalla de inicio" y da un nombre (puedes dejarlo como está). Después tendrás la app con su icono en tu pantalla, como cualquier otra aplicación.`,
  },
  {
    numero: '03',
    titulo: '¿Qué es la suscripción a avisos?',
    respuesta:
      'Recibe notificaciones sobre lo que te interesa sin estar constantemente dentro de la app. Ve a la sección Eventos, toca "Recibir avisos" y elige: Todos los eventos, solo ciertos tipos (conciertos, deportes…) u organizaciones concretas (TYL TYL, Ayuntamiento…). Cuando suceda algo, recibirás un aviso en tu teléfono. Puedes cambiar tus preferencias cuando quieras.',
  },
  {
    numero: '04',
    titulo: '¿Dónde veo mis avisos?',
    respuesta:
      'En el icono de campana de la cabecera (arriba). Ahí tienes un historial de todas las notificaciones que has recibido en los últimos días. Puedes marcar las que ya has leído, ocultar las que no te interesen o ver todas juntas.',
  },
  {
    numero: '05',
    titulo: '¿Cómo funciona el mapa de comercios?',
    respuesta:
      'En la sección Comercios verás una lista de tiendas, servicios y negocios cercanos. Toca cualquiera para ver su teléfono, dirección y tipo de negocio. Si tocas el icono de mapa, ves todos los comercios en el mapa interactivo: toca un punto para abrir su ficha. También puedes filtrar por tipo (farmacias, bares, tiendas…) o buscar por nombre.',
  },
  {
    numero: '06',
    titulo: '¿Qué es el Asistente IA?',
    respuesta:
      'Es tu ayudante para entender trámites municipales sin pedir cita en el Ayuntamiento. Pregúntale cosas como "¿cómo cambio de domicilio?" o "¿cuánto cuesta una licencia de obra?". Responde en español claro, basándose en los datos reales de Navalcarnero y los avisos del Ayuntamiento. No reemplaza al Ayuntamiento, pero te ahorra una llamada muchas veces.',
  },
  {
    numero: '07',
    titulo: '¿Funciona sin conexión?',
    respuesta:
      'Parcialmente. Los eventos, comercios y noticias que ya viste se guardan en tu teléfono, así que los puedes ver sin internet. El Asistente y los avisos nuevos necesitan conexión. La app se actualiza automáticamente cada vez que conectas, así que siempre tienes información fresca.',
  },
  {
    numero: '08',
    titulo: '¿Es gratuita?',
    respuesta:
      'Sí, completamente. La app de Navalcarnero es un servicio público para los vecinos. Sin anuncios, sin compras dentro de la app, sin rastreo. Lo único que necesitas es una conexión a internet (excepto para ver contenido en caché).',
  },
  {
    numero: '09',
    titulo: '¿Mis datos están seguros?',
    respuesta:
      'Tus datos de suscripción a avisos nunca se asignan a una cuenta personal: no sabemos quién eres. Tu teléfono decide a qué temas estar suscrito, y esa información solo viaja al servidor cuando actualizas preferencias. No vendemos ni compartimos datos. Revisa la política de privacidad para los detalles completos.',
  },
  {
    numero: '10',
    titulo: '¿Puedo sugerir un comercio o evento?',
    respuesta:
      'Sí. En la sección Comercios, abajo, hay un formulario "Sugerir un comercio". Cuéntanos qué negocio local falta en la app y nosotros lo añadimos. Los eventos, por ahora, deben ser creados por la organización responsable desde el panel de gestión.',
  },
  {
    numero: '11',
    titulo: '¿Cómo informo de un problema?',
    respuesta:
      'Si la app no funciona bien, envía un mensaje a través del formulario de contacto en el Ayuntamiento o llama al 918 10 11 41. Describe qué pasa (ej: "no recibo avisos") y el dispositivo que usas (Android/iPhone). El equipo lo revisará rápidamente.',
  },
]

export default function FAQ() {
  const [expandidas, setExpandidas] = useState({})

  const alternarPregunta = (numero) => {
    setExpandidas((prev) => ({
      ...prev,
      [numero]: !prev[numero],
    }))
  }

  return (
    <div className="min-h-screen bg-papel-lienzo pb-16">
      <div className="h-2 bg-tinta-intensa" />

      {/* Cabecera */}
      <header className="border-b border-filete bg-papel">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-tinta transition-colors hover:text-pardo">
              <MIcon name="arrow_back" className="text-[24px]" />
            </a>
            <div className="flex-1">
              <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">Cómo funciona</p>
              <h1 className="font-serif-dm text-seccion text-tinta">Preguntas frecuentes</h1>
            </div>
          </div>
          <p className="mt-4 font-serif-spectral text-sm text-pardo">
            Todo lo que necesitas saber sobre la app: instalación, avisos, seguridad y más.
          </p>
        </div>
      </header>

      {/* Buscador */}
      <div className="border-b border-filete bg-papel px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 border border-filete bg-papel-lienzo px-3 py-2.5">
            <MIcon name="search" className="text-[18px] text-pardo" />
            <input
              type="text"
              placeholder="Busca en las preguntas…"
              className="w-full bg-transparent font-serif-spectral text-sm text-tinta placeholder-pardo outline-none"
            />
          </div>
        </div>
      </div>

      {/* Preguntas */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="space-y-3">
          {preguntas.map((p) => (
            <div key={p.numero} className="gz-tarjeta-impresa border border-filete">
              <button
                type="button"
                onClick={() => alternarPregunta(p.numero)}
                className="w-full p-4 text-left transition-colors hover:bg-papel-calido sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className="font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta text-pardo">
                    {p.numero}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-serif-dm text-lg leading-tight text-tinta">{p.titulo}</h2>
                  </div>
                  <MIcon
                    name={expandidas[p.numero] ? 'expand_less' : 'expand_more'}
                    className={`flex-shrink-0 text-[20px] text-pardo transition-transform ${
                      expandidas[p.numero] ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {expandidas[p.numero] && (
                <div className="border-t border-filete px-4 py-4 sm:px-5">
                  <div className="ml-6 font-serif-spectral text-sm leading-relaxed text-tinta sm:ml-7">
                    {p.respuesta}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contacto */}
        <div className="mt-12 border border-dashed border-filete-punteado bg-papel-calido px-6 py-8 text-center">
          <MIcon name="help" className="mx-auto text-[40px] text-pardo" />
          <h3 className="mt-3 font-serif-dm text-lg text-tinta">¿No encuentras tu pregunta?</h3>
          <p className="mt-2 font-serif-spectral text-sm text-pardo">
            Contacta directamente al Ayuntamiento de Navalcarnero
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href="tel:918101141"
              className="gz-boton-tinta inline-flex items-center justify-center gap-2"
            >
              <MIcon name="phone" className="text-[16px]" />
              918 10 11 41
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
