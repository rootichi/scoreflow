# 編集ページの構造と仕様ドキュメント

## 1. 現在の全体構造

### 1.1 DOM階層構造

編集ページは以下の階層構造で構成されています：

```
TournamentEditPage (メインコンポーネント)
└── main (メインコンテナ)
    ├── TournamentHeader (ヘッダー、4rem高さ)
    ├── EditToolbar (ツールバー、3rem高さ)
    └── div[imageContainerRef] (画像コンテナ、calc(100vh - 9rem)高さ)
        └── div[CanvasViewport] (表示領域、100%幅・高さ、overflow: hidden)
            └── div[canvasZoomLayerRef] (ズームレイヤー、transform適用対象)
                └── div[canvasRef] (キャンバス要素、inline-block)
                    ├── img (PDF画像、w-full h-auto)
                    ├── svg[svgRef] (ライン描画用SVG、absolute、z-index: 10)
                    │   ├── line (既存のライン)
                    │   ├── circle (ハンドル、選択時のみ表示)
                    │   └── line (クリック可能な透明な領域)
                    ├── div (スコアマーク、absolute、z-index: 10)
                    ├── svg (描画中のライン、プレビュー、z-index: 20)
                    └── svg (スナップガイドライン、z-index: 20)
```

### 1.2 レイヤー構成と役割

#### 1.2.1 画像コンテナ層 (imageContainerRef)
- **役割**: 画面サイズに合わせた固定サイズのコンテナ
- **サイズ**: 幅100%、高さcalc(100vh - 9rem)
- **スタイル**: 
  - `overflow: hidden` (CanvasViewportで制御)
  - `touchAction: pan-x pan-y` (ネイティブピンチズーム無効化)
  - `position: relative`
- **イベント**: マウス・タッチイベントの受け取り

#### 1.2.2 CanvasViewport層
- **役割**: 表示領域の固定サイズを確保
- **サイズ**: 幅100%、高さ100%
- **スタイル**: 
  - `position: relative`
  - `overflow: hidden` (拡大したコンテンツがはみ出さないように)

#### 1.2.3 CanvasZoomLayer層 (canvasZoomLayerRef)
- **役割**: transform適用対象のレイヤー（ピンチズーム用）
- **サイズ**: 幅100%、高さ100%
- **スタイル**: 
  - `position: relative`
  - `transform`: `matrix(a, b, c, d, e, f)` (useEffectで適用)
  - `transform-origin`: `0 0` (左上固定)
- **特徴**: 
  - ピンチ中は`handlePinchMove`でDOMに直接適用
  - ピンチ中でない場合はReactのrender/re-renderで適用

#### 1.2.4 キャンバス要素層 (canvasRef)
- **役割**: 画像とマークの描画領域
- **サイズ**: 幅100%、`display: inline-block` (コンテンツサイズに合わせる)
- **特徴**: 
  - 画像の実際のサイズに応じて高さが決まる
  - 画像は`w-full h-auto`で表示

#### 1.2.5 画像層 (img)
- **役割**: PDF画像の表示
- **スタイル**: 
  - `w-full h-auto` (幅100%、高さ自動)
  - `display: block`
  - ボーダーとシャドウで視覚的に区別

#### 1.2.6 ライン描画層 (svg[svgRef])
- **役割**: ラインの描画とインタラクション
- **スタイル**: 
  - `absolute top-0 left-0 w-full h-full`
  - `z-index: 10`
  - `viewBox="0 0 100 100"`
  - `preserveAspectRatio="none"`
- **特徴**: 
  - 座標は0-1の正規化座標を100倍して使用
  - ライン、ハンドル、クリック可能領域を含む

#### 1.2.7 スコアマーク層 (div)
- **役割**: スコアの表示とインタラクション
- **スタイル**: 
  - `absolute`
  - `left: ${mark.x * 100}%`
  - `top: ${mark.y * 100}%`
  - `transform: translate(-50%, -50%)` (中心揃え)
  - `fontSize: ${mark.fontSize * imageScale}px`
  - `z-index: 10`

#### 1.2.8 プレビュー・ガイドライン層 (svg)
- **役割**: 描画中のラインとスナップガイドラインの表示
- **スタイル**: 
  - `absolute top-0 left-0 w-full h-full`
  - `pointer-events-none`
  - `z-index: 20`
  - `viewBox="0 0 100 100"`
  - `preserveAspectRatio="none"`

### 1.3 責務の分離状況

- **座標計算**: `useCanvasCoordinates`フックで一元管理
- **画像スケール計算**: `useImageScale`フックで管理
- **ピンチズーム**: `usePinchZoom`フックで管理
- **スクロール制御**: `useScrollPrevention`フックで管理
- **編集モード**: `useEditMode`フックで管理
- **タッチジェスチャー**: `useTouchGestures`フックで管理

## 2. 座標系の扱い

### 2.1 座標系の種類

#### 2.1.1 Screen座標系（ビューポート座標系）
- **定義**: ブラウザのビューポートを基準とした座標
- **取得方法**: `clientX`, `clientY`, `getBoundingClientRect()`
- **用途**: イベント座標の取得、要素の位置計算

#### 2.1.2 Local座標系（要素座標系）
- **定義**: 特定のDOM要素を基準とした座標
- **取得方法**: `getBoundingClientRect()`で要素の位置を取得し、screen座標から減算
- **用途**: 要素内での相対位置計算

#### 2.1.3 正規化座標系（Normalized座標系、0-1座標系）
- **定義**: canvasRefのサイズを基準とした0-1の相対座標
- **計算方法**: `(screenX - rect.left) / rect.width`, `(screenY - rect.top) / rect.height`
- **用途**: ライン・スコアの座標保存、画像サイズに依存しない座標管理

#### 2.1.4 Image座標系
- **定義**: 画像の自然サイズ（naturalWidth/naturalHeight）を基準とした座標
- **用途**: 画像の実際のサイズを基準とした計算（現在は使用されていない）

### 2.2 画像のサイズ管理

#### 2.2.1 自然サイズ（Natural Size）
- **取得方法**: `imgElement.naturalWidth`, `imgElement.naturalHeight`
- **用途**: 画像の実際のピクセルサイズ

#### 2.2.2 表示サイズ（Display Size）
- **取得方法**: `imgElement.offsetWidth`, `imgElement.offsetHeight`
- **用途**: 画面に表示されている実際のサイズ
- **特徴**: CSSの`w-full h-auto`により、幅は親要素の100%、高さは自動計算

#### 2.2.3 画像スケール（imageScale）
- **計算方法**: `offsetWidth / naturalWidth`
- **用途**: スコアのフォントサイズ計算など
- **管理**: `useImageScale`フックで自動計算

#### 2.2.4 初期画像サイズ（initialImageSizeRef）
- **定義**: `canvasScale=1.0`の状態での画像表示サイズ
- **用途**: ピンチズーム時の基準サイズ（現在は使用されていない）

### 2.3 ライン・スコアの座標基準

#### 2.3.1 ライン座標（LineMark）
- **保存形式**: 正規化座標（0-1）で保存
  - `x1`, `y1`: 開始点（0-1）
  - `x2`, `y2`: 終了点（0-1）
- **基準**: `canvasRef`のサイズを基準とした相対座標
- **描画**: SVGの`viewBox="0 0 100 100"`で、座標を100倍して使用
  - `x1={displayMark.x1 * 100}`
  - `y1={displayMark.y1 * 100}`

#### 2.3.2 スコア座標（ScoreMark）
- **保存形式**: 正規化座標（0-1）で保存
  - `x`, `y`: 中心座標（0-1）
- **基準**: `canvasRef`のサイズを基準とした相対座標
- **描画**: CSSの`left`と`top`でパーセンテージ指定
  - `left: ${mark.x * 100}%`
  - `top: ${mark.y * 100}%`
  - `transform: translate(-50%, -50%)`で中心揃え

### 2.4 座標変換の流れ

#### 2.4.1 イベント座標から正規化座標への変換
```
Screen座標 (clientX, clientY)
  ↓
getBoundingClientRect()でcanvasRefの位置・サイズを取得
  ↓
Local座標 = Screen座標 - rect.left/top
  ↓
正規化座標 = Local座標 / rect.width/height
  ↓
0-1の座標として保存・使用
```

#### 2.4.2 正規化座標から描画座標への変換

**ラインの場合**:
```
正規化座標 (0-1)
  ↓
SVG座標 = 正規化座標 * 100
  ↓
viewBox="0 0 100 100"で描画
```

**スコアの場合**:
```
正規化座標 (0-1)
  ↓
CSS座標 = 正規化座標 * 100%
  ↓
left/topで配置、translate(-50%, -50%)で中心揃え
```

### 2.5 座標検証

#### 2.5.1 座標が画像の範囲内にあるかの検証
- **関数**: `isValidCoordinate()`, `isValidLineCoordinate()`
- **基準**: 画像要素の`getBoundingClientRect()`のみを基準とする
- **方法**: 
  1. 正規化座標をピクセル座標に変換
  2. 画像の`getBoundingClientRect()`と比較
  3. 画像の矩形内にあるかを確認

## 3. 変形・描画の仕組み

### 3.1 Transformの使用状況

#### 3.1.1 CanvasZoomLayerへのTransform適用
- **対象**: `canvasZoomLayerRef`要素
- **形式**: CSS `transform: matrix(a, b, c, d, e, f)`
- **管理**: `usePinchZoom`フックで`DOMMatrix`として管理
- **適用タイミング**: 
  - ピンチ中: `handlePinchMove`でDOMに直接適用
  - ピンチ中でない場合: Reactのrender/re-renderで適用（useEffect）

#### 3.1.2 Transform-Origin
- **設定**: `transform-origin: 0 0` (左上固定)
- **理由**: DOMMatrixの座標系と一致させるため

#### 3.1.3 スコアマークへのTransform適用
- **対象**: スコアマークの`div`要素
- **形式**: CSS `transform: translate(-50%, -50%)`
- **目的**: 中心揃え（座標は中心点として保存されているため）

### 3.2 DOMMatrixの管理

#### 3.2.1 初期状態
- **値**: 単位行列（`a=1, b=0, c=0, d=1, e=0, f=0`）
- **意味**: scale=1, translate=(0,0)

#### 3.2.2 ピンチズーム時の更新
- **式**: `M_new = T(pivotLocal) * S(scaleRatio) * T(-pivotLocal) * M_old`
- **意味**: 
  - `M_old`: ピンチ開始時の行列
  - `T(-pivotLocal)`: pivotを原点に移動
  - `S(scaleRatio)`: スケーリング
  - `T(pivotLocal)`: pivotを元の位置に戻す

#### 3.2.3 座標系の不一致問題
- **問題**: DOMMatrixはtransform適用前の座標系で動作するが、`getBoundingClientRect()`はtransform適用後の位置を返す
- **対策**: 親要素の位置を基準に初期rectを計算し、transform適用前の座標系を取得

### 3.3 描画時の座標変換

#### 3.3.1 ラインの描画
- **座標系**: SVGの`viewBox="0 0 100 100"`
- **変換**: 正規化座標（0-1）を100倍してSVG座標に変換
- **特徴**: `preserveAspectRatio="none"`により、アスペクト比を無視して拡大

#### 3.3.2 スコアの描画
- **座標系**: CSSのパーセンテージ座標
- **変換**: 正規化座標（0-1）を100%に変換
- **特徴**: `transform: translate(-50%, -50%)`で中心揃え

#### 3.3.3 画像の描画
- **座標系**: CSSのパーセンテージ座標
- **変換**: `w-full h-auto`により、幅は100%、高さは自動計算
- **特徴**: アスペクト比を維持

## 4. 編集ロジック

### 4.1 タップ・ドラッグ時の座標計算の流れ

#### 4.1.1 イベント座標の取得
1. マウス/タッチイベントから`clientX`, `clientY`を取得
2. `getRelativeCoordinates()`で正規化座標（0-1）に変換
3. `canvasRef.getBoundingClientRect()`で基準位置・サイズを取得
4. `(clientX - rect.left) / rect.width`で正規化X座標を計算
5. `(clientY - rect.top) / rect.height`で正規化Y座標を計算

#### 4.1.2 ラインの描画
1. タップ開始: `lineStart`に正規化座標を保存
2. ドラッグ中: `lineEnd`を更新、水平/垂直の判定
3. スナップ処理: `findSnapPosition()`または`findSnapPositionVertical()`でスナップ位置を計算
4. タップ終了: 座標検証後、Firestoreに保存

#### 4.1.3 ラインのドラッグ
1. タップ開始: `draggingMark`に開始座標と元のマークを保存
2. ドラッグ中: 
   - 水平線: `handleHorizontalLineDragSnap()`でスナップ処理
   - 垂直線: `handleVerticalLineDragSnap()`でスナップ処理
3. 座標更新: `updateMarkCoordinates()`で座標を更新
4. タップ終了: 座標検証後、Firestoreに保存

#### 4.1.4 ハンドルのドラッグ
1. タップ開始: `draggingHandle`に開始座標と元のマークを保存
2. ドラッグ中: 
   - 水平線: `handleHorizontalHandleSnap()`でスナップ処理
   - 垂直線: `handleVerticalHandleSnap()`でスナップ処理
3. 座標更新: 開始点または終了点のみを更新
4. タップ終了: 座標検証後、Firestoreに保存

#### 4.1.5 スコアのドラッグ
1. タップ開始: `draggingMark`に開始座標と元のマークを保存
2. ドラッグ中: `handleScoreDragSnap()`でスナップ処理
3. 座標更新: `updateMarkCoordinates()`で座標を更新
4. タップ終了: 座標検証後、Firestoreに保存

### 4.2 ライン・スコアの配置・移動・リサイズの考え方

#### 4.2.1 配置
- **ライン**: 2点のタップで描画、水平/垂直の自動判定
- **スコア**: 1点のタップで配置、入力ダイアログで値を設定

#### 4.2.2 移動
- **ライン**: ライン上をドラッグして移動、水平/垂直の制約を維持
- **スコア**: スコア上をドラッグして移動、自由に配置可能

#### 4.2.3 リサイズ
- **ライン**: ハンドルをドラッグして長さを調整
- **スコア**: リサイズ機能なし（フォントサイズは固定）

### 4.3 スナップ機能

#### 4.3.1 スナップの種類
- **水平線の端点スナップ**: 既存の水平線の端点にスナップ
- **垂直線の端点スナップ**: 既存の垂直線の端点にスナップ
- **水平線のY座標スナップ**: 既存の水平線のY座標にスナップ
- **垂直線のX座標スナップ**: 既存の垂直線のX座標にスナップ
- **スコアの中心スナップ**: 既存のスコアの中心座標にスナップ

#### 4.3.2 スナップ距離
- **定数**: `SNAP_DISTANCE_PX` (ピクセル単位)
- **計算**: 正規化座標に変換して使用
  - `snapDistance = SNAP_DISTANCE_PX / canvasWidth` (水平)
  - `snapDistance = SNAP_DISTANCE_PX / canvasHeight` (垂直)

## 5. 現状の制約と問題点

### 5.1 ピンチズーム実装が難航している根本要因

#### 5.1.1 座標系の不一致
- **問題**: DOMMatrixはtransform適用前の座標系で動作するが、`getBoundingClientRect()`はtransform適用後の位置を返す
- **影響**: pivot計算が不正確になり、ピンチ中心がずれる
- **対策**: 親要素の位置を基準に初期rectを計算（現在の実装）

#### 5.1.2 Transform適用の二重管理
- **問題**: ピンチ中はDOMに直接適用、ピンチ中でない場合はReactのrender/re-renderで適用
- **影響**: 状態の同期が複雑になり、バグの原因となる
- **対策**: 適用経路を1系統に統一（現在の実装）

#### 5.1.3 座標変換の複雑さ
- **問題**: screen座標 → local座標 → 正規化座標の変換が複数箇所で行われている
- **影響**: transform適用時の座標変換が不正確になる可能性
- **対策**: 座標変換を一元化する必要がある

### 5.2 設計上、将来拡張の障害になり得る点

#### 5.2.1 正規化座標の基準がcanvasRefのサイズ
- **問題**: transform適用時、canvasRefのサイズが変わる可能性がある
- **影響**: 正規化座標の基準が変わり、マークの位置がずれる
- **対策**: 画像の自然サイズを基準にするか、transform適用前のサイズを基準にする

#### 5.2.2 スコアのフォントサイズがimageScaleに依存
- **問題**: `fontSize: ${mark.fontSize * imageScale}px`で計算
- **影響**: transform適用時、フォントサイズが不正確になる可能性
- **対策**: transform適用時のスケールも考慮する必要がある

#### 5.2.3 SVGのviewBoxが固定
- **問題**: `viewBox="0 0 100 100"`が固定
- **影響**: transform適用時、ラインの描画が不正確になる可能性
- **対策**: transform適用時のスケールを考慮する必要がある

### 5.3 その他の制約

#### 5.3.1 画像サイズの取得タイミング
- **問題**: 画像の読み込み完了前に座標計算が行われる可能性がある
- **影響**: 座標計算が不正確になる
- **対策**: 画像の読み込み完了を待つ必要がある

#### 5.3.2 スクロール制御の複雑さ
- **問題**: ピンチ中、ドラッグ中、描画中など、複数の条件でスクロールを制御
- **影響**: スクロール制御が複雑になり、バグの原因となる
- **対策**: スクロール制御を一元化する必要がある

## 6. v1前提での整理

### 6.1 ピンチ・スクロールを使わない場合、何が不要で何が必要か

#### 6.1.1 不要な機能・コード
- **ピンチズーム関連**:
  - `usePinchZoom`フック
  - `canvasZoomLayerRef`要素
  - `transform`の適用ロジック
  - `handlePinchStart`, `handlePinchMove`, `handlePinchEnd`
  - ピンチ中の状態管理
- **スクロール制御関連**:
  - `useScrollPrevention`フック（一部は必要かも）
  - スクロール判定ロジック
- **その他**:
  - `initialImageSizeRef`（ピンチズーム用）
  - ピンチ中のデバッグログ

#### 6.1.2 必要な機能・コード
- **座標計算**:
  - `useCanvasCoordinates`フック（必須）
  - `getRelativeCoordinates()`関数（必須）
- **画像スケール計算**:
  - `useImageScale`フック（スコアのフォントサイズ計算に必要）
  - `imageScale`の計算（必須）
- **編集機能**:
  - ラインの描画・ドラッグ・リサイズ（必須）
  - スコアの配置・ドラッグ（必須）
  - スナップ機能（必須）
  - 座標検証（必須）
- **状態管理**:
  - マークの状態管理（必須）
  - 編集モードの管理（必須）
  - 履歴管理（必須）

### 6.2 v1として「安定している」と言える状態の定義

#### 6.2.1 機能要件
- **ライン機能**:
  - ラインの描画が正常に動作する
  - ラインのドラッグが正常に動作する
  - ハンドルによるリサイズが正常に動作する
  - スナップ機能が正常に動作する
  - 座標検証が正常に動作する
- **スコア機能**:
  - スコアの配置が正常に動作する
  - スコアのドラッグが正常に動作する
  - スナップ機能が正常に動作する
  - 座標検証が正常に動作する
  - フォントサイズが画像サイズに応じて適切に表示される
- **その他**:
  - 編集モードの切り替えが正常に動作する
  - 履歴管理（undo/redo）が正常に動作する
  - マークの削除が正常に動作する

#### 6.2.2 非機能要件
- **パフォーマンス**:
  - マークの数が増えても描画が遅くならない
  - ドラッグ中のレスポンスが良好
- **互換性**:
  - デスクトップブラウザで正常に動作する
  - モバイルブラウザで正常に動作する（ピンチ・スクロールなし）
- **安定性**:
  - エラーが発生しない
  - メモリリークが発生しない
  - 状態の不整合が発生しない

#### 6.2.3 設計要件
- **座標系の一貫性**:
  - 正規化座標（0-1）を基準とした座標管理が一貫している
  - 座標変換が正確に行われる
- **責務の分離**:
  - 各フック・関数の責務が明確である
  - コードの重複が少ない
- **拡張性**:
  - 将来的にピンチズームを追加しやすい設計
  - 将来的にスクロール機能を追加しやすい設計

### 6.3 v1実装時の推奨事項

#### 6.3.1 コードの整理
- ピンチズーム関連のコードを削除または無効化
- スクロール制御関連のコードを簡素化
- 不要なrefやstateを削除

#### 6.3.2 座標系の統一
- 正規化座標（0-1）を基準とした座標管理を徹底
- 座標変換を一元化
- 座標検証を強化

#### 6.3.3 テストの実施
- ライン機能のテスト
- スコア機能のテスト
- 座標計算のテスト
- スナップ機能のテスト

#### 6.3.4 ドキュメントの整備
- 座標系の説明
- 座標変換の説明
- 編集ロジックの説明

## 7. まとめ

### 7.1 現状の構造の特徴
- **レイヤー構造**: 画像コンテナ → CanvasViewport → CanvasZoomLayer → キャンバス要素の階層構造
- **座標系**: 正規化座標（0-1）を基準とした座標管理
- **描画**: SVGでライン、CSSでスコアを描画
- **変形**: CanvasZoomLayerにtransformを適用（ピンチズーム用）

### 7.2 問題点の要約
- **座標系の不一致**: DOMMatrixと`getBoundingClientRect()`の座標系が異なる
- **Transform適用の複雑さ**: ピンチ中とピンチ中でない場合で適用方法が異なる
- **座標変換の複雑さ**: 複数箇所で座標変換が行われている

### 7.3 v1実装時の方針
- **ピンチズーム機能の削除**: 不要なコードを削除し、シンプルな構造にする
- **座標系の統一**: 正規化座標（0-1）を基準とした座標管理を徹底
- **責務の分離**: 各フック・関数の責務を明確にする
- **拡張性の確保**: 将来的にピンチズームを追加しやすい設計を維持

### 7.4 将来的な拡張に向けて
- **座標系の再設計**: transform適用時の座標変換を正確に行う
- **Transform適用の統一**: 適用方法を一元化する
- **座標変換の一元化**: 座標変換を1箇所に集約する

