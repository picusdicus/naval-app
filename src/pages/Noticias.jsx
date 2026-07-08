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

// Formatea la fecha para mostrar "hace X días" o la fecha
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
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
          Muro de noticias
        </h1>
        <p className="mt-1 text-on-surface-variant">
          Mantente al día de los últimos acontecimientos y avisos importantes del pueblo.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <MIcon name="account_balance" className="text-primary" />
          <h2 className="nv-section-title">Noticias oficiales</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {oficiales.map((n) => (
            <article key={n.titulo} className="nv-card p-5 transition-shadow hover:shadow-card-lg">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary-container p-3 text-on-primary-container">
                  <MIcon name={n.icono} />
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-on-surface">{n.titulo}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{n.resumen}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-secondary">
                    Ayuntamiento · {n.cuando}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MIcon name="forum" className="text-primary" />
            <h2 className="nv-section-title">Tablón vecinal</h2>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary-container active:scale-95"
          >
            Publicar aviso
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {tablon.map((n) => (
            <div key={n.titulo} className="nv-card flex items-start gap-4 p-4">
              <div className="rounded-full bg-secondary-container p-2.5 text-on-secondary-container">
                <MIcon name={n.icono} className="text-[20px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">{n.titulo}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {n.autor} · {n.cuando}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-on-surface-variant">
          La publicación abierta de avisos estará disponible próximamente.
        </p>
      </section>
    </div>
  )
}
