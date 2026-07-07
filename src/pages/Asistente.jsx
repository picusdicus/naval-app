import { useRef, useState, useEffect } from 'react'
import { IconChat } from '../components/icons.jsx'

const saludoInicial = {
  autor: 'asistente',
  texto:
    '¡Hola! Soy el asistente vecinal de Navalcarnero. Puedo ayudarte con trámites municipales, horarios o información del pueblo. ¿En qué te echo una mano?',
}

const sugerencias = [
  '¿Qué necesito para empadronarme?',
  '¿Cómo pido cita en el Ayuntamiento?',
  '¿Qué hace falta para una reforma en casa?',
]

// Convierte el historial visible en mensajes para la API (rol user/assistant),
// omitiendo el saludo inicial del asistente.
function aMensajesApi(historial) {
  return historial
    .filter((m, i) => !(i === 0 && m.autor === 'asistente'))
    .map((m) => ({ role: m.autor === 'usuario' ? 'user' : 'assistant', content: m.texto }))
}

export default function Asistente() {
  const [mensajes, setMensajes] = useState([saludoInicial])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const finRef = useRef(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [mensajes])

  async function preguntar(pregunta) {
    const contenido = pregunta.trim()
    if (!contenido || enviando) return
    setTexto('')
    setEnviando(true)

    const historial = [...mensajes, { autor: 'usuario', texto: contenido }]
    // Añadimos una burbuja de asistente vacía que iremos rellenando.
    setMensajes([...historial, { autor: 'asistente', texto: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: aMensajesApi(historial) }),
      })

      if (!res.ok || !res.body) {
        throw new Error('sin respuesta')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setMensajes((prev) => {
          const copia = [...prev]
          copia[copia.length - 1] = { autor: 'asistente', texto: acumulado }
          return copia
        })
      }
    } catch {
      setMensajes((prev) => {
        const copia = [...prev]
        copia[copia.length - 1] = {
          autor: 'asistente',
          texto:
            'Ahora mismo no puedo responder. El asistente necesita estar desplegado con una clave de API configurada. Inténtalo de nuevo más tarde.',
        }
        return copia
      })
    } finally {
      setEnviando(false)
    }
  }

  function enviar(e) {
    e.preventDefault()
    preguntar(texto)
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col md:h-[calc(100vh-220px)]">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <IconChat className="h-6 w-6 text-vino" />
          <h1 className="font-display text-2xl font-semibold text-vino">Asistente IA</h1>
        </div>
        <p className="mt-1 text-sm text-tinta-muted">
          Pregunta sobre trámites municipales, horarios o información local del pueblo.
        </p>
      </header>

      <div className="nv-card flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.autor === 'usuario'
                  ? 'rounded-br-sm bg-vino text-crema'
                  : 'rounded-bl-sm bg-crema-dark text-tinta'
              }`}
            >
              {m.texto || (
                <span className="inline-flex gap-1 text-tinta-muted">
                  <span className="animate-pulse">Escribiendo…</span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {mensajes.length === 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => preguntar(s)}
              className="rounded-full bg-white px-3 py-1.5 text-xs text-tinta-muted shadow-soft hover:text-vino"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={enviando}
          className="flex-1 rounded-full border border-vino/15 bg-white px-4 py-2.5 text-sm text-tinta shadow-soft outline-none focus:border-vino disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-vino px-5 py-2 text-sm font-medium text-crema disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
