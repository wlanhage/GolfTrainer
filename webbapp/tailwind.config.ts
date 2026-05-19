import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        surface: '#ffffff',
        'surface-soft': '#f8faf9',
        ink: '#0f172a',
        muted: '#64748b',
        border: '#e2e8f0',
        primary: {
          DEFAULT: '#0f766e',
          dark: '#115e59',
          soft: '#ecfdf5',
          softer: '#f0fdf4'
        },
        'primary-foreground': '#ffffff',
        danger: '#dc2626'
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
