/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        black: "#2A2A2A",
        primary: "#00CC66", // 緑LED - 制御盤のメインカラー（少し暗く）
        secondary: "#0099CC", // 青LED - セカンダリカラー（少し暗く）
        accent: "#CC9900", // 黄色LED - 警告・アクセントカラー（少し暗く）
        danger: "#CC3333", // 赤LED - エラー・緊急カラー（少し暗く）
        dark: "#3A3A3A", // 制御盤の背景色（グレー）
        light: "#555555", // パネルの背景色（ライトグレー）
        panel: "#404040", // コントロールパネル色（ミディアムグレー）
        metallic: "#666666", // メタリック調（明るいグレー）
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
