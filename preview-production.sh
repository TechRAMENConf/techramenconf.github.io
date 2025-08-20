#!/bin/bash

# 本番環境と同じ構造でプレビューするスクリプト

echo "🏗️  本番環境のビルドを作成中..."

# クリーンビルド
rm -rf dist 2025/dist

# ルートをビルド
echo "📦 ルートサイトをビルド中..."
npm run build

# 2025サイトをビルド
echo "📦 2025サイトをビルド中..."
cd 2025
npm run build
cd ..

# ビルド結果をマージ
echo "🔀 ビルド結果をマージ中..."
mkdir -p dist/2025
cp -r 2025/dist/* dist/2025/

# 静的アセットもコピー
cp -r 2025/*.png dist/2025/ 2>/dev/null || true
cp -r 2025/*.jpg dist/2025/ 2>/dev/null || true
cp -r 2025/*.svg dist/2025/ 2>/dev/null || true
cp -r 2025/*.webmanifest dist/2025/ 2>/dev/null || true
cp -r 2025/*.kmz dist/2025/ 2>/dev/null || true
cp -r 2025/fonts dist/2025/ 2>/dev/null || true

echo "✅ ビルド完了！"
echo ""
echo "🚀 プレビューサーバーを起動中..."
echo ""

# プレビューサーバーを起動
npx http-server dist -p 8080 -c-1 --cors

echo ""
echo "🌐 アクセス方法:"
echo "  http://localhost:8080"
echo ""
echo "  ルートにアクセスすると自動的に /2025/ にリダイレクトされます。"
echo ""
echo "🛑 終了するには Ctrl+C を押してください"