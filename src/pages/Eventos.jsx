import { Fragment, useEffect, useMemo, useState } from 'react'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import {
  LISTA_CATEGORIAS_EVENTO,
  proximosEventos,
  eventosPasados,
} from '../lib/eventos.js'
import EventoFila from '../components/eventos/EventoFila.jsx'
import EventoFilaNueva from '../components/eventos/EventoFilaNueva.jsx'
import CalendarioEventos from '../components/eventos/CalendarioEventos.jsx'
import { CREDITOS_FOTOS } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'
import { useDestacados } from '../lib/useDestacados.js'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import HeroDestacadosDesktop from '../components/destacados/HeroDestacadosDesktop.jsx'
import DialogoAvisos from '../components/eventos/DialogoAvisos.jsx'
import { prefsLocales } from '../lib/push.js'

// Agrupa eventos (ya ordenados asc. por fecha+hora) por día natural, en orden.
function agruparPorDia(eventos) {
  const grupos = []
  const indice = new Map()
  for (const e of eventos) {
    if (!indice.has(e.fecha)) {
      const g = { fecha: e.fecha, eventos: [] }
      indice.set(e.fecha, g)
      grupos.push(g)
    }
    indice.get(e.fecha).eventos.push(e)
  }
  return grupos
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function diaNumero(fecha) {
  return new Date(`${fecha}T00:00:00`).getDate()
}

// Cuántos eventos ya celebrados se muestran de entrada, y de cuántos en cuántos
// se amplía la lista al pulsar "Ver más".
const PASADOS_INICIALES = 12
const PASADOS_INCREMENTO = 24

// Rótulo que separa los meses dentro de la agenda. Las filas solo muestran el
// número de día, así que sin esto el salto del 31 al 1 parece un desorden.
function SeparadorMes({ fecha }) {
  const d = new Date(`${fecha}T00:00:00`)
  const etiqueta = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d)
  return (
    <div className="flex items-center gap-4 pt-2">
      <h3 className="font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota">
        {cap(etiqueta)}
      </h3>
      <div className="h-px flex-1 bg-filete" />
    </div>
  )
}

// "Lunes · Julio" para la cabecera de cada grupo de día.
function diaEtiqueta(fecha) {
  const d = new Date(`${fecha}T00:00:00`)
  const dia = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(d)
  const mes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d)
  return `${cap(dia)} · ${cap(mes)}`
}

export default function Eventos() {
  const [categoria, setCategoria] = useState(null)
  const [avisosAbierto, setAvisosAbierto] = useState(false)
  const [mesSeleccionado, setMesSeleccionado] = useState(() => new Date())
  // Solo para pintar el botón ("Recibir avisos" vs "Avisos activados"): la
  // copia local de las preferencias, no el estado real del servidor. La bandeja
  // de avisos vive en la cabecera global (CentroAvisos), no aquí.
  const [avisosActivos, setAvisosActivos] = useState(() => Boolean(prefsLocales()))
  // La agenda arrastra el histórico completo (la del Ayuntamiento se vuelca por
  // trimestres), así que "Eventos anteriores" se corta y se amplía a petición.
  const [pasadosVisibles, setPasadosVisibles] = useState(PASADOS_INICIALES)

  // Estáticos del JSON + los que las organizaciones han publicado desde /admin.
  const { eventos: todos } = useEventosPublicos()

  // Solo se ofrecen como filtro las categorías presentes (en próximos o pasados).
  const categoriasDisponibles = useMemo(() => {
    const presentes = new Set(todos.map((e) => e.categoria))
    return LISTA_CATEGORIAS_EVENTO.filter((c) => presentes.has(c.id))
  }, [todos])

  const porCategoria = (lista) =>
    categoria ? lista.filter((e) => e.categoria === categoria) : lista

  const futuros = useMemo(() => porCategoria(proximosEventos(todos)), [todos, categoria])
  const pasados = useMemo(() => porCategoria(eventosPasados(todos)), [todos, categoria])
  // Al cambiar de filtro se vuelve al corte inicial: si no, un filtro nuevo
  // heredaría la lista ya expandida del anterior.
  useEffect(() => setPasadosVisibles(PASADOS_INICIALES), [categoria])
  const grupos = useMemo(() => agruparPorDia(futuros), [futuros])

  // Eventos destacados contratados. El carrusel aparece encima de la agenda solo
  // en la vista sin filtrar; con un filtro activo (o sin destacados vigentes) se
  // oculta y la agenda por día ocupa su lugar.
  const { items: destacadosEvento } = useDestacados({ eventos: todos, tipo: 'evento' })
  const conCarrusel = categoria === null && destacadosEvento.length > 0

  return (
    <div className="flex flex-col">
      {/* Masthead - FULL WIDTH */}
      <header className="flex items-start justify-between gap-4 mb-6">
        <div className="gz-filete-doble flex-1 pb-3">
          <div className="gz-label text-mudo">Qué hacer en</div>
          <h1 className="font-serif-dm text-seccion leading-none text-tinta">La cartelera</h1>
        </div>
        {/* Opt-in de push */}
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

      {/* Destacados (contratados) - FULL WIDTH.
          Móvil: carrusel nativo con scroll-snap; escritorio: hero editorial
          con tarjetas grandes, cabecera y flechas (igual que Comercios). */}
      {conCarrusel && (
        <section className="mb-6 animate-rise">
          {/* Móvil */}
          <div className="md:hidden">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="gz-eyebrow">Destacados de la semana</span>
              <span className="font-mono-ibm text-[10px] tracking-etiqueta text-mudo">
                {String(Math.min(destacadosEvento.length, 3)).padStart(2, '0')} /{' '}
                {String(destacadosEvento.length).padStart(2, '0')}
              </span>
            </div>
            <CarruselDestacados items={destacadosEvento} columnas={3} seccion="eventos" />
          </div>

          {/* Escritorio */}
          <div className="hidden md:block">
            <HeroDestacadosDesktop
              items={destacadosEvento}
              eyebrow="Destacados de la semana"
              titulo="Lo que no te puedes perder"
              seccion="eventos"
            />
          </div>
        </section>
      )}

      {/* Cuerpo: agenda (izquierda) + calendario (lateral sticky) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Columna izquierda: filtros + lista de eventos */}
        <div className="flex flex-1 flex-col min-w-0">
        {/* Selector de categorías - DEBAJO de destacados */}
        {categoriasDisponibles.length > 0 && (
          <div className="hide-scrollbar mb-6 flex flex-wrap gap-2 py-1 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
                categoria === null ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
              }`}
            >
              Todos
            </button>
            {categoriasDisponibles.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoria(cat.id)}
                className={`flex-none whitespace-nowrap px-3 py-2 transition-colors ${
                  categoria === cat.id ? 'bg-tinta text-papel' : 'border border-tinta text-tinta hover:bg-papel-calido'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        )}

        {/* ----------------------------- Agenda por día ----------------------------- */}
        <div className="mb-6 h-px bg-tinta" />

        {futuros.length === 0 && (
          <p className="border border-dashed border-filete-punteado p-8 text-center font-serif-spectral text-pardo">
            No hay eventos próximos por ahora. Consulta más abajo el histórico de actividades.
          </p>
        )}

        {/* Lista de próximos eventos, con un rótulo cada vez que cambia el mes */}
        <div className="space-y-4">
          {futuros.map((e, i) => {
            const mes = e.fecha.slice(0, 7)
            const cambiaMes = i === 0 || futuros[i - 1].fecha.slice(0, 7) !== mes
            return (
              <Fragment key={e.id}>
                {cambiaMes && <SeparadorMes fecha={e.fecha} />}
                <EventoFilaNueva evento={e} />
              </Fragment>
            )
          })}
        </div>

        {/* Anteriores */}
        {pasados.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-4 mb-5">
              <div className="h-px flex-1 bg-filete" />
              <h2 className="flex items-center gap-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-mudo">
                <MIcon name="history" className="text-[16px]" />
                Eventos anteriores
              </h2>
              <div className="h-px flex-1 bg-filete" />
            </div>
            <div className="flex flex-col gap-3.5">
              {pasados.slice(0, pasadosVisibles).map((e) => (
                <EventoFila key={e.id} evento={e} pasado />
              ))}
            </div>
            {pasados.length > pasadosVisibles && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPasadosVisibles((n) => n + PASADOS_INCREMENTO)}
                  className="border border-tinta px-4 py-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-tinta hover:text-papel"
                >
                  Ver más ({pasados.length - pasadosVisibles})
                </button>
              </div>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="mt-10 flex flex-col items-center border border-tinta bg-papel-calido p-8 text-center">
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

        <p className="mt-6 text-center font-mono-ibm text-[9px] leading-relaxed text-mudo">
          Imágenes ilustrativas vía Wikimedia Commons: {CREDITOS_FOTOS.join(' · ')}
        </p>
      </div>

        {/* Columna derecha (lateral): Calendario sticky - solo en desktop */}
        <div className="hidden lg:block lg:w-72 lg:flex-shrink-0">
          <div className="lg:sticky lg:top-28">
            <CalendarioEventos
              eventos={futuros}
              mesSeleccionado={mesSeleccionado}
              onMesChange={setMesSeleccionado}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
