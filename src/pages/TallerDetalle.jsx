import { Link, useParams } from 'react-router-dom'
import { useTalleres } from '../lib/useTalleres.js'
import {
  colorCategoriaTaller,
  nombreCategoriaTaller,
  tallerComoEvento,
  textoDias,
} from '../lib/talleres.js'
import { useImagenEvento } from '../lib/useImagenEvento.js'
import { cartelDe } from '../lib/gaceta.js'
import { coordsDeLugar } from '../lib/lugares.js'
import MapaLugar from '../components/MapaLugar.jsx'
import BotonCompartir from '../components/BotonCompartir.jsx'
import MIcon from '../components/MIcon.jsx'

function enlaceGoogleMaps(lugar) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lugar}, Navalcarnero, Madrid`,
  )}`
}

/** Texto enriquecido para compartir: nombre + primer turno + lugar + URL. */
function textoCompartir(taller, url) {
  const lineas = [taller.nombre]
  const turno = taller.turnos?.[0]
  const horario = turno
    ? [textoDias(turno.dias), turno.horaInicio && `${turno.horaInicio}${turno.horaFin ? `-${turno.horaFin}` : ''}`]
        .filter(Boolean)
        .join(' · ')
    : ''
  const segunda = [horario, taller.lugar].filter(Boolean).join(' · ')
  if (segunda) lineas.push(segunda)
  lineas.push(url)
  return lineas.join('\n')
}

/**
 * Ficha de un taller. Estructura paralela a EventoDetalle (cartel arriba,
 * cabecera, bloques con `gz-label`, `<dl>` de detalles y enlace de vuelta),
 * con la tabla de turnos como pieza central: es lo que el vecino viene a
 * consultar y lo que no cabe en la tarjeta del listado.
 */
export default function TallerDetalle() {
  const { id } = useParams()
  const { talleres, cargando } = useTalleres()
  const taller = talleres.find((t) => t.id === id)

  // El hook se llama SIEMPRE (reglas de los hooks) aunque el taller aún no
  // esté cargado: useImagenEvento tolera null a propósito.
  const { posterUrl, pos, onError, real, credito } = useImagenEvento(
    taller ? tallerComoEvento(taller) : null,
  )

  if (cargando) {
    return (
      <div className="py-16 text-center font-mono-ibm text-xs uppercase tracking-etiqueta text-mudo">
        Cargando…
      </div>
    )
  }

  if (!taller) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="font-serif-dm text-2xl italic text-tinta">Ese taller ya no está disponible.</p>
        <Link
          to="/talleres"
          className="mt-6 inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta hover:text-terracota"
        >
          <MIcon name="arrow_back" className="text-[16px]" />
          Volver a los talleres
        </Link>
      </div>
    )
  }

  const cartel = cartelDe('salvia')
  const categoria = nombreCategoriaTaller(taller.categoria)
  const color = colorCategoriaTaller(taller.categoria)
  const coords = taller.lugar ? coordsDeLugar(taller.lugar) : null
  const turnos = taller.turnos || []
  // Los turnos pueden repartirse entre sedes (Relajación imparte dos en la Casa
  // de la Cultura y uno en el Centro de Artes Escénicas): cuando alguno trae
  // lugar propio, la tabla gana una columna en vez de mentir con el del taller.
  const conLugarPorTurno = turnos.some((t) => t.lugar)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden border border-tinta">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={taller.nombre}
            onError={onError}
            className="h-full w-full object-cover"
            style={{ objectPosition: pos }}
          />
        ) : (
          <div className={`absolute inset-0 ${cartel.trama}`} style={{ background: cartel.fondo }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <MIcon name="school" className="text-[140px] text-white" />
            </div>
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 z-20 w-full p-5">
              <span className="gz-badge-oro">{categoria}</span>
              <h1 className="mt-2.5 font-serif-dm text-hero-movil italic text-papel">
                {taller.nombre}
              </h1>
            </div>
          </div>
        )}
      </div>

      {posterUrl && !real && credito && (
        <p className="mt-1 text-right font-mono-ibm text-[9px] text-mudo">
          Imagen ilustrativa · {credito}
        </p>
      )}

      <div className="mt-5">
        <div className="gz-eyebrow flex items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {categoria}
          {taller.curso && <span className="text-mudo">· Curso {taller.curso}</span>}
        </div>
        {posterUrl && (
          <h1 className="mt-1.5 font-serif-dm text-hero-movil italic leading-tight text-tinta">
            {taller.nombre}
          </h1>
        )}
      </div>

      {/* Turnos: la razón de ser de la ficha */}
      {turnos.length > 0 && (
        <div className="mt-6">
          <div className="gz-label text-mudo">
            {turnos.length === 1 ? 'Horario' : `Horarios (${turnos.length} turnos)`}
          </div>
          <ul className="mt-2.5 divide-y divide-filete border-y border-filete">
            {turnos.map((turno, i) => (
              <li key={turno.id || i} className="flex flex-col gap-0.5 py-3">
                {turno.etiqueta && (
                  <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota">
                    {turno.etiqueta}
                  </span>
                )}
                <div className="flex items-baseline justify-between gap-3 font-serif-spectral text-sm text-tinta">
                  <span>{textoDias(turno.dias) || 'Por determinar'}</span>
                  {turno.horaInicio && (
                    <span className="whitespace-nowrap font-mono-ibm text-xs text-pardo">
                      {turno.horaInicio}
                      {turno.horaFin ? ` – ${turno.horaFin}` : ''}
                    </span>
                  )}
                </div>
                {conLugarPorTurno && (
                  <span className="font-mono-ibm text-[10px] text-mudo">
                    {turno.lugar || taller.lugar}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {taller.descripcion && (
        <div className="mt-6">
          <div className="gz-label text-mudo">El taller</div>
          <p className="mt-2.5 whitespace-pre-line font-serif-spectral text-base leading-relaxed text-tinta">
            {taller.descripcion}
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className="gz-label text-mudo">Detalles</div>
        <dl className="mt-2.5 font-serif-spectral text-sm">
          {taller.precio && (
            <div className="flex justify-between border-b border-filete py-2">
              <dt className="text-pardo">Precio</dt>
              <dd className="text-tinta">{taller.precio}</dd>
            </div>
          )}
          {taller.edades && (
            <div className="flex justify-between border-b border-filete py-2">
              <dt className="shrink-0 text-pardo">Edades</dt>
              <dd className="text-right text-tinta">{taller.edades}</dd>
            </div>
          )}
          {taller.lugar && (
            <div className="flex justify-between border-b border-filete py-2">
              <dt className="shrink-0 text-pardo">Lugar</dt>
              <dd className="text-right text-tinta">{taller.lugar}</dd>
            </div>
          )}
          {taller.curso && (
            <div className="flex justify-between border-b border-filete py-2">
              <dt className="text-pardo">Curso</dt>
              <dd className="text-tinta">{taller.curso}</dd>
            </div>
          )}
        </dl>
      </div>

      {taller.lugar && (
        <div className="mt-6">
          {coords ? (
            <>
              <MapaLugar lat={coords.lat} lng={coords.lng} nombre={taller.lugar} />
              <a
                href={enlaceGoogleMaps(taller.lugar)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-serif-dm text-lg text-tinta underline-offset-2 transition-colors hover:text-terracota hover:underline"
              >
                {taller.lugar}
              </a>
            </>
          ) : (
            <a
              href={enlaceGoogleMaps(taller.lugar)}
              target="_blank"
              rel="noreferrer"
              className="gz-boton-tinta inline-flex items-center gap-2"
            >
              <MIcon name="map" className="text-[16px]" />
              Ver {taller.lugar} en el mapa
            </a>
          )}
        </div>
      )}

      <div className="mt-6">
        <BotonCompartir
          titulo={taller.nombre}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          textoCompartir={textoCompartir(
            taller,
            typeof window !== 'undefined' ? window.location.href : '',
          )}
          conEmail
        />
      </div>

      <div className="mt-8 border-t border-filete pt-5">
        <Link
          to="/talleres"
          className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta hover:text-terracota"
        >
          <MIcon name="arrow_back" className="text-[16px]" />
          Volver a los talleres
        </Link>
      </div>
    </div>
  )
}
