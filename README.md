# 跨境电商 ERP（VivaHome ERP）

跨境电商管理系统：覆盖商品、订单、采购、仓储、FBA 头程、物流到财务利润的完整闭环。界面为简体中文的企业后台风格。

## 界面截图

![经营概览](src/erp/screenshots/02-dashboard.png)

*经营概览 / Dashboard*

![商品 SKU](src/erp/screenshots/03-products-sku.png)

*商品 SKU / Product SKUs*

![订单](src/erp/screenshots/04-orders.png)

*订单 / Orders*

![财务利润](src/erp/screenshots/08-finance-profit.png)

*财务利润 / Finance / profit*

## 功能特性

- 仪表盘：销售、订单、毛利、广告、库存预警与待办。
- 商品：SKU / SPU / MSKU 配对与组合商品。
- 订单：审单、发货、售后、合并拆分；采购计划与分批收货。
- 仓储库存、FBA 货件、物流与财务利润。
- 左侧分组菜单、多标签页、高密度表格、抽屉详情。

## 技术栈

- 前端：TypeScript + Vite（`src/erp/web`）
- 后端：TypeScript（`src/erp/server`，tsx 启动）

## 从源码运行

源码在 `src/erp/`。本仓库不包含安装包。路径相对于该目录（不要使用文档里可能出现的 `/workspace/erp`）。

```bash
cd src/erp/server && npm install
cd ../web && npm install && npm run build    # 产物到 web/dist

cd ../server
npx tsx src/seed.ts     # 初始化演示数据（会重建 server/data/erp.db）
npx tsx src/index.ts    # API 与前端静态页共用 8800 端口
```

然后访问 http://localhost:8800 。演示账号见 `src/erp/README.md`。

## 文档

- [源码 README](src/erp/README.md)

---

## English

# Cross-border ERP (VivaHome ERP)

A cross-border e-commerce ERP covering products, orders, purchasing, warehousing, FBA inbound, logistics, and profit. The UI is a Simplified-Chinese enterprise back office.

## Screenshots

![Dashboard](src/erp/screenshots/02-dashboard.png)

*经营概览 / Dashboard*

![Product SKUs](src/erp/screenshots/03-products-sku.png)

*商品 SKU / Product SKUs*

![Orders](src/erp/screenshots/04-orders.png)

*订单 / Orders*

![Finance / profit](src/erp/screenshots/08-finance-profit.png)

*财务利润 / Finance / profit*

## Features

- Dashboard: sales, orders, margin, ads, inventory alerts, and todos.
- Catalog: SKU / SPU / MSKU mapping and bundles.
- Orders: review, ship, after-sales, merge/split; purchase plans and partial receiving.
- Warehouse stock, FBA shipments, logistics, and profit.
- Grouped sidebar, multi-tabs, dense tables, and detail drawers.

## Tech stack

- 前端：TypeScript + Vite（`src/erp/web`）
- 后端：TypeScript（`src/erp/server`，tsx 启动）

## Getting started

Source is under `src/erp/`. This repository does not include installers. Paths are relative to that tree (ignore any `/workspace/erp` prefixes in older notes).

```bash
cd src/erp/server && npm install
cd ../web && npm install && npm run build    # output in web/dist

cd ../server
npx tsx src/seed.ts     # seeds demo data (rebuilds server/data/erp.db)
npx tsx src/index.ts    # API and static UI share port 8800
```

Open http://localhost:8800 . Demo accounts are listed in `src/erp/README.md`.

## Documentation

- [源码 README](src/erp/README.md)

