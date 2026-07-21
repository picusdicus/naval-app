import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'

// Días en el orden de Date.getDay() (0 = domingo). Coincide con las claves del
// campo `horario` ("lunes: 9:00–21:30 | martes: ...").
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const PRECIOS = { INEXPENSIVE: '€', MODERATE: '€€', EXPENSIVE: '€€€' }

const sinAcentos = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

// Extrae el horario de hoy del campo `horario`. Devuelve el tramo ("9:00–21:30"
// o "Cerrado") o null si no está el día actual.
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

// Fila de comercio (La Gaceta): cuadro con la inicial sobre el color de la
// categoría, nombre en DM Serif y meta (rating/precio/horario) en mono. Al
// pulsar se despliega la ficha en sitio (accordion en Mapa.jsx); `activo` la
// resalta con fondo cálido y borde de tinta.
export default function ComercioCard({ comercio, activo, onClick }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)

  const precio = PRECIOS[comercio.precioNivel] || ''
  const horaHoy = horarioDeHoy(comercio.horario)
  const tieneMeta = comercio.rating != null || precio || horaHoy

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-filete py-3.5 text-left transition-colors ${
        activo ? 'bg-papel-calido' : 'hover:bg-papel-calido/50'
      }`}
    >
      <span
        className="flex h-11 w-11 flex-none items-center justify-center font-serif-dm text-xl text-papel"
        style={{ backgroundColor: cat?.color || '#4a5b41' }}
      >
        <IconoCategoria categoria={comercio.categoria} className="text-[20px]" fill />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif-dm text-lg leading-tight text-tinta">
          {comercio.nombre}
        </span>
        <span className="block truncate font-serif-spectral text-[13px] text-pardo">
          {tipo}
          {comercio.direccion ? ` · ${comercio.direccion}` : ''}
        </span>

        {tieneMeta && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono-ibm text-[10px] text-mudo">
            {comercio.rating != null && (
              <span className="flex items-center gap-1">
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
          </span>
        )}
      </span>
      <span className="mt-1 flex-none font-mono-ibm text-xs text-mudo">{activo ? '▲' : '▼'}</span>
    </button>
  )
}
