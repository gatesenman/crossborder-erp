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
