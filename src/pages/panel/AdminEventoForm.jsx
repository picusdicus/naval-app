import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import CampoFormulario from '../../components/admin/CampoFormulario.jsx'
import SelectorImagen from '../../components/admin/SelectorImagen.jsx'
import { CATEGORIAS_EVENTO } from '../../lib/eventos.js'
import { VALORES_INICIALES, LIMITES, validarEvento } from '../../lib/eventoForm.js'

/** Los campos que faltan en la respuesta llegan como null; el <input> quiere ''. */
function aValoresDelFormulario(evento) {
  const valores = { ...VALORES_INICIALES }
  for (const campo of Object.keys(VALORES_INICIALES)) {
    if (evento[campo] != null) valores[campo] = evento[campo]
  }
  return valores
}

/**
 * Alta y edición comparten formulario: con `:id` en la ruta se prerrellena con
 * el evento existente y se guarda con PUT; sin él, se crea con POST.
 */
export default function AdminEventoForm() {
  const navegar = useNavigate()
  const { id } = useParams()
  const editando = Boolean(id)

  const [valores, setValores] = useState(VALORES_INICIALES)
  // Ciclo: evento que se repite a diario entre dos fechas. Solo controla la
  // UI — el servidor decide por la presencia de fechaFin en el cuerpo.
  const [ciclo, setCiclo] = useState(false)
  const [organizacion, setOrganizacion] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)

  // Siempre hace falta el perfil de la organización (fija categoría y lugar);
  // al editar, además, el evento que se está modificando.
  useEffect(() => {
    let vigente = true

    const pedir = async (url) => {
      const respuesta = await fetch(url)
      if (respuesta.status === 401) {
        navegar('/login', { replace: true })
        return null
      }
      const cuerpo = await respuesta.json().catch(() => ({}))
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudieron cargar los datos.')
      return cuerpo
    }

    Promise.all([
      pedir('/api/admin/organizacion'),
      editando ? pedir(`/api/admin/eventos?id=${encodeURIComponent(id)}`) : null,
    ])
      .then(([perfil, evento]) => {
        if (!vigente || !perfil) return

        setOrganizacion(perfil.organizacion)
        const base = evento ? aValoresDelFormulario(evento.evento) : VALORES_INICIALES

        // El perfil manda: si la organización cambió de sala, el evento antiguo
        // se guarda con la nueva. El servidor impone lo mismo al recibirlo.
        setValores({
          ...base,
          categoria: perfil.organizacion.categoriaDefecto ?? base.categoria,
          lugar: perfil.organizacion.lugarDefecto ?? base.lugar,
        })
      })
      .catch((err) => {
        if (vigente) setErrorGeneral(err.message)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [editando, id, navegar])

  const cambiar = (campo) => (evento) => {
    const valor = evento?.target ? evento.target.value : evento
    setValores((previos) => ({ ...previos, [campo]: valor }))
    // Al corregir un campo, su error desaparece sin esperar a reenviar.
    setErrores(({ [campo]: _, ...resto }) => resto)
    setErrorGeneral('')
  }

  const guardar = async (estado) => {
    // Con la casilla desmarcada, la fecha de fin nunca viaja (evento normal).
    const candidato = { ...valores, fechaFin: ciclo ? valores.fechaFin : '', estado }

    const encontrados = validarEvento(candidato)
    if (ciclo && !candidato.fechaFin && !encontrados.fechaFin) {
      encontrados.fechaFin = 'Indica la fecha de fin del ciclo.'
    }
    if (Object.keys(encontrados).length > 0) {
      setErrores(encontrados)
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }

    setEnviando(true)
    setErrorGeneral('')
    try {
      const url = editando ? `/api/admin/eventos?id=${encodeURIComponent(id)}` : '/api/admin/eventos'
      const respuesta = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidato),
      })
      const cuerpo = await respuesta.json().catch(() => ({}))

      if (respuesta.status === 401) {
        navegar('/login', { replace: true })
        return
      }
      if (!respuesta.ok) {
        // El servidor revalida: si discrepa del cliente, mandan sus errores.
        if (cuerpo.errores) setErrores(cuerpo.errores)
        throw new Error(cuerpo.error || 'No se pudo guardar el evento.')
      }

      navegar('/panel', { replace: true })
    } catch (err) {
      setErrorGeneral(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const ayudaDelPerfil = organizacion
    ? `Definido en el perfil de ${organizacion.nombre}.`
    : 'Definido en el perfil de tu organización.'

  // Categoría y lugar son de solo lectura para el gestor: si el superadmin
  // aún no los asignó al perfil, marcar los campos en rojo solo confunde —
  // hay que decir claramente que la pelota está en el tejado del equipo.
  const perfilIncompleto =
    Boolean(organizacion) && (!organizacion.categoriaDefecto || !organizacion.lugarDefecto)

  // Al crear, el botón secundario guarda un borrador. Al editar, lleva el
  // evento al estado contrario del que tiene ahora.
  const esBorrador = valores.estado === 'borrador'
  const accionSecundaria = !editando
    ? { estado: 'borrador', icono: 'draft', etiqueta: 'Guardar como borrador' }
    : esBorrador
      ? { estado: 'publicado', icono: 'publish', etiqueta: 'Guardar y publicar' }
      : { estado: 'borrador', icono: 'draft', etiqueta: 'Pasar a borrador' }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-papel-lienzo">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-filete border-t-terracota"
          role="status"
          aria-label="Cargando evento"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-papel-lienzo pb-16">
      <div className="h-2 bg-tinta-intensa" />
      <header className="border-b border-filete bg-papel">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/panel"
            className="inline-flex items-center gap-1 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
          >
            <MIcon name="arrow_back" className="text-[16px]" />
            <span className="hidden sm:inline">Volver al panel</span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center font-serif-dm text-xl text-tinta sm:text-left">
            {editando ? 'Editar evento' : 'Nuevo evento'}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            guardar(editando ? valores.estado : 'publicado')
          }}
          className="space-y-6"
        >
          <section className="gz-tarjeta-impresa space-y-5 p-5 sm:p-6">
            <CampoFormulario id="titulo" etiqueta="Título" error={errores.titulo}>
              {(props) => (
                <input
                  {...props}
                  id="titulo"
                  type="text"
                  maxLength={LIMITES.titulo}
                  value={valores.titulo}
                  onChange={cambiar('titulo')}
                  placeholder="El sueño de una noche de verano"
                />
              )}
            </CampoFormulario>

            <CampoFormulario id="descripcion" etiqueta="Descripción" error={errores.descripcion}>
              {(props) => (
                <textarea
                  {...props}
                  id="descripcion"
                  rows={5}
                  maxLength={LIMITES.descripcion}
                  value={valores.descripcion}
                  onChange={cambiar('descripcion')}
                  placeholder="Cuenta de qué va el evento, a quién va dirigido y qué se van a encontrar los vecinos."
                />
              )}
            </CampoFormulario>

            {/* Categoría y lugar salen del perfil de la organización: se
                muestran para que el gestor sepa cómo se publicará el evento,
                pero no se editan aquí (y el servidor los impone igualmente). */}
            {perfilIncompleto && (
              <div
                role="alert"
                className="flex items-start gap-2 border border-ocre/40 bg-oro/15 p-4"
              >
                <MIcon name="info" className="mt-0.5 flex-shrink-0 text-[20px] text-ocre" />
                <p className="font-serif-spectral text-sm font-medium text-tinta">
                  El perfil de tu organización aún no tiene asignados la categoría y el lugar de
                  publicación — los configura el equipo de la app. Hasta entonces no podrás guardar
                  eventos: contacta con nosotros para completarlo.
                </p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <CampoFormulario
                id="categoria"
                etiqueta="Categoría"
                error={errores.categoria}
                ayuda={ayudaDelPerfil}
                soloLectura
              >
                {(props) => (
                  <input
                    {...props}
                    id="categoria"
                    type="text"
                    readOnly
                    value={CATEGORIAS_EVENTO[valores.categoria]?.nombre ?? valores.categoria}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario
                id="lugar"
                etiqueta="Lugar"
                error={errores.lugar}
                ayuda={ayudaDelPerfil}
                soloLectura
              >
                {(props) => <input {...props} id="lugar" type="text" readOnly value={valores.lugar} />}
              </CampoFormulario>
            </div>

            <label className="flex items-start gap-2.5 font-serif-spectral text-sm text-tinta">
              <input
                type="checkbox"
                checked={ciclo}
                onChange={(e) => {
                  setCiclo(e.target.checked)
                  if (!e.target.checked) {
                    setValores((previos) => ({ ...previos, fechaFin: '' }))
                    setErrores(({ fechaFin: _, ...resto }) => resto)
                  }
                }}
                className="mt-0.5 h-4 w-4 accent-terracota"
              />
              <span>
                Este evento es un ciclo (se repite varios días)
                <span className="block font-serif-spectral text-[12.5px] text-pardo">
                  Se creará una copia independiente del evento por cada día, de la fecha de inicio
                  a la de fin (ambas incluidas). Luego podrás editar o borrar cada día por separado.
                </span>
              </span>
            </label>

            <div className={`grid gap-5 ${ciclo ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              <CampoFormulario
                id="fecha"
                etiqueta={ciclo ? 'Fecha de inicio' : 'Fecha'}
                error={errores.fecha}
              >
                {(props) => (
                  <input
                    {...props}
                    id="fecha"
                    type="date"
                    value={valores.fecha}
                    onChange={cambiar('fecha')}
                  />
                )}
              </CampoFormulario>

              {ciclo && (
                <CampoFormulario id="fechaFin" etiqueta="Fecha de fin" error={errores.fechaFin}>
                  {(props) => (
                    <input
                      {...props}
                      id="fechaFin"
                      type="date"
                      min={valores.fecha || undefined}
                      value={valores.fechaFin}
                      onChange={cambiar('fechaFin')}
                    />
                  )}
                </CampoFormulario>
              )}

              <CampoFormulario id="hora" etiqueta="Hora de inicio" error={errores.hora}>
                {(props) => (
                  <input
                    {...props}
                    id="hora"
                    type="time"
                    value={valores.hora}
                    onChange={cambiar('hora')}
                  />
                )}
              </CampoFormulario>

              <CampoFormulario id="horaFin" etiqueta="Hora de fin" opcional error={errores.horaFin}>
                {(props) => (
                  <input
                    {...props}
                    id="horaFin"
                    type="time"
                    value={valores.horaFin}
                    onChange={cambiar('horaFin')}
                  />
                )}
              </CampoFormulario>
            </div>

            <SelectorImagen
              valor={valores.imagen}
              onChange={cambiar('imagen')}
              error={errores.imagen}
            />
          </section>

          {/* -------------------------- Entradas -------------------------- */}
          <section className="gz-tarjeta-impresa space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="font-serif-dm text-lg text-tinta">Botón de entradas</h2>
              <p className="mt-1 font-serif-spectral text-[12.5px] text-pardo">
                Opcional. Si lo rellenas, aparecerá un botón de compra en la página del evento.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <CampoFormulario
                id="entradasTexto"
                etiqueta="Texto del botón"
                opcional
                error={errores.entradasTexto}
              >
                {(props) => (
                  <input
                    {...props}
                    id="entradasTexto"
                    type="text"
                    maxLength={LIMITES.entradasTexto}
                    value={valores.entradasTexto}
                    onChange={cambiar('entradasTexto')}
                    placeholder="Comprar entradas"
                  />
                )}
              </CampoFormulario>

              <CampoFormulario
                id="precio"
                etiqueta="Precio"
                opcional
                error={errores.precio}
                ayuda="Texto libre: «12 €», «Entrada libre»…"
              >
                {(props) => (
                  <input
                    {...props}
                    id="precio"
                    type="text"
                    maxLength={LIMITES.precio}
                    value={valores.precio}
                    onChange={cambiar('precio')}
                    placeholder="12 €"
                  />
                )}
              </CampoFormulario>
            </div>

            <CampoFormulario
              id="entradasUrl"
              etiqueta="Enlace de compra"
              opcional
              error={errores.entradasUrl}
            >
              {(props) => (
                <input
                  {...props}
                  id="entradasUrl"
                  type="url"
                  inputMode="url"
                  value={valores.entradasUrl}
                  onChange={cambiar('entradasUrl')}
                  placeholder="https://tyltyl.org/entradas"
                />
              )}
            </CampoFormulario>
          </section>

          {errorGeneral && (
            <div
              role="alert"
              className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-4"
            >
              <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
              <p className="font-serif-spectral text-sm font-medium text-terracota">{errorGeneral}</p>
            </div>
          )}

          {/* Tres acciones, un mismo formulario: el estado lo decide el botón
              (al editar, el principal conserva el estado actual del evento) y
              "Cancelar" descarta los cambios y devuelve al panel sin guardar. */}
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={enviando || perfilIncompleto}
              className="gz-boton-tinta inline-flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MIcon name={editando ? 'save' : 'publish'} className="text-[16px]" />
              {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar evento'}
            </button>

            <button
              type="button"
              disabled={enviando || perfilIncompleto}
              onClick={() => guardar(accionSecundaria.estado)}
              className="gz-boton-borde inline-flex flex-1 items-center justify-center gap-2 hover:bg-papel-calido disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MIcon name={accionSecundaria.icono} className="text-[16px]" />
              {accionSecundaria.etiqueta}
            </button>

            {/* Sin disabled por perfilIncompleto: salir siempre tiene que ser
                posible, aunque el formulario esté bloqueado. */}
            <button
              type="button"
              disabled={enviando}
              onClick={() => navegar('/panel')}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-filete px-4 py-3 font-mono-ibm text-xs uppercase tracking-etiqueta text-pardo transition-colors hover:bg-papel-calido hover:text-tinta disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MIcon name="close" className="text-[16px]" />
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
