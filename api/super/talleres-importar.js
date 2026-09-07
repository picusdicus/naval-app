// POST /api/super/talleres-importar — importa el catálogo de talleres desde el
// folleto municipal de horarios en PDF. Dos vías:
//
//   { pdfBase64, nombreFichero?, curso }  — el superadmin sube el fichero
//   { url, curso }                        — el servidor lo descarga (allowlist)
//
// Todo lo importado nace `borrador`: un fallo de extracción no es un item sino
// decenas, así que pasa por la revisión humana del propio tab Talleres (filtro
// por estado), igual que las actividades extraídas de documentos. NO publica
// nada automáticamente y NO archiva el catálogo anterior — el archivado tiene
// su propio corte del 31 de julio y es independiente de cuándo se importe.
//
// Reimportar NO duplica el catálogo (fase 3): un taller extraído cuyo nombre ya
// existe en ese mismo curso no crea fila, deja una PROPUESTA DE ACTUALIZACIÓN
// en `talleres_propuestas` para que el superadmin vea el diff y decida. Si lo
// extraído coincide en todo con lo guardado no se propone nada ("sin cambios").
//
// Node y no Edge —a diferencia de api/super/talleres.js— porque el SDK de
// Anthropic y los Buffers de PDF necesitan el runtime de Node.
export const config = { runtime: 'nodejs' }

import { requerirSesion } from '../_auth.js'
import { csrfInvalido } from '../_http.js'
import { obtenerSql } from '../_db.js'
import { descargarDocumento, esUrlMunicipal } from '../_descargar-documento.js'
import { extraerTalleresDePdf } from '../_talleres-parser.js'
import { validarTaller, normalizarTaller, LIMITES } from '../../src/lib/tallerForm.js'
import { diferenciasTaller, emparejarTaller } from '../../src/lib/talleresPropuestas.js'
import {
  asegurarTablaPropuestas,
  borrarPropuestaDeTaller,
  guardarPropuesta,
} from '../_talleres-propuestas.js'
import { aSalida, turnosDe } from './talleres.js'

// El cuerpo de una función de Vercel está limitado (~4,5 MB) y base64 infla un
// tercio, así que el PDF que llega por el cuerpo no puede pasar de 3 MB — el
// mismo tope que las imágenes de api/admin/imagen.js y por el mismo motivo. El
// folleto real ocupa 180 KB. Para un PDF mayor está la vía por URL, que lo
// descarga en el servidor y admite hasta 15 MB.
const MAX_PDF_SUBIDO = 3 * 1024 * 1024

/** Convierte un taller extraído en algo que el resto del sistema acepta. */
function prepararTaller(bruto, curso) {
  return normalizarTaller({
    nombre: bruto?.nombre ?? '',
    categoria: bruto?.categoria ?? '',
    descripcion: '',
    lugar: bruto?.lugar ?? '',
    precio: bruto?.precio ?? '',
    edades: bruto?.edades ?? '',
    imagen: '',
    curso,
    // Nace SIEMPRE borrador, pase lo que pase en el cliente.
    estado: 'borrador',
    // Un taller sin turnos se guarda con uno vacío, que la ficha pinta como
    // "Por determinar" — es lo que hace el folleto con Historia del arte.
    turnos: Array.isArray(bruto?.turnos) && bruto.turnos.length > 0 ? bruto.turnos : [{}],
  })
}

/**
 * Talleres YA guardados de ese curso, con sus turnos, para emparejar contra
 * ellos. CUALQUIER estado cuenta: un borrador de una importación anterior sin
 * revisar también es una fila del catálogo, y volver a crearlo sería justo el
 * duplicado que esto evita.
 */
async function catalogoDelCurso(sql, curso) {
  const filas = await sql`
    SELECT id, nombre, categoria, descripcion, lugar, precio, edades,
           imagen_url, curso, estado
    FROM talleres
    WHERE curso = ${curso}
  `
  const turnos = await turnosDe(sql, filas.map((t) => t.id))
  return filas.map((t) => aSalida(t, turnos.get(t.id)))
}

async function insertar(sql, taller) {
  const [fila] = await sql`
    INSERT INTO talleres (nombre, categoria, descripcion, lugar, precio, edades,
                          imagen_url, curso, estado)
    VALUES (${taller.nombre}, ${taller.categoria}, ${taller.descripcion}, ${taller.lugar},
            ${taller.precio}, ${taller.edades}, ${taller.imagen}, ${taller.curso}, 'borrador')
    RETURNING id, nombre, categoria, curso, estado
  `
  for (const t of taller.turnos) {
    await sql`
      INSERT INTO talleres_horarios (taller_id, etiqueta, dias, hora_inicio, hora_fin, lugar, orden)
      VALUES (${fila.id}, ${t.etiqueta || null}, ${t.dias}, ${t.horaInicio || null},
              ${t.horaFin || null}, ${t.lugar || null}, ${t.orden})
    `
  }
  return { ...fila, turnos: taller.turnos.length }
}

/** Obtiene el PDF de la vía que corresponda. Devuelve {buffer} o {error, status}. */
async function obtenerPdf(cuerpo) {
  const url = String(cuerpo.url ?? '').trim()
  const base64 = String(cuerpo.pdfBase64 ?? '')

  if (url) {
    // Allowlist: este endpoint descarga y manda a un modelo lo que le digan,
    // así que solo se sigue a la web municipal (mismo criterio que el webhook).
    const permitida = esUrlMunicipal(url)
    if (!permitida) {
      return { error: 'Solo se pueden importar documentos de navalcarnero.es.', status: 400 }
    }
    try {
      const doc = await descargarDocumento(permitida)
      if (doc.tipo !== 'pdf') {
        return { error: 'Ese enlace no es un PDF.', status: 400 }
      }
      return { buffer: doc.buffer }
    } catch (error) {
      return { error: error.message, status: 502 }
    }
  }

  if (!base64) return { error: 'Sube un PDF o indica su enlace.', status: 400 }

  const limpio = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64
  const buffer = Buffer.from(limpio, 'base64')
  if (buffer.length === 0) return { error: 'El PDF está vacío o no se pudo leer.', status: 400 }
  if (buffer.length > MAX_PDF_SUBIDO) {
    return {
      error: `El PDF ocupa ${(buffer.length / 1024 / 1024).toFixed(1)} MB y el máximo por subida es 3 MB. Si está publicado en navalcarnero.es, impórtalo por enlace.`,
      status: 413,
    }
  }
  // Firma de PDF: evita mandar a la API un fichero que no lo es.
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return { error: 'El fichero no es un PDF.', status: 400 }
  }
  return { buffer }
}

export default async function handler(req, res) {
  if (csrfInvalido(req)) {
    return res.status(403).json({ error: 'Origen no permitido.' })
  }

  let sesion
  try {
    sesion = await requerirSesion(req, res)
  } catch (error) {
    console.error('Sesión mal configurada:', error.message)
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!sesion) return
  if (sesion.rol !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo superadmin.' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La importación no está configurada (falta ANTHROPIC_API_KEY).' })
  }

  const cuerpo = req.body || {}
  const curso = String(cuerpo.curso ?? '').trim()
  if (!curso) return res.status(400).json({ error: 'Indica a qué curso pertenece el folleto.' })
  if (curso.length > LIMITES.curso) {
    return res.status(400).json({ error: `El curso no puede superar ${LIMITES.curso} caracteres.` })
  }

  const pdf = await obtenerPdf(cuerpo)
  if (pdf.error) return res.status(pdf.status).json({ error: pdf.error })

  let extraccion
  try {
    extraccion = await extraerTalleresDePdf(pdf.buffer)
  } catch (error) {
    console.error('Error al extraer talleres del PDF:', error)
    return res.status(502).json({ error: `No se pudo leer el folleto: ${error.message}` })
  }

  if (extraccion.talleres.length === 0) {
    return res.status(422).json({ error: 'No se reconoció ningún taller en ese documento.' })
  }

  // Se valida CADA taller con la misma función del formulario: lo que no pase
  // se descarta con su motivo en vez de romper la importación entera — un
  // folleto con una fila rara no debe impedir importar las otras trece.
  const sql = obtenerSql()
  await asegurarTablaPropuestas(sql)

  const existentes = await catalogoDelCurso(sql, curso)
  const creados = []
  const propuestas = []
  const sinCambios = []
  const descartados = []
  // Un taller ya emparejado en esta misma pasada no vuelve a emparejarse: si el
  // folleto trae dos filas con el mismo nombre, la segunda se trata como taller
  // nuevo (y se ve en borrador) en vez de pisar la propuesta de la primera.
  const yaEmparejados = new Set()

  for (const bruto of extraccion.talleres) {
    const taller = prepararTaller(bruto, curso)
    const errores = validarTaller(taller)
    if (Object.keys(errores).length > 0) {
      descartados.push({ nombre: taller.nombre || '(sin nombre)', motivo: Object.values(errores)[0] })
      continue
    }

    const encontrado = emparejarTaller(taller, existentes, curso)
    const emparejado = encontrado && !yaEmparejados.has(encontrado.id) ? encontrado : null

    try {
      if (!emparejado) {
        creados.push(await insertar(sql, taller))
        continue
      }
      yaEmparejados.add(emparejado.id)

      // Idéntico a lo guardado: ni fila nueva ni propuesta que revisar. Es lo
      // que hace que reimportar el mismo folleto después de aceptarlo todo no
      // deje nada pendiente.
      const cambios = diferenciasTaller(emparejado, taller)
      if (cambios.length === 0) {
        // Y si quedaba una propuesta de una importación anterior, sobra: hoy no
        // cambiaría nada y solo sería ruido en la bandeja.
        await borrarPropuestaDeTaller(sql, emparejado.id)
        sinCambios.push({ id: emparejado.id, nombre: emparejado.nombre })
        continue
      }

      const propuesta = await guardarPropuesta(sql, emparejado.id, taller, curso)
      propuestas.push({
        id: propuesta.id,
        tallerId: emparejado.id,
        nombre: emparejado.nombre,
        campos: cambios.map((c) => c.etiqueta),
      })
    } catch (error) {
      console.error(`No se pudo procesar el taller "${taller.nombre}":`, error)
      descartados.push({ nombre: taller.nombre, motivo: 'No se pudo guardar en la base de datos.' })
    }
  }

  console.log(
    `[talleres-importar] curso ${curso}: ${creados.length} creados, ` +
      `${propuestas.length} propuestas, ${sinCambios.length} sin cambios, ` +
      `${descartados.length} descartados` +
      (extraccion.uso ? ` (${extraccion.uso.input_tokens} tokens de entrada)` : '')
  )

  return res.status(201).json({
    creados: creados.length,
    propuestas,
    sinCambios,
    descartados,
    curso,
    // El curso que el modelo leyó en el folleto, para avisar si no coincide con
    // el que eligió el superadmin (que es el que manda).
    cursoDetectado: extraccion.curso,
    talleres: creados,
  })
}
