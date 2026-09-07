// Acceso a `talleres_propuestas`: las actualizaciones que una reimportación
// del folleto propone sobre talleres que YA existen (fase 3).
//
// Módulo compartido (Node lo importa desde la importación, Edge desde el
// endpoint del panel), solo SQL: la lógica de emparejar, comparar y fusionar
// vive en src/lib/talleresPropuestas.js, que es "limpio" y lo usa también el
// navegador para pintar el diff.

/**
 * Crea la tabla si falta, igual que hacen los webhooks con las suyas.
 * Idempotente y barato: esto solo lo tocan la importación y el panel del
 * superadmin, y evita que un despliegue anterior a `npm run db:setup` deje la
 * importación rota (que es cuando MÁS falta hace, porque sin tabla volvería a
 * duplicar el catálogo).
 */
export async function asegurarTablaPropuestas(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS talleres_propuestas (
      id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      taller_id uuid NOT NULL UNIQUE REFERENCES talleres(id) ON DELETE CASCADE,
      datos     jsonb NOT NULL,
      curso     text,
      creado_en timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_talleres_propuestas_creado
      ON talleres_propuestas (creado_en DESC)
  `
}

const aSalida = (fila) => ({
  id: fila.id,
  tallerId: fila.taller_id,
  datos: fila.datos,
  curso: fila.curso || '',
  creadoEn: fila.creado_en,
})

/**
 * Deja (o reemplaza) la propuesta pendiente de un taller.
 *
 * UNIQUE (taller_id) + DO UPDATE: reimportar sustituye la pendiente en vez de
 * acumular propuestas del mismo taller.
 */
export async function guardarPropuesta(sql, tallerId, datos, curso) {
  const [fila] = await sql`
    INSERT INTO talleres_propuestas (taller_id, datos, curso)
    VALUES (${tallerId}, ${JSON.stringify(datos)}::jsonb, ${curso || null})
    ON CONFLICT (taller_id) DO UPDATE
      SET datos = EXCLUDED.datos, curso = EXCLUDED.curso, creado_en = now()
    RETURNING id, taller_id, datos, curso, creado_en
  `
  return aSalida(fila)
}

/** Todas las propuestas pendientes, la más reciente primero. */
export async function leerPropuestas(sql) {
  const filas = await sql`
    SELECT id, taller_id, datos, curso, creado_en
    FROM talleres_propuestas
    ORDER BY creado_en DESC
  `
  return filas.map(aSalida)
}

/** Una propuesta por su id (para aceptarla), o null. */
export async function leerPropuesta(sql, id) {
  const [fila] = await sql`
    SELECT id, taller_id, datos, curso, creado_en
    FROM talleres_propuestas
    WHERE id = ${id}
  `
  return fila ? aSalida(fila) : null
}

/**
 * Quita la propuesta pendiente de un taller, si la hay. La llama la
 * importación cuando lo extraído ya coincide con lo guardado: una propuesta de
 * una importación anterior que hoy no cambiaría nada es ruido en la bandeja.
 */
export async function borrarPropuestaDeTaller(sql, tallerId) {
  const [fila] = await sql`
    DELETE FROM talleres_propuestas WHERE taller_id = ${tallerId} RETURNING id
  `
  return Boolean(fila)
}

/** Quita la propuesta (la acepte o la descarte el superadmin). */
export async function borrarPropuesta(sql, id) {
  const [fila] = await sql`
    DELETE FROM talleres_propuestas WHERE id = ${id} RETURNING id
  `
  return Boolean(fila)
}
