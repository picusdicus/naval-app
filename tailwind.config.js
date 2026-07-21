/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Sistema "La Gaceta" (ver reference/gaceta/DESIGN.md) ──
        // Ojo con los nombres: NO usar `vino` ni `crema` — hubo clases muertas
        // (text-vino, bg-crema-dark) de una paleta anterior; definir esos
        // nombres podría reactivar estilos fantasma si algún resto sobrevive.
        papel: {
          DEFAULT: '#f4efe1', // papel base (fondos de página)
          lienzo: '#e9e4d8', // fondo fuera del marco / canvas
          calido: '#efe6d3', // bandas alternas, cabeceras de tabla
          claro: '#fbf7ec', // tarjetas de aviso
        },
        tinta: {
          DEFAULT: '#211d15', // texto principal, bordes "impresos"
          intensa: '#1c1913', // franjas superiores, marcos
          suave: '#3f3928', // texto secundario
          apagada: '#5c5641', // texto secundario alterno
        },
        pardo: '#6f664f', // texto terciario / mutado
        mudo: '#9a9075', // labels mono apagados, placeholders
        filete: {
          DEFAULT: '#d9d0ba', // separadores claros
          claro: '#c9bfa6', // filetes discontinuos
          punteado: '#b8ad93', // bordes dashed (dropzones)
        },
        terracota: {
          DEFAULT: '#b0472f', // acento primario (enlaces, activo, énfasis)
          vivo: '#c94f34', // arranque de degradados de cartel
          oscuro: '#7a2d1e', // final de degradados de cartel
          palido: '#e2c4bb', // bordes de acciones destructivas
          fondo: '#f2d9d2', // fondo de badges de error/caducado
        },
        ocre: {
          DEFAULT: '#c68a2e', // barras de gráfico, ratings
          profundo: '#7c4f16',
        },
        oro: '#f0c14b', // badges "estreno" / destacado
        naranja: '#f0a63c', // acento del logo sobre fondo oscuro
        verde: {
          DEFAULT: '#2f6b4f', // estados OK, badge "publicado"
          salvia: '#4a5b41', // avatares/comercios
          bosque: '#2b3a34', // tarjeta del tiempo
          'bosque-borde': '#3f5148',
          'salvia-claro': '#9db0a4', // labels sobre verde bosque
        },
      },
      fontFamily: {
        // ── La Gaceta ──
        'serif-dm': ['"DM Serif Display"', 'Georgia', 'serif'], // titulares, nombres, cifras grandes
        'serif-spectral': ['Spectral', 'Georgia', 'serif'], // cuerpo de texto
        'mono-ibm': ['"IBM Plex Mono"', 'ui-monospace', 'monospace'], // etiquetas, metadatos, badges
        logo: ['"Archivo Black"', 'ui-sans-serif', 'sans-serif'], // SOLO el logotipo apilado
      },
      fontSize: {
        // Escala editorial de La Gaceta (px de referencia del README de diseño)
        'hero-movil': ['3.25rem', { lineHeight: '0.86' }], // 52px — cartel hero móvil
        'hero-desktop': ['5.5rem', { lineHeight: '0.85' }], // 88px — hero desktop
        seccion: ['2.125rem', { lineHeight: '1.05' }], // 34px — título de sección
        'seccion-sm': ['1.625rem', { lineHeight: '1.1' }], // 26px — título de sección compacto
      },
      letterSpacing: {
        etiqueta: '0.14em', // labels mono uppercase estándar
        rotulo: '0.2em', // eyebrows y rótulos amplios
      },
      boxShadow: {
        // ── La Gaceta (solo desktop; en móvil la estética es "impresa", sin sombra) ──
        cartel: '0 20px 40px -24px rgba(28,25,19,.5)', // tarjetas de póster desktop
        'tarjeta-gaceta': '0 20px 40px -30px rgba(28,25,19,.5)', // tarjetas de comercio desktop
      },
      borderRadius: {
        // lg (16px) y xl (24px) sirven a ambos sistemas: son los radios de las
        // tarjetas desktop de La Gaceta. En móvil los carteles van SIN radio.
        lg: '1rem',
        xl: '1.5rem',
      },
    },
  },
  plugins: [],
}
