import { useEffect, useState } from 'react';
import { Row, Col, Segmented, Table, Spin, Progress, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../ctx';
import Chart from '../components/Chart';
import { money, num, pct, PlatformTag, profitText } from '../utils';

export default function Dashboard() {
  const { storeId } = useApp(); const nav = useNavigate();
  const [days, setDays] = useState(30); const [d, setD] = useState<any>(null);
  useEffect(() => { setD(null); api('/dashboard', { params: { days, storeId } }).then(setD); }, [days, storeId]);
  if (!d) return <div style={{ textAlign: 'center', padding: 100 }}><Spin /></div>;
  const chg = (a: number, b: number) => { if (!b) return null; const r = (a - b) / b; return <span className={r >= 0 ? 'up' : 'down'}>{r >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(r * 100).toFixed(1)}%</span>; };
  const kpis = [
    { t: '销售额 (CNY)', v: money(d.cur.sales), c: chg(d.cur.sales, d.last.sales) },
    { t: '订单量', v: num(d.cur.orders), c: chg(d.cur.orders, d.last.orders), sub: `销量 ${num(d.cur.units)} 件` },
    { t: '毛利润 (CNY)', v: money(d.cur.profit), c: chg(d.cur.profit, d.last.profit), sub: `利润率 ${pct(d.cur.sales ? d.cur.profit / d.cur.sales : 0)}` },
    { t: '广告花费 (CNY)', v: money(d.cur.ad), c: chg(d.cur.ad, d.last.ad), sub: `ACoAS ${pct(d.cur.sales ? d.cur.ad / d.cur.sales : 0)}` },
    { t: '客单价 (CNY)', v: money(d.cur.orders ? d.cur.sales / d.cur.orders : 0), c: chg(d.cur.orders ? d.cur.sales / d.cur.orders : 0, d.last.orders ? d.last.sales / d.last.orders : 0) },
    { t: '库存预警 SKU', v: num(d.alertCount), sub: '低于安全库存', danger: true },
  ];
  const todo = [['待审核订单', d.todo.pendingReview, '/order/list?status=待审核'], ['待发货订单', d.todo.pendingShip, '/order/list?status=待发货'], ['异常订单', d.todo.abnormal, '/order/list?status=异常'], ['待处理售后', d.todo.afterSales, '/order/after-sales'], ['待审采购单', d.todo.poPending, '/purchase/orders'], ['头程在途货件', d.todo.fbaTransit, '/fba/shipments'], ['未配对MSKU', d.todo.unpaired, '/product/msku?paired=0'], ['授权异常店铺', d.todo.authExpired, '/system/stores']];
  return (
    <div>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px' }}>
        <div style={{ fontWeight: 600 }}>经营概览 <span style={{ color: '#999', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>数据口径：订单下单时间，金额已按汇率折算为人民币，不含已取消订单</span></div>
        <Segmented size="small" value={days} onChange={v => setDays(v as number)} options={[{ label: '近7天', value: 7 }, { label: '近14天', value: 14 }, { label: '近30天', value: 30 }, { label: '近60天', value: 60 }]} />
      </div>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {kpis.map(k => <Col span={4} key={k.t}><div className="kpi"><div className="t">{k.t}</div><div className="v" style={{ color: k.danger ? '#cf1322' : undefined }}>{k.v}</div><div className="s">{k.c ? <>环比 {k.c}</> : null} {k.sub && <span style={{ marginLeft: k.c ? 8 : 0 }}>{k.sub}</span>}</div></div></Col>)}
      </Row>
      <div className="panel"><div className="panel-title">待办事项</div>
        <Row>{todo.map(t => <Col span={3} key={t[0] as string}><div className="todo-item" onClick={() => nav(t[2] as string)}><div className="n" style={{ color: (t[0] as string).includes('异常') && t[1] ? '#cf1322' : undefined }}>{t[1] as number}</div><div className="l">{t[0]}</div></div></Col>)}</Row>
      </div>
      <Row gutter={12}>
        <Col span={16}><div className="panel"><div className="panel-title">销售趋势（按日）</div>
          <Chart height={300} option={{ tooltip: { trigger: 'axis' }, legend: { data: ['销售额', '利润', '订单量'], top: 0 }, grid: { left: 50, right: 50, top: 36, bottom: 30 }, xAxis: { type: 'category', data: d.trend.map((x: any) => x.d.slice(5)) }, yAxis: [{ type: 'value', name: 'CNY' }, { type: 'value', name: '单', splitLine: { show: false } }], series: [{ name: '销售额', type: 'bar', data: d.trend.map((x: any) => x.sales), barMaxWidth: 16 }, { name: '利润', type: 'line', smooth: true, data: d.trend.map((x: any) => x.profit) }, { name: '订单量', type: 'line', yAxisIndex: 1, smooth: true, data: d.trend.map((x: any) => x.orders) }] }} />
        </div></Col>
        <Col span={8}><div className="panel"><div className="panel-title">平台销售占比</div>
          <Chart height={300} option={{ tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' }, legend: { bottom: 0, type: 'scroll' }, series: [{ type: 'pie', radius: ['42%', '68%'], center: ['50%', '45%'], data: d.byPlatform, label: { formatter: '{b}\n{d}%' } }] }} />
        </div></Col>
      </Row>
      <Row gutter={12}>
        <Col span={8}><div className="panel"><div className="panel-title">站点销售额</div>
          <Chart height={260} option={{ tooltip: { trigger: 'axis' }, grid: { left: 60, right: 20, top: 10, bottom: 25 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: d.bySite.map((x: any) => x.name).reverse() }, series: [{ type: 'bar', data: d.bySite.map((x: any) => x.value).reverse(), barMaxWidth: 18, itemStyle: { color: '#13c2c2' } }] }} />
        </div></Col>
        <Col span={8}><div className="panel"><div className="panel-title">广告花费 vs 广告销售额</div>
          <Chart height={260} option={{ tooltip: { trigger: 'axis' }, legend: { top: 0 }, grid: { left: 55, right: 20, top: 30, bottom: 25 }, xAxis: { type: 'category', data: d.adTrend.map((x: any) => x.d.slice(5)) }, yAxis: { type: 'value' }, series: [{ name: '广告花费', type: 'line', areaStyle: { opacity: .15 }, smooth: true, data: d.adTrend.map((x: any) => x.spend), itemStyle: { color: '#fa8c16' } }, { name: '广告销售额', type: 'line', smooth: true, data: d.adTrend.map((x: any) => x.sales), itemStyle: { color: '#722ed1' } }] }} />
        </div></Col>
        <Col span={8}><div className="panel"><div className="panel-title">库存预警（海外仓 / FBA）<a onClick={() => nav('/inventory/stock?below_safety=1')} style={{ fontSize: 12, fontWeight: 400 }}>查看全部</a></div>
          <Table size="small" pagination={false} rowKey={(r: any) => r.sku + r.warehouse} dataSource={d.alerts.slice(0, 6)} scroll={{ y: 220 }} columns={[{ title: 'SKU', dataIndex: 'sku', width: 100, render: v => <span className="mono">{v}</span> }, { title: '仓库', dataIndex: 'warehouse', ellipsis: true }, { title: '可用/安全', width: 120, render: (_, r: any) => <Progress size="small" percent={Math.round(r.qty_available / r.safety_stock * 100)} status="exception" format={() => `${r.qty_available}/${r.safety_stock}`} /> }]} />
        </div></Col>
      </Row>
      <Row gutter={12}>
        <Col span={14}><div className="panel"><div className="panel-title">店铺业绩排行</div>
          <Table size="small" pagination={false} rowKey="name" dataSource={d.byStore} columns={[{ title: '店铺', dataIndex: 'name' }, { title: '平台', dataIndex: 'platform', render: v => <PlatformTag v={v} /> }, { title: '站点', dataIndex: 'site' }, { title: '订单', dataIndex: 'orders', align: 'right' }, { title: '销售额', dataIndex: 'sales', align: 'right', render: v => money(v) }, { title: '广告费', dataIndex: 'ad', align: 'right', render: v => money(v) }, { title: '利润', dataIndex: 'profit', align: 'right', render: v => profitText(v) }, { title: '利润率', align: 'right', render: (_, r: any) => pct(r.sales ? r.profit / r.sales : 0) }]} />
        </div></Col>
        <Col span={10}><div className="panel"><div className="panel-title">热销 SKU TOP 8</div>
          <Table size="small" pagination={false} rowKey="sku" dataSource={d.topSku} columns={[{ title: '#', width: 36, render: (_, __, i) => <Tag color={i < 3 ? 'orange' : 'default'}>{i + 1}</Tag> }, { title: 'SKU', dataIndex: 'sku', render: v => <span className="mono">{v}</span> }, { title: '品名', dataIndex: 'name', ellipsis: true }, { title: '销量', dataIndex: 'units', align: 'right' }, { title: '销售额', dataIndex: 'sales', align: 'right', render: v => money(v) }]} />
        </div></Col>
      </Row>
    </div>
  );
}
