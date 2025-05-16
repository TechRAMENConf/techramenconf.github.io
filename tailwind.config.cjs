/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        black: "#0f1014",
        primary: "#FF6B35", // オレンジ - Gurido風のプライマリカラー
        secondary: "#2EC4B6", // ティール - Gurido風のセカンダリカラー
        accent: "#FFBC42", // イエロー - アクセントカラー
        dark: "#1B1B1E", // ダークグレー - 背景色
        light: "#F9F9F9", // ライトグレー - 明るい背景色
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
