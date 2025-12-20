# Firebase CLI操作ガイド

## セットアップ

### 1. Firebase CLIにログイン（初回のみ）

ターミナルで以下のコマンドを実行してください：

```bash
firebase login
```

ブラウザが開くので、`rootichi.jp@gmail.com`でログインしてください。

### 2. セットアップの確認

```bash
npm run firebase:setup
```

このコマンドで、Firebase CLIの状態とプロジェクト設定を確認できます。

## 利用可能なコマンド

### セキュリティルールのデプロイ

```bash
npm run firebase:deploy:rules
```

`firestore.rules`ファイルの内容をFirebase Consoleにデプロイします。

### セキュリティルールのチェック

```bash
npm run firebase:check:rules
```

セキュリティルールの構文エラーをチェックします（実際にはデプロイしません）。

## 手動でのFirebase CLI操作

### プロジェクトの確認

```bash
firebase projects:list
```

### プロジェクトの切り替え

```bash
firebase use scoreflow-jp
```

### セキュリティルールのデプロイ（直接）

```bash
firebase deploy --only firestore:rules
```

## トラブルシューティング

### エラー: "Failed to authenticate"

Firebase CLIにログインしていません。以下を実行：

```bash
firebase login
```

### エラー: "Invalid project selection"

プロジェクトIDが間違っているか、アクセス権限がありません。以下で確認：

```bash
firebase projects:list
```

### エラー: "Cannot run login in non-interactive mode"

ターミナルで直接実行してください：

```bash
firebase login
```













