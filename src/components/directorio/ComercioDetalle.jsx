import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIAS } from '../../lib/categorias.js'
import { etiquetasCocina } from '../../lib/cocinas.js'
import { cartelDe } from '../../lib/gaceta.js'
import MIcon from '../MIcon.jsx'
import DialogoReclamarComercio from './DialogoReclamarComercio.jsx'

function normalizarWeb(web) {
  if (!web) return ''
  return web.startsWith('http') ? web : `https://${web}`
}

// Atributos prácticos que trae Google Places (solo se guardan los afirmativos).
const ETIQUETA_ATRIBUTO = {
  terraza: { icono: 'deck', texto: 'Terraza' },
  paraLlevar: { icono: 'takeout_dining', texto: 'Para llevar' },
  aDomicilio: { icono: 'delivery_dining', texto: 'A domicilio' },
  reservas: { icono: 'event_available', texto: 'Reservas' },
  vegetariano: { icono: 'eco', texto: 'Opción vegetariana' },
  accesible: { icono: 'accessible', texto: 'Accesible' },
  tarjeta: { icono: 'credit_card', texto: 'Acepta tarjeta' },
  soloEfectivo: { icono: 'payments', texto: 'Solo efectivo' },
}

// Pastillas de acción de la ficha (mismas proporciones que las de la ficha
// pública del comercio): la principal en tinta, las demás con filete.
const PRINCIPAL =
  'inline-flex items-center justify-center gap-2 rounded-full bg-tinta px-5 py-3 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-papel transition-opacity hover:opacity-90'
const SECUNDARIO =
  'inline-flex items-center justify-center gap-2 rounded-full border border-filete px-5 py-3 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-tinta transition-colors hover:bg-papel-calido'

// Gradiente de cartel por categoría, para la cabecera cuando el comercio no
// tiene foto (mismo criterio que las miniaturas del listado en ComercioCard).
const GRADIENTE_POR_CATEGORIA = {
  alimentacion: 'salvia',
  restauracion: 'terracota',
  salud: 'bosque',
  belleza: 'granate',
  moda: 'granate',
  hogar: 'azul',
  servicios: 'ocre',
  servicios_prof: 'azul',
  deporte: 'azul',
  ocio_cultura: 'granate',
  educacion: 'pardo',
}

// Ficha rápida del comercio, desplegada justo bajo su fila del listado
// (accordion en Mapa.jsx). Cabecera a sangre con la foto del perfil (o el
// cartel de la casa), datos de contacto y acciones. Mismo lenguaje visual que
// la fila: cuadrada en móvil ("impresa"), redondeada en escritorio.
export default function ComercioDetalle({ comercio, onCerrar, esReclamacionPendiente = false, tieneAprobada: tieneAprobadaProp = false }) {
  const [perfil, setPerfil] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [orgId, setOrgId] = useState(null)
  const [tienePendiente, setTienePendiente] = useState(esReclamacionPendiente)
  const [tieneAprobada, setTieneAprobada] = useState(tieneAprobadaProp)
  const [dialogoReclamarAbierto, setDialogoReclamarAbierto] = useState(false)

  // Cargar perfil y verificar si el usuario es admin
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // Perfil enriquecido (foto, descripción): decide si la ficha se ve
        // "reclamada" y qué botón se ofrece. Ojo con la ruta: los ids llevan
        // barras (`local/…`), así que va por query, no por segmento de path.
        const respuestaPerfil = await fetch(
          `/api/comercio-perfil?id=${encodeURIComponent(comercio.id)}`,
        )
        if (respuestaPerfil.ok) {
          const datos = await respuestaPerfil.json()
          setPerfil(datos.perfil)
        }

        // Verificar si el usuario es admin del comercio
        const respuestaAdmin = await fetch(`/api/comercio-admin?id=${comercio.id}`)
        if (respuestaAdmin.ok) {
          const datos = await respuestaAdmin.json()
          setEsAdmin(datos.esAdmin)
          setOrgId(datos.orgId)
        }

        // Verificar estado de reclamación (sobrescribe las props)
        const respuestaReclamacion = await fetch(`/api/comercio-reclamacion?id=${comercio.id}`)
        if (respuestaReclamacion.ok) {
          const datos = await respuestaReclamacion.json()
          setTienePendiente(datos.tienePendiente)
          setTieneAprobada(datos.tieneAprobada)
        }
      } catch (err) {
        console.warn('No se pudieron cargar los datos:', err)
      }
    }

    cargarDatos()
  }, [comercio.id])

  const cat = CATEGORIAS[comercio.categoria]
  const tieneCoords = typeof comercio.lat === 'number' && typeof comercio.lng === 'number'
  const cocinas = etiquetasCocina(comercio.cocina || [])
  // API oficial de URLs de Google Maps (gratuita, sin clave): direcciones y
  // ficha del negocio (fotos, reseñas, horarios) buscando por nombre + municipio.
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${comercio.lat},${comercio.lng}`
  // Con `mapsUrl` (ficha exacta que devuelve Places) no hace falta buscar por
  // nombre, que a veces cae en el negocio equivocado.
  const verEnGoogleMaps =
    comercio.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${comercio.nombre}, Navalcarnero`,
    )}`
  const web = normalizarWeb(comercio.web)
  const atributos = Object.keys(comercio.atributos || {}).filter((k) => ETIQUETA_ATRIBUTO[k])

  const foto = perfil?.foto_principal || perfil?.fotoPrincipal || comercio.foto
  const cartel = cartelDe(GRADIENTE_POR_CATEGORIA[comercio.categoria] || 'pardo')
  const descripcion = perfil?.descripcion || comercio.descripcion

  return (
    <div className="animate-rise overflow-hidden border border-tinta bg-papel lg:rounded-lg lg:shadow-tarjeta-gaceta">
      {/* CABECERA A SANGRE: foto del perfil o cartel de la casa */}
      <div className="relative h-36 overflow-hidden sm:h-40">
        {foto ? (
          <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className={`absolute inset-0 ${cartel.trama}`}
            style={{ background: cartel.fondo }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30"
        >
          <MIcon name="close" className="text-[18px]" />
        </button>

        <div className="absolute inset-x-4 bottom-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif-dm text-2xl leading-none text-white">{comercio.nombre}</h3>
            {perfil && (
              <span className="inline-flex items-center gap-1 rounded-full bg-oro px-2 py-[3px] font-mono-ibm text-[8.5px] uppercase tracking-etiqueta text-tinta">
                ✓ Verificado
              </span>
            )}
          </div>
          <p className="mt-1 font-mono-ibm text-[9px] uppercase tracking-rotulo text-white/75">
            {cat?.nombre}
            {comercio.ejemplo && ' · ejemplo'}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
      {comercio.cerradoTemporal && (
        <p className="mb-3 flex items-center gap-2 border border-terracota bg-terracota-fondo px-3 py-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-terracota">
          <MIcon name="warning" className="text-[16px]" />
          Cerrado temporalmente
        </p>
      )}

      {cocinas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
          {cocinas.map((c) => (
            <span key={c} className="bg-papel-calido px-2.5 py-1 text-pardo">
              {c}
            </span>
          ))}
        </div>
      )}

      {atributos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-verde-bosque">
          {atributos.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <MIcon name={ETIQUETA_ATRIBUTO[k].icono} className="text-[15px]" />
              {ETIQUETA_ATRIBUTO[k].texto}
            </span>
          ))}
        </div>
      )}

      {descripcion && (
        <p className="mb-3 font-serif-spectral text-sm text-tinta-suave">{descripcion}</p>
      )}

      <dl className="space-y-2.5 font-serif-spectral text-sm text-tinta">
        {comercio.direccion && (
          <div className="flex items-start gap-2">
            <MIcon name="location_on" className="mt-0.5 text-[18px] text-terracota" />
            <span>{comercio.direccion}</span>
          </div>
        )}
        {comercio.telefono && (
          <div className="flex items-center gap-2">
            <MIcon name="call" className="text-[18px] text-terracota" />
            <a href={`tel:${comercio.telefono}`} className="underline-offset-2 hover:underline">
              {comercio.telefono}
            </a>
          </div>
        )}
        {web && (
          <div className="flex items-center gap-2">
            <MIcon name="language" className="text-[18px] text-terracota" />
            <a
              href={web}
              target="_blank"
              rel="noreferrer"
              className="truncate underline-offset-2 hover:underline"
            >
              {comercio.web}
            </a>
          </div>
        )}
        {comercio.horario && (
          <div className="flex items-start gap-2">
            <MIcon name="schedule" className="mt-0.5 text-[18px] text-terracota" />
            <span>{comercio.horario}</span>
          </div>
        )}
        {!comercio.direccion && !comercio.telefono && !web && !comercio.horario && (
          <p className="font-mono-ibm text-xs text-mudo">
            Sin datos de contacto todavía. ¿Los conoces? Sugiere una corrección.
          </p>
        )}
      </dl>

      {/* Acciones: pastillas como en el resto de la ficha pública. La primera
          (tinta) es la principal según el estado de reclamación del comercio. */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {perfil || (tieneAprobada && !esAdmin) ? (
          esAdmin ? (
            <Link to={`/panel?org=${comercio.id}`} className={`${PRINCIPAL} flex-1`}>
              <MIcon name="edit" className="text-[16px]" />
              Mi comercio
            </Link>
          ) : (
            <Link to={`/comercios/${comercio.id}`} className={`${PRINCIPAL} flex-1`}>
              <MIcon name="info" className="text-[16px]" />
              Ver ficha
            </Link>
          )
        ) : tienePendiente ? (
          <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-terracota-palido bg-terracota-fondo px-5 py-3 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-terracota">
            <MIcon name="access_time" className="text-[16px]" />
            Reclamación en revisión
          </span>
        ) : tieneAprobada && esAdmin ? (
          <Link to={`/panel?org=${comercio.id}`} className={`${PRINCIPAL} flex-1`}>
            <MIcon name="edit" className="text-[16px]" />
            Crear perfil comercial
          </Link>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDialogoReclamarAbierto(true)
            }}
            className={`${PRINCIPAL} flex-1`}
          >
            <MIcon name="verified_user" className="text-[16px]" />
            Reclamar comercio
          </button>
        )}

        {tieneCoords && (
          <a href={comoLlegar} target="_blank" rel="noreferrer" className={`${SECUNDARIO} flex-1`}>
            <MIcon name="directions" className="text-[16px]" />
            Cómo llegar
          </a>
        )}
      </div>

      {tieneCoords && (
        <a
          href={verEnGoogleMaps}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-terracota transition-opacity hover:opacity-80"
        >
          <MIcon name="map" className="text-[15px]" />
          Ver en Google Maps
        </a>
      )}
      </div>

      {/* Diálogo de reclamación */}
      <DialogoReclamarComercio
        abierto={dialogoReclamarAbierto}
        comercioId={comercio.id}
        comercioNombre={comercio.nombre}
        onCerrar={() => setDialogoReclamarAbierto(false)}
      />
    </div>
  )
}
