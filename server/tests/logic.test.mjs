// Real SQLite engine, isolated in-memory DB. No dependency install required.
// The hook replaces only the connection/driver boundary, not business logic.
// This does not verify better-sqlite3 or Express integration.
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
const db = new DatabaseSync(':memory:');
let savepoint = 0;
db.transaction = fn => (...args) => {
  const name = `test_${++savepoint}`;
  db.exec(`SAVEPOINT ${name}`);
  try { const result = fn(...args); db.exec(`RELEASE ${name}`); return result; }
  catch (e) { db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`); throw e; }
};
globalThis.__erpTestDb = db;
registerHooks({resolve(specifier, context, next) {
  if (specifier === './db.js' && context.parentURL?.endsWith('/src/logic.ts'))
    return {url:'data:text/javascript,export const db = globalThis.__erpTestDb;',shortCircuit:true};
  return next(specifier,context);
}});
const schemaSource = readFileSync(new URL('../src/db.ts', import.meta.url),'utf8');
const schema = schemaSource.split('export const SCHEMA = `')[1].split('`;')[0];
db.exec('PRAGMA foreign_keys=ON;'+schema);
const logic = await import('../src/logic.ts');
const run = (sql,...args) => db.prepare(sql).run(...args);
beforeEach(() => {
 db.exec('PRAGMA foreign_keys=OFF');
 for (const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) db.exec(`DELETE FROM "${name}"`);
 db.exec('PRAGMA foreign_keys=ON');
 run("INSERT INTO exchange_rates(currency,rate_to_cny) VALUES('USD',7),('CNY',1)");
 run("INSERT INTO stores(id,name,platform,site,currency) VALUES(1,'test','Amazon','US','USD')");
 run("INSERT INTO skus(id,sku,name,weight,purchase_cost) VALUES(1,'sku1','item',0.5,10)");
 run("INSERT INTO warehouses(id,name,type) VALUES(1,'test','本地仓')");
});
test('FBA charges total shipment weight once, not once per unit',()=>{
 run("INSERT INTO orders(id,order_no,store_id,fulfillment,currency) VALUES(1,'o1',1,'FBA','USD')");
 run('INSERT INTO order_items(order_id,sku_id,qty,price) VALUES(1,1,2,20)');
 const result=logic.calcOrderProfit(1);
 assert.equal(result.units,2); assert.equal(result.weight,1);
 assert.equal(result.fbaFee,8.2); // 3.2*2 + 1kg*1.8
 assert.equal(db.prepare('SELECT fba_fee FROM orders WHERE id=1').get().fba_fee,8.2);
});
test('combo cycles fail explicitly; shared children are not cycles',()=>{
 run("INSERT INTO skus(id,sku,name,is_combo,packaging_cost) VALUES(2,'kit','kit',1,1),(3,'outer','outer',1,0)");
 run('INSERT INTO combo_items(combo_sku_id,sku_id,qty) VALUES(2,1,2),(3,2,1),(3,1,1)');
 assert.deepEqual(logic.skuUnitCost(3),{cost:31,weight:1.5});
 run('INSERT INTO combo_items(combo_sku_id,sku_id,qty) VALUES(2,3,1)');
 assert.throws(()=>logic.skuUnitCost(3),/组合SKU循环引用/);
 run('DELETE FROM combo_items');
 run('INSERT INTO combo_items(combo_sku_id,sku_id,qty) VALUES(2,2,1)');
 assert.throws(()=>logic.skuUnitCost(2),/组合SKU循环引用/);
});
test('missing or invalid FX fails instead of silently pricing foreign money as CNY',()=>{
 assert.equal(logic.rateOf('USD'),7); assert.equal(logic.rateOf('CNY'),1);
 assert.throws(()=>logic.rateOf('EUR'),/缺少有效汇率/);
 for (const value of [0,-1,null]) {
  run("UPDATE exchange_rates SET rate_to_cny=? WHERE currency='USD'",value);
  assert.throws(()=>logic.rateOf('USD'),/缺少有效汇率/);
 }
 run("INSERT INTO orders(id,order_no,store_id,fulfillment,currency,profit_cny) VALUES(1,'o1',1,'FBM','EUR',123)");
 assert.throws(()=>logic.calcOrderProfit(1),/缺少有效汇率/);
 assert.equal(db.prepare('SELECT profit_cny FROM orders WHERE id=1').get().profit_cny,123);
});
test('stock + ledger are atomic even if ledger insertion fails',()=>{
 assert.equal(logic.adjustStock(1,1,5,'入库','in'),5);
 db.exec("CREATE TRIGGER fail_ledger BEFORE INSERT ON inventory_ledger BEGIN SELECT RAISE(ABORT,'ledger unavailable'); END");
 try {
  assert.throws(()=>logic.adjustStock(1,1,-2,'出库','out'),/ledger unavailable/);
  assert.equal(db.prepare('SELECT qty_available FROM inventory').get().qty_available,5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_ledger').get().n,1);
 } finally { db.exec('DROP TRIGGER fail_ledger'); }
 assert.throws(()=>logic.adjustStock(1,1,-6,'出库','out'),/库存不足/);
 for (const invalid of [NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>logic.adjustStock(1,1,invalid,'入库','bad'),/安全整数/);
 assert.equal(db.prepare('SELECT qty_available FROM inventory').get().qty_available,5);
 // Native nested savepoints also roll back with an enclosing transaction.
 assert.throws(()=>db.transaction(()=>{logic.adjustStock(1,1,1,'入库','nested');throw Error('outer');})(),/outer/);
 assert.equal(db.prepare('SELECT qty_available FROM inventory').get().qty_available,5);
});
test('freight allocation conserves cents, falls back for zero weights, rolls back failures',()=>{
 run("INSERT INTO fba_shipments(id,total_freight,alloc_method) VALUES(1,10,'按数量')");
 for(let i=1;i<=3;i++) run('INSERT INTO fba_shipment_items(id,shipment_id,sku_id,qty) VALUES(?,1,1,1)',i);
 assert.deepEqual(logic.allocateFreight(1,false).map(x=>x.alloc_freight),[3.34,3.33,3.33]);
 run("UPDATE fba_shipments SET alloc_method='按重量'"); run('UPDATE skus SET weight=0');
 assert.deepEqual(logic.allocateFreight(1,false).map(x=>x.alloc_freight),[3.34,3.33,3.33]);
 run('UPDATE fba_shipments SET total_freight=20');
 db.exec("CREATE TRIGGER fail_alloc BEFORE UPDATE ON fba_shipment_items WHEN NEW.id=2 BEGIN SELECT RAISE(ABORT,'alloc unavailable'); END");
 try {
  assert.throws(()=>logic.allocateFreight(1),/alloc unavailable/);
  assert.equal(db.prepare('SELECT alloc_freight FROM fba_shipment_items WHERE id=1').get().alloc_freight,3.34);
  assert.equal(db.prepare('SELECT freight_cost FROM skus WHERE id=1').get().freight_cost,0);
 } finally { db.exec('DROP TRIGGER fail_alloc'); }
 assert.throws(()=>logic.allocateFreight(999),/货件不存在/);
 run('UPDATE fba_shipment_items SET qty=0 WHERE id=1');
 assert.throws(()=>logic.allocateFreight(1),/正整数/);
});
