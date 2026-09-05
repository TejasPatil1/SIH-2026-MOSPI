/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm institutional neutrals. DEVIATION from §10.1 slate-50/200:
        // a warm ground reads less "default Tailwind template" under projection.
        ground: '#F7F6F3',
        surface: '#FFFFFF',
        raised: '#FCFBF9',
        line: { DEFAULT: '#E4E2DC', strong: '#D3D0C8', faint: '#EDEBE6' },
        ink: { DEFAULT: '#15181D', 2: '#495260', 3: '#7C8492', 4: '#A5ABB5' },
        accent: {
          DEFAULT: '#1B3F73',
          hover: '#16345F',
          soft: '#EEF2F8',
          line: '#C8D5E8',
          text: '#1B3F73',
        },
        risk: {
          low: '#16A34A',
          watch: '#CA8A04',
          high: '#EA580C',
          critical: '#DC2626',
        },
        riskbg: {
          low: '#EDF7F0',
          watch: '#FBF5E6',
          high: '#FDF1EA',
          critical: '#FCEEEE',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['10.5px', { lineHeight: '14px', letterSpacing: '0.06em' }],
        xs: ['11.5px', { lineHeight: '16px' }],
        sm: ['12.5px', { lineHeight: '18px' }],
        base: ['13.5px', { lineHeight: '20px' }],
        md: ['15px', { lineHeight: '22px' }],
        lg: ['17px', { lineHeight: '24px' }],
        xl: ['21px', { lineHeight: '28px' }],
        '2xl': ['27px', { lineHeight: '32px' }],
        '3xl': ['34px', { lineHeight: '38px' }],
        '4xl': ['44px', { lineHeight: '46px' }],
        '5xl': ['58px', { lineHeight: '58px' }],
      },
      borderRadius: { DEFAULT: '5px', md: '6px', lg: '8px' },
      boxShadow: {
        panel: '0 1px 2px rgba(21,24,29,0.05), 0 0 0 1px rgba(21,24,29,0.04)',
        pop: '0 8px 24px -6px rgba(21,24,29,0.18), 0 0 0 1px rgba(21,24,29,0.06)',
      },
      transitionDuration: { 250: '250ms' },
    },
  },
  plugins: [],
};
