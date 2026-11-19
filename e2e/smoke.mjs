import { chromium } from 'playwright';
const B = 'http://localhost:8800';
const routes = ['/dashboard','/product/sku','/product/spu','/product/msku','/product/combo','/order/list','/order/after-sales','/order/rules','/purchase/plan','/purchase/orders','/purchase/receipts','/purchase/suppliers','/inventory/stock','/inventory/moves','/inventory/stocktake','/inventory/ledger','/inventory/warehouses','/fba/shipments','/fba/providers','/logistics/channels','/logistics/rules','/logistics/tracking','/logistics/providers','/finance/profit','/finance/order-profit','/finance/settlements','/finance/rates','/ads/overview','/ads/campaigns','/system/stores','/system/users','/system/roles','/system/logs'];
const br = await chromium.launch(); const page = await br.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(['pageerror', page.url(), e.message])); page.on('console', m => { if (m.type() === 'error') errs.push(['console', page.url(), m.text().slice(0, 300)]); });
page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) errs.push(['http', r.status(), r.url()]); });
await page.goto(B + '/login'); await page.waitForTimeout(800);
await page.getByRole('button', { name: /登\s*录/ }).click(); await page.waitForURL('**/dashboard'); await page.waitForTimeout(1500);
for (const r of routes) { await page.goto(B + r); await page.waitForTimeout(1200); const rows = await page.locator('.ant-table-row').count(); const t = await page.locator('.ant-result-title').count(); console.log(r, 'rows', rows, t ? 'RESULT!' : ''); }
console.log(JSON.stringify(errs, null, 1)); await br.close();
