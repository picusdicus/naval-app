import { useState } from 'react'
import { diferenciasTaller } from '../../../lib/talleresPropuestas.js'
import MIcon from '../../MIcon.jsx'

// Bandeja de actualizaciones propuestas por una reimportación del folleto
// (fase 3), en la cabecera del tab Talleres.
//
// Va aquí y no en una vista aparte porque tras importar hay que despachar una
// COLA: buscarlas dentro del listado sería peor, y los chips de estado del tab
// filtran por estado de *taller*, que a una propuesta no le aplica.
//
// El diff se calcula AQUÍ, en cada render, contra el taller que el tab acaba de
// cargar — nunca se guarda. Si se guardara mostraría una foto del momento de
// importar en vez del estado actual del taller.

function Valor({ children, tono }) {
  return (
    <span
      className={`font-serif-spectral text-sm ${
        tono === 'antes' ? 'text-mudo line-through decoration-mudo/60' : 'text-tinta'
      }`}
    >
      {children || <em className="not-italic text-mudo">(vacío)</em>}
    </span>
  )
}

function Cambio({ cambio }) {
  if (cambio.lista) {
    return (
      <div className="grid gap-1 py-1.5 md:grid-cols-[8rem_1fr]">
        <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          {cambio.etiqueta}
        </span>
        <div className="grid gap-2 md:grid-cols-2">
          <ul className="flex flex-col gap-0.5">
            {cambio.antes.length === 0 && <Valor tono="antes" />}
            {cambio.antes.map((t, i) => (
              <li key={i}>
                <Valor tono="antes">{t}</Valor>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-0.5">
            {cambio.despues.map((t, i) => (
              <li key={i}>
                <Valor>{t}</Valor>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-1 py-1.5 md:grid-cols-[8rem_1fr]">
      <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
        {cambio.etiqueta}
      </span>
      <div className="grid gap-2 md:grid-cols-2">
        <Valor tono="antes">{cambio.antes}</Valor>
        <Valor>{cambio.despues}</Valor>
      </div>
    </div>
  )
}

export default function PropuestasTalleres({
  propuestas,
  talleres,
  ocupadoId,
  onAceptar,
  onDescartar,
  onEditar,
}) {
  const [abierta, setAbierta] = useState(null)

  if (propuestas.length === 0) return null

  return (
    <section className="border border-oro bg-papel-calido p-3">
      <h3 className="flex items-center gap-2 font-serif-dm text-base text-tinta">
        <MIcon name="difference" className="text-[18px] text-oro" />
        Actualizaciones propuestas
        <span className="bg-oro px-1.5 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta">
          {propuestas.length}
        </span>
      </h3>
      <p className="mt-1 font-serif-spectral text-sm text-pardo">
        Estos talleres ya existían al reimportar el folleto. Nada se ha modificado todavía: el
        catálogo sigue como estaba hasta que aceptes cada cambio.
      </p>

      <ul className="mt-3 flex flex-col divide-y divide-filete border-y border-filete">
        {propuestas.map((propuesta) => {
          const taller = talleres.find((t) => t.id === propuesta.tallerId)
          const ocupado = ocupadoId === propuesta.id
          const desplegada = abierta === propuesta.id

          // Defensivo: el ON DELETE CASCADE se lleva la propuesta si borran el
          // taller, así que esto solo se vería con la lista desincronizada.
          if (!taller) {
            return (
              <li key={propuesta.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="font-serif-spectral text-sm text-mudo">
                  El taller de esta propuesta ya no existe.
                </span>
                <button
                  type="button"
                  onClick={() => onDescartar(propuesta)}
                  disabled={ocupado}
                  className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota hover:text-tinta disabled:opacity-40"
                >
                  Descartar
                </button>
              </li>
            )
          }

          const cambios = diferenciasTaller(taller, propuesta.datos)

          return (
            <li key={propuesta.id} className="flex flex-col gap-2 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-serif-dm text-base text-tinta">{taller.nombre}</span>
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                    {cambios.length === 0
                      ? 'Ya coincide con el folleto'
                      : `Cambia ${cambios.map((c) => c.etiqueta.toLowerCase()).join(', ')}`}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
                  {cambios.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAbierta(desplegada ? null : propuesta.id)}
                      className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota"
                      aria-expanded={desplegada}
                    >
                      {desplegada ? 'Ocultar cambios' : 'Ver cambios'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAceptar(propuesta)}
                    disabled={ocupado || cambios.length === 0}
                    title={
                      cambios.length === 0
                        ? 'No hay nada que aplicar: descártala'
                        : 'Aplicar estos cambios al taller'
                    }
                    className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota disabled:opacity-40"
                  >
                    Aceptar
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditar(taller, propuesta)}
                    disabled={ocupado}
                    className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta hover:text-terracota disabled:opacity-40"
                  >
                    Editar y aceptar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDescartar(propuesta)}
                    disabled={ocupado}
                    className="px-2 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota hover:text-tinta disabled:opacity-40"
                  >
                    Descartar
                  </button>
                </div>
              </div>

              {desplegada && cambios.length > 0 && (
                <div className="border border-filete bg-papel p-2.5">
                  <div className="hidden gap-2 border-b border-filete pb-1 md:grid md:grid-cols-[8rem_1fr]">
                    <span />
                    <div className="grid grid-cols-2 gap-2 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                      <span>Ahora</span>
                      <span>Según el folleto</span>
                    </div>
                  </div>
                  <div className="divide-y divide-filete">
                    {cambios.map((c) => (
                      <Cambio key={c.campo} cambio={c} />
                    ))}
                  </div>
                  <p className="mt-2 font-serif-spectral text-xs text-pardo">
                    La descripción, el cartel y el estado del taller no cambian: el folleto no los
                    trae.
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
