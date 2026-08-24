import { useMemo } from 'react'
import TarjetaEvento from './TarjetaEvento'
import { CATEGORIAS_EVENTO, diaSemanaDe, mesDe } from '../../lib/eventos'

/**
 * Muro de carteles "La cartelera, día a día".
 * - Rejilla de 4 columnas (2 en móvil).
 * - Cada día abre con una banda a todo el ancho (número + día/mes + nº de actos).
 * - Carteles del día en orden cronológico (por hora); se muestran todos los
 *   actos del día, sin pieza de desborde.
 */

export default function MuroCartelera({
  eventosAgrupados = [],
  categoriasActivas = [],
  idsDestacados = new Set(),
  onClickEvento = () => {},
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
              {eventos.map((evento) => (
                <TarjetaEvento
                  key={evento.id}
                  evento={evento}
                  destacado={idsDestacados.has(evento.id)}
                  onClick={() => onClickEvento(evento)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
