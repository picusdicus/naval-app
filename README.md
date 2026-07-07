# Navalcarnero Vecinal

Aplicación web para los vecinos de Navalcarnero (Madrid): eventos, directorio de
comercios y servicios sobre mapa, noticias, transporte y un asistente de IA para
trámites e información local.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [Tailwind CSS v3](https://tailwindcss.com/)
- [React Router](https://reactrouter.com/)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap para el mapa del directorio

## Desarrollo

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción
npm run preview    # previsualizar el build
```

## Datos

- **Comercios** (`src/data/comercios.json`): se generan desde OpenStreetMap con
  `npm run fetch:comercios` (consulta la API de Overpass para el término municipal
  de Navalcarnero). No editar a mano: se sobrescribe al regenerar.
- **Servicios profesionales** (`src/data/servicios-locales.json`): directorio
  curado a mano (fontanería, reformas, etc.), no cubierto por OpenStreetMap.
- **Eventos** (`src/data/eventos.json`): agenda curada a mano (municipal + vecinal).

## Estructura

```
src/
  components/      # layout, directorio, eventos, iconos
  data/            # JSON de comercios, servicios y eventos
  lib/             # categorías, cocinas, utilidades de eventos
  pages/           # Inicio, Eventos, Mapa, Noticias, Transporte, Asistente
scripts/
  fetch-comercios.mjs   # descarga de comercios desde OpenStreetMap
```

## Identidad visual

Paleta cálida inspirada en Navalcarnero: vino/burdeos, tierra/terracota, crema y
acentos dorados. Tipografía Playfair Display (titulares) + Inter (cuerpo).
Interfaz en español, diseñada mobile-first.
