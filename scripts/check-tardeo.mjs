#!/usr/bin/env node
import { obtenerActividadesDeportivas } from '../api/_actividades-deportes-feed.js'

const r = await obtenerActividadesDeportivas()
const tardeo = r.actividades.find(a => a.titulo.toLowerCase().includes('tardeo'))

if (tardeo) {
  console.log('TARDEO ENCONTRADO:')
  console.log(JSON.stringify({
    titulo: tardeo.titulo,
    fecha_evento: tardeo.fecha_evento,
    fecha_limite: tardeo.fecha_limite,
    origen_externo_id: tardeo.origen_externo_id,
    reconstruido: tardeo.reconstruido_desde_plazo || false,
  }, null, 2))
} else {
  console.log('NO TARDEO ENCONTRADO')
  console.log('Primeras 5:')
  r.actividades.slice(0, 5).forEach((a, i) => {
    console.log(`${i+1}. ${a.titulo} (${a.fecha_evento || a.fecha_limite})`)
  })
}
