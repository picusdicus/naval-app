import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MIcon from '../MIcon.jsx'
import { reportarClicDestacado } from '../../lib/useAnalytics.js'

// Hero de destacados para ESCRITORIO (mockup Comercios / Eventos): cabecera con
// título editorial + CTA opcional y flechas, y una fila de tarjetas grandes a
// sangre (color de categoría con trama diagonal o foto real), badge oro, título
// en DM Serif itálica, meta en mono y botones de acción. Pagina de 3 en 3 con
// flechas, puntos y autoavance (pausa al pasar el ratón, respeta
// prefers-reduced-motion). Solo se monta en md+; en móvil manda el carrusel
// nativo de <CarruselDestacados>. Consume la forma `tarjeta` de useDestacados
// (`.item` es el comercio/evento real) y sirve a ambos tipos:
//   - comercio: "Ver ficha" selecciona la ficha en la propia página
//     (onSeleccionar) + "Cómo llegar" (si hay coordenadas).
//   - evento: "Ver detalles" enlaza a la página del evento (d.to).

const POR_PAGINA = 3
const AVANCE_MS = 7000

// Dirección corta: "C. de la Libertad, 39, 28600 Navalcarnero…" → "C. de la
// Libertad, 39" (calle + número, sin CP ni municipio).
function direccionCorta(direccion) {
  if (!direccion) return ''
  return direccion.split(',').slice(0, 2).join(',').trim()
}

// Meta en una línea según el tipo. Para comercios se compone a mano (incluye la
// dirección, que no está en `lineas`); para eventos basta con los textos de
// `lineas` (fecha, lugar).
function metaDe(d) {
  if (d.tipo === 'comercio') {
    const c = d.item || {}
    return [
      c.tipoDisplay || c.subtipo || d.badge,
      c.rating ? `★ ${c.rating}` : null,
      direccionCorta(c.direccion),
    ].filter(Boolean)
  }
  return d.lineas.map((l) => l.texto).filter(Boolean)
}

function TarjetaHero({ d, onSeleccionar, seccion }) {
  const item = d.item || {}
  const meta = metaDe(d)
  const esComercio = d.tipo === 'comercio'
  const tieneUbicacion = typeof item.lat === 'number' && typeof item.lng === 'number'
  const urlMapa = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${item.nombre}, Navalcarnero, Madrid`,
  )}`
  const registrarClic = seccion ? () => reportarClicDestacado(d, seccion) : undefined

  const claseCarta =
    'group relative block h-[440px] overflow-hidden rounded-lg shadow-cartel'

  // Fondo común (foto o trama de categoría), degradado y badge.
  const fondo = (
    <>
      {d.imagen ? (
        <img
          src={d.imagen}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          style={{ objectPosition: d.imagenPos || '50% 50%' }}
        />
      ) : (
        <div
          className="gz-trama-clara absolute inset-0"
          style={{ backgroundColor: d.colorCategoria || '#4a5b41' }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-15">
            <MIcon name={d.simbolo} className="text-[200px] text-white" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <span className="absolute left-4 top-4 z-20 rounded-full bg-oro px-3 py-1.5 font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta text-tinta">
        ✦ Destacado · {d.badge}
      </span>
    </>
  )

  const encabezado = (
    <>
      <h3 className="font-serif-dm text-4xl italic leading-[0.9] text-papel">{d.titulo}</h3>
      {meta.length > 0 && (
        <p className="mt-3 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-papel/80">
          {meta.join(' · ')}
        </p>
      )}
    </>
  )

  // Evento: toda la tarjeta es el enlace al detalle (mismo patrón que
  // TarjetaDestacado — área de clic completa, sin depender del botón). "Ver
  // detalles" es un span estilado; no se anida <a> dentro de <a>.
  if (!esComercio) {
    return (
      <Link to={d.to} onClick={registrarClic} className={claseCarta}>
        {fondo}
        <div className="absolute bottom-0 left-0 z-20 w-full p-6">
          {encabezado}
          <div className="mt-5">
            <span className="gz-boton-pill inline-block">Ver detalles</span>
          </div>
        </div>
      </Link>
    )
  }

  // Comercio: la tarjeta es un contenedor; "Ver ficha" selecciona la ficha en
  // la propia página y "Cómo llegar" abre Google Maps.
  return (
    <div className={claseCarta}>
      {fondo}
      <div className="absolute bottom-0 left-0 z-20 w-full p-6">
        {encabezado}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              registrarClic?.()
              onSeleccionar?.(item)
            }}
            className="gz-boton-pill"
          >
            Ver ficha
          </button>
          {tieneUbicacion && (
            <a
              href={urlMapa}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-papel/50 px-6 py-3 font-serif-spectral font-semibold text-papel transition-colors hover:bg-papel/10"
            >
              Cómo llegar
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HeroDestacadosDesktop({
  items,
  eyebrow,
  titulo,
  onSeleccionar,
  onAnunciar,
  ctaLabel = 'Anúnciate aquí',
  seccion,
}) {
  const [pagina, setPagina] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = items?.length ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  useEffect(() => {
    if (paginas <= 1 || pausado) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setInterval(() => setPagina((p) => (p + 1) % paginas), AVANCE_MS)
    return () => clearInterval(t)
  }, [paginas, pausado])

  if (total === 0) return null
  const ir = (n) => setPagina(((n % paginas) + paginas) % paginas)

  return (
    <section onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <span className="gz-eyebrow">{eyebrow}</span>
          <h2 className="mt-1 font-serif-dm text-4xl leading-none text-tinta">{titulo}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          {onAnunciar && (
            <button
              type="button"
              onClick={onAnunciar}
              className="rounded-full border-2 border-tinta px-5 py-2.5 font-mono-ibm text-[11px] font-bold uppercase tracking-etiqueta text-tinta transition hover:bg-tinta hover:text-papel"
            >
              ✦ {ctaLabel}
            </button>
          )}
          {paginas > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ir(pagina - 1)}
                aria-label="Anteriores"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-tinta text-tinta transition hover:bg-tinta hover:text-papel"
              >
                <MIcon name="arrow_back" className="text-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => ir(pagina + 1)}
                aria-label="Siguientes"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-tinta text-papel transition hover:bg-tinta-apagada"
              >
                <MIcon name="arrow_forward" className="text-[18px]" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${pagina * 100}%)` }}
        >
          {Array.from({ length: paginas }, (_, p) => (
            <div key={p} className="grid min-w-full grid-cols-3 gap-6">
              {items.slice(p * POR_PAGINA, p * POR_PAGINA + POR_PAGINA).map((d) => (
                <TarjetaHero key={d.id} d={d} onSeleccionar={onSeleccionar} seccion={seccion} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {paginas > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: paginas }, (_, p) => (
            <button
              key={p}
              type="button"
              onClick={() => ir(p)}
              aria-label={`Ir a la página ${p + 1}`}
              className={`h-1 rounded-full transition-all ${
                p === pagina ? 'w-6 bg-tinta' : 'w-2.5 bg-filete-claro'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
