// Base de conocimiento local para el asistente (RAG sencillo: se inyecta en el
// system prompt). Los archivos de /api que empiezan por "_" no se publican como
// endpoint en Vercel.
//
// Lee los mismos datos que las secciones de la app (fuente única): eventos,
// transporte y directorio de comercios. Los eventos se filtran a los próximos
// en cada petición.

import eventosData from '../src/data/eventos.json' with { type: 'json' }
import transporteData from '../src/data/transporte.json' with { type: 'json' }
import comerciosData from '../src/data/comercios.json' with { type: 'json' }
import serviciosLocales from '../src/data/servicios-locales.json' with { type: 'json' }
import { proximosEventos, formatearFechaLarga } from '../src/lib/eventos.js'
import { LISTA_CATEGORIAS } from '../src/lib/categorias.js'
import { tipoComercio } from '../src/lib/cocinas.js'

const CONTACTO = `Oficina de Turismo / Atención al vecino: Plaza de Segovia, 1.
Teléfonos: 91 810 11 41 / 91 811 51 91. Horario orientativo: lunes a viernes de 9:00 a 14:00.
Muchas gestiones requieren cita previa.`

const TRAMITES = [
  {
    titulo: 'Empadronamiento (alta en el Padrón)',
    requisitos:
      'DNI/NIE o pasaporte de cada persona; documento que acredite el domicilio (contrato de alquiler, escritura o última factura de suministro a tu nombre); si es vivienda de otra persona, autorización del titular y copia de su DNI. Menores: libro de familia.',
    donde: 'Ayuntamiento (Servicio de Atención al Ciudadano), con cita previa.',
  },
  {
    titulo: 'Certificado o volante de empadronamiento',
    requisitos:
      'DNI/NIE del solicitante. El volante es informativo; el certificado tiene validez oficial (para juzgados, extranjería, etc.). Puede solicitarse presencialmente o, si está disponible, por la sede electrónica.',
    donde: 'Ayuntamiento o sede electrónica municipal.',
  },
  {
    titulo: 'Obras menores (reformas): declaración responsable',
    requisitos:
      'Para pequeñas reformas suele bastar una declaración responsable con descripción y presupuesto de la obra; para obras mayores se necesita licencia y proyecto técnico. Consultar el caso concreto con Urbanismo.',
    donde: 'Área de Urbanismo del Ayuntamiento.',
  },
  {
    titulo: 'Instancia general / registro de entrada',
    requisitos:
      'Impreso de instancia general con tus datos y la solicitud; DNI. Sirve para dirigir cualquier petición o documentación al Ayuntamiento. Disponible presencialmente y por sede electrónica (con certificado digital o Cl@ve).',
    donde: 'Registro del Ayuntamiento o sede electrónica.',
  },
  {
    titulo: 'Tarjeta de estacionamiento para personas con movilidad reducida',
    requisitos:
      'Resolución de reconocimiento del grado de discapacidad con baremo de movilidad favorable, DNI y fotografías. Se tramita en Servicios Sociales.',
    donde: 'Servicios Sociales del Ayuntamiento, con cita previa.',
  },
  {
    titulo: 'Pago de tributos municipales (IBI, basuras, vados)',
    requisitos:
      'Los recibos periódicos (IBI, tasa de basuras) pueden domiciliarse. Para consultas o duplicados de recibo, contactar con la oficina de recaudación/tesorería del Ayuntamiento.',
    donde: 'Oficina de Recaudación del Ayuntamiento.',
  },
  {
    titulo: 'Boda civil en el Ayuntamiento',
    requisitos:
      'Expediente matrimonial previo (se inicia en el Registro Civil), DNI/NIE de ambos y de los testigos, y reserva de fecha. Los requisitos exactos los indica el Registro Civil.',
    donde: 'Registro Civil / Ayuntamiento.',
  },
]

const fichas = TRAMITES.map(
  (t) => `- ${t.titulo}. Qué necesitas: ${t.requisitos} Dónde: ${t.donde}`,
).join('\n')

const transporte = transporteData
  .map(
    (l) =>
      `- Línea ${l.numero}: ${l.ruta}. ${l.frecuencia}. Primer bus ${l.primero}, último ${l.ultimo}.`,
  )
  .join('\n')

// Próximos eventos formateados (se recalcula en cada petición para que "hoy"
// sea siempre la fecha actual).
function eventosProximosTexto() {
  const proximos = proximosEventos(eventosData, 8)
  if (!proximos.length) return 'No hay eventos próximos programados ahora mismo.'
  return proximos
    .map((e) => {
      const hora = e.hora ? ` a las ${e.hora}` : ''
      const origen = e.origen === 'municipal' ? 'municipal' : 'vecinal'
      return `- ${formatearFechaLarga(e.fecha)}${hora}: ${e.titulo} (${origen}), en ${e.lugar}. ${e.descripcion || ''}`.trim()
    })
    .join('\n')
}

// Directorio de comercios agrupado por categoría (OSM + servicios curados).
const comercios = (() => {
  const todos = [...comerciosData, ...serviciosLocales]
  return LISTA_CATEGORIAS.map((cat) => {
    const items = todos.filter((c) => c.categoria === cat.id)
    if (!items.length) return null
    const lineas = items
      .map((c) => {
        const tipo = tipoComercio(c, '')
        const detalle = [tipo, c.direccion, c.telefono].filter(Boolean).join(', ')
        return `  - ${c.nombre}${detalle ? ` (${detalle})` : ''}`
      })
      .join('\n')
    return `${cat.nombre}:\n${lineas}`
  })
    .filter(Boolean)
    .join('\n')
})()

// Construye el system prompt completo. Se llama en cada petición para que los
// eventos reflejen siempre las fechas próximas.
export function buildSystemPrompt() {
  return `Eres el asistente vecinal de Navalcarnero (Madrid), un municipio del suroeste de la Comunidad de Madrid. Ayudas a los vecinos con trámites municipales, eventos, transporte, comercios e información local del pueblo.

Reglas:
- Responde SIEMPRE en español, de forma clara, cercana y concisa.
- Escribe en TEXTO PLANO, sin formato Markdown: nada de almohadillas (#), asteriscos (*, **), ni tablas. Usa párrafos cortos y, si necesitas una lista, guiones simples al inicio de línea.
- Cíñete a Navalcarnero y a la información que se te proporciona más abajo. Si te preguntan por otra cosa, ayuda en lo general pero aclara que no dispones de datos locales concretos.
- Para eventos, transporte y comercios, usa EXCLUSIVAMENTE los datos de más abajo. No añadas ninguno que no aparezca en las listas. Los horarios de bus son orientativos.
- El directorio de comercios es limitado (procede de OpenStreetMap y aportaciones vecinales) y puede no incluir todos los negocios del pueblo. Si te piden un tipo de comercio que no aparece, dilo con naturalidad y sugiere consultar la sección Mapa/Directorio de la app. Muchos comercios no tienen teléfono ni horario registrado; en ese caso, sugiere mirarlo en el mapa o acercarse.
- NO inventes teléfonos, direcciones, importes, fechas ni enlaces. Si no tienes el dato exacto, dilo y recomienda verificarlo con el Ayuntamiento o el Consorcio de Transportes (CRTM).
- Para gestiones importantes, recuerda que los requisitos pueden variar y conviene confirmar y pedir cita previa.
- Sé honesto sobre tus límites: eres una ayuda orientativa, no una fuente oficial.

Datos de contacto de referencia:
${CONTACTO}

Trámites municipales (información orientativa):
${fichas}

Próximos eventos en Navalcarnero:
${eventosProximosTexto()}

Líneas de autobús (horarios orientativos):
${transporte}

Directorio de comercios y servicios (agrupados por categoría):
${comercios}`
}
