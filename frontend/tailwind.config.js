/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Все значения — через CSS-переменные из src/styles/tokens.css.
        // Никаких хардкод-хексов в компонентах фич.
        bg: {
          base: 'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
        },
        surface: {
          card: 'var(--surface-card)',
          hover: 'var(--surface-hover)',
        },
        border: {
          DEFAULT: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        accent: {
          lime: 'var(--accent-lime)',
          green: 'var(--accent-green)',
          blue: 'var(--accent-blue)',
          amber: 'var(--accent-amber)',
          red: 'var(--accent-red)',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px var(--accent-green), 0 0 24px -4px var(--accent-green)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
