/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#101827',
        surface: '#0b1220',
        accent: '#15aabf'
      }
    }
  },
  plugins: []
};
