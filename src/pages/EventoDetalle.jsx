import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { reportarVisitaEvento } from '../lib/useAnalytics.js'
import { CATEGORIAS_EVENTO, formatearFechaLarga } from '../lib/eventos.js'
import { IconoEvento } from '../components/eventos/iconosEvento.jsx'
import { useImagenEvento } from '../lib/useImagenEvento.js'
import { cartelDe } from '../lib/gaceta.js'
import { coordsDeLugar } from '../lib/lugares.js'
import MapaLugar from '../components/MapaLugar.jsx'
import BotonCompartir from '../components/BotonCompartir.jsx'
import MIcon from '../components/MIcon.jsx'

const ORIGEN = {
  municipal: 'Municipal',
  cultural: 'Cultura',
  vecinal: 'Vecinal',
}

/**
 * Búsqueda en Google Maps del lugar. Se busca por nombre (no por coordenadas)
 * porque los eventos solo guardan el nombre de la sala. Dentro del municipio
 * se ancla a "Navalcarnero, Madrid"; un evento de ámbito 'otro' (issue #33)
 * se busca en su población.
 */
function enlaceGoogleMaps(lugar, evento) {
  const donde =
    evento?.ambito === 'otro' && evento.poblacion ? evento.poblacion : 'Navalcarnero, Madrid'
  const consulta = encodeURIComponent(`${lugar}, ${donde}`)
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`
}

function horaTexto(e) {
  if (!e.hora) return ''
  return e.horaFin ? `${e.hora} – ${e.horaFin}` : e.hora
}

// Construye el texto enriquecido para compartir: título + fecha+lugar (si existen) + URL.
// Guarda contra fecha null para no romper el texto con "Invalid Date".
function construirTextoCompartir(evento) {
  const lineas = [evento.titulo]

  if (evento.fecha) {
    const fechaLarga = formatearFechaLarga(evento.fecha)
    if (evento.lugar) {
      lineas.push(`${fechaLarga} · ${evento.lugar}`)
    } else {
      lineas.push(fechaLarga)
    }
  } else if (evento.lugar) {
    lineas.push(evento.lugar)
  }

  lineas.push(window.location.href)
  return lineas.join('\n')
}

// Barra de contexto superior: volver a la cartelera + compartir.
// En móvil: navigator.share nativo con texto enriquecido.
// En escritorio: BotonCompartir con popover (Copiar, WhatsApp, Email).
function BarraContexto({ evento }) {
  const textoEnriquecido = construirTextoCompartir(evento)

  return (
    <div className="flex items-center justify-between font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta">
      <Link to="/eventos" className="inline-flex items-center gap-1 transition-colors hover:text-terracota">
        <MIcon name="arrow_back" className="text-[16px]" />
        Cartelera
      </Link>
      <BotonCompartir
        titulo={evento.titulo}
        url={window.location.href}
        textoCompartir={textoEnriquecido}
        conEmail={true}
      />
    </div>
  )
}

// Página de detalle de un evento (ruta /eventos/:id). El usuario llega aquí al
// pulsar una tarjeta y vuelve con el botón de retroceso del navegador o con el
// enlace "Volver a eventos". No se abandona la app salvo por el enlace externo.
export default function EventoDetalle() {
  const { id } = useParams()
  const { eventos, cargando } = useEventosPublicos()
  // idsSecundarios: ids de duplicados fusionados por combinarEventos — un deep
  // link al id de Neon ('bd-…') debe abrir el evento fusionado.
  const evento = eventos.find((e) => e.id === id || e.idsSecundarios?.includes(id))

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

  // Antes del return temprano: es un hook y no puede quedar tras un
  // condicional. `posterUrl` pasa a null si la url del cartel falla al cargar,
  // y entonces se pinta el degradado con el título superpuesto.
  const { posterUrl, pos, onError, real, credito } = useImagenEvento(evento, { paraHeroe: true })

  if (!evento) {
    // Los eventos publicados desde /admin llegan por fetch: mientras no estén,
    // no podemos afirmar que el evento no existe.
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/eventos" className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta hover:text-terracota">
          <MIcon name="arrow_back" className="text-[16px]" />
          Cartelera
        </Link>
        <div className="border border-dashed border-filete-punteado p-10 text-center font-serif-spectral text-pardo">
          {cargando ? 'Cargando evento…' : 'No hemos encontrado ese evento. Puede que ya no esté disponible.'}
        </div>
      </div>
    )
  }

  const cartel = cartelDe(evento.categoria)
  const cat = CATEGORIAS_EVENTO[evento.categoria]?.nombre || 'Evento'
  // Quien organiza dice más que el origen genérico ("Cultura · Cultura").
  const procedencia = evento.fuente || ORIGEN[evento.origen] || 'Vecinal'
  // Coordenadas del lugar si está en el directorio (teatros, casas de cultura,
  // polideportivos…); las plazas/calles no son POIs y caen al enlace de Maps.
  // Un evento fuera de Navalcarnero (ambito 'otro') nunca pasa por el índice:
  // lugares.js solo conoce sitios del municipio, y una coincidencia de
  // tokens con un homónimo de aquí pintaría el pin en el sitio equivocado.
  const coords = evento.lugar && evento.ambito !== 'otro' ? coordsDeLugar(evento.lugar) : null

  return (
    <div className="mx-auto max-w-2xl">
      <BarraContexto evento={evento} />

      {/* Cartel: el póster real si lo tiene; sin él, una ilustrativa de la
          galería por categoría (con su crédito CC debajo); si tampoco hay,
          degradado + trama con el título superpuesto (el título va debajo
          cuando hay imagen, para no duplicarlo sobre un cartel que ya lo
          lleva impreso). */}
      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden border border-tinta">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={evento.titulo}
            onError={onError}
            className="h-full w-full object-cover"
            style={{ objectPosition: pos }}
          />
        ) : (
          <div className={`absolute inset-0 ${cartel.trama}`} style={{ background: cartel.fondo }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <IconoEvento categoria={evento.categoria} className="text-[140px] text-white" />
            </div>
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 z-20 w-full p-5">
              <span className="gz-badge-oro">{cat}</span>
              <h1 className="mt-2.5 font-serif-dm text-hero-movil italic text-papel">{evento.titulo}</h1>
            </div>
          </div>
        )}
      </div>

      {/* Atribución de la ilustrativa (las licencias CC BY / BY-SA la exigen) */}
      {posterUrl && !real && credito && (
        <p className="mt-1 text-right font-mono-ibm text-[9px] text-mudo">
          Imagen ilustrativa · {credito}
        </p>
      )}

      {/* Cabecera (título debajo cuando hay póster real) */}
      <div className="mt-5">
        <div className="gz-eyebrow">
          {cat} · {procedencia}
        </div>
        {/* El título va aquí abajo solo cuando hay cartel; si la imagen falla,
            `posterUrl` es null y el título lo pinta el degradado superpuesto,
            de modo que nunca sale dos veces ni desaparece. */}
        {posterUrl && <h1 className="mt-2 font-serif-dm text-4xl leading-none text-tinta">{evento.titulo}</h1>}
      </div>

      {/* Datos en columnas */}
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <div className="gz-label text-mudo">Fecha</div>
          <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">
            {formatearFechaLarga(evento.fecha)}
          </div>
        </div>
        {horaTexto(evento) && (
          <div>
            <div className="gz-label text-mudo">Hora</div>
            <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">{horaTexto(evento)}</div>
          </div>
        )}
        {evento.lugar && (
          <div>
            <div className="gz-label text-mudo">Lugar</div>
            <div className="mt-0.5 font-serif-spectral text-[15px] text-tinta">{evento.lugar}</div>
          </div>
        )}
      </div>

      {/* Botón de entradas: solo lo traen los eventos creados desde /admin */}
      {evento.entradas?.url && (
        <div className="mt-5 flex items-center gap-3">
          <a
            href={evento.entradas.url}
            target="_blank"
            rel="noreferrer"
            className="gz-boton-tinta inline-flex items-center gap-2"
          >
            <MIcon name="local_activity" className="text-[16px]" />
            {evento.entradas.texto}
          </a>
          {evento.entradas.precio && (
            <span className="font-mono-ibm text-sm text-pardo">{evento.entradas.precio}</span>
          )}
        </div>
      )}

      {/* Descripción */}
      {evento.descripcion && (
        <div className="mt-6">
          <div className="gz-label text-mudo">La función</div>
          <p className="mt-2.5 whitespace-pre-line font-serif-spectral text-[15px] leading-relaxed text-tinta-suave">
            {evento.descripcion}
          </p>
        </div>
      )}

      {/* Vídeo del espectáculo (hoy solo lo traen los eventos de Red de
          Teatros). El iframe va con loading="lazy" para no descargar el
          reproductor si el visitante no llega a hacer scroll hasta él. */}
      {evento.video && (
        <div className="mt-6">
          <div className="gz-label text-mudo">Vídeo</div>
          <div className="mt-2.5 aspect-video w-full overflow-hidden border border-tinta">
            <iframe
              src={evento.video}
              title={`Vídeo de ${evento.titulo}`}
              loading="lazy"
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Detalles (con los datos que el evento realmente trae) */}
      <div className="mt-6">
        <div className="gz-label text-mudo">Detalles</div>
        <dl className="mt-2.5 font-serif-spectral text-sm">
          {evento.entradas?.precio && (
            <div className="flex justify-between border-b border-dashed border-filete-claro py-2.5">
              <dt className="text-pardo">Precio</dt>
              <dd className="text-tinta">{evento.entradas.precio}</dd>
            </div>
          )}
          <div className="flex justify-between border-b border-dashed border-filete-claro py-2.5">
            <dt className="text-pardo">Organiza</dt>
            <dd className="text-tinta">{procedencia}</dd>
          </div>
          {/* La lista de intérpretes puede ser larga: gap + text-right para
              que envuelva sin pegarse a la etiqueta. */}
          {evento.interpretes && (
            <div className="flex justify-between gap-6 border-b border-dashed border-filete-claro py-2.5">
              <dt className="shrink-0 text-pardo">Intérpretes</dt>
              <dd className="text-right text-tinta">{evento.interpretes}</dd>
            </div>
          )}
          {evento.duracion && (
            <div className="flex justify-between border-b border-dashed border-filete-claro py-2.5">
              <dt className="text-pardo">Duración</dt>
              <dd className="text-tinta">{evento.duracion}</dd>
            </div>
          )}
          {evento.edadRecomendada && (
            <div className="flex justify-between border-b border-dashed border-filete-claro py-2.5">
              <dt className="text-pardo">Edad recomendada</dt>
              <dd className="text-tinta">{evento.edadRecomendada}</dd>
            </div>
          )}
          {evento.lugar && (
            <div className="flex justify-between py-2.5">
              <dt className="text-pardo">Lugar</dt>
              <dd className="text-tinta">{evento.lugar}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Ficha artística y técnica (Red de Teatros): roles variables por obra,
          mismo patrón visual que Detalles. Sin filas, la sección no se pinta. */}
      {evento.fichaTecnica?.length > 0 && (
        <div className="mt-6">
          <div className="gz-label text-mudo">Ficha artística y técnica</div>
          <dl className="mt-2.5 font-serif-spectral text-sm">
            {evento.fichaTecnica.map((fila, i) => (
              <div
                key={fila.rol}
                className={`flex justify-between gap-6 py-2.5 ${
                  i < evento.fichaTecnica.length - 1 ? 'border-b border-dashed border-filete-claro' : ''
                }`}
              >
                <dt className="shrink-0 text-pardo">{fila.rol}</dt>
                <dd className="text-right text-tinta">{fila.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Mapa del lugar: real (Leaflet) si el sitio está en el directorio con
          coordenadas; si no (plazas, calles), placeholder con enlace a Google
          Maps buscando por nombre. */}
      {evento.lugar && coords && (
        <div className="mt-6">
          <MapaLugar lat={coords.lat} lng={coords.lng} nombre={evento.lugar} />
          <div className="mt-2 flex items-center justify-between">
            {/* El nombre del lugar es el enlace a Google Maps (lo asume también
                el e2e de perfil-organizacion: link accesible con el nombre). */}
            <a
              href={enlaceGoogleMaps(evento.lugar, evento)}
              target="_blank"
              rel="noreferrer"
              className="font-serif-dm text-lg text-tinta underline-offset-2 transition-colors hover:text-terracota hover:underline"
            >
              {evento.lugar}
            </a>
            <a
              href={enlaceGoogleMaps(evento.lugar, evento)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
            >
              Cómo llegar
              <MIcon name="open_in_new" className="text-[13px]" />
            </a>
          </div>
        </div>
      )}
      {evento.lugar && !coords && (
        <a
          href={enlaceGoogleMaps(evento.lugar, evento)}
          target="_blank"
          rel="noreferrer"
          className="gz-trama relative mt-6 flex aspect-[16/9] items-end overflow-hidden border border-tinta"
          style={{ background: 'linear-gradient(135deg, #e6dcc4, #d3c7a8)' }}
        >
          <span className="absolute left-3 top-3 z-10 border border-filete-punteado bg-papel/70 px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-pardo">
            Mapa · ubicación
          </span>
          <span className="relative z-10 p-4 font-serif-dm text-xl text-tinta">
            {evento.lugar}
            {evento.ambito === 'otro' && evento.poblacion && (
              <span className="block font-mono-ibm text-[11px] uppercase tracking-etiqueta text-pardo">
                {evento.poblacion}
              </span>
            )}
          </span>
        </a>
      )}

      {/* Enlace secundario a la web del ayuntamiento */}
      {evento.url && (
        <a
          href={evento.url}
          target="_blank"
          rel="noreferrer"
          className="gz-boton-borde mt-6 inline-flex items-center gap-2 hover:bg-papel-calido"
        >
          <MIcon name="open_in_new" className="text-[16px]" />
          Ver en la web del ayuntamiento
        </a>
      )}

      <div className="mt-8 border-t border-filete pt-5">
        <Link to="/eventos" className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta hover:text-terracota">
          <MIcon name="arrow_back" className="text-[16px]" />
          Volver a la cartelera
        </Link>
      </div>
    </div>
  )
}
