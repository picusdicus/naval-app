import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { reportarVisitaEvento } from '../lib/useAnalytics.js'
import { CATEGORIAS_EVENTO, formatearFechaLarga } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import { imagenEvento } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'

const ORIGEN = {
  municipal: 'Municipal',
  cultural: 'Cultura',
  vecinal: 'Vecinal',
}

/**
 * Búsqueda en Google Maps del lugar dentro del municipio. Se busca por nombre
 * (no por coordenadas) porque los eventos solo guardan el nombre de la sala.
 */
function enlaceGoogleMaps(lugar) {
  const consulta = encodeURIComponent(`${lugar}, Navalcarnero, Madrid`)
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`
}

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

// Enlace de vuelta a la agenda; se reutiliza arriba y abajo de la página.
function VolverLink() {
  return (
    <Link
      to="/eventos"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-container"
    >
      <MIcon name="arrow_back" className="text-[18px]" />
      Volver a eventos
    </Link>
  )
}

// Página de detalle de un evento (ruta /eventos/:id). El usuario llega aquí al
// pulsar una tarjeta y vuelve con el botón de retroceso del navegador o con el
// enlace "Volver a eventos". No se abandona la app salvo por el enlace externo.
export default function EventoDetalle() {
  const { id } = useParams()
  const { eventos, cargando } = useEventosPublicos()
  const evento = eventos.find((e) => e.id === id)

  // Solo los eventos de la base de datos (prefijo 'bd-') tienen una
  // organización dueña que pueda ver la visita en "Mis analíticas". El ref
  // evita contarla dos veces (StrictMode monta el efecto dos veces en dev).
  const visitaReportada = useRef(null)
  useEffect(() => {
    if (!evento?.organizacionId || !evento.id.startsWith('bd-')) return
    if (visitaReportada.current === evento.id) return
    visitaReportada.current = evento.id
    reportarVisitaEvento(evento.id.slice(3), evento.organizacionId)
  }, [evento])

  if (!evento) {
    // Los eventos publicados desde /admin llegan por fetch: mientras no estén,
    // no podemos afirmar que el evento no existe.
    return (
      <div className="space-y-6">
        <VolverLink />
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center text-on-surface-variant">
          {cargando ? 'Cargando evento…' : 'No hemos encontrado ese evento. Puede que ya no esté disponible.'}
        </div>
      </div>
    )
  }

  const img = imagenEvento(evento)
  const cat = CATEGORIAS_EVENTO[evento.categoria]?.nombre || 'Evento'
  // Quien organiza dice más que el origen genérico ("Cultura · Cultura").
  const procedencia = evento.fuente || ORIGEN[evento.origen] || 'Vecinal'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <VolverLink />

      {/* Imagen a tamaño completo (cartel real del evento si lo tiene) */}
      <div className="relative flex max-h-[70vh] items-center justify-center overflow-hidden rounded-xl bg-inverse-surface shadow-card">
        {img ? (
          <img
            src={img.src}
            alt={evento.titulo}
            className="max-h-[70vh] w-full object-contain"
            style={{ objectPosition: img.pos || '50% 50%' }}
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center bg-gradient-to-br from-primary-container to-primary text-on-primary-container">
            <IconoEvento categoria={evento.categoria} className="text-[120px]" />
          </div>
        )}
      </div>

      {/* Cabecera */}
      <div>
        <span className="inline-block rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
          {cat} · {procedencia}
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          {evento.titulo}
        </h1>
      </div>

      {/* Datos */}
      <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-on-surface">
          <MIcon name="calendar_today" className="text-[18px] text-secondary" />
          <span>{formatearFechaLarga(evento.fecha)}</span>
        </div>
        {horaTexto(evento) && (
          <div className="flex items-center gap-2 text-on-surface">
            <MIcon name="schedule" className="text-[18px] text-secondary" />
            <span>{horaTexto(evento)}</span>
          </div>
        )}
        {evento.lugar && (
          <div className="flex items-start gap-2 text-on-surface sm:col-span-2">
            <MIcon name="location_on" className="mt-0.5 text-[18px] text-secondary" />
            <a
              href={enlaceGoogleMaps(evento.lugar)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
            >
              {evento.lugar}
              <MIcon name="open_in_new" className="text-[14px]" />
            </a>
          </div>
        )}
      </dl>

      {/* Descripción completa */}
      {evento.descripcion && (
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-on-surface">
          {evento.descripcion}
        </p>
      )}

      {/* Botón de entradas: solo lo traen los eventos creados desde /admin */}
      {evento.entradas?.url && (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={evento.entradas.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary transition-shadow hover:shadow-card-lg"
          >
            <MIcon name="local_activity" className="text-[18px]" />
            {evento.entradas.texto}
          </a>
          {evento.entradas.precio && (
            <span className="text-sm font-semibold text-on-surface-variant">
              {evento.entradas.precio}
            </span>
          )}
        </div>
      )}

      {/* Enlace secundario a la web del ayuntamiento */}
      {evento.url && (
        <a
          href={evento.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-outline px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-high"
        >
          <MIcon name="open_in_new" className="text-[18px]" />
          Ver en la web del ayuntamiento
        </a>
      )}

      <div className="border-t border-outline-variant/40 pt-6">
        <VolverLink />
      </div>
    </div>
  )
}
