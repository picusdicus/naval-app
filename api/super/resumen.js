// /api/super/resumen — contadores del panel de superadmin en UNA sola llamada.
//
//   GET — { reclamacionesPendientes, altasPendientes, destacadosRequierenAccion,
//           pendientesSync, propuestasTalleres, organizacionesActivas,
//           organizacionesTotal, eventosPublicados, eventosTotal,
//           usuariosTotal, usuariosAdmin }
//
// Sustituye a los tres GET completos que el panel hacía solo para contar
// (destacados, pendientes, talleres-propuestas): traían listas enteras para
// quedarse con su `length`. Aquí solo viajan números.
//
// Cada contador va en su propia consulta y se resuelven en paralelo: si una
// falla, ESE campo vale null y el resto de la respuesta sigue siendo útil (el
// panel pinta "—" en ese contador en vez de quedarse sin ninguno).
import { obtenerSql } from '../_db.js'
import { requerirSuperAdminEdge } from '../_auth.js'
import { json } from '../_http.js'

export const config = { runtime: 'edge' }

/** Ejecuta una consulta de conteo; devuelve null (no lanza) si falla. */
async function contar(etiqueta, consulta) {
  try {
    const filas = await consulta()
    return Number(filas[0]?.n ?? 0)
  } catch (error) {
    console.error(`Error contando ${etiqueta} en /api/super/resumen:`, error)
    return null
  }
}

export default async function handler(req) {
  const sesion = await requerirSuperAdminEdge(req)
  if (sesion instanceof Response) return sesion

  if (req.method !== 'GET') return json({ error: 'Método no permitido' }, 405)

  let sql
  try {
    sql = obtenerSql()
  } catch (error) {
    console.error('Error en /api/super/resumen:', error)
    return json({ error: 'No se pudo conectar con la base de datos.' }, 503)
  }

  const [
    reclamacionesPendientes,
    altasPendientes,
    destacadosRequierenAccion,
    pendientesEventos,
    pendientesActividades,
    propuestasTalleres,
    organizacionesActivas,
    organizacionesTotal,
    eventosPublicados,
    eventosTotal,
    usuariosTotal,
    usuariosAdmin,
  ] = await Promise.all([
    contar(
      'reclamaciones',
      () => sql`SELECT count(*)::int AS n FROM solicitudes_reclamacion WHERE estado = 'pendiente'`,
    ),
    contar(
      'altas',
      () => sql`SELECT count(*)::int AS n FROM solicitudes_alta_comercio WHERE estado = 'pendiente'`,
    ),
    // "Requiere acción" = lo que el superadmin todavía tiene que tocar: las
    // solicitudes sin aprobar más las campañas activas cuyo plazo ya pasó
    // (la "campaña finalizada" de src/lib/destacados.js: activo + fecha_fin
    // vencida, que es justo la negación del `vigente` del GET público por el
    // lado del fin). Un activo que aún no ha empezado NO cuenta: no hay nada
    // que hacer con él todavía.
    contar(
      'destacados',
      () => sql`
        SELECT count(*)::int AS n FROM destacados
        WHERE estado = 'pendiente'
           OR (estado = 'activo' AND fecha_fin IS NOT NULL AND fecha_fin < CURRENT_DATE)`,
    ),
    // Mismo criterio que /api/super/pendientes: solo lo auto-sincronizado
    // (origen_externo_id NOT NULL), no los borradores de las organizaciones.
    contar(
      'pendientes (eventos)',
      () => sql`
        SELECT count(*)::int AS n FROM eventos_usuario
        WHERE estado = 'borrador' AND origen_externo_id IS NOT NULL`,
    ),
    contar(
      'pendientes (actividades)',
      () => sql`SELECT count(*)::int AS n FROM actividades WHERE estado = 'borrador'`,
    ),
    contar('propuestas de talleres', () => sql`SELECT count(*)::int AS n FROM talleres_propuestas`),
    contar(
      'organizaciones activas',
      () => sql`SELECT count(*)::int AS n FROM organizaciones WHERE activa = true`,
    ),
    contar('organizaciones', () => sql`SELECT count(*)::int AS n FROM organizaciones`),
    contar(
      'eventos publicados',
      () => sql`SELECT count(*)::int AS n FROM eventos_usuario WHERE estado = 'publicado'`,
    ),
    contar('eventos', () => sql`SELECT count(*)::int AS n FROM eventos_usuario`),
    contar('usuarios', () => sql`SELECT count(*)::int AS n FROM usuarios`),
    contar(
      'usuarios admin',
      () => sql`SELECT count(*)::int AS n FROM usuarios WHERE rol IN ('admin', 'superadmin')`,
    ),
  ])

  // La bandeja Pendientes mezcla las dos tablas en un único contador, como el
  // GET de /api/super/pendientes. Si una de las dos falló, el total es null:
  // mejor "—" que una cifra a la que le falta la mitad sin avisar.
  const pendientesSync =
    pendientesEventos === null || pendientesActividades === null
      ? null
      : pendientesEventos + pendientesActividades

  return json({
    reclamacionesPendientes,
    altasPendientes,
    destacadosRequierenAccion,
    pendientesSync,
    propuestasTalleres,
    organizacionesActivas,
    organizacionesTotal,
    eventosPublicados,
    eventosTotal,
    usuariosTotal,
    usuariosAdmin,
  })
}
