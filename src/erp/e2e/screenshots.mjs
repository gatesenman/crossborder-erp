import { chromium } from 'playwright';
const B = 'http://localhost:8800', D = '/workspace/erp/screenshots/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })).newPage();
await page.goto(B + '/login'); await page.waitForTimeout(1000);
await page.screenshot({ path: D + '01-login.png' });
await page.getByPlaceholder('用户名').fill('admin'); await page.getByPlaceholder('密码').fill('admin123');
await page.locator('button[type=submit]').click(); await page.waitForURL('**/dashboard');
const shots = [['02-dashboard', '/dashboard'], ['03-products-sku', '/product/sku'], ['04-orders', '/order/list'], ['05-purchase-orders', '/purchase/orders'], ['05b-purchase-plan', '/purchase/plan'], ['06-inventory', '/inventory/stock'], ['07-fba-shipments', '/fba/shipments'], ['08-finance-profit', '/finance/profit'], ['09-settings-stores', '/system/stores']];
for (const [n, p] of shots) {
  await page.goto(B + p); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  await page.screenshot({ path: D + n + '.png' }); console.log('saved', n);
}
await browser.close();
