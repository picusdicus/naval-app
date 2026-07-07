/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sistema "Civic Hearth" (Material 3) de las referencias de diseño:
        // verde bosque primario, salvia secundario, fondo pergamino cálido.
        primary: {
          DEFAULT: '#0f5238',
          container: '#2d6a4f',
          fixed: '#b1f0ce',
          'fixed-dim': '#95d4b3',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          container: '#a8e7c5',
          fixed: '#002114',
        },
        secondary: {
          DEFAULT: '#006c48',
          container: '#92f7c3',
          fixed: '#92f7c3',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#00734d',
          fixed: '#002113',
        },
        tertiary: {
          DEFAULT: '#464843',
          container: '#5e605a',
        },
        'on-tertiary': {
          DEFAULT: '#ffffff',
          container: '#d9dad3',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        'on-error': {
          DEFAULT: '#ffffff',
          container: '#93000a',
        },
        background: '#fff8f2',
        'on-background': '#1d1b18',
        surface: {
          DEFAULT: '#fff8f2',
          dim: '#dfd9d3',
          variant: '#e8e1db',
        },
        'surface-container': {
          lowest: '#ffffff',
          low: '#f9f2ec',
          DEFAULT: '#f3ede7',
          high: '#ede7e1',
          highest: '#e8e1db',
        },
        'on-surface': {
          DEFAULT: '#1d1b18',
          variant: '#404943',
        },
        outline: {
          DEFAULT: '#707973',
          variant: '#bfc9c1',
        },
        'inverse-surface': '#33302c',
        'inverse-on-surface': '#f6f0ea',
      },
      fontFamily: {
        display: ['Montserrat', 'ui-sans-serif', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 15px rgba(15, 82, 56, 0.05)',
        'card-up': '0 -4px 15px rgba(15, 82, 56, 0.05)',
        'card-lg': '0 10px 30px rgba(15, 82, 56, 0.1)',
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.5rem',
      },
    },
  },
  plugins: [],
}
