import { useEffect, useRef, useState } from 'react';
import { Drawer, Descriptions, Table, Modal, Form, Row, Col, Input, InputNumber, Select, Button, Space, message, Tag, Alert, DatePicker, Steps, Tabs, Timeline, Progress } from 'antd';
import { PlusOutlined, MinusCircleOutlined, RightCircleOutlined, CalculatorOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { api, post, put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, opt, num } from '../utils';

const FLOW = ['计划中', '已装箱', '已发货', '运输中', '已签收', '已上架'];
const CHANNELS = ['美森快船', '普船海派', '空运专线', '卡航', '铁路'];

function BoxEditor({ d, onSaved }: { d: any; onSaved: () => void }) {
  const [boxes, setBoxes] = useState<any[]>(d.boxes);
  useEffect(() => setBoxes(d.boxes), [d]);
  const upd = (i: number, k: string, v: any) => setBoxes(boxes.map((b, j) => j === i ? { ...b, [k]: v } : b));
  const editable = ['计划中', '已装箱'].includes(d.status);
  return <>
    <Table size="small" rowKey={(_, i) => String(i)} pagination={false} dataSource={boxes} columns={[
      { title: '箱号', dataIndex: 'box_no', width: 90, render: (v, _, i) => editable ? <Input size="small" value={v} onChange={e => upd(i, 'box_no', e.target.value)} /> : v },
      ...['weight', 'length', 'width', 'height'].map(k => ({ title: { weight: '毛重kg', length: '长cm', width: '宽cm', height: '高cm' }[k], dataIndex: k, width: 90, render: (v: any, _: any, i: number) => editable ? <InputNumber size="small" min={0} value={v} onChange={x => upd(i, k, x)} style={{ width: 80 }} /> : v })),
      { title: '装箱内容', dataIndex: 'contents', render: (v, _, i) => editable ? <Input size="small" value={v} onChange={e => upd(i, 'contents', e.target.value)} placeholder="如 VH1001-BK-L×20" /> : v },
      ...(editable ? [{ title: '', width: 40, render: (_: any, __: any, i: number) => <MinusCircleOutlined style={{ color: '#cf1322' }} onClick={() => setBoxes(boxes.filter((_, j) => j !== i))} /> }] : []),
    ]} summary={r => <Table.Summary.Row><Table.Summary.Cell index={0}><b>{r.length} 箱</b></Table.Summary.Cell><Table.Summary.Cell index={1}><b>{r.reduce((a: number, b: any) => a + (b.weight || 0), 0).toFixed(1)} kg</b></Table.Summary.Cell><Table.Summary.Cell index={2} colSpan={5}>体积重 {(r.reduce((a: number, b: any) => a + (b.length * b.width * b.height || 0), 0) / 6000).toFixed(1)} kg（÷6000）</Table.Summary.Cell></Table.Summary.Row>} />
    {editable && <Space style={{ marginTop: 8 }}><Button size="small" icon={<PlusOutlined />} onClick={() => setBoxes([...boxes, { box_no: 'U' + String(boxes.length + 1).padStart(3, '0'), weight: 18, length: 60, width: 40, height: 40, contents: '' }])}>添加箱子</Button><Button size="small" type="primary" icon={<InboxOutlined />} onClick={async () => { await post(`/fba/${d.id}/boxes`, { boxes }); message.success('装箱信息已保存'); onSaved(); }}>保存装箱</Button></Space>}
  </>;
}

export function FbaDetail({ id, onClose, onChanged }: { id?: number; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<any>(null); const [ev, setEv] = useState({ event: '', location: '' }); const [alloc, setAlloc] = useState<any>({});
  const load = () => id && api(`/fba/${id}/detail`).then(x => { setD(x); setAlloc({ total_freight: x.total_freight, alloc_method: x.alloc_method }); });
  useEffect(() => { setD(null); load(); }, [id]);
  const next = d && FLOW[FLOW.indexOf(d.status) + 1];
  const advance = () => Modal.confirm({ title: `确认将货件推进到「${next}」？`, content: next === '已发货' ? `将从 ${d.from_wh_name} 扣减库存，并在 ${d.to_wh_name} 增加在途。` : next === '已上架' ? `将在 ${d.to_wh_name} 增加可售库存并清除在途。` : undefined, onOk: async () => { await post(`/fba/${d.id}/status`, { status: next }); message.success(`货件状态已更新为「${next}」`); load(); onChanged(); } });
  return <Drawer title={d ? <Space>FBA 货件 <span className="mono">{d.shipment_no}</span><StatusTag v={d.status} /></Space> : 'FBA 货件'} width={960} open={!!id} onClose={onClose}
    extra={d && next && <Button type="primary" icon={<RightCircleOutlined />} onClick={advance}>推进至「{next}」</Button>}>
    {d && <>
      <Steps size="small" current={FLOW.indexOf(d.status)} items={FLOW.map(s => ({ title: s }))} style={{ marginBottom: 16 }} />
      <Descriptions className="desc-small" bordered size="small" column={3} items={[
        { label: '货件单号', children: <span className="mono">{d.shipment_no}</span> }, { label: 'Shipment ID', children: <span className="mono">{d.fba_shipment_id || '-'}</span> }, { label: '计划名称', children: d.plan_name },
        { label: '店铺', children: d.store_name }, { label: '发货仓', children: d.from_wh_name }, { label: '目的仓', children: d.to_wh_name },
        { label: '头程物流商', children: d.provider_name || '-' }, { label: '运输方式', children: d.channel || '-' }, { label: '跟踪号', children: <span className="mono">{d.tracking_no || '-'}</span> },
        { label: '发货日期', children: d.ship_date || '-' }, { label: '预计到达', children: d.eta || '-' }, { label: '头程总运费', children: <b>{money(d.total_freight)}</b> },
        { label: '总件数', children: d.total_qty }, { label: '箱数/重量', children: `${d.box_count} 箱 / ${d.total_weight || 0} kg` }, { label: '备注', children: d.remark || '-' },
      ]} />
      <Tabs style={{ marginTop: 12 }} items={[
        { key: 'items', label: `商品明细 (${d.items.length})`, children: <>
          <Space style={{ marginBottom: 8 }} wrap>
            <span>头程运费分摊：</span><InputNumber size="small" addonBefore="总运费 ¥" min={0} value={alloc.total_freight} onChange={v => setAlloc({ ...alloc, total_freight: v })} style={{ width: 190 }} />
            <Select size="small" value={alloc.alloc_method} onChange={v => setAlloc({ ...alloc, alloc_method: v })} options={opt(['按重量', '按体积', '按数量'])} style={{ width: 100 }} />
            <Button size="small" type="primary" icon={<CalculatorOutlined />} onClick={async () => { await post(`/fba/${d.id}/allocate`, alloc); message.success('分摊完成，SKU 头程成本已回写，后续订单利润将按新成本核算'); load(); onChanged(); }}>重新分摊</Button>
          </Space>
          <Table size="small" rowKey="id" pagination={false} dataSource={d.items} columns={[{ title: 'SKU', dataIndex: 'sku', render: v => <span className="mono">{v}</span> }, { title: 'MSKU', dataIndex: 'msku', render: v => <span className="mono">{v}</span> }, { title: 'FNSKU', dataIndex: 'fnsku' }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '单重kg', dataIndex: 'weight', align: 'right' }, { title: '发货量', dataIndex: 'qty', align: 'right' }, { title: '签收量', dataIndex: 'received_qty', align: 'right' }, { title: '分摊运费', dataIndex: 'alloc_freight', align: 'right', render: v => money(v) }, { title: '单件头程', align: 'right', render: (_, r: any) => <b>{money(r.qty ? r.alloc_freight / r.qty : 0)}</b> }]} />
        </> },
        { key: 'boxes', label: `装箱信息 (${d.boxes.length})`, children: <BoxEditor d={d} onSaved={() => { load(); onChanged(); }} /> },
        { key: 'track', label: `物流跟踪 (${d.events.length})`, children: <>
          <Space style={{ marginBottom: 12 }}><Input size="small" placeholder="轨迹描述" value={ev.event} onChange={e => setEv({ ...ev, event: e.target.value })} style={{ width: 260 }} /><Input size="small" placeholder="地点" value={ev.location} onChange={e => setEv({ ...ev, location: e.target.value })} style={{ width: 140 }} /><Button size="small" disabled={!ev.event} onClick={async () => { await post(`/fba/${d.id}/events`, ev); setEv({ event: '', location: '' }); message.success('已添加轨迹'); load(); }}>添加轨迹</Button></Space>
          <Timeline items={d.events.map((e: any, i: number) => ({ color: i === 0 ? 'blue' : 'gray', children: <><b>{e.event}</b> <span style={{ color: '#888' }}>{e.location}</span><div style={{ color: '#999', fontSize: 12 }}>{e.time}</div></> }))} />
          {!d.events.length && <div style={{ color: '#999' }}>暂无物流轨迹</div>}
        </> },
      ]} />
    </>}
  </Drawer>;
}

export function FbaForm({ row, open, onClose, onOk }: { row?: any; open: boolean; onClose: () => void; onOk: () => void }) {
  const [form] = Form.useForm(); const o = useOptions(); const [saving, setSaving] = useState(false);
  const storeId = Form.useWatch('store_id', form);
  useEffect(() => {
    if (!open) return; form.resetFields();
    if (row) api(`/fba/${row.id}/detail`).then(d => form.setFieldsValue({ ...d, eta: d.eta ? dayjs(d.eta) : null, items: d.items.map((i: any) => ({ sku_id: i.sku_id, qty: i.qty, received_qty: i.received_qty })) }));
    else form.setFieldsValue({ from_wh: 1, alloc_method: '按重量', channel: '美森快船', total_freight: 0, eta: dayjs().add(25, 'day'), plan_name: `补货计划-${dayjs().format('MMDD')}`, items: [{ qty: 100 }] });
  }, [open, row?.id]);
  const locked = row && !['计划中', '已装箱'].includes(row.status);
  const fbaWh = o.warehouses.filter(w => w.type === 'FBA仓');
  const submit = async () => {
    const v = await form.validateFields(); v.eta = v.eta?.format('YYYY-MM-DD'); if (locked) delete v.items; setSaving(true);
    try { if (row) { await put(`/fba/${row.id}`, v); message.success('货件已保存，运费已重新分摊'); } else { const r = await post('/fba', v); message.success('已创建货件 ' + r.shipment_no); } onOk(); } finally { setSaving(false); }
  };
  return <Modal title={row ? `编辑货件 · ${row.shipment_no}` : '创建 FBA 货件'} open={open} width={880} onCancel={onClose} onOk={submit} confirmLoading={saving} maskClosable={false} forceRender>
    <Form form={form} layout="vertical">
      <Row gutter={14}>
        <Col span={8}><Form.Item name="store_id" label="亚马逊店铺" rules={[{ required: true }]}><Select options={o.storeOpts.filter(s => o.stores.find(x => x.id === s.value)?.platform === 'Amazon')} onChange={v => { const w = fbaWh.find(x => x.store_id === v); if (w) form.setFieldsValue({ to_wh: w.id }); }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="plan_name" label="计划名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
        <Col span={8}><Form.Item name="fba_shipment_id" label="Shipment ID"><Input placeholder="FBA17XXXXXXX" /></Form.Item></Col>
        <Col span={8}><Form.Item name="from_wh" label="发货仓" rules={[{ required: true }]}><Select options={o.whOpts.filter(w => o.warehouses.find(x => x.id === w.value)?.type !== 'FBA仓')} /></Form.Item></Col>
        <Col span={8}><Form.Item name="to_wh" label="目的 FBA 仓" rules={[{ required: true }]}><Select options={fbaWh.map(w => ({ label: w.name, value: w.id }))} /></Form.Item></Col>
        <Col span={8}><Form.Item name="eta" label="预计到达"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="provider_id" label="头程物流商"><Select allowClear options={o.providers.filter(p => p.type === '头程').map(p => ({ label: p.name, value: p.id }))} /></Form.Item></Col>
        <Col span={5}><Form.Item name="channel" label="运输方式"><Select options={opt(CHANNELS)} /></Form.Item></Col>
        <Col span={6}><Form.Item name="total_freight" label="头程总运费(¥)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={5}><Form.Item name="alloc_method" label="分摊方式"><Select options={opt(['按重量', '按体积', '按数量'])} /></Form.Item></Col>
        <Col span={12}><Form.Item name="tracking_no" label="跟踪号"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
      </Row>
      <div className="panel-title" style={{ fontSize: 13 }}>发货明细 {storeId && <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>（自动带出该店铺 MSKU / FNSKU）</span>}</div>
      {locked && <Alert type="warning" showIcon message="已发货货件不可修改明细" style={{ marginBottom: 8 }} />}
      <Form.List name="items">{(fields, { add, remove }) => <>
        {fields.map(f => <Row gutter={8} key={f.key}>
          <Col span={15}><Form.Item name={[f.name, 'sku_id']} rules={[{ required: true, message: '选择SKU' }]}><Select disabled={locked} showSearch optionFilterProp="label" options={o.skuOpts.filter(s => !o.skus.find(k => k.id === s.value)?.is_combo)} /></Form.Item></Col>
          <Col span={6}><Form.Item name={[f.name, 'qty']} rules={[{ required: true, message: '填写数量' }]}><InputNumber disabled={locked} min={1} addonBefore="数量" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={3}>{!locked && <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(f.name)} />}</Col></Row>)}
        {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ qty: 100 })}>添加SKU</Button>}
      </>}</Form.List>
    </Form>
  </Modal>;
}

export function FbaPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  const [detail, setDetail] = useState<number>(); const [edit, setEdit] = useState<{ open: boolean; row?: any }>({ open: false });
  return <>
    <CrudTable ref={ref} resource="fba_shipments" searchPlaceholder="货件单号 / Shipment ID / 计划名 / 跟踪号" statusTabs={{ field: 'status', items: FLOW }}
      filters={[{ name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }, { name: 'provider_id', label: '物流商', type: 'select', options: o.providerOpts }, { name: 'date', label: '创建日期', type: 'dateRange', span: 6 }]}
      canCreate createText="创建货件" onCreate={() => setEdit({ open: true })} onRowClick={r => setDetail(r.id)}
      rowActions={r => <><a onClick={() => setDetail(r.id)}>详情</a><a onClick={() => setEdit({ open: true, row: r })}>编辑</a></>} actionWidth={100}
      columns={[{ title: '货件单号 / Shipment ID', dataIndex: 'shipment_no', width: 190, fixed: 'left', render: (v, r) => <div><span className="mono" style={{ color: '#1668dc' }}>{v}</span><div className="mono" style={{ color: '#999' }}>{r.fba_shipment_id || '-'}</div></div> }, { title: '计划名称', dataIndex: 'plan_name', width: 160, ellipsis: true }, { title: '店铺', dataIndex: 'store_name', width: 140 }, { title: '发货仓 → 目的仓', width: 220, render: (_, r) => <span>{r.from_wh_name} → {r.to_wh_name}</span> }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '进度', width: 130, render: (_, r) => <Progress size="small" steps={6} percent={Math.round((FLOW.indexOf(r.status) + 1) / 6 * 100)} showInfo={false} /> }, { title: '件数', dataIndex: 'total_qty', width: 70, align: 'right' }, { title: '箱数', dataIndex: 'box_count', width: 60, align: 'right' }, { title: '重量kg', dataIndex: 'total_weight', width: 80, align: 'right' }, { title: '物流商 / 方式', dataIndex: 'provider_name', width: 180, render: (v, r) => <div>{v || '-'}<div style={{ color: '#999' }}>{r.channel}</div></div> }, { title: '头程运费', dataIndex: 'total_freight', width: 100, align: 'right', render: v => money(v) }, { title: '跟踪号', dataIndex: 'tracking_no', width: 140, render: v => <span className="mono">{v || '-'}</span> }, { title: '发货/预计到达', width: 120, render: (_, r) => <div>{r.ship_date || '-'}<div style={{ color: '#999' }}>{r.eta || '-'}</div></div> }]} scrollX={1900} />
    <FbaDetail id={detail} onClose={() => setDetail(undefined)} onChanged={() => ref.current?.reload()} />
    <FbaForm open={edit.open} row={edit.row} onClose={() => setEdit({ open: false })} onOk={() => { setEdit({ open: false }); ref.current?.reload(); }} />
  </>;
}

export function ProvidersPage({ type }: { type?: string }) {
  return <CrudTable resource="logistics_providers" useStore={false} extraParams={type ? { type } : undefined} searchPlaceholder="物流商名称" canCreate canEdit canDelete formTitle="物流商" createText="新增物流商"
    formFields={[{ name: 'name', label: '物流商名称', required: true }, { name: 'type', label: '类型', type: 'select', options: opt(['头程', '尾程/小包', '尾程/快递']) }, { name: 'contact', label: '联系人' }, { name: 'phone', label: '电话' }, { name: 'settle_method', label: '结算方式', type: 'select', options: opt(['月结', '周结', '预付']) }, { name: 'status', label: '状态', type: 'select', options: opt(['合作中', '暂停合作']) }]}
    columns={[{ title: '物流商', dataIndex: 'name', width: 220 }, { title: '类型', dataIndex: 'type', width: 110, render: v => <Tag color={v === '头程' ? 'purple' : 'blue'}>{v}</Tag> }, { title: '联系人', dataIndex: 'contact', width: 90 }, { title: '电话', dataIndex: 'phone', width: 130 }, { title: '结算方式', dataIndex: 'settle_method', width: 90 }, { title: '渠道数', dataIndex: 'channel_count', width: 80, align: 'right' }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }]} scrollX={1000} />;
}
