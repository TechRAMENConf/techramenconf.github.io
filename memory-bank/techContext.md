# Tech Context

This document details the technologies used in the project, the development setup, technical constraints, and dependencies.

## Technologies Used

- Astro (フレームワーク)：静的サイト生成とコンポーネントベースの開発
- HTML, CSS, JavaScript：ウェブの基本技術
- Markdown：コンテンツ管理（特にページコンテンツ）
- JSON：データ管理（スポンサー情報など）
- Tailwind CSS：ユーティリティファーストのCSSフレームワーク
- Alpine.js：軽量なJavaScriptフレームワーク（インタラクティブ要素用）
- Google Fonts：「Shippori Antique」と「Chivo Mono」フォント

## Development Setup

- Node.js 環境が必要。
- パッケージ管理には npm を使用。
- 開発サーバーの起動 (`npm run dev`) でローカル確認が可能。
- ビルドは `npm run build` で実行され、`/public` ディレクトリに出力される。
- デプロイは GitHub Pages を使用（リポジトリ名 techramenconf.github.io から推測）。

## Technical Constraints

- 静的サイトとしてデプロイされることを前提とする。
- クライアントサイドJavaScriptの使用はAstroのアイランドアーキテクチャに沿う必要がある。
- レスポンシブデザインを実現するためにTailwind CSSのブレークポイントを活用する。
- SEO対策として適切なメタタグとcanonical URLを設定する。

## Dependencies

- Astro：静的サイト生成フレームワーク
- astro-seo：SEO最適化用のAstroコンポーネント
- Tailwind CSS：ユーティリティファーストのCSSフレームワーク
- Tailwind CSSプラグイン：
  - @tailwindcss/forms：フォーム要素のスタイリング
  - @tailwindcss/typography：タイポグラフィのスタイリング
  - tailwind-scrollbar-hide：スクロールバーを非表示にするユーティリティ
- Alpine.js：軽量なJavaScriptフレームワーク
- Google Fonts：
  - Shippori Antique：メインフォント
  - Chivo Mono：モノスペースフォント（コード表示など）
- Inter：補助フォント（BaseHead.astroで読み込み）
