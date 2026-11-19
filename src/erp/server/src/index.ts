import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, hashPwd } from './db.js';
import { RESOURCES } from './resources.js';
import { calcOrderProfit, adjustStock, allocateFreight, ensureInv, genNo, log, now, rateOf, skuUnitCost } from './logic.js';
import { seedAll } from './seed.js';

if (!(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE name='users'").get() as any).c || !(db.prepare('SELECT COUNT(*) c FROM users').get() as any).c) {
  console.log('数据库为空，写入示例数据...'); seedAll();
}

const app = express();
app.use(express.json({ limit: '5mb' }));
const PORT = Number(process.env.PORT || 8800);

const wrap = (fn: (req: Request, res: Response) => any) => (req: Request, res: Response) => {
  try { const r = fn(req, res); if (r !== undefined && !res.headersSent) res.json(r); }
  catch (e: any) { console.error(e); res.status(400).json({ message: e.message || String(e) }); }
};
const one = (sql: string, ...a: any[]) => db.prepare(sql).get(...a) as any;
const all = (sql: string, ...a: any[]) => db.prepare(sql).all(...a) as any[];
const run = (sql: string, ...a: any[]) => db.prepare(sql).run(...a);
const tx = <T,>(fn: () => T): T => db.transaction(fn)();

// ---------- 认证 ----------
app.post('/api/login', wrap((req, res) => {
  const { username, password } = req.body || {};
  const u = one('SELECT u.*, r.name role_name, r.permissions FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE username=?', username);
  if (!u || u.password_hash !== hashPwd(password || '')) { res.status(401).json({ message: '用户名或密码错误' }); return; }
  if (u.status !== '启用') { res.status(403).json({ message: '账号已停用' }); return; }
  const token = crypto.randomBytes(24).toString('hex');
  run('INSERT INTO sessions(token,user_id) VALUES(?,?)', token, u.id);
  run('UPDATE users SET last_login=? WHERE id=?', now(), u.id);
  log(u.username, '系统', '登录', '用户登录系统', req.ip);
  return { token, user: { id: u.id, username: u.username, name: u.name, role_name: u.role_name, permissions: JSON.parse(u.permissions || '[]') } };
}));

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const s = token && one('SELECT u.id, u.username, u.name, r.name role_name, r.permissions FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN roles r ON r.id=u.role_id WHERE s.token=?', token);
  if (!s) { res.status(401).json({ message: '未登录或登录已过期' }); return; }
  (req as any).user = { ...s, permissions: JSON.parse(s.permissions || '[]') };
  next();
});
const U = (req: Request) => (req as any).user.username as string;
app.get('/api/me', wrap(req => (req as any).user));
app.post('/api/logout', wrap(req => { run('DELETE FROM sessions WHERE token=?', (req.headers.authorization || '').replace('Bearer ', '')); return { ok: true }; }));

// ---------- 下拉选项 ----------
app.get('/api/options', wrap(() => ({
  stores: all('SELECT id, name, platform, site, currency FROM stores ORDER BY id'),
  warehouses: all('SELECT id, name, type, store_id FROM warehouses ORDER BY id'),
  suppliers: all('SELECT id, name, lead_days FROM suppliers ORDER BY id'),
  skus: all('SELECT id, sku, name, is_combo, purchase_cost, weight FROM skus ORDER BY id'),
  products: all('SELECT id, spu, name, category FROM products ORDER BY id'),
  channels: all('SELECT id, name, type, provider_id FROM logistics_channels WHERE enabled=1 ORDER BY id'),
  providers: all('SELECT id, name, type FROM logistics_providers ORDER BY id'),
  roles: all('SELECT id, name FROM roles ORDER BY id'),
  currencies: all('SELECT currency, name, rate_to_cny FROM exchange_rates ORDER BY id'),
  categories: all('SELECT DISTINCT category FROM products').map(r => r.category),
})));

// ---------- 仪表盘 ----------
app.get('/api/dashboard', wrap(req => {
  const days = Number(req.query.days || 30);
  const storeId = req.query.storeId ? Number(req.query.storeId) : null;
  const sf = storeId ? ' AND o.store_id=' + storeId : '';
  const since = new Date(); since.setDate(since.getDate() - days + 1); since.setHours(0, 0, 0, 0);
  const prev = new Date(since); prev.setDate(prev.getDate() - days);
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const kpi = (from: string, to: string) => one(`SELECT COUNT(*) orders, COALESCE(SUM(revenue_cny),0) sales, COALESCE(SUM(profit_cny),0) profit, COALESCE(SUM(ad_cost*fx_rate),0) ad, COALESCE(SUM((SELECT SUM(qty) FROM order_items i WHERE i.order_id=o.id)),0) units FROM orders o WHERE o.status!='已取消' AND date(o.order_time)>=? AND date(o.order_time)<?${sf}`, from, to);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const cur = kpi(f(since), f(tomorrow)), last = kpi(f(prev), f(since));
  const trend = all(`SELECT date(o.order_time) d, COUNT(*) orders, ROUND(SUM(revenue_cny),2) sales, ROUND(SUM(profit_cny),2) profit FROM orders o WHERE o.status!='已取消' AND date(o.order_time)>=?${sf} GROUP BY d ORDER BY d`, f(since));
  const byPlatform = all(`SELECT s.platform name, ROUND(SUM(revenue_cny),2) value, COUNT(*) orders FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.status!='已取消' AND date(o.order_time)>=?${sf} GROUP BY s.platform ORDER BY value DESC`, f(since));
  const bySite = all(`SELECT s.site name, ROUND(SUM(revenue_cny),2) value FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.status!='已取消' AND date(o.order_time)>=?${sf} GROUP BY s.site ORDER BY value DESC`, f(since));
  const byStore = all(`SELECT s.name, s.platform, s.site, COUNT(*) orders, ROUND(SUM(revenue_cny),2) sales, ROUND(SUM(profit_cny),2) profit, ROUND(SUM(ad_cost*fx_rate),2) ad FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.status!='已取消' AND date(o.order_time)>=?${sf} GROUP BY s.id ORDER BY sales DESC`, f(since));
  const topSku = all(`SELECT k.sku, k.name, SUM(i.qty) units, ROUND(SUM(i.qty*i.price*o.fx_rate),2) sales FROM order_items i JOIN orders o ON o.id=i.order_id JOIN skus k ON k.id=i.sku_id WHERE o.status!='已取消' AND date(o.order_time)>=?${sf} GROUP BY k.id ORDER BY sales DESC LIMIT 8`, f(since));
  const statusCount = all(`SELECT o.status, COUNT(*) c FROM orders o WHERE 1=1${sf} GROUP BY o.status`);
  const alerts = all(`SELECT k.sku, k.name, w.name warehouse, i.qty_available, k.safety_stock FROM inventory i JOIN skus k ON k.id=i.sku_id JOIN warehouses w ON w.id=i.warehouse_id WHERE i.qty_available < k.safety_stock AND w.type!='本地仓' ORDER BY (i.qty_available*1.0/k.safety_stock) ASC LIMIT 10`);
  const alertCount = one(`SELECT COUNT(*) c FROM inventory i JOIN skus k ON k.id=i.sku_id WHERE i.qty_available < k.safety_stock`).c;
  const todo = {
    pendingReview: one(`SELECT COUNT(*) c FROM orders o WHERE o.status='待审核'${sf}`).c,
    pendingShip: one(`SELECT COUNT(*) c FROM orders o WHERE o.status='待发货'${sf}`).c,
    abnormal: one(`SELECT COUNT(*) c FROM orders o WHERE o.status='异常'${sf}`).c,
    afterSales: one(`SELECT COUNT(*) c FROM after_sales a JOIN orders o ON o.id=a.order_id WHERE a.status IN ('待处理','处理中')${sf}`).c,
    poPending: one(`SELECT COUNT(*) c FROM purchase_orders WHERE status IN ('草稿','待审核')`).c,
    fbaTransit: one(`SELECT COUNT(*) c FROM fba_shipments WHERE status IN ('已发货','运输中')`).c,
    unpaired: one(`SELECT COUNT(*) c FROM mskus WHERE sku_id IS NULL`).c,
    authExpired: one(`SELECT COUNT(*) c FROM stores WHERE auth_status!='已授权'`).c,
  };
  const adSf = storeId ? ' AND a.store_id=' + storeId : '';
  const adTrend = all(`SELECT a.date d, ROUND(SUM(a.spend*r.rate_to_cny),2) spend, ROUND(SUM(a.sales*r.rate_to_cny),2) sales FROM ad_daily a JOIN stores s ON s.id=a.store_id JOIN exchange_rates r ON r.currency=s.currency WHERE a.date>=?${adSf} GROUP BY a.date ORDER BY a.date`, f(since));
  return { cur, last, trend, byPlatform, bySite, byStore, topSku, statusCount, alerts, alertCount, todo, adTrend };
}));

// ---------- 商品：SKU 详情/保存（含组合SKU） ----------
app.get('/api/skus/:id/detail', wrap(req => {
  const id = Number(req.params.id);
  const sku = one('SELECT t.*, p.spu, p.name product_name, sp.name supplier_name FROM skus t LEFT JOIN products p ON p.id=t.product_id LEFT JOIN suppliers sp ON sp.id=t.supplier_id WHERE t.id=?', id);
  if (!sku) throw new Error('SKU不存在');
  return {
    ...sku, unit: skuUnitCost(id),
    combo_items: all('SELECT c.*, s.sku, s.name FROM combo_items c JOIN skus s ON s.id=c.sku_id WHERE combo_sku_id=?', id),
    mskus: all('SELECT m.*, st.name store_name, st.platform, st.site FROM mskus m JOIN stores st ON st.id=m.store_id WHERE sku_id=?', id),
    inventory: all('SELECT i.*, w.name warehouse_name, w.type FROM inventory i JOIN warehouses w ON w.id=i.warehouse_id WHERE sku_id=?', id),
    sales30: one("SELECT COALESCE(SUM(i.qty),0) units FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.sku_id=? AND o.status!='已取消' AND o.order_time>=datetime('now','-30 day','localtime')", id).units,
  };
}));
function saveCombo(id: number, items: any[] | undefined) {
  if (!items) return;
  run('DELETE FROM combo_items WHERE combo_sku_id=?', id);
  for (const it of items) if (it.sku_id) run('INSERT INTO combo_items(combo_sku_id,sku_id,qty) VALUES(?,?,?)', id, it.sku_id, it.qty || 1);
}

// ---------- 订单 ----------
app.get('/api/orders/:id/detail', wrap(req => {
  const id = Number(req.params.id);
  const o = one('SELECT t.*, st.name store_name, st.platform, st.site, w.name warehouse_name, c.name channel_name FROM orders t LEFT JOIN stores st ON st.id=t.store_id LEFT JOIN warehouses w ON w.id=t.warehouse_id LEFT JOIN logistics_channels c ON c.id=t.channel_id WHERE t.id=?', id);
  if (!o) throw new Error('订单不存在');
  return { ...o, items: all('SELECT i.*, s.sku, s.name sku_name, s.weight FROM order_items i LEFT JOIN skus s ON s.id=i.sku_id WHERE order_id=?', id), profit: calcOrderProfit(id), after_sales: all('SELECT * FROM after_sales WHERE order_id=?', id), children: all('SELECT id, order_no, status FROM orders WHERE parent_id=? OR merged_into=?', id, id) };
}));
function saveOrderItems(orderId: number, storeId: number, items: any[]) {
  run('DELETE FROM order_items WHERE order_id=?', orderId);
  for (const it of items) {
    const m = it.msku ? one('SELECT * FROM mskus WHERE msku=? AND store_id=?', it.msku, storeId) : null;
    const skuId = it.sku_id || m?.sku_id;
    if (!skuId) throw new Error('订单明细需要选择SKU');
    const sk = one('SELECT sku FROM skus WHERE id=?', skuId);
    run('INSERT INTO order_items(order_id,msku,sku_id,qty,price) VALUES(?,?,?,?,?)', orderId, it.msku || m?.msku || sk.sku, skuId, it.qty || 1, it.price || 0);
  }
}
app.post('/api/orders', wrap(req => tx(() => {
  const b = req.body; const st = one('SELECT * FROM stores WHERE id=?', b.store_id); if (!st) throw new Error('请选择店铺');
  const no = genNo('SO');
  const id = db.prepare(`INSERT INTO orders(order_no,platform_order_no,store_id,status,fulfillment,buyer_name,country,address,currency,shipping_income,ad_cost,other_cost,warehouse_id,channel_id,remark,order_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(no, b.platform_order_no || no, b.store_id, '待审核', b.fulfillment || 'FBM', b.buyer_name, b.country, b.address, st.currency, b.shipping_income || 0, b.ad_cost || 0, b.other_cost || 0, b.warehouse_id || null, b.channel_id || null, b.remark || null, now()).lastInsertRowid as number;
  saveOrderItems(id, b.store_id, b.items || []);
  calcOrderProfit(id); log(U(req), '订单管理', '手工建单', no);
  return { id, order_no: no };
})));
app.put('/api/orders/:id', wrap(req => tx(() => {
  const id = Number(req.params.id); const b = req.body; const o = one('SELECT * FROM orders WHERE id=?', id);
  const cols = RESOURCES.orders.writable.filter(c => c in b);
  if (cols.length) run(`UPDATE orders SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, ...cols.map(c => b[c] === '' ? null : b[c]), id);
  if (b.items) { if (!['待审核', '待发货', '异常'].includes(o.status)) throw new Error('已发货订单不可修改商品明细'); saveOrderItems(id, o.store_id, b.items); }
  log(U(req), '订单管理', '编辑订单', o.order_no);
  return calcOrderProfit(id);
})));
app.post('/api/orders/audit', wrap(req => tx(() => {
  const ids: number[] = req.body.ids || []; let ok = 0; const fail: string[] = [];
  for (const id of ids) {
    const o = one('SELECT * FROM orders WHERE id=?', id);
    if (!o || !['待审核', '异常'].includes(o.status)) { fail.push(o?.order_no || String(id)); continue; }
    run("UPDATE orders SET status='待发货', flag=NULL WHERE id=?", id); ok++;
  }
  log(U(req), '订单管理', '审核订单', `审核通过 ${ok} 个订单`);
  return { ok, fail };
})));
app.post('/api/orders/auto-audit', wrap(req => tx(() => {
  const list = all("SELECT * FROM orders WHERE status='待审核'");
  let passed = 0, held = 0, abnormal = 0;
  for (const o of list) {
    const usd = (o.total_amount * o.fx_rate) / rateOf('USD');
    const maxQty = one('SELECT MAX(qty) m FROM order_items WHERE order_id=?', o.id).m || 0;
    const unpaired = one('SELECT COUNT(*) c FROM order_items WHERE order_id=? AND sku_id IS NULL', o.id).c;
    if (/po box/i.test(o.address || '') || unpaired) { run("UPDATE orders SET status='异常', flag=? WHERE id=?", unpaired ? 'SKU未配对' : '地址异常', o.id); abnormal++; }
    else if (usd > 300 || maxQty > 10) { run("UPDATE orders SET flag=? WHERE id=?", usd > 300 ? '大额订单待人工审核' : '数量异常待人工审核', o.id); held++; }
    else { run("UPDATE orders SET status='待发货', flag=NULL WHERE id=?", o.id); passed++; }
  }
  run('UPDATE review_rules SET hits=hits+1 WHERE enabled=1');
  log(U(req), '订单管理', '自动审单', `通过 ${passed}，人工 ${held}，异常 ${abnormal}`);
  return { total: list.length, passed, held, abnormal };
})));
app.post('/api/orders/match-logistics', wrap(req => tx(() => {
  const ids: number[] = req.body.ids || [];
  const rules = all('SELECT * FROM shipping_rules WHERE enabled=1 ORDER BY priority');
  const result: any[] = [];
  for (const id of ids) {
    const o = one('SELECT o.*, s.platform FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=?', id);
    if (!o || o.fulfillment === 'FBA') continue;
    const w = one('SELECT COALESCE(SUM(i.qty*k.weight),0) w FROM order_items i JOIN skus k ON k.id=i.sku_id WHERE order_id=?', id).w;
    const r = rules.find(r => (!r.platform || r.platform === o.platform) && (!r.country || r.country === o.country) && (!r.max_weight || w <= r.max_weight));
    if (r) { run('UPDATE orders SET warehouse_id=?, channel_id=? WHERE id=?', r.warehouse_id, r.channel_id, id); calcOrderProfit(id); result.push({ order_no: o.order_no, rule: r.name }); }
  }
  log(U(req), '订单管理', '匹配物流', `匹配 ${result.length} 个订单`);
  return { matched: result.length, result };
})));
app.post('/api/orders/assign', wrap(req => tx(() => {
  const { ids, warehouse_id, channel_id } = req.body;
  for (const id of ids) { run('UPDATE orders SET warehouse_id=COALESCE(?,warehouse_id), channel_id=COALESCE(?,channel_id) WHERE id=?', warehouse_id || null, channel_id || null, id); calcOrderProfit(id); }
  log(U(req), '订单管理', '分配仓库物流', `${ids.length} 个订单`);
  return { ok: ids.length };
})));
app.post('/api/orders/ship', wrap(req => tx(() => {
  const ids: number[] = req.body.ids || []; let ok = 0; const fail: string[] = [];
  for (const id of ids) {
    const o = one('SELECT * FROM orders WHERE id=?', id);
    if (o.status !== '待发货') { fail.push(`${o.order_no}: 状态为${o.status}`); continue; }
    if (o.fulfillment !== 'FBA' && (!o.warehouse_id || !o.channel_id)) { fail.push(`${o.order_no}: 未分配仓库/物流`); continue; }
    try {
      for (const it of all('SELECT * FROM order_items WHERE order_id=?', id)) {
        const sk = one('SELECT * FROM skus WHERE id=?', it.sku_id);
        const parts = sk.is_combo ? all('SELECT sku_id, qty FROM combo_items WHERE combo_sku_id=?', sk.id).map(c => ({ sku_id: c.sku_id, qty: c.qty * it.qty })) : [{ sku_id: it.sku_id, qty: it.qty }];
        for (const p of parts) adjustStock(o.warehouse_id, p.sku_id, -p.qty, '销售出库', o.order_no, '订单发货', U(req));
      }
      const ch = one('SELECT code FROM logistics_channels WHERE id=?', o.channel_id);
      const tn = o.tracking_no || (o.fulfillment === 'FBA' ? null : (ch?.code?.split('-')[0] || 'TN') + Math.floor(Math.random() * 9e9 + 1e9));
      run("UPDATE orders SET status='已发货', tracking_no=?, ship_time=? WHERE id=?", tn, now(), id); ok++;
    } catch (e: any) { throw new Error(`${o.order_no}: ${e.message}`); }
  }
  log(U(req), '订单管理', '订单发货', `发货 ${ok} 个订单`);
  return { ok, fail };
})));
app.post('/api/orders/cancel', wrap(req => tx(() => {
  for (const id of req.body.ids) { run("UPDATE orders SET status='已取消' WHERE id=? AND status IN ('待审核','待发货','异常')", id); calcOrderProfit(id); }
  log(U(req), '订单管理', '取消订单', `${req.body.ids.length} 个订单`); return { ok: true };
})));
app.post('/api/orders/:id/split', wrap(req => tx(() => {
  const id = Number(req.params.id); const o = one('SELECT * FROM orders WHERE id=?', id);
  if (!['待审核', '待发货', '异常'].includes(o.status)) throw new Error('仅未发货订单可拆分');
  const items = all('SELECT * FROM order_items WHERE order_id=?', id);
  const moves: { item_id: number; qty: number }[] = (req.body.items || []).filter((m: any) => m.qty > 0);
  if (!moves.length) throw new Error('请选择需要拆出的商品数量');
  const totalLeft = items.reduce((a, i) => a + i.qty, 0) - moves.reduce((a, m) => a + m.qty, 0);
  if (totalLeft <= 0) throw new Error('拆分后原订单不能为空');
  const no = o.order_no + '-' + (one('SELECT COUNT(*) c FROM orders WHERE parent_id=?', id).c + 1);
  const cols = Object.keys(o).filter(k => !['id', 'order_no', 'parent_id', 'created_at'].includes(k));
  const nid = run(`INSERT INTO orders(${cols.join(',')}, order_no, parent_id) VALUES(${cols.map(() => '?').join(',')},?,?)`, ...cols.map(c => c === 'ad_cost' || c === 'shipping_income' ? 0 : o[c]), no, id).lastInsertRowid as number;
  for (const m of moves) {
    const it = items.find(i => i.id === m.item_id); if (!it || m.qty > it.qty) throw new Error('拆分数量超出');
    run('INSERT INTO order_items(order_id,msku,sku_id,qty,price) VALUES(?,?,?,?,?)', nid, it.msku, it.sku_id, m.qty, it.price);
    if (m.qty === it.qty) run('DELETE FROM order_items WHERE id=?', it.id); else run('UPDATE order_items SET qty=qty-? WHERE id=?', m.qty, it.id);
  }
  calcOrderProfit(id); calcOrderProfit(nid);
  log(U(req), '订单管理', '拆分订单', `${o.order_no} → ${no}`);
  return { id: nid, order_no: no };
})));
app.post('/api/orders/merge', wrap(req => tx(() => {
  const ids: number[] = req.body.ids || []; if (ids.length < 2) throw new Error('请至少选择2个订单');
  const os = ids.map(id => one('SELECT * FROM orders WHERE id=?', id));
  if (new Set(os.map(o => o.store_id)).size > 1) throw new Error('仅同一店铺订单可合并');
  if (new Set(os.map(o => o.buyer_name + '|' + o.country)).size > 1) throw new Error('仅同一买家、同一收货国家的订单可合并');
  if (os.some(o => !['待审核', '待发货', '异常'].includes(o.status) || o.fulfillment === 'FBA')) throw new Error('仅未发货的自发货订单可合并');
  const main = os[0];
  for (const o of os.slice(1)) {
    run('UPDATE order_items SET order_id=? WHERE order_id=?', main.id, o.id);
    run("UPDATE orders SET status='已取消', merged_into=?, remark=? WHERE id=?", main.id, '已合并至 ' + main.order_no, o.id);
    run('UPDATE orders SET ad_cost=ad_cost+?, shipping_income=shipping_income+? WHERE id=?', o.ad_cost, o.shipping_income, main.id);
    calcOrderProfit(o.id);
  }
  run("UPDATE orders SET remark=? WHERE id=?", '合并订单: ' + os.map(o => o.order_no).join(', '), main.id);
  calcOrderProfit(main.id); log(U(req), '订单管理', '合并订单', os.map(o => o.order_no).join(' + '));
  return { id: main.id, order_no: main.order_no };
})));
app.post('/api/after-sales/:id/process', wrap(req => tx(() => {
  const id = Number(req.params.id); const a = one('SELECT * FROM after_sales WHERE id=?', id);
  const { status, restock, remark } = req.body;
  run('UPDATE after_sales SET status=?, restock=?, remark=COALESCE(?,remark) WHERE id=?', status, restock ? 1 : 0, remark || null, id);
  if (status === '已完成' && restock && !a.restock) {
    const o = one('SELECT * FROM orders WHERE id=?', a.order_id);
    for (const it of all('SELECT * FROM order_items WHERE order_id=?', a.order_id)) adjustStock(o.warehouse_id || 1, it.sku_id, it.qty, '退货入库', a.as_no, '售后退货入库', U(req));
  }
  if (status === '已完成' && ['退货退款', '仅退款'].includes(a.type)) {
    run('UPDATE orders SET other_cost=other_cost+? WHERE id=?', +(a.amount * rateOf(a.currency)).toFixed(2), a.order_id); calcOrderProfit(a.order_id);
  }
  log(U(req), '订单管理', '处理售后', `${a.as_no} → ${status}`);
  return { ok: true };
})));

// ---------- 采购 ----------
app.get('/api/purchase/suggestions', wrap(req => {
  const days = Number(req.query.days || 30), target = Number(req.query.target || 45);
  const rows = all(`SELECT k.id sku_id, k.sku, k.name, k.safety_stock, k.purchase_cost, k.supplier_id, s.name supplier_name, COALESCE(s.lead_days,10) lead_days,
    COALESCE((SELECT SUM(i.qty) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.sku_id=k.id AND o.status!='已取消' AND o.order_time>=datetime('now','-${days} day','localtime')),0) sold,
    COALESCE((SELECT SUM(qty_available) FROM inventory WHERE sku_id=k.id),0) stock,
    COALESCE((SELECT SUM(qty_transit) FROM inventory WHERE sku_id=k.id),0) transit,
    COALESCE((SELECT SUM(pi.qty-pi.received_qty) FROM purchase_order_items pi JOIN purchase_orders p ON p.id=pi.po_id WHERE pi.sku_id=k.id AND p.status IN ('草稿','待审核','已下单','部分到货')),0) on_order
    FROM skus k LEFT JOIN suppliers s ON s.id=k.supplier_id WHERE k.is_combo=0 AND k.status='在售'`);
  return rows.map(r => {
    const velocity = +(r.sold / days).toFixed(2);
    const avail = r.stock + r.transit + r.on_order;
    const cover = velocity > 0 ? Math.round(avail / velocity) : 999;
    const need = Math.ceil(velocity * (r.lead_days + target) + r.safety_stock - avail);
    const suggest = need > 0 ? Math.ceil(need / 10) * 10 : 0;
    return { ...r, velocity, cover_days: cover, suggest_qty: suggest, amount: +(suggest * r.purchase_cost).toFixed(2), level: cover < r.lead_days ? '紧急' : suggest > 0 ? '建议补货' : '充足' };
  }).sort((a, b) => b.suggest_qty - a.suggest_qty);
}));
app.post('/api/purchase/plan-to-po', wrap(req => tx(() => {
  const items: { sku_id: number; qty: number }[] = req.body.items || [];
  const groups: Record<number, any[]> = {};
  for (const it of items) { const k = one('SELECT * FROM skus WHERE id=?', it.sku_id); (groups[k.supplier_id || 0] ||= []).push({ ...it, price: k.purchase_cost }); }
  const created: string[] = [];
  for (const [sup, its] of Object.entries(groups)) {
    const no = genNo('PO');
    const total = its.reduce((a, i) => a + i.qty * i.price, 0);
    const pid = run("INSERT INTO purchase_orders(po_no,supplier_id,warehouse_id,status,total_amount,buyer,expected_date,remark,created_at) VALUES(?,?,?,?,?,?,date('now','+10 day'),?,?)", no, Number(sup) || null, req.body.warehouse_id || 1, '待审核', +total.toFixed(2), U(req), '由采购计划生成', now()).lastInsertRowid;
    for (const i of its) run('INSERT INTO purchase_order_items(po_id,sku_id,qty,unit_price) VALUES(?,?,?,?)', pid, i.sku_id, i.qty, i.price);
    created.push(no);
  }
  log(U(req), '采购管理', '采购计划生成采购单', created.join(', '));
  return { created };
})));
app.get('/api/purchase-orders/:id/detail', wrap(req => {
  const id = Number(req.params.id);
  const po = one('SELECT t.*, s.name supplier_name, w.name warehouse_name FROM purchase_orders t LEFT JOIN suppliers s ON s.id=t.supplier_id LEFT JOIN warehouses w ON w.id=t.warehouse_id WHERE t.id=?', id);
  if (!po) throw new Error('采购单不存在');
  return { ...po, items: all('SELECT i.*, k.sku, k.name sku_name FROM purchase_order_items i JOIN skus k ON k.id=i.sku_id WHERE po_id=?', id), receipts: all('SELECT r.*, k.sku FROM receipts r JOIN skus k ON k.id=r.sku_id WHERE po_id=? ORDER BY r.id DESC', id) };
}));
function savePoItems(id: number, items: any[]) {
  run('DELETE FROM purchase_order_items WHERE po_id=?', id);
  let total = 0;
  for (const i of items) { if (!i.sku_id) continue; run('INSERT INTO purchase_order_items(po_id,sku_id,qty,unit_price,received_qty) VALUES(?,?,?,?,?)', id, i.sku_id, i.qty, i.unit_price, i.received_qty || 0); total += i.qty * i.unit_price; }
  run('UPDATE purchase_orders SET total_amount=? WHERE id=?', +total.toFixed(2), id);
}
app.post('/api/purchase-orders', wrap(req => tx(() => {
  const b = req.body; const no = genNo('PO');
  const id = run('INSERT INTO purchase_orders(po_no,supplier_id,warehouse_id,status,freight,buyer,expected_date,remark,created_at) VALUES(?,?,?,?,?,?,?,?,?)', no, b.supplier_id, b.warehouse_id, '草稿', b.freight || 0, b.buyer || U(req), b.expected_date || null, b.remark || null, now()).lastInsertRowid as number;
  savePoItems(id, b.items || []); log(U(req), '采购管理', '创建采购单', no);
  return { id, po_no: no };
})));
app.put('/api/purchase-orders/:id', wrap(req => tx(() => {
  const id = Number(req.params.id); const b = req.body; const po = one('SELECT * FROM purchase_orders WHERE id=?', id);
  const cols = RESOURCES.purchase_orders.writable.filter(c => c in b);
  if (cols.length) run(`UPDATE purchase_orders SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, ...cols.map(c => b[c]), id);
  if (b.items) { if (!['草稿', '待审核'].includes(po.status)) throw new Error('已下单的采购单不可修改明细'); savePoItems(id, b.items); }
  log(U(req), '采购管理', '编辑采购单', po.po_no); return { ok: true };
})));
app.post('/api/purchase-orders/:id/status', wrap(req => {
  const id = Number(req.params.id); const po = one('SELECT * FROM purchase_orders WHERE id=?', id); const { status } = req.body;
  const flow: Record<string, string[]> = { '待审核': ['草稿'], '已下单': ['待审核'], '已取消': ['草稿', '待审核', '已下单'], '草稿': ['待审核'] };
  if (!flow[status]?.includes(po.status)) throw new Error(`当前状态「${po.status}」不能变更为「${status}」`);
  run('UPDATE purchase_orders SET status=? WHERE id=?', status, id); log(U(req), '采购管理', '采购单状态', `${po.po_no} → ${status}`);
  return { ok: true };
}));
app.post('/api/purchase-orders/:id/receive', wrap(req => tx(() => {
  const id = Number(req.params.id); const po = one('SELECT * FROM purchase_orders WHERE id=?', id);
  if (!['已下单', '部分到货'].includes(po.status)) throw new Error('仅已下单/部分到货的采购单可收货');
  for (const r of (req.body.items || []).filter((x: any) => x.qty > 0)) {
    const it = one('SELECT * FROM purchase_order_items WHERE id=? AND po_id=?', r.item_id, id);
    if (r.qty > it.qty - it.received_qty) throw new Error('收货数量超出未到货数量');
    run('UPDATE purchase_order_items SET received_qty=received_qty+? WHERE id=?', r.qty, it.id);
    const rc = genNo('RC');
    run('INSERT INTO receipts(rc_no,po_id,sku_id,qty,qc_status,warehouse_id,operator,created_at) VALUES(?,?,?,?,?,?,?,?)', rc, id, it.sku_id, r.qty, r.qc_status || '合格', po.warehouse_id, U(req), now());
    adjustStock(po.warehouse_id, it.sku_id, r.qty, '采购入库', po.po_no, '采购收货 ' + rc, U(req));
  }
  const left = one('SELECT SUM(qty-received_qty) l FROM purchase_order_items WHERE po_id=?', id).l;
  run('UPDATE purchase_orders SET status=? WHERE id=?', left > 0 ? '部分到货' : '已完成', id);
  log(U(req), '采购管理', '采购收货', po.po_no); return { ok: true, left };
})));

// ---------- 仓储 ----------
app.post('/api/stock-moves', wrap(req => tx(() => {
  const { type, from_wh, to_wh, sku_id, qty, remark } = req.body; const q = Number(qty);
  if (!sku_id || !(q > 0)) throw new Error('请选择SKU并填写数量');
  const prefix = type === '调拨' ? 'TF' : type === '入库' ? 'IN' : 'OUT';
  const no = genNo(prefix);
  let status = '已完成';
  if (type === '入库') adjustStock(to_wh, sku_id, q, '其他入库', no, remark, U(req));
  else if (type === '出库') adjustStock(from_wh, sku_id, -q, '其他出库', no, remark, U(req));
  else if (type === '调拨') {
    if (!from_wh || !to_wh || from_wh === to_wh) throw new Error('请选择不同的调出/调入仓库');
    adjustStock(from_wh, sku_id, -q, '调拨出库', no, remark, U(req));
    ensureInv(to_wh, sku_id); run('UPDATE inventory SET qty_transit=qty_transit+? WHERE warehouse_id=? AND sku_id=?', q, to_wh, sku_id);
    status = '在途';
  } else throw new Error('未知类型');
  const id = run('INSERT INTO stock_moves(move_no,type,from_wh,to_wh,sku_id,qty,status,remark,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', no, type, from_wh || null, to_wh || null, sku_id, q, status, remark || null, U(req), now()).lastInsertRowid;
  log(U(req), '仓储库存', type + '单', `${no} 数量 ${q}`);
  return { id, move_no: no };
})));
app.post('/api/stock-moves/:id/receive', wrap(req => tx(() => {
  const m = one('SELECT * FROM stock_moves WHERE id=?', Number(req.params.id));
  if (m.status !== '在途') throw new Error('该单据不是在途状态');
  ensureInv(m.to_wh, m.sku_id);
  run('UPDATE inventory SET qty_transit=MAX(qty_transit-?,0) WHERE warehouse_id=? AND sku_id=?', m.qty, m.to_wh, m.sku_id);
  adjustStock(m.to_wh, m.sku_id, m.qty, '调拨入库', m.move_no, '调拨到货', U(req));
  run("UPDATE stock_moves SET status='已完成' WHERE id=?", m.id); log(U(req), '仓储库存', '调拨到货', m.move_no);
  return { ok: true };
})));
app.post('/api/stocktakes', wrap(req => {
  const { warehouse_id, sku_id, actual_qty } = req.body; const inv = ensureInv(warehouse_id, sku_id);
  const no = genNo('ST');
  const id = run('INSERT INTO stocktakes(st_no,warehouse_id,sku_id,book_qty,actual_qty,diff,status,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?)', no, warehouse_id, sku_id, inv.qty_available, actual_qty, actual_qty - inv.qty_available, '待确认', U(req), now()).lastInsertRowid;
  log(U(req), '仓储库存', '创建盘点单', no); return { id, st_no: no };
}));
app.post('/api/stocktakes/:id/confirm', wrap(req => tx(() => {
  const s = one('SELECT * FROM stocktakes WHERE id=?', Number(req.params.id));
  if (s.status !== '待确认') throw new Error('盘点单已确认');
  const inv = ensureInv(s.warehouse_id, s.sku_id); const diff = s.actual_qty - inv.qty_available;
  if (diff) adjustStock(s.warehouse_id, s.sku_id, diff, diff > 0 ? '盘盈' : '盘亏', s.st_no, '盘点调整', U(req));
  run("UPDATE stocktakes SET status='已确认', book_qty=?, diff=? WHERE id=?", inv.qty_available, diff, s.id);
  log(U(req), '仓储库存', '确认盘点', s.st_no); return { ok: true, diff };
})));

// ---------- FBA 货件 ----------
app.get('/api/fba/:id/detail', wrap(req => {
  const id = Number(req.params.id);
  const sh = one(`SELECT ${RESOURCES.fba_shipments.select} FROM ${RESOURCES.fba_shipments.from} WHERE t.id=?`, id);
  if (!sh) throw new Error('货件不存在');
  return { ...sh, items: all('SELECT i.*, k.sku, k.name sku_name, k.weight FROM fba_shipment_items i JOIN skus k ON k.id=i.sku_id WHERE shipment_id=?', id), boxes: all('SELECT * FROM fba_boxes WHERE shipment_id=? ORDER BY box_no', id), events: all("SELECT * FROM tracking_events WHERE ref_type='fba' AND ref_id=? ORDER BY time DESC", id) };
}));
function saveFbaItems(id: number, storeId: number, items: any[]) {
  run('DELETE FROM fba_shipment_items WHERE shipment_id=?', id);
  for (const i of items) {
    if (!i.sku_id) continue;
    const m = one('SELECT * FROM mskus WHERE sku_id=? AND store_id=?', i.sku_id, storeId);
    run('INSERT INTO fba_shipment_items(shipment_id,sku_id,msku,fnsku,qty,received_qty) VALUES(?,?,?,?,?,?)', id, i.sku_id, i.msku || m?.msku || null, m?.fnsku || null, i.qty, i.received_qty || 0);
  }
}
app.post('/api/fba', wrap(req => tx(() => {
  const b = req.body; const no = genNo('FS');
  const toWh = b.to_wh || one('SELECT id FROM warehouses WHERE store_id=? AND type=?', b.store_id, 'FBA仓')?.id;
  const id = run('INSERT INTO fba_shipments(shipment_no,fba_shipment_id,plan_name,store_id,from_wh,to_wh,status,provider_id,channel,total_freight,alloc_method,eta,remark,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', no, b.fba_shipment_id || null, b.plan_name, b.store_id, b.from_wh, toWh, '计划中', b.provider_id || null, b.channel || null, b.total_freight || 0, b.alloc_method || '按重量', b.eta || null, b.remark || null, now()).lastInsertRowid as number;
  saveFbaItems(id, b.store_id, b.items || []); allocateFreight(id);
  log(U(req), 'FBA与头程', '创建货件', no); return { id, shipment_no: no };
})));
app.put('/api/fba/:id', wrap(req => tx(() => {
  const id = Number(req.params.id); const b = req.body; const sh = one('SELECT * FROM fba_shipments WHERE id=?', id);
  const cols = RESOURCES.fba_shipments.writable.filter(c => c in b);
  if (cols.length) run(`UPDATE fba_shipments SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, ...cols.map(c => b[c] === '' ? null : b[c]), id);
  if (b.items) { if (!['计划中', '已装箱'].includes(sh.status)) throw new Error('已发货货件不可修改明细'); saveFbaItems(id, b.store_id || sh.store_id, b.items); }
  allocateFreight(id); log(U(req), 'FBA与头程', '编辑货件', sh.shipment_no); return { ok: true };
})));
app.post('/api/fba/:id/boxes', wrap(req => tx(() => {
  const id = Number(req.params.id); run('DELETE FROM fba_boxes WHERE shipment_id=?', id);
  (req.body.boxes || []).forEach((b: any, i: number) => run('INSERT INTO fba_boxes(shipment_id,box_no,weight,length,width,height,contents) VALUES(?,?,?,?,?,?,?)', id, b.box_no || 'U' + String(i + 1).padStart(3, '0'), b.weight, b.length, b.width, b.height, b.contents || ''));
  const sh = one('SELECT * FROM fba_shipments WHERE id=?', id);
  if (sh.status === '计划中' && req.body.boxes?.length) run("UPDATE fba_shipments SET status='已装箱' WHERE id=?", id);
  log(U(req), 'FBA与头程', '装箱', `${sh.shipment_no} 共 ${req.body.boxes?.length || 0} 箱`); return { ok: true };
})));
app.post('/api/fba/:id/allocate', wrap(req => {
  const id = Number(req.params.id);
  if (req.body.total_freight != null) run('UPDATE fba_shipments SET total_freight=?, alloc_method=COALESCE(?,alloc_method) WHERE id=?', req.body.total_freight, req.body.alloc_method || null, id);
  const r = allocateFreight(id); log(U(req), 'FBA与头程', '头程费用分摊', `货件 ${id}`); return r;
}));
const FBA_FLOW = ['计划中', '已装箱', '已发货', '运输中', '已签收', '已上架'];
app.post('/api/fba/:id/status', wrap(req => tx(() => {
  const id = Number(req.params.id); const sh = one('SELECT * FROM fba_shipments WHERE id=?', id); const { status, tracking_no } = req.body;
  if (FBA_FLOW.indexOf(status) !== FBA_FLOW.indexOf(sh.status) + 1 && status !== '已取消') throw new Error(`当前状态「${sh.status}」的下一步应为「${FBA_FLOW[FBA_FLOW.indexOf(sh.status) + 1]}」`);
  const items = all('SELECT * FROM fba_shipment_items WHERE shipment_id=?', id);
  if (status === '已发货') {
    if (!items.length) throw new Error('货件没有商品明细');
    for (const i of items) { adjustStock(sh.from_wh, i.sku_id, -i.qty, '调拨出库', sh.shipment_no, 'FBA头程发货', U(req)); ensureInv(sh.to_wh, i.sku_id); run('UPDATE inventory SET qty_transit=qty_transit+? WHERE warehouse_id=? AND sku_id=?', i.qty, sh.to_wh, i.sku_id); }
    run('UPDATE fba_shipments SET tracking_no=COALESCE(?,tracking_no), ship_date=date(\'now\',\'localtime\') WHERE id=?', tracking_no || null, id);
    run('INSERT INTO tracking_events(ref_type,ref_id,event,location,time) VALUES(?,?,?,?,?)', 'fba', id, '货物已从国内仓提货发出', '深圳', now());
  }
  if (status === '运输中') run('INSERT INTO tracking_events(ref_type,ref_id,event,location,time) VALUES(?,?,?,?,?)', 'fba', id, '已离港，运输途中', '盐田港', now());
  if (status === '已签收') { for (const i of items) run('UPDATE fba_shipment_items SET received_qty=qty WHERE id=?', i.id); run('INSERT INTO tracking_events(ref_type,ref_id,event,location,time) VALUES(?,?,?,?,?)', 'fba', id, '亚马逊仓库已签收', 'FBA', now()); }
  if (status === '已上架') {
    for (const i of all('SELECT * FROM fba_shipment_items WHERE shipment_id=?', id)) { run('UPDATE inventory SET qty_transit=MAX(qty_transit-?,0) WHERE warehouse_id=? AND sku_id=?', i.qty, sh.to_wh, i.sku_id); adjustStock(sh.to_wh, i.sku_id, i.received_qty || i.qty, '调拨入库', sh.shipment_no, 'FBA上架', U(req)); }
  }
  run('UPDATE fba_shipments SET status=? WHERE id=?', status, id);
  log(U(req), 'FBA与头程', '货件状态', `${sh.shipment_no} → ${status}`); return { ok: true };
})));
app.post('/api/fba/:id/events', wrap(req => { run('INSERT INTO tracking_events(ref_type,ref_id,event,location,time) VALUES(?,?,?,?,?)', 'fba', Number(req.params.id), req.body.event, req.body.location, req.body.time || now()); return { ok: true }; }));

// ---------- 财务 ----------
app.get('/api/finance/profit', wrap(req => {
  const dim = String(req.query.dim || 'sku');
  const where = ["o.status!='已取消'"]; const args: any[] = [];
  if (req.query.dateFrom) { where.push('date(o.order_time)>=?'); args.push(req.query.dateFrom); }
  if (req.query.dateTo) { where.push('date(o.order_time)<=?'); args.push(req.query.dateTo); }
  if (req.query.storeId) { where.push('o.store_id=?'); args.push(Number(req.query.storeId)); }
  const W = where.join(' AND ');
  if (dim === 'sku') {
    // 订单级费用按商品金额占比分摊到SKU
    return all(`SELECT k.id key, k.sku name, k.name sub, SUM(i.qty) units, COUNT(DISTINCT o.id) orders,
      ROUND(SUM(o.revenue_cny * r.share),2) revenue, ROUND(SUM(o.platform_fee*o.fx_rate*r.share),2) platform_fee, ROUND(SUM(o.fba_fee*o.fx_rate*r.share),2) fba_fee,
      ROUND(SUM(o.ad_cost*o.fx_rate*r.share),2) ad_cost, ROUND(SUM(o.cogs*r.cshare),2) cogs, ROUND(SUM(o.freight_cost*r.share),2) freight, ROUND(SUM(o.other_cost*r.share),2) other, ROUND(SUM(o.profit_cny*r.share),2) profit
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN skus k ON k.id=i.sku_id
      JOIN (SELECT i2.id iid, CASE WHEN SUM(i3.qty*i3.price)>0 THEN i2.qty*i2.price*1.0/SUM(i3.qty*i3.price) ELSE 1.0/COUNT(i3.id) END share, 1.0 * 0 + CASE WHEN SUM(i3.qty*i3.price)>0 THEN i2.qty*i2.price*1.0/SUM(i3.qty*i3.price) ELSE 1.0/COUNT(i3.id) END cshare FROM order_items i2 JOIN order_items i3 ON i3.order_id=i2.order_id GROUP BY i2.id) r ON r.iid=i.id
      WHERE ${W} GROUP BY k.id ORDER BY revenue DESC`, ...args).map(x => ({ ...x, margin: x.revenue ? +(x.profit / x.revenue).toFixed(4) : 0 }));
  }
  const g = dim === 'store' ? 's.id' : dim === 'site' ? 's.site' : dim === 'platform' ? 's.platform' : 'date(o.order_time)';
  const nm = dim === 'store' ? 's.name' : dim === 'site' ? 's.site' : dim === 'platform' ? 's.platform' : 'date(o.order_time)';
  return all(`SELECT ${g} key, ${nm} name, ${dim === 'store' ? "s.platform || ' · ' || s.site" : "''"} sub, (SELECT 0) units, COUNT(*) orders,
    ROUND(SUM(o.revenue_cny),2) revenue, ROUND(SUM(o.platform_fee*o.fx_rate),2) platform_fee, ROUND(SUM(o.fba_fee*o.fx_rate),2) fba_fee, ROUND(SUM(o.ad_cost*o.fx_rate),2) ad_cost,
    ROUND(SUM(o.cogs),2) cogs, ROUND(SUM(o.freight_cost),2) freight, ROUND(SUM(o.other_cost),2) other, ROUND(SUM(o.profit_cny),2) profit
    FROM orders o JOIN stores s ON s.id=o.store_id WHERE ${W} GROUP BY ${g} ORDER BY ${dim === 'day' ? 'name DESC' : 'revenue DESC'}`, ...args)
    .map(x => ({ ...x, units: one(`SELECT COALESCE(SUM(i.qty),0) u FROM order_items i JOIN orders o ON o.id=i.order_id JOIN stores s ON s.id=o.store_id WHERE ${W} AND ${g}=?`, ...args, x.key).u, margin: x.revenue ? +(x.profit / x.revenue).toFixed(4) : 0 }));
}));
app.post('/api/finance/recalc', wrap(req => tx(() => {
  const ids = all('SELECT id FROM orders'); for (const o of ids) calcOrderProfit(o.id);
  log(U(req), '财务管理', '重算利润', `重算 ${ids.length} 个订单利润`); return { count: ids.length };
})));
app.post('/api/orders/:id/recalc', wrap(req => calcOrderProfit(Number(req.params.id))));

// ---------- 广告 ----------
app.get('/api/ads/summary', wrap(req => {
  const sf = req.query.storeId ? ' AND s.id=' + Number(req.query.storeId) : '';
  const stores = all(`SELECT s.id, s.name, s.platform, s.site, s.currency, r.rate_to_cny rate, COUNT(c.id) campaigns, ROUND(SUM(c.spend),2) spend, ROUND(SUM(c.sales),2) sales, SUM(c.clicks) clicks, SUM(c.impressions) impressions, SUM(c.orders) orders FROM stores s JOIN ad_campaigns c ON c.store_id=s.id JOIN exchange_rates r ON r.currency=s.currency WHERE 1=1${sf} GROUP BY s.id ORDER BY SUM(c.spend*r.rate_to_cny) DESC`)
    .map(s => ({ ...s, acos: s.sales ? +(s.spend / s.sales).toFixed(4) : 0, roas: s.spend ? +(s.sales / s.spend).toFixed(2) : 0, spend_cny: +(s.spend * s.rate).toFixed(2), sales_cny: +(s.sales * s.rate).toFixed(2) }));
  const daily = all(`SELECT a.date d, ROUND(SUM(a.spend*r.rate_to_cny),2) spend, ROUND(SUM(a.sales*r.rate_to_cny),2) sales FROM ad_daily a JOIN stores s ON s.id=a.store_id JOIN exchange_rates r ON r.currency=s.currency WHERE 1=1${sf} GROUP BY a.date ORDER BY a.date`);
  return { stores, daily };
}));

// ---------- 系统 ----------
app.post('/api/stores/:id/authorize', wrap(req => {
  const id = Number(req.params.id);
  run("UPDATE stores SET auth_status='已授权', auth_expire=date('now','+365 day') WHERE id=?", id);
  const s = one('SELECT name FROM stores WHERE id=?', id); log(U(req), '系统设置', '店铺授权', `${s.name} 授权成功（模拟 SP-API/OAuth）`); return { ok: true };
}));
app.post('/api/users', wrap(req => {
  const b = req.body; if (one('SELECT id FROM users WHERE username=?', b.username)) throw new Error('用户名已存在');
  const id = run('INSERT INTO users(username,password_hash,name,email,phone,role_id,status) VALUES(?,?,?,?,?,?,?)', b.username, hashPwd(b.password || '123456'), b.name, b.email, b.phone, b.role_id, b.status || '启用').lastInsertRowid;
  log(U(req), '系统设置', '新增用户', b.username); return { id };
}));
app.post('/api/users/:id/reset-password', wrap(req => { run('UPDATE users SET password_hash=? WHERE id=?', hashPwd(req.body.password || '123456'), Number(req.params.id)); log(U(req), '系统设置', '重置密码', `用户ID ${req.params.id}`); return { ok: true }; }));

// ---------- 通用资源 CRUD ----------
app.get('/api/r/:res', wrap(req => {
  const R = RESOURCES[req.params.res]; if (!R) throw new Error('未知资源');
  const q = req.query as any; const where: string[] = []; const args: any[] = [];
  if (q.q && R.search?.length) { where.push('(' + R.search.map(c => `${c} LIKE ?`).join(' OR ') + ')'); R.search.forEach(() => args.push(`%${q.q}%`)); }
  for (const [k, col] of Object.entries(R.filters || {})) if (q[k] !== undefined && q[k] !== '') {
    const vals = String(q[k]).split(','); where.push(`${col} IN (${vals.map(() => '?').join(',')})`); args.push(...vals);
  }
  if (q.storeId && R.storeCol) { where.push(`${R.storeCol}=?`); args.push(Number(q.storeId)); }
  if (R.dateCol && q.dateFrom) { where.push(`date(${R.dateCol})>=?`); args.push(q.dateFrom); }
  if (R.dateCol && q.dateTo) { where.push(`date(${R.dateCol})<=?`); args.push(q.dateTo); }
  const W = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const page = Math.max(1, Number(q.page || 1)), size = Math.min(500, Number(q.pageSize || 20));
  let order = R.order || 't.id DESC';
  if (q.sortField && /^[a-z_]+$/.test(q.sortField)) order = `${q.sortField} ${q.sortOrder === 'ascend' ? 'ASC' : 'DESC'}`;
  const total = one(`SELECT COUNT(*) c FROM ${R.from}${W}`, ...args).c;
  const list = all(`SELECT ${R.select} FROM ${R.from}${W} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, size, (page - 1) * size);
  let summary: any = undefined;
  if (req.params.res === 'orders') summary = one(`SELECT COUNT(*) c, ROUND(SUM(t.revenue_cny),2) revenue, ROUND(SUM(t.profit_cny),2) profit FROM ${R.from}${W}`, ...args);
  return { list, total, page, pageSize: size, summary };
}));
app.get('/api/r/:res/:id', wrap(req => {
  const R = RESOURCES[req.params.res]; if (!R) throw new Error('未知资源');
  return one(`SELECT ${R.select} FROM ${R.from} WHERE t.id=?`, Number(req.params.id));
}));
app.post('/api/r/:res', wrap(req => tx(() => {
  const R = RESOURCES[req.params.res]; if (!R || !R.writable.length) throw new Error('该资源不支持新增');
  const b = req.body; const cols = R.writable.filter(c => c in b);
  const id = run(`INSERT INTO ${R.table}(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`, ...cols.map(c => b[c] === '' ? null : b[c])).lastInsertRowid as number;
  if (R.table === 'skus') saveCombo(id, b.combo_items);
  log(U(req), R.module, '新增' + R.label, JSON.stringify(b).slice(0, 120));
  return { id };
})));
app.put('/api/r/:res/:id', wrap(req => tx(() => {
  const R = RESOURCES[req.params.res]; if (!R) throw new Error('未知资源');
  const id = Number(req.params.id); const b = req.body; const cols = R.writable.filter(c => c in b);
  if (R.table === 'inventory') { if ('safety_stock' in b) { const inv = one('SELECT sku_id FROM inventory WHERE id=?', id); run('UPDATE skus SET safety_stock=? WHERE id=?', b.safety_stock, inv.sku_id); } return { ok: true }; }
  if (cols.length) run(`UPDATE ${R.table} SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, ...cols.map(c => b[c] === '' ? null : b[c]), id);
  if (R.table === 'skus') saveCombo(id, b.combo_items);
  if (R.table === 'exchange_rates') run("UPDATE exchange_rates SET updated_at=datetime('now','localtime') WHERE id=?", id);
  log(U(req), R.module, '编辑' + R.label, `ID ${id}: ` + JSON.stringify(b).slice(0, 120));
  return { ok: true };
})));
app.delete('/api/r/:res/:id', wrap(req => {
  const R = RESOURCES[req.params.res]; if (!R || !R.writable.length) throw new Error('该资源不支持删除');
  run(`DELETE FROM ${R.table} WHERE id=?`, Number(req.params.id));
  log(U(req), R.module, '删除' + R.label, `ID ${req.params.id}`); return { ok: true };
}));

// ---------- 前端静态资源 ----------
const WEB = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../web/dist');
if (fs.existsSync(WEB)) {
  app.use(express.static(WEB));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(WEB, 'index.html')));
}
app.listen(PORT, '0.0.0.0', () => console.log(`跨境电商ERP 已启动: http://localhost:${PORT}`));
