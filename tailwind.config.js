/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta "vino y oro" inspirada en el escudo de Navalcarnero.
        vino: {
          DEFAULT: '#6E2A3C',
          dark: '#4A1C29',
          light: '#8A3B4A',
        },
        oro: {
          DEFAULT: '#C79A3A',
          dark: '#8F6B1E',
        },
        azul: {
          DEFAULT: '#2E6E8E',
          dark: '#245572',
          tint: '#EAF0F3',
        },
        crema: {
          DEFAULT: '#F7F1E6',
          dark: '#EFE6D6',
        },
        tinta: {
          DEFAULT: '#2B1D22',
          muted: '#948477',
        },
        // Alias de compatibilidad mientras se migra el resto de la app.
        tierra: {
          DEFAULT: '#C1633D',
          dark: '#8A4327',
          light: '#D98861',
        },
        dorado: {
          DEFAULT: '#C79A3A',
          dark: '#8F6B1E',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 20px -12px rgba(74, 28, 41, 0.35)',
        soft: '0 3px 10px -8px rgba(74, 28, 41, 0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
