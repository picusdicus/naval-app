// /api/super/talleres-propuestas — la bandeja de actualizaciones que una
// reimportación del folleto propone sobre talleres que YA existen (fase 3).
//
//   GET           — propuestas pendientes (el panel calcula el diff en cliente
//                   contra el taller vivo que ya tiene cargado)
//   POST   ?id=   — aceptar: fusiona lo extraído sobre el taller y borra la fila
//   DELETE ?id=   — descartar: borra la fila sin tocar el taller
//
// Aceptar NO admite un cuerpo con el resultado ya fusionado: la fusión la hace
// el servidor leyendo el taller vivo, así que el cliente no puede colar campos
// que el folleto no traía. Para editar antes de aceptar, el panel abre el
// formulario de siempre (PUT de /api/super/talleres) y luego DELETE aquí.
import { requerirSuperAdminEdge } from '../_auth.js'
import { obtenerSql } from '../_db.js'
import { json, queryDe, csrfInvalido, rechazoCsrf } from '../_http.js'
import { validarTaller, normalizarTaller } from '../../src/lib/tallerForm.js'
import { fusionarConPropuesta } from '../../src/lib/talleresPropuestas.js'
import { aSalida, turnosDe, guardarTurnos } from './talleres.js'
import {
  asegurarTablaPropuestas,
  borrarPropuesta,
  leerPropuesta,
  leerPropuestas,
} from '../_talleres-propuestas.js'

export const config = { runtime: 'edge' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El taller vivo con sus turnos, en el shape del panel. */
async function tallerVivo(sql, id) {
  const [fila] = await sql`
    SELECT id, nombre, categoria, descripcion, lugar, precio, edades,
           imagen_url, curso, estado
    FROM talleres WHERE id = ${id}
  `
  if (!fila) return null
  const turnos = await turnosDe(sql, [id])
  return aSalida(fila, turnos.get(id))
}

async function aceptar(sql, id) {
  const propuesta = await leerPropuesta(sql, id)
  if (!propuesta) return json({ error: 'Esa propuesta ya no existe.' }, 404)

  const existente = await tallerVivo(sql, propuesta.tallerId)
  if (!existente) {
    // El taller se borró entre la importación y ahora. La fila de la propuesta
    // ya habría caído por ON DELETE CASCADE, así que esto es defensivo.
    await borrarPropuesta(sql, id)
    return json({ error: 'El taller que iba a actualizarse ya no existe.' }, 404)
  }

  // El taller guardado manda en lo que el folleto no sabe (descripción,
  // cartel, estado, curso; el destacado vive en otra tabla y ni se toca).
  const fusionado = fusionarConPropuesta(existente, propuesta.datos)

  const errores = validarTaller(fusionado)
  if (Object.keys(errores).length > 0) {
    return json({ error: 'La actualización no es válida.', errores }, 422)
  }

  const t = normalizarTaller(fusionado)
  const [fila] = await sql`
    UPDATE talleres SET
      nombre = ${t.nombre}, categoria = ${t.categoria}, descripcion = ${t.descripcion},
      lugar = ${t.lugar}, precio = ${t.precio}, edades = ${t.edades},
      imagen_url = ${t.imagen}, curso = ${t.curso}, estado = ${t.estado},
      actualizado_en = now()
    WHERE id = ${propuesta.tallerId}
    RETURNING id, nombre, categoria, descripcion, lugar, precio, edades,
              imagen_url, curso, estado
  `
  if (!fila) return json({ error: 'Ese taller no existe.' }, 404)

  await guardarTurnos(sql, propuesta.tallerId, t.turnos)
  await borrarPropuesta(sql, id)

  return json({ taller: aSalida(fila, t.turnos) })
}

export default async function handler(req) {
  const guardia = await requerirSuperAdminEdge(req)
  if (guardia instanceof Response) return guardia

  const metodo = req.method
  if (metodo !== 'GET' && csrfInvalido(req)) return rechazoCsrf()

  const sql = obtenerSql()
  await asegurarTablaPropuestas(sql)

  const { id = '' } = queryDe(req)
  if (metodo !== 'GET' && !UUID.test(id)) {
    return json({ error: 'Falta el identificador de la propuesta.' }, 400)
  }

  try {
    if (metodo === 'GET') {
      return json({ propuestas: await leerPropuestas(sql) })
    }
    if (metodo === 'POST') {
      return await aceptar(sql, id)
    }
    if (metodo === 'DELETE') {
      const borrada = await borrarPropuesta(sql, id)
      if (!borrada) return json({ error: 'Esa propuesta ya no existe.' }, 404)
      return json({ ok: true })
    }
    return json({ error: 'Método no permitido' }, 405)
  } catch (error) {
    console.error('Error en talleres-propuestas:', error)
    return json({ error: 'No se pudo completar la operación.' }, 500)
  }
}
