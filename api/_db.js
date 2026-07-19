// Acceso a Neon Postgres desde las funciones serverless de Vercel.
// El guion bajo evita que Vercel lo despliegue como endpoint propio.
import { neon } from '@neondatabase/serverless'

let cliente = null

/**
 * Devuelve el cliente SQL de Neon (tagged template), reutilizándolo entre
 * invocaciones para aprovechar el reciclado de instancias de Fluid Compute.
 *
 *   const sql = obtenerSql()
 *   const filas = await sql`SELECT * FROM organizaciones WHERE activa = true`
 */
export function obtenerSql() {
  if (cliente) return cliente

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) {
    throw new Error('Falta DATABASE_URL: conecta la base de datos Neon en Vercel.')
  }

  cliente = neon(url)
  return cliente
}

/** Las tablas que debe tener el esquema inicial, en orden de dependencia. */
export const TABLAS = [
  'organizaciones',
  'codigos_invitacion',
  'usuarios',
  'eventos_usuario',
  'destacados',
  'push_suscripciones',
]
