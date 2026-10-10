/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Single calm green accent
        brand: {
          50: '#eefaf3', 100: '#d5f3e1', 200: '#ade6c6', 300: '#78d2a3', 400: '#43b77d',
          500: '#22a063', 600: '#1a9157', 700: '#147447', 800: '#125c3a', 900: '#0f4b31',
        },
        // Neutral (non-blue) greys so every surface reads as soft concrete grey
        slate: {
          50: '#f3f3f3', 100: '#ebebeb', 200: '#e0e0e0', 300: '#cdcdcd', 400: '#a6a6a6',
          500: '#7c7c7c', 600: '#5e5e5e', 700: '#404040', 800: '#262626', 900: '#171717', 950: '#0d0d0d',
        },
        canvas: '#d9d9d9',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
      borderRadius: { '2xl': '1.1rem', '3xl': '1.5rem' },
      boxShadow: {
        glass: 'inset 0 1px 0 rgba(255,255,255,.75), 0 18px 40px -24px rgba(0,0,0,.25)',
      },
    },
  },
  plugins: [],
}
