import { Link } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import noticias from '../data/noticias.json'

// Iconos por defecto para noticias (podrían mejorarse según categoría)
function obtenerIcono(titulo) {
  const t = titulo.toLowerCase()
  if (t.includes('piscina') || t.includes('agua') || t.includes('playa')) return 'water'
  if (t.includes('deport') || t.includes('futbol') || t.includes('atletismo')) return 'sports_soccer'
  if (t.includes('cine') || t.includes('concierto') || t.includes('musica')) return 'theaters'
  if (t.includes('biblioteca') || t.includes('lectura')) return 'local_library'
  if (t.includes('salud') || t.includes('medico')) return 'local_hospital'
  if (t.includes('camara') || t.includes('comercio') || t.includes('negocio')) return 'storefront'
  if (t.includes('feria') || t.includes('fiesta') || t.includes('celebracion')) return 'celebration'
  if (t.includes('exposicion') || t.includes('museo') || t.includes('arte')) return 'gallery'
  if (t.includes('educacion') || t.includes('aula') || t.includes('escuela')) return 'school'
  if (t.includes('familia') || t.includes('joven')) return 'family_restroom'
  return 'notifications'
}

// Formatea la fecha para mostrar la fecha larga (día, mes, año)
function formatearFechaLarga(fechaISO) {
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// Formatea para mostrar "hace X días" (relativo)
function formatearCuando(fechaISO) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaISO)
  fecha.setHours(0, 0, 0, 0)
  const diasDif = Math.floor((hoy - fecha) / (24 * 60 * 60 * 1000))

  if (diasDif === 0) return 'hoy'
  if (diasDif === 1) return 'ayer'
  if (diasDif < 7) return `hace ${diasDif} días`
  if (diasDif < 30) return `hace ${Math.floor(diasDif / 7)} semanas`
  return `hace ${Math.floor(diasDif / 30)} meses`
}

const oficiales = noticias.slice(0, 6).map(n => ({
  ...n,
  icono: obtenerIcono(n.titulo),
  cuando: formatearCuando(n.fecha),
}))

const tablon = [
  {
    titulo: 'Se busca: perdida gata atigrada zona El Soto',
    autor: 'María G.',
    cuando: 'hace 5 horas',
    icono: 'pets',
  },
  {
    titulo: 'Vendo bicicleta infantil, buen estado',
    autor: 'Javier R.',
    cuando: 'hace 1 día',
    icono: 'pedal_bike',
  },
]

export default function Noticias() {
  return (
    <div className="mx-auto max-w-3xl">
      {/* Masthead */}
      <header className="gz-filete-doble pb-3">
        <div className="gz-label text-mudo">El muro de</div>
        <h1 className="font-serif-dm text-seccion leading-none text-tinta">Noticias</h1>
      </header>

      {/* Noticias oficiales */}
      <section className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <MIcon name="account_balance" className="text-[18px] text-terracota" />
          <h2 className="gz-eyebrow">Noticias oficiales</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {oficiales.map((n) => (
            <Link key={n.id} to={`/noticias/${n.id}`} className="gz-tarjeta-impresa p-5 transition-colors hover:bg-papel-calido">
              <article className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-none items-center justify-center bg-tinta text-papel">
                  <MIcon name={n.icono} className="text-[20px]" />
                </div>
                <div className="flex-1">
                  <p className="font-serif-dm text-lg leading-tight text-tinta">{n.titulo}</p>
                  <p className="mt-2 line-clamp-2 font-serif-spectral text-sm text-pardo">
                    {n.contenido || n.resumen}
                  </p>
                  <div className="mt-3 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                    {formatearFechaLarga(n.fecha)} · {n.cuando}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* Tablón vecinal */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MIcon name="forum" className="text-[18px] text-terracota" />
            <h2 className="gz-eyebrow">Tablón vecinal</h2>
          </div>
          <button type="button" className="gz-boton-tinta">
            Publicar aviso
          </button>
        </div>
        <div className="border border-tinta">
          {tablon.map((n, i) => (
            <div
              key={n.titulo}
              className={`flex items-start gap-3 p-3.5 ${i > 0 ? 'border-t border-dashed border-filete-punteado' : ''}`}
            >
              <MIcon name={n.icono} className="mt-0.5 text-[20px] text-pardo" />
              <div>
                <p className="font-serif-spectral text-sm font-semibold text-tinta">{n.titulo}</p>
                <p className="mt-0.5 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                  {n.autor} · {n.cuando}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
          La publicación abierta de avisos estará disponible próximamente.
        </p>
      </section>
    </div>
  )
}
