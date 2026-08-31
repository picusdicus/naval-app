import { useState } from 'react'
import { CATEGORIAS } from '../../lib/categorias.js'
import { tipoComercio } from '../../lib/cocinas.js'
import { IconoCategoria } from './iconosCategoria.jsx'

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

// Tarjeta-cartel de un comercio en el listado (La Gaceta), misma familia visual
// que TarjetaCategoria y las tarjetas de destacados: foto o color de categoría
// a sangre + trama diagonal, degradado oscuro y el contenido en texto claro
// anclado abajo. Pulsarla despliega la ficha rápida (ComercioDetalle) a ancho
// completo bajo su fila (col-span-full en la rejilla de Mapa.jsx); desde la
// ficha se llega a la página completa /comercios/<id>.
//
// Tres estados según el perfil enriquecido de Neon (`perfil`):
//   1. reclamado con foto  → foto real + sello "✓ Verificado"
//   2. reclamado sin foto  → color de categoría + trama + icono + sello
//   3. sin reclamar        → color + trama + inicial grande, etiqueta
//                            "Sin reclamar" y una invitación en el pie
export default function TarjetaComercio({ comercio, perfil, activo = false, onClick }) {
  const [fotoRota, setFotoRota] = useState(false)
  const cat = CATEGORIAS[comercio.categoria]
  const tipo = tipoComercio(comercio, cat?.nombre)
  const horaHoy = horarioDeHoy(comercio.horario)
  const cerrado = horaHoy ? horaHoy.toLowerCase().includes('cerrado') : false
  const cierre = horaHoy && !cerrado ? horaHoy.split('–')[1]?.trim() : ''

  // "Reclamado" = tiene perfil en Neon; da sello y foto (mismo criterio que la
  // ficha completa: el perfil gana campo a campo sobre el JSON).
  const reclamado = !!perfil
  const foto = perfil?.foto_principal || perfil?.fotoPrincipal || comercio.foto
  const conFoto = !!foto && !fotoRota
  const inicial = comercio.nombre?.charAt(0).toUpperCase() || '?'
  const direccionCorta = comercio.direccion?.split(',').slice(0, 2).join(',').trim()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={comercio.nombre}
      aria-expanded={activo}
      className={`group relative block aspect-[16/9] w-full overflow-hidden border border-tinta text-left transition-shadow sm:aspect-[4/3] md:rounded-lg md:border-0 md:shadow-cartel md:hover:shadow-tarjeta-gaceta ${
        activo ? 'ring-2 ring-terracota ring-offset-2' : ''
      }`}
    >
      {/* FONDO: foto real, o color de categoría + trama */}
      {conFoto ? (
        <img
          src={foto}
          alt=""
          onError={() => setFotoRota(true)}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className="gz-trama-clara absolute inset-0"
          style={{ backgroundColor: cat?.color || '#8a6d3a' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {reclamado ? (
              <IconoCategoria
                categoria={comercio.categoria}
                className="text-[90px] text-white opacity-15"
              />
            ) : (
              <span className="font-serif-dm text-[90px] leading-none text-white opacity-20">
                {inicial}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* SELLO arriba: verificado o sin reclamar */}
      {reclamado ? (
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-tinta/90 px-2 py-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-oro">
          ✓ Verificado
        </span>
      ) : (
        <span className="absolute left-3 top-3 z-20 rounded-full bg-black/40 px-2 py-1 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-papel/80">
          Sin reclamar
        </span>
      )}

      {/* CONTENIDO anclado abajo */}
      <div className="absolute bottom-0 left-0 z-20 w-full p-3 md:p-4">
        <p className="font-mono-ibm text-[9px] uppercase tracking-etiqueta text-papel/70">
          {tipo}
        </p>
        <h3 className="mt-1 line-clamp-2 font-serif-dm text-lg leading-tight text-papel md:text-xl">
          {comercio.nombre}
        </h3>
        {direccionCorta && (
          <p className="mt-0.5 truncate font-serif-spectral text-xs text-papel/80">
            {direccionCorta}
          </p>
        )}

        {/* Pie: rating/horario para reclamados, invitación para el resto */}
        {reclamado ? (
          (comercio.rating != null || horaHoy) && (
            <p className="mt-1.5 font-mono-ibm text-[9.5px] uppercase tracking-etiqueta text-papel/90">
              {comercio.rating != null && <span className="text-oro">★ {comercio.rating.toFixed(1)}</span>}
              {comercio.rating != null && horaHoy && ' · '}
              {horaHoy && (
                <span className={cerrado ? 'text-papel/60' : 'text-papel'}>
                  {cerrado ? 'Cerrado hoy' : `Abierto${cierre ? ` · ${cierre}` : ''}`}
                </span>
              )}
            </p>
          )
        ) : (
          <p className="mt-1.5 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-oro">
            ● ¿Es tu comercio? Reclámalo
          </p>
        )}
      </div>
    </button>
  )
}
