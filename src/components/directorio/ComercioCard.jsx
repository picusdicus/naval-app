import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import { cartelDe } from '../../lib/gaceta.js'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const sinAcentos = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

function horarioDeHoy(horario) {
  if (!horario) return null
  const hoy = sinAcentos(DIAS[new Date().getDay()])
  for (const seg of horario.split('|')) {
    const idx = seg.indexOf(':')
    if (idx === -1) continue
    const dia = sinAcentos(seg.slice(0, idx).trim())
    if (dia === hoy) return seg.slice(idx + 1).trim()
  }
  return null
}

// Gradiente de cartel para la miniatura de un comercio reclamado que aún no ha
// subido foto (el fallback de La Gaceta: degradado + trama diagonal).
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

// Una fila del listado de comercios de una categoría. Misma estructura en móvil
// y escritorio; cambian tamaños y qué metadatos se muestran (en móvil el rating
// y el horario van en línea, en escritorio en la columna derecha).
export default function ComercioCard({ comercio, activo, onClick, fotoPerfil }) {
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)
  const horaHoy = horarioDeHoy(comercio.horario)
  const cerrado = horaHoy ? horaHoy.toLowerCase().includes('cerrado') : false
  const cierre = horaHoy && !cerrado ? horaHoy.split('–')[1]?.trim() : ''

  // "Reclamado" = tiene perfil en Neon; es lo que da sello, foto y descripción.
  const reclamado = !!fotoPerfil
  const foto = fotoPerfil?.foto_principal || fotoPerfil?.fotoPrincipal || comercio.foto
  const inicial = comercio.nombre?.charAt(0).toUpperCase() || '?'
  const cartel = cartelDe(GRADIENTE_POR_CATEGORIA[comercio.categoria] || 'pardo')

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[13px] border-b border-filete py-3.5 text-left transition-colors lg:gap-[18px] lg:py-[18px] ${
        activo ? 'bg-papel-calido' : 'hover:bg-papel-calido/40'
      }`}
    >
      {/* MINIATURA: foto real, cartel de la casa o inicial (ficha sin reclamar) */}
      <div className="h-[58px] w-[58px] flex-none lg:h-[76px] lg:w-[76px]">
        {foto ? (
          <img
            src={foto}
            alt=""
            className="h-full w-full rounded-[13px] object-cover lg:rounded-2xl"
            loading="lazy"
          />
        ) : reclamado ? (
          <div
            className={`relative h-full w-full overflow-hidden rounded-[13px] lg:rounded-2xl ${cartel.trama}`}
            style={{ background: cartel.fondo }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[13px] border border-dashed border-filete-claro bg-papel-calido font-serif-dm text-[25px] text-ocre lg:rounded-2xl lg:text-[32px]">
            {inicial}
          </div>
        )}
      </div>

      {/* CONTENIDO */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 lg:gap-2.5">
          <h3 className="truncate font-serif-dm text-lg leading-none text-tinta lg:text-[23px]">
            {comercio.nombre}
          </h3>
          {reclamado && (
            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-tinta px-1.5 py-0.5 font-mono-ibm text-[8px] uppercase tracking-etiqueta text-oro lg:px-2 lg:py-[3px] lg:text-[8.5px]">
              ✓<span className="hidden lg:inline">Verificado</span>
            </span>
          )}
        </div>

        {/* Categoría + dirección. En móvil solo la calle, que es lo que cabe. */}
        <div className="mt-[3px] truncate font-serif-spectral text-[12.5px] text-pardo lg:mt-1 lg:text-sm">
          <span className="hidden lg:inline">{tipo}</span>
          {comercio.direccion && (
            <>
              <span className="hidden lg:inline"> · </span>
              <span className="lg:hidden">{comercio.direccion.split(',')[0]}</span>
              <span className="hidden lg:inline">{comercio.direccion}</span>
            </>
          )}
          {!comercio.direccion && <span className="lg:hidden">{tipo}</span>}
        </div>

        {/* Descripción del perfil: solo escritorio, una línea */}
        {reclamado && fotoPerfil?.descripcion && (
          <p className="mt-[3px] hidden truncate font-serif-spectral text-[13.5px] text-mudo lg:block">
            {fotoPerfil.descripcion}
          </p>
        )}

        {/* Móvil: rating y estado en línea (en escritorio van a la derecha) */}
        {reclamado && (
          <div className="mt-[3px] font-mono-ibm text-[9.5px] text-terracota lg:hidden">
            {comercio.rating != null && <>★ {comercio.rating.toFixed(1)}</>}
            {horaHoy && (
              <span className={cerrado ? 'text-mudo' : 'text-verde'}>
                {comercio.rating != null && ' · '}
                {cerrado ? 'CERRADO' : 'ABIERTO'}
              </span>
            )}
          </div>
        )}

        {/* Ficha sin reclamar: la invitación al dueño */}
        {!reclamado && (
          <div className="mt-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-terracota lg:mt-1.5 lg:text-[9.5px]">
            <span className="lg:hidden">Sin reclamar</span>
            <span className="hidden lg:inline">● Ficha sin reclamar · ¿es tu comercio?</span>
          </div>
        )}
      </div>

      {/* COLUMNA DERECHA (escritorio): rating y horario de hoy */}
      <div className="hidden flex-none text-right lg:block">
        {comercio.rating != null ? (
          <>
            <div className="font-mono-ibm text-xs text-terracota">
              ★ {comercio.rating.toFixed(1)}
              {comercio.totalReviews != null && (
                <span className="text-mudo"> ({comercio.totalReviews})</span>
              )}
            </div>
            {horaHoy && (
              <div
                className={`mt-1.5 font-mono-ibm text-[10px] ${cerrado ? 'text-mudo' : 'text-verde'}`}
              >
                ● {cerrado ? 'Cerrado' : 'Abierto'}
                {cierre && ` · ${cierre}`}
              </div>
            )}
          </>
        ) : (
          <div className="font-mono-ibm text-[10px] text-mudo">
            {horaHoy ? (cerrado ? 'Cerrado hoy' : `Abierto${cierre ? ` · ${cierre}` : ''}`) : 'Sin horario'}
          </div>
        )}
      </div>
    </button>
  )
}
