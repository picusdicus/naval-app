import { useEffect, useRef, useState } from 'react'
import MIcon from '../MIcon.jsx'

// Carrusel de imágenes para el detalle de una noticia: los posts "Sidecar"
// de Instagram traen varias fotos, cada una con su propia información (p.
// ej. una foto por instalación deportiva). Con 0 o 1 imagen no hay nada que
// navegar: se comporta como una imagen suelta o no renderiza nada — el
// llamador (NoticiaDetalle) además solo monta este componente cuando hay
// más de una, pero se resuelve igual aquí por si acaba con una sola tras
// descartar rotas.
//
// Móvil: scroll horizontal nativo con snap (el swipe es el gesto natural,
// mismo patrón que CarruselDestacados en su rama móvil — no se monta una
// pista auto-deslizante). Escritorio: flechas + contador, sin autoplay: aquí
// el usuario está leyendo, no ojeando.
export default function GaleriaNoticia({ imagenes, titulo }) {
  const [rotas, setRotas] = useState(() => new Set())
  const [indice, setIndice] = useState(0)
  const pistaRef = useRef(null)

  // Las imágenes que fallan al cargar se descartan del todo (nunca dejan un
  // hueco roto), en vez de intentar reintentarlas.
  const validas = (imagenes || [])
    .map((url, i) => ({ url, i }))
    .filter(({ url, i }) => url && !rotas.has(i))
  const total = validas.length

  // Si una imagen se cae por delante del índice actual, reencuadrar dentro
  // de rango en vez de quedarse mirando un hueco vacío.
  useEffect(() => {
    if (total > 0 && indice >= total) setIndice(total - 1)
  }, [total, indice])

  if (total === 0) return null

  const marcarRota = (i) => setRotas((prev) => new Set(prev).add(i))

  if (total === 1) {
    return (
      <img
        src={validas[0].url}
        alt={titulo}
        onError={() => marcarRota(validas[0].i)}
        className="mt-5 max-h-[420px] w-full border border-tinta object-contain"
      />
    )
  }

  const irA = (nuevo) => {
    const acotado = Math.max(0, Math.min(total - 1, nuevo))
    setIndice(acotado)
    pistaRef.current?.scrollTo({ left: acotado * pistaRef.current.clientWidth, behavior: 'smooth' })
  }

  const alDesplazar = () => {
    const pista = pistaRef.current
    if (!pista || !pista.clientWidth) return
    setIndice(Math.round(pista.scrollLeft / pista.clientWidth))
  }

  return (
    <div className="relative mt-5">
      <div
        ref={pistaRef}
        onScroll={alDesplazar}
        className="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto border border-tinta"
      >
        {validas.map(({ url, i }, pos) => (
          <img
            key={i}
            src={url}
            alt={`${titulo} — foto ${pos + 1} de ${total}`}
            onError={() => marcarRota(i)}
            className="h-[420px] w-full flex-none snap-center object-contain"
          />
        ))}
      </div>

      {/* Flechas: solo escritorio (el móvil navega por swipe). */}
      <button
        type="button"
        onClick={() => irA(indice - 1)}
        disabled={indice === 0}
        aria-label="Foto anterior"
        className="absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center bg-tinta/80 p-1.5 text-papel transition-opacity hover:bg-tinta disabled:opacity-0 md:flex"
      >
        <MIcon name="chevron_left" className="text-[22px]" />
      </button>
      <button
        type="button"
        onClick={() => irA(indice + 1)}
        disabled={indice === total - 1}
        aria-label="Foto siguiente"
        className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center bg-tinta/80 p-1.5 text-papel transition-opacity hover:bg-tinta disabled:opacity-0 md:flex"
      >
        <MIcon name="chevron_right" className="text-[22px]" />
      </button>

      {/* Contador, visible en móvil y escritorio. */}
      <div className="absolute bottom-2 right-2 bg-tinta/80 px-2 py-1 font-mono-ibm text-[11px] tracking-wider text-papel">
        {indice + 1} / {total}
      </div>
    </div>
  )
}
