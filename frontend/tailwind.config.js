export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lg-bg': '#0b0f12',
        'lg-surface': '#0f1720',
        'lg-card': '#0c1114',
        'lg-text': '#e6eef6',
        'lg-muted': '#98a2b3',
        'lg-accent': '#38bdf8',
        'lg-accent-muted': '#2b9fdc',
        'lg-success': '#34d399',
        'lg-warning': '#f59e0b',
        'lg-danger': '#ef4444',
        'lg-glass': 'rgba(255,255,255,0.03)'
      },
      boxShadow: {
        'lg-glow': '0 6px 24px rgba(56,189,248,0.07), inset 0 1px 0 rgba(255,255,255,0.02)'
      },
      borderRadius: {
        'lg-card': '13px'
      }
    },
  },
  plugins: [],
}