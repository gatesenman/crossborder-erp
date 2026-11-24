import { db } from './db.js';

export const PLATFORM_FEE_RATE: Record<string, number> = {
  Amazon: 0.15, Shopify: 0.029, 'TikTok Shop': 0.08, Temu: 0.05, eBay: 0.1325, Walmart: 0.15,
};

export function now() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function genNo(prefix: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}${d.getFullYear() % 100}${p(d.getMonth() + 1)}${p(d.getDate())}${Math.floor(Math.random() * 900000 + 100000)}`;
}

export function rateOf(currency: string): number {
  const r = db.prepare('SELECT rate_to_cny FROM exchange_rates WHERE currency=?').get(currency) as any;
  if (!r || !Number.isFinite(r.rate_to_cny) || r.rate_to_cny <= 0)
    throw new Error(`缺少有效汇率: ${currency}`);
  return r.rate_to_cny;
}

/** 单件落地成本（CNY）= 采购成本 + 头程分摊 + 包材；组合SKU按子件求和 */
export function skuUnitCost(skuId: number, ancestors = new Set<number>()): { cost: number; weight: number } {
  if (ancestors.has(skuId)) throw new Error(`组合SKU循环引用: ${skuId}`);
  const path = new Set(ancestors).add(skuId);
  const s = db.prepare('SELECT * FROM skus WHERE id=?').get(skuId) as any;
  if (!s) return { cost: 0, weight: 0 };
  if (s.is_combo) {
    const items = db.prepare('SELECT * FROM combo_items WHERE combo_sku_id=?').all(skuId) as any[];
    let cost = s.packaging_cost || 0, weight = 0;
    for (const it of items) { const c = skuUnitCost(it.sku_id, path); cost += c.cost * it.qty; weight += c.weight * it.qty; }
    return { cost, weight };
  }
  return { cost: (s.purchase_cost || 0) + (s.freight_cost || 0) + (s.packaging_cost || 0), weight: s.weight || 0 };
}

/**
 * 订单利润计算（行业通用口径）
 * 销售额(原币) = 商品金额 + 买家运费
 * 平台佣金(原币) = 销售额 × 平台费率
 * FBA配送费(原币) = 仅FBA订单, 每件 3.2 + 重量kg × 1.8 (按币种折算)
 * 广告费(原币) = 订单分摊广告费
 * 商品成本COGS(CNY) = Σ 数量 × (采购价 + 头程 + 包材)
 * 尾程运费(CNY) = FBM订单按物流渠道 首重费 + 单价/kg × 重量
 * 利润(CNY) = (销售额 − 佣金 − FBA费 − 广告费) × 汇率 − COGS − 尾程运费 − 其他费用
 */
export function calcOrderProfit(orderId: number) {
  const o = db.prepare('SELECT o.*, s.platform FROM orders o LEFT JOIN stores s ON s.id=o.store_id WHERE o.id=?').get(orderId) as any;
  if (!o) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId) as any[];
  const rate = rateOf(o.currency);
  const usdRate = rateOf('USD');
  let cogs = 0, weight = 0, units = 0, goods = 0;
  for (const it of items) {
    const c = skuUnitCost(it.sku_id);
    cogs += c.cost * it.qty; weight += c.weight * it.qty; units += it.qty; goods += (it.price || 0) * it.qty;
  }
  const total = goods > 0 ? goods : o.total_amount;
  const revenue = total + (o.shipping_income || 0);
  const platformFee = +(revenue * (PLATFORM_FEE_RATE[o.platform] ?? 0.1)).toFixed(2);
  const fbaFee = o.fulfillment === 'FBA' ? +((3.2 * units + weight * 1.8) * usdRate / rate).toFixed(2) : 0;
  let freight = 0;
  if (o.fulfillment !== 'FBA' && o.channel_id) {
    const ch = db.prepare('SELECT * FROM logistics_channels WHERE id=?').get(o.channel_id) as any;
    if (ch) freight = +((ch.base_fee || 0) + (ch.price_per_kg || 0) * Math.max(weight, 0.1)).toFixed(2);
  }
  const cancelled = o.status === '已取消';
  const revenueCny = cancelled ? 0 : +(revenue * rate).toFixed(2);
  const profit = cancelled ? 0 : +((revenue - platformFee - fbaFee - (o.ad_cost || 0)) * rate - cogs - freight - (o.other_cost || 0)).toFixed(2);
  const margin = revenueCny ? +(profit / revenueCny).toFixed(4) : 0;
  db.prepare(`UPDATE orders SET total_amount=?, platform_fee=?, fba_fee=?, cogs=?, freight_cost=?, fx_rate=?, revenue_cny=?, profit_cny=?, margin=? WHERE id=?`)
    .run(+total.toFixed(2), platformFee, fbaFee, +cogs.toFixed(2), freight, rate, revenueCny, profit, margin, orderId);
  return { revenue, platformFee, fbaFee, adCost: o.ad_cost || 0, cogs: +cogs.toFixed(2), freight, otherCost: o.other_cost || 0, rate, revenueCny, profit, margin, currency: o.currency, weight, units };
}

export function ensureInv(whId: number, skuId: number) {
  db.prepare('INSERT OR IGNORE INTO inventory(warehouse_id, sku_id, qty_available, qty_locked, qty_transit) VALUES(?,?,0,0,0)').run(whId, skuId);
  return db.prepare('SELECT * FROM inventory WHERE warehouse_id=? AND sku_id=?').get(whId, skuId) as any;
}

/** 库存变动 + 写入库存流水 */
export function adjustStock(whId: number, skuId: number, delta: number, type: string, refNo: string, remark = '', operator = 'system') {
  if (!Number.isSafeInteger(delta)) throw new Error('库存变动必须为安全整数');
  return db.transaction(() => {
  const inv = ensureInv(whId, skuId);
  const before = inv.qty_available;
  const after = before + delta;
  if (!Number.isSafeInteger(after)) throw new Error('库存超出安全整数范围');
  if (after < 0) throw new Error(`库存不足：当前可用 ${before}，需扣减 ${-delta}`);
  db.prepare('UPDATE inventory SET qty_available=? WHERE id=?').run(after, inv.id);
  db.prepare('INSERT INTO inventory_ledger(warehouse_id, sku_id, type, qty, before_qty, after_qty, ref_no, remark, operator, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(whId, skuId, type, delta, before, after, refNo, remark, operator, now());
  return after;
  })();
}

/** 按头程运费分摊方式分摊到货件明细，并回写SKU头程单价 */
export function allocateFreight(shipmentId: number, updateSku = true) {
  const sh = db.prepare('SELECT * FROM fba_shipments WHERE id=?').get(shipmentId) as any;
  const items = db.prepare('SELECT i.*, s.weight, s.length, s.width, s.height FROM fba_shipment_items i LEFT JOIN skus s ON s.id=i.sku_id WHERE shipment_id=?').all(shipmentId) as any[];
  if (!sh) throw new Error('货件不存在');
  if (!Number.isFinite(sh.total_freight) || sh.total_freight < 0)
    throw new Error('头程运费必须为非负有限数');
  if (!items.length) return [];
  for (const i of items) if (!Number.isSafeInteger(i.qty) || i.qty <= 0)
    throw new Error('货件数量必须为正整数');
  const basis = (i: any) => sh.alloc_method === '按体积' ? (i.length * i.width * i.height) * i.qty : sh.alloc_method === '按数量' ? i.qty : (i.weight || 0) * i.qty;
  let bases = items.map(basis);
  if (bases.some(x => !Number.isFinite(x) || x < 0)) throw new Error('分摊依据无效');
  // Missing measurements must not silently discard the entire freight cost.
  if (bases.every(x => x === 0)) bases = items.map(i => i.qty);
  const totalBasis = bases.reduce((a, b) => a + b, 0);
  const cents = Math.round(sh.total_freight * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('头程运费超出安全范围');
  const shares = bases.map(b => cents * (b / totalBasis));
  const allocated = shares.map(Math.floor);
  const order = shares.map((s, i) => ({ i, remainder: s - allocated[i] }))
    .sort((a, b) => b.remainder - a.remainder || items[a.i].id - items[b.i].id);
  const leftover = cents - allocated.reduce((a, b) => a + b, 0);
  for (let i = 0; i < leftover; i++) allocated[order[i].i]++;
  return db.transaction(() => {
    const upd = db.prepare('UPDATE fba_shipment_items SET alloc_freight=? WHERE id=?');
    const updSku = db.prepare('UPDATE skus SET freight_cost=? WHERE id=?');
    return items.map((i, index) => {
      const amt = allocated[index] / 100;
      upd.run(amt, i.id);
      const unit = +(amt / i.qty).toFixed(2);
      if (updateSku) updSku.run(unit, i.sku_id);
      return { id: i.id, sku_id: i.sku_id, alloc_freight: amt, unit };
    });
  })();
}

export function log(user: string, module: string, action: string, detail: string, ip = '127.0.0.1') {
  db.prepare('INSERT INTO operation_logs(user, module, action, detail, ip, created_at) VALUES(?,?,?,?,?,?)').run(user, module, action, detail, ip, now());
}
