/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1f3a5f',
          800: '#1f3a5f',
          900: '#16293f',
        },
        cream: '#faf6ef',
        forest: {
          DEFAULT: '#2f6b3c',
          light: '#7cb87a',
        },
      },
    },
  },
  plugins: [],
}
