#!/bin/bash
# Firestoreセキュリティルールをデプロイするスクリプト

set -e

echo "=== Firestoreセキュリティルールのデプロイ ==="
echo "プロジェクト: scoreflow-jp"
echo ""

# プロジェクトを設定
firebase use scoreflow-jp

# セキュリティルールをデプロイ
echo "セキュリティルールをデプロイ中..."
firebase deploy --only firestore:rules

echo ""
echo "=== デプロイ完了 ==="
echo "Firebase Console: https://console.firebase.google.com/project/scoreflow-jp/firestore/rules"


