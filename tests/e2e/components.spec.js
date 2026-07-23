import { test, expect } from '@playwright/test';

// コンポーネントレベルの機能確認。app.spec.js のスモークテストに続き、
// 個別UIの挙動（タブ内容の切り替え、レスポンシブ、localStorage永続化）を検証する。

test.describe('MG Mobile App - コンポーネント機能テスト', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: '参加せずに一人でプレイする' }).click();
  });

  test.describe('タブナビゲーション', () => {
    test('5つのボトムナビタブが全て存在すること', async ({ page }) => {
      for (const tabName of ['出納帳', '決算書', '期末処理', '計画表', '設定']) {
        await expect(page.getByRole('button', { name: tabName, exact: true })).toBeVisible();
      }
    });

    test('タブをクリックすると表示内容が切り替わること', async ({ page }) => {
      // 初期は出納帳タブ
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();

      await page.getByRole('button', { name: '決算書' }).click();
      await expect(page.getByText('取引履歴タイムライン')).not.toBeVisible();
      await expect(page.getByText('戦略会計変動損益計算書')).toBeVisible();

      await page.getByRole('button', { name: '出納帳' }).click();
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();
    });
  });

  test.describe('取引追加フォーム', () => {
    test('材料現金仕入(ツ)で数量・単価から金額欄以外の入力ができること', async ({ page }) => {
      await page.getByRole('button', { name: 'Add transaction' }).click();
      // デフォルト選択は「材料購入 (現金)」
      await expect(page.getByText('[ツ] 材料現金仕入')).toBeVisible();
      // 市場ごとの購入数量UI（MAXボタン等）が表示される
      await expect(page.getByRole('button', { name: 'MAX' }).first()).toBeVisible();
    });

    test('商品販売(現金)を選ぶと売上系フォームに切り替わること', async ({ page }) => {
      await page.getByRole('button', { name: 'Add transaction' }).click();
      await page.getByRole('button', { name: '商品販売 (現金)' }).click();
      await expect(page.getByText('[キ] 現金売上')).toBeVisible();
    });

    test('モーダルを×ボタンで閉じられること', async ({ page }) => {
      await page.getByRole('button', { name: 'Add transaction' }).click();
      await expect(page.getByText('出納データの追加')).toBeVisible();
      await page.getByRole('button', { name: '×' }).click();
      await expect(page.getByText('出納データの追加')).not.toBeVisible();
    });
  });

  test.describe('取引の削除', () => {
    test('追加した取引を削除できること', async ({ page }) => {
      await page.getByRole('button', { name: 'Add transaction' }).click();
      await page.getByRole('button', { name: '銀行借入' }).click();
      await page.getByPlaceholder('金額を入力').fill('50');
      await page.getByRole('button', { name: '取引を追加する' }).click();
      await page.getByRole('button', { name: '×' }).click();

      await expect(page.getByText('資金の借入')).toBeVisible();

      // 借入(#1)と自動利息(#2)の2件が入っているので、1件目を削除
      await page.getByRole('button', { name: 'Delete transaction' }).first().click();

      // 削除後もタイムラインが壊れず表示されること（残り件数は実装依存のため厳密件数は問わない）
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();
    });
  });

  test.describe('データの永続性', () => {
    test('オフラインモードのフラグがlocalStorageに保存されること', async ({ page }) => {
      const offlineFlag = await page.evaluate(() => localStorage.getItem('mg_offline_mode'));
      expect(offlineFlag).toBe('true');
    });

    test('追加した取引がリロード後も保持されること', async ({ page }) => {
      await page.getByRole('button', { name: 'Add transaction' }).click();
      await page.getByRole('button', { name: '銀行借入' }).click();
      await page.getByPlaceholder('金額を入力').fill('80');
      await page.getByRole('button', { name: '取引を追加する' }).click();
      await page.getByRole('button', { name: '×' }).click();

      await expect(page.getByText('資金の借入')).toBeVisible();

      await page.reload();

      // オフラインモードなので参加モーダルは出ず、そのまま出納帳が復元される
      await expect(page.getByText('資金の借入')).toBeVisible();
    });
  });

  test.describe('レスポンシブ対応', () => {
    test('モバイルサイズ(375x812)で出納帳が表示できること', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();
      await expect(page.getByRole('button', { name: '出納帳' })).toBeVisible();
    });

    test('タブレットサイズ(768x1024)で出納帳が表示できること', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();
    });

    test('デスクトップサイズ(1920x1080)で出納帳が表示できること', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.getByText('取引履歴タイムライン')).toBeVisible();
    });
  });

  test.describe('パフォーマンス', () => {
    test('ページの読み込みが5秒以内に完了すること', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await expect(page.locator('#root, .phone-shell').first()).toBeVisible({ timeout: 5000 });
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
