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
      className={`nv-card flex w-full items-center gap-3 p-3.5 text-left transition-all hover:shadow-card-lg ${
        activo ? 'ring-2 ring-primary' : ''
      }`}
    >
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
        <IconoCategoria categoria={comercio.categoria} className="text-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-on-surface">
          {comercio.nombre}
        </span>
        <span className="block truncate text-xs text-on-surface-variant">
          {tipo}
          {comercio.direccion ? ` · ${comercio.direccion}` : ''}
        </span>

        {tieneMeta && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-on-surface-variant">
            {comercio.rating != null && (
              <span className="flex items-center gap-1 font-semibold text-on-surface">
                <span className="text-amber-500">★</span>
                <span>
                  {comercio.rating.toFixed(1)}
                  {comercio.totalReviews != null && (
                    <span className="font-normal text-on-surface-variant">
                      {' '}
                      ({comercio.totalReviews})
                    </span>
                  )}
                </span>
              </span>
            )}
            {precio && <span className="font-semibold text-secondary">{precio}</span>}
            {horaHoy && (
              <span>
                Hoy: <span className="text-on-surface">{horaHoy}</span>
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  )
}
