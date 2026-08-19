import { Link, useParams } from 'react-router-dom'
import GaleriaNoticia from '../components/noticias/GaleriaNoticia.jsx'
import MIcon from '../components/MIcon.jsx'
import { partesConEnlaces } from '../lib/linkify.js'
import { ETIQUETAS_ACTIVIDAD, ETIQUETAS_ALERTA, useNoticiasPublicas } from '../lib/useNoticiasPublicas.js'

function formatearFechaLarga(fechaISO) {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function VolverLink({ arriba = false, actividad = false }) {
  const destino = actividad ? '/eventos?categorias=talleres' : '/noticias'
  const label = actividad ? 'Volver a talleres' : 'Volver a noticias'
  const labelArriba = actividad ? 'Talleres' : 'Noticias'

  return (
    <Link
      to={destino}
      className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta transition-colors hover:text-terracota"
    >
      <MIcon name="arrow_back" className="text-[16px]" />
      {arriba ? labelArriba : label}
    </Link>
  )
}

export default function NoticiaDetalle() {
  const { id } = useParams()
  const { noticias, actividades, cargando } = useNoticiasPublicas()
  // Las actividades no están en `noticias` (ahora son eventos con categoría 'talleres'),
  // pero sus deep links ig-… se resuelven igual desde esta página de detalle.
  const noticia = noticias.find((n) => n.id === id) || actividades.find((n) => n.id === id)

  if (!noticia) {
    // Las de Instagram llegan async: mientras cargan, un deep-link a
    // /noticias/ig-… no debe mostrar un flash de "no encontrada".
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <VolverLink arriba />
        <div className="border border-dashed border-filete-punteado p-10 text-center font-serif-spectral text-pardo">
          {cargando
            ? 'Cargando la noticia…'
            : 'No hemos encontrado esa noticia. Puede que ya no esté disponible.'}
        </div>
      </div>
    )
  }

  const esInstagram = noticia.id.startsWith('ig-')
  const esActividad = noticia.tipo === 'actividad'

  return (
    <div className="mx-auto max-w-2xl">
      <VolverLink arriba actividad={esActividad} />

      <div className="mt-4">
        {noticia.urgente ? (
          <span className="gz-badge-error">Aviso · {ETIQUETAS_ALERTA[noticia.tipoAlerta] || 'Municipio'}</span>
        ) : esActividad ? (
          <span className="gz-badge-oro">
            Actividad · {ETIQUETAS_ACTIVIDAD[noticia.categoria] || 'General'}
          </span>
        ) : (
          <span className="gz-badge-oro">Ayuntamiento</span>
        )}
        <h1 className="mt-3 font-serif-dm text-seccion leading-tight text-tinta">{noticia.titulo}</h1>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <div className="gz-label text-mudo">Fecha</div>
          <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">
            {formatearFechaLarga(noticia.fecha)}
          </div>
        </div>
        {esActividad && noticia.fechaLimite && (
          <div>
            <div className="gz-label text-mudo">Plazo</div>
            <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">
              Hasta el {formatearFechaLarga(noticia.fechaLimite)}
            </div>
          </div>
        )}
        {noticia.autor && (
          <div>
            <div className="gz-label text-mudo">Autor</div>
            <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">{noticia.autor}</div>
          </div>
        )}
      </div>

      <div className="mt-5 h-px bg-filete" />

      {noticia.imagenes?.length > 1 ? (
        <GaleriaNoticia imagenes={noticia.imagenes} titulo={noticia.titulo} />
      ) : (
        noticia.imagen && (
          <img
            src={noticia.imagen}
            alt=""
            className="mt-5 max-h-[420px] w-full border border-tinta object-contain"
          />
        )
      )}

      <div className="mt-5 whitespace-pre-wrap break-words font-serif-spectral text-[15px] leading-relaxed text-tinta-suave">
        {partesConEnlaces(noticia.contenido || noticia.resumen).map((parte, i) =>
          parte.url ? (
            <a
              key={i}
              href={parte.valor}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-terracota hover:underline"
            >
              {parte.valor}
            </a>
          ) : (
            <span key={i}>{parte.valor}</span>
          )
        )}
      </div>

      {/* Enlace a la fuente solo para noticias del RSS (artículo completo en la
          web del Ayuntamiento). En las de Instagram no se muestra. */}
      {noticia.url && !esInstagram && (
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
        <VolverLink actividad={esActividad} />
      </div>
    </div>
  )
}
