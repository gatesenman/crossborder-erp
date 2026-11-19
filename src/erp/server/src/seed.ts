import { db, hashPwd, SCHEMA, DB_FILE } from './db.js';
import { calcOrderProfit, allocateFreight } from './logic.js';

let seed = 20261031;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const p2 = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const day = (d: Date) => fmt(d).slice(0, 10);
const daysAgo = (n: number, h = ri(0, 23)) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, ri(0, 59), ri(0, 59)); return d; };

export function seedAll() {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map(r => r.name);
  db.pragma('foreign_keys = OFF');
  for (const t of tables) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const tx = db.transaction(() => {
    // 汇率
    const rates: [string, string, number][] = [['CNY', '人民币', 1], ['USD', '美元', 7.12], ['EUR', '欧元', 7.74], ['GBP', '英镑', 9.06], ['JPY', '日元', 0.0472], ['CAD', '加元', 5.16], ['AUD', '澳元', 4.66], ['MXN', '墨西哥比索', 0.388]];
    for (const r of rates) db.prepare('INSERT INTO exchange_rates(currency,name,rate_to_cny) VALUES(?,?,?)').run(...r);

    // 店铺
    const stores: [string, string, string, string, string][] = [
      ['VivaHome-US', 'Amazon', '美国', 'USD', 'A2EUQ1WTGCTBG2'], ['VivaHome-UK', 'Amazon', '英国', 'GBP', 'A1F83G8C2ARO7P'],
      ['VivaHome-DE', 'Amazon', '德国', 'EUR', 'A1PA6795UKMFR9'], ['VivaHome-JP', 'Amazon', '日本', 'JPY', 'A1VC38T7YXB528'],
      ['vivahome.com', 'Shopify', '美国', 'USD', 'vivahome.myshopify.com'], ['VivaHome TikTok US', 'TikTok Shop', '美国', 'USD', 'TTUS7723190'],
      ['VivaHome TikTok UK', 'TikTok Shop', '英国', 'GBP', 'TTGB5531021'], ['VivaHome Temu', 'Temu', '美国', 'USD', 'TM634112'],
      ['vivahome_official', 'eBay', '美国', 'USD', 'vivahome_official'], ['VivaHome Walmart', 'Walmart', '美国', 'USD', 'WM10093321'],
    ];
    stores.forEach((s, i) => db.prepare("INSERT INTO stores(name,platform,site,currency,seller_id,auth_status,auth_expire,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(s[0], s[1], s[2], s[3], s[4], i === 9 ? '授权过期' : '已授权', i === 9 ? '2026-10-20' : '2027-0' + ri(1, 9) + '-15', '启用', fmt(daysAgo(300 - i * 20))));
    const storeRows = db.prepare('SELECT * FROM stores').all() as any[];

    // 供应商
    const sups = [['义乌佳诚日用品有限公司', '陈经理'], ['深圳市创联电子科技', '刘工'], ['宁波美居塑料制品厂', '王总'], ['东莞恒达五金制品', '李经理'], ['台州宠乐宠物用品', '赵女士'], ['杭州悦动户外用品', '孙经理'], ['佛山欧厨厨具', '周总'], ['广州优品包装材料', '吴小姐']];
    sups.forEach((s, i) => db.prepare('INSERT INTO suppliers(code,name,contact,phone,address,lead_days,settle_method,rating) VALUES(?,?,?,?,?,?,?,?)')
      .run('SUP' + p2(i + 1) + '0', s[0], s[1], '13' + ri(100000000, 999999999), pick(['浙江义乌', '广东深圳', '浙江宁波', '广东东莞', '浙江台州', '浙江杭州', '广东佛山', '广东广州']), ri(5, 20), pick(['月结30天', '款到发货', '半月结', '月结60天']), pick(['A', 'A', 'B', 'S'])));

    // 商品
    const spus: [string, string, string, string, number, string[], string[], number, number, number][] = [
      // name, en, category, supplier idx..., cost, colors, sizes, weight(kg), price(USD), supplier
      ['可折叠收纳箱', 'Foldable Storage Bin', '家居收纳', '', 0, ['米白', '浅灰', '卡其'], ['M', 'L'], 0.6, 19.99, 3],
      ['真空压缩收纳袋', 'Vacuum Storage Bags', '家居收纳', '', 0, ['透明'], ['6件装', '10件装'], 0.8, 24.99, 1],
      ['宠物自动饮水机', 'Pet Water Fountain', '宠物用品', '', 0, ['白色', '灰色'], ['2.5L'], 1.1, 32.99, 5],
      ['猫抓板沙发', 'Cat Scratcher Lounge', '宠物用品', '', 0, ['原木', '灰色'], ['标准', '加大'], 1.6, 27.99, 5],
      ['伸缩登山杖', 'Trekking Poles', '户外运动', '', 0, ['黑色', '蓝色'], ['2支装'], 0.55, 29.99, 6],
      ['露营LED灯串', 'Camping String Lights', '户外运动', '', 0, ['暖光', '彩光'], ['10米'], 0.35, 21.99, 6],
      ['磁吸无线充电器', 'Magnetic Wireless Charger', '3C配件', '', 0, ['黑色', '白色'], ['15W'], 0.18, 25.99, 2],
      ['Type-C 编织数据线', 'USB-C Braided Cable', '3C配件', '', 0, ['黑色', '红色'], ['1米', '2米'], 0.08, 12.99, 2],
      ['手机支架桌面款', 'Phone Stand', '3C配件', '', 0, ['银色', '深空灰'], ['标准'], 0.25, 15.99, 4],
      ['硅胶厨房铲套装', 'Silicone Utensil Set', '厨房用品', '', 0, ['黑色', '薄荷绿'], ['12件套'], 0.9, 26.99, 7],
      ['不锈钢保温杯', 'Insulated Tumbler', '厨房用品', '', 0, ['白色', '黑色', '玫瑰金'], ['20oz', '30oz'], 0.42, 22.99, 7],
      ['电动奶泡器', 'Milk Frother', '厨房用品', '', 0, ['黑色', '银色'], ['标准'], 0.2, 14.99, 2],
      ['桌面理线器', 'Cable Organizer', '家居收纳', '', 0, ['黑色', '白色'], ['5件装'], 0.15, 9.99, 3],
      ['宠物拾便袋', 'Dog Poop Bags', '宠物用品', '', 0, ['绿色'], ['360只', '540只'], 0.7, 13.99, 5],
      ['瑜伽弹力带', 'Resistance Bands', '户外运动', '', 0, ['五色'], ['5件套'], 0.3, 18.99, 6],
    ];
    const skuMeta: { id: number; price: number; weight: number }[] = [];
    spus.forEach((p, i) => {
      const spu = 'VH' + String(1001 + i);
      const pid = db.prepare('INSERT INTO products(spu,name,name_en,category,brand,developer,status,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(spu, p[0], p[1], p[2], 'VivaHome', pick(['张晓', '李雯', '王磊']), i === 13 ? '停售' : '在售', fmt(daysAgo(400 - i * 15))).lastInsertRowid as number;
      let vi = 0;
      for (const c of p[5]) for (const sz of p[6]) {
        vi++;
        const sku = `${spu}-${String(vi).padStart(2, '0')}`;
        const price = +(p[8] + (vi - 1) * 2).toFixed(2);
        const cost = +(price * 7.12 * (0.18 + rnd() * 0.08)).toFixed(2);
        const w = +(p[7] * (1 + (vi - 1) * 0.1)).toFixed(2);
        const id = db.prepare('INSERT INTO skus(sku,product_id,name,color,size,purchase_cost,freight_cost,packaging_cost,weight,length,width,height,supplier_id,safety_stock,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(sku, pid, `${p[0]} ${c} ${sz}`, c, sz, cost, +(w * 11.5).toFixed(2), +(1 + rnd() * 2).toFixed(2), w, ri(15, 40), ri(10, 30), ri(5, 20), p[9], ri(1, 4) * 10, i === 13 ? '停售' : '在售').lastInsertRowid as number;
        skuMeta.push({ id, price, weight: w });
      }
    });
    // 组合SKU
    const combos: [string, string, number[], number][] = [['VH-COMBO-01', '收纳箱+理线器 家居套装', [1, skuMeta.length - 10], 29.99], ['VH-COMBO-02', '保温杯 双杯装', [0, 0], 39.99], ['VH-COMBO-03', '充电器+数据线 套装', [0, 0], 33.99]];
    const findSku = (code: string) => (db.prepare('SELECT id FROM skus WHERE sku=?').get(code) as any).id;
    const comboDefs: [string, string, [string, number][], number][] = [
      ['VH-COMBO-01', '收纳箱+理线器 家居套装', [['VH1001-01', 1], ['VH1013-01', 1]], 29.99],
      ['VH-COMBO-02', '保温杯 双杯装(白+黑)', [['VH1011-01', 1], ['VH1011-03', 1]], 39.99],
      ['VH-COMBO-03', '磁吸充电器+数据线 套装', [['VH1007-01', 1], ['VH1008-01', 2]], 33.99],
    ];
    void combos;
    for (const c of comboDefs) {
      const id = db.prepare('INSERT INTO skus(sku,product_id,name,is_combo,packaging_cost,weight,length,width,height,safety_stock) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(c[0], null, c[1], 1, 1.5, 0, 30, 20, 10, 0).lastInsertRowid as number;
      for (const [code, q] of c[2]) db.prepare('INSERT INTO combo_items(combo_sku_id,sku_id,qty) VALUES(?,?,?)').run(id, findSku(code), q);
      skuMeta.push({ id, price: c[3], weight: 0.8 });
    }

    // 仓库
    const whs: [string, string, string, string, number | null][] = [
      ['SZ01', '深圳龙华自营仓', '本地仓', '中国', null], ['DG01', '东莞虎门备货仓', '本地仓', '中国', null],
      ['USW1', '美西海外仓(洛杉矶)', '海外仓', '美国', null], ['USE1', '美东海外仓(新泽西)', '海外仓', '美国', null], ['DE01', '德国海外仓(法兰克福)', '海外仓', '德国', null],
      ['FBA-US', 'FBA美国仓 VivaHome-US', 'FBA仓', '美国', 1], ['FBA-UK', 'FBA英国仓 VivaHome-UK', 'FBA仓', '英国', 2], ['FBA-DE', 'FBA德国仓 VivaHome-DE', 'FBA仓', '德国', 3], ['FBA-JP', 'FBA日本仓 VivaHome-JP', 'FBA仓', '日本', 4],
    ];
    for (const w of whs) db.prepare('INSERT INTO warehouses(code,name,type,country,store_id,address) VALUES(?,?,?,?,?,?)').run(w[0], w[1], w[2], w[3], w[4], w[2] === '本地仓' ? '广东省' + w[3] : w[3]);
    const realSkus = skuMeta.filter(s => s.weight > 0 && !(db.prepare('SELECT is_combo FROM skus WHERE id=?').get(s.id) as any).is_combo);
    for (const s of realSkus) {
      const f = rnd() < 0.4 ? 0.03 : rnd() < 0.5 ? 0.25 : 1; // 部分SKU库存紧张，用于触发补货建议
      for (let w = 1; w <= 9; w++) {
        if (w > 2 && rnd() < 0.35) continue;
        const qty = Math.round((w <= 2 ? ri(20, 260) : ri(0, 90)) * f);
        db.prepare('INSERT INTO inventory(warehouse_id,sku_id,qty_available,qty_locked,qty_transit) VALUES(?,?,?,?,?)').run(w, s.id, rnd() < 0.08 ? ri(0, 8) : qty, ri(0, 6), w > 2 && rnd() < 0.4 ? Math.round(ri(20, 120) * f) : 0);
      }
    }

    // MSKU 配对
    const prefix: Record<string, string> = { Amazon: 'AMZ', Shopify: 'SHP', 'TikTok Shop': 'TT', Temu: 'TM', eBay: 'EB', Walmart: 'WM' };
    const mskuMap: Record<number, { msku: string; sku_id: number; price: number }[]> = {};
    for (const st of storeRows) {
      mskuMap[st.id] = [];
      const factor = st.currency === 'JPY' ? 150 : st.currency === 'GBP' ? 0.82 : st.currency === 'EUR' ? 0.95 : 1;
      for (const s of skuMeta) {
        if (rnd() < (st.platform === 'Amazon' ? 0.2 : 0.4)) continue;
        const sku = (db.prepare('SELECT sku FROM skus WHERE id=?').get(s.id) as any).sku;
        const msku = `${prefix[st.platform]}-${st.site === '美国' ? 'US' : st.site === '英国' ? 'UK' : st.site === '德国' ? 'DE' : 'JP'}-${sku}`;
        const price = st.currency === 'JPY' ? Math.round(s.price * factor / 10) * 10 : +(s.price * factor).toFixed(2);
        const unpaired = rnd() < 0.05;
        db.prepare('INSERT INTO mskus(msku,store_id,sku_id,asin,fnsku,title,price,status) VALUES(?,?,?,?,?,?,?,?)')
          .run(msku, st.id, unpaired ? null : s.id, st.platform === 'Amazon' ? 'B0' + Math.random().toString(36).slice(2, 10).toUpperCase() : (st.platform + '-' + ri(100000, 999999)), st.platform === 'Amazon' ? 'X00' + Math.random().toString(36).slice(2, 9).toUpperCase() : null, 'VivaHome ' + sku, price, '在售');
        if (!unpaired) mskuMap[st.id].push({ msku, sku_id: s.id, price });
      }
    }

    // 物流
    const providers: [string, string][] = [['云途物流', '尾程/小包'], ['燕文物流', '尾程/小包'], ['4PX递四方', '尾程/小包'], ['UPS', '尾程/快递'], ['USPS', '尾程/快递'], ['DHL', '尾程/快递'], ['美森快船(货代:鑫运达)', '头程'], ['空运专线(货代:捷鸿)', '头程'], ['中欧卡航(货代:联宇)', '头程']];
    providers.forEach(p => db.prepare('INSERT INTO logistics_providers(name,type,contact,phone,settle_method) VALUES(?,?,?,?,?)').run(p[0], p[1], pick(['张经理', '黄小姐', '何先生']), '0755-' + ri(20000000, 89999999), pick(['月结', '周结', '预付'])));
    const channels: [number, string, string, string, string, number, number, string][] = [
      [1, '云途全球专线挂号', 'YT-THPHR', '小包专线', '7-12', 62, 18, '美国,英国,德国,加拿大'], [1, '云途特惠普货', 'YT-THZXR', '小包专线', '10-15', 48, 15, '美国,英国'],
      [2, '燕文航空挂号小包', 'YW-HKGH', '邮政小包', '12-20', 55, 12, '美国,英国,德国,日本'], [3, '4PX联邮通优先', '4PX-LYT', '小包专线', '8-12', 58, 16, '美国,德国,日本'],
      [4, 'UPS Ground (海外仓)', 'UPS-GND', '海外仓尾程', '2-5', 6, 45, '美国'], [5, 'USPS Ground Advantage', 'USPS-GA', '海外仓尾程', '2-5', 5, 32, '美国'],
      [6, 'DHL Paket (德国仓)', 'DHL-PKT', '海外仓尾程', '1-3', 4, 38, '德国'],
      [7, '美森快船 海运头程', 'MATSON', '头程海运', '18-25', 13.5, 0, '美国'], [8, '空运专线 头程', 'AIR-EXP', '头程空运', '7-10', 38, 0, '美国,英国,德国,日本'], [9, '中欧卡航 头程', 'TRUCK-EU', '头程卡航', '25-32', 16, 0, '德国,英国'],
    ];
    for (const c of channels) db.prepare('INSERT INTO logistics_channels(provider_id,name,code,type,transit_days,price_per_kg,base_fee,countries) VALUES(?,?,?,?,?,?,?,?)').run(...c);
    const rules: [string, number, string | null, string | null, number | null, number, number][] = [
      ['美国订单优先美西海外仓', 1, null, '美国', 5, 3, 6], ['美国大件走UPS', 2, null, '美国', 30, 3, 5], ['德国订单走德国仓', 3, null, '德国', 30, 5, 7],
      ['TikTok订单 国内直发云途', 5, 'TikTok Shop', null, 2, 1, 1], ['其他国家 国内直发燕文', 9, null, null, 2, 1, 3],
    ];
    for (const r of rules) db.prepare('INSERT INTO shipping_rules(name,priority,platform,country,max_weight,warehouse_id,channel_id) VALUES(?,?,?,?,?,?,?)').run(...r);

    // 审单规则
    const rv: [string, number, string, string, number][] = [
      ['订单金额超过 $300 人工审核', 1, '订单金额 > 300 USD', '转人工审核', 1], ['地址含 PO Box 标记异常', 2, '收货地址包含 "PO Box"', '标记异常', 1],
      ['黑名单买家拦截', 3, '买家在黑名单中', '拦截并标记', 1], ['单SKU数量>10 人工审核', 4, '单个SKU数量 > 10', '转人工审核', 1],
      ['普通订单自动审核通过', 10, '其余所有订单', '自动审核通过 → 待发货', 1], ['偏远地区附加费提醒', 5, '邮编属于偏远地区', '备注提醒', 0],
    ];
    for (const r of rv) db.prepare('INSERT INTO review_rules(name,priority,condition,action,enabled,hits) VALUES(?,?,?,?,?,?)').run(r[0], r[1], r[2], r[3], r[4], ri(10, 900));

    // 订单
    const countries: Record<string, string[]> = { '美国': ['美国'], '英国': ['英国'], '德国': ['德国', '法国', '意大利'], '日本': ['日本'] };
    const names = ['James Smith', 'Mary Johnson', 'Robert Brown', 'Patricia Davis', 'Michael Miller', 'Linda Wilson', 'David Moore', 'Emma Taylor', 'Oliver Thomas', 'Sophie Martin', 'Lukas Müller', 'Hannah Schmidt', '佐藤 健', '鈴木 花子', 'Jennifer Lee', 'Chris Walker', 'Daniel Hall', 'Laura Young'];
    const cities: Record<string, string[]> = { '美国': ['Los Angeles, CA 90012', 'Houston, TX 77002', 'New York, NY 10001', 'Seattle, WA 98101', 'Miami, FL 33101', 'Chicago, IL 60601'], '英国': ['London EC1A 1BB', 'Manchester M1 1AE', 'Leeds LS1 4AP'], '德国': ['Berlin 10115', 'München 80331', 'Hamburg 20095'], '法国': ['Paris 75001'], '意大利': ['Milano 20121'], '日本': ['東京都港区 105-0011', '大阪府大阪市 530-0001'] };
    const storeWeight = [30, 8, 8, 5, 10, 10, 4, 8, 6, 5];
    const totalW = storeWeight.reduce((a, b) => a + b);
    const pickStore = () => { let x = rnd() * totalW; for (let i = 0; i < storeWeight.length; i++) { x -= storeWeight[i]; if (x <= 0) return storeRows[i]; } return storeRows[0]; };
    const insOrder = db.prepare(`INSERT INTO orders(order_no,platform_order_no,store_id,status,fulfillment,buyer_name,country,address,currency,total_amount,shipping_income,ad_cost,other_cost,warehouse_id,channel_id,tracking_no,flag,remark,order_time,ship_time,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insItem = db.prepare('INSERT INTO order_items(order_id,msku,sku_id,qty,price) VALUES(?,?,?,?,?)');
    const N = 1200;
    for (let i = 0; i < N; i++) {
      const st = pickStore();
      const list = mskuMap[st.id]; if (!list.length) continue;
      const ago = Math.floor(Math.pow(rnd(), 1.15) * 60);
      const ot = daysAgo(ago);
      const isFBA = st.platform === 'Amazon' && rnd() < 0.78;
      let status: string;
      if (isFBA) status = ago < 1 ? '待发货' : ago < 6 ? '已发货' : '已完成';
      else status = ago < 2 ? pick(['待审核', '待审核', '待发货', '待发货']) : ago < 5 ? pick(['待发货', '已发货', '待审核']) : ago < 10 ? '已发货' : '已完成';
      if (rnd() < 0.04) status = '已取消';
      let flag: string | null = null;
      if (!isFBA && ['待审核', '待发货'].includes(status) && rnd() < 0.18) { status = '异常'; flag = pick(['地址异常', '库存不足', 'SKU未配对', '疑似重复订单']); }
      const country = pick(countries[st.site]);
      const nItems = rnd() < 0.82 ? 1 : ri(2, 3);
      const chosen = new Set<number>();
      const its: { msku: string; sku_id: number; qty: number; price: number }[] = [];
      for (let k = 0; k < nItems; k++) { const m = pick(list); if (chosen.has(m.sku_id)) continue; chosen.add(m.sku_id); its.push({ ...m, qty: rnd() < 0.85 ? 1 : ri(2, 4) }); }
      const goods = its.reduce((a, b) => a + b.price * b.qty, 0);
      const shipIncome = st.platform === 'Shopify' || st.platform === 'eBay' ? (st.currency === 'JPY' ? 0 : pick([0, 0, 4.99, 6.99])) : 0;
      const adRate = st.platform === 'Amazon' ? 0.04 + rnd() * 0.12 : st.platform === 'TikTok Shop' ? 0.05 + rnd() * 0.1 : st.platform === 'Shopify' ? 0.08 + rnd() * 0.1 : 0.02;
      const shipped = ['已发货', '已完成'].includes(status);
      const wh = isFBA ? (db.prepare("SELECT id FROM warehouses WHERE store_id=?").get(st.id) as any)?.id : (st.site === '美国' ? pick([3, 3, 4, 1]) : st.site === '德国' ? 5 : 1);
      const ch = isFBA ? null : wh === 3 || wh === 4 ? pick([5, 6]) : wh === 5 ? 7 : pick([1, 2, 3, 4]);
      const pon = st.platform === 'Amazon' ? `${ri(111, 114)}-${ri(1000000, 9999999)}-${ri(1000000, 9999999)}` : st.platform === 'Shopify' ? '#' + (10234 + i) : String(ri(5000000000, 9999999999)) + ri(100, 999);
      const tracking = shipped && !isFBA ? (ch === 5 ? '1Z' + ri(100000000, 999999999) + 'US' : ch === 6 ? '9400' + ri(100000000, 999999999) + '1234' : 'YT' + ri(1000000000, 9999999999)) : null;
      const st2 = new Date(ot.getTime() + ri(8, 40) * 3600e3);
      const oid = insOrder.run('SO' + day(ot).replace(/-/g, '').slice(2) + String(1000 + i), pon, st.id, status, isFBA ? 'FBA' : 'FBM', pick(names), country, pick(cities[country] || ['-']), st.currency, +goods.toFixed(2), shipIncome, +(goods * adRate).toFixed(2), 0, wh, ch, tracking, flag, null, fmt(ot), shipped ? fmt(st2) : null, fmt(ot)).lastInsertRowid as number;
      for (const it of its) insItem.run(oid, it.msku, it.sku_id, it.qty, it.price);
      calcOrderProfit(oid);
    }

    // 售后
    const doneOrders = db.prepare("SELECT id, currency, total_amount FROM orders WHERE status IN ('已发货','已完成') ORDER BY random() LIMIT 28").all() as any[];
    doneOrders.forEach((o, i) => db.prepare('INSERT INTO after_sales(as_no,order_id,type,reason,amount,currency,status,restock,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('AS' + String(260001 + i), o.id, pick(['退货退款', '仅退款', '仅退款', '补发', '换货']), pick(['商品损坏', '与描述不符', '买家不想要了', '物流超时', '尺寸不合适', '缺少配件']), +(o.total_amount * pick([1, 1, 0.5, 0.3])).toFixed(2), o.currency, pick(['待处理', '处理中', '已完成', '已完成', '已拒绝']), rnd() < 0.3 ? 1 : 0, fmt(daysAgo(ri(0, 30)))));

    // 采购单
    const poStatus = ['草稿', '待审核', '已下单', '已下单', '部分到货', '已完成', '已完成', '已完成', '已取消'];
    for (let i = 0; i < 18; i++) {
      const sup = ri(1, 7);
      const ago = ri(0, 50);
      const status = ago < 3 ? pick(['草稿', '待审核']) : pick(poStatus);
      const poid = db.prepare('INSERT INTO purchase_orders(po_no,supplier_id,warehouse_id,status,freight,pay_status,buyer,expected_date,remark,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run('PO' + day(daysAgo(ago, 10)).replace(/-/g, '').slice(2) + String(100 + i), sup, pick([1, 1, 2]), status, ri(0, 3) * 50, status === '已完成' ? '已付款' : status === '已下单' || status === '部分到货' ? pick(['已付定金', '未付款']) : '未付款', pick(['周采购', '吴采购']), day(daysAgo(ago - ri(7, 15), 10)), null, fmt(daysAgo(ago))).lastInsertRowid as number;
      const skus = db.prepare('SELECT id, purchase_cost FROM skus WHERE supplier_id=? AND is_combo=0 ORDER BY random() LIMIT ?').all(sup, ri(2, 4)) as any[];
      let total = 0;
      for (const s of skus) {
        const q = ri(3, 15) * 10;
        const rq = status === '已完成' ? q : status === '部分到货' ? Math.floor(q * 0.5) : 0;
        db.prepare('INSERT INTO purchase_order_items(po_id,sku_id,qty,received_qty,unit_price) VALUES(?,?,?,?,?)').run(poid, s.id, q, rq, s.purchase_cost);
        if (rq) db.prepare('INSERT INTO receipts(rc_no,po_id,sku_id,qty,qc_status,warehouse_id,operator,created_at) VALUES(?,?,?,?,?,?,?,?)').run('RC' + poid + s.id, poid, s.id, rq, '合格', 1, '仓管-小刘', fmt(daysAgo(Math.max(ago - 8, 0))));
        total += q * s.purchase_cost;
      }
      db.prepare('UPDATE purchase_orders SET total_amount=? WHERE id=?').run(+total.toFixed(2), poid);
    }

    // FBA货件
    const fbaSt = ['计划中', '已装箱', '已发货', '运输中', '运输中', '已签收', '已上架', '已上架', '已上架'];
    for (let i = 0; i < 12; i++) {
      const storeId = pick([1, 1, 1, 2, 3, 4]);
      const toWh = (db.prepare('SELECT id FROM warehouses WHERE store_id=?').get(storeId) as any).id;
      const status = fbaSt[i % fbaSt.length];
      const ago = status === '计划中' ? ri(0, 3) : status === '已上架' ? ri(25, 55) : ri(5, 25);
      const prov = pick([7, 8, 9].filter(p => storeId === 1 || storeId === 4 ? p !== 9 : true));
      const shid = db.prepare('INSERT INTO fba_shipments(shipment_no,fba_shipment_id,plan_name,store_id,from_wh,to_wh,status,provider_id,channel,tracking_no,total_freight,alloc_method,ship_date,eta,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run('FS' + day(daysAgo(ago, 9)).replace(/-/g, '').slice(2) + String(10 + i), 'FBA1' + Math.random().toString(36).slice(2, 10).toUpperCase(), `${storeRows[storeId - 1].name} 第${i + 1}批补货`, storeId, pick([1, 2]), toWh, status, prov, prov === 7 ? '美森快船' : prov === 8 ? '空运专线' : '中欧卡航',
          status === '计划中' || status === '已装箱' ? null : pick(['MATU', 'SF', 'COSU']) + ri(10000000, 99999999), 0, pick(['按重量', '按重量', '按体积']), status === '计划中' || status === '已装箱' ? null : day(daysAgo(ago - 2)), day(daysAgo(ago - (prov === 8 ? 10 : 25))), fmt(daysAgo(ago))).lastInsertRowid as number;
      const ms = db.prepare('SELECT * FROM mskus WHERE store_id=? AND sku_id IS NOT NULL AND sku_id IN (SELECT id FROM skus WHERE is_combo=0) ORDER BY random() LIMIT ?').all(storeId, ri(3, 6)) as any[];
      let totalW = 0, box = 0;
      for (const m of ms) {
        const q = ri(4, 30) * 10;
        const w = (db.prepare('SELECT weight FROM skus WHERE id=?').get(m.sku_id) as any).weight;
        totalW += w * q;
        db.prepare('INSERT INTO fba_shipment_items(shipment_id,sku_id,msku,fnsku,qty,received_qty) VALUES(?,?,?,?,?,?)').run(shid, m.sku_id, m.msku, m.fnsku, q, status === '已上架' ? q - ri(0, 3) : status === '已签收' ? Math.floor(q * 0.6) : 0);
        const boxes = Math.ceil(w * q / 18);
        for (let b = 0; b < boxes; b++) { box++; db.prepare('INSERT INTO fba_boxes(shipment_id,box_no,weight,length,width,height,contents) VALUES(?,?,?,?,?,?,?)').run(shid, 'U' + String(box).padStart(3, '0'), +(Math.min(18, w * q - b * 18) + 0.8).toFixed(1), 60, 40, 40, `${m.msku} × ${Math.ceil(q / boxes)}`); }
      }
      const perKg = prov === 7 ? 9.5 : prov === 8 ? 26 : 12;
      db.prepare('UPDATE fba_shipments SET total_freight=? WHERE id=?').run(+(totalW * perKg + 300).toFixed(2), shid);
      allocateFreight(shid, false);
      if (!['计划中', '已装箱'].includes(status)) {
        const evs = [['货物已从深圳仓提货', '深圳'], ['已报关出口', '盐田港'], ['船舶/航班已离港', '盐田港'], ['抵达目的港', '洛杉矶长滩港'], ['清关完成', '洛杉矶'], ['卡车派送至FBA仓', 'ONT8'], ['亚马逊仓库已签收', 'ONT8']];
        const n = status === '已发货' ? 2 : status === '运输中' ? 4 : 7;
        for (let e = 0; e < n; e++) db.prepare('INSERT INTO tracking_events(ref_type,ref_id,event,location,time) VALUES(?,?,?,?,?)').run('fba', shid, evs[e][0], evs[e][1], fmt(daysAgo(Math.max(ago - e * 3, 0))));
      }
    }
    // 重新计算订单利润（头程已更新）
    for (const o of db.prepare('SELECT id FROM orders').all() as any[]) calcOrderProfit(o.id);

    // 库存流水 & 调拨
    const moveTypes = ['采购入库', '销售出库', '调拨出库', '调拨入库', '盘盈', '盘亏', '退货入库', '其他出库'];
    for (let i = 0; i < 160; i++) {
      const inv = db.prepare('SELECT * FROM inventory ORDER BY random() LIMIT 1').get() as any;
      const t = pick(moveTypes); const q = ri(1, 60) * (['销售出库', '调拨出库', '盘亏', '其他出库'].includes(t) ? -1 : 1);
      const before = Math.max(inv.qty_available - q, 0);
      db.prepare('INSERT INTO inventory_ledger(warehouse_id,sku_id,type,qty,before_qty,after_qty,ref_no,remark,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(inv.warehouse_id, inv.sku_id, t, q, before, before + q, (t.includes('采购') ? 'RC' : t.includes('调拨') ? 'TF' : t.includes('盘') ? 'ST' : t.includes('销售') ? 'SO' : 'OT') + ri(100000, 999999), '', pick(['仓管-小刘', '仓管-阿强', 'system']), fmt(daysAgo(ri(0, 40))));
    }
    for (let i = 0; i < 14; i++) {
      const t = pick(['入库', '出库', '调拨', '调拨']);
      const s = pick(realSkus);
      db.prepare('INSERT INTO stock_moves(move_no,type,from_wh,to_wh,sku_id,qty,status,remark,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run((t === '调拨' ? 'TF' : t === '入库' ? 'IN' : 'OUT') + String(2610000 + i), t, t === '入库' ? null : pick([1, 2]), t === '出库' ? null : pick([3, 4, 5]), s.id, ri(2, 30) * 10, pick(['已完成', '已完成', '在途']), t === '调拨' ? '海外仓备货' : t === '入库' ? '其他入库' : '样品出库', pick(['仓管-小刘', '仓管-阿强']), fmt(daysAgo(ri(0, 30))));
    }
    for (let i = 0; i < 10; i++) {
      const inv = db.prepare('SELECT * FROM inventory WHERE warehouse_id IN (1,2,3) ORDER BY random() LIMIT 1').get() as any;
      const actual = inv.qty_available + ri(-5, 3);
      db.prepare('INSERT INTO stocktakes(st_no,warehouse_id,sku_id,book_qty,actual_qty,diff,status,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('ST' + String(26100 + i), inv.warehouse_id, inv.sku_id, inv.qty_available, actual, actual - inv.qty_available, i < 3 ? '待确认' : '已确认', '仓管-小刘', fmt(daysAgo(ri(0, 30))));
    }

    // 广告
    for (const st of storeRows.filter((s: any) => ['Amazon', 'TikTok Shop', 'Shopify', 'Walmart'].includes(s.platform))) {
      const n = st.platform === 'Amazon' ? ri(5, 8) : ri(2, 4);
      const types = st.platform === 'Amazon' ? ['SP', 'SP', 'SB', 'SD'] : st.platform === 'TikTok Shop' ? ['GMV Max', '短视频推广', '直播推广'] : st.platform === 'Shopify' ? ['Google Shopping', 'Meta Ads'] : ['Sponsored Products'];
      for (let i = 0; i < n; i++) {
        const sk = pick(spus);
        const type = pick(types);
        const spend = +(ri(80, 2400) * (st.currency === 'JPY' ? 150 : 1)).toFixed(2);
        const acos = 0.12 + rnd() * 0.4;
        const clicks = ri(300, 9000);
        db.prepare('INSERT INTO ad_campaigns(store_id,name,type,status,budget,spend,sales,impressions,clicks,orders) VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(st.id, `${type}-${sk[1]}-${pick(['自动', '手动-精准', '手动-词组', '商品定位', '品牌'])}`, type, rnd() < 0.8 ? '投放中' : '已暂停', +(ri(20, 150) * (st.currency === 'JPY' ? 150 : 1)).toFixed(2), spend, +(spend / acos).toFixed(2), clicks * ri(15, 60), clicks, Math.floor(clicks * (0.05 + rnd() * 0.1)));
      }
      for (let d = 29; d >= 0; d--) {
        const base = st.platform === 'Amazon' ? 120 : 40;
        const spend = +(base * (0.7 + rnd() * 0.6) * (st.currency === 'JPY' ? 150 : 1)).toFixed(2);
        db.prepare('INSERT INTO ad_daily(store_id,date,spend,sales) VALUES(?,?,?,?)').run(st.id, day(daysAgo(d)), spend, +(spend / (0.18 + rnd() * 0.25)).toFixed(2));
      }
    }

    // 结算
    for (const st of storeRows) {
      for (let k = 0; k < 4; k++) {
        const end = daysAgo(k * 14 + 1, 0), start = daysAgo(k * 14 + 14, 0);
        const sales = (db.prepare("SELECT COALESCE(SUM(total_amount+shipping_income),0) v FROM orders WHERE store_id=? AND status!='已取消' AND order_time BETWEEN ? AND ?").get(st.id, fmt(start), fmt(end)) as any).v;
        const fees = (db.prepare("SELECT COALESCE(SUM(platform_fee+fba_fee),0) v FROM orders WHERE store_id=? AND status!='已取消' AND order_time BETWEEN ? AND ?").get(st.id, fmt(start), fmt(end)) as any).v;
        const ads = (db.prepare("SELECT COALESCE(SUM(ad_cost),0) v FROM orders WHERE store_id=? AND status!='已取消' AND order_time BETWEEN ? AND ?").get(st.id, fmt(start), fmt(end)) as any).v;
        const refunds = +(sales * (0.01 + rnd() * 0.03)).toFixed(2);
        db.prepare('INSERT INTO settlements(settle_no,store_id,period_start,period_end,currency,sales,fees,refunds,ads,net,status,transfer_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
          .run('ST-' + st.id + '-' + (2620 - k), st.id, day(start), day(end), st.currency, +sales.toFixed(2), +fees.toFixed(2), refunds, +ads.toFixed(2), +(sales - fees - refunds - ads).toFixed(2), k === 0 ? '结算中' : '已到账', k === 0 ? null : day(daysAgo(k * 14 - 2)));
      }
    }

    // 角色/用户
    const allPerms = ['dashboard', 'product', 'order', 'purchase', 'inventory', 'fba', 'logistics', 'finance', 'ads', 'system'];
    const roles: [string, string, string[], string][] = [
      ['超级管理员', 'admin', allPerms, '拥有全部权限'], ['运营', 'operator', ['dashboard', 'product', 'order', 'ads', 'fba'], '负责店铺运营、Listing与广告'],
      ['采购', 'purchaser', ['dashboard', 'purchase', 'product', 'inventory'], '负责采购计划与供应商'], ['仓管', 'warehouse', ['inventory', 'fba', 'logistics', 'order'], '负责出入库与发货'],
      ['财务', 'finance', ['dashboard', 'finance', 'order'], '负责利润核算与结算对账'],
    ];
    for (const r of roles) db.prepare('INSERT INTO roles(name,code,permissions,remark) VALUES(?,?,?,?)').run(r[0], r[1], JSON.stringify(r[2]), r[3]);
    const users: [string, string, string, number][] = [['admin', '系统管理员', 'admin@vivahome.com', 1], ['zhangxiao', '张晓', 'zhangxiao@vivahome.com', 2], ['liwen', '李雯', 'liwen@vivahome.com', 2], ['zhoucg', '周采购', 'zhou@vivahome.com', 3], ['liucang', '刘仓管', 'liu@vivahome.com', 4], ['chencw', '陈财务', 'chen@vivahome.com', 5]];
    for (const u of users) db.prepare('INSERT INTO users(username,password_hash,name,email,phone,role_id,status,last_login) VALUES(?,?,?,?,?,?,?,?)').run(u[0], hashPwd(u[0] === 'admin' ? 'admin123' : '123456'), u[1], u[2], '138' + ri(10000000, 99999999), u[3], '启用', fmt(daysAgo(ri(0, 5))));
    const acts: [string, string, string][] = [['订单管理', '审核订单', '批量审核 12 个订单'], ['商品管理', '编辑SKU', '修改 VH1001-01 采购成本'], ['采购管理', '创建采购单', '新建采购单'], ['仓储库存', '库存调拨', '深圳仓 → 美西海外仓 调拨 200 件'], ['FBA与头程', '创建货件', '创建 FBA 货件计划'], ['系统设置', '店铺授权', '重新授权 VivaHome-US'], ['财务管理', '更新汇率', 'USD 汇率更新为 7.12'], ['订单管理', '拆分订单', '拆分订单为 2 个包裹']];
    for (let i = 0; i < 60; i++) { const a = pick(acts); db.prepare('INSERT INTO operation_logs(user,module,action,detail,ip,created_at) VALUES(?,?,?,?,?,?)').run(pick(['admin', 'zhangxiao', 'liwen', 'zhoucg', 'liucang', 'chencw']), a[0], a[1], a[2], '192.168.1.' + ri(10, 200), fmt(daysAgo(ri(0, 20)))); }
  });
  tx();
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedAll();
  console.log('seeded', DB_FILE, db.prepare('SELECT COUNT(*) c FROM orders').get(), db.prepare('SELECT COUNT(*) c FROM skus').get());
}
