# 戦略MG モバイルアプリ開発 コンテキスト（自動同期ファイル）

## プロジェクト概要
- **対象**: 戦略MG（製造業）のモバイル向けWebアプリケーション
- **技術スタック**: React (Vite) + Streamlit (フロントエンドのビルド結果を単一HTMLとして `streamlit_app.py` で配信)
- **ワークフロー**: コード修正後、必ず `npm run build` を実行して `dist/index.html` を更新してからGit Pushしてデプロイする。

## 主な実装機能（現在の状態）
- **UI/UX**: スマホ用ボトムナビゲーション、ダーク/ライトテーマの切り替え
- **状態管理**: 1期から5期までのデータをLocalStorageで安全に保持（`safeStorage`）
- **メイン画面構成**: 
  - **出納帳 (CashLedger)**: 取引の入力と管理
  - **決算書 (FinancialStatements)**: B/S, P/Lなどのリアルタイム財務計算
  - **期末処理 (PeriodEndWizard)**: 在庫や現金などの実態入力
  - **計画表 (ManagementPlan)**: 次期の目標設定
  - **設定 (PriorPeriodCarryover)**: 全期リセット、前期からのデータ自動引き継ぎ (`rollForwardFromPrevious`)
- **追加機能**: AIアドバイザー機能 (`AIAdvisor`)

## 最新の更新内容（Recent Updates）
- **2026-07-24**: 改善レビュー指摘13項目を一括実装（5観点マルチエージェントレビュー→全件実装）
  - **データ保全**: 仕訳明細を含む全期データをサーバー(playersのbackup)へ同期。同名参加時の復元/上書き確認フロー、リセット取り消し（1世代退避）、同期自動リトライ(5s/15s/30s)
  - **荒らし対策**: playersのdelete管理者専用化（外部から403確認済み）、PocketBase管理画面(/_/)と管理者認証APIをFunnel層で遮断。archivesの改ざん防止も実値確認済み
  - **講師運用**: アーカイブ保存は常に総合成績基準（タブ依存を解消）。退出ボタン廃止（退出してもサーバー成績・バックアップは残る設計に）
  - **ゲーム機能**: AIアドバイザー配線（出納帳バナー+期末処理Step3）、機械売却の台数トラッキング（PAC反映・保有超過ブロック）、決算書「推移」タブ（期別折れ線）、期末処理の強制処分やり直し対応、計画表に前期借入利息を自動計上
  - **開発基盤**: vitestユニット68件+Playwright E2E 17件（全グリーン）。CashLedgerを2260→473行に分割、取引生成を純粋関数化(cashledger/buildTransactionEntries.js)
  - 未対応（ユーザー判断で除外）: 講師の強制退出の再設計(#5)、同期エラーalertの非ブロッキング化(#6)。既知の残課題: aiRules.jsのgenerateReport未配線（別タスク起票済み）
- **2026-07-23 (2)**: 配信の二重運用開始 + 伝票番号の自動連番化
  - **二重運用**: Vercel（従来URL）に加え、M1のPocketBase静的配信（`--publicDir` → `~/pocketbase/pb_public`）でも同一アプリを配信。URL: `https://kazukiyoshidamacbook-air-2.tail4dd8e5.ts.net/`。DBは共通なので、どちらのURLから参加しても同じルームでプレイ可能
  - **自動配送**: post-commitフックがビルド成果物をM1へscp配送（失敗してもコミットは成立、手動は `npm run deploy:m1`）。Vercelは従来通りpushで自動デプロイ
  - **注意**: localStorageはURL（オリジン）ごとに別。プレイヤーはゲーム中に配信URLを切り替えないこと
  - **伝票番号**: 手入力を廃止し完全自動連番（既存の最大番号+1、削除後も重複しない）。追加画面は次番号の読み取り専用表示。借入の自動利息も連番継続。E2E検証済み
- **2026-07-23**: データベースをFirebase FirestoreからM1サーバー上のPocketBaseへ移行
  - 背景: Firestoreのテストモードルールが30日で失効し PERMISSION_DENIED（「データベース接続エラー」）が発生していた
  - DB: M1 MacBook Air上のPocketBase v0.39.9（LaunchAgent `com.zukky.pocketbase` 常駐、ポート8090）
  - 公開: Tailscale Funnel → `https://kazukiyoshidamacbook-air-2.tail4dd8e5.ts.net`（接続先変更は `VITE_PB_URL` で上書き可）
  - コード: `src/firebase.js` を撤去し `src/pocketbase.js`（onSnapshot互換のsubscribeToRoom等、同一インターフェース）へ差し替え
  - コレクション: `players`（room+playerユニーク、公開CRUD）/ `archives`（作成・閲覧のみ公開、改ざん防止）
  - バックアップ: M1で毎日3:10に純正バックアップAPI→`~/Backups/pocketbase/` 14世代（`com.zukky.pocketbase-backup`）
  - E2E検証済み: プレイヤー参加→レコード作成、ダッシュボード初期取得、SSEリアルタイム反映、強制同期の往復
  - 注意: M1が停止するとDBも停止する（研修前にM1稼働と `api/health` を確認すること）
- **2026-07-23**: 投げ売り機能（在庫を@18万で処分売却）をCashLedgerに追加（先行未コミット分を取り込み）
- **2026-05-29**: riskSaleType状態の削除リファクタリング完了・デプロイ
  - CashLedger.jsx から使用されていない riskSaleType state をリモーブ
  - リモート上の「loan borrowing機能削除」との競合を解決（git rebase）
  - npm 依存関係の修復（react-router-dom インストール）
  - フル build → commit → push ワークフロー完了
  - デプロイ状態: **✅ 本番環境に反映済み**

## 次にやるべきこと（Next Action）
（※新しいチャットを開始した際、ここからタスクを再開します）
- [ ] 未使用ファイル（test_*.js, TESTING_GUIDE.md, playwright.config.js など）の整理検討
- [ ] AIアドバイザー機能の詳細実装・テスト（対応状況確認） 
