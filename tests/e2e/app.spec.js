import { test, expect } from '@playwright/test';

// このアプリは vite-plugin-singlefile で dist/index.html を単一配信するSPA。
// PocketBase同期を伴う「ルーム参加」フローはネットワーク依存のため、
// E2Eでは「参加せずに一人でプレイする」（オフラインモード）を使い、外部通信なしで検証する。

test.describe('MG Mobile App - スモークテスト', () => {
  test.beforeEach(async ({ page }) => {
    // 各テストの独立性を確保するため、localStorageを必ずクリアしてから開始する。
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('ページが正常に読み込まれ、参加モーダルが表示されること', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '研修ルームに参加' })).toBeVisible();
    await expect(page.getByPlaceholder('例: mg-tokyo-01')).toBeVisible();
    await expect(page.getByPlaceholder('例: 鈴木一郎')).toBeVisible();
    await expect(page.getByRole('button', { name: '参加する' })).toBeVisible();
    await expect(page.getByRole('button', { name: '参加せずに一人でプレイする' })).toBeVisible();
  });

  test('コンソールエラーが出ていないこと', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (exception) => errors.push(exception.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });
});

test.describe('MG Mobile App - 一人プレイフロー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('「参加せずに一人でプレイする」で出納帳画面が表示され、伝票番号が#1であること', async ({ page }) => {
    await page.getByRole('button', { name: '参加せずに一人でプレイする' }).click();

    // モーダルが閉じ、出納帳（ボトムナビ）が表示される
    await expect(page.getByRole('button', { name: '出納帳' })).toBeVisible();
    await expect(page.getByText('取引データがありません')).toBeVisible();

    // 新規取引追加モーダルを開き、伝票番号が#1であることを確認する
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page.getByText('伝票番号（自動連番）')).toBeVisible();
    await expect(page.getByText('#1', { exact: true })).toBeVisible();
  });

  test('銀行借入100を追加すると、タイムラインに借入と自動計上された利息が伝票#1/#2として載ること', async ({ page }) => {
    // 借入時にアプリ側で window.alert() が呼ばれるため、自動でacceptしてブロックを防ぐ
    page.on('dialog', (dialog) => dialog.accept());

    await page.getByRole('button', { name: '参加せずに一人でプレイする' }).click();

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await page.getByRole('button', { name: '銀行借入' }).click();

    await page.getByPlaceholder('金額を入力').fill('100');
    await page.getByRole('button', { name: '取引を追加する' }).click();

    // モーダルを閉じてタイムラインを確認
    await page.getByRole('button', { name: '×' }).click();

    // 借入(オ) と 自動利息(タ) の2件が計上される。期1は10%利率なので利息は10万。
    await expect(page.getByText('資金の借入')).toBeVisible();
    await expect(page.getByText('+ ¥100 万')).toBeVisible();
    await expect(page.getByText('営業外費用の支払')).toBeVisible();
    await expect(page.getByText('- ¥10 万')).toBeVisible();

    // 伝票番号 #1（借入） / #2（自動利息）
    await expect(page.getByText('#1', { exact: true })).toBeVisible();
    await expect(page.getByText('#2', { exact: true })).toBeVisible();
  });

  test('決算書・期末処理・計画表・設定の各タブが開けること', async ({ page }) => {
    await page.getByRole('button', { name: '参加せずに一人でプレイする' }).click();

    await page.getByRole('button', { name: '決算書' }).click();
    await expect(page.getByText('戦略会計変動損益計算書')).toBeVisible();

    await page.getByRole('button', { name: '期末処理' }).click();
    await expect(page.getByText('在庫の棚卸し')).toBeVisible();

    await page.getByRole('button', { name: '計画表' }).click();
    await expect(page.getByText('MG経営計画')).toBeVisible();

    await page.getByRole('button', { name: '設定', exact: true }).click();
    await expect(page.getByText('ルール設定')).toBeVisible();
    await expect(page.getByText('ネットワーク設定')).toBeVisible();
  });
});
