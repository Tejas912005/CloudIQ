/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          blue: '#00f3ff',
          purple: '#bc13fe',
        },
        dark: {
          900: '#0a0a0f',
          800: '#13131a',
          700: '#1c1c24',
          600: '#272732',
        }
      },
      boxShadow: {
        'neon-blue': '0 0 10px rgba(0, 243, 255, 0.4), 0 0 20px rgba(0, 243, 255, 0.2)',
        'neon-purple': '0 0 10px rgba(188, 19, 254, 0.4), 0 0 20px rgba(188, 19, 254, 0.2)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
