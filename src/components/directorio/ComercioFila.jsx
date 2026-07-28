import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import MIcon from '../MIcon.jsx'

const PRECIOS = { INEXPENSIVE: '€', MODERATE: '€€', EXPENSIVE: '€€€' }
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const sinAcentos = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

function horarioDeHoy(horario) {
  if (!horario) return null
  const hoy = sinAcentos(DIAS[new Date().getDay()])
  for (const seg of horario.split('|')) {
    const idx = seg.indexOf(':')
    if (idx === -1) continue
    const dia = sinAcentos(seg.slice(0, idx).trim())
    if (dia === hoy) return seg.slice(idx + 1).trim()
  }
  return null
}

// Iconos SVG por categoría (stroke blanco, 2.5px stroke para claridad)
const IconosPorCategoria = {
  alimentacion: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9h12M3 13h18M5 3h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2z" />
    </svg>
  ),
  salud: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  ),
  belleza: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2M6 12h12M12 6v12" />
    </svg>
  ),
  restauracion: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2l6 18M21 2l-6 18M3 10h18" />
    </svg>
  ),
  hogar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22v-8h6v8" />
    </svg>
  ),
  servicios: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  ),
}

const COLORES_CATEGORIA = {
  alimentacion: '#4a5b41',
  salud: '#31463d',
  belleza: '#8a3a58',
  moda: '#8e4a6b',
  restauracion: '#7a2d1e',
  hogar: '#3a4e5c',
  servicios: '#c68a2e',
}

export default function ComercioFila({ comercio, onClick, zona }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)
  const horaHoy = horarioDeHoy(comercio.horario)
  const estaAbierto = horaHoy && horaHoy.toLowerCase() !== 'cerrado'

  const colorFondo = COLORES_CATEGORIA[comercio.categoria] || COLORES_CATEGORIA.servicios
  const IconoSVG = IconosPorCategoria[comercio.categoria] || IconosPorCategoria.servicios

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 border-b border-filete py-3 px-0 text-left transition-colors hover:bg-papel-calido"
    >
      {/* Icono categoría */}
      <div
        className="flex-shrink-0 w-14 h-14 rounded-[13px] flex items-center justify-center"
        style={{ backgroundColor: colorFondo }}
      >
        <div className="w-7 h-7">
          <IconoSVG />
        </div>
      </div>

      {/* Contenido centro */}
      <div className="flex-1 min-w-0">
        <h3 className="font-serif-dm text-xl leading-tight text-tinta">
          {comercio.nombre}
        </h3>
        <p className="text-[13px] text-pardo mt-0.5">
          {tipo}
          {comercio.direccion && ` · ${comercio.direccion}`}
          {zona && ` · ${zona}`}
        </p>
      </div>

      {/* Meta derecha */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {comercio.rating != null && (
          <span className="flex items-center gap-0.5 text-sm">
            <span className="text-terracota">★ {comercio.rating.toFixed(1)}</span>
            {comercio.totalReviews != null && (
              <span className="text-[11px] text-mudo">({comercio.totalReviews})</span>
            )}
          </span>
        )}
        {horaHoy && (
          <span
            className={`flex items-center gap-0.5 text-[12px] font-mono-ibm ${
              estaAbierto ? 'text-verde' : 'text-mudo'
            }`}
          >
            <span>●</span>
            <span className="uppercase">{horaHoy}</span>
          </span>
        )}
      </div>
    </button>
  )
}
