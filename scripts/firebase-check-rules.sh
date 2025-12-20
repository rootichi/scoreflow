#!/bin/bash
# Firestoreセキュリティルールを確認するスクリプト

set -e

echo "=== Firestoreセキュリティルールの確認 ==="
echo "プロジェクト: scoreflow-jp"
echo ""

# プロジェクトを設定
firebase use scoreflow-jp

# セキュリティルールの構文チェック
echo "セキュリティルールの構文をチェック中..."
firebase deploy --only firestore:rules --dry-run

echo ""
echo "=== チェック完了 ==="


