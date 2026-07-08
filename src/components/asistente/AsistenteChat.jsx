import { useRef, useState, useEffect } from 'react'
import MIcon from '../MIcon.jsx'

const saludoInicial = {
  autor: 'asistente',
  texto:
    '¡Hola! Soy tu asistente local. Puedo ayudarte con horarios del bus, trámites municipales o recomendarte qué hacer hoy en el pueblo.',
}

const sugerencias = [
  { icono: 'celebration', texto: '¿Cuándo es la próxima fiesta?' },
  { icono: 'description', texto: '¿Cómo saco el certificado de empadronamiento?' },
  { icono: 'schedule', texto: 'Horarios del bus a Madrid' },
]

// Convierte el historial visible en mensajes para la API (rol user/assistant),
// omitiendo el saludo inicial del asistente.
function aMensajesApi(historial) {
  return historial
    .filter((m, i) => !(i === 0 && m.autor === 'asistente'))
    .map((m) => ({ role: m.autor === 'usuario' ? 'user' : 'assistant', content: m.texto }))
}

// Conversación con el asistente: lista de mensajes, sugerencias y campo de
// entrada. Se reutiliza tanto en la página completa (móvil / navegación
// directa) como en el panel deslizante de escritorio (AsistenteChatPanel).
export default function AsistenteChat({ className = '' }) {
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

  const sinConversacion = mensajes.length === 1

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {/* Conversación */}
      <div className="nv-card hide-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
                m.autor === 'usuario'
                  ? 'rounded-br-md bg-primary text-on-primary'
                  : 'rounded-bl-md bg-surface-container text-on-surface'
              }`}
            >
              {m.texto || (
                <span className="inline-flex gap-1 text-on-surface-variant">
                  <span className="animate-pulse">Escribiendo…</span>
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {/* Sugerencias frecuentes */}
      {sinConversacion && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Sugerencias frecuentes
          </p>
          <div className="flex flex-col gap-2">
            {sugerencias.map((s) => (
              <button
                key={s.texto}
                type="button"
                onClick={() => preguntar(s.texto)}
                className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-3 text-left text-sm text-on-surface shadow-card transition-colors hover:bg-surface-container"
              >
                <MIcon name={s.icono} className="text-[18px] text-secondary" />
                {s.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entrada */}
      <form onSubmit={enviar} className="mt-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-1.5 shadow-card">
          <MIcon name="add_circle" className="text-[22px] text-on-surface-variant" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pregunta algo sobre el pueblo…"
            disabled={enviando}
            className="w-full bg-transparent py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          aria-label="Enviar"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-on-primary transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
        >
          <MIcon name="send" className="text-[20px]" />
        </button>
      </form>
    </div>
  )
}
