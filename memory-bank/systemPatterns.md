# System Patterns

This document describes the system architecture, key technical decisions, design patterns in use, and component relationships.

## System Architecture

- Astroをベースとした静的サイトジェネレーター構成。
- ページはレイアウトコンポーネント（BaseLayout）と複数のセクションコンポーネントで構成される。
- コンポーネントは主に以下のカテゴリに分類される：
  - グローバルコンポーネント（`src/components/global/`）：Navigation, Footer など、サイト全体で使用されるコンポーネント
  - ランディングページコンポーネント（`src/components/landing/`）：Abstract, Information, Speakers, SponsorshipOffers など、トップページの各セクションを構成するコンポーネント
  - 共通コンポーネント（`src/components/`）：BaseHead など、共通で使用されるコンポーネント
- コンテンツの一部はJSONファイル（`src/components/data/corporate_sponsors.json`）で管理される。
- ページは `src/pages/` ディレクトリに配置され、Astroのファイルベースルーティングに従って生成される。

## Key Technical Decisions

- ウェブサイト全体のレイアウトに `BaseLayout.astro` を使用し、共通のHTML構造を定義。
- 各ページのヘッド要素に `BaseHead.astro` を使用し、メタタグやSEO設定を一元管理。
- SEO最適化のために `astro-seo` パッケージを使用。
- インタラクティブな要素（ナビゲーションメニューなど）に Alpine.js を使用。
- スタイリングに Tailwind CSS を使用し、カスタムフォント（Shippori Antique, Chivo Mono）を適用。
- ランディングページは複数の独立したAstroコンポーネントで構成し、`src/pages/index.astro` でそれらを組み合わせて表示。
- スポンサー情報はJSONファイル (`src/components/data/corporate_sponsors.json`) で管理し、対応するコンポーネントで読み込んで表示。
- 過去のカンファレンス情報は `/public/2024/` ディレクトリに静的ファイルとして保存。

## Design Patterns

- コンポーネントベースのアーキテクチャ：UI要素を再利用可能なコンポーネントに分割。
- レイアウトコンポーネントによる共通構造の定義：BaseLayout を使用して共通のページ構造を提供。
- データと表示の分離：JSONファイルでデータを管理し、Astroコンポーネントで表示。
- アイランドアーキテクチャ：Astroの特徴を活かし、必要な部分だけをインタラクティブにする（Alpine.jsを使用）。
- レスポンシブデザイン：Tailwind CSSのユーティリティクラスを使用して、様々な画面サイズに対応。

## Component Relationships

- `src/pages/index.astro` -> `src/layouts/BaseLayout.astro`：トップページのレイアウト構造
- `src/layouts/BaseLayout.astro` -> `src/components/BaseHead.astro`：共通のヘッド要素
- `src/pages/index.astro` -> `src/components/landing/*.astro`：トップページの各セクション
  - Abstract：カンファレンスの概要
  - ExternalLinks：外部リンク
  - Information：カンファレンス情報
  - Speakers：登壇者情報
  - SponsorshipOffers：スポンサーシップの案内
  - PersonalSponsors：個人スポンサー情報
  - CorporateSponsors：企業スポンサー情報
- `src/components/landing/Abstract.astro` -> `src/components/landing/EndingMovie.astro`：2024年のエンディングムービー表示
- `src/components/landing/CorporateSponsors.astro` -> `src/components/data/corporate_sponsors.json`：企業スポンサーデータの読み込み
- `src/components/global/Navigation.astro`：Alpine.jsを使用したレスポンシブナビゲーション
