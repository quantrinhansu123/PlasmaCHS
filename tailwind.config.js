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
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
      },
      colors: {
        primary: '#2d7c2d',
        secondary: '#4CAF50',
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
