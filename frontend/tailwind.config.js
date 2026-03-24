/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef3fb',
          100: '#d4e0f5',
          200: '#a9c1eb',
          300: '#7da2e0',
          400: '#4a78c9',
          500: '#1C2D5A',
          600: '#182750',
          700: '#141f42',
          800: '#0f1833',
          900: '#0a1025',
          DEFAULT: '#1C2D5A',
        },
        accent: {
          50: '#fef7e8',
          100: '#fdebc4',
          200: '#fbd78a',
          300: '#f8c350',
          400: '#E8A830',
          500: '#D4941A',
          600: '#b37a12',
          700: '#8c600e',
          800: '#66460a',
          900: '#3f2c06',
          DEFAULT: '#E8A830',
        },
        secondary: '#2A2A2A',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
