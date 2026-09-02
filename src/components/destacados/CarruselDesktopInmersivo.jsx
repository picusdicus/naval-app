import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { cartelDe } from '../../lib/gaceta.js'
import { reportarClicDestacado } from '../../lib/useAnalytics.js'
import { useImagenDestacado } from './useImagenDestacado.js'

// Carrusel inmersivo de destacados para el Inicio de escritorio (mockup 4a):
// slides a sangre completa (min 340px en tablet, 440px en lg+) con la foto o
// un degradado de cartel, título enorme en DM Serif itálica, un extracto y dos
// botones pill; a la derecha, la meta (fecha/lugar u horario). Índice
// controlado con flechas y puntos, autoavance cada 6s con pausa al pasar el
// ratón y respeto de prefers-reduced-motion. Consume la forma `tarjeta` de
// useDestacados.
const AVANCE_MS = 6000

function Slide({ d, seccion }) {
  const item = d.item || {}
  const cartel = cartelDe(item.categoria)
  const desc = (item.descripcion || '').trim()
  const secundario = d.tipo === 'comercio' ? { to: '/comercios', texto: 'Ver el directorio' } : { to: '/eventos', texto: 'Ver toda la agenda' }
  // Con fallback si la foto falla al cargar (cartel externo que ya no existe).
  const { imagen, imagenPos, onError } = useImagenDestacado(d)

  return (
    <div className="min-w-full">
      <div className="relative min-h-[340px] overflow-hidden lg:min-h-[440px]">
        {/* Fondo: los carteles son verticales; en vez de recortarlos a sangre
            (queda feo), se usa una versión ampliada y desenfocada como ambiente
            y el cartel real se muestra entero a la derecha. Sin foto: degradado
            de cartel con el símbolo de la categoría. */}
        {imagen ? (
          <img
            src={imagen}
            alt=""
            aria-hidden="true"
            onError={onError}
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
            style={{ objectPosition: imagenPos || '50% 50%' }}
          />
        ) : (
          <div className="gz-trama-clara absolute inset-0" style={{ background: cartel.fondo }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-15">
              <MIcon name={d.simbolo} className="text-[220px] text-white" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/50" />
        <span className="gz-badge-oro absolute left-7 top-7 z-20">{d.badge}</span>

        <div className="relative z-10 flex min-h-[340px] items-center gap-7 p-7 lg:min-h-[440px] lg:gap-10 lg:p-11">
          <div className="min-w-0 max-w-[600px] flex-1">
            <div className="font-mono-ibm text-[12px] uppercase tracking-rotulo text-papel/80">{d.badge}</div>
            <h2 className="mt-2.5 font-serif-dm text-[40px] italic leading-[0.85] text-papel lg:text-[64px]">{d.titulo}</h2>
            {desc && (
              <p className="mt-4 max-w-xl font-serif-spectral text-[17px] leading-relaxed text-papel/85">
                {desc.length > 180 ? `${desc.slice(0, 180)}…` : desc}
              </p>
            )}
            {d.lineas.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-papel/70">
                {d.lineas.map((linea) => (
                  <span key={`${linea.icono}-${linea.texto}`} className="inline-flex items-center gap-1">
                    <MIcon name={linea.icono} className="text-[13px]" />
                    {linea.texto}
                  </span>
                ))}
              </div>
            )}
            {/* Botones solo para eventos; los comercios se muestran sin CTA. */}
            {d.tipo !== 'comercio' && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={d.to}
                  onClick={seccion ? () => reportarClicDestacado(d, seccion) : undefined}
                  className="gz-boton-pill"
                >
                  Ver detalles
                </Link>
                <Link
                  to={secundario.to}
                  className="rounded-full border border-papel/50 px-6 py-3 font-serif-spectral text-papel transition-colors hover:bg-papel/10"
                >
                  {secundario.texto}
                </Link>
              </div>
            )}
          </div>

          {/* Cartel real, entero (vertical), cuando hay foto: sin él, el fondo
              desenfocado queda como una mancha sin imagen. En tablet (md) se
              muestra más pequeño; solo en móvil desaparece (ahí manda el
              carrusel nativo, este componente ni se monta). */}
          {imagen && (
            <div className="hidden flex-shrink-0 md:block">
              <img
                src={imagen}
                alt=""
                className="max-h-[250px] w-auto rounded-lg shadow-cartel lg:max-h-[360px]"
                style={{ objectPosition: imagenPos || '50% 50%' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CarruselDesktopInmersivo({ items, seccion }) {
  const [idx, setIdx] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = items?.length ?? 0

  useEffect(() => {
    if (total <= 1 || pausado) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setInterval(() => setIdx((i) => (i + 1) % total), AVANCE_MS)
    return () => clearInterval(t)
  }, [total, pausado])

  if (total === 0) return null
  const ir = (n) => setIdx(((n % total) + total) % total)

  return (
    <section onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      <div className="mb-3 flex items-end justify-between">
        <span className="gz-eyebrow">Destacados · Eventos y comercios</span>
        {total > 1 && (
          <div className="flex gap-3 font-mono-ibm text-lg text-mudo">
            <button type="button" onClick={() => ir(idx - 1)} aria-label="Anterior" className="transition-colors hover:text-terracota">
              ←
            </button>
            <button type="button" onClick={() => ir(idx + 1)} aria-label="Siguiente" className="transition-colors hover:text-terracota">
              →
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl shadow-cartel">
        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {items.map((d) => (
            <Slide key={d.id} d={d} seccion={seccion} />
          ))}
        </div>
      </div>

      {total > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {items.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ir al destacado ${i + 1}`}
              className={`h-1 rounded-full transition-all ${i === idx ? 'w-6 bg-tinta' : 'w-2.5 bg-filete-claro'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
