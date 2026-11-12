# AI Instructions for mg-mobile-app

## 構成
- React 19 + Vite のアプリを単一HTML（`dist/index.html`）にビルドし、Cloudflare Workers で配信する
  - 本番URL: https://mg-mobile-app.zukky-yoshida.workers.dev/
  - `worker/` が `/api/*` を処理し、同期データは Cloudflare D1（binding `DB`、DB名 `mg-mobile-sync`）に保存する。スキーマは `migrations/`
- 旧M1のPocketBase配信URL（`*.tail4dd8e5.ts.net`）は、本番URLへの転送ページだけを返す。M1へアプリを配送しない

## 変更とデプロイの流れ
1. `src/` や `worker/` を変更したら `npm run build` で `dist/index.html` を更新する
2. `npm test`（vitest）と、必要に応じて `npm run test:e2e` を通す
3. ブランチでコミット → push → PR を作る。**main への直接push・force pushは禁止**（PR経由でsquash merge）
4. 本番反映は `npx wrangler deploy`。D1のスキーマを変えたときは先に `npx wrangler d1 migrations apply mg-mobile-sync --remote`。どちらも本番反映なので、実行前に本人の承認を取る
