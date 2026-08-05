// Funciones auxiliares para gestionar datos de comercios con fallback JSON → perfil.
// El perfil enriquecido tiene prioridad sobre los datos estáticos del JSON.

/**
 * Obtiene un valor de un comercio, con fallback en cascada:
 * perfil[campo] → jsonComercio[campo] → null
 */
export function datoComercio(perfil, jsonComercio, campo) {
  if (perfil && perfil[campo] !== undefined && perfil[campo] !== null) {
    return perfil[campo]
  }
  return jsonComercio?.[campo] ?? null
}

/**
 * Fusiona perfil y datos JSON en un objeto único, priorizando perfil.
 * Útil para obtener todos los datos de un comercio de una vez.
 */
export function datosComercios(perfil, jsonComercio) {
  return {
    id: jsonComercio?.id,
    nombre: datoComercio(perfil, jsonComercio, 'nombre'),
    categoria: datoComercio(perfil, jsonComercio, 'categoria'),
    tipo: datoComercio(perfil, jsonComercio, 'tipo'),
    foto: datoComercio(perfil, jsonComercio, 'foto'),
    fotoPrincipal: datoComercio(perfil, jsonComercio, 'fotoPrincipal') ||
                   datoComercio(perfil, jsonComercio, 'foto_principal'),
    descripcion: datoComercio(perfil, jsonComercio, 'descripcion'),
    web: datoComercio(perfil, jsonComercio, 'web'),
    telefono: datoComercio(perfil, jsonComercio, 'telefono'),
    email: datoComercio(perfil, jsonComercio, 'email'),
    direccion: datoComercio(perfil, jsonComercio, 'direccion'),
    lat: datoComercio(perfil, jsonComercio, 'lat'),
    lng: datoComercio(perfil, jsonComercio, 'lng'),
    horarios: datoComercio(perfil, jsonComercio, 'horarios'),
    fotos: datoComercio(perfil, jsonComercio, 'fotos'),
  }
}

/**
 * Busca un comercio en los JSONs por id.
 * Retorna { json: comercioEncontrado } o { json: null } si no existe.
 */
export function buscarComercioEnJson(comercioId, comercios, servicios) {
  const enComercios = comercios.find((c) => c.id === comercioId)
  if (enComercios) return enComercios

  const enServicios = servicios.find((c) => c.id === comercioId)
  if (enServicios) return enServicios

  return null
}
