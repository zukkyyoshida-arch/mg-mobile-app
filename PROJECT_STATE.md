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

## 次にやるべきこと（Next Action）
（※新しいチャットを開始した際、ここからタスクを再開します）
- [ ] 
