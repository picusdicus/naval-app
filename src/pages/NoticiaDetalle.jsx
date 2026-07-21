import { Link, useParams } from 'react-router-dom'
import noticias from '../data/noticias.json'
import MIcon from '../components/MIcon.jsx'

function formatearFechaLarga(fechaISO) {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function VolverLink({ arriba = false }) {
  return (
    <Link
      to="/noticias"
      className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta transition-colors hover:text-terracota"
    >
      <MIcon name="arrow_back" className="text-[16px]" />
      {arriba ? 'Noticias' : 'Volver a noticias'}
    </Link>
  )
}

export default function NoticiaDetalle() {
  const { id } = useParams()
  const noticia = noticias.find((n) => n.id === id)

  if (!noticia) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <VolverLink arriba />
        <div className="border border-dashed border-filete-punteado p-10 text-center font-serif-spectral text-pardo">
          No hemos encontrado esa noticia. Puede que ya no esté disponible.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <VolverLink arriba />

      <div className="mt-4">
        <span className="gz-badge-oro">Ayuntamiento</span>
        <h1 className="mt-3 font-serif-dm text-seccion leading-tight text-tinta">{noticia.titulo}</h1>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <div className="gz-label text-mudo">Fecha</div>
          <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">
            {formatearFechaLarga(noticia.fecha)}
          </div>
        </div>
        {noticia.autor && (
          <div>
            <div className="gz-label text-mudo">Autor</div>
            <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">{noticia.autor}</div>
          </div>
        )}
      </div>

      <div className="mt-5 h-px bg-filete" />

      <div className="mt-5 whitespace-pre-wrap break-words font-serif-spectral text-[15px] leading-relaxed text-tinta-suave">
        {noticia.contenido || noticia.resumen || null}
      </div>

      {noticia.url && (
        <div className="mt-6 border border-tinta bg-papel-calido p-5">
          <div className="flex items-start gap-3">
            <MIcon name="info" className="mt-0.5 text-[18px] text-terracota" />
            <div>
              <p className="font-serif-spectral text-sm font-semibold text-tinta">Fuente original</p>
              <p className="mt-1 font-serif-spectral text-xs text-pardo">
                Puedes acceder al artículo completo en la web oficial del Ayuntamiento.
              </p>
            </div>
          </div>
          <a
            href={noticia.url}
            target="_blank"
            rel="noreferrer"
            className="gz-boton-tinta mt-4 inline-flex items-center justify-center gap-2"
          >
            <MIcon name="open_in_new" className="text-[16px]" />
            Abrir artículo completo en web del Ayuntamiento
          </a>
        </div>
      )}

      <div className="mt-8 border-t border-filete pt-5">
        <VolverLink />
      </div>
    </div>
  )
}
