# Progress

This document tracks the project's progress, including what works, what's left to build, the current status, and known issues.

## What Works

- Astroフレームワークによる基本的なウェブサイト構造が実装されている。
- 以下の主要コンポーネントが機能している：
  - BaseLayout.astro：ウェブサイトの基本レイアウト（Guridoテーマ対応済み）
  - BaseHead.astro：メタタグとSEO設定（OpenGraph, Twitter Cards対応）
  - Navigation.astro：レスポンシブなナビゲーションメニュー（Alpine.js使用）
  - Footer.astro：フッター情報
  - Abstract.astro：カンファレンスの概要セクション
  - EndingMovie.astro：2024年のエンディングムービー表示
  - 各種ランディングページコンポーネント（Information, Speakers, SponsorshipOffers, ExternalLinks, PersonalSponsors, CorporateSponsors）
- Tailwind CSSによるスタイリングシステムが整備されている：
  - Guridoテーマのカラースキーム（primary, secondary, accent, dark, light）
  - コンポーネントスタイル（ボタン、カード、セクション、コンテナなど）
  - ユーティリティクラス（テキストグラデーション、背景グリッドなど）
- 過去のコンテンツ（/2024）のアーカイブが存在し、アクセス可能。
- JSONファイルを使用したデータ管理システム（corporate_sponsors.jsonなど）。
- Guridoテーマへの移行計画が策定され、フェーズ1（基本構造の移行）とフェーズ2（コンポーネントの更新）が完了している。
- 日本語テキストに機械彫刻JISフォントが適用され、英語フォントと調和した見た目になっている。

## What's Left to Build

### Guridoテーマへの移行
- ✅ フェーズ1（基本構造の移行）完了：
  - ✅ package.jsonの更新（プロジェクト名変更、依存関係追加）
  - ✅ BaseLayout.astroの更新（Ionicons追加、背景グリッド適用）
  - ✅ global.cssの更新（コンポーネントスタイル、ユーティリティクラス追加）
  - ✅ Tailwind CSSの設定更新（カラーテーマ、フォント設定）
  - ✅ SEOとメタデータの強化（OpenGraph, Twitter Cards対応）
- ✅ フェーズ2（コンポーネントの更新）完了：
  - ✅ global.cssの更新：Comic Neueフォントの追加、Guridoテーマのスタイル適用
  - ✅ Navigation.astroの更新：黒背景ナビゲーションスタイル
  - ✅ ランディングページコンポーネントの更新：
    - ✅ Abstract.astro：セクション背景色の変更、手書き風タイトルの追加
    - ✅ Information.astro：セクション背景色の変更、カードベースのデザイン
    - ✅ Speakers.astro：セクション背景色の変更、カードベースのデザイン
    - ✅ SponsorshipOffers.astro：セクション背景色の変更、カードベースのデザイン
    - ✅ ExternalLinks.astro：セクション背景色の変更、ボタンスタイルの更新
    - ✅ PersonalSponsors.astro：セクション背景色の変更、カードベースのデザイン
    - ✅ CorporateSponsors.astro：セクション背景色の変更、カードベースのデザイン
  - ✅ Footer.astroの更新：黒背景、グリッドレイアウト
- ✅ 日本語フォントの更新：
  - ✅ 機械彫刻JISフォント（KikaiChokokuJIS-Md）の追加
  - ✅ global.cssへのフォント読み込み設定追加
  - ✅ tailwind.config.cjsへのフォントファミリー設定追加
  - ✅ 日本語テキスト部分へのフォント適用（Abstract, Information, Navigation, Footerなど）

### コンテンツ更新
- 2025年のカンファレンスに関する詳細コンテンツ：
  - 最新のお知らせ情報
  - 2025年の基調講演者情報
  - 2025年のスポンサー情報
  - イベントのタイムテーブル
  - 参加登録システム（必要に応じて）
- 既存コンポーネントの2025年向け更新：
  - Abstract.astroの日付と場所の更新
  - 各セクションコンポーネントの内容更新
- 新規コンポーネントの作成（必要に応じて）：
  - タイムテーブル表示用コンポーネント
  - 参加登録フォームコンポーネント

### 最適化と改善
- 過去コンテンツ（/2024）への適切なナビゲーションまたは表示方法の実装：
  - アーカイブセクションの作成
  - 年度別コンテンツへのナビゲーション改善
- SEO最適化の強化：
  - 各ページのメタデータ最適化
  - OGP（Open Graph Protocol）タグの充実
- パフォーマンスとアクセシビリティの改善
- フォントの最適化（特に日本語フォントのパフォーマンス）

## Current Status

- ウェブサイトの基本的な構造は存在するが、2025年のコンテンツはまだ計画段階でシンプル。
- 現在のトップページには、2025年の基本情報（日付：2025年7月26日、場所：旭川、北海道）が表示されている。
- 2024年のコンテンツはアーカイブとして保存されているが、アクセス方法は最適化されていない。
- 今年の予定（スピーカー、タイムテーブルなど）はこれから決定される。
- メモリバンクが整備され、プロジェクトの詳細な情報が文書化されている。
- Guridoテーマへの移行計画の実装状況：
  - ✅ フェーズ1（基本構造の移行）が完了
  - ✅ フェーズ2（コンポーネントの更新）が完了
  - ✅ 日本語フォントの更新が完了
  - フェーズ3（コンテンツの更新と最適化）が次のステップ

## Known Issues

- モバイル表示時のナビゲーションメニューの動作が最適化されていない可能性がある。
- 一部のコンポーネント間の依存関係が明示的に定義されていない。
- 画像の最適化（サイズ、フォーマット）が必要かもしれない。
- アクセシビリティ対応が不十分な箇所がある可能性がある。
- 多言語対応が実装されていない。
- Guridoテーマへの移行に伴い、以下の技術的な課題が考えられる：
  - Astroバージョンの互換性の問題
  - Tailwind CSS v4への移行に伴う互換性の問題
  - 既存のコンポーネントとGuridoテーマのコンポーネントの統合
- 日本語フォントのファイルサイズが大きい場合、ページの読み込み速度に影響する可能性がある。
