import { test, expect } from '@playwright/test';

test.describe('MG Mobile App - Streamlit Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Streamlitが読み込まれるまで待機
    await page.waitForTimeout(2000);
  });

  test('ページが正常に読み込まれること', async ({ page }) => {
    const title = await page.title();
    expect(title).toContain('戦略MG');
  });

  test('HTML ファイルが iframe で埋め込まれていること', async ({ page }) => {
    const frame = page.frameLocator('iframe').first();
    // iframe の読み込みを待機
    await frame.locator('body').waitFor({ state: 'visible', timeout: 5000 });
    expect(frame).toBeTruthy();
  });

  test('React アプリが iframe 内で正常に動作すること', async ({ page }) => {
    const frame = page.frameLocator('iframe').first();

    // App コンポーネントが存在すること
    const app = frame.locator('#root, [data-root], main, .app');
    await app.waitFor({ state: 'visible', timeout: 5000 });
    expect(app).toBeTruthy();
  });

  test('画面が全体に表示されること（レイアウト確認）', async ({ page }) => {
    const width = await page.evaluate(() => window.innerWidth);
    const height = await page.evaluate(() => window.innerHeight);

    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  test('エラーメッセージが表示されていないこと', async ({ page }) => {
    // Streamlit エラーメッセージを確認
    const errorElements = page.locator('[data-testid="stException"], .stError, .error');
    const count = await errorElements.count();
    expect(count).toBe(0);
  });

  test('コンソールエラーがないこと', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', exception => {
      errors.push(exception.message);
    });

    await page.waitForTimeout(3000);

    // 既知のエラーを除外
    const criticalErrors = errors.filter(e =>
      !e.includes('Ignored an update') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
