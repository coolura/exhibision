# 🎨 AI カラーチェンジャー (Gemini)

スマホで撮った写真を、Google Gemini の画像モデルで **別の色に変える** サンプル / 展示用 Web アプリです。
バックエンド不要の静的サイトなので、**GitHub Pages で公開してスマホ実機のブラウザからそのまま使えます。**

## 特徴
- 📷 スマホのカメラで撮影、またはギャラリーから画像を選択
- ✨ 色プリセット（赤/青/緑…）＋自由入力プロンプトで指示
- 🤖 Gemini `gemini-2.5-flash-image`（通称 Nano Banana）で画像認識＋色変換
- 📱 レスポンシブUI・GitHub Pages でそのまま動作
- ⬇️ 変換後画像の保存

## 仕組み
```
[スマホカメラ] → base64 画像 + プロンプト → [Gemini API] → 変換後画像 → 画面表示/保存
```
`gemini-2.5-flash-image` に「元画像＋『◯◯を△色に変えて』というプロンプト」を送り、
返ってきた編集後画像（base64）を表示します。

## セットアップ

### 1. Gemini API キーを取得
[Google AI Studio](https://aistudio.google.com/app/apikey) でAPIキーを発行します（`AIza...`）。
※ 画像生成モデルの利用には請求先アカウントの設定が必要な場合があります。

### 2. ローカルで試す
静的ファイルのみなので、簡易サーバで開くだけです。
```bash
# リポジトリのルートで
python -m http.server 8000
# → ブラウザで http://localhost:8000
```
アプリ上部の入力欄にAPIキーを貼り付け → 保存 → 撮影 → 色を選ぶ → 変換。

### 3. スマホ実機で使う（GitHub Pages 公開）
1. このリポジトリを GitHub に push
2. GitHub の **Settings → Pages → Source: `main` ブランチ / `/ (root)`** を選択
3. 発行されたURL（例 `https://<ユーザー名>.github.io/exhibision/`）をスマホで開く
4. カメラで撮影 → 変換

> カメラ機能や API 通信は HTTPS が必要です。GitHub Pages は HTTPS なので問題ありません。

## APIキーの扱いについて（重要）
- 本アプリは **静的サイト** のため、APIキーをサーバ側に隠せません。
- 入力キーは **利用者自身の端末の localStorage にのみ** 保存され、Gemini API へ直接送信されます。
- 展示で共有端末を使う場合や、キーを秘匿したい場合は、キーをサーバ側で保持する
  **簡易バックエンド（例：Cloud Functions / Vercel Functions）** を挟む構成に拡張してください。
  （`app.js` の `ENDPOINT` を自前のプロキシURLに差し替えるだけで対応できます。）

## ファイル構成
```
index.html   … 画面
style.css    … スタイル
app.js       … カメラ取得・Gemini API 呼び出し・結果表示
```

## カスタマイズ
- 色プリセット: `app.js` の `COLOR_PRESETS`
- 使用モデル: `app.js` の `MODEL`（不可の場合 `gemini-2.5-flash-image-preview` を試す）

## ライセンス
MIT
