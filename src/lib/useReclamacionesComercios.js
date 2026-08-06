import { useEffect, useState } from 'react'

export function useReclamacionesComercios() {
  const [reclamaciones, setReclamaciones] = useState({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargarReclamaciones = async () => {
      try {
        const respuesta = await fetch('/api/reclamaciones-comercios')
        if (respuesta.ok) {
          const datos = await respuesta.json()
          setReclamaciones(datos)
        }
      } catch (err) {
        console.warn('No se pudieron cargar las reclamaciones:', err)
      } finally {
        setCargando(false)
      }
    }

    cargarReclamaciones()
  }, [])

  return {
    reclamaciones,
    cargando,
    // Helpers
    tieneReclamacion: (comercioId) => !!reclamaciones[comercioId],
    esReclamacionPendiente: (comercioId) => reclamaciones[comercioId]?.estado === 'pendiente',
    esReclamacionAprobada: (comercioId) => reclamaciones[comercioId]?.estado === 'aprobada',
  }
}
