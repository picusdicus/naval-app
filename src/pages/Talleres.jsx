import { useMemo, useContext } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTalleres } from '../lib/useTalleres.js'
import {
  CATEGORIAS_TALLER,
  LISTA_CATEGORIAS_TALLER,
  LISTA_FAMILIAS_TALLER,
  TEXTO_MATRICULA,
  tallerComoEvento,
} from '../lib/talleres.js'
import FiltrosEventos from '../components/eventos/FiltrosEventos.jsx'
import TarjetaTaller from '../components/talleres/TarjetaTaller.jsx'
import CarruselDestacados from '../components/destacados/CarruselDestacados.jsx'
import HeroDestacadosDesktop from '../components/destacados/HeroDestacadosDesktop.jsx'
import { useDestacados } from '../lib/useDestacados.js'
import { tallerATarjeta } from '../lib/destacados.js'
import { GenericasEventoContext } from '../lib/GenericasEventoContext.jsx'
import { creditosDe, genericasParaEvento } from '../lib/imagenesEvento.js'
import MIcon from '../components/MIcon.jsx'

// Mínimo de items del carrusel, igual que en Eventos: sin destacados
// contratados se rellena con los primeros talleres para que la franja no
// quede coja ni desaparezca.
const MIN_CARRUSEL = 6

/**
 * Catálogo de talleres municipales.
 *
 * Comparte con /eventos el masthead, la franja de destacados y los chips de
 * filtro, pero NO la tira de días ni el calendario: un taller no ocurre un día
 * concreto, se imparte en turnos semanales durante todo el curso. Por eso el
 * listado se agrupa por familia del catálogo (Técnicas artísticas, Bienestar,
 * Danza) en lugar de por fecha.
 */
export default function Talleres() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { genericas, asignaciones } = useContext(GenericasEventoContext)
  const { talleres, cargando } = useTalleres()

  const categoriasParam = searchParams.get('categorias')
  const categoriasActivas = useMemo(
    () => (categoriasParam ? categoriasParam.split(',') : []),
    [categoriasParam],
  )

  const { items: destacadosTaller } = useDestacados({ talleres, tipo: 'taller' })

  const itemsCarrusel = useMemo(() => {
    if (destacadosTaller.length >= MIN_CARRUSEL) return destacadosTaller
    const ids = new Set(destacadosTaller.map((d) => d.item?.id))
    const relleno = talleres
      .filter((t) => !ids.has(t.id))
      .slice(0, MIN_CARRUSEL - destacadosTaller.length)
      .map((t) =>
        tallerATarjeta(t, {
          genericas: genericasParaEvento(tallerComoEvento(t), genericas, asignaciones),
        }),
      )
    return [...destacadosTaller, ...relleno]
  }, [destacadosTaller, talleres, genericas, asignaciones])

  const idsDestacados = useMemo(
    () => new Set(destacadosTaller.map((d) => d.item?.id).filter(Boolean)),
    [destacadosTaller],
  )

  const visibles = useMemo(
    () =>
      categoriasActivas.length === 0
        ? talleres
        : talleres.filter((t) => categoriasActivas.includes(t.categoria)),
    [talleres, categoriasActivas],
  )

  // Agrupación por familia del folleto. Una categoría que no esté en el
  // catálogo (fila antigua, disciplina retirada) cae en un grupo "Otros" en
  // lugar de desaparecer del listado.
  const grupos = useMemo(() => {
    const porFamilia = LISTA_FAMILIAS_TALLER.map((familia) => ({
      familia,
      talleres: visibles.filter((t) => CATEGORIAS_TALLER[t.categoria]?.familia === familia.id),
    })).filter((g) => g.talleres.length > 0)

    const sueltos = visibles.filter((t) => !CATEGORIAS_TALLER[t.categoria])
    if (sueltos.length > 0) {
      porFamilia.push({ familia: { id: 'otros', nombre: 'Otros talleres' }, talleres: sueltos })
    }
    return porFamilia
  }, [visibles])

  const conCarrusel = categoriasActivas.length === 0 && itemsCarrusel.length > 0
  const hayDestacadosReales = destacadosTaller.length > 0

  const handleCategoriasChange = (cat) => {
    const nuevas = categoriasActivas.includes(cat)
      ? categoriasActivas.filter((c) => c !== cat)
      : [...categoriasActivas, cat]
    const params = new URLSearchParams()
    if (nuevas.length > 0) params.append('categorias', nuevas.join(','))
    setSearchParams(params)
  }

  const handleLimpiarFiltros = () => setSearchParams(new URLSearchParams())

  return (
    <div className="flex flex-col">
      <header className="mb-6">
        <div className="gz-filete-doble pb-3">
          <div className="gz-label text-mudo">Aprender en</div>
          <h1 className="font-serif-dm text-seccion leading-none text-tinta">Los talleres</h1>
        </div>
        {/* La matrícula se avisa aquí y en cada ficha: el precio que se ve en
            la tarjeta es solo la cuota mensual, y enterarse del pago único al
            llegar al mostrador es justo la sorpresa que hay que evitar. */}
        <p className="mt-3 flex items-start gap-1.5 font-serif-spectral text-sm text-pardo">
          <MIcon name="info" className="mt-0.5 flex-shrink-0 text-[15px] text-terracota" />
          {TEXTO_MATRICULA}
        </p>
      </header>

      {conCarrusel && (
        <section className="mb-6 animate-rise">
          <div className="md:hidden">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="gz-eyebrow">
                {hayDestacadosReales ? 'Talleres destacados' : 'Del catálogo'}
              </span>
              <span className="font-mono-ibm text-[10px] tracking-etiqueta text-mudo">
                {String(Math.min(itemsCarrusel.length, 3)).padStart(2, '0')} /{' '}
                {String(itemsCarrusel.length).padStart(2, '0')}
              </span>
            </div>
            <CarruselDestacados items={itemsCarrusel} columnas={3} seccion="talleres" />
          </div>

          <div className="hidden md:block">
            <HeroDestacadosDesktop
              items={itemsCarrusel}
              eyebrow={hayDestacadosReales ? 'Talleres destacados' : 'Del catálogo'}
              titulo={hayDestacadosReales ? 'Los más solicitados' : 'Qué puedes aprender este curso'}
              seccion="talleres"
            />
          </div>
        </section>
      )}

      <FiltrosEventos
        eventos={talleres}
        catalogo={LISTA_CATEGORIAS_TALLER}
        etiqueta="Disciplina"
        etiquetaTodos="Todas"
        categoriasActivas={categoriasActivas}
        onCategoriaToggle={handleCategoriasChange}
        onLimpiar={handleLimpiarFiltros}
      />

      {cargando && (
        <p className="py-12 text-center font-mono-ibm text-xs uppercase tracking-etiqueta text-mudo">
          Cargando talleres…
        </p>
      )}

      {!cargando && visibles.length === 0 && (
        <div className="gz-filete-doble py-12 text-center">
          <p className="font-serif-dm text-xl italic text-tinta">
            {talleres.length === 0
              ? 'Todavía no hay talleres publicados.'
              : 'Ningún taller de esa disciplina.'}
          </p>
          {categoriasActivas.length > 0 && (
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="mt-4 font-mono-ibm text-[11px] uppercase tracking-etiqueta text-terracota hover:text-tinta"
            >
              Ver todos los talleres
            </button>
          )}
        </div>
      )}

      {grupos.map(({ familia, talleres: delGrupo }) => (
        <section key={familia.id} className="mb-10">
          <h2 className="gz-eyebrow mb-3 border-b border-[#d9d0ba] pb-2">{familia.nombre}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {delGrupo.map((taller) => (
              <TarjetaTaller
                key={taller.id}
                taller={taller}
                destacado={idsDestacados.has(taller.id)}
                onClick={() => navigate(`/talleres/${taller.id}`)}
              />
            ))}
          </div>
        </section>
      ))}

      {creditosDe(genericas).length > 0 && (
        <p className="mb-6 mt-4 text-center font-mono-ibm text-[9px] leading-relaxed text-mudo">
          Imágenes ilustrativas de bancos de imágenes de uso libre: {creditosDe(genericas).join(' · ')}
        </p>
      )}
    </div>
  )
}
