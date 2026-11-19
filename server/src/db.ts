import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_FILE = path.join(DATA_DIR, 'erp.db');
export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPwd(p: string) {
  return crypto.createHash('sha256').update('erp-salt::' + p).digest('hex');
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS stores(id INTEGER PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL, site TEXT NOT NULL, currency TEXT NOT NULL, seller_id TEXT, auth_status TEXT DEFAULT '已授权', auth_expire TEXT, status TEXT DEFAULT '启用', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, contact TEXT, phone TEXT, address TEXT, lead_days INTEGER DEFAULT 7, settle_method TEXT DEFAULT '月结30天', rating TEXT DEFAULT 'A', status TEXT DEFAULT '合作中', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, spu TEXT UNIQUE NOT NULL, name TEXT NOT NULL, name_en TEXT, category TEXT, brand TEXT, developer TEXT, status TEXT DEFAULT '在售', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS skus(id INTEGER PRIMARY KEY, sku TEXT UNIQUE NOT NULL, product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, name TEXT NOT NULL, color TEXT, size TEXT, purchase_cost REAL DEFAULT 0, freight_cost REAL DEFAULT 0, packaging_cost REAL DEFAULT 0, weight REAL DEFAULT 0, length REAL DEFAULT 0, width REAL DEFAULT 0, height REAL DEFAULT 0, is_combo INTEGER DEFAULT 0, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, safety_stock INTEGER DEFAULT 50, status TEXT DEFAULT '在售', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS combo_items(id INTEGER PRIMARY KEY, combo_sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE, sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE, qty INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS mskus(id INTEGER PRIMARY KEY, msku TEXT NOT NULL, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, sku_id INTEGER REFERENCES skus(id) ON DELETE SET NULL, asin TEXT, fnsku TEXT, title TEXT, price REAL, status TEXT DEFAULT '在售', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS warehouses(id INTEGER PRIMARY KEY, code TEXT, name TEXT NOT NULL, type TEXT NOT NULL, country TEXT, store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL, address TEXT, status TEXT DEFAULT '启用');
CREATE TABLE IF NOT EXISTS inventory(id INTEGER PRIMARY KEY, warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE CASCADE, sku_id INTEGER REFERENCES skus(id) ON DELETE CASCADE, qty_available INTEGER DEFAULT 0, qty_locked INTEGER DEFAULT 0, qty_transit INTEGER DEFAULT 0, UNIQUE(warehouse_id, sku_id));
CREATE TABLE IF NOT EXISTS inventory_ledger(id INTEGER PRIMARY KEY, warehouse_id INTEGER, sku_id INTEGER, type TEXT, qty INTEGER, before_qty INTEGER, after_qty INTEGER, ref_no TEXT, remark TEXT, operator TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS stock_moves(id INTEGER PRIMARY KEY, move_no TEXT UNIQUE, type TEXT NOT NULL, from_wh INTEGER, to_wh INTEGER, sku_id INTEGER, qty INTEGER, status TEXT DEFAULT '已完成', remark TEXT, operator TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS stocktakes(id INTEGER PRIMARY KEY, st_no TEXT, warehouse_id INTEGER, sku_id INTEGER, book_qty INTEGER, actual_qty INTEGER, diff INTEGER, status TEXT DEFAULT '待确认', operator TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS logistics_providers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT, contact TEXT, phone TEXT, settle_method TEXT, status TEXT DEFAULT '合作中');
CREATE TABLE IF NOT EXISTS logistics_channels(id INTEGER PRIMARY KEY, provider_id INTEGER REFERENCES logistics_providers(id) ON DELETE SET NULL, name TEXT NOT NULL, code TEXT, type TEXT, transit_days TEXT, price_per_kg REAL, base_fee REAL DEFAULT 0, countries TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS shipping_rules(id INTEGER PRIMARY KEY, name TEXT, priority INTEGER DEFAULT 10, platform TEXT, country TEXT, max_weight REAL, warehouse_id INTEGER, channel_id INTEGER, enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, order_no TEXT UNIQUE, platform_order_no TEXT, store_id INTEGER REFERENCES stores(id), status TEXT, fulfillment TEXT DEFAULT 'FBM', buyer_name TEXT, country TEXT, address TEXT, currency TEXT, total_amount REAL DEFAULT 0, shipping_income REAL DEFAULT 0, platform_fee REAL DEFAULT 0, fba_fee REAL DEFAULT 0, ad_cost REAL DEFAULT 0, cogs REAL DEFAULT 0, freight_cost REAL DEFAULT 0, other_cost REAL DEFAULT 0, fx_rate REAL DEFAULT 1, revenue_cny REAL DEFAULT 0, profit_cny REAL DEFAULT 0, margin REAL DEFAULT 0, warehouse_id INTEGER, channel_id INTEGER, tracking_no TEXT, flag TEXT, parent_id INTEGER, merged_into INTEGER, remark TEXT, order_time TEXT, ship_time TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, msku TEXT, sku_id INTEGER, qty INTEGER, price REAL);
CREATE TABLE IF NOT EXISTS review_rules(id INTEGER PRIMARY KEY, name TEXT, priority INTEGER DEFAULT 10, condition TEXT, action TEXT, enabled INTEGER DEFAULT 1, hits INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS after_sales(id INTEGER PRIMARY KEY, as_no TEXT, order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, type TEXT, reason TEXT, amount REAL, currency TEXT, status TEXT DEFAULT '待处理', restock INTEGER DEFAULT 0, remark TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS purchase_orders(id INTEGER PRIMARY KEY, po_no TEXT UNIQUE, supplier_id INTEGER REFERENCES suppliers(id), warehouse_id INTEGER REFERENCES warehouses(id), status TEXT DEFAULT '草稿', total_amount REAL DEFAULT 0, freight REAL DEFAULT 0, pay_status TEXT DEFAULT '未付款', buyer TEXT, expected_date TEXT, remark TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS purchase_order_items(id INTEGER PRIMARY KEY, po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE, sku_id INTEGER, qty INTEGER, received_qty INTEGER DEFAULT 0, unit_price REAL);
CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY, rc_no TEXT, po_id INTEGER, sku_id INTEGER, qty INTEGER, qc_status TEXT DEFAULT '合格', warehouse_id INTEGER, operator TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS fba_shipments(id INTEGER PRIMARY KEY, shipment_no TEXT UNIQUE, fba_shipment_id TEXT, plan_name TEXT, store_id INTEGER, from_wh INTEGER, to_wh INTEGER, status TEXT DEFAULT '计划中', provider_id INTEGER, channel TEXT, tracking_no TEXT, total_freight REAL DEFAULT 0, alloc_method TEXT DEFAULT '按重量', ship_date TEXT, eta TEXT, remark TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS fba_shipment_items(id INTEGER PRIMARY KEY, shipment_id INTEGER REFERENCES fba_shipments(id) ON DELETE CASCADE, sku_id INTEGER, msku TEXT, fnsku TEXT, qty INTEGER, received_qty INTEGER DEFAULT 0, alloc_freight REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS fba_boxes(id INTEGER PRIMARY KEY, shipment_id INTEGER REFERENCES fba_shipments(id) ON DELETE CASCADE, box_no TEXT, weight REAL, length REAL, width REAL, height REAL, contents TEXT);
CREATE TABLE IF NOT EXISTS tracking_events(id INTEGER PRIMARY KEY, ref_type TEXT, ref_id INTEGER, event TEXT, location TEXT, time TEXT);
CREATE TABLE IF NOT EXISTS exchange_rates(id INTEGER PRIMARY KEY, currency TEXT UNIQUE, name TEXT, rate_to_cny REAL, updated_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS settlements(id INTEGER PRIMARY KEY, settle_no TEXT, store_id INTEGER, period_start TEXT, period_end TEXT, currency TEXT, sales REAL, fees REAL, refunds REAL, ads REAL, net REAL, status TEXT, transfer_date TEXT);
CREATE TABLE IF NOT EXISTS ad_campaigns(id INTEGER PRIMARY KEY, store_id INTEGER, name TEXT, type TEXT, status TEXT, budget REAL, spend REAL, sales REAL, impressions INTEGER, clicks INTEGER, orders INTEGER);
CREATE TABLE IF NOT EXISTS ad_daily(id INTEGER PRIMARY KEY, store_id INTEGER, date TEXT, spend REAL, sales REAL);
CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY, name TEXT, code TEXT, permissions TEXT, remark TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, name TEXT, email TEXT, phone TEXT, role_id INTEGER, status TEXT DEFAULT '启用', last_login TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS operation_logs(id INTEGER PRIMARY KEY, user TEXT, module TEXT, action TEXT, detail TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
`;
db.exec(SCHEMA);
