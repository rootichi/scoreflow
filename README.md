# ScoreFlow

大会進行状況をリアルタイムで発信するWeb SaaS

## 技術スタック

- Next.js 16 (App Router)
- React 19
- TypeScript
- TailwindCSS
- Firebase (Firestore / Authentication / Hosting)
- pdf.js (PDF → PNG変換)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebase設定

1. Firebase Consoleでプロジェクトを作成
2. AuthenticationでGoogleログインを有効化
3. Firestore Databaseを作成
4. `.env.local.example`を`.env.local`にコピーし、Firebase設定値を入力

```bash
cp .env.local.example .env.local
```

### 3. Firestoreセキュリティルール

`firestore.rules`をFirebase ConsoleのFirestore > ルールにコピー＆ペースト

### 4. 開発サーバー起動

```bash
npm run dev
```

## 機能

### 運営者機能（ログイン必須）

- Googleログイン
- 大会作成（名前、PDFアップロード）
- PDFを1ページのみアップロード → PNG変換 → Base64化 → Firestore保存
- トーナメント表上でライン（勝者ライン）追加
- トーナメント表上でスコア追加
- 公開URLのコピー

### 観客機能（ログイン不要）

- 公開URL（`/p/[publicUrlId]`）でアクセス
- トーナメント表のリアルタイム表示
- スコア・ラインのリアルタイム更新

## データ構造

### tournaments/{tournamentId}

```typescript
{
  name: string
  createdBy: string (uid)
  createdAt: Timestamp
  expiresAt: Timestamp (2ヶ月後)
  publicUrlId: string
  pdfPageImage: string (Base64)
}
```

### tournaments/{tournamentId}/marks/{markId}

```typescript
// Line Mark
{
  type: "line"
  pageNumber: number
  x1: number (0-1)
  y1: number (0-1)
  x2: number (0-1)
  y2: number (0-1)
  color: string
  createdAt: Timestamp
}

// Score Mark
{
  type: "score"
  pageNumber: number
  x: number (0-1)
  y: number (0-1)
  value: string
  fontSize: number
  color: string
  createdAt: Timestamp
}
```

## デプロイ

### Firebase Hosting

1. Firebase CLIをインストール（未インストールの場合）
```bash
npm install -g firebase-tools
```

2. Firebaseにログイン
```bash
firebase login
```

3. Firebaseプロジェクトを初期化（初回のみ）
```bash
firebase init hosting
```

4. ビルドとデプロイ
```bash
npm run build
firebase deploy --only hosting
```

## 注意事項

- v1プロトタイプではPDFは1ページのみ対応
- Firebase Storageは使用せず、Base64でFirestoreに保存
- 画像は圧縮（品質0.85）して保存
- データは2ヶ月後に自動削除（TTL機能）

## 動作確認状況

- ✅ デスクトップローカル環境で動作確認済み（2025年1月）
- ✅ Firestoreデータベース設定完了
- ✅ エラーハンドリング改善完了
- ✅ PDF変換機能動作確認済み
- ✅ 大会作成機能動作確認済み
- ✅ Next.js 16 / React 19 へのアップグレード完了
- ✅ コード最適化・リファクタリング完了

