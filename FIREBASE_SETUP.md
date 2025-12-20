# Firebase設定確認・修正手順

## 問題の状況

小さいPDF（4,326バイト）でもFirestoreへの保存がタイムアウト（60秒）しています。
これはデータサイズの問題ではなく、Firestoreの接続や設定に問題がある可能性が高いです。

## Firebase CLIでの操作（推奨）

Firebase CLIを使用して、コマンドでセキュリティルールをデプロイできます。

### セットアップ（初回のみ）

1. Firebase CLIにログイン：
```bash
firebase login
```

2. セットアップの確認：
```bash
npm run firebase:setup
```

### セキュリティルールのデプロイ

```bash
npm run firebase:deploy:rules
```

これで`firestore.rules`の内容がFirebase Consoleにデプロイされます。

詳細は `FIREBASE_CLI_GUIDE.md` を参照してください。

## Firebase Consoleで確認・修正が必要な項目（手動操作）

### 1. Firestore Databaseの設定確認

**URL**: https://console.firebase.google.com/project/scoreflow-jp/firestore/settings

#### 確認項目：
1. **リージョン設定**
   - 現在のリージョンを確認
   - 推奨: `asia-northeast1` (Tokyo) または `asia-northeast2` (Osaka)
   - リージョンが遠い場合、接続が遅くなる可能性があります

2. **データベースモード**
   - ネイティブモードであることを確認
   - Datastoreモードではないことを確認

### 2. Firestoreセキュリティルールの確認

**URL**: https://console.firebase.google.com/project/scoreflow-jp/firestore/rules

#### 現在のルール（確認用）:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // トーナメント
    match /tournaments/{tournamentId} {
      // 読み取り: ログインユーザーで作成者、または公開URL経由
      allow read: if (request.auth != null && 
                      resource.data.createdBy == request.auth.uid) ||
                  resource.data.publicUrlId != null;
      
      // 作成: ログインユーザーのみ
      allow create: if request.auth != null && 
                       request.resource.data.createdBy == request.auth.uid;
      
      // 更新・削除: 作成者のみ
      allow update, delete: if request.auth != null && 
                               resource.data.createdBy == request.auth.uid;
      
      // マーク（サブコレクション）
      match /marks/{markId} {
        // 読み取り: 誰でも（公開URL経由でも読める）
        allow read: if true;
        
        // 作成・更新・削除: トーナメントの作成者のみ
        allow create, update, delete: if request.auth != null && 
                                         get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.createdBy == request.auth.uid;
      }
    }
  }
}
```

#### 確認手順：
1. 上記のルールが正しく設定されているか確認
2. 「公開」ボタンをクリックしてルールを公開
3. ルールの構文エラーがないか確認（エラーがあれば赤く表示されます）

### 3. Authentication設定の確認

**URL**: https://console.firebase.google.com/project/scoreflow-jp/authentication/settings

#### 確認項目：
1. **承認済みドメイン**
   - `scoreflow-eight.vercel.app` が追加されているか確認
   - 追加されていない場合は「ドメインを追加」をクリックして追加

2. **Sign-in method**
   - Googleが有効になっているか確認
   - プロジェクトのサポートメールが設定されているか確認

### 4. Firestoreデータの確認

**URL**: https://console.firebase.google.com/project/scoreflow-jp/firestore/data

#### 確認項目：
1. `tournaments`コレクションが存在するか確認
2. 過去に保存されたデータがあるか確認
3. データが保存されているが、読み取りに時間がかかっている可能性も確認

### 5. プロジェクト設定の確認

**URL**: https://console.firebase.google.com/project/scoreflow-jp/settings/general

#### 確認項目：
1. **プロジェクトID**: `scoreflow-jp` であることを確認
2. **リージョン**: アジアリージョンが設定されているか確認

## トラブルシューティング

### 問題1: セキュリティルールが正しく公開されていない

**症状**: 権限エラーが発生する

**解決方法**:
1. Firestore > ルールにアクセス
2. ルールを確認して「公開」ボタンをクリック
3. 数秒待ってから再度試す

### 問題2: リージョンが遠い

**症状**: 接続が遅い、タイムアウトが発生する

**解決方法**:
1. Firestore > 設定でリージョンを確認
2. アジアリージョン（asia-northeast1など）に変更できない場合は、そのまま使用
3. タイムアウト時間を延長（既に60秒に設定済み）

### 問題3: ネットワークの問題

**症状**: 接続が不安定

**解決方法**:
1. ブラウザの開発者ツール > NetworkタブでFirestoreへのリクエストを確認
2. リクエストがPending状態で止まっているか確認
3. 別のネットワークで試す

## デバッグ用ログ

ブラウザのコンソールで以下のログを確認してください：

1. `Firebase設定確認:` - Firebaseの初期化状態
2. `=== 大会作成開始 ===` - 大会作成処理の開始
3. `Firestoreに大会データを保存します...` - 保存処理の開始
4. `addDoc実行開始...` - addDocの実行開始
5. `タイムアウト発生:` - タイムアウトが発生した場合

これらのログを確認して、どの段階で止まっているかを特定してください。

