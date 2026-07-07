/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        vino: {
          DEFAULT: '#7A2E3E',
          dark: '#4E1C27',
          light: '#9A4456',
        },
        tierra: {
          DEFAULT: '#C1633D',
          dark: '#8A4327',
          light: '#D98861',
        },
        crema: {
          DEFAULT: '#FBF3E7',
          dark: '#F3E6D3',
        },
        dorado: {
          DEFAULT: '#D9A441',
          dark: '#B5822B',
        },
        tinta: {
          DEFAULT: '#3B2A22',
          muted: '#8A7768',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
