import MIcon from '../MIcon.jsx'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab']

export default function CalendarioEventos({ eventos = [], mesSeleccionado, onMesChange }) {
  const año = mesSeleccionado.getFullYear()
  const mes = mesSeleccionado.getMonth()

  // Obtener el primer día del mes y cuántos días tiene
  const primerDia = new Date(año, mes, 1)
  const ultimoDia = new Date(año, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  const diaInicio = primerDia.getDay()

  // Crear array de fechas del calendario
  const diasCalendario = []
  for (let i = 0; i < diaInicio; i++) {
    diasCalendario.push(null)
  }
  for (let dia = 1; dia <= diasEnMes; dia++) {
    diasCalendario.push(dia)
  }

  // Saber qué días tienen eventos
  const eventosPorDia = {}
  for (const evento of eventos) {
    const [y, m, d] = evento.fecha.split('-')
    if (parseInt(y) === año && parseInt(m) - 1 === mes) {
      const dia = parseInt(d)
      if (!eventosPorDia[dia]) eventosPorDia[dia] = []
      eventosPorDia[dia].push(evento)
    }
  }

  const irMesAnterior = () => {
    onMesChange(new Date(año, mes - 1, 1))
  }

  const irMesSiguiente = () => {
    onMesChange(new Date(año, mes + 1, 1))
  }

  return (
    <div className="border-2 border-tinta bg-papel p-4 h-fit">
      {/* Encabezado mes/año */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={irMesAnterior}
          className="p-1 hover:bg-papel-calido transition-colors"
        >
          <MIcon name="navigate_before" className="text-[20px]" />
        </button>
        <h3 className="font-serif-dm text-lg text-tinta min-w-fit">
          {MESES[mes]} {año}
        </h3>
        <button
          type="button"
          onClick={irMesSiguiente}
          className="p-1 hover:bg-papel-calido transition-colors"
        >
          <MIcon name="navigate_next" className="text-[20px]" />
        </button>
      </div>

      {/* Cabecera de días de semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center font-mono-ibm text-[10px] font-bold text-mudo py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Días del calendario */}
      <div className="grid grid-cols-7 gap-1">
        {diasCalendario.map((dia, idx) => {
          const tieneEventos = dia && eventosPorDia[dia] && eventosPorDia[dia].length > 0
          const esHoy = dia && new Date().getDate() === dia && new Date().getMonth() === mes && new Date().getFullYear() === año

          return (
            <div
              key={idx}
              className={`aspect-square flex items-center justify-center border-2 transition-colors ${
                !dia ? 'bg-mudo/10' : 'border-tinta cursor-pointer hover:bg-papel-calido'
              } ${tieneEventos ? 'bg-terracota/20 border-terracota' : ''} ${
                esHoy ? 'border-tinta bg-tinta text-papel font-bold' : 'text-tinta'
              }`}
            >
              {dia && (
                <span className="font-serif-dm text-sm leading-none">
                  {dia}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Resumen de eventos del mes */}
      {Object.keys(eventosPorDia).length > 0 && (
        <div className="mt-4 pt-4 border-t-2 border-filete">
          <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo mb-2">
            Próximos eventos
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(eventosPorDia)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .slice(0, 5)
              .map(([dia, evts]) => (
                <div key={dia} className="text-[11px]">
                  <span className="font-serif-dm font-bold text-tinta">{dia}</span>
                  <span className="text-mudo"> - {evts.length} evento{evts.length !== 1 ? 's' : ''}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
