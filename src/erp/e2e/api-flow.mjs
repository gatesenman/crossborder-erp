// 业务流程接口测试：SKU / 订单 / 采购 / 库存 / FBA / 利润
const B = process.env.BASE || 'http://localhost:8800';
let T = '';
const req = async (m, p, body) => {
  const r = await fetch(B + '/api' + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const ok = (c, msg) => { if (!c) throw new Error('断言失败: ' + msg); console.log('  ✓', msg); };
const near = (a, b) => Math.abs(a - b) < 0.02;
const inv = async (w, s) => (await req('GET', `/r/inventory?warehouse_id=${w}&sku_id=${s}`)).list[0] || { qty_available: 0, qty_transit: 0 };

T = (await req('POST', '/login', { username: 'admin', password: 'admin123' })).token;
const tag = Date.now().toString().slice(-6);

console.log('1. SKU 新建/编辑/详情');
const sku = await req('POST', '/r/skus', { sku: 'TEST-' + tag, product_id: 1, name: '测试SKU ' + tag, purchase_cost: 20, freight_cost: 3, packaging_cost: 1, weight: 0.5, supplier_id: 1, safety_stock: 10, status: '在售', is_combo: 0 });
await req('PUT', `/r/skus/${sku.id}`, { purchase_cost: 22.5, name: '测试SKU已编辑 ' + tag });
const sd = await req('GET', `/skus/${sku.id}/detail`);
ok(sd.purchase_cost === 22.5 && sd.name.includes('已编辑'), 'SKU 编辑生效');
const lst = await req('GET', `/r/skus?q=TEST-${tag}`);
ok(lst.total === 1, 'SKU 列表搜索命中');

console.log('2. 采购：建单→提审→审核→收货');
const po = await req('POST', '/purchase-orders', { supplier_id: 1, warehouse_id: 1, freight: 50, items: [{ sku_id: sku.id, qty: 100, unit_price: 22.5 }] });
await req('PUT', `/purchase-orders/${po.id}`, { remark: 'e2e', items: [{ sku_id: sku.id, qty: 120, unit_price: 22.5 }] });
await req('POST', `/purchase-orders/${po.id}/status`, { status: '待审核' });
await req('POST', `/purchase-orders/${po.id}/status`, { status: '已下单' });
let pd = await req('GET', `/purchase-orders/${po.id}/detail`);
ok(pd.total_amount === 2700 && pd.status === '已下单', '采购单编辑后金额 2700，状态已下单');
await req('POST', `/purchase-orders/${po.id}/receive`, { items: [{ item_id: pd.items[0].id, qty: 70 }] });
ok((await req('GET', `/purchase-orders/${po.id}/detail`)).status === '部分到货', '部分收货 → 部分到货');
await req('POST', `/purchase-orders/${po.id}/receive`, { items: [{ item_id: pd.items[0].id, qty: 50 }] });
pd = await req('GET', `/purchase-orders/${po.id}/detail`);
ok(pd.status === '已完成' && pd.receipts.length === 2, '全部收货 → 已完成，2 条收货记录');
ok((await inv(1, sku.id)).qty_available === 120, '本地仓库存 = 120');
const sug = await req('GET', '/purchase/suggestions?days=30&target=45');
ok(sug.some(x => x.level === '紧急' || x.level === '建议补货'), '采购计划有补货建议');

console.log('3. 库存：其他入库/出库/调拨/到货/盘点');
await req('POST', '/stock-moves', { type: '入库', to_wh: 1, sku_id: sku.id, qty: 30 });
await req('POST', '/stock-moves', { type: '出库', from_wh: 1, sku_id: sku.id, qty: 10 });
const tf = await req('POST', '/stock-moves', { type: '调拨', from_wh: 1, to_wh: 3, sku_id: sku.id, qty: 20 });
ok((await inv(1, sku.id)).qty_available === 120 && (await inv(3, sku.id)).qty_transit === 20, '调拨后调出仓 120、调入仓在途 20');
await req('POST', `/stock-moves/${tf.id}/receive`);
const i3 = await inv(3, sku.id);
ok(i3.qty_available === 20 && i3.qty_transit === 0, '调拨到货：调入仓可用 20');
let bad = false; try { await req('POST', '/stock-moves', { type: '出库', from_wh: 3, sku_id: sku.id, qty: 999 }); } catch { bad = true; }
ok(bad, '超库存出库被拒绝');
const st = await req('POST', '/stocktakes', { warehouse_id: 1, sku_id: sku.id, actual_qty: 118 });
const cf = await req('POST', `/stocktakes/${st.id}/confirm`);
ok(cf.diff === -2 && (await inv(1, sku.id)).qty_available === 118, '盘点盘亏 2，库存 118');
const led = await req('GET', `/r/inventory_ledger?sku_id=${sku.id}&pageSize=50`);
ok(led.total === 7, `库存流水 7 条（${led.list.map(x => x.type).join('/')}）`);

console.log('4. 订单：配对 MSKU → 手工建单 → 编辑 → 审核 → 分配 → 发货');
const store = (await req('GET', '/r/stores?pageSize=50')).list.find(s => s.platform !== 'Amazon') || (await req('GET', '/r/stores')).list[0];
await req('POST', '/r/mskus', { msku: 'M-TEST-' + tag, store_id: store.id, sku_id: sku.id, price: 39.99, status: '在售' });
const od = await req('POST', '/orders', { store_id: store.id, buyer_name: 'John Test', country: '美国', address: '1 Main St', items: [{ msku: 'M-TEST-' + tag, qty: 2, price: 39.99 }] });
await req('PUT', `/orders/${od.id}`, { buyer_name: 'John Edited', other_cost: 5, items: [{ msku: 'M-TEST-' + tag, qty: 3, price: 39.99 }] });
let o = await req('GET', `/orders/${od.id}/detail`);
ok(o.buyer_name === 'John Edited' && o.items[0].qty === 3 && o.items[0].sku_id === sku.id, '订单编辑生效，MSKU 自动匹配 SKU');
await req('POST', '/orders/audit', { ids: [od.id] });
const ch = (await req('GET', '/r/logistics_channels?pageSize=50')).list.find(c => c.type === '小包专线');
let shipFail = await req('POST', '/orders/ship', { ids: [od.id] });
ok(shipFail.ok === 0 && shipFail.fail.length === 1, '未分配物流的订单不能发货');
await req('POST', '/orders/assign', { ids: [od.id], warehouse_id: 1, channel_id: ch.id });
const sh = await req('POST', '/orders/ship', { ids: [od.id] });
o = await req('GET', `/orders/${od.id}/detail`);
ok(sh.ok === 1 && o.status === '已发货' && o.tracking_no, '订单发货成功并生成运单号 ' + o.tracking_no);
ok((await inv(1, sku.id)).qty_available === 115, '发货扣减库存 118 → 115');

console.log('5. 利润校验');
const rates = (await req('GET', '/r/exchange_rates?pageSize=50')).list;
const rate = rates.find(r => r.currency === o.currency).rate_to_cny;
const fee = { Amazon: 0.15, eBay: 0.13, Shopify: 0.03, Walmart: 0.15, TikTok: 0.08, Temu: 0, AliExpress: 0.08, Shopee: 0.12, Lazada: 0.1, Wish: 0.15 };
const revenue = 3 * 39.99;
const unitCost = 22.5 + 3 + 1;
const fr = +(ch.base_fee + ch.price_per_kg * 1.5).toFixed(2);
console.log('   订单', o.order_no, o.currency, '汇率', rate, '平台费', o.platform_fee, '尾程', o.freight_cost, 'COGS', o.cogs, '利润', o.profit_cny);
ok(near(o.freight_cost, fr), `尾程运费 = ${fr}`);
ok(o.cogs >= unitCost * 3 - 0.01, `COGS ≥ 3 × ${unitCost}`);
const expect = +((revenue - o.platform_fee - o.fba_fee - o.ad_cost) * rate - o.cogs - o.freight_cost - 5).toFixed(2);
ok(near(o.profit_cny, expect), `利润 = (收入-平台费-FBA费-广告)×汇率-成本-运费-其他 = ${expect}`);
const rc = await req('POST', '/finance/recalc');
ok(rc.count > 1000, '全部订单重算利润 ' + rc.count);
const rep = await req('GET', '/finance/profit?dim=sku');
const row = rep.find(r => r.name === 'TEST-' + tag);
ok(row && near(row.profit, o.profit_cny), 'SKU 利润报表包含新订单利润');
for (const d of ['store', 'site', 'platform', 'day']) ok((await req('GET', '/finance/profit?dim=' + d)).length > 0, `利润报表维度 ${d}`);

console.log('6. FBA：建货件 → 装箱 → 分摊 → 发货 → 签收 → 上架');
const amz = (await req('GET', '/r/stores?pageSize=50')).list.find(s => s.platform === 'Amazon');
await req('POST', '/r/mskus', { msku: 'FBA-TEST-' + tag, store_id: amz.id, sku_id: sku.id, fnsku: 'X00TEST' + tag, price: 29.99, status: '在售' });
const fs = await req('POST', '/fba', { plan_name: 'E2E测试货件', store_id: amz.id, from_wh: 1, provider_id: 1, channel: '海运', total_freight: 0, items: [{ sku_id: sku.id, qty: 40 }, { sku_id: 1, qty: 10 }] });
await req('PUT', `/fba/${fs.id}`, { remark: '编辑', items: [{ sku_id: sku.id, qty: 50 }, { sku_id: 1, qty: 10 }] });
await req('POST', `/fba/${fs.id}/boxes`, { boxes: [{ weight: 15, length: 50, width: 40, height: 40, contents: 'TEST×50' }, { weight: 6, length: 40, width: 30, height: 30, contents: 'SKU1×10' }] });
let fd = await req('GET', `/fba/${fs.id}/detail`);
ok(fd.status === '已装箱' && fd.boxes.length === 2 && fd.items.find(i => i.sku_id === sku.id).qty === 50, '编辑+装箱 → 已装箱');
await req('POST', `/fba/${fs.id}/allocate`, { total_freight: 1200, alloc_method: '按数量' });
fd = await req('GET', `/fba/${fs.id}/detail`);
ok(near(fd.items.reduce((a, i) => a + i.alloc_freight, 0), 1200) && near(fd.items.find(i => i.sku_id === sku.id).alloc_freight, 1000), '按数量分摊 1200：50/60 → 1000');
const toWh = fd.to_wh; const before = await inv(toWh, sku.id);
await req('POST', `/fba/${fs.id}/status`, { status: '已发货', tracking_no: 'TRK' + tag });
ok((await inv(1, sku.id)).qty_available === 65 && (await inv(toWh, sku.id)).qty_transit === before.qty_transit + 50, '发货：本地仓 115→65，FBA仓在途 +50');
let skip = false; try { await req('POST', `/fba/${fs.id}/status`, { status: '已上架' }); } catch { skip = true; }
ok(skip, '不允许跳过状态');
await req('POST', `/fba/${fs.id}/status`, { status: '运输中' });
await req('POST', `/fba/${fs.id}/events`, { event: '抵达洛杉矶港', location: 'LA' });
await req('POST', `/fba/${fs.id}/status`, { status: '已签收' });
await req('POST', `/fba/${fs.id}/status`, { status: '已上架' });
fd = await req('GET', `/fba/${fs.id}/detail`);
const after = await inv(toWh, sku.id);
ok(fd.status === '已上架' && after.qty_available === before.qty_available + 50 && after.qty_transit === before.qty_transit, 'FBA 上架：可用 +50、在途清零');
ok(fd.events.length >= 4, '物流轨迹 ' + fd.events.length + ' 条');

console.log('\n全部业务流程测试通过 ✅');
