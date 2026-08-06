import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import DialogoReclamarComercio from '../components/directorio/DialogoReclamarComercio.jsx'
import comercios from '../data/comercios.json'
import servicios from '../data/servicios-locales.json'
import { datoComercio } from '../lib/comerciosHelper.js'
import { formatearHorarios } from '../lib/horarios.js'

export default function PerfilComercio() {
  const { id } = useParams()
  const [comercio, setComercio] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [organizacion, setOrganizacion] = useState(null)
  const [reclamacionPendiente, setReclamacionPendiente] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarReclamar, setMostrarReclamar] = useState(false)
  const [dialogoReclamarAbierto, setDialogoReclamarAbierto] = useState(false)

  useEffect(() => {
    // Buscar comercio en los JSONs
    let encontrado = comercios.find((c) => c.id === id)
    if (!encontrado) {
      encontrado = servicios.find((c) => c.id === id)
    }

    if (!encontrado) {
      setError('Comercio no encontrado')
      setCargando(false)
      return
    }

    setComercio(encontrado)

    // Cargar perfil y organización vinculada si existe
    const cargarDatos = async () => {
      try {
        // Cargar perfil del comercio
        const respuestaPerfil = await fetch(`/api/comercios/${id}/perfil`)
        if (respuestaPerfil.ok) {
          const datos = await respuestaPerfil.json()
          setPerfil(datos.perfil)

          // Si hay perfil, obtener la organización vinculada
          if (datos.perfil?.organizacion_id) {
            try {
              const respuestaOrg = await fetch(`/api/admin/organizacion?id=${datos.perfil.organizacion_id}`)
              if (respuestaOrg.ok) {
                const dataOrg = await respuestaOrg.json()
                setOrganizacion(dataOrg)
              }
            } catch (err) {
              console.warn('No se pudo cargar la organización:', err)
            }
          }
        }

        // Verificar si hay reclamación pendiente
        const respuestaReclamacion = await fetch(`/api/comercios/${id}/reclamacion-pendiente`)
        if (respuestaReclamacion.ok) {
          const datos = await respuestaReclamacion.json()
          setReclamacionPendiente(datos.tienePendiente)
        }
      } catch (err) {
        console.warn('No se pudieron cargar los datos:', err)
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [id])

  if (cargando) {
    return (
      <div className="min-h-screen bg-papel-lienzo flex items-center justify-center">
        <p className="font-serif-spectral text-pardo">Cargando…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-papel-lienzo flex flex-col items-center justify-center gap-4 px-4">
        <MIcon name="location_off" className="text-[48px] text-mudo" />
        <p className="font-serif-dm text-xl text-tinta">{error}</p>
        <Link to="/comercios" className="gz-boton-tinta">
          Volver al directorio
        </Link>
      </div>
    )
  }

  if (!comercio) return null

  const nombre = datoComercio(perfil, comercio, 'nombre')
  const fotoPrincipal = datoComercio(perfil, comercio, 'fotoPrincipal') ||
                        datoComercio(perfil, comercio, 'foto')
  const descripcion = datoComercio(perfil, comercio, 'descripcion')
  const horarios = datoComercio(perfil, comercio, 'horarios')
  const web = datoComercio(perfil, comercio, 'web')
  const telefono = datoComercio(perfil, comercio, 'telefono')
  const direccion = datoComercio(perfil, comercio, 'direccion')
  const lat = datoComercio(perfil, comercio, 'lat')
  const lng = datoComercio(perfil, comercio, 'lng')

  return (
    <div className="min-h-screen bg-papel-lienzo">
      {/* Encabezado con foto */}
      <div className="relative h-64 bg-gradient-to-b from-papel-calido to-papel sm:h-80">
        {fotoPrincipal ? (
          <img
            src={fotoPrincipal}
            alt={nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MIcon name="storefront" className="text-[80px] text-mudo opacity-20" />
          </div>
        )}
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Título y info rápida */}
        <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif-dm text-3xl text-tinta">{nombre}</h1>
            {comercio.categoria && (
              <p className="mt-1 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-pardo">
                {comercio.categoria}
              </p>
            )}
          </div>

          {!perfil ? (
            reclamacionPendiente ? (
              <div className="inline-flex items-center gap-2 rounded border border-terracota/30 bg-terracota-fondo px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota">
                <MIcon name="access_time" className="text-[16px]" />
                Reclamación en revisión
              </div>
            ) : (
              <button
                onClick={() => setDialogoReclamarAbierto(true)}
                className="gz-boton-tinta inline-flex items-center gap-2"
              >
                <MIcon name="verified_user" className="text-[16px]" />
                Reclamar comercio
              </button>
            )
          ) : organizacion ? (
            <Link
              to={`/panel?org=${organizacion.slug}`}
              className="gz-boton-tinta inline-flex items-center gap-2"
            >
              <MIcon name="dashboard" className="text-[16px]" />
              Mi panel
            </Link>
          ) : null}
        </div>

        {/* Contenido principal */}
        <div className="space-y-6">
          {/* Descripción */}
          {descripcion && (
            <div className="gz-tarjeta-impresa border border-tinta p-4 sm:p-6">
              <h2 className="mb-3 font-serif-dm text-lg text-tinta">Sobre nosotros</h2>
              <p className="font-serif-spectral text-sm leading-relaxed text-pardo">
                {descripcion}
              </p>
            </div>
          )}

          {/* Horarios */}
          {horarios && (
            <div className="gz-tarjeta-impresa border border-tinta p-4 sm:p-6">
              <h2 className="mb-3 font-serif-dm text-lg text-tinta">Horarios</h2>
              <pre className="whitespace-pre-wrap font-mono-ibm text-[10px] text-pardo">
                {formatearHorarios(horarios)}
              </pre>
            </div>
          )}

          {/* Contacto */}
          <div className="gz-tarjeta-impresa border border-tinta p-4 sm:p-6">
            <h2 className="mb-4 font-serif-dm text-lg text-tinta">Contacto</h2>
            <div className="space-y-3">
              {telefono && (
                <div className="flex items-center gap-3">
                  <MIcon name="phone" className="flex-shrink-0 text-[18px] text-terracota" />
                  <a href={`tel:${telefono}`} className="font-serif-spectral text-sm text-pardo hover:text-terracota">
                    {telefono}
                  </a>
                </div>
              )}

              {web && (
                <div className="flex items-center gap-3">
                  <MIcon name="language" className="flex-shrink-0 text-[18px] text-terracota" />
                  <a href={web} target="_blank" rel="noopener noreferrer" className="font-serif-spectral text-sm text-pardo hover:text-terracota">
                    {web}
                  </a>
                </div>
              )}

              {direccion && (
                <div className="flex items-start gap-3">
                  <MIcon name="location_on" className="mt-0.5 flex-shrink-0 text-[18px] text-terracota" />
                  <p className="font-serif-spectral text-sm text-pardo">{direccion}</p>
                </div>
              )}
            </div>
          </div>

          {/* Mapa */}
          {lat && lng && (
            <div className="gz-tarjeta-impresa border border-tinta p-4 sm:p-6">
              <h2 className="mb-3 font-serif-dm text-lg text-tinta">Ubicación</h2>
              <div className="h-64 w-full overflow-hidden border border-filete">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`}
                  style={{ border: 0 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* CTA volver */}
        <div className="mt-8 flex gap-2">
          <Link to="/comercios" className="gz-boton-tinta inline-flex items-center gap-2">
            <MIcon name="arrow_back" className="text-[16px]" />
            Volver al directorio
          </Link>
        </div>
      </div>

      {/* Diálogo de reclamación */}
      <DialogoReclamarComercio
        abierto={dialogoReclamarAbierto}
        comercioId={id}
        comercioNombre={nombre}
        onCerrar={() => setDialogoReclamarAbierto(false)}
      />
    </div>
  )
}
