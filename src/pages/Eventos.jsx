import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { proximosEventos, agruparEventosPorDia } from '../lib/eventos.js'
import HeroPrincipalCartelera from '../components/eventos/HeroPrincipalCartelera.jsx'
import TiraDeHoras from '../components/eventos/TiraDeHoras.jsx'
import FiltrosEventos from '../components/eventos/FiltrosEventos.jsx'
import MuroCartelera from '../components/eventos/MuroCartelera.jsx'
import AbrirCalendario from '../components/eventos/AbrirCalendario.jsx'
import DialogoAvisos from '../components/eventos/DialogoAvisos.jsx'
import { CREDITOS_FOTOS } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'
import { prefsLocales } from '../lib/push.js'
import { hoyISO } from '../lib/fechas.js'

export default function Eventos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Estado desde URL params
  const categoriasParam = searchParams.get('categorias')
  const diaParam = searchParams.get('dia')

  const categoriasActivas = useMemo(
    () => (categoriasParam ? categoriasParam.split(',') : []),
    [categoriasParam]
  )

  const [avisosAbierto, setAvisosAbierto] = useState(false)
  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [avisosActivos, setAvisosActivos] = useState(() => Boolean(prefsLocales()))

  // Data
  const { eventos: todosEventos } = useEventosPublicos()
  const futuros = useMemo(() => proximosEventos(todosEventos), [todosEventos])
  const eventosAgrupados = useMemo(() => agruparEventosPorDia(futuros), [futuros])

  // Día por defecto: el primero con algún evento que cumpla el filtro activo
  // (hoy suele no tener nada, y con un filtro puede no tenerlo el primer día
  // sin filtrar). El param de la URL manda si existe.
  const primerDiaConMatch = useMemo(() => {
    const grupo = eventosAgrupados.find(({ eventos }) =>
      categoriasActivas.length === 0
        ? eventos.length > 0
        : eventos.some((e) => categoriasActivas.includes(e.categoria))
    )
    return grupo?.dia
  }, [eventosAgrupados, categoriasActivas])

  const diaSeleccionado = diaParam || primerDiaConMatch || hoyISO()

  // Destacados contratados (crudos de /api/destacados). El hero y el muro
  // resuelven las referencias contra los eventos ya cargados.
  const [datosDestacados, setDatosDestacados] = useState([])

  useEffect(() => {
    fetch('/api/destacados')
      .then((r) => (r.ok ? r.json() : { destacados: [] }))
      .then((datos) => setDatosDestacados(datos.destacados ?? []))
      .catch(() => setDatosDestacados([]))
  }, [])

  // Índice de eventos por id público para resolver referencias de destacados.
  const eventosPorRefId = useMemo(() => {
    const mapa = new Map()
    todosEventos.forEach((e) => {
      mapa.set(e.id, e)
      if (e.idsSecundarios) e.idsSecundarios.forEach((s) => mapa.set(s, e))
      if (e.id.startsWith('bd-')) mapa.set(e.id.slice(3), e)
    })
    return mapa
  }, [todosEventos])

  // Ids de eventos actualmente destacados (para marcar la tarjeta panorámica).
  const idsDestacados = useMemo(() => {
    const set = new Set()
    datosDestacados.forEach((d) => {
      const evento = eventosPorRefId.get(d.referenciaId)
      if (evento) set.add(evento.id)
    })
    return set
  }, [datosDestacados, eventosPorRefId])

  // Sync URL params when filters change
  const handleCategoriasChange = (cat) => {
    const nuevas = categoriasActivas.includes(cat)
      ? categoriasActivas.filter((c) => c !== cat)
      : [...categoriasActivas, cat]

    const params = new URLSearchParams()
    if (diaParam) params.append('dia', diaParam)
    if (nuevas.length > 0) params.append('categorias', nuevas.join(','))
    setSearchParams(params)
  }

  const handleLimpiarFiltros = () => {
    const params = new URLSearchParams()
    if (diaParam) params.append('dia', diaParam)
    setSearchParams(params)
  }

  const handleDiaSeleccionado = (dia) => {
    const params = new URLSearchParams()
    params.append('dia', dia)
    if (categoriasActivas.length > 0) params.append('categorias', categoriasActivas.join(','))
    setSearchParams(params)

    // Ancla de scroll a la banda de ese día en el muro.
    setTimeout(() => {
      const banda = document.getElementById(`dia-${dia}`)
      if (banda) banda.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const handleVerDiaCompleto = (dia) => {
    const params = new URLSearchParams()
    if (categoriasActivas.length > 0) params.append('categorias', categoriasActivas.join(','))
    navigate(`/eventos/${dia}?${params.toString()}`)
  }

  const handleClickEvento = (evento) => {
    navigate(`/eventos/${evento.id}`)
  }

  return (
    <div className="flex flex-col">
      {/* Masthead */}
      <header className="flex items-start justify-between gap-4 mb-6">
        <div className="gz-filete-doble flex-1 pb-3">
          <div className="gz-label text-mudo">Qué hacer en</div>
          <h1 className="font-serif-dm text-seccion leading-none text-tinta">La cartelera</h1>
        </div>
        {/* Push notification opt-in */}
        <button
          type="button"
          onClick={() => setAvisosAbierto(true)}
          className={`flex flex-shrink-0 items-center gap-2 px-3 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta transition-colors ${
            avisosActivos ? 'border border-tinta text-tinta' : 'bg-tinta text-papel hover:opacity-90'
          }`}
        >
          <MIcon
            name={avisosActivos ? 'notifications_active' : 'notifications'}
            className="text-[16px]"
            fill={avisosActivos}
          />
          {avisosActivos ? 'Avisos activados' : 'Recibir avisos'}
        </button>
      </header>

      <DialogoAvisos
        abierto={avisosAbierto}
        onCerrar={() => {
          setAvisosAbierto(false)
          setAvisosActivos(Boolean(prefsLocales()))
        }}
      />

      {/* Hero: carrusel global de destacados, con relleno de próximos eventos */}
      <HeroPrincipalCartelera
        proximos={futuros}
        destacados={datosDestacados}
        categoriasActivas={categoriasActivas}
        onVerEvento={handleClickEvento}
      />

      {/* Day strip selector */}
      <TiraDeHoras
        eventosAgrupados={eventosAgrupados}
        diaSeleccionado={diaSeleccionado}
        categoriasActivas={categoriasActivas}
        onDiaSeleccionado={handleDiaSeleccionado}
        onAbrirCalendario={() => setMostrarCalendario(true)}
      />

      {/* Category filters (contadores sobre toda la cartelera) */}
      <FiltrosEventos
        eventos={futuros}
        categoriasActivas={categoriasActivas}
        onCategoriaToggle={handleCategoriasChange}
        onLimpiar={handleLimpiarFiltros}
      />

      {/* Main grid / muro */}
      <div>
        <MuroCartelera
          eventosAgrupados={eventosAgrupados}
          categoriasActivas={categoriasActivas}
          idsDestacados={idsDestacados}
          onClickEvento={handleClickEvento}
          onVerDiaCompleto={handleVerDiaCompleto}
        />
      </div>

      {/* Calendario en modal (bajo demanda desde la tira de días) */}
      <AbrirCalendario
        abierto={mostrarCalendario}
        eventosAgrupados={eventosAgrupados}
        categoriasActivas={categoriasActivas}
        diaSeleccionado={diaSeleccionado}
        onSeleccionar={(dia) => {
          setMostrarCalendario(false)
          handleDiaSeleccionado(dia)
        }}
        onCerrar={() => setMostrarCalendario(false)}
      />

      {/* CTA */}
      <section className="mt-10 mb-6 flex flex-col items-center border border-tinta bg-papel-calido p-8 text-center">
        <MIcon name="campaign" className="mb-2 text-[40px] text-terracota" />
        <h3 className="font-serif-dm text-xl text-tinta">¿Organizas un evento?</h3>
        <p className="mb-6 mt-2 max-w-md font-serif-spectral text-sm text-tinta-apagada">
          Si tu asociación o negocio organiza una actividad en Navalcarnero, cuéntanoslo y la
          publicaremos en la agenda vecinal.
        </p>
        <a
          href="mailto:directorio@navalcarnero.example?subject=Propuesta%20de%20evento"
          className="gz-boton-tinta"
        >
          Proponer un evento
        </a>
      </section>

      <p className="mb-6 text-center font-mono-ibm text-[9px] leading-relaxed text-mudo">
        Imágenes ilustrativas vía Wikimedia Commons: {CREDITOS_FOTOS.join(' · ')}
      </p>
    </div>
  )
}
