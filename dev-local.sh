#!/bin/bash

# ローカル開発用スクリプト
# 2つのサーバーを同時に起動して、本番環境と同じ構造を再現

echo "🚀 ローカル開発環境を起動します..."

# ルートサイトの開発サーバーを起動（ポート4321）
echo "📦 ルートサイト（リダイレクトページ）を起動中..."
npm run dev &
ROOT_PID=$!

# 2025サイトの開発サーバーを起動（ポート4322）
echo "📦 2025サイトを起動中..."
cd 2025
npm run dev -- --port 4322 &
SITE_2025_PID=$!

echo ""
echo "✅ 開発サーバーが起動しました！"
echo ""
echo "🌐 アクセス方法:"
echo "  - ルート（リダイレクト）: http://localhost:4321"
echo "  - 2025サイト直接: http://localhost:4322"
echo ""
echo "💡 ヒント: ルートにアクセスすると /2025/ にリダイレクトされますが、"
echo "   開発環境では別ポートになるため、手動で http://localhost:4322 にアクセスしてください。"
echo ""
echo "🛑 終了するには Ctrl+C を押してください"

# Ctrl+Cで両方のプロセスを終了
trap "kill $ROOT_PID $SITE_2025_PID 2>/dev/null; exit" INT

# プロセスが終了するまで待機
wait