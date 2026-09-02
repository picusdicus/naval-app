import { useContext, useEffect, useMemo, useState } from 'react'
import eventosCurados from '../../../data/eventos.json'
import eventosExternos from '../../../data/eventos-externos.json'
import { aplicarFusionesManuales, combinarEventos, enriquecerPorCartel, fuenteDeIngesta } from '../../../lib/dedupEventos.js'
import { CATEGORIAS_EVENTO, disciplinaDeEvento, formatearFechaCorta, formatearFechaLarga } from '../../../lib/eventos.js'
import { hoyISO, sumarDias, diasHasta } from '../../../lib/fechas.js'
import { cartelDe } from '../../../lib/gaceta.js'
import { useImagenEvento } from '../../../lib/useImagenEvento.js'
import { RecargarGenericasContext } from '../../../lib/GenericasEventoContext.jsx'
import MIcon from '../../MIcon.jsx'
import { IconoCategoriaTabler } from '../../eventos/iconosEvento.jsx'
import FormularioImagenGenerica from './FormularioImagenGenerica.jsx'

// Tab "Eventos" del panel superadmin: lista todos los eventos publicados de la
// agenda (los tres orígenes ya fusionados con combinarEventos, como la vista
// pública) y permite, con un clic:
//   · Destacar / quitar destacado — crea o borra una fila en `destacados`
//     (tipo evento) vía /api/super/destacados. El destacado nace activo con la
//     duración por defecto (DIAS_DESTACADO); su vigencia/orden se afina luego
//     en el tab Destacados.
//   · Ocultar / mostrar — guarda el id público en `eventos_ocultos` vía
//     /api/super/eventos; la agenda pública lo filtra client-side. Reversible.
//   · Fusionar (issue #27) — dos clics: "Fusionar" en la fila que sobrevive
//     (el principal) y "Fusionar aquí" en el duplicado. Guarda el par en
//     `fusiones_eventos` vía /api/super/fusiones y la fusión se re-aplica
//     client-side en cada lectura (persistente entre crons). Deshacer desde
//     el detalle desplegable. El panel lee /api/super/fusiones (auth, sin
//     cache de CDN) y actualiza el estado local tras cada POST/DELETE, así el
//     superadmin ve el efecto al instante sin esperar los 60 s del GET público.
//
// La lista se arma en el cliente (JSON estáticos + /api/eventos) para no
// duplicar la lógica de merge/dedup que ya existe.

// enriquecerPorCartel ANTES de combinar, como la agenda pública: sin él, los
// carteles emparejados (enriqueceEvento resuelto) salían aquí como filas
// propias que NO existen como tarjeta pública, y fusionar sobre una de ellas
// guardaba un id que la agenda nunca puede unir (fusión inerte) — pasó de
// verdad con «Puertas abiertas patinaje» (2026-09-01). El panel debe listar
// exactamente las tarjetas que la vista pública pinta.
const ESTATICOS = enriquecerPorCartel([...eventosCurados, ...eventosExternos])
const MAX_FILAS = 60
const DIAS_DESTACADO = 30 // duración por defecto al destacar con un clic

const ETIQUETA_ORIGEN = { municipal: 'Ayuntamiento', vecinal: 'Vecinal', cultural: 'Cultural' }

function fuenteDe(evento) {
  return evento.fuente || ETIQUETA_ORIGEN[evento.origen] || 'Evento'
}

// Miniatura del evento para la fila del listado: cartel real si lo hay
// (lazy, y si la URL falla el hook la anula) o el mismo fallback que las
// tarjetas públicas — degradado de categoría + trama + icono Tabler.
// Componente propio porque useImagenEvento es un hook y no puede llamarse
// dentro del map de filas. Exportado: el tab Pendientes lo reutiliza para
// pintar la misma miniatura (cartel real o fallback de categoría).
export function MiniaturaEvento({ evento, clase = 'h-12 w-12', tamIcono = 20 }) {
  const { posterUrl, pos, onError } = useImagenEvento(evento)
  const { fondo, trama } = cartelDe(evento.categoria)
  return posterUrl ? (
    <img
      src={posterUrl}
      alt=""
      loading="lazy"
      onError={onError}
      className={`${clase} shrink-0 border border-filete object-cover`}
      style={{ objectPosition: pos }}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`relative flex ${clase} shrink-0 items-center justify-center border border-filete ${trama}`}
      style={{ background: fondo }}
    >
      <IconoCategoriaTabler
        categoria={evento.categoria}
        subcategoria={evento.subcategoria}
        size={tamIcono}
        stroke={1.5}
        className="text-papel/80"
      />
    </div>
  )
}

// Detalle desplegado bajo la fila (acordeón): imagen grande + los campos del
// evento que la fila comprime. Solo lectura — las acciones siguen en la fila.
function DetalleEvento({
  evento,
  fuenteIngesta,
  subtipoImagen,
  conCartelPropio,
  fusiones = [],
  inertes = [],
  onDeshacer,
  ocupado,
}) {
  // Subir una genérica para la categoría/subtipo de ESTE evento sin ir al
  // panel de imágenes; al terminar se recarga el Context para que las
  // miniaturas (esta y las de los demás eventos del mismo subtipo) cambien.
  const recargarGenericas = useContext(RecargarGenericasContext)
  const [subidaAbierta, setSubidaAbierta] = useState(false)
  const [subidaOk, setSubidaOk] = useState(false)
  const esGeneral = /\(general\)$/.test(subtipoImagen || '')
  const disciplinaSubida = esGeneral ? null : subtipoImagen
  const etiquetaSubtipo = `${CATEGORIAS_EVENTO[evento.categoria]?.nombre || evento.categoria} · ${
    esGeneral ? 'general' : subtipoImagen
  }`

  const datos = [
    ['Fecha', evento.fecha ? formatearFechaLarga(evento.fecha) : 'Sin fecha'],
    ['Hora', evento.hora || null],
    ['Lugar', evento.lugar || null],
    ['Organiza', fuenteDe(evento)],
    [
      'Categoría',
      `${CATEGORIAS_EVENTO[evento.categoria]?.nombre || evento.categoria || '—'}${
        evento.subcategoria ? ` · ${evento.subcategoria}` : ''
      }`,
    ],
    ['Vía de ingesta', fuenteIngesta],
    ['Id', evento.id],
    [
      'Ids secundarios',
      evento.idsSecundarios?.length ? evento.idsSecundarios.join(', ') : null,
    ],
  ].filter(([, valor]) => valor)

  return (
    <div className="mt-3 flex flex-col gap-4 border border-filete bg-papel-calido p-4 sm:flex-row">
      <MiniaturaEvento evento={evento} clase="h-52 w-40" tamIcono={44} />
      <div className="min-w-0 flex-1 space-y-3">
        {evento.descripcion && (
          <p className="whitespace-pre-line font-serif-spectral text-sm leading-relaxed text-tinta">
            {evento.descripcion}
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="min-w-0">
              <dt className="font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-mudo">
                {etiqueta}
              </dt>
              <dd className="break-words font-serif-spectral text-sm text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
        {(fusiones.length > 0 || inertes.length > 0) && (
          <div className="space-y-1.5 border-t border-filete pt-3">
            <p className="font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-mudo">
              Fusiones manuales
            </p>
            {fusiones.map((f) => (
              <div key={f.secundaria} className="flex flex-wrap items-center gap-2">
                <span className="break-all font-serif-spectral text-sm text-tinta">
                  Absorbe «{f.secundaria}»
                </span>
                <button
                  type="button"
                  onClick={() => onDeshacer(f)}
                  disabled={ocupado}
                  className="inline-flex items-center gap-1 border border-filete px-2 py-1 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-terracota hover:text-terracota disabled:opacity-40"
                  title="Deshacer esta fusión: las dos tarjetas volverán a mostrarse por separado"
                >
                  <MIcon name="call_split" className="text-[13px]" />
                  Deshacer
                </button>
              </div>
            ))}
            {inertes.map((f) => (
              <div key={`${f.principal}|${f.secundaria}`} className="space-y-1">
                <p className="break-all font-serif-spectral text-sm text-terracota">
                  Fusión sin efecto — {f.motivo}. La fila «{f.principal}» ← «{f.secundaria}» se
                  mantiene y volverá a aplicarse sola si la fuente trae de nuevo las dos partes;
                  deshazla solo si el evento ya no va a volver.
                </p>
                <button
                  type="button"
                  onClick={() => onDeshacer(f)}
                  disabled={ocupado}
                  className="inline-flex items-center gap-1 border border-filete px-2 py-1 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-terracota hover:text-terracota disabled:opacity-40"
                  title="Borrar esta fila de fusión inerte"
                >
                  <MIcon name="call_split" className="text-[13px]" />
                  Deshacer
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2 border-t border-filete pt-3">
          <p className="font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-mudo">
            Imagen ilustrativa · {etiquetaSubtipo}
          </p>
          <p className="font-serif-spectral text-sm text-tinta">
            {conCartelPropio
              ? 'Este evento trae cartel propio; las genéricas de este subtipo son su reserva si el cartel dejara de cargar.'
              : 'Sin cartel propio: se pinta con las genéricas activas de este subtipo (o el degradado si no hay ninguna).'}{' '}
            Una imagen subida aquí vale para todos los eventos del mismo subtipo.
          </p>
          {subidaAbierta ? (
            <div className="border border-filete bg-papel p-3">
              <FormularioImagenGenerica
                categoria={evento.categoria}
                disciplina={disciplinaSubida}
                compacto
                onSubida={async () => {
                  await recargarGenericas()
                  setSubidaAbierta(false)
                  setSubidaOk(true)
                }}
              />
              <button
                type="button"
                onClick={() => setSubidaAbierta(false)}
                className="mt-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo hover:text-tinta"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubidaAbierta(true)
                  setSubidaOk(false)
                }}
                className="inline-flex items-center gap-1 border border-filete px-2 py-1 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-terracota hover:text-terracota"
              >
                <MIcon name="add_photo_alternate" className="text-[13px]" />
                Subir imagen para {etiquetaSubtipo}
              </button>
              {subidaOk && (
                <span className="font-serif-spectral text-sm text-verde">Imagen guardada y aplicada.</span>
              )}
            </div>
          )}
        </div>
        <a
          href={`/eventos/${encodeURIComponent(evento.id)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota hover:underline"
        >
          <MIcon name="open_in_new" className="text-[13px]" />
          Ver ficha pública
        </a>
      </div>
    </div>
  )
}

export default function TablesEventos() {
  const [deLaBase, setDeLaBase] = useState([])
  const [destacados, setDestacados] = useState([]) // solo tipo evento
  const [ocultos, setOcultos] = useState(() => new Set())
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [incluirPasados, setIncluirPasados] = useState(false)
  const [ocupadoId, setOcupadoId] = useState(null) // id del evento con acción en curso
  const [abiertoId, setAbiertoId] = useState(null) // id del evento con el detalle desplegado
  const [mensaje, setMensaje] = useState(null) // { tipo: 'error', texto }
  const [fusiones, setFusiones] = useState([]) // fusiones manuales [{principal, secundaria}]
  const [origenFusionId, setOrigenFusionId] = useState(null) // id del principal elegido en el modo fusión

  useEffect(() => {
    let vigente = true
    Promise.all([
      fetch('/api/eventos').then((r) => (r.ok ? r.json() : { eventos: [] })).catch(() => ({ eventos: [] })),
      fetch('/api/super/destacados').then((r) => (r.ok ? r.json() : { destacados: [] })).catch(() => ({ destacados: [] })),
      fetch('/api/super/eventos').then((r) => (r.ok ? r.json() : { ocultos: [] })).catch(() => ({ ocultos: [] })),
      fetch('/api/super/fusiones').then((r) => (r.ok ? r.json() : { fusiones: [] })).catch(() => ({ fusiones: [] })),
    ])
      .then(([ev, de, oc, fu]) => {
        if (!vigente) return
        setDeLaBase(ev.eventos ?? [])
        setDestacados((de.destacados ?? []).filter((d) => d.tipo === 'evento'))
        setOcultos(new Set(oc.ocultos ?? []))
        setFusiones(fu.fusiones ?? [])
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  // Mismo pipeline que la agenda pública, con las fusiones manuales como
  // último paso. `estado.inertes` recoge las filas de fusiones_eventos que no
  // encuentran alguna de sus dos partes, para avisar en el detalle desplegable.
  const { eventos, inertesPorRef } = useMemo(() => {
    const estado = { inertes: [] }
    const lista = aplicarFusionesManuales(combinarEventos(ESTATICOS, deLaBase), fusiones, estado)
    const mapa = new Map()
    for (const f of estado.inertes) {
      for (const ref of [f.principal, f.secundaria]) {
        if (!mapa.has(ref)) mapa.set(ref, [])
        mapa.get(ref).push(f)
      }
    }
    return { eventos: lista, inertesPorRef: mapa }
  }, [deLaBase, fusiones])

  // Fusiones inertes que atañen a un evento: por su id o cualquiera de sus
  // idsSecundarios (dedupe por par, la misma fila puede matchear dos refs).
  function fusionesInertesDe(evento) {
    const vistos = new Set()
    const resultado = []
    for (const ref of [evento.id, ...(evento.idsSecundarios || [])]) {
      for (const f of inertesPorRef.get(ref) || []) {
        const clave = `${f.principal}|${f.secundaria}`
        if (!vistos.has(clave)) {
          vistos.add(clave)
          resultado.push(f)
        }
      }
    }
    return resultado
  }

  const destacadoPorRef = useMemo(() => {
    const mapa = new Map()
    for (const d of destacados) mapa.set(d.referenciaId, d)
    return mapa
  }, [destacados])

  // Un destacado apunta al id principal del evento o a cualquiera de los
  // idsSecundarios que la fusión de duplicados haya acumulado.
  function destacadoDe(evento) {
    return (
      destacadoPorRef.get(evento.id) ||
      (evento.idsSecundarios || []).map((id) => destacadoPorRef.get(id)).find(Boolean) ||
      null
    )
  }
  function estaOculto(evento) {
    return ocultos.has(evento.id) || (evento.idsSecundarios || []).some((id) => ocultos.has(id))
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return eventos
      .filter((e) => incluirPasados || diasHasta(e.fecha) >= 0)
      .filter(
        (e) =>
          !texto ||
          e.titulo.toLowerCase().includes(texto) ||
          (e.lugar || '').toLowerCase().includes(texto),
      )
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  }, [eventos, busqueda, incluirPasados])

  const visibles = filtrados.slice(0, MAX_FILAS)

  async function destacar(evento) {
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const inicio = hoyISO()
      const respuesta = await fetch('/api/super/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'evento',
          referenciaId: evento.id,
          orden: 0,
          fechaInicio: inicio,
          fechaFin: sumarDias(inicio, DIAS_DESTACADO - 1),
          estado: 'activo',
        }),
      })
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo destacar el evento.')
      setDestacados((previos) => [...previos.filter((d) => d.id !== datos.destacado.id), datos.destacado])
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function quitarDestacado(evento) {
    const destacado = destacadoDe(evento)
    if (!destacado) return
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const respuesta = await fetch(`/api/super/destacados?id=${destacado.id}`, { method: 'DELETE' })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo quitar el destacado.')
      }
      setDestacados((previos) => previos.filter((d) => d.id !== destacado.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function ocultar(evento) {
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      const respuesta = await fetch('/api/super/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenciaId: evento.id }),
      })
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo ocultar el evento.')
      }
      setOcultos((previos) => new Set(previos).add(evento.id))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function mostrar(evento) {
    // Puede haber varias refs ocultas del mismo evento (principal + secundarias).
    const refs = [evento.id, ...(evento.idsSecundarios || [])].filter((id) => ocultos.has(id))
    if (!refs.length) return
    setOcupadoId(evento.id)
    setMensaje(null)
    try {
      for (const ref of refs) {
        const respuesta = await fetch(`/api/super/eventos?ref=${encodeURIComponent(ref)}`, {
          method: 'DELETE',
        })
        if (!respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}))
          throw new Error(datos.error || 'No se pudo mostrar el evento.')
        }
      }
      setOcultos((previos) => {
        const copia = new Set(previos)
        refs.forEach((ref) => copia.delete(ref))
        return copia
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  // Segundo clic del modo fusión: `secundaria` se fusiona DENTRO de la fila
  // elegida como principal. El estado local se actualiza con la respuesta (el
  // panel no usa el GET público cacheado), así el efecto es inmediato.
  async function crearFusion(principalId, secundariaId) {
    setOcupadoId(principalId)
    setMensaje(null)
    try {
      const respuesta = await fetch('/api/super/fusiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenciaPrincipal: principalId,
          referenciaSecundaria: secundariaId,
        }),
      })
      const datos = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo fusionar el evento.')
      setFusiones((previas) => [
        ...previas.filter((f) => f.secundaria !== secundariaId),
        datos.fusion,
      ])
      setOrigenFusionId(null)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  async function deshacerFusion(fusion) {
    setOcupadoId(fusion.principal)
    setMensaje(null)
    try {
      const respuesta = await fetch(
        `/api/super/fusiones?ref=${encodeURIComponent(fusion.secundaria)}`,
        { method: 'DELETE' },
      )
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({}))
        throw new Error(datos.error || 'No se pudo deshacer la fusión.')
      }
      setFusiones((previas) => previas.filter((f) => f.secundaria !== fusion.secundaria))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupadoId(null)
    }
  }

  const origenFusion = origenFusionId ? eventos.find((e) => e.id === origenFusionId) : null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif-dm text-xl text-tinta">Eventos publicados</h2>
        <p className="mt-1 font-serif-spectral text-sm text-pardo">
          Todos los eventos de la agenda (curados, sincronizados y de las organizaciones).
          Destaca cualquiera con un clic (dura {DIAS_DESTACADO} días; afina su orden y vigencia
          en el tab Destacados) u ocúltalo de la agenda pública. Ocultar es reversible y no
          borra el evento. Si dos entradas son el mismo acto y el matcher automático no las
          une, fusiónalas: «Fusionar» en la que debe sobrevivir y «Fusionar aquí» en la
          duplicada — la fusión persiste entre sincronizaciones y se deshace desde el detalle.
        </p>
      </div>

      {mensaje && (
        <p className="flex items-start gap-2 border border-terracota bg-terracota-fondo px-4 py-3 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="mt-0.5 text-[18px]" />
          <span>{mensaje.texto}</span>
        </p>
      )}

      {origenFusionId && (
        <div className="flex flex-col gap-2 border border-ocre-profundo bg-papel-calido px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-serif-spectral text-sm text-tinta">
            <MIcon name="call_merge" className="mr-1 align-middle text-[16px] text-ocre-profundo" />
            Fusionando: elige el evento duplicado que se fusionará dentro de «
            {origenFusion?.titulo || origenFusionId}». La tarjeta elegida desaparecerá de la
            agenda y solo rellenará los campos vacíos del principal. La fusión persiste entre
            sincronizaciones y puede deshacerse.
          </p>
          <button
            type="button"
            onClick={() => setOrigenFusionId(null)}
            className="shrink-0 self-start border border-filete px-2.5 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-terracota hover:text-terracota"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MIcon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-mudo"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca por título o lugar…"
            className="gz-input w-full pl-9"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta">
          <input
            type="checkbox"
            checked={incluirPasados}
            onChange={(e) => setIncluirPasados(e.target.checked)}
            className="accent-terracota"
          />
          Incluir pasados
        </label>
      </div>

      <p className="gz-label text-mudo">
        {cargando
          ? 'Cargando eventos…'
          : `${filtrados.length} ${filtrados.length === 1 ? 'evento' : 'eventos'}`}
        {!cargando && filtrados.length > MAX_FILAS && ` (se muestran ${MAX_FILAS} — afina la búsqueda)`}
      </p>

      <div className="divide-y divide-filete border-t border-tinta">
        {visibles.map((evento) => {
          const destacado = destacadoDe(evento)
          const oculto = estaOculto(evento)
          const ocupado = ocupadoId === evento.id
          const pasado = diasHasta(evento.fecha) < 0
          const fuenteIngesta = fuenteDeIngesta(evento)
          // Qué imagen ilustrativa le toca (panel de "Imágenes genéricas"): el
          // subtipo/disciplina que infiere disciplinaDeEvento(), o las generales
          // de su categoría. Con cartel propio se muestra como reserva (la
          // agenda cae a ella si el cartel externo deja de existir).
          const subtipoImagen = disciplinaDeEvento(evento) ?? `${evento.categoria} (general)`
          const conCartelPropio = Boolean(evento.imagen && evento.imagen.trim())
          const abierto = abiertoId === evento.id
          const fusionesDelEvento = evento.fusionesManualesAplicadas || []
          const inertesDelEvento = fusionesInertesDe(evento)
          return (
            <div key={evento.id} className={`py-3 ${oculto ? 'opacity-60' : ''}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <button
                type="button"
                onClick={() => setAbiertoId((previo) => (previo === evento.id ? null : evento.id))}
                aria-expanded={abierto}
                title={abierto ? 'Replegar el detalle' : 'Ver el detalle del evento'}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <MiniaturaEvento evento={evento} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif-dm text-base leading-tight text-tinta">
                    {evento.titulo}
                    {destacado && (
                      <MIcon name="star" className="ml-2 align-middle text-[15px] text-ocre-profundo" />
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                    {formatearFechaCorta(evento.fecha)}
                    {evento.hora ? `, ${evento.hora}` : ''} · {fuenteDe(evento)}
                    {CATEGORIAS_EVENTO[evento.categoria]?.nombre
                      ? ` · ${CATEGORIAS_EVENTO[evento.categoria].nombre}`
                      : ''}
                    {fuenteIngesta && (
                      <span
                        className="ml-2 text-mudo"
                        title="Vía por la que este evento entró en la agenda (solo visible en este panel)"
                      >
                        · {fuenteIngesta}
                      </span>
                    )}
                    <span
                      className="ml-2 text-mudo"
                      title={
                        conCartelPropio
                          ? 'Trae cartel propio. Si su URL dejara de cargar, usaría las imágenes genéricas de esta categoría/disciplina (pestaña "Imágenes genéricas")'
                          : 'Sin cartel propio: usa las imágenes genéricas subidas a esta categoría/disciplina (pestaña "Imágenes genéricas")'
                      }
                    >
                      · {conCartelPropio ? `cartel propio (reserva: ${subtipoImagen})` : `ilustración: ${subtipoImagen}`}
                    </span>
                    {pasado && <span className="ml-2 text-mudo">· pasado</span>}
                    {evento.fusionadoPorTituloAproximado && (
                      <span
                        className="ml-2 text-ocre-profundo"
                        title="Fusionado con un evento del Ayuntamiento por título aproximado (los títulos no eran equivalentes). Revisa que sea el mismo acto; si no lo es, ocúltalo."
                      >
                        · fusión aproximada
                      </span>
                    )}
                    {evento.fusionadoManualmente && (
                      <span
                        className="ml-2 text-ocre-profundo"
                        title="Fusionado manualmente por el superadmin. Despliega el detalle para ver qué absorbe o deshacer la fusión."
                      >
                        · fusión manual
                      </span>
                    )}
                    {inertesDelEvento.length > 0 && (
                      <span
                        className="ml-2 text-terracota"
                        title="Este evento tiene una fusión manual sin efecto (falta una de las dos partes). Despliega el detalle para verla."
                      >
                        · fusión sin efecto
                      </span>
                    )}
                  </p>
                </div>
                <MIcon
                  name={abierto ? 'expand_less' : 'expand_more'}
                  className="shrink-0 text-[18px] text-mudo"
                />
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {destacado ? (
                  <button
                    type="button"
                    onClick={() => quitarDestacado(evento)}
                    disabled={ocupado}
                    className="inline-flex items-center gap-1 border border-ocre-profundo bg-papel-calido px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-ocre-profundo transition-colors hover:bg-ocre-profundo hover:text-papel disabled:opacity-40"
                    title="Quitar de destacados"
                  >
                    <MIcon name="star" className="text-[14px]" />
                    Destacado
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => destacar(evento)}
                    disabled={ocupado || pasado}
                    className="inline-flex items-center gap-1 border border-filete px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-ocre-profundo hover:text-ocre-profundo disabled:cursor-not-allowed disabled:opacity-40"
                    title={pasado ? 'No tiene sentido destacar un evento pasado' : 'Destacar este evento'}
                  >
                    <MIcon name="star_outline" className="text-[14px]" />
                    Destacar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (oculto ? mostrar(evento) : ocultar(evento))}
                  disabled={ocupado}
                  className={`inline-flex items-center gap-1 border px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors disabled:opacity-40 ${
                    oculto
                      ? 'border-terracota bg-terracota text-papel'
                      : 'border-filete text-pardo hover:border-terracota hover:text-terracota'
                  }`}
                  title={oculto ? 'Volver a mostrar en la agenda' : 'Ocultar de la agenda pública'}
                >
                  <MIcon name={oculto ? 'visibility' : 'visibility_off'} className="text-[14px]" />
                  {oculto ? 'Oculto' : 'Ocultar'}
                </button>

                {origenFusionId === null ? (
                  <button
                    type="button"
                    onClick={() => setOrigenFusionId(evento.id)}
                    disabled={ocupado}
                    className="inline-flex items-center gap-1 border border-filete px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo transition-colors hover:border-ocre-profundo hover:text-ocre-profundo disabled:opacity-40"
                    title="Fusionar otro evento duplicado dentro de este (este sobrevive como principal)"
                  >
                    <MIcon name="call_merge" className="text-[14px]" />
                    Fusionar
                  </button>
                ) : origenFusionId === evento.id ? (
                  <button
                    type="button"
                    onClick={() => setOrigenFusionId(null)}
                    className="inline-flex items-center gap-1 border border-ocre-profundo bg-papel-calido px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-ocre-profundo"
                    title="Cancelar la fusión"
                  >
                    <MIcon name="close" className="text-[14px]" />
                    Cancelar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => crearFusion(origenFusionId, evento.id)}
                    disabled={ocupadoId !== null}
                    className="inline-flex items-center gap-1 border border-ocre-profundo px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-ocre-profundo transition-colors hover:bg-ocre-profundo hover:text-papel disabled:opacity-40"
                    title={`Fusionar este evento (desaparecerá como tarjeta) dentro de «${origenFusion?.titulo || origenFusionId}»`}
                  >
                    <MIcon name="call_merge" className="text-[14px]" />
                    Fusionar aquí
                  </button>
                )}
              </div>
              </div>

              {abierto && (
                <DetalleEvento
                  evento={evento}
                  fuenteIngesta={fuenteIngesta}
                  subtipoImagen={subtipoImagen}
                  conCartelPropio={conCartelPropio}
                  fusiones={fusionesDelEvento}
                  inertes={inertesDelEvento}
                  onDeshacer={deshacerFusion}
                  ocupado={ocupado}
                />
              )}
            </div>
          )
        })}

        {!cargando && visibles.length === 0 && (
          <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-sm text-pardo">
            No hay eventos que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  )
}
