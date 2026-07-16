// Resolución de la organización de la sesión, compartida por los endpoints
// org-scoped de /api/admin/*. El slug viene del JWT firmado, nunca de la
// petición. El guion bajo evita que Vercel lo despliegue como endpoint propio.

/** Devuelve la fila de la organización del slug, o null si ya no existe. */
export async function organizacionDeSesion(sql, slug) {
  const [organizacion] = await sql`
    SELECT id, nombre, slug, categoria_defecto, lugar_defecto, comercio_id
    FROM organizaciones WHERE slug = ${slug}
  `
  return organizacion ?? null
}
