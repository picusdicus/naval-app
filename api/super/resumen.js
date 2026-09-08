// /api/super/resumen — contadores del panel de superadmin en UNA sola llamada.
//
//   GET — { reclamacionesPendientes, altasPendientes, destacadosRequierenAccion,
//           pendientesSync, propuestasTalleres, organizacionesActivas,
//           organizacionesTotal, eventosPublicados, eventosTotal,
//           usuariosTotal, usuariosAdmin, atencion, actividad,
//           destacadosEnCurso }
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

/**
 * Hermana de contar() para lo que no es un número suelto: devuelve las filas,
 * o null si la consulta falla. Mismo contrato — un fallo aislado deja ESE
 * campo a null, nunca tira la respuesta entera abajo.
 */
async function consultar(etiqueta, consulta) {
  try {
    return await consulta()
  } catch (error) {
    console.error(`Error consultando ${etiqueta} en /api/super/resumen:`, error)
    return null
  }
}

/**
 * Tarjeta de "requiere tu atención" a partir de una fila {n, mas_antigua}.
 * null cuando no hay nada pendiente de ese tipo (el panel omite la tarjeta
 * entera) y null también cuando la consulta falló: un 0 inventado diría "todo
 * al día" sin saberlo.
 */
function tarjetaAtencion(filas) {
  if (filas === null) return null
  const cantidad = Number(filas[0]?.n ?? 0)
  if (cantidad === 0) return null
  return { cantidad, masAntiguaDesde: filas[0]?.mas_antigua ?? null }
}

/** Fila de `destacados` → camelCase, mismo estilo que aRespuesta() del CRUD. */
function aDestacado(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    referenciaId: fila.referencia_id,
    organizacionNombre: fila.organizacion_nombre ?? null,
    imagenUrl: fila.imagen_url ?? null,
    fechaInicio: fila.fecha_inicio,
    fechaFin: fila.fecha_fin,
    nombreResuelto: fila.nombre_resuelto ?? null,
    // estado y vigente viajan para que el cliente pueda usar campanaFinalizada()
    // de src/lib/destacados.js tal cual, sin reimplementar su criterio.
    estado: fila.estado,
    vigente: fila.vigente,
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
    filasReclamaciones,
    filasAltas,
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
    filasActividad,
    filasDestacados,
  ] = await Promise.all([
    // Cuenta y fecha de la más antigua en la MISMA consulta: la tarjeta de
    // atención necesita las dos, y separarlas solo abriría la puerta a que una
    // fallara y la otra no, dejando la tarjeta a medias. La fecha viaja como
    // texto ISO (to_char, convención del proyecto) — el driver de Neon
    // devolvería un Date y convertirlo en JS arrastra la zona horaria.
    consultar(
      'reclamaciones',
      () => sql`
        SELECT count(*)::int AS n,
               to_char(min(creado_en) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS mas_antigua
        FROM solicitudes_reclamacion WHERE estado = 'pendiente'`,
    ),
    consultar(
      'altas',
      () => sql`
        SELECT count(*)::int AS n,
               to_char(min(creado_en) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS mas_antigua
        FROM solicitudes_alta_comercio WHERE estado = 'pendiente'`,
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
    // Últimos sucesos de las cuatro fuentes que dejan rastro fechado. La
    // mezcla y el orden van en SQL (UNION ALL + ORDER BY + LIMIT) y no en JS:
    // así solo viajan las 8 filas que se pintan, en vez de cuatro listas
    // enteras para tirar casi todo al ordenarlas aquí.
    consultar(
      'actividad reciente',
      () => sql`
        SELECT tipo, texto,
               to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS fecha
        FROM (
          SELECT 'alta' AS tipo,
                 'Alta pendiente: ' || nombre AS texto,
                 creado_en AS fecha
            FROM solicitudes_alta_comercio
           WHERE estado = 'pendiente'
          UNION ALL
          -- Solo las YA resueltas: una reclamación pendiente no es un suceso,
          -- es cola de trabajo, y para eso está su tarjeta de atención.
          SELECT 'reclamacion',
                 'Reclamación '
                   || CASE WHEN estado = 'aprobada' THEN 'aprobada' ELSE 'rechazada' END
                   || ': ' || nombre,
                 resuelto_en
            FROM solicitudes_reclamacion
           WHERE resuelto_en IS NOT NULL
          UNION ALL
          SELECT 'codigo',
                 'Código usado · ' || o.nombre,
                 c.ultimo_uso_en
            FROM codigos_invitacion c
            JOIN organizaciones o ON o.id = c.organizacion_id
           WHERE c.ultimo_uso_en IS NOT NULL
          UNION ALL
          -- Un run que no trajo nada no es actividad, es ruido: el cron corre
          -- a diario y taparía lo demás con filas de "0 nuevos".
          SELECT 'sincronizacion',
                 'Sincronización: ' || nuevos
                   || CASE WHEN nuevos = 1 THEN ' nuevo' ELSE ' nuevos' END,
                 ejecutado_en
            FROM ingesta_log
           WHERE nuevos > 0
        ) sucesos
        ORDER BY fecha DESC
        LIMIT 8`,
    ),
    // Campañas EN CURSO para la barra de vigencia del resumen. Solo `activo`:
    // un pendiente puede no tener fechas decididas todavía, y su sitio es la
    // cola de revisión (la tarjeta de atención de arriba), no una barra de
    // plazo que no existe.
    consultar(
      'destacados en curso',
      () => sql`
        SELECT d.id, d.tipo, d.referencia_id, d.imagen_url, d.estado,
               to_char(d.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
               to_char(d.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
               (d.fecha_inicio <= CURRENT_DATE
                 AND (d.fecha_fin IS NULL OR d.fecha_fin >= CURRENT_DATE)) AS vigente,
               o.nombre AS organizacion_nombre,
               -- El nombre se resuelve aquí porque eventos y talleres viven en
               -- Neon. El de un comercio NO (JSON estático del directorio), así
               -- que para ese tipo esta columna sale null y el cliente lo
               -- resuelve con COMERCIOS_POR_ID, que ya viaja en el bundle.
               -- Un evento de fuente estática (ev-…, fiestas-…) tampoco está en
               -- eventos_usuario: también sale null y el cliente cae al id.
               COALESCE(e.titulo, t.nombre) AS nombre_resuelto
        FROM destacados d
        LEFT JOIN organizaciones o ON o.id = d.organizacion_id
        -- referencia_id es TEXTO con el id público del item: los eventos de la
        -- base van prefijados 'bd-' y hay que quitarlo; el cast a texto del
        -- uuid evita el uuid = text que Postgres rechaza.
        LEFT JOIN eventos_usuario e
               ON d.tipo = 'evento' AND d.referencia_id LIKE 'bd-%'
              AND e.id::text = substring(d.referencia_id from 4)
        LEFT JOIN talleres t ON d.tipo = 'taller' AND t.id::text = d.referencia_id
        WHERE d.estado = 'activo'
        -- Orden de urgencia, el mismo criterio que las tarjetas de atención:
        -- primero lo que ya se pasó de plazo, luego lo que menos le queda.
        ORDER BY (d.fecha_fin IS NOT NULL AND d.fecha_fin < CURRENT_DATE) DESC,
                 d.fecha_fin ASC NULLS LAST
        LIMIT 3`,
    ),
  ])

  // La bandeja Pendientes mezcla las dos tablas en un único contador, como el
  // GET de /api/super/pendientes. Si una de las dos falló, el total es null:
  // mejor "—" que una cifra a la que le falta la mitad sin avisar.
  const pendientesSync =
    pendientesEventos === null || pendientesActividades === null
      ? null
      : pendientesEventos + pendientesActividades

  // Las cifras de la sidebar salen de las mismas filas que las tarjetas de
  // atención: una consulta, dos consumidores.
  const reclamacionesPendientes =
    filasReclamaciones === null ? null : Number(filasReclamaciones[0]?.n ?? 0)
  const altasPendientes = filasAltas === null ? null : Number(filasAltas[0]?.n ?? 0)

  const atencion = {
    reclamaciones: tarjetaAtencion(filasReclamaciones),
    altas: tarjetaAtencion(filasAltas),
    // Sin fecha a propósito: el contexto de esta tarjeta ("siguen activos con
    // la vigencia caducada") no depende de cuál sea la más antigua.
    destacados:
      destacadosRequierenAccion === null || destacadosRequierenAccion === 0
        ? null
        : { cantidad: destacadosRequierenAccion },
  }

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
    atencion,
    actividad: filasActividad,
    // null (no []) si la consulta falló: la columna se omite entera con su
    // estado vacío en vez de mezclar filas reales con huecos.
    destacadosEnCurso: filasDestacados === null ? null : filasDestacados.map(aDestacado),
  })
}
