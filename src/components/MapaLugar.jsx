import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Marcador teardrop en terracota (La Gaceta). divIcon para evitar el bug de las
// rutas de marker-icon.png de Leaflet al empaquetar con Vite (mismo enfoque que
// MapaComercios).
const ICONO = L.divIcon({
  className: 'lugar-marker',
  html: `<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;
    background:#b0472f;transform:rotate(-45deg);border:2px solid #f4efe1;
    box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
})

// Mini-mapa de un único punto para la ficha de evento: centrado en el lugar, un
// marcador, sin scroll-zoom. Borde de tinta, coherente con la estética impresa.
export default function MapaLugar({ lat, lng, nombre }) {
  return (
    <div className="aspect-[16/9] w-full overflow-hidden border border-tinta">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={ICONO} title={nombre} />
      </MapContainer>
    </div>
  )
}
