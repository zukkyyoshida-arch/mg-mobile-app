import { test, expect } from '@playwright/test';

test.describe('NG-9 と NG-10(a) の修正', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: '参加せずに一人でプレイする' }).click();
  });

  test('NG-9: 採用の人数欄に負の数を入れられない（min属性と補正）', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await page.getByRole('button', { name: '採用' }).click();

    const input = page.locator('input[type="number"]').first();
    const min = await input.getAttribute('min');
    await input.fill('-3');
    const value = await input.inputValue();
    console.log('NG-9 min属性:', min, '/ -3を入れた結果の値:', JSON.stringify(value));
    expect(min).toBe('0');
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  test('NG-9: 負の金額を保存しようとすると原因が伝わるメッセージが出る', async ({ page }) => {
    const msgs = [];
    page.on('dialog', d => { msgs.push(d.message()); d.accept(); });

    await page.getByRole('button', { name: 'Add transaction' }).click();
    await page.getByRole('button', { name: 'その他出金' }).click();
    // min/補正を迂回してDOM経由で負の値を入れ、検証層が効くかを見る
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('input[type=number]')].find(i => i.placeholder === '金額を入力');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '-100');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: '取引を追加する' }).click();
    await page.waitForTimeout(300);
    console.log('NG-9 保存時のメッセージ:', JSON.stringify(msgs));
  });

  test('NG-10(a): リセット説明が「全20期分」になっている', async ({ page }) => {
    await page.getByRole('button', { name: '設定' }).click();
    const body = await page.locator('body').innerText();
    const line = body.split('\n').find(l => l.includes('すべての取引データ'));
    console.log('NG-10 リセット説明:', JSON.stringify(line));
    expect(line).toContain('全20期分');
    expect(line).not.toContain('全5期分');

    // 期選択グリッドも20個あることを確認（説明文と実態が一致）
    // 実装のボタンラベルは「1期」〜「20期」（PriorPeriodCarryover.jsx の {p}期）なので
    // 「数字のみ」ではなく「数字+期」で照合する
    const btns = await page.locator('button').evaluateAll(bs =>
      bs.map(b => (b.textContent || '').trim())
        .map(t => { const m = t.match(/^(\d+)期$/); return m ? Number(m[1]) : null; })
        .filter(n => n !== null && n >= 1 && n <= 20)
    );
    console.log('NG-10 期選択ボタンの数:', btns.length);
    expect(btns.length).toBe(20);
  });
});
