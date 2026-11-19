// 界面端到端流程：登录 → SKU → 采购 → 库存 → 订单 → FBA → 利润
import { chromium } from 'playwright';
const B = process.env.BASE || 'http://localhost:8800';
const tag = Date.now().toString().slice(-6); const SKU = 'UI-' + tag;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror ' + e.message));
page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
let token = '';
const api = async (p) => (await (await fetch(B + '/api' + p, { headers: { authorization: 'Bearer ' + token } })).json());
const step = (s) => console.log('▶', s);
const ok = (c, m) => { if (!c) throw new Error('断言失败: ' + m); console.log('  ✓', m); };

const modal = (t) => page.locator('.ant-modal-content').filter({ has: page.locator('.ant-modal-title', { hasText: t }) }).last();
const item = (scope, label) => scope.locator('.ant-form-item').filter({ has: page.locator(`label[title="${label}"]`) }).first();
async function pick(selectLoc, text) {
  await page.waitForTimeout(250);
  await selectLoc.locator('.ant-select-selector').click();
  const input = selectLoc.locator('input.ant-select-selection-search-input');
  if (await input.getAttribute('readonly') === null) await input.fill(text);
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').filter({ hasText: text }).filter({ visible: true }).first().click();
  await page.waitForTimeout(250);
}
const sel = (scope, label, text) => pick(item(scope, label), text);
const fill = (scope, label, v) => item(scope, label).locator('input').first().fill(String(v));
const okBtn = (m) => m.locator('.ant-modal-footer .ant-btn-primary').click();
const toast = (t) => page.locator('.ant-message-notice').filter({ hasText: t }).first().waitFor({ timeout: 8000 });
const confirmPop = () => page.locator('.ant-popconfirm:visible .ant-btn-primary, .ant-popover:visible .ant-btn-primary').first().click();
const confirmModal = () => page.locator('.ant-modal-confirm .ant-btn-primary').last().click();
const go = async (p) => { await page.goto(B + p); await page.locator('.ant-table-tbody tr.ant-table-row').first().waitFor({ timeout: 15000 }); };

step('登录');
await page.goto(B + '/login');
await page.getByPlaceholder('用户名').fill('admin'); await page.getByPlaceholder('密码').fill('admin123');
await page.locator('button[type=submit]').click();
await page.waitForURL('**/dashboard');
token = await page.evaluate(() => localStorage.getItem('erp_token'));
ok(!!token, '登录成功进入仪表盘');

step('SKU 新建 / 搜索 / 编辑 / 详情');
await go('/product/sku');
await page.getByRole('button', { name: '新增SKU' }).click();
let m = modal('新增 SKU');
await fill(m, 'SKU 编码', SKU); await fill(m, '品名', '界面测试商品 ' + tag);
await sel(m, '默认供应商', '');
await fill(m, '采购成本(¥)', 18); await fill(m, '重量(kg)', 0.4);
await okBtn(m); await toast('保存成功');
await page.getByPlaceholder('SKU / 品名 / SPU').fill(SKU); await page.keyboard.press('Enter');
await page.locator('.ant-table-row', { hasText: SKU }).first().waitFor();
await page.locator('.ant-table-row', { hasText: SKU }).first().getByText('编辑').click();
m = modal('编辑 SKU'); await item(m, '采购成本(¥)').locator('input').waitFor();
await page.waitForTimeout(400);
await fill(m, '采购成本(¥)', 20); await fill(m, '颜色', '黑色');
await okBtn(m); await toast('保存成功');
await page.locator('.ant-table-row', { hasText: SKU }).first().getByText(SKU).click();
await page.locator('.ant-drawer-body', { hasText: '黑色' }).waitFor();
ok(true, 'SKU 详情抽屉显示编辑后的颜色');
await page.locator('.ant-drawer-close').click();
const skuRow = (await api('/r/skus?q=' + SKU)).list[0];
ok(skuRow && skuRow.purchase_cost === 20, 'SKU 已入库，采购成本 20');

step('采购单 新建 → 提审 → 审核下单 → 收货');
await go('/purchase/orders');
await page.getByRole('button', { name: '新建采购单' }).click();
m = modal('新建采购单');
await sel(m, '供应商', skuRow.supplier_name); await sel(m, '入库仓库', '深圳');
await pick(m.locator('.ant-select').filter({ hasText: '选择SKU' }).last(), SKU);
await m.locator('.ant-input-number-group-wrapper', { hasText: '¥' }).last().locator('input').fill('25');
await okBtn(m); await toast('保存成功').catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/po.png' });
const poRow = (await api('/r/purchase_orders?pageSize=1&sortField=id&sortOrder=descend')).list[0]; console.log(poRow.po_no, poRow.status, poRow.sku_list);
ok(poRow.sku_list.includes(SKU) && poRow.status === '草稿', '采购单 ' + poRow.po_no + ' 已创建（草稿）');
await page.getByPlaceholder('采购单号 / 供应商').fill(poRow.po_no); await page.keyboard.press('Enter');
await page.locator('.ant-table-row', { hasText: poRow.po_no }).first().getByText('详情').click();
const dr = page.locator('.ant-drawer-content');
await dr.getByRole('button', { name: '提交审核' }).click(); await toast('待审核');
await dr.getByRole('button', { name: '审核通过并下单' }).click(); await toast('已下单');
await dr.getByRole('button', { name: '收货入库' }).click();
await okBtn(modal('采购收货入库'));
await dr.locator('.ant-tag', { hasText: '已完成' }).first().waitFor();
const inv1 = (await api(`/r/inventory?sku_id=${skuRow.id}`)).list;
ok(inv1.reduce((a, x) => a + x.qty_available, 0) === 100, '收货完成，库存 100');
await page.locator('.ant-drawer-close').click();

step('库存 其他入库 / 调拨 / 到货');
await go('/inventory/moves');
await page.getByRole('button', { name: '其他入库' }).click();
m = modal('其他入库'); await sel(m, '入库仓库', '深圳'); await sel(m, 'SKU', SKU); await fill(m, '数量', 20);
await okBtn(m); await toast('已创建');
await page.getByRole('button', { name: '新建调拨单' }).click();
m = modal('新建调拨单'); await sel(m, '调出仓库', '深圳'); await sel(m, '调入仓库', '美西'); await sel(m, 'SKU', SKU);
await m.getByText('当前可用：120').waitFor();
await fill(m, '数量', 30);
await okBtn(m); await toast('已创建');
await page.getByRole('tab', { name: '调拨' }).click().catch(async () => { await page.locator('.ant-tabs-tab', { hasText: '调拨' }).first().click(); });
await page.locator('.ant-table-row', { hasText: SKU }).first().getByText('到货入库').click();
await confirmPop(); await toast('调拨入库完成');
const inv2 = (await api(`/r/inventory?sku_id=${skuRow.id}`)).list;
ok(inv2.length === 2 && inv2.every(x => x.qty_available === 90 || x.qty_available === 30), '调出仓 90 / 调入仓 30');

step('订单 手工建单 → 审核 → 分配物流 → 发货');
await go('/order/list');
await page.getByRole('button', { name: '手工建单' }).click();
m = modal('手工建单');
await sel(m, '店铺', 'Shopify'); await fill(m, '买家姓名', 'UI Buyer ' + tag); await sel(m, '国家', '美国'); await fill(m, '收货地址', '100 Test Ave, LA');
await pick(m.locator('.ant-select').filter({ hasText: '选择本地SKU' }).last(), SKU);
await m.locator('.ant-input-number-group-wrapper', { hasText: '单价' }).last().locator('input').fill('35');
await okBtn(m); await page.waitForTimeout(1000);
let ord = (await api('/r/orders?q=' + encodeURIComponent('UI Buyer ' + tag))).list[0];
ok(ord && ord.status === '待审核', '订单 ' + ord?.order_no + ' 已创建（待审核）');
await page.getByPlaceholder('系统单号 / 平台单号 / 买家 / 跟踪号').fill(ord.order_no); await page.keyboard.press('Enter');
const orow = page.locator('.ant-table-row', { hasText: ord.order_no }).first(); await orow.waitFor();
await orow.locator('.ant-checkbox-input').check();
await page.getByRole('button', { name: '审核通过' }).click(); await page.waitForTimeout(800);
await page.locator('.ant-table-row', { hasText: ord.order_no }).first().locator('.ant-checkbox-input').check().catch(() => {});
await page.getByRole('button', { name: '分配仓库/物流' }).click();
m = modal('分配仓库'); await sel(m, '发货仓库', '深圳'); await pick(item(m, '物流渠道'), '');
await okBtn(m); await page.waitForTimeout(800);
await page.locator('.ant-table-row', { hasText: ord.order_no }).first().locator('.ant-checkbox-input').check().catch(() => {});
await page.getByRole('button', { name: '确认发货' }).click(); await page.waitForTimeout(1200);
ord = (await api('/r/orders?q=' + ord.order_no)).list[0];
ok(ord.status === '已发货' && ord.tracking_no, `订单已发货，运单号 ${ord.tracking_no}，利润 ¥${ord.profit_cny}`);
await page.locator('.ant-table-row', { hasText: ord.order_no }).first().getByText('详情').click();
await page.locator('.ant-drawer-content', { hasText: '利润' }).first().waitFor();
await page.locator('.ant-drawer-close').click();

step('FBA 货件 创建 → 装箱 → 分摊 → 推进状态');
await go('/fba/shipments');
await page.getByRole('button', { name: '创建货件' }).click();
m = modal('创建 FBA 货件');
await sel(m, '亚马逊店铺', 'Amazon'); await fill(m, '计划名称', 'UI测试补货 ' + tag); await sel(m, '发货仓', '深圳');
await pick(m.locator('.ant-form-item:not(:has(label)) .ant-select').last(), SKU);
await m.locator('.ant-input-number-group-wrapper', { hasText: '数量' }).last().locator('input').fill('40');
await okBtn(m); await page.waitForTimeout(1000);
const fs = (await api('/r/fba_shipments?q=' + encodeURIComponent('UI测试补货 ' + tag))).list[0];
ok(fs && fs.status === '计划中', '货件 ' + fs?.shipment_no + ' 已创建');
await page.getByPlaceholder('货件单号 / Shipment ID / 计划名 / 跟踪号').fill(fs.shipment_no); await page.keyboard.press('Enter');
await page.locator('.ant-table-row', { hasText: fs.shipment_no }).first().getByText('详情').click();
const fd = page.locator('.ant-drawer-content');
await fd.getByRole('tab', { name: /装箱信息/ }).click();
await fd.getByRole('button', { name: '添加箱子' }).click(); await fd.getByRole('button', { name: '添加箱子' }).click();
await fd.getByRole('button', { name: '保存装箱' }).click(); await page.waitForTimeout(800);
await fd.getByRole('tab', { name: /商品明细/ }).click();
await fd.locator('.ant-input-number-group-wrapper', { hasText: '总运费' }).locator('input').fill('800');
await fd.getByRole('button', { name: '重新分摊' }).click(); await toast('分摊完成');
for (const s of ['已发货', '运输中', '已签收', '已上架']) {
  await fd.getByRole('button', { name: `推进至「${s}」` }).click(); await confirmModal();
  await fd.locator('.ant-drawer-title .ant-tag', { hasText: s }).waitFor({ timeout: 8000 });
}
const fsd = await api(`/fba/${fs.id}/detail`);
ok(fsd.status === '已上架' && fsd.boxes.length === 2 && Math.abs(fsd.items[0].alloc_freight - 800) < 0.01, '货件已上架，2 箱，头程分摊 ¥800');
await page.locator('.ant-drawer-close').click();

step('利润 重算 → 报表');
await go('/finance/profit');
await page.getByRole('button', { name: '重算利润' }).click(); await confirmPop(); await page.waitForTimeout(2500);
await page.locator('.ant-table-row').first().waitFor({ timeout: 10000 });
const pr = (await api('/finance/profit?dim=sku')).find(r => r.name === SKU);
ok(pr && pr.units === 1 && Math.abs(pr.revenue - pr.platform_fee - pr.fba_fee - pr.ad_cost - pr.cogs - pr.freight - pr.other - pr.profit) < 0.05, `SKU 利润报表包含 ${SKU}，利润 ¥${pr?.profit}`);
for (const d of ['店铺', '站点']) { await page.locator('.ant-segmented-item', { hasText: d }).first().click(); await page.waitForTimeout(600); }
ok(await page.locator('.ant-table-row').count() > 0, '按店铺/站点维度切换正常');

await browser.close();
if (errors.length) { console.log('错误:', errors); process.exit(1); }
console.log('\n界面端到端流程全部通过 ✅');
