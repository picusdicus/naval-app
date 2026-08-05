import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIAS } from '../../lib/categorias.js'
import { etiquetasCocina } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'
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

// Ficha de comercio desplegada bajo su fila (La Gaceta): tarjeta impresa con
// inicial de color, datos de contacto en filas discontinuas y acciones a
// Google Maps. Se muestra solo para el comercio activo (accordion en Mapa.jsx).
export default function ComercioDetalle({ comercio, onCerrar }) {
  const [perfil, setPerfil] = useState(null)
  const [dialogoReclamarAbierto, setDialogoReclamarAbierto] = useState(false)

  // Cargar perfil para saber si el comercio está reclamado
  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        const respuesta = await fetch(`/api/comercios/${comercio.id}/perfil`)
        if (respuesta.ok) {
          const datos = await respuesta.json()
          setPerfil(datos.perfil)
        }
      } catch (err) {
        console.warn('No se pudo cargar el perfil:', err)
      }
    }

    cargarPerfil()
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

  return (
    <div className="gz-tarjeta-impresa animate-rise p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 flex-none items-center justify-center font-serif-dm text-2xl text-papel"
            style={{ backgroundColor: cat?.color || '#4a5b41' }}
          >
            <IconoCategoria categoria={comercio.categoria} className="text-[24px]" fill />
          </span>
          <div>
            <h3 className="font-serif-dm text-xl leading-tight text-tinta">{comercio.nombre}</h3>
            <p className="gz-label mt-0.5">
              {cat?.nombre}
              {comercio.ejemplo && ' · ejemplo'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar ficha"
          className="p-1 text-pardo transition-colors hover:text-terracota"
        >
          <MIcon name="close" className="text-[20px]" />
        </button>
      </div>

      {comercio.cerradoTemporal && (
        <p className="mt-3 flex items-center gap-2 border border-terracota bg-terracota-fondo px-3 py-2 font-mono-ibm text-[10.5px] uppercase tracking-etiqueta text-terracota">
          <MIcon name="warning" className="text-[16px]" />
          Cerrado temporalmente
        </p>
      )}

      {cocinas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
          {cocinas.map((c) => (
            <span key={c} className="bg-papel-calido px-2.5 py-1 text-pardo">
              {c}
            </span>
          ))}
        </div>
      )}

      {atributos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-verde-bosque">
          {atributos.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <MIcon name={ETIQUETA_ATRIBUTO[k].icono} className="text-[15px]" />
              {ETIQUETA_ATRIBUTO[k].texto}
            </span>
          ))}
        </div>
      )}

      {comercio.descripcion && (
        <p className="mt-3 font-serif-spectral text-sm text-tinta-suave">{comercio.descripcion}</p>
      )}

      <dl className="mt-4 space-y-2.5 font-serif-spectral text-sm text-tinta">
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

      <div className="mt-4 flex flex-col gap-2">
        {tieneCoords && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={comoLlegar}
              target="_blank"
              rel="noreferrer"
              className="gz-boton-tinta flex flex-1 items-center justify-center gap-2"
            >
              <MIcon name="directions" className="text-[16px]" />
              Cómo llegar
            </a>
            <a
              href={verEnGoogleMaps}
              target="_blank"
              rel="noreferrer"
              className="gz-boton-borde flex flex-1 items-center justify-center gap-2 hover:bg-papel-calido"
            >
              <MIcon name="map" className="text-[16px]" />
              Ver en Google Maps
            </a>
          </div>
        )}
        {perfil ? (
          <Link
            to={`/comercios/${comercio.id}`}
            className="gz-boton-tinta flex items-center justify-center gap-2"
          >
            <MIcon name="info" className="text-[16px]" />
            Más información
          </Link>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDialogoReclamarAbierto(true)
            }}
            className="gz-boton-tinta flex items-center justify-center gap-2"
          >
            <MIcon name="verified_user" className="text-[16px]" />
            Reclamar comercio
          </button>
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
