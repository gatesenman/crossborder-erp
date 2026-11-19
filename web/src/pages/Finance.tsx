import { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Tabs, DatePicker, Button, Space, Row, Col, message, Tooltip, Tag, Modal, Popconfirm, Segmented } from 'antd';
import { ReloadOutlined, DownloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CrudTable, { CrudRef } from '../components/CrudTable';
import Chart from '../components/Chart';
import { api, post, put } from '../api';
import { useApp, useOptions } from '../ctx';
import { money, pct, profitText, StatusTag, PlatformTag, opt, num } from '../utils';
import { OrderDetail } from './Order';

const DIMS = [{ key: 'sku', label: '按 SKU' }, { key: 'store', label: '按店铺' }, { key: 'site', label: '按站点' }, { key: 'platform', label: '按平台' }, { key: 'day', label: '按日期' }];

export function ProfitPage() {
  const { storeId } = useApp(); const [dim, setDim] = useState('sku'); const [range, setRange] = useState<any>([dayjs().subtract(29, 'day'), dayjs()]);
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const load = () => { setLoading(true); api('/finance/profit', { params: { dim, storeId: storeId || undefined, dateFrom: range?.[0]?.format('YYYY-MM-DD'), dateTo: range?.[1]?.format('YYYY-MM-DD') } }).then(setRows).finally(() => setLoading(false)); };
  useEffect(load, [dim, storeId, range]);
  const T = useMemo(() => { const t: any = { units: 0, orders: 0, revenue: 0, platform_fee: 0, fba_fee: 0, ad_cost: 0, cogs: 0, freight: 0, other: 0, profit: 0 }; rows.forEach(r => Object.keys(t).forEach(k => t[k] += Number(r[k] || 0))); t.margin = t.revenue ? t.profit / t.revenue : 0; return t; }, [rows]);
  const chartRows = dim === 'day' ? [...rows].reverse() : rows.slice(0, 15);
  const exportCsv = () => { const head = ['维度', '说明', '销量', '订单数', '销售额', '平台佣金', 'FBA费', '广告费', '商品成本', '物流成本', '其他', '毛利润', '毛利率']; const lines = [head, ...rows.map(r => [r.name, r.sub, r.units, r.orders, r.revenue, r.platform_fee, r.fba_fee, r.ad_cost, r.cogs, r.freight, r.other, r.profit, pct(r.margin)])].map(l => l.map(x => `"${x ?? ''}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines], { type: 'text/csv' })); a.download = `利润报表_${dim}.csv`; a.click(); };
  const kpi = [{ t: '销售额', v: money(T.revenue) }, { t: '平台费用', v: money(T.platform_fee + T.fba_fee) }, { t: '广告费', v: money(T.ad_cost) }, { t: '商品成本(含头程)', v: money(T.cogs) }, { t: '尾程物流', v: money(T.freight) }, { t: '毛利润', v: <span style={{ color: T.profit < 0 ? '#cf1322' : '#389e0d' }}>{money(T.profit)}</span> }, { t: '毛利率', v: pct(T.margin) }];
  return <div>
    <div className="panel">
      <Row justify="space-between" align="middle">
        <Space><Segmented value={dim} onChange={v => setDim(v as string)} options={DIMS.map(d => ({ label: d.label, value: d.key }))} />
          <DatePicker.RangePicker value={range} onChange={setRange} presets={[{ label: '近7天', value: [dayjs().subtract(6, 'day'), dayjs()] }, { label: '近30天', value: [dayjs().subtract(29, 'day'), dayjs()] }, { label: '本月', value: [dayjs().startOf('month'), dayjs()] }, { label: '近90天', value: [dayjs().subtract(89, 'day'), dayjs()] }]} /></Space>
        <Space><Tooltip title="利润 = (商品收入+运费收入 − 平台佣金 − FBA配送费 − 广告费) × 汇率 − 商品成本(采购+头程+包材) − 尾程运费 − 其他费用。SKU维度下订单级费用按商品金额占比分摊。"><QuestionCircleOutlined style={{ color: '#888' }} /> <span style={{ color: '#888' }}>计算口径</span></Tooltip>
          <Popconfirm title="按最新成本与汇率重算全部订单利润？" onConfirm={async () => { const r = await post('/finance/recalc'); message.success(`已重算 ${r.count} 个订单`); load(); }}><Button icon={<ReloadOutlined />}>重算利润</Button></Popconfirm>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>导出</Button></Space>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>{kpi.map(k => <Col key={k.t} flex={1}><div className="kpi" style={{ padding: '10px 14px' }}><div className="t">{k.t}</div><div className="v" style={{ fontSize: 20 }}>{k.v}</div></div></Col>)}</Row>
    </div>
    <div className="panel">
      <div className="panel-title">{DIMS.find(d => d.key === dim)?.label}利润分析{dim !== 'day' && <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>（Top 15）</span>}</div>
      <Chart height={260} option={{ tooltip: { trigger: 'axis' }, legend: { data: ['销售额', '毛利润', '毛利率'] }, grid: { left: 60, right: 50, top: 36, bottom: 50 }, xAxis: { type: 'category', data: chartRows.map(r => r.name), axisLabel: { rotate: dim === 'sku' ? 30 : 0, fontSize: 11 } }, yAxis: [{ type: 'value', name: '¥' }, { type: 'value', name: '毛利率', axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + '%' } }], series: [{ name: '销售额', type: 'bar', data: chartRows.map(r => r.revenue), barMaxWidth: 26 }, { name: '毛利润', type: 'bar', data: chartRows.map(r => r.profit), barMaxWidth: 26 }, { name: '毛利率', type: 'line', yAxisIndex: 1, smooth: true, data: chartRows.map(r => r.margin) }] }} />
    </div>
    <div className="table-wrap">
      <Table rowKey="key" size="small" bordered loading={loading} dataSource={rows} scroll={{ x: 1500 }} pagination={{ pageSize: 20, size: 'small', showTotal: t => `共 ${t} 条` }}
        columns={[{ title: DIMS.find(d => d.key === dim)?.label.replace('按 ', '').replace('按', ''), dataIndex: 'name', width: 160, fixed: 'left', render: (v, r) => <div><b className={dim === 'sku' ? 'mono' : ''}>{dim === 'platform' ? <PlatformTag v={v} /> : v}</b>{r.sub && <div style={{ color: '#999', fontSize: 12 }}>{r.sub}</div>}</div> },
          { title: '销量', dataIndex: 'units', width: 70, align: 'right', sorter: (a, b) => a.units - b.units }, { title: '订单数', dataIndex: 'orders', width: 70, align: 'right', sorter: (a, b) => a.orders - b.orders },
          { title: '销售额', dataIndex: 'revenue', width: 110, align: 'right', sorter: (a, b) => a.revenue - b.revenue, render: v => money(v) },
          { title: '平台佣金', dataIndex: 'platform_fee', width: 100, align: 'right', render: v => money(v) }, { title: 'FBA配送费', dataIndex: 'fba_fee', width: 100, align: 'right', render: v => money(v) }, { title: '广告费', dataIndex: 'ad_cost', width: 100, align: 'right', render: v => money(v) },
          { title: '商品成本', dataIndex: 'cogs', width: 100, align: 'right', render: v => money(v) }, { title: '尾程物流', dataIndex: 'freight', width: 90, align: 'right', render: v => money(v) }, { title: '其他', dataIndex: 'other', width: 80, align: 'right', render: v => money(v) },
          { title: '毛利润', dataIndex: 'profit', width: 110, align: 'right', fixed: 'right', sorter: (a, b) => a.profit - b.profit, render: v => profitText(v) },
          { title: '毛利率', dataIndex: 'margin', width: 80, align: 'right', fixed: 'right', sorter: (a, b) => a.margin - b.margin, render: v => <Tag color={v < 0 ? 'red' : v < 0.15 ? 'orange' : 'green'}>{pct(v)}</Tag> }]}
        summary={() => rows.length ? <Table.Summary fixed><Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
          <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>{['units', 'orders'].map((k, i) => <Table.Summary.Cell key={k} index={i + 1} align="right">{num(T[k])}</Table.Summary.Cell>)}
          {['revenue', 'platform_fee', 'fba_fee', 'ad_cost', 'cogs', 'freight', 'other'].map((k, i) => <Table.Summary.Cell key={k} index={i + 3} align="right">{money(T[k])}</Table.Summary.Cell>)}
          <Table.Summary.Cell index={10} align="right">{profitText(T.profit)}</Table.Summary.Cell><Table.Summary.Cell index={11} align="right">{pct(T.margin)}</Table.Summary.Cell></Table.Summary.Row></Table.Summary> : null} />
    </div>
  </div>;
}

export function OrderProfitPage() {
  const o = useOptions(); const [detail, setDetail] = useState<number>();
  return <>
    <CrudTable resource="orders" extraParams={{ status: '待审核,待发货,已发货,已完成,异常' }} searchPlaceholder="订单号 / 平台单号" onRowClick={r => setDetail(r.id)}
      filters={[{ name: 'platform', label: '平台', type: 'select', options: o.stores.length ? opt([...new Set(o.stores.map(s => s.platform))] as string[]) : [] }, { name: 'fulfillment', label: '配送', type: 'select', options: opt(['FBA', 'FBM']) }, { name: 'date', label: '下单日期', type: 'dateRange', span: 6 }]}
      summary={(d: any) => d?.summary && <Space size={24}><span>订单 <b>{num(d.summary.c)}</b></span><span>销售额 <b>{money(d.summary.revenue)}</b></span><span>毛利润 {profitText(d.summary.profit)}</span><span>毛利率 <b>{pct(d.summary.revenue ? d.summary.profit / d.summary.revenue : 0)}</b></span></Space>}
      columns={[{ title: '订单号', dataIndex: 'order_no', width: 170, fixed: 'left', render: v => <span className="mono" style={{ color: '#1668dc' }}>{v}</span> }, { title: '店铺', dataIndex: 'store_name', width: 140 }, { title: '配送', dataIndex: 'fulfillment', width: 60 }, { title: '下单时间', dataIndex: 'order_time', width: 150, sorter: true },
        { title: '订单金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '平台佣金', dataIndex: 'platform_fee', width: 90, align: 'right', render: (v, r) => money(v, r.currency) }, { title: 'FBA费', dataIndex: 'fba_fee', width: 80, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '广告', dataIndex: 'ad_cost', width: 80, align: 'right', render: (v, r) => money(v, r.currency) },
        { title: '汇率', dataIndex: 'fx_rate', width: 70, align: 'right' }, { title: '收入(¥)', dataIndex: 'revenue_cny', width: 100, align: 'right', sorter: true, render: v => money(v) }, { title: '商品成本', dataIndex: 'cogs', width: 90, align: 'right', render: v => money(v) }, { title: '尾程物流', dataIndex: 'freight_cost', width: 90, align: 'right', render: v => money(v) },
        { title: '毛利润', dataIndex: 'profit_cny', width: 100, align: 'right', fixed: 'right', sorter: true, render: v => profitText(v) }, { title: '毛利率', dataIndex: 'margin', width: 80, align: 'right', fixed: 'right', sorter: true, render: v => <Tag color={v < 0 ? 'red' : v < 0.15 ? 'orange' : 'green'}>{pct(v)}</Tag> }]} scrollX={1700} />
    <OrderDetail id={detail} onClose={() => setDetail(undefined)} onChanged={() => { }} />
  </>;
}

export function SettlementsPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  return <CrudTable ref={ref} resource="settlements" searchPlaceholder="结算单号" statusTabs={{ field: 'status', items: ['结算中', '已到账'] }}
    filters={[{ name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }]}
    rowActions={r => r.status !== '已到账' ? <Popconfirm title="确认该结算款已到账？" onConfirm={async () => { await put(`/r/settlements/${r.id}`, { status: '已到账', transfer_date: dayjs().format('YYYY-MM-DD') }); message.success('已标记到账'); ref.current?.reload(); }}><a>确认到账</a></Popconfirm> : null} actionWidth={90}
    columns={[{ title: '结算单号', dataIndex: 'settle_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '店铺', dataIndex: 'store_name', width: 150 }, { title: '平台', dataIndex: 'platform', width: 100, render: v => <PlatformTag v={v} /> }, { title: '结算周期', width: 190, render: (_, r) => `${r.period_start} ~ ${r.period_end}` }, { title: '币种', dataIndex: 'currency', width: 60 }, { title: '销售额', dataIndex: 'sales', width: 110, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '平台费用', dataIndex: 'fees', width: 100, align: 'right', render: (v, r) => money(-v, r.currency) }, { title: '退款', dataIndex: 'refunds', width: 90, align: 'right', render: (v, r) => money(-v, r.currency) }, { title: '广告', dataIndex: 'ads', width: 90, align: 'right', render: (v, r) => money(-v, r.currency) }, { title: '净结算', dataIndex: 'net', width: 110, align: 'right', render: (v, r) => <b>{money(v, r.currency)}</b> }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '到账日期', dataIndex: 'transfer_date', width: 100, render: v => v || '-' }]} scrollX={1500} />;
}

export function RatesPage() {
  return <CrudTable resource="exchange_rates" useStore={false} canEdit canCreate formTitle="汇率" createText="新增币种" searchPlaceholder="币种"
    title={<span style={{ color: '#888', fontSize: 12 }}>订单利润按下列汇率折算为人民币，修改后可在「利润报表」点击「重算利润」生效</span>}
    formFields={[{ name: 'currency', label: '币种代码', required: true }, { name: 'name', label: '名称' }, { name: 'rate_to_cny', label: '1 单位兑人民币', type: 'number', required: true }]}
    columns={[{ title: '币种', dataIndex: 'currency', width: 100, render: v => <b className="mono">{v}</b> }, { title: '名称', dataIndex: 'name', width: 140 }, { title: '汇率 (→ CNY)', dataIndex: 'rate_to_cny', width: 140, align: 'right', render: v => <b>{Number(v).toFixed(4)}</b> }, { title: '100 外币 ≈', width: 140, align: 'right', render: (_, r) => money(r.rate_to_cny * 100) }, { title: '更新时间', dataIndex: 'updated_at', width: 160 }]} />;
}
