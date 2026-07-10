import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MIcon from '../../components/MIcon.jsx'
import CampoFormulario from '../../components/admin/CampoFormulario.jsx'
import SelectorImagen from '../../components/admin/SelectorImagen.jsx'
import { LISTA_CATEGORIAS_EVENTO } from '../../lib/eventos.js'
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
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(editando)

  useEffect(() => {
    if (!editando) return
    let vigente = true

    fetch(`/api/admin/eventos?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 401) return navegar('/admin/login', { replace: true })
        const cuerpo = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(cuerpo.error || 'No se pudo cargar el evento.')
        if (vigente) setValores(aValoresDelFormulario(cuerpo.evento))
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
    const candidato = { ...valores, estado }

    const encontrados = validarEvento(candidato)
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
        navegar('/admin/login', { replace: true })
        return
      }
      if (!respuesta.ok) {
        // El servidor revalida: si discrepa del cliente, mandan sus errores.
        if (cuerpo.errores) setErrores(cuerpo.errores)
        throw new Error(cuerpo.error || 'No se pudo guardar el evento.')
      }

      navegar('/admin', { replace: true })
    } catch (err) {
      setErrorGeneral(err.message)
    } finally {
      setEnviando(false)
    }
  }

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
      <div className="flex min-h-screen items-center justify-center bg-surface-container-low">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          role="status"
          aria-label="Cargando evento"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-container-low pb-16">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-container"
          >
            <MIcon name="arrow_back" className="text-[18px]" />
            <span className="hidden sm:inline">Volver al panel</span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center font-display font-bold text-on-surface sm:text-left">
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
          <section className="nv-card space-y-5 p-5 sm:p-6">
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

            <div className="grid gap-5 sm:grid-cols-2">
              <CampoFormulario id="categoria" etiqueta="Categoría" error={errores.categoria}>
                {(props) => (
                  <select
                    {...props}
                    id="categoria"
                    value={valores.categoria}
                    onChange={cambiar('categoria')}
                  >
                    <option value="">Elige una categoría…</option>
                    {LISTA_CATEGORIAS_EVENTO.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </CampoFormulario>

              <CampoFormulario id="lugar" etiqueta="Lugar" error={errores.lugar}>
                {(props) => (
                  <input
                    {...props}
                    id="lugar"
                    type="text"
                    maxLength={LIMITES.lugar}
                    value={valores.lugar}
                    onChange={cambiar('lugar')}
                    placeholder="Teatro TYL TYL"
                  />
                )}
              </CampoFormulario>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <CampoFormulario id="fecha" etiqueta="Fecha" error={errores.fecha}>
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
          <section className="nv-card space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="font-display font-semibold text-on-surface">Botón de entradas</h2>
              <p className="mt-1 text-sm text-on-surface/60">
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
              className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/10 p-4"
            >
              <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-error" />
              <p className="text-sm font-medium text-error">{errorGeneral}</p>
            </div>
          )}

          {/* Dos acciones, un mismo formulario: el estado lo decide el botón.
              Al editar, el principal conserva el estado actual del evento. */}
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-on-primary transition-all hover:enabled:shadow-card-lg active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MIcon name={editando ? 'save' : 'publish'} className="text-[18px]" />
              {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar evento'}
            </button>

            <button
              type="button"
              disabled={enviando}
              onClick={() => guardar(accionSecundaria.estado)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 py-3 font-semibold text-on-surface transition-colors hover:enabled:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MIcon name={accionSecundaria.icono} className="text-[18px]" />
              {accionSecundaria.etiqueta}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
