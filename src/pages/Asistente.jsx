import { useState } from 'react'
import { IconChat } from '../components/icons.jsx'

const mensajesIniciales = [
  {
    autor: 'asistente',
    texto:
      '¡Hola! Soy el asistente vecinal de Navalcarnero. Puedo ayudarte con trámites municipales, horarios o información del pueblo.',
  },
  {
    autor: 'usuario',
    texto: '¿Qué necesito para empadronarme?',
  },
  {
    autor: 'asistente',
    texto:
      'Para empadronarte necesitas DNI/NIE, un documento que acredite tu domicilio (contrato de alquiler o escritura) y cita previa en el Ayuntamiento. ¿Quieres que te indique cómo pedir la cita?',
  },
]

export default function Asistente() {
  const [mensajes, setMensajes] = useState(mensajesIniciales)
  const [texto, setTexto] = useState('')

  function enviar(e) {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido) return

    setMensajes((prev) => [
      ...prev,
      { autor: 'usuario', texto: contenido },
      {
        autor: 'asistente',
        texto: 'Esta función todavía no está disponible. Muy pronto podré responder de verdad a esta pregunta.',
      },
    ])
    setTexto('')
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

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-tierra/10 bg-white p-4">
        {mensajes.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.autor === 'usuario' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.autor === 'usuario'
                  ? 'rounded-br-sm bg-tierra text-crema'
                  : 'rounded-bl-sm bg-crema-dark text-tinta'
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={enviar} className="mt-3 flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-full border border-tierra/20 bg-white px-4 py-2 text-sm text-tinta outline-none focus:border-tierra"
        />
        <button
          type="submit"
          className="rounded-full bg-vino px-5 py-2 text-sm font-medium text-crema"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
