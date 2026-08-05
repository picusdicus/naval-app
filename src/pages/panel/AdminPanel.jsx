import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import DialogoConfirmacion from '../../components/admin/DialogoConfirmacion.jsx'
import DialogoSolicitudDestacado from '../../components/admin/DialogoSolicitudDestacado.jsx'
import DetalleDestacado from '../../components/admin/DetalleDestacado.jsx'
import DialogoInfoUsuario from '../../components/admin/DialogoInfoUsuario.jsx'
import AnaliticasOrganizacion from '../../components/admin/AnaliticasOrganizacion.jsx'
import DestacaNegocio from '../../components/admin/DestacaNegocio.jsx'
import AdminComercioForm from './AdminComercioForm.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { CATEGORIAS_EVENTO } from '../../lib/eventos.js'
import { campanaFinalizada, diasParaCaducar, textoCaducidad } from '../../lib/destacados.js'
import { hoyISO } from '../../lib/fechas.js'

const ESTADOS = {
  publicado: { etiqueta: 'Publicado', clases: 'bg-verde text-papel' },
  borrador: { etiqueta: 'Borrador', clases: 'bg-filete text-tinta-apagada' },
  archivado: { etiqueta: 'Archivado', clases: 'bg-terracota-fondo text-terracota' },
}

function formatearFecha(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(anio, mes - 1, dia))
}

function Estadistica({ icono, valor, etiqueta }) {
  // En móvil no caben icono y texto en la misma línea sin recortar la
  // etiqueta, así que se apilan; a partir de `sm` van en fila.
  return (
    <div className="gz-tarjeta-impresa flex flex-col items-start gap-2 p-3 sm:p-4">
      <MIcon name={icono} className="text-[18px] text-pardo" />
      <div className="min-w-0">
        <p className="font-serif-dm text-3xl leading-none text-terracota">{valor}</p>
        <p className="gz-label mt-1.5 text-pardo">{etiqueta}</p>
      </div>
    </div>
  )
}

function FilaEvento({ evento, destacado, ocupado, onCambiarEstado, onEliminar, onDestacar, onRetirarDestacado, onVerDestacado }) {
  const estado = ESTADOS[evento.estado] ?? ESTADOS.borrador
  const horario = evento.horaFin ? `${evento.hora} – ${evento.horaFin}` : evento.hora
  const publicado = evento.estado === 'publicado'
  // Solo tiene sentido destacar lo que ya está en la agenda y aún no ha pasado.
  const destacable = publicado && evento.fecha >= hoyISO() && !destacado

  return (
    <li className="gz-tarjeta-impresa p-4 sm:p-5">
      <div className="flex gap-4">
        {evento.imagen && (
          <img
            src={evento.imagen}
            alt=""
            className="h-14 w-14 flex-shrink-0 border border-filete object-cover sm:h-20 sm:w-20"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif-dm text-lg leading-tight text-tinta">{evento.titulo}</h3>
            <span className={`px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta ${estado.clases}`}>
              {estado.etiqueta}
            </span>
            {/* Los badges de destacado abren el detalle (fechas, tarifa…). */}
            {destacado?.estado === 'pendiente' && (
              <button
                type="button"
                onClick={() => onVerDestacado(destacado, evento.titulo)}
                title="Ver detalle del destacado"
                className="inline-flex items-center gap-1 bg-oro px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta transition-opacity hover:opacity-80"
              >
                <MIcon name="hourglass_top" className="text-[14px]" />
                Destacado solicitado
              </button>
            )}
            {/* Activo con la campaña terminada: que la org no crea que sigue en vigor. */}
            {campanaFinalizada(destacado) && (
              <button
                type="button"
                onClick={() => onVerDestacado(destacado, evento.titulo)}
                title="Ver detalle del destacado"
                className="inline-flex items-center gap-1 bg-filete px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-tinta-apagada transition-opacity hover:opacity-80"
              >
                <MIcon name="kid_star" className="text-[14px]" />
                Destacado finalizado
              </button>
            )}
            {destacado?.estado === 'activo' && !campanaFinalizada(destacado) && (
              <button
                type="button"
                onClick={() => onVerDestacado(destacado, evento.titulo)}
                title="Ver detalle del destacado"
                className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta transition-opacity hover:opacity-80 ${
                  diasParaCaducar(destacado) !== null
                    ? 'bg-tinta text-oro'
                    : 'bg-tinta text-oro'
                }`}
              >
                <MIcon name="kid_star" className="text-[14px]" fill />
                {diasParaCaducar(destacado) !== null
                  ? `Destacado · ${textoCaducidad(diasParaCaducar(destacado))}`
                  : 'Destacado'}
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-pardo">
            <span className="inline-flex items-center gap-1">
              <MIcon name="calendar_today" className="text-[16px]" />
              {formatearFecha(evento.fecha)}
              {horario ? ` · ${horario}` : ''}
            </span>
            {evento.lugar && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="place" className="text-[16px]" />
                {evento.lugar}
              </span>
            )}
            {CATEGORIAS_EVENTO[evento.categoria] && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="sell" className="text-[16px]" />
                {CATEGORIAS_EVENTO[evento.categoria].nombre}
              </span>
            )}
            {evento.entradasUrl && (
              <span className="inline-flex items-center gap-1">
                <MIcon name="local_activity" className="text-[16px]" />
                {evento.precio || 'Con entradas'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones: en móvil ocupan el ancho completo bajo los datos. */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-filete pt-3">
        <Link
          to={`/panel/eventos/${evento.id}/editar`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido sm:flex-none"
        >
          <MIcon name="edit" className="text-[16px]" />
          Editar
        </Link>

        <button
          type="button"
          disabled={ocupado}
          onClick={() => onCambiarEstado(evento, publicado ? 'borrador' : 'publicado')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:enabled:bg-papel-calido disabled:opacity-50 sm:flex-none"
        >
          <MIcon name={publicado ? 'visibility_off' : 'publish'} className="text-[16px]" />
          {publicado ? 'Pasar a borrador' : 'Publicar'}
        </button>

        {destacable && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onDestacar(evento)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:enabled:bg-papel-calido disabled:opacity-50 sm:flex-none"
          >
            <MIcon name="star" className="text-[16px]" />
            Destacar
          </button>
        )}

        {destacado?.estado === 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onRetirarDestacado(destacado)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:enabled:bg-papel-calido disabled:opacity-50 sm:flex-none"
          >
            <MIcon name="star_half" className="text-[16px]" />
            Retirar solicitud
          </button>
        )}

        <button
          type="button"
          disabled={ocupado}
          onClick={() => onEliminar(evento)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border border-terracota-palido px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-colors hover:enabled:bg-terracota-fondo disabled:opacity-50 sm:flex-none"
        >
          <MIcon name="delete" className="text-[16px]" />
          Eliminar
        </button>
      </div>
    </li>
  )
}

export default function AdminPanel() {
  const { usuario, cerrarSesion } = useAdminAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [porEliminar, setPorEliminar] = useState(null)
  const [porDestacar, setPorDestacar] = useState(null) // evento cuya solicitud se está proponiendo
  const [detalleDestacado, setDetalleDestacado] = useState(null) // { destacado, titulo } abierto en el modal
  const [pestana, setPestana] = useState('eventos')
  const [dialogoInfoAbierto, setDialogoInfoAbierto] = useState(false)

  // Estado de las solicitudes de destacado y el negocio vinculado (si lo hay).
  const [destacadosOrg, setDestacadosOrg] = useState([])
  const [comercioId, setComercioId] = useState(null)

  // Tras cada cambio se recarga la lista: las métricas salen del mismo
  // cálculo que hace Neon, sin llevar una cuenta paralela en el cliente.
  const cargar = useCallback(async () => {
    const [respuesta, respuestaDestacados] = await Promise.all([
      fetch('/api/admin/eventos'),
      fetch('/api/admin/destacados'),
    ])
    if (respuesta.status === 401) return cerrarSesion()

    const cuerpo = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudieron cargar los eventos.')
    setDatos(cuerpo)

    // Los destacados son complementarios: si fallan, el panel sigue operativo
    // (sin botón "Destacar"), no se rompe la gestión de eventos.
    const cuerpoDestacados = await respuestaDestacados.json().catch(() => ({}))
    if (respuestaDestacados.ok) {
      setDestacadosOrg(cuerpoDestacados.destacados ?? [])
      setComercioId(cuerpoDestacados.comercioId ?? null)
    }
  }, [cerrarSesion])

  useEffect(() => {
    let vigente = true

    cargar()
      .catch((err) => {
        if (vigente) setError(err.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [cargar])

  const conRecarga = async (peticion) => {
    setOcupado(true)
    setError('')
    try {
      const respuesta = await peticion()
      if (respuesta.status === 401) return cerrarSesion()

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}))
        throw new Error(cuerpo.error || 'La acción no se pudo completar.')
      }
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
    }
  }

  const cambiarEstado = (evento, estado) =>
    conRecarga(() =>
      fetch(`/api/admin/eventos?id=${encodeURIComponent(evento.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
    )

  const confirmarBorrado = async () => {
    const evento = porEliminar
    await conRecarga(() =>
      fetch(`/api/admin/eventos?id=${encodeURIComponent(evento.id)}`, { method: 'DELETE' })
    )
    setPorEliminar(null)
  }

  // La propuesta {fechaInicio, duracionDias} sale del diálogo (eventos) o de
  // los campos de DestacaNegocio (comercio); fecha_fin la calcula el servidor.
  const solicitarDestacadoEvento = async (evento, propuesta) => {
    await conRecarga(() =>
      fetch('/api/admin/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'evento', eventoId: evento.id, ...propuesta }),
      })
    )
    setPorDestacar(null)
  }

  const solicitarDestacadoComercio = (imagenUrl, propuesta) =>
    conRecarga(() =>
      fetch('/api/admin/destacados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'comercio', imagenUrl, ...propuesta }),
      })
    )

  const retirarSolicitud = (destacado) =>
    conRecarga(() =>
      fetch(`/api/admin/destacados?id=${encodeURIComponent(destacado.id)}`, { method: 'DELETE' })
    )

  // Una solicitud rechazada (cancelado) se trata como inexistente: la
  // organización simplemente vuelve a ver el botón "Destacar".
  const destacadoDeEvento = (evento) =>
    destacadosOrg.find(
      (d) => d.tipo === 'evento' && d.referenciaId === `bd-${evento.id}` && d.estado !== 'cancelado'
    ) ?? null

  const destacadoComercio =
    destacadosOrg.find((d) => d.tipo === 'comercio' && d.estado !== 'cancelado') ?? null

  const handleCambiarPassword = async (credenciales) => {
    setOcupado(true)

    try {
      const respuesta = await fetch('/api/admin/cambiar-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciales),
      })

      const datos = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        const error = new Error(datos.error || 'No se pudo cambiar la contraseña.')
        throw error
      }
    } finally {
      setOcupado(false)
    }
  }

  const resumen = datos?.resumen
  const eventos = datos?.eventos ?? []

  return (
    <div className="min-h-screen bg-papel-lienzo pb-16">
      <div className="h-2 bg-tinta-intensa" />
      <header className="border-b border-filete bg-papel">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-verde-salvia font-serif-dm text-lg text-papel">
            {(datos?.organizacion?.nombre ?? 'P').charAt(0)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-serif-dm text-lg leading-tight text-tinta">
              {datos?.organizacion?.nombre ?? 'Panel de gestión'}
            </p>
            <p className="truncate font-mono-ibm text-[10px] text-mudo">{usuario?.email}</p>
          </div>

          <button
            type="button"
            onClick={() => setDialogoInfoAbierto(true)}
            className="inline-flex flex-shrink-0 items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido sm:px-4"
            title="Información de usuario"
          >
            <MIcon name="account_circle" className="text-[16px]" />
            <span className="hidden sm:inline">Usuario</span>
          </button>

          <Link
            to="/"
            className="inline-flex flex-shrink-0 items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido sm:px-4"
            title="Volver a la app pública"
          >
            <MIcon name="home" className="text-[16px]" />
            <span className="hidden sm:inline">Volver a la app</span>
          </Link>

          <button
            type="button"
            onClick={cerrarSesion}
            className="inline-flex flex-shrink-0 items-center gap-2 border border-tinta px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido sm:px-4"
          >
            <MIcon name="logout" className="text-[16px]" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Pestañas: eventos, comercio (si vinculado), analíticas. */}
        <div className="mb-6 flex gap-2 font-mono-ibm text-[11px] uppercase tracking-etiqueta sm:w-fit">
          {[
            ['eventos', 'event', 'Mis eventos'],
            ['comercio', 'storefront', 'Mi comercio'],
            ['analiticas', 'monitoring', 'Mis analíticas'],
          ].map(([clave, icono, etiqueta]) => (
            <button
              key={clave}
              type="button"
              onClick={() => setPestana(clave)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 transition-colors sm:flex-none ${
                pestana === clave
                  ? 'bg-tinta text-papel'
                  : 'border border-filete text-pardo hover:text-tinta'
              }`}
            >
              <MIcon name={icono} className="text-[15px]" />
              {etiqueta}
            </button>
          ))}
        </div>

        {pestana === 'analiticas' && <AnaliticasOrganizacion onNoAutenticado={cerrarSesion} />}

        <div className={pestana === 'comercio' ? '' : 'hidden'}>
          <h1 className="mb-6 font-serif-dm text-seccion-sm text-tinta">Mi comercio</h1>
          <AdminComercioForm />
        </div>

        <div className={pestana === 'eventos' ? '' : 'hidden'}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif-dm text-seccion-sm text-tinta">Tus eventos</h1>

          <Link to="/panel/eventos/nuevo" className="gz-boton-tinta inline-flex items-center gap-2">
            <MIcon name="add" className="text-[16px]" />
            Nuevo evento
          </Link>
        </div>

        {cargando && <p className="font-serif-spectral text-sm text-pardo">Cargando eventos…</p>}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-4"
          >
            <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
            <p className="font-serif-spectral text-sm font-medium text-terracota">{error}</p>
          </div>
        )}

        {resumen && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Estadistica icono="visibility" valor={resumen.publicados} etiqueta="Publicados" />
              <Estadistica icono="draft" valor={resumen.borradores} etiqueta="Borradores" />
              <Estadistica icono="upcoming" valor={resumen.proximos} etiqueta="Próximos" />
              <Estadistica icono="history" valor={resumen.pasados} etiqueta="Pasados" />
            </div>

            {comercioId && (
              <DestacaNegocio
                comercioId={comercioId}
                destacado={destacadoComercio}
                ocupado={ocupado}
                onSolicitar={solicitarDestacadoComercio}
                onRetirar={retirarSolicitud}
                onVerDetalle={(destacado, titulo) => setDetalleDestacado({ destacado, titulo })}
              />
            )}

            {eventos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 border border-dashed border-filete-punteado px-6 py-12 text-center">
                <MIcon name="event_busy" className="text-[40px] text-mudo" />
                <p className="font-serif-dm text-lg text-tinta">Todavía no tienes eventos</p>
                <p className="max-w-sm font-serif-spectral text-sm text-pardo">
                  Crea el primero: los borradores solo los ves tú, y los publicados aparecen en la
                  agenda del municipio.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {eventos.map((evento) => (
                  <FilaEvento
                    key={evento.id}
                    evento={evento}
                    destacado={destacadoDeEvento(evento)}
                    ocupado={ocupado}
                    onCambiarEstado={cambiarEstado}
                    onEliminar={setPorEliminar}
                    onDestacar={setPorDestacar}
                    onRetirarDestacado={retirarSolicitud}
                    onVerDestacado={(destacado, titulo) => setDetalleDestacado({ destacado, titulo })}
                  />
                ))}
              </ul>
            )}
          </>
        )}
        </div>
      </main>

      <DialogoConfirmacion
        abierto={Boolean(porEliminar)}
        titulo="¿Eliminar este evento?"
        mensaje={
          porEliminar
            ? `«${porEliminar.titulo}» se borrará definitivamente. Esta acción no se puede deshacer.`
            : ''
        }
        ocupado={ocupado}
        onConfirmar={confirmarBorrado}
        onCancelar={() => setPorEliminar(null)}
      />

      <DialogoSolicitudDestacado
        abierto={Boolean(porDestacar)}
        titulo={porDestacar ? `«${porDestacar.titulo}»` : ''}
        ocupado={ocupado}
        onConfirmar={(propuesta) => solicitarDestacadoEvento(porDestacar, propuesta)}
        onCancelar={() => setPorDestacar(null)}
      />

      <DetalleDestacado
        destacado={detalleDestacado?.destacado ?? null}
        titulo={detalleDestacado?.titulo ?? ''}
        onCerrar={() => setDetalleDestacado(null)}
      />

      <DialogoInfoUsuario
        abierto={dialogoInfoAbierto}
        usuario={usuario}
        ocupado={ocupado}
        onCambiarPassword={handleCambiarPassword}
        onCerrar={() => setDialogoInfoAbierto(false)}
      />
    </div>
  )
}
