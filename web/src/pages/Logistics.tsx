import { useRef } from 'react';
import { Tag, Switch, message } from 'antd';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, opt, PlatformTag, PLATFORMS } from '../utils';
export { ProvidersPage } from './Fba';

export function ChannelsPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  return <CrudTable ref={ref} resource="logistics_channels" useStore={false} searchPlaceholder="渠道名称 / 代码" canCreate canEdit canDelete formTitle="物流渠道" createText="新增渠道"
    statusTabs={{ field: 'type', items: ['小包专线', '邮政小包', '海外仓尾程', '头程海运', '头程空运', '头程卡航'] }}
    filters={[{ name: 'provider_id', label: '物流商', type: 'select', options: o.providerOpts }]}
    formFields={[{ name: 'provider_id', label: '物流商', type: 'select', options: o.providerOpts, required: true }, { name: 'name', label: '渠道名称', required: true }, { name: 'code', label: '渠道代码' }, { name: 'type', label: '渠道类型', type: 'select', options: opt(['小包专线', '邮政小包', '海外仓尾程', '头程海运', '头程空运', '头程卡航']) }, { name: 'transit_days', label: '时效', placeholder: '如 7-12' }, { name: 'price_per_kg', label: '单价(¥/kg)', type: 'number' }, { name: 'base_fee', label: '挂号/操作费(¥)', type: 'number' }, { name: 'countries', label: '可达国家', placeholder: '美国,加拿大' }, { name: 'enabled', label: '启用', type: 'switch' }]}
    columns={[{ title: '渠道名称', dataIndex: 'name', width: 200 }, { title: '代码', dataIndex: 'code', width: 110, render: v => <span className="mono">{v}</span> }, { title: '物流商', dataIndex: 'provider_name', width: 180 }, { title: '类型', dataIndex: 'type', width: 100, render: v => <Tag>{v}</Tag> }, { title: '时效(天)', dataIndex: 'transit_days', width: 90 }, { title: '单价/kg', dataIndex: 'price_per_kg', width: 90, align: 'right', render: v => money(v) }, { title: '挂号费', dataIndex: 'base_fee', width: 90, align: 'right', render: v => money(v) }, { title: '可达国家', dataIndex: 'countries', ellipsis: true }, { title: '启用', dataIndex: 'enabled', width: 70, render: (v, r) => <Switch size="small" checked={!!v} onChange={async c => { await put(`/r/logistics_channels/${r.id}`, { enabled: c ? 1 : 0 }); message.success(c ? '已启用' : '已停用'); ref.current?.reload(); }} /> }]} scrollX={1300} />;
}

export function RulesPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  return <CrudTable ref={ref} resource="shipping_rules" useStore={false} searchPlaceholder="规则名称" canCreate canEdit canDelete formTitle="物流规则" createText="新增规则"
    title={<span style={{ color: '#888', fontSize: 12 }}>订单处理时点击「智能匹配物流」，按优先级从小到大匹配第一条满足条件（平台 / 国家 / 重量）的规则，自动分配发货仓与物流渠道</span>}
    formFields={[{ name: 'name', label: '规则名称', required: true }, { name: 'priority', label: '优先级(越小越优先)', type: 'number' }, { name: 'platform', label: '适用平台', type: 'select', options: opt(PLATFORMS), placeholder: '不限' }, { name: 'country', label: '收件国家', placeholder: '如 美国，留空不限' }, { name: 'max_weight', label: '最大重量(kg)', type: 'number' }, { name: 'warehouse_id', label: '发货仓库', type: 'select', options: o.whOpts, required: true }, { name: 'channel_id', label: '物流渠道', type: 'select', options: o.channelOpts, required: true }, { name: 'enabled', label: '启用', type: 'switch' }]}
    columns={[{ title: '优先级', dataIndex: 'priority', width: 70, align: 'center', render: v => <Tag color="blue">{v}</Tag> }, { title: '规则名称', dataIndex: 'name', width: 200 }, { title: '平台', dataIndex: 'platform', width: 110, render: v => v ? <PlatformTag v={v} /> : '不限' }, { title: '国家', dataIndex: 'country', width: 110, render: v => v || '不限' }, { title: '重量 ≤', dataIndex: 'max_weight', width: 80, render: v => v ? v + 'kg' : '不限' }, { title: '发货仓', dataIndex: 'warehouse_name', width: 150 }, { title: '物流渠道', dataIndex: 'channel_name', width: 200 }, { title: '启用', dataIndex: 'enabled', width: 70, render: (v, r) => <Switch size="small" checked={!!v} onChange={async c => { await put(`/r/shipping_rules/${r.id}`, { enabled: c ? 1 : 0 }); ref.current?.reload(); }} /> }]} />;
}

export function TrackingPage() {
  const o = useOptions();
  return <CrudTable resource="orders" extraParams={{ status: '已发货,已完成' }} searchPlaceholder="订单号 / 跟踪号 / 买家"
    filters={[{ name: 'fulfillment', label: '配送方式', type: 'select', options: opt(['FBM', 'FBA']) }, { name: 'country', label: '国家', type: 'select', options: opt(['美国', '英国', '德国', '法国', '意大利', '日本']) }, { name: 'warehouse_id', label: '发货仓', type: 'select', options: o.whOpts }, { name: 'date', label: '下单日期', type: 'dateRange', span: 6 }]}
    columns={[{ title: '订单号', dataIndex: 'order_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '店铺', dataIndex: 'store_name', width: 140 }, { title: '配送', dataIndex: 'fulfillment', width: 70, render: v => <Tag color={v === 'FBA' ? 'orange' : 'blue'}>{v}</Tag> }, { title: '买家 / 国家', dataIndex: 'buyer_name', width: 160, render: (v, r) => `${v} · ${r.country}` }, { title: '发货仓', dataIndex: 'warehouse_name', width: 140, render: v => v || 'Amazon FBA' }, { title: '物流渠道', dataIndex: 'channel_name', width: 180, render: v => v || '-' }, { title: '跟踪号', dataIndex: 'tracking_no', width: 170, render: v => v ? <span className="mono" style={{ color: '#1668dc' }}>{v}</span> : '-' }, { title: '物流状态', dataIndex: 'status', width: 100, render: v => <StatusTag v={v === '已完成' ? '已签收' : '运输中'} /> }, { title: '发货时间', dataIndex: 'ship_time', width: 150 }, { title: '运费', dataIndex: 'freight_cost', width: 90, align: 'right', render: v => money(v) }]} scrollX={1500} />;
}
