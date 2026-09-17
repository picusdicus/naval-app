import { useMemo, useState } from 'react'
import { LISTA_CATEGORIAS } from '../../../lib/categorias.js'
import { SUBTIPO_INFO } from '../../../lib/subtipos.js'
import { COCINA_LABEL } from '../../../lib/cocinas.js'
import {
  ATRIBUTOS_COMERCIO,
  LIMITES_COMERCIO,
  NIVELES_PRECIO,
  VALORES_INICIALES_COMERCIO,
  validarComercio,
} from '../../../lib/comercioForm.js'
import MIcon from '../../MIcon.jsx'

// Formulario del tab Comercios de /admin para dar de alta un comercio a mano
// con la ficha COMPLETA de Google Places (categoría, subtipo, tipo visible,
// contacto, coordenadas, horario, descripción, nivel de precio, cocinas y
// atributos). Escribe en POST /api/super/comercios-alta, que publica la ficha
// en servicios-locales.json con un commit (visible tras el redeploy, ~2 min).

const OPCIONES_SUBTIPO = Object.keys(SUBTIPO_INFO)
  .map((clave) => ({ clave, nombre: SUBTIPO_INFO[clave].nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const OPCIONES_COCINA = Object.entries(COCINA_LABEL)
  .map(([clave, nombre]) => ({ clave, nombre }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const CATEGORIAS_VALIDAS = new Set(LISTA_CATEGORIAS.map((c) => c.id))
const SUBTIPOS_VALIDOS = new Set(Object.keys(SUBTIPO_INFO))

function Campo({ id, etiqueta, error, opcional, ayuda, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="gz-label mb-1.5 block text-pardo">
        {etiqueta}
        {opcional && <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 font-serif-spectral text-xs text-pardo">{ayuda}</p>}
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
 * @param {object} props
 * @param {(resultado: {comercio}) => void} props.onCreado
 * @param {() => void} props.onCancelar
 */
export default function FormularioComercioManual({ onCreado, onCancelar }) {
  const [valores, setValores] = useState(VALORES_INICIALES_COMERCIO)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')
  // Duplicado detectado por el servidor: se muestra y el segundo envío lo fuerza.
  const [duplicado, setDuplicado] = useState(null)

  const esRestauracion = valores.categoria === 'restauracion'

  const cambiar = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setValores((prev) => ({ ...prev, [campo]: valor }))
    setDuplicado(null)
    setErrores((prev) => {
      const { [campo]: _omitido, ...resto } = prev
      return resto
    })
  }

  function alternarCocina(clave) {
    setValores((prev) => {
      const activa = prev.cocina.includes(clave)
      return { ...prev, cocina: activa ? prev.cocina.filter((c) => c !== clave) : [...prev.cocina, clave] }
    })
  }

  function alternarAtributo(clave) {
    setValores((prev) => {
      const siguiente = { ...prev.atributos }
      if (siguiente[clave]) delete siguiente[clave]
      else siguiente[clave] = true
      return { ...prev, atributos: siguiente }
    })
  }

  const cuerpo = useMemo(
    () => ({
      ...valores,
      // Las cocinas solo tienen sentido en restauración: no se envían fuera.
      cocina: esRestauracion ? valores.cocina : [],
    }),
    [valores, esRestauracion],
  )

  async function enviar(e) {
    e.preventDefault()
    setFallo('')
    const errs = validarComercio(cuerpo, { categorias: CATEGORIAS_VALIDAS, subtipos: SUBTIPOS_VALIDOS })
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/super/comercios-alta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cuerpo, forzar: Boolean(duplicado) }),
      })
      const datos = await res.json().catch(() => ({}))
      if (res.status === 409 && datos.duplicado) {
        setDuplicado(datos.duplicado)
        return
      }
      if (!res.ok) {
        if (datos.errores) setErrores(datos.errores)
        throw new Error(datos.error || 'No se pudo dar de alta el comercio.')
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
      data-testid="formulario-comercio-manual"
      className="space-y-5 border border-tinta bg-papel-calido px-4 py-5 sm:px-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif-dm text-lg text-tinta">Nuevo comercio</h3>
          <p className="mt-1 font-serif-spectral text-sm text-pardo">
            Da de alta un negocio que no está en el directorio con la misma ficha que traería
            Google Places. Solo nombre, categoría, subcategoría y dirección son obligatorios.
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

      {fallo && (
        <p className="flex items-start gap-2 border border-terracota bg-terracota-fondo px-4 py-3 font-serif-spectral text-sm text-terracota">
          <MIcon name="error" className="mt-0.5 text-[18px]" />
          <span>{fallo}</span>
        </p>
      )}

      {duplicado && (
        <p
          data-testid="aviso-duplicado"
          className="flex items-start gap-2 border border-ocre-profundo bg-papel px-4 py-3 font-serif-spectral text-sm text-tinta"
        >
          <MIcon name="warning" className="mt-0.5 text-[18px] text-ocre-profundo" />
          <span>
            Ya existe «{duplicado.nombre}» ({duplicado.id}). Si es otro local con el mismo nombre,
            pulsa «Dar de alta de todos modos»; si no, cierra el formulario.
          </span>
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <Campo id="cm-nombre" etiqueta="Nombre" error={errores.nombre}>
            <input
              id="cm-nombre"
              type="text"
              value={valores.nombre}
              onChange={cambiar('nombre')}
              maxLength={LIMITES_COMERCIO.nombre}
              className="gz-input w-full"
              autoFocus
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="cm-categoria" etiqueta="Categoría" error={errores.categoria}>
              <select
                id="cm-categoria"
                value={valores.categoria}
                onChange={cambiar('categoria')}
                className="gz-input w-full"
              >
                <option value="">Elige…</option>
                {LISTA_CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="cm-subtipo" etiqueta="Subcategoría" error={errores.subtipo}>
              <select
                id="cm-subtipo"
                value={valores.subtipo}
                onChange={cambiar('subtipo')}
                className="gz-input w-full"
              >
                <option value="">Elige…</option>
                {OPCIONES_SUBTIPO.map((s) => (
                  <option key={s.clave} value={s.clave}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo
            id="cm-tipoDisplay"
            etiqueta="Tipo visible"
            error={errores.tipoDisplay}
            opcional
            ayuda="Lo que Google muestra bajo el nombre: «Restaurante turco», «Barbería», «Ferretería»."
          >
            <input
              id="cm-tipoDisplay"
              type="text"
              value={valores.tipoDisplay}
              onChange={cambiar('tipoDisplay')}
              maxLength={LIMITES_COMERCIO.tipoDisplay}
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="cm-direccion" etiqueta="Dirección" error={errores.direccion}>
            <input
              id="cm-direccion"
              type="text"
              value={valores.direccion}
              onChange={cambiar('direccion')}
              maxLength={LIMITES_COMERCIO.direccion}
              placeholder="Calle, número, Navalcarnero"
              className="gz-input w-full"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="cm-lat" etiqueta="Latitud" error={errores.lat} opcional>
              <input
                id="cm-lat"
                type="text"
                inputMode="decimal"
                value={valores.lat}
                onChange={cambiar('lat')}
                placeholder="40.2903"
                className="gz-input w-full"
              />
            </Campo>
            <Campo id="cm-lng" etiqueta="Longitud" error={errores.lng} opcional>
              <input
                id="cm-lng"
                type="text"
                inputMode="decimal"
                value={valores.lng}
                onChange={cambiar('lng')}
                placeholder="-4.0126"
                className="gz-input w-full"
              />
            </Campo>
          </div>

          <Campo id="cm-telefono" etiqueta="Teléfono" error={errores.telefono} opcional>
            <input
              id="cm-telefono"
              type="tel"
              value={valores.telefono}
              onChange={cambiar('telefono')}
              maxLength={LIMITES_COMERCIO.telefono}
              placeholder="918 00 00 00"
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="cm-web" etiqueta="Web" error={errores.web} opcional>
            <input
              id="cm-web"
              type="url"
              value={valores.web}
              onChange={cambiar('web')}
              maxLength={LIMITES_COMERCIO.web}
              placeholder="https://…"
              className="gz-input w-full"
            />
          </Campo>

          <Campo
            id="cm-mapsUrl"
            etiqueta="Enlace de Google Maps"
            error={errores.mapsUrl}
            opcional
            ayuda="La ficha exacta del local en Maps (botón «Compartir»). Sin él, el botón «Cómo llegar» busca por nombre y dirección."
          >
            <input
              id="cm-mapsUrl"
              type="url"
              value={valores.mapsUrl}
              onChange={cambiar('mapsUrl')}
              maxLength={LIMITES_COMERCIO.mapsUrl}
              placeholder="https://maps.google.com/?cid=…"
              className="gz-input w-full"
            />
          </Campo>
        </div>

        <div className="space-y-5">
          <Campo
            id="cm-horario"
            etiqueta="Horario"
            error={errores.horario}
            opcional
            ayuda="Mismo formato que Google, un día por tramo separado por «|»: lunes: 9:00–14:00, 17:00–20:00 | martes: … | domingo: Cerrado"
          >
            <textarea
              id="cm-horario"
              value={valores.horario}
              onChange={cambiar('horario')}
              maxLength={LIMITES_COMERCIO.horario}
              rows={4}
              placeholder="lunes: 9:00–14:00, 17:00–20:00 | martes: 9:00–14:00, 17:00–20:00 | … | domingo: Cerrado"
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="cm-descripcion" etiqueta="Descripción" error={errores.descripcion} opcional>
            <textarea
              id="cm-descripcion"
              value={valores.descripcion}
              onChange={cambiar('descripcion')}
              maxLength={LIMITES_COMERCIO.descripcion}
              rows={4}
              className="gz-input w-full"
            />
          </Campo>

          <Campo id="cm-precioNivel" etiqueta="Nivel de precio" error={errores.precioNivel} opcional>
            <select
              id="cm-precioNivel"
              value={valores.precioNivel}
              onChange={cambiar('precioNivel')}
              className="gz-input w-full"
            >
              {NIVELES_PRECIO.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.texto}
                </option>
              ))}
            </select>
          </Campo>

          {esRestauracion && (
            <fieldset>
              <legend className="gz-label mb-1.5 block text-pardo">
                Tipo de cocina
                <span className="ml-1.5 normal-case tracking-normal text-mudo">
                  (opcional, hasta {LIMITES_COMERCIO.cocina})
                </span>
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {OPCIONES_COCINA.map((c) => {
                  const activa = valores.cocina.includes(c.clave)
                  return (
                    <button
                      key={c.clave}
                      type="button"
                      onClick={() => alternarCocina(c.clave)}
                      aria-pressed={activa}
                      className={`border px-2.5 py-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta transition-colors ${
                        activa
                          ? 'border-tinta bg-tinta text-papel'
                          : 'border-filete text-pardo hover:border-tinta hover:text-tinta'
                      }`}
                    >
                      {c.nombre}
                    </button>
                  )
                })}
              </div>
              {errores.cocina && (
                <p className="mt-1.5 flex items-center gap-1 font-serif-spectral text-xs font-medium text-terracota">
                  <MIcon name="error" className="text-[14px]" />
                  {errores.cocina}
                </p>
              )}
            </fieldset>
          )}

          <fieldset>
            <legend className="gz-label mb-1.5 block text-pardo">
              Servicios y accesibilidad
              <span className="ml-1.5 normal-case tracking-normal text-mudo">(opcional)</span>
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {Object.entries(ATRIBUTOS_COMERCIO).map(([clave, texto]) => (
                <label
                  key={clave}
                  className="flex cursor-pointer items-center gap-2 font-serif-spectral text-sm text-tinta"
                >
                  <input
                    type="checkbox"
                    checked={valores.atributos[clave] === true}
                    onChange={() => alternarAtributo(clave)}
                    className="accent-terracota"
                  />
                  {texto}
                </label>
              ))}
            </div>
            {errores.atributos && (
              <p className="mt-1.5 font-serif-spectral text-xs font-medium text-terracota">{errores.atributos}</p>
            )}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 font-serif-spectral text-sm text-tinta">
            <input
              type="checkbox"
              checked={valores.cerradoTemporal}
              onChange={cambiar('cerradoTemporal')}
              className="accent-terracota"
            />
            Cerrado temporalmente
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-filete pt-4">
        <button type="button" onClick={onCancelar} className="gz-boton-borde">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="gz-boton-tinta disabled:cursor-not-allowed disabled:opacity-40">
          {guardando ? 'Guardando…' : duplicado ? 'Dar de alta de todos modos' : 'Dar de alta'}
        </button>
      </div>
    </form>
  )
}
