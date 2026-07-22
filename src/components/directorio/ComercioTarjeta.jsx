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
      className="flex flex-col overflow-hidden rounded-lg border-2 border-tinta bg-papel transition-transform hover:shadow-md text-left group"
    >
      {/* Imagen o fondo de color */}
      <div
        className="relative h-48 w-full overflow-hidden bg-cover bg-center"
        style={comercio.foto ? { backgroundImage: `url(${comercio.foto})` } : { backgroundColor: cat?.color || '#4a5b41' }}
      >
        {!comercio.foto && (
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <IconoCategoria categoria={comercio.categoria} className="text-[56px] text-white" fill />
          </div>
        )}
        {/* Gradiente oscuro para el texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Badge de categoría */}
        <div className="absolute left-0 top-0 bg-terracota px-2 py-1 font-mono-ibm text-[9px] font-bold uppercase tracking-etiqueta text-papel">
          • {cat?.nombre || 'Comercio'}
        </div>

        {/* Nombre prominente en la parte inferior de la imagen */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-serif-dm text-lg font-bold leading-tight text-white truncate">
            {comercio.nombre}
          </h3>
        </div>
      </div>

      {/* Información */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Tipo */}
        <p className="text-[10px] text-pardo line-clamp-1">{tipo}</p>

        {/* Dirección */}
        {comercio.direccion && (
          <div className="flex items-start gap-0.5">
            <MIcon name="location_on" className="text-[12px] text-pardo flex-shrink-0 mt-0.5" />
            <span className="text-[10px] text-pardo leading-tight line-clamp-2">{comercio.direccion}</span>
          </div>
        )}

        {/* Meta: rating, precio, horario */}
        {(comercio.rating != null || precio || horaHoy) && (
          <div className="flex flex-wrap gap-1.5 text-[9px] text-mudo font-mono-ibm uppercase tracking-wider mt-auto pt-2 border-t border-filete">
            {comercio.rating != null && (
              <span className="flex items-center gap-0.5">
                <span className="text-ocre">★ {comercio.rating.toFixed(1)}</span>
                {comercio.totalReviews != null && <span>({comercio.totalReviews})</span>}
              </span>
            )}
            {precio && <span className="text-ocre">{precio}</span>}
            {horaHoy && (
              <span>
                HOY <span className="text-tinta text-[9px]">{horaHoy}</span>
              </span>
            )}
          </div>
        )}

        {/* Botón Ver ficha */}
        <div className="mt-auto pt-2 border-t border-filete">
          <span className="inline-block font-mono-ibm text-[9px] font-bold uppercase tracking-etiqueta text-terracota group-hover:text-tinta transition-colors">
            Ver ficha
          </span>
        </div>
      </div>
    </button>
  )
}
