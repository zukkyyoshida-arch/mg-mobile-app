# MG Mobile App - 自動テストガイド

最終更新: 2026-10-11

## 概要

このプロジェクトは2層の自動テストを備えています。

| 層 | ツール | 対象 | 件数（2026-10-11） | コマンド |
|---|---|---|---|---|
| ユニット | Vitest | `src/utils` の純粋関数（財務計算・取引生成・入力正規化・期データ正規化・同期ガード・期別集計） | 194件 / 6ファイル | `npm test` |
| E2E | Playwright（Chromium） | ビルド済み `dist/index.html` を `vite preview` で配信し、実ブラウザでUIを操作 | 25件 / 3ファイル | `npm run test:e2e` |

本番配信は Cloudflare Workers と M1 の PocketBase 静的配信の2本です。E2E はどちらにも接続せず、ローカルの `vite preview`（ポート4173）だけで完結します。Streamlit は使っていません。

## セットアップ

```bash
npm install
npx playwright install chromium   # E2E を回す場合のみ、初回だけ
```

## ユニットテスト（Vitest）

```bash
npm test              # 1回だけ実行（vitest run）
npm run test:watch    # 監視モード
npx vitest run tests/unit/calculations.test.js   # ファイル指定
npx vitest run -t "借入"                          # テスト名で絞り込み
```

設定は `vitest.config.js`。`tests/unit/**/*.test.js` だけを対象にし、`tests/e2e` は除外しています。環境は `node` です。

### テストファイルと守備範囲

- `tests/unit/calculations.test.js` — `calculateFinancials` / `calculateBudget`。P/L・B/S・C/F の整合、借入利息、減価償却、機械台数、PAC生産能力、リスクカード、法人税（均等割含む）、期末処理判定、機械売却の簿価除却、繰越未払税、旧5期版データへの防御。旧 `test_*.js` スクリプトのシナリオもここへ移植済み
- `tests/unit/buildTransactionEntries.test.js` — 出納帳の取引生成（純粋関数）。伝票番号採番、各取引種別の仕訳、現金残高ガード、負の金額・非有限値の拒否、在庫チェック、groupId による一括削除
- `tests/unit/inputSanitizers.test.js` — `toSafeInt` と入力上限 `MAX_AMOUNT`。`buildTransactionEntries` 側との一致も検証
- `tests/unit/normalizePeriods.test.js` — 旧データ（1〜5期のみ）を20期分に正規化する `normalizePeriods`、前期引き継ぎ `buildNextCarryover`
- `tests/unit/syncGuards.test.js` — PocketBase 同期の追い越し上書きガード、空ローカルからの backup 上書き防止
- `tests/unit/periodAggregation.test.js` — `TOTAL_PERIODS`、期別サマリ、推移グラフ用データ、総合成績の集計

## E2E テスト（Playwright）

```bash
npm run build               # 先にビルド（vite preview は dist/ を配信する）
npm run test:e2e            # 全件実行
npm run test:e2e:ui         # UIモード
npm run test:e2e:debug      # デバッグモード
npm run test:e2e:report     # 直前の実行結果をHTMLレポートで表示
npx playwright test tests/e2e/app.spec.js            # ファイル指定
npx playwright test -g "銀行借入"                      # テスト名で絞り込み
```

設定は `playwright.config.js`。`webServer` に `npm run preview -- --port 4173 --strictPort` を指定しているので、サーバーは自動で起動します。ローカルでは既に動いている 4173 を再利用します（`reuseExistingServer`）。

### テストファイルと守備範囲

- `tests/e2e/app.spec.js`（5件） — 起動と参加モーダル、コンソールエラーなし、一人プレイで出納帳表示、銀行借入の追加と自動利息のタイムライン反映、全タブの遷移
- `tests/e2e/components.spec.js`（17件） — ボトムナビ5タブ、取引フォームの切り替え、モーダル操作、取引の削除・「直す」・やり直し確認、残高超過の支出ブロック、localStorage への保存とリロード後の保持、モバイル／タブレット／デスクトップ表示、読み込み5秒以内
- `tests/e2e/_ng910.spec.js`（3件） — 採用人数の負値防止、負の金額保存時のメッセージ、リセット説明が「全20期分」

## 変更時のチェック手順

1. `npm test` が全件通過すること
2. `npx eslint src` が 0 件であること
3. `npm run build` が成功すること（pre-commit フックでも自動実行され `dist/index.html` が add される）
4. UI を触った変更は `npm run test:e2e` も通すこと
5. コミットは PR 経由で main へ（main への直接 push は禁止）

## リリース前の疎通確認

研修前は次の URL が 200 を返すことを確認します。DB は M1 の PocketBase なので、M1 が停止しているとアプリは動きません。

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://kazukiyoshidamacbook-air-2.tail4dd8e5.ts.net/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://mg-mobile-app.zukky-yoshida.workers.dev/
```

## トラブルシューティング

- **E2E が「port 4173 already in use」で落ちる** — 別の `vite preview` が残っています。そのプロセスを止めるか、`reuseExistingServer` が効くようローカル実行（`CI` 未設定）で回してください
- **E2E が古い画面を見ている** — `dist/index.html` が古い状態です。`npm run build` を先に実行してください
- **Chromium が無いと言われる** — `npx playwright install chromium`
- **ユニットテストが E2E ファイルを拾う** — `vitest.config.js` の `include` / `exclude` を確認してください

## 今後の改善

- [ ] GitHub Actions での自動実行（現在 `.github/workflows` は無し）
- [ ] カバレッジレポートの生成
- [ ] ビジュアルリグレッションテスト

## 参考資料

- [Vitest ドキュメント](https://vitest.dev/)
- [Playwright ドキュメント](https://playwright.dev/)
