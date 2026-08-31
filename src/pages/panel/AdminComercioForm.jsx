import { useEffect, useState, useCallback } from 'react'
import MIcon from '../../components/MIcon.jsx'
import SelectorImagen from '../../components/admin/SelectorImagen.jsx'
import SelectorImagenesMultiples from '../../components/admin/SelectorImagenesMultiples.jsx'
import DialogoConfirmacion from '../../components/admin/DialogoConfirmacion.jsx'
import {
  diasSemana,
  diasDisplay,
  horariosVacios,
  horarioValido,
  normalizarHorarios,
  normalizarDia,
  MAX_FRANJAS,
} from '../../lib/horarios.js'
import { optimizarImagen, validarImagen } from '../../lib/imageOptimizer.js'
import { buscarComercioEnJson } from '../../lib/comerciosHelper.js'
import comercios from '../../data/comercios.json'
import servicios from '../../data/servicios-locales.json'

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
  const [fotos, setFotos] = useState([])
  const [web, setWeb] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [facebook, setFacebook] = useState('')
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [tiktok, setTiktok] = useState('')

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/admin/comercio-perfil')
      if (respuesta.status === 401) throw new Error('No autenticado')
      if (!respuesta.ok) throw new Error('No se pudieron cargar los datos')

      const datos = await respuesta.json()
      setComercioId(datos.comercioId)

      // Buscar comercio en JSON para pre-llenar datos
      const comercioJson = buscarComercioEnJson(datos.comercioId, comercios, servicios)

      if (datos.perfil) {
        // Perfil ya existe: cargar datos del perfil (tiene prioridad)
        setPerfil(datos.perfil)
        setDescripcion(datos.perfil.descripcion || '')
        setHorarios(normalizarHorarios(datos.perfil.horarios || horariosVacios()))
        setFotoPrincipal(datos.perfil.foto_principal || null)
        setFotos(datos.perfil.fotos || [])
        setWeb(datos.perfil.web || '')
        setTelefono(datos.perfil.telefono || '')
        setDireccion(datos.perfil.direccion || '')
        setLat(datos.perfil.lat ? String(datos.perfil.lat) : '')
        setLng(datos.perfil.lng ? String(datos.perfil.lng) : '')
        setLinkedin(datos.perfil.linkedin || '')
        setFacebook(datos.perfil.facebook || '')
        setInstagram(datos.perfil.instagram || '')
        setTwitter(datos.perfil.twitter || '')
        setTiktok(datos.perfil.tiktok || '')
      } else if (comercioJson) {
        // Primer perfil: pre-llenar con datos del JSON
        setPerfil(null)
        setDescripcion(comercioJson.descripcion || '')
        setHorarios(normalizarHorarios(comercioJson.horarios || horariosVacios()))
        setFotoPrincipal(comercioJson.foto || comercioJson.fotoPrincipal || null)
        setFotos(comercioJson.fotos || [])
        setWeb(comercioJson.web || '')
        setTelefono(comercioJson.telefono || '')
        setDireccion(comercioJson.direccion || '')
        setLat(comercioJson.lat ? String(comercioJson.lat) : '')
        setLng(comercioJson.lng ? String(comercioJson.lng) : '')
        setLinkedin('')
        setFacebook('')
        setInstagram(comercioJson.instagram || '')
        setTwitter('')
        setTiktok('')
      } else {
        // Sin perfil ni datos JSON
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
    if (!fotoPrincipal || !String(fotoPrincipal).trim()) {
      setError('La foto principal es obligatoria')
      setGuardando(false)
      return
    }

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

    // Validar redes sociales
    if (linkedin.length > 255 || facebook.length > 255 || instagram.length > 255 || twitter.length > 255 || tiktok.length > 255) {
      setError('Los enlaces de redes sociales no pueden superar 255 caracteres')
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
      // Subir fotos adicionales si las hay
      let fotosSubidas = fotos
      if (fotos.length > 0) {
        // Filtrar fotos base64 (las que aún no se han subido)
        const fotosBase64 = fotos.filter(f => f && f.startsWith('data:image'))

        if (fotosBase64.length > 0) {
          const respuestaFotos = await fetch('/api/admin/imagen-comercio-adicional', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagenes: fotosBase64 }),
          })

          const datosFotos = await respuestaFotos.json()
          if (!respuestaFotos.ok) {
            throw new Error(datosFotos.error || 'Error al subir fotos')
          }

          // Reemplazar base64 con URLs subidas
          fotosSubidas = fotos.map(f => {
            if (f && f.startsWith('data:image')) {
              const idx = fotosBase64.indexOf(f)
              return datosFotos.urls[idx]
            }
            return f
          })
        }
      }

      const respuesta = await fetch('/api/admin/comercio-perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: descripcion || null,
          horarios: horarios || null,
          fotoPrincipal,
          fotos: fotosSubidas,
          web: web || null,
          telefono: telefono || null,
          direccion: direccion || null,
          lat: latNum,
          lng: lngNum,
          linkedin: linkedin || null,
          facebook: facebook || null,
          instagram: instagram || null,
          twitter: twitter || null,
          tiktok: tiktok || null,
        }),
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.error || 'Error al guardar')
      }

      setPerfil(datos.perfil)
      setFotos(datos.perfil.fotos || [])
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

  // Cambia una hora de una franja concreta. normalizarDia() mantiene al día el
  // espejo apertura/cierre de la primera franja (ver src/lib/horarios.js).
  const cambiarFranja = (dia, indice, campo, valor) => {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.dia !== dia) return h
        const franjas = h.franjas.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f))
        return normalizarDia({ ...h, franjas })
      })
    )
  }

  const anadirFranja = (dia) => {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.dia !== dia || h.franjas.length >= MAX_FRANJAS) return h
        return normalizarDia({ ...h, franjas: [...h.franjas, { apertura: '17:00', cierre: '20:00' }] })
      })
    )
  }

  const quitarFranja = (dia, indice) => {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.dia !== dia || h.franjas.length <= 1) return h
        return normalizarDia({ ...h, franjas: h.franjas.filter((_, i) => i !== indice) })
      })
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
            Foto Principal <span className="text-terracota">*</span>
          </label>
          <SelectorImagen
            valor={fotoPrincipal}
            onChange={setFotoPrincipal}
            etiqueta="Foto principal (16:9 · 1920 × 1080 px recomendado, hasta 3 MB)"
            opcional={false}
          />
          {/* El hero del perfil público es una banda a sangre (320 px de alto en
              móvil, 384 px desde tablet) con object-cover: de una foto solo se
              ve su franja central. Ver src/pages/PerfilComercio.jsx. */}
          <p className="mt-2 font-serif-spectral text-xs text-pardo">
            Se muestra como banda ancha en la cabecera de tu ficha: deja el motivo
            centrado, porque los bordes superior e inferior se recortan.
          </p>
          {fotoPrincipal && (
            <p className="mt-2 text-xs text-verde">
              ✓ Foto principal cargada
            </p>
          )}
          {!fotoPrincipal && (
            <p className="mt-2 text-xs text-terracota">
              Obligatoria para poder guardar
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
                  <div className="flex flex-col gap-1">
                    {h.franjas.map((f, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          type="time"
                          aria-label={`${DIAS_DISPLAY[h.dia]}: apertura franja ${i + 1}`}
                          value={f.apertura}
                          onChange={(e) => cambiarFranja(h.dia, i, 'apertura', e.target.value)}
                          className="gz-input w-20"
                        />
                        <span className="self-center text-xs text-pardo">–</span>
                        <input
                          type="time"
                          aria-label={`${DIAS_DISPLAY[h.dia]}: cierre franja ${i + 1}`}
                          value={f.cierre}
                          onChange={(e) => cambiarFranja(h.dia, i, 'cierre', e.target.value)}
                          className="gz-input w-20"
                        />
                        {h.franjas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => quitarFranja(h.dia, i)}
                            aria-label={`Quitar franja ${i + 1} de ${DIAS_DISPLAY[h.dia]}`}
                            className="text-pardo hover:text-terracota"
                          >
                            <MIcon name="close" className="text-[16px]" />
                          </button>
                        )}
                      </div>
                    ))}
                    {h.franjas.length < MAX_FRANJAS && (
                      <button
                        type="button"
                        onClick={() => anadirFranja(h.dia)}
                        className="self-start font-mono-ibm text-[10px] uppercase text-terracota hover:underline"
                      >
                        + Añadir franja
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fotos Adicionales */}
        <div className="gz-tarjeta-impresa p-4">
          <SelectorImagenesMultiples
            imagenes={fotos}
            onCargar={setFotos}
            maxImagenes={5}
            etiqueta="Fotos adicionales (máximo 5)"
          />
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

        {/* Redes Sociales */}
        <div className="gz-tarjeta-impresa p-4">
          <label className="mb-3 block font-serif-dm text-sm font-semibold text-tinta">
            Redes sociales (opcional)
          </label>
          <div className="space-y-3">
            <div>
              <label htmlFor="facebook" className="mb-1 flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                <MIcon name="facebook" className="text-[14px]" />
                Facebook
              </label>
              <input
                id="facebook"
                type="url"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/tuempresa"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="instagram" className="mb-1 flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                <MIcon name="instagram" className="text-[14px]" />
                Instagram
              </label>
              <input
                id="instagram"
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/tuempresa"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="twitter" className="mb-1 flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                <MIcon name="twitter" className="text-[14px]" />
                Twitter/X
              </label>
              <input
                id="twitter"
                type="url"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://twitter.com/tuempresa"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="linkedin" className="mb-1 flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                <MIcon name="linked_in" className="text-[14px]" />
                LinkedIn
              </label>
              <input
                id="linkedin"
                type="url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/company/tuempresa"
                className="gz-input"
              />
            </div>

            <div>
              <label htmlFor="tiktok" className="mb-1 flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                <MIcon name="music_note" className="text-[14px]" />
                TikTok
              </label>
              <input
                id="tiktok"
                type="url"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="https://tiktok.com/@tuempresa"
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
