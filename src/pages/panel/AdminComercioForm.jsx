import { useEffect, useState, useCallback } from 'react'
import MIcon from '../../components/MIcon.jsx'
import SelectorImagen from '../../components/admin/SelectorImagen.jsx'
import DialogoConfirmacion from '../../components/admin/DialogoConfirmacion.jsx'
import { diasSemana, diasDisplay, horariosVacios, horarioValido } from '../../lib/horarios.js'
import { optimizarImagen, validarImagen } from '../../lib/imageOptimizer.js'

const DIAS_DISPLAY = diasDisplay()

function Estadistica({ icono, valor, etiqueta }) {
  return (
    <div className="gz-tarjeta-impresa flex flex-col items-start gap-2 p-3 sm:p-4">
      <MIcon name={icono} className="text-[18px] text-pardo" />
      <div>
        <p className="font-serif-dm text-xl text-terracota">{valor}</p>
        <p className="gz-label mt-1 text-pardo">{etiqueta}</p>
      </div>
    </div>
  )
}

export default function AdminComercioForm() {
  const [perfil, setPerfil] = useState(null)
  const [comercioId, setComercioId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Formulario
  const [descripcion, setDescripcion] = useState('')
  const [horarios, setHorarios] = useState(horariosVacios())
  const [fotoPrincipal, setFotoPrincipal] = useState(null)
  const [fotos, setFotos] = useState([null, null, null, null, null])
  const [web, setWeb] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/admin/comercio-perfil')
      if (respuesta.status === 401) throw new Error('No autenticado')
      if (!respuesta.ok) throw new Error('No se pudieron cargar los datos')

      const datos = await respuesta.json()
      setComercioId(datos.comercioId)

      if (datos.perfil) {
        setPerfil(datos.perfil)
        setDescripcion(datos.perfil.descripcion || '')
        setHorarios(datos.perfil.horarios || horariosVacios())
        setFotoPrincipal(datos.perfil.foto_principal || null)
        setFotos(datos.perfil.fotos || [null, null, null, null, null])
        setWeb(datos.perfil.web || '')
        setTelefono(datos.perfil.telefono || '')
        setDireccion(datos.perfil.direccion || '')
        setLat(datos.perfil.lat ? String(datos.perfil.lat) : '')
        setLng(datos.perfil.lng ? String(datos.perfil.lng) : '')
      } else {
        setPerfil(null)
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async () => {
    setGuardando(true)
    setError('')
    setExito('')

    // Validaciones
    if (descripcion.length > 1000) {
      setError('Descripción no puede superar 1000 caracteres')
      setGuardando(false)
      return
    }

    if (!horarioValido(horarios)) {
      setError('Horarios no válidos')
      setGuardando(false)
      return
    }

    if (web.length > 255) {
      setError('Web no puede superar 255 caracteres')
      setGuardando(false)
      return
    }

    if (telefono.length > 20) {
      setError('Teléfono no puede superar 20 caracteres')
      setGuardando(false)
      return
    }

    if (direccion.length > 255) {
      setError('Dirección no puede superar 255 caracteres')
      setGuardando(false)
      return
    }

    const latNum = lat ? parseFloat(lat) : null
    const lngNum = lng ? parseFloat(lng) : null
    if ((lat || lng) && (isNaN(latNum) || isNaN(lngNum))) {
      setError('Coordenadas deben ser números válidos')
      setGuardando(false)
      return
    }

    try {
      const respuesta = await fetch('/api/admin/comercio-perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: descripcion || null,
          horarios: horarios || null,
          fotoPrincipal,
          fotos,
          web: web || null,
          telefono: telefono || null,
          direccion: direccion || null,
          lat: latNum,
          lng: lngNum,
        }),
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al guardar')
      }

      setPerfil(datos.perfil)
      setExito('Perfil actualizado correctamente')
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const cambiarHorario = (dia, campo, valor) => {
    setHorarios((prev) =>
      prev.map((h) => (h.dia === dia ? { ...h, [campo]: valor } : h))
    )
  }

  if (cargando) {
    return <p className="font-serif-spectral text-sm text-pardo">Cargando perfil…</p>
  }

  if (!comercioId) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-filete-punteado px-6 py-12 text-center">
        <MIcon name="storefront" className="text-[40px] text-mudo" />
        <p className="font-serif-dm text-lg text-tinta">Sin comercio vinculado</p>
        <p className="max-w-sm font-serif-spectral text-sm text-pardo">
          Solicita la reclamación de tu comercio desde la página pública.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Estadistica icono="storefront" valor={comercioId} etiqueta="ID Comercio" />
        <Estadistica icono="check_circle" valor={perfil ? 'Sí' : 'No'} etiqueta="Perfil creado" />
      </div>

      <div className="space-y-4">
        {/* Foto Principal */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Foto Principal
          </label>
          <SelectorImagen
            etiqueta="Foto principal (4:3, hasta 3 MB)"
            opcional={true}
            onCargar={(datos, tipo) => setFotoPrincipal(datos)}
          />
          {fotoPrincipal && (
            <p className="mt-2 text-xs text-pardo">
              ✓ Foto principal cargada
            </p>
          )}
        </div>

        {/* Descripción */}
        <div className="gz-tarjeta-impresa p-4">
          <label htmlFor="descripcion" className="mb-2 block font-serif-dm text-sm font-semibold text-tinta">
            Descripción
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Cuéntanos sobre tu negocio…"
            maxLength={1000}
            className="gz-input h-24 resize-none"
          />
          <p className="mt-1 text-right font-mono-ibm text-[10px] text-pardo">
            {descripcion.length} / 1000
          </p>
        </div>

        {/* Horarios */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Horarios
          </label>
          <div className="space-y-2">
            {horarios.map((h) => (
              <div key={h.dia} className="flex flex-col gap-2 border-b border-filete pb-3 last:border-b-0 sm:flex-row sm:items-center">
                <label className="w-32 font-mono-ibm text-[10px] font-semibold uppercase text-tinta">
                  {DIAS_DISPLAY[h.dia]}
                </label>

                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.abierto}
                    onChange={(e) => cambiarHorario(h.dia, 'abierto', e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-pardo">Abierto</span>
                </div>

                {h.abierto && (
                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={h.apertura}
                      onChange={(e) => cambiarHorario(h.dia, 'apertura', e.target.value)}
                      className="gz-input w-20"
                    />
                    <span className="self-center text-xs text-pardo">–</span>
                    <input
                      type="time"
                      value={h.cierre}
                      onChange={(e) => cambiarHorario(h.dia, 'cierre', e.target.value)}
                      className="gz-input w-20"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fotos Adicionales */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Fotos adicionales (máximo 5)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {fotos.map((foto, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 border border-dashed border-filete bg-papel-calido" />
                <span className="font-mono-ibm text-[9px] text-pardo">Foto {idx + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-pardo">
            Funcionalidad de upload en progreso
          </p>
        </div>

        {/* Contacto */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Contacto
          </label>
          <div className="space-y-3">
            <div>
              <label htmlFor="web" className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Web
              </label>
              <input
                id="web"
                type="url"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
                placeholder="https://tuwebsite.com"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="telefono" className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Teléfono
              </label>
              <input
                id="telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="ej. +34 612 345 678"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="direccion" className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Dirección
              </label>
              <input
                id="direccion"
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle Principal, 123"
                className="gz-input"
              />
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Ubicación (opcional)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lat" className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Latitud
              </label>
              <input
                id="lat"
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="40.3741"
                className="gz-input"
              />
            </div>
            <div>
              <label htmlFor="lng" className="mb-1 block font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                Longitud
              </label>
              <input
                id="lng"
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-3.7274"
                className="gz-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="flex items-start gap-2 border border-terracota/30 bg-terracota-fondo p-3">
          <MIcon name="error" className="mt-0.5 flex-shrink-0 text-[20px] text-terracota" />
          <p className="font-serif-spectral text-sm text-terracota">{error}</p>
        </div>
      )}

      {exito && (
        <div className="flex items-start gap-2 border border-verde/30 bg-verde-fondo p-3">
          <MIcon name="check_circle" className="mt-0.5 flex-shrink-0 text-[20px] text-verde" />
          <p className="font-serif-spectral text-sm text-verde">{exito}</p>
        </div>
      )}

      {/* Botón Guardar */}
      <button
        onClick={guardar}
        disabled={guardando}
        className="gz-boton-tinta w-full disabled:opacity-50"
      >
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}
