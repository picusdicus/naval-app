/**
 * Contenido de la sección "Resumen" de /admin: lo primero que ve el superadmin
 * al entrar. Tres bloques, en orden de urgencia decreciente — lo que hay que
 * despachar hoy, el estado general del municipio en cifras, y qué ha pasado
 * últimamente.
 *
 * Casi todo sale de GET /api/super/resumen (una sola llamada). La excepción es
 * la tarjeta de visitas: esas cifras son de Umami, no de Neon, y ya tienen su
 * propio proxy — se piden aparte para que un Umami lento o caído no retrase ni
 * tumbe el resto del resumen, que ya está pintado.
 *
 * Regla que atraviesa todo el componente: ningún dato se inventa. Un campo que
 * la API no pudo calcular vale null y aquí se omite o se pinta "—", nunca un 0
 * que se leería como "no hay nada pendiente".
 */
import { useEffect, useState } from 'react'
import MIcon from '../../MIcon.jsx'
import { Sparkline, StatCard } from '../UmamiStats.jsx'
import { COMERCIOS_POR_ID, campanaFinalizada, porcentajeTranscurrido } from '../../../lib/destacados.js'
import { diasHasta } from '../../../lib/fechas.js'
import { formatearFechaCorta } from '../../../lib/eventos.js'

const ETIQUETA_TIPO_DESTACADO = { evento: 'EVENTO', comercio: 'COMERCIO', taller: 'TALLER' }
const ICONO_TIPO_DESTACADO = { evento: 'event', comercio: 'storefront', taller: 'school' }

/** Saludo por la hora local de quien mira, no la del servidor. */
function saludoDeAhora(hora) {
  if (hora < 6) return 'Buenas noches'
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** "lunes, 7 de septiembre" en mayúsculas, para el filete del saludo. */
function fechaLargaDeHoy(ahora) {
  const mesesLargos = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${DIAS[ahora.getDay()]}, ${ahora.getDate()} de ${mesesLargos[ahora.getMonth()]}`
}

/** Días naturales transcurridos desde un instante ISO; null si no hay fecha. */
function diasDesde(iso) {
  if (!iso) return null
  const cuando = new Date(iso)
  if (Number.isNaN(cuando.getTime())) return null
  const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  // Se comparan días naturales, no horas: "lleva 1 día esperando" debe cambiar
  // al pasar la medianoche, no al cumplirse 24 h exactas.
  return Math.round((inicioDelDia(new Date()) - inicioDelDia(cuando)) / 86_400_000)
}

/** "HOY 10:03" si es de hoy, "31 AGO" si no. Cadena vacía si la fecha no vale. */
function selloDeFecha(iso) {
  if (!iso) return ''
  const cuando = new Date(iso)
  if (Number.isNaN(cuando.getTime())) return ''
  if (diasDesde(iso) === 0) {
    const hh = String(cuando.getHours()).padStart(2, '0')
    const mm = String(cuando.getMinutes()).padStart(2, '0')
    return `HOY ${hh}:${mm}`
  }
  return `${cuando.getDate()} ${MESES[cuando.getMonth()]}`
}

/** Texto de contexto de una tarjeta de atención a partir de la más antigua. */
function textoEspera(masAntiguaDesde) {
  const dias = diasDesde(masAntiguaDesde)
  if (dias === null) return 'Sin fecha de entrada registrada.'
  if (dias <= 0) return 'Han llegado hoy.'
  if (dias === 1) return 'La más antigua lleva 1 día esperando.'
  return `La más antigua lleva ${dias} días esperando.`
}

// El punto de color de cada suceso. La reclamación se parte en dos porque
// aprobar y rechazar no son la misma noticia; el matiz viaja en el texto que
// compone la API (no hay campo aparte, la fila es {tipo, texto, fecha}).
function colorDeSuceso(suceso) {
  if (suceso.tipo === 'reclamacion') {
    return suceso.texto.includes('aprobada') ? 'bg-verde' : 'bg-terracota'
  }
  if (suceso.tipo === 'alta') return 'bg-terracota'
  if (suceso.tipo === 'codigo') return 'bg-ocre'
  if (suceso.tipo === 'sincronizacion') return 'bg-azul'
  return 'bg-mudo'
}

/**
 * Nombre a pintar de un destacado. La API resuelve los que viven en Neon
 * (eventos de la base y talleres); un comercio sale de los JSON del directorio
 * que el navegador ya tiene, y lo que no está en ninguno de los dos (un evento
 * de fuente estática, un comercio retirado del directorio) se queda en su id:
 * feo, pero identifica la fila — dejarla sin nombre la haría inservible.
 */
function nombreDeDestacado(destacado) {
  if (destacado.nombreResuelto) return { texto: destacado.nombreResuelto, resuelto: true }
  const comercio = COMERCIOS_POR_ID.get(destacado.referenciaId)
  if (comercio?.nombre) return { texto: comercio.nombre, resuelto: true }
  return { texto: destacado.referenciaId, resuelto: false }
}

/** Una fila de "Destacados en curso": miniatura, quién lo contrató y su plazo. */
function FilaDestacado({ destacado }) {
  const { texto, resuelto } = nombreDeDestacado(destacado)
  const finalizada = campanaFinalizada(destacado)
  // Sin fecha de fin (filas antiguas que nunca se editaron) no hay plazo que
  // pintar: se dice, en vez de inventar una barra.
  const conPlazo = Boolean(destacado.fechaInicio && destacado.fechaFin)
  const porcentaje = conPlazo ? porcentajeTranscurrido(destacado.fechaInicio, destacado.fechaFin) : 0
  const dias = conPlazo ? diasHasta(destacado.fechaFin) : null

  return (
    <li className="flex items-center gap-3 py-3">
      {destacado.imagenUrl ? (
        <img src={destacado.imagenUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-papel-calido">
          <MIcon
            name={ICONO_TIPO_DESTACADO[destacado.tipo] || 'storefront'}
            className="text-[20px] text-pardo"
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-tinta ${resuelto ? 'font-serif-spectral text-sm' : 'font-mono-ibm text-xs text-pardo'}`}
          title={texto}
        >
          {texto}
        </p>
        <p className="truncate font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          {ETIQUETA_TIPO_DESTACADO[destacado.tipo] || 'DESTACADO'}
          {' · '}
          {destacado.organizacionNombre ? destacado.organizacionNombre.toUpperCase() : 'SIN CONTRATANTE'}
        </p>
        {conPlazo ? (
          <>
            <div className="mt-1.5 h-1.5 overflow-hidden bg-filete/60">
              <div
                className={`h-full ${finalizada ? 'bg-terracota' : 'bg-verde'}`}
                style={{ width: `${finalizada ? 100 : porcentaje}%` }}
              />
            </div>
            <p
              className={`mt-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${finalizada ? 'text-terracota' : 'text-pardo'}`}
            >
              {finalizada
                ? `Fuera de plazo · ${formatearFechaCorta(destacado.fechaFin)}`
                : `Quedan ${dias} ${dias === 1 ? 'día' : 'días'}`}
            </p>
          </>
        ) : (
          <p className="mt-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
            Sin fecha de fin
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Visitas de los últimos 30 días. Componente aparte con su propio fetch porque
 * es la única cifra que no viene de /api/super/resumen: así el resto se pinta
 * sin esperar a Umami, y un Umami caído solo deja esta tarjeta en "—".
 */
function TarjetaVisitas() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/analytics/umami-stats?period=30d')
      .then((res) => (res.ok ? res.json() : null))
      .then((cuerpo) => vivo && setDatos(cuerpo))
      .catch(() => vivo && setDatos(null))
    return () => {
      vivo = false
    }
  }, [])

  // `visits` (sesiones) y no `pageviews`: la tarjeta se llama "Visitas", y una
  // visita es una sesión, no cada página que esa sesión abrió.
  const visitas = datos?.summary?.visits?.value
  const serie = datos?.pageviews?.pageviews ?? []

  return (
    <StatCard
      label="Visitas 30 días"
      value={visitas === undefined || visitas === null ? '—' : visitas.toLocaleString('es-ES')}
      sub={
        <>
          {serie.length > 1 && <Sparkline data={serie} height={28} />}
          <span>sesiones · páginas vistas por día</span>
        </>
      }
      icon="📈"
    />
  )
}

/** Una de las tarjetas de "Requiere tu atención". */
function TarjetaAtencion({ borde, cantidad, asunto, contexto, accion, onIr }) {
  return (
    <div className={`border border-tinta bg-papel p-4 ${borde}`}>
      <p className="font-serif-dm text-4xl leading-none text-tinta">{cantidad}</p>
      <p className="mt-2 font-serif-spectral text-sm text-tinta">{asunto}</p>
      <p className="mt-1 font-mono-ibm text-[10px] text-pardo">{contexto}</p>
      <button
        type="button"
        onClick={onIr}
        className="mt-3 inline-flex items-center gap-1 border border-tinta px-3 py-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido"
      >
        {accion}
        <MIcon name="arrow_forward" className="text-[14px]" />
      </button>
    </div>
  )
}

export default function ResumenSuperAdmin({ resumen, usuario, onCambiarSeccion }) {
  // `resumen` null = todavía cargando (la petición la lanza el panel al montar).
  if (!resumen) {
    return (
      <p className="font-serif-spectral text-sm text-pardo">Cargando el resumen…</p>
    )
  }

  const ahora = new Date()
  const atencion = resumen.atencion || {}
  const hayAtencion = Boolean(atencion.reclamaciones || atencion.altas || atencion.destacados)
  const actividad = resumen.actividad || []
  const destacadosEnCurso = resumen.destacadosEnCurso || []

  // "—" y no 0: si la consulta de ese contador falló, no sabemos cuántos hay.
  const cifra = (n) => (n === null || n === undefined ? '—' : n)
  const todasActivas =
    resumen.organizacionesActivas !== null &&
    resumen.organizacionesActivas === resumen.organizacionesTotal

  return (
    <div className="space-y-8">
      {/* Saludo */}
      <div>
        <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          {fechaLargaDeHoy(ahora)}
        </p>
        <h2 className="mt-1 font-serif-dm text-seccion text-tinta">
          {saludoDeAhora(ahora.getHours())}
          {usuario?.nombre ? `, ${usuario.nombre}` : ''}
        </h2>
      </div>

      {/* Requiere tu atención */}
      <section>
        <h3 className="border-b border-filete pb-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota">
          Requiere tu atención
        </h3>

        {hayAtencion ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {atencion.reclamaciones && (
              <TarjetaAtencion
                borde="border-t-4 border-t-terracota"
                cantidad={atencion.reclamaciones.cantidad}
                asunto="Reclamaciones de comercio sin revisar"
                contexto={textoEspera(atencion.reclamaciones.masAntiguaDesde)}
                accion="Revisar"
                onIr={() => onCambiarSeccion('reclamaciones')}
              />
            )}
            {atencion.altas && (
              <TarjetaAtencion
                borde="border-t-4 border-t-ocre"
                cantidad={atencion.altas.cantidad}
                asunto="Altas de negocio pendientes"
                contexto={textoEspera(atencion.altas.masAntiguaDesde)}
                accion="Revisar"
                onIr={() => onCambiarSeccion('altas')}
              />
            )}
            {atencion.destacados && (
              <TarjetaAtencion
                borde="border-t-4 border-t-terracota"
                cantidad={atencion.destacados.cantidad}
                asunto="Destacados que requieren acción"
                contexto="Sin aprobar, o siguen activos con la vigencia caducada."
                accion="Gestionar"
                onIr={() => onCambiarSeccion('destacados')}
              />
            )}
          </div>
        ) : (
          // Un solo bloque, no tres huecos: la ausencia de cola es una noticia
          // en sí, no tres tarjetas vacías.
          <div className="mt-4 flex items-center gap-3 border border-verde bg-papel p-4">
            <MIcon name="check_circle" className="text-[20px] text-verde" />
            <div>
              <p className="font-serif-spectral text-sm text-tinta">Todo al día</p>
              <p className="font-mono-ibm text-[10px] text-pardo">
                No hay solicitudes ni destacados esperando revisión.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Cifras */}
      <section>
        <h3 className="border-b border-filete pb-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          El municipio en cifras
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Organizaciones"
            value={cifra(resumen.organizacionesActivas)}
            // "todas activas" en verde: es la única de las tres cifras que
            // además dice que no hay nada desactivado esperando atención.
            sub={
              todasActivas ? (
                <span className="text-verde">todas activas</span>
              ) : (
                `de ${cifra(resumen.organizacionesTotal)} registradas`
              )
            }
            icon="🏛️"
          />
          <StatCard
            label="Eventos publicados"
            value={cifra(resumen.eventosPublicados)}
            sub={`de ${cifra(resumen.eventosTotal)} en la base`}
            icon="🗓️"
          />
          <StatCard
            label="Usuarios"
            value={cifra(resumen.usuariosTotal)}
            sub={`${cifra(resumen.usuariosAdmin)} con rol admin`}
            icon="👥"
          />
          <TarjetaVisitas />
        </div>
      </section>

      {/* Última actividad y destacados en curso: dos lecturas del mismo "qué
          está pasando", una por el lado del historial y otra por el del plazo
          que corre. Apiladas en móvil.

          min-w-0 en las dos: por defecto una celda de grid no encoge por
          debajo de su contenido, y un id largo sin resolver (el texto de
          último recurso de una referencia que no se pudo nombrar) ensanchaba
          la columna y sacaba scroll horizontal a la página entera. */}
      <div className="grid gap-8 lg:grid-cols-2">
      <section className="min-w-0">
        <h3 className="border-b border-filete pb-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          Última actividad
        </h3>
        {actividad.length > 0 ? (
          <ul className="mt-2 divide-y divide-filete">
            {actividad.map((suceso, i) => (
              <li key={`${suceso.tipo}-${suceso.fecha}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${colorDeSuceso(suceso)}`} />
                <span className="min-w-0 flex-1 truncate font-serif-spectral text-sm text-tinta">
                  {suceso.texto}
                </span>
                <span className="shrink-0 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                  {selloDeFecha(suceso.fecha)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 font-serif-spectral text-sm text-pardo">
            Sin actividad reciente todavía.
          </p>
        )}
      </section>

      <section className="min-w-0">
        <h3 className="border-b border-filete pb-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
          Destacados en curso
        </h3>
        {destacadosEnCurso.length > 0 ? (
          <ul className="mt-2 divide-y divide-filete">
            {destacadosEnCurso.map((d) => (
              <FilaDestacado key={d.id} destacado={d} />
            ))}
          </ul>
        ) : (
          // Vale también cuando la consulta falló (destacadosEnCurso null): sin
          // lista no se pinta media columna con huecos, se dice que no hay.
          <p className="mt-3 font-serif-spectral text-sm text-pardo">
            No hay destacados activos ahora mismo.
          </p>
        )}
      </section>
      </div>
    </div>
  )
}
