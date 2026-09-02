import { useMemo, useState, useContext } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { proximosEventos, agruparEventosPorDia } from '../lib/eventos.js'
import TiraDeHoras from '../components/eventos/TiraDeHoras.jsx'
import FiltrosEventos from '../components/eventos/FiltrosEventos.jsx'
import MuroCartelera from '../components/eventos/MuroCartelera.jsx'
import AbrirCalendario from '../components/eventos/AbrirCalendario.jsx'
import DialogoAvisos from '../components/eventos/DialogoAvisos.jsx'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import HeroDestacadosDesktop from '../components/destacados/HeroDestacadosDesktop.jsx'
import { useDestacados } from '../lib/useDestacados.js'
import { eventoATarjeta } from '../lib/destacados.js'
import { GenericasEventoContext } from '../lib/GenericasEventoContext.jsx'
import { creditosDe, genericasParaEvento } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'
import { prefsLocales } from '../lib/push.js'
import { hoyISO } from '../lib/fechas.js'

export default function Eventos() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { genericas, asignaciones } = useContext(GenericasEventoContext)

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

  // Destacados de eventos (mismo hook que Inicio/Comercios) ya resueltos a la
  // forma `tarjeta`. Se rellena con los eventos más próximos hasta un mínimo,
  // para que el carrusel tenga con qué rotar aunque no haya contratados —
  // exactamente el patrón de la portada.
  const { items: destacadosEvento } = useDestacados({ eventos: todosEventos, tipo: 'evento' })
  const MIN_CARRUSEL = 6
  const itemsCarrusel = useMemo(() => {
    if (destacadosEvento.length >= MIN_CARRUSEL) return destacadosEvento
    const ids = new Set(destacadosEvento.map((d) => d.item?.id))
    const relleno = futuros
      .filter((e) => !ids.has(e.id))
      .slice(0, MIN_CARRUSEL - destacadosEvento.length)
      .map((e) => eventoATarjeta(e, { genericas: genericasParaEvento(e, genericas, asignaciones) }))
    return [...destacadosEvento, ...relleno]
  }, [destacadosEvento, futuros, genericas, asignaciones])

  // Ids de eventos realmente destacados (para la tarjeta panorámica del muro).
  const idsDestacados = useMemo(
    () => new Set(destacadosEvento.map((d) => d.item?.id).filter(Boolean)),
    [destacadosEvento]
  )

  // El carrusel se oculta al filtrar por categoría (igual que la franja de
  // Comercios): con un filtro activo manda el muro filtrado.
  const conCarrusel = categoriasActivas.length === 0 && itemsCarrusel.length > 0
  const hayDestacadosReales = destacadosEvento.length > 0

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

  const handleClickEvento = (evento) => {
    navigate(`/eventos/${evento.id}`)
  }

  return (
    <div className="flex flex-col">
      {/* Masthead */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="gz-filete-doble flex-1 pb-3">
          <div className="gz-label text-mudo">Qué hacer en</div>
          <h1 className="font-serif-dm text-seccion leading-none text-tinta">La cartelera</h1>
        </div>
        {/* Opt-in de push: en móvil solo icono (no compite con el título),
            texto a partir de sm. Área de toque ≥44 px. */}
        <button
          type="button"
          onClick={() => setAvisosAbierto(true)}
          aria-label={avisosActivos ? 'Avisos activados' : 'Recibir avisos'}
          className={`flex min-h-[44px] flex-shrink-0 items-center justify-center gap-2 px-3 font-mono-ibm text-[11px] uppercase tracking-etiqueta transition-colors ${
            avisosActivos ? 'border border-tinta text-tinta' : 'bg-tinta text-papel hover:opacity-90'
          }`}
        >
          <MIcon
            name={avisosActivos ? 'notifications_active' : 'notifications'}
            className="text-[16px]"
            fill={avisosActivos}
          />
          <span className="hidden sm:inline">
            {avisosActivos ? 'Avisos activados' : 'Recibir avisos'}
          </span>
        </button>
      </header>

      <DialogoAvisos
        abierto={avisosAbierto}
        onCerrar={() => {
          setAvisosAbierto(false)
          setAvisosActivos(Boolean(prefsLocales()))
        }}
      />

      {/* Destacados: mismos componentes que Inicio y Comercios (consistencia).
          Móvil: carrusel nativo con scroll-snap; escritorio: hero editorial. */}
      {conCarrusel && (
        <section className="mb-6 animate-rise">
          {/* Móvil */}
          <div className="md:hidden">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="gz-eyebrow">
                {hayDestacadosReales ? 'Destacados de la semana' : 'Próximos eventos'}
              </span>
              <span className="font-mono-ibm text-[10px] tracking-etiqueta text-mudo">
                {String(Math.min(itemsCarrusel.length, 3)).padStart(2, '0')} /{' '}
                {String(itemsCarrusel.length).padStart(2, '0')}
              </span>
            </div>
            <CarruselDestacados items={itemsCarrusel} columnas={3} seccion="eventos" />
          </div>

          {/* Escritorio */}
          <div className="hidden md:block">
            <HeroDestacadosDesktop
              items={itemsCarrusel}
              eyebrow={hayDestacadosReales ? 'Destacados de la semana' : 'Próximos eventos'}
              titulo={hayDestacadosReales ? 'Lo que no te puedes perder' : 'A qué ir próximamente'}
              seccion="eventos"
            />
          </div>
        </section>
      )}

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

      {creditosDe(genericas).length > 0 && (
        <p className="mb-6 text-center font-mono-ibm text-[9px] leading-relaxed text-mudo">
          Imágenes ilustrativas de bancos de imágenes de uso libre: {creditosDe(genericas).join(' · ')}
        </p>
      )}
    </div>
  )
}
