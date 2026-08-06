// Test directo del módulo de email
import { enviarEmailReclamacion } from './api/_email.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY

console.log('🧪 Test directo del módulo de email\n')
console.log(`RESEND_API_KEY configurada: ${RESEND_API_KEY ? '✓' : '✗'}`)
console.log('')

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY no está configurada en las variables de entorno')
  process.exit(1)
}

async function test() {
  console.log('📧 Enviando email de prueba...\n')

  const resultado = await enviarEmailReclamacion({
    comercioId: 'gpl_test_' + Date.now(),
    nombre: 'Usuario Test',
    email: 'test@example.com',
    telefono: '612345678',
    mensaje: 'Este es un mensaje de prueba enviado directamente desde el test.',
  })

  console.log('\n📊 Resultado:')
  console.log(JSON.stringify(resultado, null, 2))

  if (resultado.ok && !resultado.skipped) {
    console.log('\n✅ Email enviado exitosamente')
    console.log(`   ID: ${resultado.id}`)
    console.log('\n📍 Verifica en https://resend.com/emails o en tu bandeja de danielmolino.it@gmail.com')
  } else if (resultado.skipped) {
    console.log('\n⚠️  Email skipped (RESEND_API_KEY no configurada)')
  } else {
    console.log('\n❌ Error al enviar email')
    console.log(`   Error: ${resultado.error}`)
  }
}

test().catch(console.error)
