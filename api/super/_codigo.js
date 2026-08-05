// Generador de códigos de invitación únicos (formato: ABC-1234).
export function generarCodigoInvitacion() {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numeros = '0123456789'

  let codigo = ''
  for (let i = 0; i < 3; i++) {
    codigo += letras.charAt(Math.floor(Math.random() * letras.length))
  }
  codigo += '-'
  for (let i = 0; i < 4; i++) {
    codigo += numeros.charAt(Math.floor(Math.random() * numeros.length))
  }

  return codigo
}
