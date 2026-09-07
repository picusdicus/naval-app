import { Link } from 'react-router-dom'
import MIcon from '../../MIcon.jsx'

// Navegación del panel de superadmin en escritorio. Sustituye a la fila de
// tabs horizontal, que con once secciones ya solo se podía recorrer haciendo
// scroll lateral y no dejaba ver de un vistazo dónde había trabajo pendiente.
//
// Agrupada por lo que el superadmin viene a hacer (moderar, publicar
// contenido, gestionar el negocio), no por la tabla que hay detrás.
//
// La paleta `nocturno` es exclusiva de /admin: el backoffice es oscuro para
// que no se confunda con la app pública, que es "La Gaceta" sobre papel.

const ANCHO = 248

// [clave, icono, etiqueta, grupo]. El orden dentro de cada grupo es el de la
// navegación; los grupos se pintan en el orden de GRUPOS.
const GRUPOS = [
  {
    titulo: null, // "Resumen" no pertenece a ninguna familia: es la portada.
    items: [['resumen', 'dashboard', 'Resumen']],
  },
  {
    titulo: 'Moderación',
    items: [
      ['reclamaciones', 'verified_user', 'Reclamaciones'],
      ['altas', 'add_business', 'Altas'],
      ['pendientes', 'pending_actions', 'Pendientes'],
    ],
  },
  {
    titulo: 'Contenido',
    items: [
      ['eventos', 'event', 'Eventos'],
      ['talleres', 'school', 'Talleres'],
      ['comercios', 'storefront', 'Comercios'],
      ['imagenes', 'image', 'Imágenes genéricas'],
    ],
  },
  {
    titulo: 'Negocio',
    items: [
      ['destacados', 'star', 'Destacados'],
      ['organizaciones', 'business', 'Organizaciones'],
      // Etiqueta completa y no "Códigos": es el nombre que usa el resto del
      // panel (y el que buscan los e2e), y en 248 px cabe de sobra.
      ['codigos', 'card_giftcard', 'Códigos de invitación'],
    ],
  },
  {
    titulo: 'Datos',
    items: [['analytics', 'analytics', 'Analytics']],
  },
]

/**
 * Qué contador enseña cada sección, y con qué peso visual.
 *   'aviso'       — pastilla terracota: hay cola de trabajo sin despachar.
 *   'atencion'    — pastilla dorada: campañas de pago que requieren acción.
 *   'informativo' — número gris: contexto, no una tarea.
 * Devuelve null cuando esa sección no tiene contador (o el suyo falló y vale
 * null): nunca se inventa un 0.
 */
function contadorDe(clave, resumen) {
  if (!resumen) return null

  const aviso = (valor, texto) =>
    typeof valor === 'number' && valor > 0 ? { valor, tono: 'aviso', texto } : null

  switch (clave) {
    case 'reclamaciones':
      return aviso(resumen.reclamacionesPendientes, 'reclamaciones pendientes')
    case 'altas':
      return aviso(resumen.altasPendientes, 'altas de comercio pendientes')
    case 'pendientes': {
      const n = resumen.pendientesSync
      if (typeof n !== 'number') return null
      return n > 0
        ? { valor: n, tono: 'aviso', texto: 'borradores por revisar' }
        : { valor: 0, tono: 'informativo', texto: 'borradores por revisar' }
    }
    case 'destacados': {
      const n = resumen.destacadosRequierenAccion
      return typeof n === 'number' && n > 0
        ? { valor: n, tono: 'atencion', texto: 'destacados requieren acción' }
        : null
    }
    // Mientras haya propuestas de reimportación, el contador de Talleres es
    // esa cola; sin ellas no hay número informativo que enseñar (el resumen
    // no cuenta talleres, y el total del catálogo tampoco sería una tarea).
    case 'talleres':
      return aviso(resumen.propuestasTalleres, 'actualizaciones de talleres propuestas')
    case 'organizaciones':
      return typeof resumen.organizacionesActivas === 'number'
        ? { valor: resumen.organizacionesActivas, tono: 'informativo', texto: 'organizaciones activas' }
        : null
    case 'eventos':
      return typeof resumen.eventosPublicados === 'number'
        ? { valor: resumen.eventosPublicados, tono: 'informativo', texto: 'eventos publicados' }
        : null
    default:
      return null
  }
}

function Contador({ contador }) {
  if (!contador) return null
  const { valor, tono, texto } = contador
  const etiqueta = `${valor} ${texto}`

  if (tono === 'informativo') {
    return (
      <span className="font-mono-ibm text-[10.5px] text-nocturno-secundario" aria-label={etiqueta}>
        {valor}
      </span>
    )
  }

  const colores = tono === 'atencion' ? 'bg-oro text-tinta' : 'bg-terracota text-papel'
  return (
    <span
      className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center font-mono-ibm text-[10px] font-bold ${colores}`}
      aria-label={etiqueta}
    >
      {valor}
    </span>
  )
}

export default function SidebarSuperAdmin({
  seccionActiva,
  onCambiarSeccion,
  resumen,
  usuario,
  onAbrirInfoUsuario,
  onCerrarSesion,
}) {
  const inicial = (usuario?.nombre || usuario?.email || '?').trim().charAt(0).toUpperCase()

  return (
    <nav
      aria-label="Panel de superadmin"
      className="flex shrink-0 flex-col bg-nocturno-sidebar"
      style={{ width: ANCHO }}
    >
      {/* Cabecera: el logotipo apilado de la app + la marca del backoffice */}
      <div className="border-b border-nocturno-borde px-5 py-5">
        <div className="font-logo text-[19px] uppercase leading-[0.95] tracking-tight text-nocturno-texto">
          <span className="block">En</span>
          <span className="block text-naranja">Navalcarnero</span>
        </div>
        <p className="mt-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario">
          Superadmin
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo || 'portada'} className="mb-4 last:mb-0">
            {grupo.titulo && (
              <h2 className="px-2 pb-2 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-nocturno-secundario">
                {grupo.titulo}
              </h2>
            )}
            <ul className="space-y-0.5">
              {grupo.items.map(([clave, icono, etiqueta]) => {
                const activo = seccionActiva === clave
                return (
                  <li key={clave}>
                    <button
                      type="button"
                      onClick={() => onCambiarSeccion(clave)}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left font-serif-spectral text-[13.5px] transition-colors ${
                        activo
                          ? 'bg-terracota text-papel'
                          : 'text-nocturno-texto hover:bg-nocturno-seccion'
                      }`}
                    >
                      <MIcon name={icono} className="shrink-0 text-[18px]" />
                      <span className="flex-1 truncate">{etiqueta}</span>
                      <Contador contador={contadorDe(clave, resumen)} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-nocturno-borde px-3 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta text-nocturno-secundario transition-colors hover:bg-nocturno-seccion hover:text-nocturno-texto"
        >
          <MIcon name="arrow_back" className="text-[15px]" />
          Volver a la app
        </Link>

        <div className="mt-2 flex items-center gap-2 border-t border-nocturno-borde pt-3">
          <button
            type="button"
            onClick={onAbrirInfoUsuario}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors hover:bg-nocturno-seccion"
            title="Información de usuario"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nocturno-outline font-serif-dm text-[14px] text-nocturno-texto"
              aria-hidden="true"
            >
              {inicial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif-spectral text-[13px] text-nocturno-texto">
                {usuario?.nombre || 'Superadmin'}
              </span>
              <span className="block font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-nocturno-secundario">
                Ver mi cuenta
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onCerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="shrink-0 rounded-[9px] p-2 text-nocturno-secundario transition-colors hover:bg-nocturno-seccion hover:text-terracota-legible"
          >
            <MIcon name="logout" className="text-[18px]" />
          </button>
        </div>
      </div>
    </nav>
  )
}
