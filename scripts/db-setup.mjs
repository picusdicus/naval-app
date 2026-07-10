// Aplica db/schema.sql sobre Neon Postgres y siembra los datos de prueba
// (organización TYL TYL + su código de invitación). Es idempotente: se puede
// ejecutar tantas veces como haga falta.
//
//   npm run db:setup
//
// Necesita DATABASE_URL. Se lee de .env.local (generado por `vercel env pull`)
// o del entorno.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Vuelca las claves de un fichero .env en process.env sin pisar lo existente. */
function cargarEnv(fichero) {
  let contenido
  try {
    contenido = readFileSync(resolve(raiz, fichero), 'utf8')
  } catch {
    return
  }
  for (const linea of contenido.split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const valor = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = valor
  }
}

cargarEnv('.env.local')
cargarEnv('.env')

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) {
  console.error('Falta DATABASE_URL. Ejecuta: npx vercel env pull .env.local')
  process.exit(1)
}

const sql = neon(url)

// El driver HTTP de Neon solo admite una sentencia por petición.
function trocearSentencias(texto) {
  return texto
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(--.*(\r?\n|$))+$/.test(s))
}

async function aplicarEsquema() {
  const sentencias = trocearSentencias(readFileSync(resolve(raiz, 'db/schema.sql'), 'utf8'))
  for (const sentencia of sentencias) {
    await sql.query(sentencia)
  }
  console.log(`Esquema aplicado (${sentencias.length} sentencias).`)
}

const ORG_PRUEBA = {
  nombre: 'Teatro TYL TYL',
  slug: 'tyl-tyl',
  descripcion:
    'Compañía y sala de teatro en Navalcarnero. Organización de prueba para validar el alta de eventos.',
  email_contacto: 'info@tyltyl.org',
  web: 'https://tyltyl.org',
  // Perfil: todos sus eventos son de cultura y se celebran en su sala.
  categoria_defecto: 'cultura',
  lugar_defecto: 'Teatro TYL TYL',
}

const CODIGO_PRUEBA = 'TYLTYL-2026'

async function sembrar() {
  const [org] = await sql`
    INSERT INTO organizaciones (nombre, slug, descripcion, email_contacto, web,
                               categoria_defecto, lugar_defecto)
    VALUES (${ORG_PRUEBA.nombre}, ${ORG_PRUEBA.slug}, ${ORG_PRUEBA.descripcion},
            ${ORG_PRUEBA.email_contacto}, ${ORG_PRUEBA.web},
            ${ORG_PRUEBA.categoria_defecto}, ${ORG_PRUEBA.lugar_defecto})
    ON CONFLICT (slug) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      categoria_defecto = EXCLUDED.categoria_defecto,
      lugar_defecto = EXCLUDED.lugar_defecto
    RETURNING id, nombre, slug, categoria_defecto, lugar_defecto
  `

  const [codigo] = await sql`
    INSERT INTO codigos_invitacion (codigo, organizacion_id, rol_concedido, usos_maximos)
    VALUES (${CODIGO_PRUEBA}, ${org.id}, 'admin', 5)
    ON CONFLICT (codigo) DO UPDATE SET organizacion_id = EXCLUDED.organizacion_id
    RETURNING codigo, usos_maximos, usos_actuales, activo
  `

  console.log(
    `Organización de prueba: ${org.nombre} (${org.slug}) — ` +
      `categoría "${org.categoria_defecto}", lugar "${org.lugar_defecto}"`
  )
  console.log(
    `Código de invitación: ${codigo.codigo} — ${codigo.usos_actuales}/${codigo.usos_maximos} usos, activo: ${codigo.activo}`
  )
}

await aplicarEsquema()
await sembrar()

const [{ n }] = await sql`SELECT count(*)::int AS n FROM organizaciones`
console.log(`Listo. Organizaciones en la base de datos: ${n}`)
