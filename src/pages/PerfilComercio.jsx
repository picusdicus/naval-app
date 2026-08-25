import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import MIcon from '../components/MIcon.jsx'
import DialogoReclamarComercio from '../components/directorio/DialogoReclamarComercio.jsx'
import IconosRedes from '../components/directorio/IconosRedes.jsx'
import VisorFotos from '../components/directorio/VisorFotos.jsx'
import { CATEGORIAS } from '../lib/categorias.js'
import comercios from '../data/comercios.json'
import servicios from '../data/servicios-locales.json'
import { datoComercio } from '../lib/comerciosHelper.js'
import { useEventosPublicos } from '../lib/useEventosPublicos.js'
import { hoyISO } from '../lib/fechas.js'

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

const PESTANAS = [
  { id: 'informacion', label: 'Información' },
  { id: 'actividades', label: 'Actividades' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'resenas', label: 'Reseñas' },
]

export default function PerfilComercio({ id: idProp }) {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const id = idProp || idParam
  const [comercio, setComercio] = useState(null)
  const [perfil, setPerfil] = useState(null)
  // Organización que gestiona el comercio (si reclamó la ficha): es la dueña de
  // los eventos que se listan en "Lo que organizan".
  const [organizacion, setOrganizacion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pestanaActiva, setPestanaActiva] = useState('informacion')
  // Índice de la foto abierta a pantalla completa (null = visor cerrado).
  const [fotoAmpliada, setFotoAmpliada] = useState(null)

  const { eventos } = useEventosPublicos()

  useEffect(() => {
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

    const cargarDatos = async () => {
      try {
        const respuesta = await fetch(`/api/comercio-perfil?id=${encodeURIComponent(id)}`)
        if (respuesta.ok) {
          const datos = await respuesta.json()
          setPerfil(datos.perfil)
          setOrganizacion(datos.organizacion ?? null)
        }
      } catch (err) {
        console.warn('Error cargando perfil:', err)
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [id])

  // Eventos publicados por la organización del comercio, de hoy en adelante.
  // Se filtra por `organizacionId`, que /api/eventos añade a cada evento de
  // Neon. Matiz conocido: si un evento suyo coincide en fecha y título con uno
  // curado en eventos.json, el dedup de la agenda los fusiona quedándose con la
  // ficha estática (que no lleva organizacionId) y aquí no saldría — sigue
  // estando en la agenda pública.
  const proximasFunciones = useMemo(() => {
    if (!organizacion) return []
    const hoy = hoyISO()
    // El filtro compara e.fecha >= hoy como STRING (no pasa por Date): con
    // fecha null/undefined la comparación relacional coerciona ambos lados a
    // número (null→0, undefined→NaN, string de fecha→NaN) y cualquier
    // comparación con NaN da false, así que los eventos sin fecha ya quedan
    // fuera — pero es una exclusión implícita por semántica de coerción, no
    // una garantía. La guarda del sort evita el crash si eso cambiara.
    return eventos
      .filter((e) => e.organizacionId === organizacion.id && e.fecha >= hoy)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora || '').localeCompare(b.hora || ''))
  }, [eventos, organizacion])

  if (cargando) {
    return (
      <div className="min-h-screen bg-papel flex items-center justify-center">
        <p className="font-serif-spectral text-pardo">Cargando…</p>
      </div>
    )
  }

  if (error || !comercio) {
    return (
      <div className="min-h-screen bg-papel flex flex-col items-center justify-center gap-4 px-4">
        <MIcon name="location_off" className="text-[48px] text-mudo" />
        <p className="font-serif-dm text-xl text-tinta">{error || 'Comercio no encontrado'}</p>
        <Link to="/comercios" className="font-mono-ibm text-xs uppercase bg-tinta text-papel px-6 py-3 rounded-full hover:opacity-80">
          Volver al directorio
        </Link>
      </div>
    )
  }

  const cat = CATEGORIAS[comercio.categoria]
  const nombreComercio = datoComercio(perfil, comercio, 'nombre')
  const fotoPrincipal = perfil?.foto_principal || perfil?.fotoPrincipal || datoComercio(perfil, comercio, 'foto')
  const fotos = (perfil?.fotos && Array.isArray(perfil.fotos) && perfil.fotos.filter(Boolean)) || datoComercio(perfil, comercio, 'fotos') || []
  const descripcion = perfil?.descripcion || datoComercio(perfil, comercio, 'descripcion')
  const horarios = perfil?.horarios || datoComercio(perfil, comercio, 'horarios')
  const web = perfil?.web || datoComercio(perfil, comercio, 'web')
  const telefono = perfil?.telefono || datoComercio(perfil, comercio, 'telefono')
  const direccion = perfil?.direccion || datoComercio(perfil, comercio, 'direccion')
  const lat = perfil?.lat || datoComercio(perfil, comercio, 'lat')
  const lng = perfil?.lng || datoComercio(perfil, comercio, 'lng')
  const linkedin = perfil?.linkedin
  const facebook = perfil?.facebook
  const instagram = perfil?.instagram
  const twitter = perfil?.twitter
  const tiktok = perfil?.tiktok

  const tienePerfil = !!perfil

  return (
    <div className="min-h-screen bg-papel">
      {/* PORTADA CON HERO */}
      <div className="relative h-80 sm:h-96 overflow-hidden bg-gradient-to-b from-papel to-papel-calido">
        {/* Imagen o degradado */}
        {fotoPrincipal ? (
          <img
            src={fotoPrincipal}
            alt={nombreComercio}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br" style={{ background: `linear-gradient(135deg, ${cat?.color || '#4a5b41'}40, ${cat?.color || '#4a5b41'}80)` }} />
        )}

        {/* Overlay gradient oscuro (arriba claro, abajo oscuro) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/94 via-black/40 to-black/10" />

        {/* Migas de pan (arriba izquierda): el directorio y la categoría son
            enlaces; el nombre del comercio, donde ya estamos, no lo es. */}
        <nav
          aria-label="Migas de pan"
          className="absolute top-5 left-5 right-5 sm:top-6 sm:left-8 sm:right-8 flex flex-wrap items-center gap-x-1.5 font-mono-ibm text-[10px] tracking-wider uppercase text-white/75"
        >
          <Link to="/comercios" className="inline-flex items-center gap-1 transition-colors hover:text-white">
            <MIcon name="arrow_back" className="text-[14px]" />
            Comercios
          </Link>
          <span className="text-white/40">/</span>
          <Link
            to={`/comercios?categoria=${comercio.categoria}`}
            className="text-white/60 transition-colors hover:text-white"
          >
            {cat?.nombre || comercio.categoria}
          </Link>
          <span className="text-white/40">/</span>
          <span className="text-white/40">{nombreComercio}</span>
        </nav>

        {/* Botones glass (arriba derecha) */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-8 flex gap-2">
          <button className="backdrop-blur-md bg-white/15 border border-white/24 text-white px-3 sm:px-4 py-2 rounded-full font-mono-ibm text-[10px] tracking-wider uppercase hover:bg-white/25 transition">
            ♥ Guardar
          </button>
          <button className="backdrop-blur-md bg-white/15 border border-white/24 text-white px-3 sm:px-4 py-2 rounded-full font-mono-ibm text-[10px] tracking-wider uppercase hover:bg-white/25 transition">
            ↗ Compartir
          </button>
        </div>

        {/* Bottom overlay: foto pequeña + info */}
        <div className="absolute bottom-7 sm:bottom-8 left-5 sm:left-10 right-5 sm:right-10 flex items-end gap-5 sm:gap-6">
          {/* Foto de perfil pequeña */}
          <div className="flex-shrink-0 w-[74px] h-[74px] sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl overflow-hidden border-[3px] border-white/90 shadow-lg">
            {fotoPrincipal ? (
              <img src={fotoPrincipal} alt={nombreComercio} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${cat?.color || '#4a5b41'}, ${cat?.color || '#4a5b41'}dd)` }}>
                <MIcon name="storefront" className="text-white text-[40px]" />
              </div>
            )}
          </div>

          {/* Info texto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono-ibm text-[9px] tracking-wider uppercase text-oro">
                {cat?.nombre || comercio.categoria}
              </span>
              {/* Mismo sello que en el listado y en la ficha rápida: oro sobre
                  tinta, para que "verificado" se lea igual en toda la app. */}
              {tienePerfil && (
                <span className="inline-flex items-center gap-1 rounded-full bg-oro px-2.5 py-1 font-mono-ibm text-[8.5px] uppercase tracking-etiqueta text-tinta">
                  ✓ Verificado
                </span>
              )}
            </div>
            <h1 className="font-serif-dm text-4xl sm:text-5xl leading-tight text-white break-words">
              {nombreComercio}
            </h1>
            <div className="flex items-center gap-3 mt-3 font-mono-ibm text-[10px] tracking-wider text-white/80">
              <span className="text-oro">★ 4.9 (34)</span>
              <span className="w-px h-2.5 bg-white/30" />
              <span>◉ {comercio.ubicacion || 'NAVALCARNERO'}</span>
              <span className="w-px h-2.5 bg-white/30" />
              <span>{cat?.nombre}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE ACCIONES */}
      <div className="bg-white border-b border-filete">
        <div className="mx-auto max-w-5xl px-5 sm:px-10">
          {/* Botones de acción */}
          <div className="flex gap-2 sm:gap-3 py-3.5 border-b border-filete">
            <button className="bg-tinta text-papel px-6 sm:px-7 py-3 rounded-full font-mono-ibm text-[11px] tracking-wider uppercase hover:opacity-90">
              ☎ Llamar
            </button>
            <button className="border border-terracota-fondo text-tinta px-5 sm:px-6 py-3 rounded-full font-mono-ibm text-[11px] tracking-wider uppercase hover:bg-papel-calido">
              ◉ Cómo llegar
            </button>
            <button className="border border-terracota-fondo text-tinta px-5 sm:px-6 py-3 rounded-full font-mono-ibm text-[11px] tracking-wider uppercase hover:bg-papel-calido">
              ✉ Escribir
            </button>
            {/* Las redes viven ahora en la tarjeta de Contacto, con un icono por
                plataforma: aquí solo quedaba un botón "Instagram ↗" fijo que ni
                enlazaba a ningún sitio. */}
          </div>

          {/* Pestañas */}
          <div className="flex gap-8 sm:gap-7 overflow-x-auto">
            {PESTANAS.map((pesta) => (
              <button
                key={pesta.id}
                onClick={() => setPestanaActiva(pesta.id)}
                className={`font-mono-ibm text-[11px] tracking-wider uppercase py-4 border-b-2 transition ${
                  pestanaActiva === pesta.id
                    ? 'border-terracota text-tinta'
                    : 'border-transparent text-pardo hover:text-tinta'
                }`}
                aria-selected={pestanaActiva === pesta.id}
              >
                {pesta.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="mx-auto max-w-5xl px-5 sm:px-10 py-8 sm:py-12">
        {pestanaActiva === 'informacion' && (
          <div className="grid gap-8 sm:gap-12 md:grid-cols-3">
            {/* Columna izquierda (2/3) */}
            <div className="space-y-8 md:col-span-2">
              {/* Sobre nosotros */}
              <section>
                <h2 className="font-mono-ibm text-[10px] tracking-wider uppercase text-terracota mb-2.5">
                  Sobre nosotros
                </h2>
                {descripcion ? (
                  <p className="font-serif-spectral text-lg leading-relaxed text-pardo">
                    {descripcion}
                  </p>
                ) : (
                  <p className="font-serif-spectral text-sm text-pardo italic">
                    Este comercio aún no ha añadido descripción.
                  </p>
                )}
              </section>

              {/* Datos rápidos (3 tarjetas) */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-white border border-tinta rounded-lg p-4 sm:p-5 shadow-sm">
                  <div className="font-mono-ibm text-[9px] tracking-wider uppercase text-mudo mb-2">Público</div>
                  <div className="font-serif-dm text-lg sm:text-xl leading-tight text-tinta">Familiar</div>
                </div>
                <div className="bg-white border border-tinta rounded-lg p-4 sm:p-5 shadow-sm">
                  <div className="font-mono-ibm text-[9px] tracking-wider uppercase text-mudo mb-2">Servicios</div>
                  <div className="font-serif-dm text-lg sm:text-xl leading-tight text-tinta">Variados</div>
                </div>
                <div className="bg-white border border-tinta rounded-lg p-4 sm:p-5 shadow-sm">
                  <div className="font-mono-ibm text-[9px] tracking-wider uppercase text-mudo mb-2">Reservas</div>
                  <div className="font-serif-dm text-lg sm:text-xl leading-tight text-tinta">Por teléfono</div>
                </div>
              </div>

              {/* Galería de fotos */}
              {fotos.length > 0 && (
                <section>
                  <div className="flex justify-between items-baseline mb-3 border-t border-filete pt-5">
                    <h2 className="font-serif-dm text-2xl text-tinta">Fotos</h2>
                    <button
                      type="button"
                      onClick={() => setFotoAmpliada(0)}
                      className="font-mono-ibm text-[10px] tracking-wider uppercase text-terracota hover:opacity-80"
                    >
                      Ver las {fotos.length} →
                    </button>
                  </div>
                  {/* Cada miniatura abre el visor a pantalla completa: en la
                      cuadrícula van recortadas a cuadrado (object-cover). */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {fotos.slice(0, 5).map((foto, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFotoAmpliada(idx)}
                        aria-label={`Ampliar foto ${idx + 1}`}
                        className="aspect-square overflow-hidden rounded-lg border border-tinta"
                      >
                        <img
                          src={foto}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </button>
                    ))}
                    {fotos.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setFotoAmpliada(5)}
                        aria-label={`Ver las otras ${fotos.length - 5} fotos`}
                        className="aspect-square bg-tinta rounded-lg flex items-center justify-center"
                      >
                        <span className="font-mono-ibm text-sm text-papel">+{fotos.length - 5}</span>
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* Próximas funciones: eventos que la organización del comercio
                  tiene publicados en la agenda, de hoy en adelante */}
              <section>
                <div className="border-t border-filete pt-5 mb-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="font-mono-ibm text-[10px] tracking-wider uppercase text-terracota mb-1">
                      Lo que organizan
                    </div>
                    <h2 className="font-serif-dm text-2xl text-tinta">Próximas funciones</h2>
                  </div>
                  {proximasFunciones.length > 0 && (
                    <Link
                      to="/eventos"
                      className="font-mono-ibm text-[10px] tracking-wider uppercase text-terracota hover:opacity-80"
                    >
                      Toda la agenda →
                    </Link>
                  )}
                </div>

                {proximasFunciones.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {proximasFunciones.map((evento) => {
                      const [, mes, dia] = evento.fecha.split('-')
                      const mesCorto = MESES_CORTOS[Number(mes) - 1]
                      const meta = [
                        evento.hora,
                        evento.lugar,
                        evento.entradas?.precio || (evento.entradas ? 'Con entradas' : ''),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <li key={evento.id}>
                          <Link
                            to={`/eventos/${evento.id}`}
                            className="flex items-center gap-4 rounded-lg border border-filete bg-white p-4 transition-colors hover:border-tinta"
                          >
                            <div className="w-14 flex-shrink-0 text-center">
                              <div className="font-serif-dm text-3xl leading-none text-terracota">{Number(dia)}</div>
                              <div className="font-mono-ibm text-[9px] tracking-wider uppercase text-mudo mt-1">
                                {mesCorto}
                              </div>
                            </div>
                            <div className="h-11 w-px flex-shrink-0 bg-filete" />
                            <div className="min-w-0 flex-1">
                              <div className="font-serif-dm text-lg leading-tight text-tinta">{evento.titulo}</div>
                              {meta && (
                                <div className="mt-1 font-mono-ibm text-[10px] tracking-wider uppercase text-pardo truncate">
                                  {meta}
                                </div>
                              )}
                            </div>
                            <span className="hidden flex-shrink-0 rounded-full border border-filete px-4 py-2 font-mono-ibm text-[10px] tracking-wider uppercase text-tinta sm:inline-block">
                              {evento.entradas?.url ? 'Entradas' : 'Ver'}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="bg-papel-calido border border-filete rounded-lg p-6 text-center">
                    <p className="font-serif-spectral text-sm text-pardo">
                      Este comercio aún no ha publicado funciones o eventos.
                    </p>
                  </div>
                )}
              </section>
            </div>

            {/* Columna derecha sticky (1/3) */}
            <aside className="space-y-4 md:col-span-1">
              {/* Horario */}
              <div className="bg-white border border-tinta rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-baseline mb-3">
                  <h3 className="font-serif-dm text-lg text-tinta">Horario</h3>
                  <span className="font-mono-ibm text-[8px] tracking-wider uppercase bg-papel-calido text-ocre px-2 py-1 rounded-full">
                    Sin publicar
                  </span>
                </div>
                <p className="font-serif-spectral text-sm text-pardo mb-3">
                  No atiende en local fijo: trabaja por contratación y funciones programadas.
                </p>
                {telefono && (
                  <div className="bg-papel-calido rounded-lg p-3 flex gap-2.5">
                    <span className="text-terracota flex-shrink-0">☎</span>
                    <div>
                      <div className="font-mono-ibm text-[8px] tracking-wider uppercase text-mudo mb-0.5">
                        Consulta disponibilidad
                      </div>
                      <div className="font-serif-dm text-base text-tinta">{telefono}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Contacto */}
              <div className="bg-white border border-tinta rounded-2xl p-5 shadow-sm">
                <h3 className="font-serif-dm text-lg text-tinta mb-3">Contacto</h3>
                <div className="space-y-2.5">
                  {telefono && (
                    <div className="flex gap-2.5 items-center">
                      <span className="text-terracota flex-shrink-0">☎</span>
                      <a href={`tel:${telefono}`} className="font-serif-spectral text-sm text-pardo hover:text-terracota">
                        {telefono}
                      </a>
                    </div>
                  )}
                  {direccion && (
                    <div className="flex gap-2.5 items-start">
                      <span className="text-terracota flex-shrink-0 mt-0.5">◉</span>
                      <p className="font-serif-spectral text-sm text-pardo">{direccion}</p>
                    </div>
                  )}
                  {instagram && (
                    <div className="flex gap-2.5 items-center">
                      <span className="text-terracota flex-shrink-0">♡</span>
                      <a href={instagram} target="_blank" rel="noopener noreferrer" className="font-serif-spectral text-sm text-pardo hover:text-terracota truncate">
                        {instagram.replace('https://', '')}
                      </a>
                    </div>
                  )}
                </div>
                {/* Redes: un icono por plataforma en vez de botones de texto */}
                <IconosRedes
                  className="mt-4"
                  enlaces={{ instagram, facebook, twitter, tiktok, linkedin, web }}
                />
              </div>

              {/* Mapa */}
              {lat && lng && (
                <div className="bg-white rounded-2xl overflow-hidden h-52 shadow-sm border border-filete">
                  <div className="w-full h-full bg-[#e7ecdf] flex items-center justify-center relative">
                    <div className="absolute top-1/2 left-1/2 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full rounded-bl-none bg-terracota shadow-md" style={{ clip: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%)' }} />
                    <button className="absolute bottom-3 left-3 right-3 bg-white text-tinta px-4 py-2.5 rounded-full font-mono-ibm text-[10px] tracking-wider uppercase hover:bg-papel-calido">
                      Abrir en el mapa
                    </button>
                  </div>
                </div>
              )}

              {/* Nota de gestión */}
              <div className="bg-papel-calido rounded-2xl p-4 border border-filete">
                <div className="font-mono-ibm text-[8px] tracking-wider uppercase text-ocre mb-1.5">
                  Perfil gestionado por el comercio
                </div>
                <p className="font-serif-spectral text-xs text-pardo">
                  Los datos los mantiene {nombreComercio}. ¿Ves algo mal?{' '}
                  <span className="text-terracota font-medium">Avísanos</span>.
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* Otras pestañas - placeholder */}
        {pestanaActiva !== 'informacion' && (
          <div className="text-center py-12">
            <p className="font-serif-spectral text-pardo">Esta sección aún no tiene contenido.</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-filete bg-papel py-6">
        <div className="mx-auto max-w-5xl px-5 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              onClick={() => navigate(-1)}
              className="bg-tinta text-papel px-6 py-3 rounded-full font-mono-ibm text-[11px] tracking-wider uppercase hover:opacity-90 inline-flex items-center justify-center gap-2"
            >
              ← Volver atrás
            </button>
            <div className="text-center font-serif-spectral text-[10px] text-pardo">
              Directorios de OpenStreetMap y colaboradores
            </div>
          </div>
        </div>
      </div>

      {/* Visor de fotos a pantalla completa */}
      <VisorFotos
        fotos={fotos}
        indice={fotoAmpliada}
        onCerrar={() => setFotoAmpliada(null)}
        onCambiar={setFotoAmpliada}
      />

      {/* Diálogo de reclamación */}
      <DialogoReclamarComercio
        abierto={false}
        comercioId={id}
        comercioNombre={nombreComercio}
        onCerrar={() => {}}
      />
    </div>
  )
}
