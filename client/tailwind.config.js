/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1A2A44',
        'secondary': '#2A3B5A',
        'accent': '#F5A623',
        'text': '#E5E7EB',
      },
    },
  },
  plugins: [],
}