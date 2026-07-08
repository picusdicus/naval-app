import { Link, useParams } from 'react-router-dom'
import noticias from '../data/noticias.json'
import MIcon from '../components/MIcon.jsx'

function formatearFechaLarga(fechaISO) {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function VolverLink() {
  return (
    <Link
      to="/noticias"
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-container"
    >
      <MIcon name="arrow_back" className="text-[18px]" />
      Volver a noticias
    </Link>
  )
}

export default function NoticiaDetalle() {
  const { id } = useParams()
  const noticia = noticias.find((n) => n.id === id)

  if (!noticia) {
    return (
      <div className="space-y-6">
        <VolverLink />
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center text-on-surface-variant">
          No hemos encontrado esa noticia. Puede que ya no esté disponible.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <VolverLink />

      <div>
        <span className="inline-block rounded-full bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
          Ayuntamiento
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          {noticia.titulo}
        </h1>
      </div>

      <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-on-surface">
          <MIcon name="calendar_today" className="text-[18px] text-secondary" />
          <span>{formatearFechaLarga(noticia.fecha)}</span>
        </div>
        {noticia.autor && (
          <div className="flex items-center gap-2 text-on-surface">
            <MIcon name="person" className="text-[18px] text-secondary" />
            <span>{noticia.autor}</span>
          </div>
        )}
      </dl>

      {noticia.contenido && (
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-on-surface">
          {noticia.contenido}
        </div>
      )}

      {!noticia.contenido && noticia.resumen && (
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-on-surface">
          {noticia.resumen}
        </div>
      )}

      {noticia.url && (
        <a
          href={noticia.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-outline px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-container-high"
        >
          <MIcon name="open_in_new" className="text-[18px]" />
          Leer en la web del ayuntamiento
        </a>
      )}

      <div className="border-t border-outline-variant/40 pt-6">
        <VolverLink />
      </div>
    </div>
  )
}
