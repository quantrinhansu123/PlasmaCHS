/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        roboto: ['Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
      },
      colors: {
        primary: '#3b82f6', // Blue 500
        secondary: '#2563eb', // Blue 600
        'lumi-blue': '#007BFF',
        'lumi-orange': '#FF6600',
        'lumi-green': '#28A745',
        'lumi-light-orange': '#FFDAB9',
        'lumi-dark-blue': '#0056B3',
        'lumi-gray': '#6c757d',
        'lumi-dark': '#343A40',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
