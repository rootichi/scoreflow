# Firestore接続デバッグガイド

## 1. Firestore Consoleでの接続確認

### 手順

1. **Firestore Consoleにアクセス**
   - URL: https://console.firebase.google.com/project/scoreflow-jp/firestore/data
   - ブラウザで開いてください

2. **確認項目**

   #### A. データベースの状態確認
   - 左側のメニューから「データ」を選択
   - `tournaments`コレクションが存在するか確認
   - 既存のデータがある場合、そのデータが表示されるか確認

   #### B. セキュリティルールの確認
   - 左側のメニューから「ルール」を選択
   - 現在のルールが以下の内容と一致しているか確認：
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /tournaments/{tournamentId} {
         allow read: if (request.auth != null && 
                         resource.data.createdBy == request.auth.uid) ||
                     resource.data.publicUrlId != null;
         allow create: if request.auth != null && 
                          request.resource.data.createdBy == request.auth.uid;
         allow update, delete: if request.auth != null && 
                                  resource.data.createdBy == request.auth.uid;
         match /marks/{markId} {
           allow read: if true;
           allow create, update, delete: if request.auth != null && 
                                        get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.createdBy == request.auth.uid;
         }
       }
     }
   }
   ```

   #### C. リージョン設定の確認
   - 左側のメニューから「設定」を選択
   - 「リージョン」が `asia-northeast1` (Tokyo) または `asia-northeast2` (Osaka) になっているか確認

   #### D. 使用量の確認
   - 左側のメニューから「使用量」を選択
   - クォータに達していないか確認
   - 特に「書き込み」の使用量を確認

## 2. ブラウザの開発者ツール > Networkタブでの確認

### 手順

1. **開発者ツールを開く**
   - Chrome/Edge: `F12` または `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` または `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

2. **Networkタブを開く**
   - 開発者ツールの「Network」タブを選択

3. **フィルターを設定**
   - フィルターボックスに `googleapis.com` または `firestore` と入力
   - これにより、Firestoreへのリクエストのみが表示されます

4. **大会作成を試行**
   - アプリケーションで大会作成を試みてください
   - Networkタブで以下のリクエストを確認：

   #### 確認すべきリクエスト

   **A. 認証トークンの取得**
   - URL: `https://securetoken.googleapis.com/v1/token`
   - ステータス: `200 OK` であることを確認
   - レスポンス: トークンが含まれていることを確認

   **B. Firestoreへの書き込みリクエスト**
   - URL: `https://firestore.googleapis.com/v1/projects/scoreflow-jp/databases/(default)/documents/tournaments`
   - メソッド: `POST`
   - ステータス: 
     - `200 OK`: 成功
     - `403 Forbidden`: セキュリティルールの問題
     - `400 Bad Request`: リクエストデータの問題
     - `Pending`: タイムアウト（接続が確立されていない）

   **C. リクエストの詳細確認**
   - リクエストをクリックして「Headers」タブを確認
     - `Authorization: Bearer <token>` が含まれているか確認
   - 「Payload」タブを確認
     - 送信データが正しいか確認
   - 「Response」タブを確認
     - エラーメッセージが含まれているか確認

5. **エラーの詳細確認**
   - リクエストが失敗している場合、「Response」タブでエラーの詳細を確認
   - よくあるエラー：
     - `PERMISSION_DENIED`: セキュリティルールの問題
     - `UNAVAILABLE`: ネットワーク接続の問題
     - `DEADLINE_EXCEEDED`: タイムアウト

## 3. コンソールログでの確認

### 追加されたデバッグログ

以下のログがブラウザのコンソールに出力されます：

1. **認証関連**
   - `認証状態を確認します...`
   - `認証状態: OK`
   - `認証トークンを取得・更新します...`
   - `認証トークンの取得が完了しました。`

2. **ネットワーク接続関連**
   - `Firestoreネットワーク接続を確認します...`
   - `Firestoreネットワーク接続: OK`
   - `保留中の書き込みの待機完了`

3. **データ送信関連**
   - `送信データの詳細:` - 送信するデータの内容
   - `Firestore接続情報:` - Firestoreの接続情報
   - `addDoc実行開始...`

4. **エラー関連**
   - `保存試行 X/5 失敗:` - エラーの詳細情報
   - `addDoc Promise内のエラー:` - Promise内で発生したエラー
   - `ネットワーク状態:` - ブラウザのネットワーク状態

## 4. 問題の特定方法

### パターン1: セキュリティルールの問題

**症状:**
- Networkタブで `403 Forbidden` が表示される
- コンソールに `PERMISSION_DENIED` エラーが表示される

**解決方法:**
1. Firestore Consoleでセキュリティルールを確認
2. ルールが正しくデプロイされているか確認
3. 必要に応じて `npm run firebase:deploy:rules` を実行

### パターン2: ネットワーク接続の問題

**症状:**
- Networkタブでリクエストが `Pending` 状態で止まる
- コンソールに `UNAVAILABLE` または `DEADLINE_EXCEEDED` エラーが表示される

**解決方法:**
1. ブラウザのネットワーク接続を確認
2. ファイアウォールやプロキシの設定を確認
3. 別のネットワークで試す

### パターン3: 認証トークンの問題

**症状:**
- Networkタブで `401 Unauthorized` が表示される
- コンソールに認証エラーが表示される

**解決方法:**
1. 再度ログインを試す
2. ブラウザのCookieをクリアして再試行

## 5. 次のステップ

上記の確認を行った後、以下の情報を共有してください：

1. **Firestore Consoleでの確認結果**
   - セキュリティルールの内容
   - リージョン設定
   - 使用量の状況

2. **Networkタブでの確認結果**
   - Firestoreへのリクエストのステータスコード
   - エラーメッセージ（ある場合）
   - リクエストが `Pending` 状態で止まっているか

3. **コンソールログ**
   - エラーメッセージの全文
   - ネットワーク状態の情報

これらの情報があれば、問題の原因をより正確に特定できます。

