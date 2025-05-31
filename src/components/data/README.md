# Personal Sponsors Data

このディレクトリの `personal_sponsors.json` ファイルは現在使用されていません。

PersonalSponsorsコンポーネントは `/public/techramen-24-conf-all-20240727-212901.csv` から CSVデータを直接読み込むように変更されました。

## 実装詳細

- **CSVデータ処理**: `src/utils/csvData.ts`
- **コンポーネント**: `src/components/landing/PersonalSponsors.astro`
- **データソース**: `public/techramen-24-conf-all-20240727-212901.csv`

## フィルタリング条件

CSVデータから以下の条件でフィルタリングしています：

1. `Ticket type` が "ラーメンを応援します"
2. `応援団の Web サイト表示について` が "表示してもよい(fortee の設定についても理解した)"

## データ構造

表示されるスポンサー情報：
- `userName`: ユーザー名
- `displayName`: 表示名（`Name`フィールドまたは`userName`のフォールバック）
- `twitterUrl`: TwitterのURL（自動生成）
- `avatarUrl`: アバター画像のURL
- `comment`: コメント（`その他コメント欄`）
