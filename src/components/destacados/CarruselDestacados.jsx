import { useEffect, useRef, useState } from 'react'
import TarjetaDestacado from './TarjetaDestacado.jsx'

// En móvil, carrusel horizontal con scroll-snap (cada tarjeta ocupa ~80% del
// ancho, dejando asomar la siguiente); en escritorio, grid de N columnas.
// Con `soloCarrusel` se mantiene el carrusel en todos los breakpoints, con
// tarjetas estrechas — lo necesita la columna izquierda del Mapa (lg:w-2/5).
//
// Rotación en bucle: con más items que `visibles`, en md+ el markup cambia a
// una pista deslizante (overflow oculto + flex con N+1 tarjetas): cada
// AVANCE_MS la pista anima translateX exactamente una tarjeta hacia la
// izquierda y, al terminar la transición, avanza `paso` y resetea el
// transform sin transición — la ventana queda igual que al final del
// deslizamiento y el bucle continúa sin salto visible. Así todos los
// contratados pasan por pantalla ante el mismo visitante. En móvil NO hay
// pista: se mantiene el carrusel nativo con scroll y TODOS los items (el
// swipe es el gesto natural ahí, y el overflow oculto de la pista lo
// rompería). El arranque es aleatorio por montaje, se pausa con el ratón
// encima y no avanza con prefers-reduced-motion. El ancho de cada hueco de
// la pista llega por variable CSS (--nv-hueco, ver .nv-pista en index.css).
//
// Pendiente de pulido (anotado en el plan, no bloqueante): el carrusel móvil
// no tiene indicador de que hay más contenido a la derecha ni navegación por
// teclado más allá del foco de cada tarjeta.

const AVANCE_MS = 5000
const DESLIZAMIENTO_MS = 600
const PAUSA_TRAS_TOQUE_MS = 12000

// Tailwind no ve clases construidas dinámicamente: el nº de columnas se
// resuelve contra este mapa estático.
const COLUMNAS = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

export default function CarruselDestacados({
  items,
  tamano = 'normal',
  columnas = 3,
  soloCarrusel = false,
  onItemClick,
  seccion,
  visibles,
}) {
  const huecos = visibles ?? columnas
  const total = items?.length ?? 0
  const rota = total > huecos

  const [semilla] = useState(() => Math.random())
  const [paso, setPaso] = useState(0)
  const [deslizando, setDeslizando] = useState(false)
  const [distancia, setDistancia] = useState(0)
  const [pausado, setPausado] = useState(false)
  const pistaRef = useRef(null)
  const temporizadorToque = useRef(null)

  useEffect(() => {
    if (!rota || pausado || deslizando) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const id = setInterval(() => {
      const pista = pistaRef.current
      if (!pista || pista.children.length === 0) return
      // La distancia se mide en el momento (ancho real de tarjeta + gap), sin
      // duplicar el cálculo de la CSS. En móvil la pista está oculta (ancho
      // 0): no se avanza — allí manda el scroll manual del carrusel nativo.
      const ancho = pista.children[0].getBoundingClientRect().width
      if (!ancho) return
      const gap = parseFloat(getComputedStyle(pista).columnGap) || 0
      setDistancia(ancho + gap)
      setDeslizando(true)
    }, AVANCE_MS)
    return () => clearInterval(id)
  }, [rota, pausado, deslizando])

  const terminarDeslizamiento = () => {
    setPaso((p) => p + 1)
    setDeslizando(false)
  }

  // Red de seguridad: si transitionend no llega (pestaña en segundo plano),
  // se consolida igualmente. Se limpia si la transición termina antes.
  useEffect(() => {
    if (!deslizando) return undefined
    const id = setTimeout(terminarDeslizamiento, DESLIZAMIENTO_MS + 200)
    return () => clearTimeout(id)
  }, [deslizando])

  useEffect(() => () => clearTimeout(temporizadorToque.current), [])

  if (total === 0) return null

  // mouseenter/leave y no pointer*: en táctil pointerenter dispara sin un
  // "leave" fiable y dejaría la rotación pausada para siempre; un toque pausa
  // un rato y se reanuda solo.
  const pausar = () => {
    clearTimeout(temporizadorToque.current)
    setPausado(true)
  }
  const reanudar = () => {
    clearTimeout(temporizadorToque.current)
    setPausado(false)
  }
  const pausaTemporal = () => {
    pausar()
    temporizadorToque.current = setTimeout(() => setPausado(false), PAUSA_TRAS_TOQUE_MS)
  }

  const tarjeta = (destacado) => (
    <TarjetaDestacado
      destacado={destacado}
      tamano={tamano}
      seccion={seccion}
      onClick={onItemClick ? () => onItemClick(destacado.item) : undefined}
    />
  )

  if (!rota) {
    const contenedor = soloCarrusel
      ? 'hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1'
      : `hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid ${
          COLUMNAS[columnas] || COLUMNAS[3]
        } md:gap-4 md:overflow-visible md:pb-0`

    const envoltorio = soloCarrusel
      ? 'w-56 flex-none snap-start'
      : 'w-[80%] max-w-xs flex-none snap-start md:w-auto md:max-w-none'

    return (
      <div className={contenedor}>
        {items.map((destacado) => (
          <div key={destacado.id} className={envoltorio}>
            {tarjeta(destacado)}
          </div>
        ))}
      </div>
    )
  }

  // rota ⇒ total ≥ huecos + 1: la ventana (con la tarjeta entrante extra)
  // nunca repite ids, las keys estables dejan a React reutilizar los nodos al
  // consolidar el paso.
  const inicio = Math.floor(semilla * total)
  const ventana = Array.from({ length: huecos + 1 }, (_, i) => items[(inicio + paso + i) % total])

  const envoltorioMovil = soloCarrusel ? 'w-56 flex-none snap-start' : 'w-[80%] max-w-xs flex-none snap-start'

  return (
    <>
      {/* Móvil: nada de pista — carrusel nativo con TODOS los items, que el
          swipe es la forma natural de recorrerlos (y overflow-hidden lo
          mataría). La pista auto-deslizante queda para md+, donde no hay
          gesto de scroll horizontal cómodo. */}
      <div className={`hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:hidden`}>
        {items.map((destacado) => (
          <div key={destacado.id} className={envoltorioMovil}>
            {tarjeta(destacado)}
          </div>
        ))}
      </div>

      <div
        className="hidden overflow-hidden md:block"
        onMouseEnter={pausar}
        onMouseLeave={reanudar}
        onTouchStart={pausaTemporal}
      >
        <div
          ref={pistaRef}
          onTransitionEnd={(e) => {
            if (e.target === pistaRef.current && e.propertyName === 'transform' && deslizando) {
              terminarDeslizamiento()
            }
          }}
          className={`nv-pista flex ${soloCarrusel ? 'gap-3' : 'gap-4'}`}
          style={{
            // Debe cuadrar con el gap de la pista para que quepan N tarjetas
            // justas (gap-4 = 1rem; soloCarrusel usa ancho fijo y gap-3).
            '--nv-hueco': soloCarrusel ? '14rem' : `calc((100% - ${huecos - 1} * 1rem) / ${huecos})`,
            transform: deslizando ? `translateX(-${distancia}px)` : 'translateX(0)',
            transition: deslizando ? `transform ${DESLIZAMIENTO_MS}ms ease-in-out` : 'none',
          }}
        >
          {ventana.map((destacado) => (
            <div key={destacado.id} className="flex-none">
              {tarjeta(destacado)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
