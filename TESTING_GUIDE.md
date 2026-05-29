# MG Mobile App - 自動テストガイド

## 概要

このプロジェクトは Playwright を使った E2E（End-to-End）テストを備えています。Streamlit で提供される React アプリの UI インタラクション、入力、ボタン動作、データ永続性などを自動的にテストします。

## テスト内容

### 1. **app.spec.js** - アプリケーション全体のテスト
- ✅ ページが正常に読み込まれること
- ✅ HTML ファイルが iframe で埋め込まれていること
- ✅ React アプリが iframe 内で正常に動作すること
- ✅ 画面が全体に表示されること（レイアウト確認）
- ✅ エラーメッセージが表示されていないこと
- ✅ コンソールエラーがないこと

### 2. **components.spec.js** - コンポーネント機能テスト
- ✅ **タブナビゲーション**：各タブが存在し、クリックで内容が変わる
- ✅ **入力フィールド**：数値や テキスト入力が機能する
- ✅ **ボタン操作**：ボタンクリックが機能する
- ✅ **データの永続性**：ローカルストレージにデータが保存される
- ✅ **レスポンシブ対応**：モバイル、タブレット、デスクトップで表示できる
- ✅ **パフォーマンス**：ページ読み込みが 5 秒以内

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. Streamlit アプリをビルド

```bash
npm run build
```

## テスト実行方法

### **基本的なテスト実行**

```bash
npm test
```

Streamlit サーバーを自動起動し、すべてのテストを実行します。

### **デバッグモードで実行**

```bash
npm run test:debug
```

ステップバイステップでテストを実行でき、ブレークポイントを設定できます。

### **UI モード（ブラウザ上で確認）**

```bash
npm run test:ui
```

ブラウザウィンドウを開き、テストをビジュアルに追跡できます。

### **テスト結果レポートを表示**

```bash
npm run test:report
```

最後のテスト実行結果を HTML レポートで表示します。

### **特定のテストファイルだけ実行**

```bash
npx playwright test tests/app.spec.js
```

### **特定のテストケースだけ実行**

```bash
npx playwright test -g "ページが正常に読み込まれること"
```

### **特定のブラウザだけ実行**

```bash
npx playwright test --project=chromium
```

## テスト構造

```
tests/
├── app.spec.js              # アプリケーション全体
└── components.spec.js       # コンポーネント機能
```

## CI/CD 統合（GitHub Actions）

`.github/workflows/test.yml` を作成して、以下を自動化できます：

```yaml
name: Playwright Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
```

## トラブルシューティング

### テストが Streamlit に接続できない

```bash
# Streamlit サーバーを手動起動（別ターミナル）
streamlit run streamlit_app.py

# 別のターミナルでテスト実行
npm test
```

### iframe が見つからない

iframe の読み込みに時間がかかる場合があります。テストの `waitForTimeout` を増やしてください。

```javascript
await page.waitForTimeout(3000); // 3秒に増やす
```

### ローカルストレージが見つからない

iframe 内のローカルストレージにアクセスするには、`page.frameLocator()` で frame を取得してからアクセスしてください。

## 今後の改善

- [ ] ビジュアルリグレッション テスト（スクリーンショット比較）
- [ ] ユニット テスト（Jest）の追加
- [ ] カバレッジレポートの生成
- [ ] パフォーマンス プロファイリング
- [ ] API モッキング（MSW）

## 参考資料

- [Playwright ドキュメント](https://playwright.dev/)
- [Streamlit テスト](https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app)
