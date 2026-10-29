/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          // ── Light mode palette ──────────────────────────────────────────
          bg:              '#f0f4f8',   // page background — light blue-grey
          surface:         '#ffffff',   // input/panel background — white
          card:            '#f8fafc',   // card background — near-white
          border:          '#cbd5e1',   // border — slate-300
          'border-light':  '#94a3b8',   // stronger border — slate-400
          // ── Accent colours (unchanged) ─────────────────────────────────
          green:           '#059669',   // emerald-600
          'green-dim':     '#047857',   // emerald-700
          teal:            '#0d9488',   // teal-600
          'teal-dim':      '#0f766e',   // teal-700
          amber:           '#d97706',   // amber-600
          'amber-dim':     '#b45309',   // amber-700
          red:             '#dc2626',   // red-600
          'red-dim':       '#b91c1c',   // red-700
          blue:            '#2563eb',   // blue-600
          // ── Typography ─────────────────────────────────────────────────
          'text-primary':  '#0f172a',   // slate-900  — main text
          'text-secondary':'#334155',   // slate-700  — secondary text
          'text-muted':    '#64748b',   // slate-500  — muted/placeholder
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 16px rgba(5, 150, 105, 0.20)',
        'glow-red':   '0 0 16px rgba(220, 38,  38, 0.20)',
        'glow-amber': '0 0 16px rgba(217, 119,  6, 0.20)',
        'glow-teal':  '0 0 16px rgba(13,  148, 136, 0.20)',
      },
    },
  },
  plugins: [],
};
