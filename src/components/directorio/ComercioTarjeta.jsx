import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'
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

// Tarjeta de comercio para grid: imagen grande, categoría, nombre, dirección, info
export default function ComercioTarjeta({ comercio, onClick }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)
  const precio = PRECIOS[comercio.precioNivel] || ''
  const horaHoy = horarioDeHoy(comercio.horario)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden border-2 border-tinta bg-papel transition-transform hover:shadow-lg text-left group"
    >
      {/* Imagen o fondo de color */}
      <div
        className="relative h-48 w-full overflow-hidden bg-cover bg-center"
        style={comercio.foto ? { backgroundImage: `url(${comercio.foto})` } : { backgroundColor: cat?.color || '#4a5b41' }}
      >
        {!comercio.foto && (
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <IconoCategoria categoria={comercio.categoria} className="text-[64px] text-white" fill />
          </div>
        )}
        {/* Badge de categoría */}
        <div className="absolute left-0 top-0 bg-ocre px-2 py-1 font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta text-tinta">
          • {cat?.nombre || 'Comercio'}
        </div>
      </div>

      {/* Información */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Nombre */}
        <div>
          <h3 className="font-serif-dm text-base font-bold leading-tight text-tinta">
            {comercio.nombre}
          </h3>
          <p className="text-[11px] text-pardo mt-0.5">{tipo}</p>
        </div>

        {/* Dirección */}
        {comercio.direccion && (
          <div className="flex items-start gap-1">
            <MIcon name="location_on" className="text-[14px] text-pardo flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-pardo leading-snug">{comercio.direccion}</span>
          </div>
        )}

        {/* Meta: rating, precio, horario */}
        <div className="flex flex-wrap gap-2 text-[10px] text-mudo font-mono-ibm uppercase tracking-wider mt-auto">
          {comercio.rating != null && (
            <span className="flex items-center gap-0.5">
              <span className="text-ocre">★ {comercio.rating.toFixed(1)}</span>
              {comercio.totalReviews != null && <span>({comercio.totalReviews})</span>}
            </span>
          )}
          {precio && <span className="text-ocre">{precio}</span>}
          {horaHoy && (
            <span>
              HOY <span className="text-tinta">{horaHoy}</span>
            </span>
          )}
        </div>

        {/* Botón */}
        <div className="mt-2 pt-2 border-t border-filete">
          <span className="inline-block font-mono-ibm text-[10px] font-bold uppercase tracking-etiqueta text-terracota group-hover:text-tinta transition-colors">
            Ver ficha →
          </span>
        </div>
      </div>
    </button>
  )
}
