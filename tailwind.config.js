/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dbe4ff',
          500: '#4361ee',
          600: '#3a52d4',
          700: '#2f43ba',
          900: '#1a2a7a',
        },
        tv: {
          red:    '#e63946',
          amber:  '#f4a261',
          green:  '#2a9d8f',
        }
      }
    }
  },
  plugins: [],
}
