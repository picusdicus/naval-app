import { useEffect, useMemo, useState } from 'react'
import { LISTA_CATEGORIAS_EVENTO } from '../../../lib/eventos.js'
import { LUGARES_FIJOS } from '../../../lib/lugares.js'
import { LIMITES, validarEvento } from '../../../lib/eventoForm.js'
import MIcon from '../../MIcon.jsx'
import SelectorImagen from '../SelectorImagen.jsx'

// Formulario del tab Eventos de /admin para crear un evento a mano en nombre
// de cualquier organizador. Organizador y lugar son desplegables con lo que ya
// existe (organizaciones activas; lugares fijos + lugares ya usados) y ambos
// admiten "Otro…" para escribir uno nuevo: un organizador nuevo se crea como
// organización (sin usuarios, solo para atribuir el evento) al guardar.
// Escribe en POST /api/super/eventos-manuales.
//
// Con `eventoAEditar` pasa a modo edición: prerrellena los campos con esa fila
// y guarda con PUT ?id= (mismo patrón `editando ? 'PUT' : 'POST'` que
// AdminEventoForm.jsx en /panel). Editar no cambia ni el organizador ni el
// estado del evento — el UPDATE del servidor no toca esas columnas —, así
// que esos dos controles no se muestran.

export const OPCION_NUEVO = '__nuevo__'

const claveLugar = (nombre) =>
  String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const VALORES_INICIALES = {
  titulo: '',
  descripcion: '',
  categoria: '',
  fecha: '',
  hora: '',
  horaFin: '',
  imagen: '',
  organizacionId: '',
  organizacionNombre: '',
  lugarElegido: '',
  lugarNuevo: '',
  estado: 'publicado',
}

/** Desplegable + campo libre que aparece al elegir "Otro…". */
function CampoConOtro({ id, etiqueta, valor, onChange, opciones, valorNuevo, onChangeNuevo, placeholderNuevo, error, maxLength }) {
  const esNuevo = valor === OPCION_NUEVO
  return (
    <div>
      <label htmlFor={id} className="gz-label mb-1.5 block text-pardo">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="gz-input w-full">
        <option value="">Elige…</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
        <option value={OPCION_NUEVO}>➕ Otro (escribir uno nuevo)…</option>
      </select>
      {esNuevo && (
        <input
          id={`${id}-nuevo`}
          type="text"
          value={valorNuevo}
          onChange={(e) => onChangeNuevo(e.target.value)}
          placeholder={placeholderNuevo}
          maxLength={maxLength}
          autoFocus
          className="gz-input mt-2 w-full"
        />
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </div>
  )
}

function Campo({ id, etiqueta, error, opcional, children }) {
  return (
    <div>
      <label htmlFor={id} className="gz-label mb-1.5 block text-pardo">
        {etiqueta}
        {opcional && <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Fila que devuelve `GET ?id=` → valores del formulario. Un campo vacío en la
 * base llega como '' y se trata como un campo vacío más: no se inventa nada.
 */
function aValoresDeEdicion(evento) {
  return {
    ...VALORES_INICIALES,
    titulo: evento.titulo ?? '',
    descripcion: evento.descripcion ?? '',
    categoria: evento.categoria ?? '',
    fecha: evento.fecha ?? '',
    hora: evento.hora ?? '',
    horaFin: evento.horaFin ?? '',
    imagen: evento.imagen ?? '',
    estado: evento.estado ?? 'publicado',
    organizacionId: evento.organizacionId ?? '',
    lugarElegido: evento.lugar ?? '',
  }
}

/**
 * @param {object} props
 * @param {string[]} props.lugaresDeLaAgenda — lugares de los eventos ya cargados en el tab (se suman a los del servidor)
 * @param {{id: string, titulo: string} | null} props.eventoAEditar — con valor, el formulario edita esa fila en vez de crear una nueva
 * @param {(resultado: {evento, organizacion}) => void} props.onCreado
 * @param {() => void} props.onCancelar
 */
export default function FormularioEventoManual({
  lugaresDeLaAgenda = [],
  eventoAEditar = null,
  onCreado,
  onCancelar,
}) {
  const editando = Boolean(eventoAEditar)
  const [valores, setValores] = useState(VALORES_INICIALES)
  const [errores, setErrores] = useState({})
  const [organizaciones, setOrganizaciones] = useState([])
  const [lugaresServidor, setLugaresServidor] = useState([])
  const [cargandoOpciones, setCargandoOpciones] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  // Los valores de la edición salen de la BASE, no de la fila del listado: la
  // agenda del tab ya viene fusionada y con carteles propagados entre hermanos
  // de la misma serie, y guardar eso escribiría en la fila datos ajenos.
  const [cargandoEvento, setCargandoEvento] = useState(editando)
  const [organizador, setOrganizador] = useState(null) // solo informativo al editar

  useEffect(() => {
    let vigente = true
    fetch('/api/super/eventos-manuales')
      .then((r) => (r.ok ? r.json() : { organizaciones: [], lugares: [] }))
      .catch(() => ({ organizaciones: [], lugares: [] }))
      .then((d) => {
        if (!vigente) return
        setOrganizaciones(d.organizaciones ?? [])
        setLugaresServidor(d.lugares ?? [])
      })
      .finally(() => {
        if (vigente) setCargandoOpciones(false)
      })
    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    if (!eventoAEditar?.id) return undefined
    let vigente = true
    setCargandoEvento(true)
    fetch(`/api/super/eventos-manuales?id=${encodeURIComponent(eventoAEditar.id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No se pudo cargar el evento.')
        return d
      })
      .then((d) => {
        if (!vigente) return
        setValores(aValoresDeEdicion(d.evento))
        setOrganizador(d.evento.organizacionNombre ?? null)
      })
      .catch((err) => {
        if (vigente) setFallo(err.message)
      })
      .finally(() => {
        if (vigente) setCargandoEvento(false)
      })
    return () => {
      vigente = false
    }
  }, [eventoAEditar?.id])

  // Lugares fijos primero (plazas y espacios públicos), después el resto sin
  // duplicados, ordenado. El programa de fiestas trae el mismo sitio con
  // variantes ("plaza de Segovia." / "Plaza de Segovia"): se colapsan por
  // clave normalizada (sin acentos, mayúsculas ni puntuación final) y gana la
  // primera redacción vista, con el punto final quitado.
  const opcionesLugar = useMemo(() => {
    const fijos = LUGARES_FIJOS.map((l) => l.nombre)
    const vistos = new Set(fijos.map(claveLugar))
    const resto = []
    for (const l of [...lugaresServidor, ...lugaresDeLaAgenda]) {
      const nombre = String(l || '').trim().replace(/[.\s]+$/, '')
      const clave = claveLugar(nombre)
      if (!clave || vistos.has(clave)) continue
      vistos.add(clave)
      resto.push(nombre)
    }
    resto.sort((a, b) => a.localeCompare(b, 'es'))
    // El lugar del evento que se edita puede no estar en ninguna de las dos
    // listas (se escribió con «Otro…» y el evento aún no está en la agenda
    // cargada): se añade para que el desplegable no lo pierda al guardar.
    const guardado = String(valores.lugarElegido || '').trim()
    if (guardado && guardado !== OPCION_NUEVO && !vistos.has(claveLugar(guardado))) {
      resto.unshift(guardado)
    }
    return [...fijos, ...resto].map((n) => ({ valor: n, texto: n }))
  }, [lugaresServidor, lugaresDeLaAgenda, valores.lugarElegido])

  const opcionesOrganizador = useMemo(
    () => organizaciones.map((o) => ({ valor: o.id, texto: o.nombre })),
    [organizaciones],
  )

  const cambiar = (campo) => (e) => {
    const v = typeof e === 'string' ? e : e.target.value
    setValores((prev) => ({ ...prev, [campo]: v }))
    setErrores((prev) => {
      if (!prev[campo]) return prev
      const { [campo]: _omitido, ...resto } = prev
      return resto
    })
  }

  const lugarFinal = () =>
    valores.lugarElegido === OPCION_NUEVO ? valores.lugarNuevo.trim() : valores.lugarElegido

  function cuerpoParaEnviar() {
    const organizadorNuevo = valores.organizacionId === OPCION_NUEVO
    const comun = {
      titulo: valores.titulo,
      descripcion: valores.descripcion,
      categoria: valores.categoria,
      lugar: lugarFinal(),
      fecha: valores.fecha,
      hora: valores.hora,
      horaFin: valores.horaFin,
      imagen: valores.imagen,
      estado: valores.estado,
      ambito: 'navalcarnero',
    }
    // El PUT no cambia el organizador (ni el estado): mandarlos solo daría a
    // entender que se pueden tocar desde aquí.
    if (editando) return comun
    return {
      ...comun,
      ...(organizadorNuevo
        ? { organizacionNombre: valores.organizacionNombre.trim() }
        : { organizacionId: valores.organizacionId }),
    }
  }

  function validar(cuerpo) {
    const errs = validarEvento(cuerpo)
    if (!editando && !cuerpo.organizacionId && !cuerpo.organizacionNombre) {
      errs.organizador = 'Elige el organizador o escribe uno nuevo.'
    }
    return errs
  }

  async function enviar(e) {
    e.preventDefault()
    setFallo('')
    const cuerpo = cuerpoParaEnviar()
    const errs = validar(cuerpo)
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      return
    }
    setGuardando(true)
    try {
      const url = editando
        ? `/api/super/eventos-manuales?id=${encodeURIComponent(eventoAEditar.id)}`
        : '/api/super/eventos-manuales'
      const res = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (datos.errores) setErrores(datos.errores)
        throw new Error(
          datos.error || (editando ? 'No se pudo guardar el evento.' : 'No se pudo crear el evento.'),
        )
      }
      onCreado?.(datos)
    } catch (err) {
      setFallo(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      data-testid="formulario-evento-manual"
      className="space-y-5 border border-tinta bg-papel-calido px-4 py-5 sm:px-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif-dm text-lg text-tinta">
            {editando ? 'Editar evento' : 'Nuevo evento'}
          </h3>
          <p className="mt-1 font-serif-spectral text-sm text-pardo">
            {editando ? (
              <>
                Cambia los datos de «{eventoAEditar.titulo}». El organizador y el estado de
                publicación no se editan aquí.
              </>
            ) : (
              <>
                Crea un evento en nombre de cualquier organizador. Si el organizador o el lugar no
                están en la lista, elige «Otro…» y escríbelo.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar formulario"
          className="shrink-0 border border-filete p-1.5 text-pardo transition-colors hover:border-terracota hover:text-terracota"
        >
          <MIcon name="close" className="text-[18px]" />
        </button>
      </div>

      {cargandoEvento && (
        <p className="font-serif-spectral text-sm text-pardo">Cargando el evento…</p>
      )}

      {fallo && (
        <p className="flex items-start gap-2 border border-terracota bg-terracota-fondo px-4 py-3 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="mt-0.5 text-[18px]" />
          <span>{fallo}</span>
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Campo id="em-titulo" etiqueta="Título" error={errores.titulo}>
            <input
              id="em-titulo"
              type="text"
              value={valores.titulo}
              onChange={cambiar('titulo')}
              maxLength={LIMITES.titulo}
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="em-descripcion" etiqueta="Descripción" error={errores.descripcion}>
            <textarea
              id="em-descripcion"
              value={valores.descripcion}
              onChange={cambiar('descripcion')}
              maxLength={LIMITES.descripcion}
              rows={5}
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="em-categoria" etiqueta="Categoría" error={errores.categoria}>
            <select
              id="em-categoria"
              value={valores.categoria}
              onChange={cambiar('categoria')}
              className="gz-input w-full"
            >
              <option value="">Elige…</option>
              {LISTA_CATEGORIAS_EVENTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo id="em-fecha" etiqueta="Día" error={errores.fecha}>
              <input
                id="em-fecha"
                type="date"
                value={valores.fecha}
                onChange={cambiar('fecha')}
                className="gz-input w-full"
              />
            </Campo>
            <Campo id="em-hora" etiqueta="Hora" error={errores.hora}>
              <input
                id="em-hora"
                type="time"
                value={valores.hora}
                onChange={cambiar('hora')}
                className="gz-input w-full"
              />
            </Campo>
            <Campo id="em-horaFin" etiqueta="Hora fin" error={errores.horaFin} opcional>
              <input
                id="em-horaFin"
                type="time"
                value={valores.horaFin}
                onChange={cambiar('horaFin')}
                className="gz-input w-full"
              />
            </Campo>
          </div>
        </div>

        <div className="space-y-5">
          {editando ? (
            <div>
              <p className="gz-label mb-1.5 block text-pardo">Organizador</p>
              <p className="font-serif-spectral text-sm text-tinta">
                {organizador || '—'}
                <span className="ml-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                  · no se cambia aquí
                </span>
              </p>
            </div>
          ) : (
            <CampoConOtro
              id="em-organizador"
              etiqueta={cargandoOpciones ? 'Organizador (cargando…)' : 'Organizador'}
              valor={valores.organizacionId}
              onChange={cambiar('organizacionId')}
              opciones={opcionesOrganizador}
              valorNuevo={valores.organizacionNombre}
              onChangeNuevo={cambiar('organizacionNombre')}
              placeholderNuevo="Nombre del nuevo organizador"
              maxLength={120}
              error={errores.organizador}
            />
          )}

          <CampoConOtro
            id="em-lugar"
            etiqueta="Lugar"
            valor={valores.lugarElegido}
            onChange={cambiar('lugarElegido')}
            opciones={opcionesLugar}
            valorNuevo={valores.lugarNuevo}
            onChangeNuevo={cambiar('lugarNuevo')}
            placeholderNuevo="Nombre del nuevo lugar"
            maxLength={LIMITES.lugar}
            error={errores.lugar}
          />

          <SelectorImagen
            valor={valores.imagen}
            onChange={cambiar('imagen')}
            error={errores.imagen}
            etiqueta="Imagen del evento"
            carpeta="eventos"
          />

          {/* Publicar o no es una decisión del alta. Editando, el evento ya
              está en la agenda: para sacarlo de ella está «Ocultar» en la
              fila, que es la vía reversible del panel. */}
          {!editando && (
            <label className="flex cursor-pointer items-center gap-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta">
              <input
                type="checkbox"
                checked={valores.estado === 'publicado'}
                onChange={(e) => cambiar('estado')(e.target.checked ? 'publicado' : 'borrador')}
                className="accent-terracota"
              />
              Publicar en la agenda al guardar
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-filete pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancelar} disabled={guardando} className="gz-boton-borde">
          Cancelar
        </button>
        <button type="submit" disabled={guardando || cargandoEvento} className="gz-boton-tinta">
          <MIcon
            name={guardando ? 'progress_activity' : editando ? 'save' : 'add'}
            className="mr-1 text-[16px]"
          />
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </form>
  )
}
