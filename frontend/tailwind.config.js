/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Open Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        cz: {
          ink: '#0f172a',
          muted: '#475569',
          line: '#e2e8f0',
          accent: '#2563eb',
          brand: '#23a1d1',
          'brand-dark': '#1f90bb',
          red: '#EE412F',
          'red-bright': '#EE412F',
          dark: {
            bg: '#0c0c0c',
            surface: '#1a1a1a',
            elevated: '#242424',
            line: '#333333',
            muted: '#a3a3a3',
            ink: '#f5f5f5',
          },
          admin: {
            bg: '#e5e5e5',
            surface: '#ffffff',
            elevated: '#f5f5f5',
            line: '#d1d5db',
            muted: '#6b7280',
            ink: '#374151',
          },
        },
      },
    },
  },
  plugins: [],
};
