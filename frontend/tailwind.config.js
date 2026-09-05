/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B1220',
          soft: '#131C2E',
          line: '#22304A',
        },
        surface: {
          DEFAULT: '#F6F7F9',
          card: '#FFFFFF',
          sunken: '#EEF0F3',
        },
        line: '#E3E6EB',
        text: {
          primary: '#101828',
          secondary: '#5B6472',
          muted: '#8A93A1',
          inverted: '#EDF1F7',
        },
        accent: {
          DEFAULT: '#0EA5A0',
          dark: '#0B7F7B',
          soft: '#E3F6F4',
        },
        success: { DEFAULT: '#16A34A', soft: '#E7F6EC' },
        warning: { DEFAULT: '#D97706', soft: '#FBF0DE' },
        danger: { DEFAULT: '#DC2626', soft: '#FBE7E7' },
        info: { DEFAULT: '#2563EB', soft: '#E7EEFD' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        popover: '0 4px 12px rgba(16, 24, 40, 0.12)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.8)', opacity: '0' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
