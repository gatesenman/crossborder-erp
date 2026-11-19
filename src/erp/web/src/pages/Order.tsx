import { useEffect, useRef, useState } from 'react';
import { Drawer, Descriptions, Table, Tabs, Modal, Form, Row, Col, Input, InputNumber, Select, Button, Space, message, Tag, Alert, Divider, Timeline, Popconfirm, Switch, Tooltip, Dropdown } from 'antd';
import { PlusOutlined, MinusCircleOutlined, CheckOutlined, ThunderboltOutlined, CarOutlined, SendOutlined, MergeCellsOutlined, CloseOutlined, ApartmentOutlined, DownOutlined, WarningOutlined } from '@ant-design/icons';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { api, post, put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, PlatformTag, opt, pct, profitText } from '../utils';

const COUNTRIES = ['美国', '英国', '德国', '日本', '法国', '意大利', '加拿大', '西班牙'];

export function ProfitBreakdown({ p, cur }: { p: any; cur: string }) {
  if (!p) return null;
  const rows = [
    ['销售收入（商品+运费）', p.revenue, cur, 1], ['平台佣金', -p.platformFee, cur, 0], ['FBA 配送费', -p.fbaFee, cur, 0], ['广告费（分摊）', -p.adCost, cur, 0],
    ['= 平台净回款', p.revenue - p.platformFee - p.fbaFee - p.adCost, cur, 1], [`× 汇率 ${p.rate}`, (p.revenue - p.platformFee - p.fbaFee - p.adCost) * p.rate, 'CNY', 1],
    ['商品成本 COGS（采购+头程+包材）', -p.cogs, 'CNY', 0], ['尾程运费', -p.freight, 'CNY', 0], ['其他费用（退款等）', -p.otherCost, 'CNY', 0],
  ];
  return <div>
    <Table size="small" pagination={false} rowKey={r => r[0] as string} dataSource={rows} showHeader={false} columns={[{ dataIndex: 0, render: (v, r) => <span style={{ fontWeight: r[3] ? 600 : 400 }}>{v}</span> }, { dataIndex: 1, align: 'right', render: (v, r) => <span style={{ color: v < 0 ? '#cf1322' : undefined, fontWeight: r[3] ? 600 : 400 }}>{money(v, r[2] as string)}</span> }]}
      summary={() => <Table.Summary.Row style={{ background: '#f6ffed' }}><Table.Summary.Cell index={0}><b>订单毛利润（CNY）</b></Table.Summary.Cell><Table.Summary.Cell index={1} align="right"><b style={{ fontSize: 15 }}>{profitText(p.profit)}</b>　<Tag color={p.margin < 0 ? 'red' : 'green'}>利润率 {pct(p.margin)}</Tag></Table.Summary.Cell></Table.Summary.Row>} />
  </div>;
}

export function OrderDetail({ id, onClose, onChanged }: { id?: number; onClose: () => void; onChanged?: () => void }) {
  const [d, setD] = useState<any>(null);
  const load = () => id && api(`/orders/${id}/detail`).then(setD);
  useEffect(() => { setD(null); load(); }, [id]);
  return <Drawer title={d ? <Space>订单详情 <span className="mono">{d.order_no}</span><StatusTag v={d.status} />{d.flag && <Tag color="red" icon={<WarningOutlined />}>{d.flag}</Tag>}</Space> : '订单详情'} width={900} open={!!id} onClose={onClose}
    extra={d && <Button size="small" onClick={async () => { await post(`/orders/${d.id}/recalc`); message.success('利润已重新核算'); load(); onChanged?.(); }}>重算利润</Button>}>
    {d && <>
      <Descriptions className="desc-small" bordered size="small" column={3} items={[
        { label: '系统单号', children: <span className="mono">{d.order_no}</span> }, { label: '平台单号', children: <span className="mono">{d.platform_order_no}</span> }, { label: '下单时间', children: d.order_time },
        { label: '店铺', children: d.store_name }, { label: '平台/站点', children: <><PlatformTag v={d.platform} /> {d.site}</> }, { label: '配送方式', children: <StatusTag v={d.fulfillment} /> },
        { label: '买家', children: d.buyer_name }, { label: '国家', children: d.country }, { label: '币种', children: d.currency },
        { label: '收货地址', children: d.address, span: 3 },
        { label: '发货仓库', children: d.warehouse_name || '-' }, { label: '物流渠道', children: d.channel_name || '-' }, { label: '跟踪号', children: d.tracking_no ? <span className="mono">{d.tracking_no}</span> : '-' },
        { label: '发货时间', children: d.ship_time || '-' }, { label: '备注', children: d.remark || '-', span: 2 },
      ]} />
      <Divider orientation="left" plain style={{ fontSize: 13 }}>商品明细</Divider>
      <Table size="small" rowKey="id" pagination={false} dataSource={d.items} columns={[{ title: 'MSKU', dataIndex: 'msku', render: v => <span className="mono">{v}</span> }, { title: '本地SKU', dataIndex: 'sku', render: v => v ? <Tag color="blue">{v}</Tag> : <Tag color="red">未配对</Tag> }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '单价', dataIndex: 'price', align: 'right', render: v => money(v, d.currency) }, { title: '数量', dataIndex: 'qty', align: 'right' }, { title: '小计', align: 'right', render: (_, r: any) => money(r.price * r.qty, d.currency) }]} />
      <Row gutter={16}>
        <Col span={14}><Divider orientation="left" plain style={{ fontSize: 13 }}>利润核算</Divider><ProfitBreakdown p={d.profit} cur={d.currency} /></Col>
        <Col span={10}>
          <Divider orientation="left" plain style={{ fontSize: 13 }}>关联单据</Divider>
          {d.parent_id && <p>拆分自订单 ID：{d.parent_id}</p>}
          {d.children.length ? d.children.map((c: any) => <p key={c.id}><span className="mono">{c.order_no}</span> <StatusTag v={c.status} /></p>) : !d.parent_id && <p style={{ color: '#999' }}>无拆分/合并记录</p>}
          <Divider orientation="left" plain style={{ fontSize: 13 }}>售后记录</Divider>
          {d.after_sales.length ? <Timeline items={d.after_sales.map((a: any) => ({ color: a.status === '已完成' ? 'green' : 'orange', children: <><b>{a.type}</b> {money(a.amount, a.currency)} <StatusTag v={a.status} /><div style={{ color: '#888', fontSize: 12 }}>{a.reason} · {a.created_at}</div></> }))} /> : <p style={{ color: '#999' }}>无售后</p>}
        </Col>
      </Row>
    </>}
  </Drawer>;
}

export function OrderForm({ row, open, onClose, onOk }: { row?: any; open: boolean; onClose: () => void; onOk: () => void }) {
  const [form] = Form.useForm(); const o = useOptions(); const [saving, setSaving] = useState(false); const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!open) return; form.resetFields();
    if (row) api(`/orders/${row.id}/detail`).then(d => { setLocked(!['待审核', '待发货', '异常'].includes(d.status)); form.setFieldsValue({ ...d, items: d.items.map((i: any) => ({ sku_id: i.sku_id, msku: i.msku, qty: i.qty, price: i.price })) }); });
    else { setLocked(false); form.setFieldsValue({ fulfillment: 'FBM', country: '美国', shipping_income: 0, ad_cost: 0, other_cost: 0, items: [{ qty: 1 }] }); }
  }, [open, row?.id]);
  const storeId = Form.useWatch('store_id', form); const cur = o.stores.find(s => s.id === storeId)?.currency || '';
  const submit = async () => {
    const v = await form.validateFields(); if (locked) delete v.items; setSaving(true);
    try { if (row) await put(`/orders/${row.id}`, v); else { const r = await post('/orders', v); message.success(`建单成功：${r.order_no}`); } if (row) message.success('订单已保存，利润已重算'); onOk(); } finally { setSaving(false); }
  };
  return <Modal title={row ? `编辑订单 · ${row.order_no}` : '手工建单'} open={open} width={900} onCancel={onClose} onOk={submit} confirmLoading={saving} maskClosable={false} forceRender>
    <Form form={form} layout="vertical">
      <Row gutter={14}>
        <Col span={8}><Form.Item name="store_id" label="店铺" rules={[{ required: true }]}><Select disabled={!!row} options={o.storeOpts} showSearch optionFilterProp="label" /></Form.Item></Col>
        <Col span={4}><Form.Item name="fulfillment" label="配送方式"><Select disabled={!!row} options={opt(['FBM', 'FBA'])} /></Form.Item></Col>
        <Col span={6}><Form.Item name="platform_order_no" label="平台单号"><Input disabled={!!row} placeholder="留空自动生成" /></Form.Item></Col>
        <Col span={6}><Form.Item name="buyer_name" label="买家姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
        <Col span={4}><Form.Item name="country" label="国家"><Select options={opt(COUNTRIES)} /></Form.Item></Col>
        <Col span={20}><Form.Item name="address" label="收货地址"><Input /></Form.Item></Col>
      </Row>
      <div className="panel-title" style={{ fontSize: 13 }}>商品明细 {cur && <Tag>{cur}</Tag>}{locked && <Tag color="orange">已发货订单不可修改明细</Tag>}</div>
      <Form.List name="items">{(fields, { add, remove }) => <>
        {fields.map(f => <Row gutter={8} key={f.key}>
          <Col span={11}><Form.Item name={[f.name, 'sku_id']} rules={[{ required: true, message: '选择SKU' }]}><Select disabled={locked} showSearch optionFilterProp="label" options={o.skuOpts} placeholder="选择本地SKU" /></Form.Item></Col>
          <Col span={4}><Form.Item name={[f.name, 'qty']}><InputNumber disabled={locked} min={1} addonBefore="数量" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name={[f.name, 'price']} rules={[{ required: true, message: '填写单价' }]}><InputNumber disabled={locked} min={0} addonBefore="单价" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={3}>{!locked && <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(f.name)} />}</Col></Row>)}
        {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ qty: 1 })} style={{ marginBottom: 12 }}>添加商品</Button>}
      </>}</Form.List>
      <Row gutter={14}>
        <Col span={6}><Form.Item name="shipping_income" label={`运费收入(${cur || '原币'})`}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item name="ad_cost" label={`广告费分摊(${cur || '原币'})`}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item name="other_cost" label="其他费用(¥)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={6}><Form.Item name="tracking_no" label="跟踪号"><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="warehouse_id" label="发货仓库"><Select allowClear options={o.whOpts} /></Form.Item></Col>
        <Col span={8}><Form.Item name="channel_id" label="物流渠道"><Select allowClear options={o.channelOpts} /></Form.Item></Col>
        <Col span={8}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
      </Row>
    </Form>
  </Modal>;
}

function SplitModal({ row, onClose, onOk }: { row: any; onClose: () => void; onOk: () => void }) {
  const [d, setD] = useState<any>(null); const [qty, setQty] = useState<Record<number, number>>({});
  useEffect(() => { setD(null); setQty({}); if (row) api(`/orders/${row.id}/detail`).then(setD); }, [row?.id]);
  return <Modal title={`拆分订单 · ${row?.order_no}`} open={!!row} onCancel={onClose} width={700} onOk={async () => { const r = await post(`/orders/${row.id}/split`, { items: Object.entries(qty).map(([k, v]) => ({ item_id: Number(k), qty: v })) }); message.success(`拆分成功，新订单 ${r.order_no}`); onOk(); }}>
    <Alert type="info" showIcon message="填写需要拆出到新订单的数量，新订单将继承收货信息，可单独分配仓库与物流。" style={{ marginBottom: 12 }} />
    <Table size="small" rowKey="id" pagination={false} dataSource={d?.items || []} columns={[{ title: 'SKU', dataIndex: 'sku' }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '原数量', dataIndex: 'qty', width: 80 }, { title: '拆出数量', width: 130, render: (_, r: any) => <InputNumber size="small" min={0} max={r.qty} value={qty[r.id] || 0} onChange={v => setQty({ ...qty, [r.id]: v || 0 })} /> }]} />
  </Modal>;
}

export default function OrderPage() {
  const ref = useRef<CrudRef>(null); const o = useOptions();
  const [detail, setDetail] = useState<number>(); const [edit, setEdit] = useState<{ open: boolean; row?: any }>({ open: false });
  const [split, setSplit] = useState<any>(null); const [assign, setAssign] = useState<any[] | null>(null); const [af] = Form.useForm();
  const batch = async (c: any, url: string, label: string) => {
    if (!c.selected.length) return message.warning('请先勾选订单');
    const r = await post(url, { ids: c.selected.map((x: any) => x.id) });
    if (r.fail?.length) Modal.warning({ title: `${label}：成功 ${r.ok}，失败 ${r.fail.length}`, content: <div style={{ maxHeight: 300, overflow: 'auto' }}>{r.fail.map((f: string) => <div key={f}>{f}</div>)}</div> });
    else message.success(`${label}成功 ${r.ok ?? r.matched ?? ''} 个订单`);
    c.clearSelected(); c.reload();
  };
  return <>
    <CrudTable ref={ref} resource="orders" selectable searchPlaceholder="系统单号 / 平台单号 / 买家 / 跟踪号"
      statusTabs={{ field: 'status', items: ['待审核', '待发货', '已发货', '已完成', '异常', '已取消'] }}
      filters={[{ name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }, { name: 'platform', label: '平台', type: 'select', options: opt(['Amazon', 'Shopify', 'TikTok Shop', 'Temu', 'eBay', 'Walmart']) }, { name: 'fulfillment', label: '配送方式', type: 'select', options: opt(['FBA', 'FBM']), span: 3 }, { name: 'country', label: '国家', type: 'select', options: opt(COUNTRIES), span: 3 }, { name: 'date', label: '下单日期', type: 'dateRange', span: 5 }]}
      canCreate createText="手工建单" onCreate={() => setEdit({ open: true })} onRowClick={r => setDetail(r.id)}
      summary={d => d.summary && <span style={{ fontSize: 12, color: '#666', marginRight: 8 }}>筛选结果销售额 <b>{money(d.summary.revenue)}</b>　利润 <b>{profitText(d.summary.profit)}</b></span>}
      toolbar={c => <>
        <Button icon={<CheckOutlined />} onClick={() => batch(c, '/orders/audit', '审核')}>审核通过</Button>
        <Button icon={<ThunderboltOutlined />} onClick={async () => { const r = await post('/orders/auto-audit'); Modal.success({ title: '自动审单完成', content: `共 ${r.total} 单待审：通过 ${r.passed}，转人工 ${r.held}，标记异常 ${r.abnormal}` }); c.reload(); }}>按规则自动审单</Button>
        <Button icon={<ApartmentOutlined />} onClick={() => batch(c, '/orders/match-logistics', '匹配物流')}>智能匹配物流</Button>
        <Button icon={<CarOutlined />} onClick={() => { if (!c.selected.length) return message.warning('请先勾选订单'); af.resetFields(); setAssign(c.selected); }}>分配仓库/物流</Button>
        <Button type="primary" ghost icon={<SendOutlined />} onClick={() => batch(c, '/orders/ship', '发货')}>确认发货</Button>
        <Dropdown menu={{ items: [{ key: 'merge', icon: <MergeCellsOutlined />, label: '合并订单' }, { key: 'cancel', icon: <CloseOutlined />, label: '取消订单', danger: true }], onClick: async e => {
          if (e.key === 'merge') { if (c.selected.length < 2) return message.warning('请至少勾选 2 个同买家订单'); const r = await post('/orders/merge', { ids: c.selected.map(x => x.id) }); message.success(`已合并至 ${r.order_no}`); c.clearSelected(); c.reload(); }
          else Modal.confirm({ title: `确认取消 ${c.selected.length} 个订单？`, onOk: async () => { await post('/orders/cancel', { ids: c.selected.map(x => x.id) }); message.success('已取消'); c.clearSelected(); c.reload(); } });
        } }}><Button>更多操作 <DownOutlined /></Button></Dropdown>
      </>}
      rowActions={(r, c) => <>
        <a onClick={() => setDetail(r.id)}>详情</a>
        <a onClick={() => setEdit({ open: true, row: r })}>编辑</a>
        {['待审核', '待发货', '异常'].includes(r.status) && <a onClick={() => setSplit(r)}>拆分</a>}
      </>} actionWidth={130}
      columns={[
        { title: '系统单号 / 平台单号', dataIndex: 'order_no', width: 190, fixed: 'left', render: (v, r) => <div><a className="mono" onClick={e => { e.stopPropagation(); setDetail(r.id); }}>{v}</a><div className="mono" style={{ color: '#999' }}>{r.platform_order_no}</div></div> },
        { title: '店铺', dataIndex: 'store_name', width: 150, render: (v, r) => <div>{v}<div><PlatformTag v={r.platform} /> <span style={{ color: '#999' }}>{r.site}</span></div></div> },
        { title: '状态', dataIndex: 'status', width: 110, render: (v, r) => <div><StatusTag v={v} />{r.flag && <Tooltip title={r.flag}><div style={{ color: '#cf1322', fontSize: 11, marginTop: 2 }}><WarningOutlined /> {r.flag}</div></Tooltip>}</div> },
        { title: '配送', dataIndex: 'fulfillment', width: 60, render: v => <StatusTag v={v} /> },
        { title: '商品', dataIndex: 'items_text', width: 220, ellipsis: true, render: v => <span className="mono">{v}</span> },
        { title: '件数', dataIndex: 'units', width: 50, align: 'right' },
        { title: '订单金额', dataIndex: 'total_amount', width: 100, align: 'right', sorter: true, render: (v, r) => money(v, r.currency) },
        { title: '利润(¥)', dataIndex: 'profit_cny', width: 100, align: 'right', sorter: true, render: v => profitText(v) },
        { title: '利润率', dataIndex: 'margin', width: 70, align: 'right', render: v => <span style={{ color: v < 0 ? '#cf1322' : undefined }}>{pct(v)}</span> },
        { title: '买家 / 国家', dataIndex: 'buyer_name', width: 140, render: (v, r) => <div>{v}<div style={{ color: '#999' }}>{r.country}</div></div> },
        { title: '仓库 / 物流', dataIndex: 'warehouse_name', width: 170, render: (v, r) => r.fulfillment === 'FBA' ? <span style={{ color: '#999' }}>亚马逊配送</span> : <div>{v || <span style={{ color: '#fa8c16' }}>未分配仓库</span>}<div style={{ color: '#999' }}>{r.channel_name || '未分配物流'}</div></div> },
        { title: '跟踪号', dataIndex: 'tracking_no', width: 140, render: v => <span className="mono">{v || '-'}</span> },
        { title: '下单时间', dataIndex: 'order_time', width: 150, sorter: true },
      ]} scrollX={1900} />
    <OrderDetail id={detail} onClose={() => setDetail(undefined)} onChanged={() => ref.current?.reload()} />
    <OrderForm open={edit.open} row={edit.row} onClose={() => setEdit({ open: false })} onOk={() => { setEdit({ open: false }); ref.current?.reload(); }} />
    <SplitModal row={split} onClose={() => setSplit(null)} onOk={() => { setSplit(null); ref.current?.reload(); }} />
    <Modal title={`分配仓库 / 物流渠道（${assign?.length || 0} 个订单）`} open={!!assign} onCancel={() => setAssign(null)} onOk={async () => { const v = await af.validateFields(); await post('/orders/assign', { ids: assign!.map(x => x.id), ...v }); message.success('分配成功，运费已重新核算'); setAssign(null); ref.current?.clearSelected(); ref.current?.reload(); }}>
      <Form form={af} layout="vertical"><Form.Item name="warehouse_id" label="发货仓库"><Select allowClear options={o.whOpts.filter(w => o.warehouses.find(x => x.id === w.value)?.type !== 'FBA仓')} /></Form.Item><Form.Item name="channel_id" label="物流渠道"><Select allowClear options={o.channelOpts} /></Form.Item></Form>
    </Modal>
  </>;
}

export function AfterSalesPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null); const [proc, setProc] = useState<any>(null); const [pf] = Form.useForm();
  const [detail, setDetail] = useState<number>();
  return <>
    <CrudTable ref={ref} resource="after_sales" searchPlaceholder="售后单号 / 订单号" statusTabs={{ field: 'status', items: ['待处理', '处理中', '已完成', '已拒绝'] }}
      filters={[{ name: 'type', label: '售后类型', type: 'select', options: opt(['退货退款', '仅退款', '换货', '补发']) }, { name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }, { name: 'date', label: '申请日期', type: 'dateRange', span: 6 }]}
      rowActions={r => <>{['待处理', '处理中'].includes(r.status) && <a onClick={() => { pf.setFieldsValue({ status: '已完成', restock: r.type === '退货退款', remark: r.remark }); setProc(r); }}>处理</a>}</>} actionWidth={80}
      columns={[{ title: '售后单号', dataIndex: 'as_no', width: 150, render: v => <span className="mono">{v}</span> }, { title: '订单号', dataIndex: 'order_no', width: 170, render: (v, r) => <a className="mono" onClick={() => setDetail(r.order_id)}>{v}</a> }, { title: '店铺', dataIndex: 'store_name', width: 150 }, { title: '平台', dataIndex: 'platform', width: 100, render: v => <PlatformTag v={v} /> }, { title: '买家', dataIndex: 'buyer_name', width: 120 }, { title: '类型', dataIndex: 'type', width: 90, render: v => <Tag>{v}</Tag> }, { title: '原因', dataIndex: 'reason', width: 160, ellipsis: true }, { title: '金额', dataIndex: 'amount', width: 90, align: 'right', render: (v, r) => money(v, r.currency) }, { title: '退货入库', dataIndex: 'restock', width: 80, render: v => v ? <Tag color="green">是</Tag> : '-' }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '申请时间', dataIndex: 'created_at', width: 150 }, { title: '备注', dataIndex: 'remark', ellipsis: true, width: 150 }]} scrollX={1600} />
    <Modal title={`处理售后 · ${proc?.as_no}`} open={!!proc} onCancel={() => setProc(null)} onOk={async () => { const v = await pf.validateFields(); await post(`/after-sales/${proc.id}/process`, v); message.success('处理完成：退款已计入订单其他费用' + (v.restock ? '，退货已入库' : '')); setProc(null); ref.current?.reload(); }}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`${proc?.type} · ${money(proc?.amount, proc?.currency)} · ${proc?.reason}`} />
      <Form form={pf} layout="vertical"><Form.Item name="status" label="处理结果"><Select options={opt(['处理中', '已完成', '已拒绝'])} /></Form.Item><Form.Item name="restock" label="退货商品重新入库" valuePropName="checked"><Switch /></Form.Item><Form.Item name="remark" label="处理备注"><Input.TextArea rows={2} /></Form.Item></Form>
    </Modal>
    <OrderDetail id={detail} onClose={() => setDetail(undefined)} />
  </>;
}

export function ReviewRulesPage() {
  return <>
    <Alert type="info" showIcon style={{ marginBottom: 10 }} message="审单规则按优先级从小到大依次匹配。点击订单页面「按规则自动审单」后，命中规则的订单将被拦截为人工审核或标记异常，其余自动通过进入待发货。" />
    <CrudTable resource="review_rules" useStore={false} canCreate canEdit canDelete formTitle="审单规则" createText="新增规则"
      formFields={[{ name: 'name', label: '规则名称', required: true }, { name: 'priority', label: '优先级', type: 'number' }, { name: 'condition', label: '触发条件', span: 24, required: true }, { name: 'action', label: '执行动作', type: 'select', options: opt(['转人工审核', '标记异常', '自动通过', '指定仓库']) }, { name: 'enabled', label: '启用', type: 'switch' }]}
      columns={[{ title: '优先级', dataIndex: 'priority', width: 70 }, { title: '规则名称', dataIndex: 'name', width: 200 }, { title: '触发条件', dataIndex: 'condition' }, { title: '执行动作', dataIndex: 'action', width: 120, render: v => <Tag color={v === '标记异常' ? 'red' : v === '转人工审核' ? 'orange' : 'blue'}>{v}</Tag> }, { title: '命中次数', dataIndex: 'hits', width: 90, align: 'right' }, { title: '状态', dataIndex: 'enabled', width: 80, render: v => <StatusTag v={v ? '启用' : '停用'} /> }]} scrollX={1000} />
  </>;
}
