/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./artifacts/hostack/src/**/*.{tsx,ts,jsx,js}",
    "./lib/**/src/**/*.{tsx,ts,jsx,js}",
    "./content/**/*.json",
    "./dist/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        hostack: {
          dark: '#0a0a0b',      // Deep charcoal
          brand: '#3b82f6',     // Electric blue
          accent: '#10b981',    // Emerald green (transparency)
          glass: 'rgba(255, 255, 255, 0.05)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
