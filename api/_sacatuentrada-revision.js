// Escritura en Neon (y Blob) de lo que trae la taquilla del Teatro Municipal
// Centro (api/_sacatuentrada-feed.js). SOLO la llama api/sync-events.js, en su
// propio try: un fallo aquí no rompe la sincronización del JSON ni el digest.
//
// Dos caminos, decididos por emparejarObrasConFilas():
//
// - Obra EMPAREJADA con una fila de eventos_usuario (hoy: las funciones del
//   CETAN que el webhook de Instagram creó desde el cartel-programa, todas con
//   el mismo cartel del certamen y sin entradas): UPDATE ACOTADO directo, sin
//   cola de propuestas (decisión 2026-09-22, proporcional a ~7 filas/año):
//     · imagen_url se SUSTITUYE por el cartel real de la obra, pero solo si la
//       imagen actual viene de una ingesta (origen_externo_id no nulo: ig-,
//       ste-, …) o está vacía — un cartel subido a mano por una organización
//       (origen_externo_id NULL) no se toca nunca, coherente con
//       prioridadDeImagen() del dedup de la agenda;
//     · entradas_texto / entradas_url / precio se RELLENAN solo si están
//       vacíos (los campos que ya existen en el formulario de /panel);
//     · estado, notificado_en, titulo y descripcion NO se tocan (una fila
//       publicada sigue publicada, una archivada sigue archivada).
//   Idempotente sin tabla nueva: con la imagen ya bajo `sacatuentrada/` y las
//   entradas puestas, el run siguiente no escribe nada.
//
// - Obra SIN pareja: se completa (detalle + entradas, dos peticiones más) y
//   nace `borrador` en eventos_usuario con origen_externo_id `ste-…` (patrón
//   upsertDeportesEnRevision: el ON CONFLICT no toca `estado`, así que un
//   descartado en Pendientes no resucita). Organización cultura-navalcarnero
//   (la Concejalía que vende las entradas). Entra en Pendientes y avisa por
//   email solo de lo insertado ese run.
//
// Cartel: se COPIA a Blob (`sacatuentrada/<idFuente>.<ext>`), no se enlaza —
// el CDN de tenemosplan devolvió 502 en todas las pruebas del 2026-09-22 para
// las miniaturas, y las condiciones del sitio permiten enlazar pero no
// garantizan nada. Un `put()` por obra y solo la primera vez (la comprobación
// de existencia va contra Neon, nunca contra Blob — ver "Presupuesto de
// Vercel Blob" en CLAUDE.md).

import { put } from '@vercel/blob'
import { TIPOS_IMAGEN, MAX_IMAGEN_BYTES, hayCredencialesBlob, ORG_CULTURA, asegurarOrganizacion } from './_instagram.js'
import {
  obtenerPortadaSacatuentrada,
  completarObra,
  emparejarObrasConFilas,
  idDeObra,
  LUGAR_TEATRO_CENTRO,
  TEXTO_ENTRADAS,
} from './_sacatuentrada-feed.js'
import { registrarIngesta } from './_ingesta-log.js'

export const PREFIJO_BLOB = 'sacatuentrada'
// Mismo tope que MAX_DESCRIPCION_INGESTA en sync-events.js (no exportado).
const MAX_DESCRIPCION = 800
const USER_AGENT = 'NavalcarneroApp/0.1 (proyecto vecinal; +https://ennavalcarnero.es)'

/** Tipo de imagen por cabecera o, si el CDN no lo declara bien, por magic bytes. */
function tipoDeImagen(contentType, buf) {
  const declarado = (contentType || '').split(';')[0].trim().toLowerCase()
  if (TIPOS_IMAGEN[declarado]) return declarado
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
  if (buf.length > 8 && buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png'
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

/**
 * Descarga el cartel (probando las URLs en orden: original y miniatura) y lo
 * sube a Blob con nombre determinista. Devuelve la URL de Blob o null; nunca
 * lanza (la imagen es opcional, y una fila sin cartel se reintenta en el
 * siguiente run porque imagen_url sigue sin ser de `sacatuentrada/`).
 */
export async function subirCartel(obra) {
  if (!obra.urlsCartel?.length) return null
  if (!hayCredencialesBlob()) {
    console.warn('sacatuentrada: sin credencial de Blob, cartel no copiado')
    return null
  }
  for (const url of obra.urlsCartel) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const contenido = Buffer.from(await res.arrayBuffer())
      const tipo = tipoDeImagen(res.headers.get('content-type'), contenido)
      if (!tipo) throw new Error(`tipo no admitido: ${res.headers.get('content-type') || 'desconocido'}`)
      if (contenido.length === 0 || contenido.length > MAX_IMAGEN_BYTES) {
        throw new Error(`tamaño fuera de límite (${contenido.length} bytes)`)
      }
      const { url: urlBlob } = await put(`${PREFIJO_BLOB}/${obra.idFuente}.${TIPOS_IMAGEN[tipo]}`, contenido, {
        access: 'public',
        contentType: tipo,
        addRandomSuffix: false,
        allowOverwrite: true,
        ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
      })
      return urlBlob
    } catch (err) {
      console.warn(`sacatuentrada: cartel de ${obra.slug} no copiado desde ${url}: ${err.message}`)
    }
  }
  return null
}

/** ¿La imagen actual de la fila puede sustituirse por el cartel de la taquilla? */
export function imagenSustituible(fila) {
  if (!fila.imagen_url) return true
  if (fila.imagen_url.includes(`/${PREFIJO_BLOB}/`)) return false // ya es la nuestra
  return fila.origen_externo_id != null // cartel de ingesta, nunca uno subido a mano
}

/**
 * Filas de eventos_usuario en las fechas de las obras (cualquier estado: una
 * fila archivada a mano debe seguir emparejando, para no resucitarla como
 * borrador nuevo). La forma es la que espera emparejarObrasConFilas().
 */
export async function leerFilasCandidatas(sql, obras) {
  const fechas = [...new Set(obras.map((o) => o.fecha))]
  if (!fechas.length) return []
  return sql`
    SELECT id, titulo, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha, lugar, estado,
           origen_externo_id, imagen_url, entradas_url, precio
    FROM eventos_usuario
    WHERE fecha_inicio = ANY(${fechas}::date[])
    ORDER BY creado_en ASC
  `
}

function descripcionDeObra(obra) {
  const partes = [
    obra.sinopsis,
    obra.compania ? `Compañía: ${obra.compania}.` : '',
    obra.certamen ? `Dentro de ${obra.certamen}.` : '',
    obra.textoVenta,
  ].filter(Boolean)
  const texto = partes.join('\n\n')
  return texto.length > MAX_DESCRIPCION ? `${texto.slice(0, MAX_DESCRIPCION - 1).trimEnd()}…` : texto
}

/**
 * Aplica el emparejamiento: UPDATE acotado en las emparejadas, INSERT en
 * borrador de las que no tienen pareja. `deps` permite inyectar `completar`
 * y `subir` desde un diagnóstico (nunca en producción).
 */
export async function aplicarObras(sql, { emparejadas, sinPareja }, deps = {}) {
  const completar = deps.completar || completarObra
  const subir = deps.subir || subirCartel
  const resumen = {
    emparejadas: { propia: 0, equivalente: 0, aproximado: 0, fechaLugar: 0 },
    imagenesSustituidas: 0,
    entradasRellenadas: 0,
    sinCambios: 0,
    creadas: 0,
    filasCreadas: [],
    revisar: [],
    errores: [],
  }

  for (const { obra, fila, nivel } of emparejadas) {
    resumen.emparejadas[nivel === 'fecha-lugar' ? 'fechaLugar' : nivel]++
    try {
      const cambios = {}
      if (obra.urlsCartel.length && imagenSustituible(fila)) {
        const url = await subir(obra)
        if (url) cambios.imagen_url = url
      }
      if (!fila.entradas_url && obra.urlCompra) {
        cambios.entradas_texto = TEXTO_ENTRADAS
        cambios.entradas_url = obra.urlCompra
        if (!fila.precio && obra.precio) cambios.precio = obra.precio
      }
      if (!Object.keys(cambios).length) {
        resumen.sinCambios++
        continue
      }
      await sql`
        UPDATE eventos_usuario SET
          imagen_url = COALESCE(${cambios.imagen_url ?? null}, imagen_url),
          entradas_texto = COALESCE(${cambios.entradas_texto ?? null}, entradas_texto),
          entradas_url = COALESCE(${cambios.entradas_url ?? null}, entradas_url),
          precio = COALESCE(${cambios.precio ?? null}, precio),
          actualizado_en = now()
        WHERE id = ${fila.id}
      `
      if (cambios.imagen_url) resumen.imagenesSustituidas++
      if (cambios.entradas_url) resumen.entradasRellenadas++
      // Solo la primera vez que se escribe algo en una pareja decidida por
      // fecha y lugar (sin coincidencia de título): es la que conviene mirar.
      if (nivel === 'fecha-lugar') resumen.revisar.push({ titulo: `${fila.titulo} ← ${obra.rotulo}`, fecha: obra.fecha })
    } catch (err) {
      resumen.errores.push(`sacatuentrada (${obra.slug} → ${fila.id}): ${err.message}`)
    }
  }

  if (sinPareja.length) {
    let organizacionId = null
    try {
      organizacionId = await asegurarOrganizacion(sql, ORG_CULTURA)
    } catch (err) {
      resumen.errores.push(`sacatuentrada (organización): ${err.message}`)
      return resumen
    }
    for (const obra of sinPareja) {
      try {
        const completa = await completar(obra) // 2 peticiones, en secuencia
        const imagenUrl = await subir(completa)
        const filas = await sql`
          INSERT INTO eventos_usuario
            (organizacion_id, titulo, descripcion, categoria, subcategoria,
             fecha_inicio, hora, lugar, url, imagen_url, estado, origen_externo_id,
             entradas_texto, entradas_url, precio)
          VALUES
            (${organizacionId}, ${completa.titulo}, ${descripcionDeObra(completa)}, 'cultura', 'teatro',
             ${completa.fecha}, ${completa.hora}, ${LUGAR_TEATRO_CENTRO}, ${completa.urlDetalle},
             ${imagenUrl}, 'borrador', ${idDeObra(completa)},
             ${completa.urlCompra ? TEXTO_ENTRADAS : null}, ${completa.urlCompra || null}, ${completa.precio || null})
          ON CONFLICT (origen_externo_id) WHERE origen_externo_id IS NOT NULL
          DO UPDATE SET
            imagen_url = COALESCE(EXCLUDED.imagen_url, eventos_usuario.imagen_url),
            actualizado_en = now()
          RETURNING (xmax = 0) AS insertada
        `
        if (filas[0]?.insertada) {
          resumen.creadas++
          resumen.filasCreadas.push({ titulo: completa.titulo, fecha: completa.fecha })
        }
      } catch (err) {
        resumen.errores.push(`sacatuentrada (${obra.slug}): ${err.message}`)
      }
    }
  }
  return resumen
}

/**
 * Paso completo: portada → filas de Neon → emparejar → aplicar → ingesta_log.
 * Devuelve el resumen de aplicarObras() más `obras` (cuántas listaba la
 * portada). La fila de ingesta_log (fuente `sacatuentrada`) cuenta:
 * candidatos = obras en portada, emparejados = con fila en Neon, nuevos =
 * borradores insertados; los motivos son contadores informativos de tubería,
 * no descartes (descartados se pasa explícito a 0, como en deportes).
 */
export async function sincronizarSacatuentrada(sql, deps = {}) {
  const obras = await (deps.obtenerPortada || obtenerPortadaSacatuentrada)()
  const filas = await leerFilasCandidatas(sql, obras)
  const emparejamiento = emparejarObrasConFilas(obras, filas)
  const resumen = await aplicarObras(sql, emparejamiento, deps)
  await registrarIngesta({
    fuente: 'sacatuentrada',
    candidatos: obras.length,
    emparejados: emparejamiento.emparejadas.length,
    nuevos: resumen.creadas,
    descartados: 0,
    motivos: {
      'ya creada por esta fuente': resumen.emparejadas.propia,
      'emparejada por título equivalente': resumen.emparejadas.equivalente,
      'emparejada por título aproximado': resumen.emparejadas.aproximado,
      'emparejada por fecha y lugar (revisar)': resumen.emparejadas.fechaLugar,
      'cartel sustituido': resumen.imagenesSustituidas,
      'entradas rellenadas': resumen.entradasRellenadas,
      'sin cambios': resumen.sinCambios,
    },
  })
  return { obras: obras.length, ...resumen }
}
