import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CENTRO = [40.2881, -4.0128]

// Marcador propio (divIcon) en los verdes del tema "Civic Hearth" — evita el
// bug conocido de las rutas de marker-icon.png de Leaflet al empaquetar con Vite.
function iconoDe(categoria, activo) {
  const color = activo ? '#006c48' : '#0f5238'
  const size = activo ? 30 : 22
  const border = activo ? '#92f7c3' : '#fff8f2'
  return L.divIcon({
    className: 'comercio-marker',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);border:2px solid ${border};
      box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  })
}

function AjustarVista({ comercios }) {
  const map = useMap()
  useEffect(() => {
    if (!comercios.length) return
    const bounds = L.latLngBounds(comercios.map((c) => [c.lat, c.lng]))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
  }, [comercios, map])
  return null
}

// Al seleccionar un comercio, acerca y centra el mapa en su ubicación.
function CentrarSeleccion({ seleccionado }) {
  const map = useMap()
  useEffect(() => {
    if (!seleccionado) return
    if (typeof seleccionado.lat !== 'number' || typeof seleccionado.lng !== 'number') return
    map.flyTo([seleccionado.lat, seleccionado.lng], 17, { duration: 0.6 })
  }, [seleccionado, map])
  return null
}

export default function MapaComercios({ comercios, seleccionado, onSeleccionar }) {
  return (
    <div className="overflow-hidden rounded-xl shadow-card">
      <MapContainer
        center={CENTRO}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '320px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {comercios.map((c) => (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={iconoDe(c.categoria, seleccionado?.id === c.id)}
            eventHandlers={{ click: () => onSeleccionar(c) }}
          />
        ))}
        <AjustarVista comercios={comercios} />
        <CentrarSeleccion seleccionado={seleccionado} />
      </MapContainer>
    </div>
  )
}
