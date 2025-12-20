#!/bin/bash
# Firebase CLIのセットアップスクリプト

set -e

echo "=== Firebase CLIセットアップ ==="
echo ""

# Firebase CLIがインストールされているか確認
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLIがインストールされていません。"
    echo "インストール: npm install -g firebase-tools"
    exit 1
fi

echo "Firebase CLIバージョン:"
firebase --version

echo ""
echo "=== ログイン状態の確認 ==="
firebase projects:list || {
    echo ""
    echo "ログインが必要です。以下のコマンドを実行してください:"
    echo "  firebase login"
    echo ""
    echo "ログイン後、このスクリプトを再実行してください。"
    exit 1
}

echo ""
echo "=== プロジェクトの設定 ==="
firebase use scoreflow-jp || {
    echo "プロジェクト scoreflow-jp が見つかりません。"
    echo "利用可能なプロジェクト:"
    firebase projects:list
    exit 1
}

echo ""
echo "=== セットアップ完了 ==="
echo "プロジェクト: scoreflow-jp"
echo ""
echo "利用可能なコマンド:"
echo "  npm run firebase:deploy:rules  - セキュリティルールをデプロイ"
echo "  npm run firebase:check:rules   - セキュリティルールをチェック"


