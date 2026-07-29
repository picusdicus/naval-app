import { useMemo } from 'react'
import TarjetaEvento from './TarjetaEvento'
import { CATEGORIAS_EVENTO, diaSemanaDe, mesDe } from '../../lib/eventos'
import MIcon from '../MIcon'

/**
 * Muro de carteles "La cartelera, día a día".
 * - Rejilla de 4 columnas (2 en móvil).
 * - Cada día abre con una banda a todo el ancho (número + día/mes + nº de actos).
 * - Carteles del día en orden cronológico; el destacado ocupa 2 columnas.
 * - Si un día tiene más actos de los que caben, cierra con una pieza de
 *   desborde "+N actos más" que enlaza al programa del día.
 */

// Umbral de desborde: a partir de aquí el día muestra una selección + la pieza
// "+N actos más" en lugar de volcar decenas de carteles en la cartelera.
const MAX_VISIBLES = 7

export default function MuroCartelera({
  eventosAgrupados = [],
  categoriasActivas = [],
  idsDestacados = new Set(),
  onClickEvento = () => {},
  onVerDiaCompleto = () => {},
}) {
  // Filtra cada grupo por las categorías activas y descarta los días sin actos.
  const gruposFiltrados = useMemo(() => {
    return eventosAgrupados
      .map(({ dia, eventos }) => {
        const filtrados =
          categoriasActivas.length > 0
            ? eventos.filter((e) => categoriasActivas.includes(e.categoria))
            : eventos
        return { dia, eventos: filtrados }
      })
      .filter(({ eventos }) => eventos.length > 0)
  }, [eventosAgrupados, categoriasActivas])

  if (gruposFiltrados.length === 0) {
    const nombres = categoriasActivas
      .map((id) => CATEGORIAS_EVENTO[id]?.nombre?.toLowerCase())
      .filter(Boolean)
    const mensaje =
      nombres.length > 0
        ? `No hay nada de ${nombres.join(' ni ')} por ahora`
        : 'No hay eventos próximos por ahora'
    return (
      <div className="w-full py-12 text-center">
        <div className="inline-block rounded-lg border-2 border-tinta bg-papel px-6 py-5">
          <p className="mb-2 font-serif-dm text-2xl italic text-tinta">{mensaje}</p>
          <p className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-pardo">
            Prueba otra categoría
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-10">
      {gruposFiltrados.map(({ dia, eventos }) => {
        const diaNombre = diaSemanaDe(dia)
        const mesNombre = mesDe(dia)
        const numeroDia = parseInt(dia.split('-')[2], 10)

        const tieneDesborde = eventos.length > MAX_VISIBLES
        const visibles = tieneDesborde ? eventos.slice(0, MAX_VISIBLES - 1) : eventos
        const ocultos = tieneDesborde ? eventos.slice(MAX_VISIBLES - 1) : []

        return (
          <section key={dia} id={`dia-${dia}`} className="animate-fade scroll-mt-24">
            {/* Banda del día (a todo el ancho) */}
            <div className="mb-4 flex items-baseline gap-3 border-b-2 border-tinta pb-2">
              <span className="font-serif-dm text-4xl leading-none text-tinta md:text-5xl">
                {numeroDia}
              </span>
              <span className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-pardo">
                {diaNombre} · {mesNombre}
              </span>
              <span className="ml-auto font-mono-ibm text-[11px] uppercase tracking-etiqueta text-pardo">
                {eventos.length} acto{eventos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Carteles del día */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {visibles.map((evento) => (
                <TarjetaEvento
                  key={evento.id}
                  evento={evento}
                  destacado={idsDestacados.has(evento.id)}
                  onClick={() => onClickEvento(evento)}
                />
              ))}

              {/* Pieza de desborde */}
              {tieneDesborde && (
                <button
                  type="button"
                  onClick={() => onVerDiaCompleto(dia)}
                  className="group flex flex-col rounded-lg border-2 border-dashed border-tinta p-4 text-left transition hover:bg-papel-calido"
                  style={{ aspectRatio: '3 / 4' }}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif-dm text-3xl italic text-tinta">
                      +{ocultos.length}
                    </span>
                    <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                      actos más
                    </span>
                  </div>

                  <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-hidden">
                    {ocultos.slice(0, 4).map((e) => (
                      <div
                        key={e.id}
                        className="truncate font-mono-ibm text-[10px] text-pardo"
                      >
                        <span className="text-tinta">{e.hora || '—'}</span> {e.titulo}
                      </div>
                    ))}
                  </div>

                  <span className="mt-2 inline-flex items-center gap-1 border-t border-tinta/30 pt-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-all group-hover:gap-2">
                    Ver el día completo
                    <MIcon name="arrow_forward" className="text-[13px]" />
                  </span>
                </button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
