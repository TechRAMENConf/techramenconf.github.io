/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        black: "#2A2A2A",
        primary: "#00CC66", // 緑LED - 制御盤のメインカラー
        secondary: "#0099CC", // 青LED - セカンダリカラー
        accent: "#CC9900", // 黄色LED - 警告・アクセントカラー
        danger: "#CC3333", // 赤LED - エラー・緊急カラー
        dark: "#FAF8F5", // 暖かいオフホワイト（日焼けした色調）
        light: "#FDFCFA", // より明るい暖かいオフホワイト
        panel: "#FFFEF9", // クリーム色がかった白
        metallic: "#F5F3F0", // 暖かい薄いベージュ
        grid: "#00CC66", // グリッド線の色
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "3rem",
        "6xl": "5rem",
      },
      fontFamily: {
        sans: ["KikaiChokokuJIS", "Shippori Antique", "sans-serif"],
        mono: ["Chivo Mono", "monospace"],
        display: ["Poppins", "sans-serif"],
        kikai: ["KikaiChokokuJIS", "sans-serif"],
      },
      gridTemplateColumns: {
        'auto-fill-100': 'repeat(auto-fill, minmax(100px, 1fr))',
        'auto-fill-200': 'repeat(auto-fill, minmax(200px, 1fr))',
        'auto-fill-300': 'repeat(auto-fill, minmax(300px, 1fr))',
      },
    },
  },
  plugins: [
    require( "@tailwindcss/forms" ),
    require( "@tailwindcss/typography" ),
    require( "tailwind-scrollbar-hide" ),
  ],
};
