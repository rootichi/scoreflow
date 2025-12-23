# スマホ版編集機能実装タスク一覧

## 概要
編集ページ（`app/tournament/[id]/page.tsx`）をスマホからも操作できるようにするためのタスク一覧。
現在はマウスイベントのみ実装されており、タッチイベントが未実装のため、スマホでは編集操作ができない状態。

---

## タスク1: タッチイベントハンドラーの実装

### 1.1 座標取得関数の拡張
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `getRelativeCoordinates`
**内容**:
- 現在は`React.MouseEvent<HTMLDivElement> | MouseEvent`のみ対応
- `React.TouchEvent<HTMLDivElement> | TouchEvent`にも対応するよう拡張
- タッチイベントから`clientX`と`clientY`を取得する処理を追加
- マウスイベントとタッチイベントの両方に対応するユニオン型を作成

**実装方針**:
```typescript
const getRelativeCoordinates = useCallback((
  e: React.MouseEvent<HTMLDivElement> | MouseEvent | React.TouchEvent<HTMLDivElement> | TouchEvent
): { x: number; y: number } => {
  // タッチイベントの場合はtouches[0]から座標を取得
  // マウスイベントの場合はclientX/clientYから取得
}, []);
```

---

## タスク2: ライン追加機能のタッチ対応

### 2.1 タッチ開始時のライン描画開始
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchStart`（新規作成）
**内容**:
- `onTouchStart`イベントハンドラーを追加
- `handleCanvasMouseDown`と同等の処理を実装
- ライン追加モード時、タッチ開始で描画を開始
- `preventDefault()`でスクロールを防止（編集操作中のみ）

### 2.2 タッチ移動時のライン描画更新
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchMove`（新規作成）
**内容**:
- `onTouchMove`イベントハンドラーを追加
- `handleCanvasMouseMove`と同等の処理を実装
- ライン描画中のプレビュー更新
- スナップ機能の動作確認

### 2.3 タッチ終了時のライン確定
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchEnd`（新規作成）
**内容**:
- `onTouchEnd`イベントハンドラーを追加
- `handleCanvasMouseUp`と同等の処理を実装
- ライン描画の確定とFirestoreへの保存
- 履歴への追加

---

## タスク3: ライン移動機能のタッチ対応

### 3.1 ラインのタッチドラッグ開始
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: SVGの`<line>`要素の`onMouseDown`（行907-921）
**内容**:
- `onTouchStart`イベントハンドラーを追加
- ライン上をタッチした際にドラッグを開始
- `stopPropagation()`で親要素へのイベント伝播を防止

### 3.2 ラインのタッチドラッグ中
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchMove`（タスク2.2で実装）
**内容**:
- ドラッグ中のライン移動処理
- スナップ機能の動作
- ローカル状態でのプレビュー更新

### 3.3 ラインのタッチドラッグ終了
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchEnd`（タスク2.3で実装）
**内容**:
- ドラッグ終了時のFirestoreへの保存
- 履歴への追加

---

## タスク4: ラインの長さ変更（ハンドル操作）のタッチ対応

### 4.1 ハンドルのタッチドラッグ開始
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: SVGの`<circle>`要素の`onMouseDown`（行935-947, 958-970）
**内容**:
- 開始点・終了点のハンドルに`onTouchStart`イベントハンドラーを追加
- ハンドルをタッチした際にドラッグを開始
- `stopPropagation()`で親要素へのイベント伝播を防止

### 4.2 ハンドルのタッチドラッグ中
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchMove`（タスク2.2で実装）
**内容**:
- ハンドルドラッグ中のライン長さ変更処理
- 水平線・垂直線それぞれのスナップ処理
- ローカル状態でのプレビュー更新

### 4.3 ハンドルのタッチドラッグ終了
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchEnd`（タスク2.3で実装）
**内容**:
- ドラッグ終了時のFirestoreへの保存
- 履歴への追加

---

## タスク5: スコア追加機能のタッチ対応

### 5.1 スコア追加のタッチ操作
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchEnd`（タスク2.3で実装）
**内容**:
- スコア追加モード時、タッチ位置にスコアを配置
- `handleCanvasClick`と同等の処理を実装
- ドラッグ操作と区別するため、タッチ開始から終了までの移動距離をチェック

---

## タスク6: スコア移動機能のタッチ対応

### 6.1 スコアのタッチドラッグ開始
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: スコアマークの`<div>`要素の`onMouseDown`（行995-1008）
**内容**:
- `onTouchStart`イベントハンドラーを追加
- スコアをタッチした際にドラッグを開始
- `stopPropagation()`で親要素へのイベント伝播を防止

### 6.2 スコアのタッチドラッグ中
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchMove`（タスク2.2で実装）
**内容**:
- ドラッグ中のスコア移動処理
- スナップ機能の動作
- ローカル状態でのプレビュー更新

### 6.3 スコアのタッチドラッグ終了
**ファイル**: `app/tournament/[id]/page.tsx`
**関数**: `handleCanvasTouchEnd`（タスク2.3で実装）
**内容**:
- ドラッグ終了時のFirestoreへの保存
- 履歴への追加

---

## タスク7: スクロールとの競合防止

### 7.1 タッチ操作の判定ロジック
**ファイル**: `app/tournament/[id]/page.tsx`
**内容**:
- タッチ開始位置を記録
- タッチ移動距離を計算
- 一定距離以上移動した場合のみ編集操作と判定
- 編集操作と判定された場合のみ`preventDefault()`を呼び出し
- スクロール操作と編集操作を区別

**実装方針**:
- タッチ開始時の座標を保存
- タッチ移動時に移動距離を計算（例: 10px以上）
- 移動距離が閾値以下の場合はスクロールとして扱う
- 移動距離が閾値以上の場合は編集操作として扱い、`preventDefault()`を呼び出す

---

## タスク8: マウスイベントとタッチイベントの統一処理

### 8.1 共通処理関数の作成
**ファイル**: `app/tournament/[id]/page.tsx`
**内容**:
- マウスイベントとタッチイベントの両方から座標を取得する共通関数
- イベントタイプに応じた分岐処理
- コードの重複を削減

**実装方針**:
```typescript
const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
  const coords = getRelativeCoordinates(e);
  // 共通の処理
};

const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
  const coords = getRelativeCoordinates(e);
  // 共通の処理
};

const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
  const coords = getRelativeCoordinates(e);
  // 共通の処理
};
```

---

## タスク9: キーボードショートカットの代替手段（UIボタン追加）

### 9.1 削除ボタンの追加
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: 編集ツールバー（行739-852）
**内容**:
- 選択中のマークがある場合に表示される削除ボタンを追加
- `Delete`キーと同等の機能
- スマホではキーボードが使えないため必須

### 9.2 コピーボタンの追加
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: 編集ツールバー（行739-852）
**内容**:
- 選択中のマークがある場合に表示されるコピーボタンを追加
- `Ctrl+C`と同等の機能

### 9.3 ペーストボタンの追加
**ファイル**: `app/tournament/[id]/page.tsx`
**場所**: 編集ツールバー（行739-852）
**内容**:
- コピーされたマークがある場合に表示されるペーストボタンを追加
- `Ctrl+V`と同等の機能
- ペースト位置は現在の選択位置または画面中央

---

## タスク10: タッチ操作の最適化

### 10.1 タッチターゲットサイズの調整
**ファイル**: `app/tournament/[id]/page.tsx`
**内容**:
- ハンドルのタッチターゲットサイズを確認・調整
- スマホでの操作性を向上させるため、必要に応じてサイズを拡大
- `HANDLE_RADIUS`の調整を検討

### 10.2 タッチ操作のフィードバック
**ファイル**: `app/tournament/[id]/page.tsx`
**内容**:
- タッチ操作時の視覚的フィードバック（例: ハイライト、アニメーション）
- タッチ操作が認識されたことをユーザーに示す

---

## タスク11: テストと動作確認

### 11.1 スマホ実機でのテスト
**内容**:
- iOS（Safari）での動作確認
- Android（Chrome）での動作確認
- 各種操作（ライン追加、移動、長さ変更、スコア追加、移動）の確認
- スクロールとの競合がないことの確認

### 11.2 エッジケースの確認
**内容**:
- 複数タッチ（マルチタッチ）の処理
- タッチ操作中の画面回転
- タッチ操作中のページ遷移
- ネットワークエラー時の動作

---

## 実装の優先順位

### 高優先度（必須）
1. タスク1: タッチイベントハンドラーの実装
2. タスク2: ライン追加機能のタッチ対応
3. タスク3: ライン移動機能のタッチ対応
4. タスク4: ラインの長さ変更（ハンドル操作）のタッチ対応
5. タスク5: スコア追加機能のタッチ対応
6. タスク6: スコア移動機能のタッチ対応
7. タスク7: スクロールとの競合防止

### 中優先度（推奨）
8. タスク8: マウスイベントとタッチイベントの統一処理
9. タスク9: キーボードショートカットの代替手段（UIボタン追加）

### 低優先度（改善）
10. タスク10: タッチ操作の最適化
11. タスク11: テストと動作確認

---

## 注意事項

1. **既存機能の維持**: マウスイベントによる操作は既存のまま動作する必要がある
2. **パフォーマンス**: タッチイベントの処理が重くならないよう注意
3. **アクセシビリティ**: タッチ操作とマウス操作の両方に対応することで、アクセシビリティを向上
4. **ブラウザ互換性**: 主要なモバイルブラウザ（Safari、Chrome）での動作を確認

---

## 参考実装パターン

### タッチイベントとマウスイベントの統一
```typescript
// イベントハンドラーの統一
const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
  e.preventDefault();
  const coords = getRelativeCoordinates(e);
  // 処理
};

// JSXでの使用
<div
  onMouseDown={handleStart}
  onTouchStart={handleStart}
  onMouseMove={handleMove}
  onTouchMove={handleMove}
  onMouseUp={handleEnd}
  onTouchEnd={handleEnd}
>
```

### スクロールとの競合防止
```typescript
let touchStartX = 0;
let touchStartY = 0;
const SCROLL_THRESHOLD = 10; // px

const handleTouchStart = (e: React.TouchEvent) => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
};

const handleTouchMove = (e: React.TouchEvent) => {
  const touch = e.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartX);
  const deltaY = Math.abs(touch.clientY - touchStartY);
  
  // 編集操作と判定された場合のみpreventDefault
  if (deltaX > SCROLL_THRESHOLD || deltaY > SCROLL_THRESHOLD) {
    e.preventDefault();
    // 編集処理
  }
};
```

