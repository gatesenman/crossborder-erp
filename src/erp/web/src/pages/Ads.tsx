import { useEffect, useRef, useState } from 'react';
import { Row, Col, Table, Tag, Switch, message, Progress } from 'antd';
import CrudTable, { CrudRef } from '../components/CrudTable';
import Chart from '../components/Chart';
import { api, put } from '../api';
import { useApp, useOptions } from '../ctx';
import { money, pct, num, PlatformTag, StatusTag, opt } from '../utils';

export function AdsOverview() {
  const { storeId } = useApp(); const [d, setD] = useState<any>({ stores: [], daily: [] });
  useEffect(() => { api('/ads/summary', { params: { storeId: storeId || undefined } }).then(setD); }, [storeId]);
  const s = d.stores; const sum = (k: string) => s.reduce((a: number, x: any) => a + (x[k] || 0), 0);
  const spend = sum('spend_cny'), sales = sum('sales_cny'), clicks = sum('clicks'), imp = sum('impressions'), orders = sum('orders');
  const kpi = [{ t: '广告花费', v: money(spend) }, { t: '广告销售额', v: money(sales) }, { t: 'ACoS', v: pct(sales ? spend / sales : 0) }, { t: 'ROAS', v: (spend ? sales / spend : 0).toFixed(2) }, { t: '曝光量', v: num(imp) }, { t: '点击量', v: num(clicks) }, { t: 'CTR', v: pct(imp ? clicks / imp : 0, 2) }, { t: 'CPC', v: money(clicks ? spend / clicks : 0) }, { t: '广告订单', v: num(orders) }, { t: 'CVR', v: pct(clicks ? orders / clicks : 0, 2) }];
  return <div>
    <Row gutter={12} style={{ marginBottom: 12 }}>{kpi.map(k => <Col key={k.t} span={k.t.length > 3 ? 3 : 2} flex={1}><div className="kpi"><div className="t">{k.t}</div><div className="v" style={{ fontSize: 20 }}>{k.v}</div></div></Col>)}</Row>
    <Row gutter={12}>
      <Col span={16}><div className="panel"><div className="panel-title">每日广告花费 / 销售额（¥）</div>
        <Chart height={280} option={{ tooltip: { trigger: 'axis' }, legend: { data: ['花费', '销售额', 'ACoS'] }, grid: { left: 60, right: 50, top: 36, bottom: 30 }, xAxis: { type: 'category', data: d.daily.map((x: any) => x.d.slice(5)) }, yAxis: [{ type: 'value' }, { type: 'value', axisLabel: { formatter: (v: number) => (v * 100).toFixed(0) + '%' } }], series: [{ name: '花费', type: 'bar', data: d.daily.map((x: any) => x.spend), barMaxWidth: 14 }, { name: '销售额', type: 'line', smooth: true, data: d.daily.map((x: any) => x.sales) }, { name: 'ACoS', type: 'line', yAxisIndex: 1, smooth: true, lineStyle: { type: 'dashed' }, data: d.daily.map((x: any) => x.sales ? +(x.spend / x.sales).toFixed(4) : 0) }] }} /></div></Col>
      <Col span={8}><div className="panel"><div className="panel-title">花费占比（按店铺）</div>
        <Chart height={280} option={{ tooltip: { trigger: 'item', formatter: '{b}<br/>¥{c} ({d}%)' }, legend: { type: 'scroll', bottom: 0 }, series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '45%'], label: { show: false }, data: s.map((x: any) => ({ name: x.name, value: x.spend_cny })) }] }} /></div></Col>
    </Row>
    <div className="table-wrap"><div className="panel-title" style={{ padding: '10px 12px 0' }}>店铺广告表现</div>
      <Table rowKey="id" size="small" pagination={false} dataSource={s} scroll={{ x: 1200 }} columns={[{ title: '店铺', dataIndex: 'name', width: 160 }, { title: '平台', dataIndex: 'platform', width: 110, render: v => <PlatformTag v={v} /> }, { title: '站点', dataIndex: 'site', width: 70 }, { title: '活动数', dataIndex: 'campaigns', width: 70, align: 'right' }, { title: '花费', dataIndex: 'spend', width: 110, align: 'right', render: (v, r: any) => money(v, r.currency) }, { title: '销售额', dataIndex: 'sales', width: 110, align: 'right', render: (v, r: any) => money(v, r.currency) }, { title: '花费(¥)', dataIndex: 'spend_cny', width: 110, align: 'right', sorter: (a: any, b: any) => a.spend_cny - b.spend_cny, render: v => money(v) }, { title: 'ACoS', dataIndex: 'acos', width: 160, sorter: (a: any, b: any) => a.acos - b.acos, render: v => <Progress size="small" percent={+(v * 100).toFixed(1)} strokeColor={v > 0.35 ? '#ff4d4f' : v > 0.25 ? '#faad14' : '#52c41a'} /> }, { title: 'ROAS', dataIndex: 'roas', width: 70, align: 'right' }, { title: '点击', dataIndex: 'clicks', width: 80, align: 'right', render: num }, { title: '订单', dataIndex: 'orders', width: 70, align: 'right' }]} />
    </div>
  </div>;
}

export function CampaignsPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  return <CrudTable ref={ref} resource="ad_campaigns" searchPlaceholder="广告活动名称" canEdit formTitle="广告活动" statusTabs={{ field: 'status', items: ['投放中', '已暂停'] }}
    filters={[{ name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }, { name: 'type', label: '广告类型', type: 'select', options: opt(['SP', 'SB', 'SD', 'Sponsored Products', 'GMV Max', '短视频推广', '直播推广', 'Meta Ads']) }]}
    formFields={[{ name: 'name', label: '活动名称', required: true, span: 24 }, { name: 'budget', label: '日预算', type: 'number' }, { name: 'status', label: '状态', type: 'select', options: opt(['投放中', '已暂停']) }]}
    columns={[{ title: '广告活动', dataIndex: 'name', width: 240, ellipsis: true }, { title: '店铺', dataIndex: 'store_name', width: 140 }, { title: '类型', dataIndex: 'type', width: 120, render: v => <Tag color="geekblue">{v}</Tag> }, { title: '状态', dataIndex: 'status', width: 90, render: (v, r) => <Switch size="small" checked={v === '投放中'} checkedChildren="投放" unCheckedChildren="暂停" onChange={async c => { await put(`/r/ad_campaigns/${r.id}`, { status: c ? '投放中' : '已暂停' }); message.success(c ? '已开启投放' : '已暂停'); ref.current?.reload(); }} /> }, { title: '日预算', dataIndex: 'budget', width: 90, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '花费', dataIndex: 'spend', width: 100, align: 'right', sorter: true, render: (v, r) => money(v, r.currency) }, { title: '销售额', dataIndex: 'sales', width: 110, align: 'right', sorter: true, render: (v, r) => money(v, r.currency) }, { title: 'ACoS', dataIndex: 'acos', width: 80, align: 'right', sorter: true, render: v => <span style={{ color: v > 0.35 ? '#cf1322' : v > 0.25 ? '#d48806' : '#389e0d', fontWeight: 500 }}>{pct(v)}</span> }, { title: '曝光', dataIndex: 'impressions', width: 90, align: 'right', render: num }, { title: '点击', dataIndex: 'clicks', width: 70, align: 'right', render: num }, { title: 'CTR', dataIndex: 'ctr', width: 70, align: 'right', render: v => pct(v, 2) }, { title: 'CPC', dataIndex: 'cpc', width: 70, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '订单', dataIndex: 'orders', width: 60, align: 'right' }]} scrollX={1600} />;
}
