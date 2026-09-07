import { useState } from 'react'
import { LISTA_CATEGORIAS_TALLER, DIAS_SEMANA, FAMILIAS_TALLER } from '../../../lib/talleres.js'
import {
  LIMITES,
  MAX_TURNOS,
  TURNO_VACIO,
  VALORES_INICIALES,
  validarTaller,
} from '../../../lib/tallerForm.js'
import MIcon from '../../MIcon.jsx'
import SelectorImagen from '../SelectorImagen.jsx'

// Formulario del tab Talleres de /admin: crear y editar un taller municipal.
// Escribe en POST /api/super/talleres (nuevo) o PUT ?id= (edición), que
// vuelven a ejecutar la misma validación en servidor.
//
// La pieza propia de este formulario es el REPETIDOR DE TURNOS: un taller
// tiene varios horarios (por edad o nivel) y el catálogo real llega a cuatro
// ("Teatro": 3-6, 7-11, 12-17 y adultos). Cada turno lleva su etiqueta, sus
// días y sus horas, y opcionalmente un lugar propio cuando se imparte en otra
// sede que el resto del taller.

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

/** Una fila del repetidor. */
function FilaTurno({ turno, indice, total, error, onCambiar, onQuitar, onMover }) {
  const alternarDia = (dia) => {
    const dias = turno.dias || []
    onCambiar({
      ...turno,
      dias: dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia],
    })
  }

  return (
    <li className="border border-filete p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          Turno {indice + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={indice === 0}
            aria-label={`Subir el turno ${indice + 1}`}
            className="p-1 text-pardo disabled:opacity-30 hover:text-tinta"
          >
            <MIcon name="arrow_upward" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={indice === total - 1}
            aria-label={`Bajar el turno ${indice + 1}`}
            className="p-1 text-pardo disabled:opacity-30 hover:text-tinta"
          >
            <MIcon name="arrow_downward" className="text-[16px]" />
          </button>
          <button
            type="button"
            onClick={onQuitar}
            aria-label={`Quitar el turno ${indice + 1}`}
            className="p-1 text-terracota hover:text-tinta"
          >
            <MIcon name="delete" className="text-[16px]" />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={turno.etiqueta || ''}
        onChange={(e) => onCambiar({ ...turno, etiqueta: e.target.value })}
        placeholder="Etiqueta (p. ej. «De 7 a 11 años» o «Nivel iniciación»)"
        maxLength={LIMITES.etiquetaTurno}
        aria-label={`Etiqueta del turno ${indice + 1}`}
        className="gz-input w-full"
      />

      <div className="mt-2 flex flex-wrap gap-1">
        {DIAS_SEMANA.map((dia) => {
          const activo = (turno.dias || []).includes(dia.id)
          return (
            <button
              key={dia.id}
              type="button"
              onClick={() => alternarDia(dia.id)}
              aria-pressed={activo}
              aria-label={dia.nombre}
              title={dia.nombre}
              className={`h-8 w-8 border font-mono-ibm text-[11px] uppercase transition-colors ${
                activo
                  ? 'border-tinta bg-tinta text-papel'
                  : 'border-filete bg-papel text-pardo hover:border-tinta'
              }`}
            >
              {dia.corto}
            </button>
          )
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          type="time"
          value={turno.horaInicio || ''}
          onChange={(e) => onCambiar({ ...turno, horaInicio: e.target.value })}
          aria-label={`Hora de inicio del turno ${indice + 1}`}
          className="gz-input w-full"
        />
        <input
          type="time"
          value={turno.horaFin || ''}
          onChange={(e) => onCambiar({ ...turno, horaFin: e.target.value })}
          aria-label={`Hora de fin del turno ${indice + 1}`}
          className="gz-input w-full"
        />
      </div>

      <input
        type="text"
        value={turno.lugar || ''}
        onChange={(e) => onCambiar({ ...turno, lugar: e.target.value })}
        placeholder="Lugar propio (solo si es distinto al del taller)"
        maxLength={LIMITES.lugar}
        aria-label={`Lugar del turno ${indice + 1}`}
        className="gz-input mt-2 w-full"
      />

      {error && (
        <p className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
          <MIcon name="error" className="text-[14px]" />
          {error}
        </p>
      )}
    </li>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.taller — taller a editar; null para crear uno nuevo
 * @param {(taller) => void} props.onGuardado
 * @param {() => void} props.onCancelar
 */
export default function FormularioTaller({ taller = null, onGuardado, onCancelar }) {
  const edicion = Boolean(taller?.id)
  const [valores, setValores] = useState(() =>
    taller
      ? {
          ...VALORES_INICIALES,
          ...taller,
          turnos: taller.turnos?.length > 0 ? taller.turnos : [{ ...TURNO_VACIO }],
        }
      : VALORES_INICIALES,
  )
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')

  const cambiar = (campo) => (valor) => {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const cambiarTurno = (i) => (turno) => {
    setValores((v) => ({ ...v, turnos: v.turnos.map((t, j) => (j === i ? turno : t)) }))
    setErrores((e) => ({ ...e, [`turno-${i}`]: undefined }))
  }

  const quitarTurno = (i) =>
    setValores((v) => ({
      ...v,
      // Nunca se queda sin ninguna fila: un taller sin turnos se expresa
      // dejando la fila vacía ("Por determinar"), no borrándola.
      turnos: v.turnos.length > 1 ? v.turnos.filter((_, j) => j !== i) : [{ ...TURNO_VACIO }],
    }))

  const moverTurno = (i) => (delta) =>
    setValores((v) => {
      const destino = i + delta
      if (destino < 0 || destino >= v.turnos.length) return v
      const turnos = [...v.turnos]
      ;[turnos[i], turnos[destino]] = [turnos[destino], turnos[i]]
      return { ...v, turnos }
    })

  const anadirTurno = () =>
    setValores((v) =>
      v.turnos.length >= MAX_TURNOS ? v : { ...v, turnos: [...v.turnos, { ...TURNO_VACIO }] },
    )

  const enviar = async (e) => {
    e.preventDefault()
    setFallo('')

    const fallos = validarTaller(valores)
    if (Object.keys(fallos).length > 0) {
      setErrores(fallos)
      return
    }

    setGuardando(true)
    try {
      const url = edicion ? `/api/super/talleres?id=${taller.id}` : '/api/super/talleres'
      const res = await fetch(url, {
        method: edicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      const cuerpo = await res.json().catch(() => ({}))
      if (!res.ok) {
        // El servidor repite la validación: si algo se coló, sus errores mandan.
        if (cuerpo.errores) setErrores(cuerpo.errores)
        throw new Error(cuerpo.error || 'No se pudo guardar el taller.')
      }
      onGuardado(cuerpo.taller)
    } catch (err) {
      setFallo(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 border border-tinta bg-papel p-4">
      <h3 className="font-serif-dm text-lg text-tinta">
        {edicion ? `Editar «${taller.nombre}»` : 'Nuevo taller'}
      </h3>

      {fallo && (
        <p className="flex items-center gap-2 border border-terracota bg-terracota-fondo p-2.5 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="text-[16px]" />
          {fallo}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo id="t-nombre" etiqueta="Nombre del taller" error={errores.nombre}>
          <input
            id="t-nombre"
            type="text"
            value={valores.nombre}
            onChange={(e) => cambiar('nombre')(e.target.value)}
            maxLength={LIMITES.nombre}
            className="gz-input w-full"
          />
        </Campo>

        <Campo id="t-categoria" etiqueta="Categoría" error={errores.categoria}>
          <select
            id="t-categoria"
            value={valores.categoria}
            onChange={(e) => cambiar('categoria')(e.target.value)}
            className="gz-input w-full"
          >
            <option value="">Elige…</option>
            {LISTA_CATEGORIAS_TALLER.map((c) => (
              <option key={c.id} value={c.id}>
                {FAMILIAS_TALLER[c.familia]?.nombre} · {c.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id="t-lugar" etiqueta="Lugar" error={errores.lugar} opcional>
          <input
            id="t-lugar"
            type="text"
            value={valores.lugar}
            onChange={(e) => cambiar('lugar')(e.target.value)}
            maxLength={LIMITES.lugar}
            placeholder="Casa de la Cultura"
            className="gz-input w-full"
          />
        </Campo>

        <Campo id="t-precio" etiqueta="Precio" error={errores.precio} opcional>
          <input
            id="t-precio"
            type="text"
            value={valores.precio}
            onChange={(e) => cambiar('precio')(e.target.value)}
            maxLength={LIMITES.precio}
            placeholder="22 €/mes"
            className="gz-input w-full"
          />
        </Campo>

        <Campo id="t-edades" etiqueta="Edades" error={errores.edades} opcional>
          <input
            id="t-edades"
            type="text"
            value={valores.edades}
            onChange={(e) => cambiar('edades')(e.target.value)}
            maxLength={LIMITES.edades}
            placeholder="A partir de 18 años"
            className="gz-input w-full"
          />
        </Campo>

        <Campo id="t-curso" etiqueta="Curso" error={errores.curso} opcional>
          <input
            id="t-curso"
            type="text"
            value={valores.curso}
            onChange={(e) => cambiar('curso')(e.target.value)}
            maxLength={LIMITES.curso}
            placeholder="2026/2027"
            className="gz-input w-full"
          />
        </Campo>
      </div>

      <Campo id="t-descripcion" etiqueta="Descripción" error={errores.descripcion} opcional>
        <textarea
          id="t-descripcion"
          value={valores.descripcion}
          onChange={(e) => cambiar('descripcion')(e.target.value)}
          maxLength={LIMITES.descripcion}
          rows={4}
          className="gz-input w-full"
        />
      </Campo>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="gz-label text-pardo">Turnos y horarios</span>
          <button
            type="button"
            onClick={anadirTurno}
            disabled={valores.turnos.length >= MAX_TURNOS}
            className="inline-flex items-center gap-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota disabled:opacity-40 hover:text-tinta"
          >
            <MIcon name="add" className="text-[14px]" />
            Añadir turno
          </button>
        </div>
        {errores.turnos && (
          <p className="mb-2 font-serif-spectral text-xs font-medium text-terracota">
            {errores.turnos}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {valores.turnos.map((turno, i) => (
            <FilaTurno
              key={i}
              turno={turno}
              indice={i}
              total={valores.turnos.length}
              error={errores[`turno-${i}`]}
              onCambiar={cambiarTurno(i)}
              onQuitar={() => quitarTurno(i)}
              onMover={moverTurno(i)}
            />
          ))}
        </ul>
        <p className="mt-2 font-serif-spectral text-xs text-mudo">
          Un turno sin días ni horas se publica como «Por determinar».
        </p>
      </div>

      <SelectorImagen
        valor={valores.imagen}
        onChange={cambiar('imagen')}
        error={errores.imagen}
        etiqueta="Foto del taller"
        carpeta="talleres"
      />

      <label className="flex cursor-pointer items-center gap-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta">
        <input
          type="checkbox"
          checked={valores.estado === 'publicado'}
          onChange={(e) => cambiar('estado')(e.target.checked ? 'publicado' : 'borrador')}
          className="accent-terracota"
        />
        Publicar en el catálogo al guardar
      </label>

      <div className="flex flex-col-reverse gap-2 border-t border-filete pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancelar} disabled={guardando} className="gz-boton-borde">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="gz-boton-tinta">
          <MIcon name={guardando ? 'progress_activity' : 'save'} className="mr-1 text-[16px]" />
          {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear taller'}
        </button>
      </div>
    </form>
  )
}
