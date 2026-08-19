#!/usr/bin/env node
/**
 * Invoca el webhook /api/sync-instagram-noticias con el post real DcIj1xrj0tG
 * y verifica después cuántas filas recuperan fecha_evento
 */
import fs from 'fs'
import { obtenerSql } from '../api/_db.js'

const postDataset = JSON.parse(
  fs.readFileSync('./scripts/post-DcIj1xrj0tG-dataset.json', 'utf-8')
)[0]

async function invokeWebhookAndVerify() {
  const sql = obtenerSql()

  console.log('=== INVOCAR WEBHOOK Y VERIFICAR RESULTADO ===\n')

  try {
    // Invocar el webhook con el post real
    console.log('1. Invocando webhook /api/sync-instagram-noticias...\n')

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/sync-instagram-noticias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NOTICIAS_SYNC_SECRET || 'dev-secret'}`,
      },
      body: JSON.stringify(postDataset),
    })

    if (!response.ok) {
      console.error(`❌ Webhook error: ${response.status}`)
      console.error(await response.text())
      process.exit(1)
    }

    const result = await response.json()
    console.log('✓ Webhook invocado exitosamente')
    console.log(`Respuesta: ${JSON.stringify(result, null, 2)}`)
    console.log()

    // Esperar 2 segundos para que la BD procese
    await new Promise(r => setTimeout(r, 2000))

    // Verificar las filas actualizadas
    console.log('2. Verificando filas en producción...\n')

    const rows = await sql`
      SELECT
        origen_externo_id,
        titulo,
        fecha_evento,
        fecha_limite
      FROM actividades
      WHERE origen_externo_id LIKE 'ig-DcIj1xrj0tG-%'
      ORDER BY publicado_en DESC
    `

    console.log(`Encontradas ${rows.length} filas\n`)

    let conFechaEvento = 0
    rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.titulo}`)
      console.log(`   fecha_evento: ${row.fecha_evento || 'NULL'}`)
      console.log(`   fecha_limite: ${row.fecha_limite || 'NULL'}`)
      console.log()

      if (row.fecha_evento) conFechaEvento++
    })

    console.log(`=== RESULTADO FINAL ===`)
    console.log(`Total filas: ${rows.length}`)
    console.log(`Con fecha_evento: ${conFechaEvento}/${rows.length}`)
    console.log(`Sin fecha_evento: ${rows.length - conFechaEvento}`)

    if (conFechaEvento > 0) {
      console.log(`\n✓ ÉXITO: ${conFechaEvento} filas actualizadas con fecha_evento`)
    } else {
      console.log(`\n⚠️  FALLO: Ninguna fila se actualizó con fecha_evento`)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

invokeWebhookAndVerify()
