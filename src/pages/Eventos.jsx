import { useMemo, useState } from 'react'
import eventosCurados from '../data/eventos.json'
import eventosExternos from '../data/eventos-externos.json'
import {
  CATEGORIAS_EVENTO,
  LISTA_CATEGORIAS_EVENTO,
  proximosEventos,
  formatearFechaLarga,
} from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

const ORIGEN = {
  municipal: { texto: 'Municipal', clase: 'bg-vino/10 text-vino' },
  cultural: { texto: 'Cultura', clase: 'bg-oro/15 text-oro-dark' },
  vecinal: { texto: 'Vecinal', clase: 'bg-azul-tint text-azul' },
}

function chipClase(activo) {
  return activo
    ? 'bg-vino text-white'
    : 'bg-white text-tinta-muted shadow-soft hover:text-vino'
}

export default function Eventos() {
  const [categoria, setCategoria] = useState(null)

  const todos = useMemo(
    () => proximosEventos([...eventosCurados, ...eventosExternos]),
    [],
  )

  // Solo se ofrecen como filtro las categorías que tienen eventos próximos.
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(todos.map((e) => e.categoria))
    return LISTA_CATEGORIAS_EVENTO.filter((c) => presentes.has(c.id))
  }, [todos])

  const eventos = useMemo(
    () => (categoria ? todos.filter((e) => e.categoria === categoria) : todos),
    [todos, categoria],
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-vino">Eventos</h1>
        <p className="mt-1 text-sm text-tinta-muted">
          Agenda municipal y vecinal de Navalcarnero, ordenada por fecha.
        </p>
      </header>

      {categoriasDisponibles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoria(null)}
            className={`nv-chip flex-none transition-colors ${chipClase(categoria === null)}`}
          >
            Todos
          </button>
          {categoriasDisponibles.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoria(cat.id)}
              className={`nv-chip flex flex-none items-center gap-1.5 transition-colors ${chipClase(
                categoria === cat.id,
              )}`}
            >
              <IconoEvento categoria={cat.id} className="h-3.5 w-3.5" />
              {cat.nombre}
            </button>
          ))}
        </div>
      )}

      {eventos.length === 0 && (
        <p className="rounded-3xl border border-dashed border-vino/20 bg-white p-6 text-center text-sm text-tinta-muted">
          No hay eventos próximos por ahora. ¡Vuelve pronto!
        </p>
      )}

      <div className="space-y-3">
        {eventos.map((e) => {
          const cat = CATEGORIAS_EVENTO[e.categoria]
          return (
            <article key={e.id} className="nv-card flex gap-4 p-4">
              <div
                className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-crema"
                style={{ backgroundColor: cat?.color || '#6E2A3C' }}
              >
                <IconoEvento categoria={e.categoria} className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-oro-dark">
                    {formatearFechaLarga(e.fecha)}
                    {horaTexto(e) ? ` · ${horaTexto(e)}` : ''}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      (ORIGEN[e.origen] || ORIGEN.vecinal).clase
                    }`}
                  >
                    {(ORIGEN[e.origen] || ORIGEN.vecinal).texto}
                  </span>
                  {cat && (
                    <span className="rounded-full bg-crema-dark px-2 py-0.5 text-[10px] font-medium text-tinta">
                      {cat.nombre}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 font-medium text-tinta">{e.titulo}</h2>
                <p className="text-sm text-tinta-muted">{e.lugar}</p>
                <p className="mt-1 text-sm text-tinta-muted">{e.descripcion}</p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
