#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const r = await obtenerActividadesDeportivas()

const huerfanas = r.actividades.filter(a => a.reconstruido_desde_plazo)

console.log('=== TODOS LOS "FIN DE PLAZO" (RECONSTRUIDOS) ===\n')

huerfanas.forEach((a, i) => {
  console.log(`${i+1}. ${a.titulo}`)
})
