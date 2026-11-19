import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, Descriptions, Table, Modal, Form, Row, Col, Input, InputNumber, Select, Button, Space, message, Tag, Alert, DatePicker, Progress, Segmented, Steps, Statistic, Card } from 'antd';
import { PlusOutlined, MinusCircleOutlined, ShoppingCartOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { api, post, put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, opt, num } from '../utils';

export function PlanPage() {
  const o = useOptions(); const [days, setDays] = useState(30); const [target, setTarget] = useState(45);
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(false); const [sel, setSel] = useState<number[]>([]);
  const [level, setLevel] = useState<string>('需补货'); const [wh, setWh] = useState<number>(1);
  const load = () => { setLoading(true); api('/purchase/suggestions', { params: { days, target } }).then(r => { setRows(r); setSel(r.filter((x: any) => x.level === '紧急').map((x: any) => x.sku_id)); }).finally(() => setLoading(false)); };
  useEffect(load, [days, target]);
  const shown = rows.filter(r => level === '全部' ? true : level === '需补货' ? r.suggest_qty > 0 : r.level === level);
  const selRows = rows.filter(r => sel.includes(r.sku_id) && r.suggest_qty > 0);
  const amount = selRows.reduce((a, r) => a + r.suggest_qty * r.purchase_cost, 0);
  return <div>
    <div className="panel">
      <Row gutter={16} align="middle">
        <Col span={14}><Space wrap>
          <span>销量统计周期</span><Segmented size="small" value={days} onChange={v => setDays(v as number)} options={[{ label: '7天', value: 7 }, { label: '14天', value: 14 }, { label: '30天', value: 30 }, { label: '60天', value: 60 }]} />
          <span style={{ marginLeft: 12 }}>目标备货天数</span><InputNumber size="small" min={7} max={180} value={target} onChange={v => setTarget(v || 45)} addonAfter="天" style={{ width: 110 }} />
          <span style={{ marginLeft: 12 }}>入库仓</span><Select size="small" style={{ width: 160 }} value={wh} onChange={setWh} options={o.whOpts.filter(w => o.warehouses.find(x => x.id === w.value)?.type === '本地仓')} />
        </Space></Col>
        <Col span={10} style={{ textAlign: 'right' }}><Space>
          <span style={{ color: '#666' }}>已选 {selRows.length} 个SKU，{num(selRows.reduce((a, r) => a + r.suggest_qty, 0))} 件，预计 <b>{money(amount)}</b></span>
          <Button type="primary" icon={<ShoppingCartOutlined />} disabled={!selRows.length} onClick={async () => { const r = await post('/purchase/plan-to-po', { warehouse_id: wh, items: selRows.map(x => ({ sku_id: x.sku_id, qty: x.suggest_qty })) }); Modal.success({ title: '已按供应商生成采购单', content: r.created.join('、') + '（状态：待审核）' }); load(); }}>生成采购单</Button>
        </Space></Col>
      </Row>
      <Alert style={{ marginTop: 10 }} type="info" showIcon message="建议采购量 = 日均销量 ×（供应商交期 + 目标备货天数）+ 安全库存 −（可用库存 + 在途库存 + 未到货采购量），按 10 件取整。可售天数小于交期时标记为紧急。" />
    </div>
    <div className="table-wrap">
      <div className="toolbar"><Segmented value={level} onChange={v => setLevel(v as string)} options={['需补货', '紧急', '建议补货', '充足', '全部'].map(x => ({ label: `${x} (${x === '全部' ? rows.length : x === '需补货' ? rows.filter(r => r.suggest_qty > 0).length : rows.filter(r => r.level === x).length})`, value: x }))} /></div>
      <Table rowKey="sku_id" size="small" bordered loading={loading} dataSource={shown} pagination={{ pageSize: 20, size: 'small', showTotal: t => `共 ${t} 条` }} scroll={{ x: 1400 }}
        rowSelection={{ selectedRowKeys: sel, onChange: k => setSel(k as number[]) }}
        columns={[
          { title: 'SKU', dataIndex: 'sku', width: 140, fixed: 'left', render: v => <span className="mono">{v}</span> }, { title: '品名', dataIndex: 'name', width: 200, ellipsis: true },
          { title: '供应商', dataIndex: 'supplier_name', width: 150, ellipsis: true }, { title: '交期', dataIndex: 'lead_days', width: 60, align: 'right', render: v => v + '天' },
          { title: `${days}天销量`, dataIndex: 'sold', width: 80, align: 'right', sorter: (a, b) => a.sold - b.sold }, { title: '日均销量', dataIndex: 'velocity', width: 80, align: 'right', sorter: (a, b) => a.velocity - b.velocity },
          { title: '可用库存', dataIndex: 'stock', width: 80, align: 'right' }, { title: '在途', dataIndex: 'transit', width: 60, align: 'right' }, { title: '采购未到', dataIndex: 'on_order', width: 80, align: 'right' }, { title: '安全库存', dataIndex: 'safety_stock', width: 80, align: 'right' },
          { title: '可售天数', dataIndex: 'cover_days', width: 120, sorter: (a, b) => a.cover_days - b.cover_days, render: (v, r) => v >= 999 ? '∞' : <Progress size="small" percent={Math.min(100, v / (r.lead_days + target) * 100)} format={() => v + '天'} status={v < r.lead_days ? 'exception' : 'normal'} /> },
          { title: '建议采购量', dataIndex: 'suggest_qty', width: 120, render: (v, r) => <InputNumber size="small" min={0} step={10} value={v} onChange={q => setRows(rows.map(x => x.sku_id === r.sku_id ? { ...x, suggest_qty: q || 0 } : x))} /> },
          { title: '采购单价', dataIndex: 'purchase_cost', width: 80, align: 'right', render: v => money(v) }, { title: '预计金额', width: 100, align: 'right', render: (_, r) => money(r.suggest_qty * r.purchase_cost) },
          { title: '状态', dataIndex: 'level', width: 90, fixed: 'right', render: v => <StatusTag v={v} /> },
        ]} />
    </div>
  </div>;
}

const PO_STEPS = ['草稿', '待审核', '已下单', '部分到货', '已完成'];
export function PoDetail({ id, onClose, onChanged }: { id?: number; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<any>(null); const [recv, setRecv] = useState<Record<number, number>>({}); const [recvOpen, setRecvOpen] = useState(false);
  const load = () => id && api(`/purchase-orders/${id}/detail`).then(setD);
  useEffect(() => { setD(null); load(); }, [id]);
  const status = async (s: string) => { await post(`/purchase-orders/${d.id}/status`, { status: s }); message.success(`状态已变更为「${s}」`); load(); onChanged(); };
  const step = d?.status === '已取消' ? -1 : PO_STEPS.indexOf(d?.status);
  return <Drawer title={d ? <Space>采购单 <span className="mono">{d.po_no}</span><StatusTag v={d.status} /></Space> : '采购单'} width={900} open={!!id} onClose={onClose}
    extra={d && <Space>
      {d.status === '草稿' && <Button type="primary" onClick={() => status('待审核')}>提交审核</Button>}
      {d.status === '待审核' && <><Button onClick={() => status('草稿')}>驳回</Button><Button type="primary" onClick={() => status('已下单')}>审核通过并下单</Button></>}
      {['已下单', '部分到货'].includes(d.status) && <Button type="primary" icon={<InboxOutlined />} onClick={() => { setRecv(Object.fromEntries(d.items.map((i: any) => [i.id, i.qty - i.received_qty]))); setRecvOpen(true); }}>收货入库</Button>}
      {['草稿', '待审核', '已下单'].includes(d.status) && <Button danger onClick={() => Modal.confirm({ title: '确认取消采购单？', onOk: () => status('已取消') })}>取消</Button>}
    </Space>}>
    {d && <>
      <Steps size="small" current={step} status={d.status === '已取消' ? 'error' : undefined} items={PO_STEPS.map(s => ({ title: s }))} style={{ marginBottom: 16 }} />
      <Descriptions className="desc-small" bordered size="small" column={3} items={[
        { label: '采购单号', children: <span className="mono">{d.po_no}</span> }, { label: '供应商', children: d.supplier_name }, { label: '入库仓库', children: d.warehouse_name },
        { label: '采购金额', children: <b>{money(d.total_amount)}</b> }, { label: '运费', children: money(d.freight) }, { label: '付款状态', children: <StatusTag v={d.pay_status} /> },
        { label: '采购员', children: d.buyer }, { label: '预计到货', children: d.expected_date || '-' }, { label: '创建时间', children: d.created_at }, { label: '备注', children: d.remark || '-', span: 3 },
      ]} />
      <div className="panel-title" style={{ marginTop: 14 }}>采购明细</div>
      <Table size="small" rowKey="id" pagination={false} dataSource={d.items} columns={[{ title: 'SKU', dataIndex: 'sku', render: v => <span className="mono">{v}</span> }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '单价', dataIndex: 'unit_price', align: 'right', render: v => money(v) }, { title: '采购量', dataIndex: 'qty', align: 'right' }, { title: '已到货', dataIndex: 'received_qty', align: 'right' }, { title: '到货进度', width: 160, render: (_, r: any) => <Progress size="small" percent={Math.round(r.received_qty / r.qty * 100)} /> }, { title: '金额', align: 'right', render: (_, r: any) => money(r.qty * r.unit_price) }]} />
      <div className="panel-title" style={{ marginTop: 14 }}>收货记录</div>
      <Table size="small" rowKey="id" pagination={false} dataSource={d.receipts} locale={{ emptyText: '暂无收货记录' }} columns={[{ title: '收货单号', dataIndex: 'rc_no', render: v => <span className="mono">{v}</span> }, { title: 'SKU', dataIndex: 'sku' }, { title: '数量', dataIndex: 'qty', align: 'right' }, { title: '质检', dataIndex: 'qc_status', render: v => <Tag color={v === '合格' ? 'green' : 'red'}>{v}</Tag> }, { title: '操作人', dataIndex: 'operator' }, { title: '时间', dataIndex: 'created_at' }]} />
      <Modal title="采购收货入库" open={recvOpen} width={700} onCancel={() => setRecvOpen(false)} onOk={async () => { const r = await post(`/purchase-orders/${d.id}/receive`, { items: Object.entries(recv).map(([k, v]) => ({ item_id: Number(k), qty: v })) }); message.success(r.left > 0 ? `收货成功，剩余 ${r.left} 件未到货` : '收货成功，采购单已完成'); setRecvOpen(false); load(); onChanged(); }}>
        <Alert type="info" showIcon message={`入库仓库：${d.warehouse_name}，收货后自动增加可用库存并生成库存流水。`} style={{ marginBottom: 10 }} />
        <Table size="small" rowKey="id" pagination={false} dataSource={d.items.filter((i: any) => i.qty > i.received_qty)} columns={[{ title: 'SKU', dataIndex: 'sku' }, { title: '未到货', render: (_, r: any) => r.qty - r.received_qty }, { title: '本次收货', render: (_, r: any) => <InputNumber size="small" min={0} max={r.qty - r.received_qty} value={recv[r.id]} onChange={v => setRecv({ ...recv, [r.id]: v || 0 })} /> }]} />
      </Modal>
    </>}
  </Drawer>;
}

export function PoForm({ row, open, onClose, onOk }: { row?: any; open: boolean; onClose: () => void; onOk: () => void }) {
  const [form] = Form.useForm(); const o = useOptions(); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return; form.resetFields();
    if (row) api(`/purchase-orders/${row.id}/detail`).then(d => form.setFieldsValue({ ...d, expected_date: d.expected_date ? dayjs(d.expected_date) : null, items: d.items.map((i: any) => ({ sku_id: i.sku_id, qty: i.qty, unit_price: i.unit_price, received_qty: i.received_qty })) }));
    else form.setFieldsValue({ warehouse_id: 1, freight: 0, expected_date: dayjs().add(10, 'day'), items: [{ qty: 100 }] });
  }, [open, row?.id]);
  const items = Form.useWatch('items', form) || [];
  const total = items.reduce((a: number, i: any) => a + (i?.qty || 0) * (i?.unit_price || 0), 0);
  const locked = row && !['草稿', '待审核'].includes(row.status);
  const submit = async () => {
    const v = await form.validateFields(); v.expected_date = v.expected_date?.format('YYYY-MM-DD'); if (locked) delete v.items; setSaving(true);
    try { if (row) await put(`/purchase-orders/${row.id}`, v); else { const r = await post('/purchase-orders', v); message.success('已创建采购单 ' + r.po_no); } onOk(); } finally { setSaving(false); }
  };
  return <Modal title={row ? `编辑采购单 · ${row.po_no}` : '新建采购单'} open={open} width={860} onCancel={onClose} onOk={submit} confirmLoading={saving} maskClosable={false} forceRender>
    <Form form={form} layout="vertical">
      <Row gutter={14}>
        <Col span={8}><Form.Item name="supplier_id" label="供应商" rules={[{ required: true }]}><Select options={o.supOpts} showSearch optionFilterProp="label" /></Form.Item></Col>
        <Col span={8}><Form.Item name="warehouse_id" label="入库仓库" rules={[{ required: true }]}><Select options={o.whOpts} /></Form.Item></Col>
        <Col span={8}><Form.Item name="expected_date" label="预计到货"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="freight" label="运费(¥)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        <Col span={8}><Form.Item name="pay_status" label="付款状态"><Select options={opt(['未付款', '已付定金', '已付款'])} /></Form.Item></Col>
        <Col span={8}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
      </Row>
      <div className="panel-title" style={{ fontSize: 13 }}>采购明细 <span style={{ fontWeight: 400 }}>合计：<b>{money(total)}</b></span></div>
      {locked && <Alert type="warning" showIcon message="已下单的采购单不可修改明细" style={{ marginBottom: 8 }} />}
      <Form.List name="items">{(fields, { add, remove }) => <>
        {fields.map(f => <Row gutter={8} key={f.key}>
          <Col span={12}><Form.Item name={[f.name, 'sku_id']} rules={[{ required: true, message: '选择SKU' }]}><Select disabled={locked} showSearch optionFilterProp="label" options={o.skuOpts.filter(s => !o.skus.find(k => k.id === s.value)?.is_combo)} placeholder="选择SKU" onChange={v => { const k = o.skus.find(s => s.id === v); const its = form.getFieldValue('items'); its[f.name].unit_price = k?.purchase_cost; form.setFieldsValue({ items: [...its] }); }} /></Form.Item></Col>
          <Col span={5}><Form.Item name={[f.name, 'qty']} rules={[{ required: true, message: '填写数量' }]}><InputNumber disabled={locked} min={1} addonBefore="数量" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={5}><Form.Item name={[f.name, 'unit_price']} rules={[{ required: true, message: '填写单价' }]}><InputNumber disabled={locked} min={0} addonBefore="¥" style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={2}>{!locked && <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(f.name)} />}</Col></Row>)}
        {!locked && <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ qty: 100 })}>添加SKU</Button>}
      </>}</Form.List>
    </Form>
  </Modal>;
}

export function PoPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  const [detail, setDetail] = useState<number>(); const [edit, setEdit] = useState<{ open: boolean; row?: any }>({ open: false });
  return <>
    <CrudTable ref={ref} resource="purchase_orders" useStore={false} searchPlaceholder="采购单号 / 供应商" selectable
      statusTabs={{ field: 'status', items: ['草稿', '待审核', '已下单', '部分到货', '已完成', '已取消'] }}
      filters={[{ name: 'supplier_id', label: '供应商', type: 'select', options: o.supOpts }, { name: 'pay_status', label: '付款状态', type: 'select', options: opt(['未付款', '已付定金', '已付款']) }, { name: 'date', label: '创建日期', type: 'dateRange', span: 6 }]}
      canCreate createText="新建采购单" onCreate={() => setEdit({ open: true })} onRowClick={r => setDetail(r.id)}
      toolbar={c => <Button disabled={!c.selected.length} onClick={async () => { let n = 0; for (const r of c.selected) if (r.status === '待审核') { await post(`/purchase-orders/${r.id}/status`, { status: '已下单' }); n++; } message.success(`批量审核通过 ${n} 个采购单`); c.clearSelected(); c.reload(); }}>批量审核</Button>}
      rowActions={r => <><a onClick={() => setDetail(r.id)}>详情</a><a onClick={() => setEdit({ open: true, row: r })}>编辑</a></>} actionWidth={100}
      columns={[{ title: '采购单号', dataIndex: 'po_no', width: 170, fixed: 'left', render: v => <span className="mono" style={{ color: '#1668dc' }}>{v}</span> }, { title: '供应商', dataIndex: 'supplier_name', width: 160 }, { title: 'SKU', dataIndex: 'sku_list', width: 220, ellipsis: true, render: v => <span className="mono">{v}</span> }, { title: '采购量', dataIndex: 'total_qty', width: 80, align: 'right' }, { title: '到货进度', width: 140, render: (_, r) => <Progress size="small" percent={r.total_qty ? Math.round(r.received_qty / r.total_qty * 100) : 0} /> }, { title: '采购金额', dataIndex: 'total_amount', width: 110, align: 'right', sorter: true, render: v => money(v) }, { title: '入库仓', dataIndex: 'warehouse_name', width: 130 }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '付款', dataIndex: 'pay_status', width: 80, render: v => <StatusTag v={v} /> }, { title: '采购员', dataIndex: 'buyer', width: 80 }, { title: '预计到货', dataIndex: 'expected_date', width: 100 }, { title: '创建时间', dataIndex: 'created_at', width: 150, sorter: true }]} scrollX={1600} />
    <PoDetail id={detail} onClose={() => setDetail(undefined)} onChanged={() => ref.current?.reload()} />
    <PoForm open={edit.open} row={edit.row} onClose={() => setEdit({ open: false })} onOk={() => { setEdit({ open: false }); ref.current?.reload(); }} />
  </>;
}

export function ReceiptsPage() {
  return <CrudTable resource="receipts" useStore={false} searchPlaceholder="收货单号 / 采购单号 / SKU"
    columns={[{ title: '收货单号', dataIndex: 'rc_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '采购单号', dataIndex: 'po_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: 'SKU', dataIndex: 'sku', width: 140 }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '收货数量', dataIndex: 'qty', width: 90, align: 'right' }, { title: '质检', dataIndex: 'qc_status', width: 80, render: v => <Tag color={v === '合格' ? 'green' : 'red'}>{v}</Tag> }, { title: '仓库', dataIndex: 'warehouse_name', width: 140 }, { title: '操作人', dataIndex: 'operator', width: 90 }, { title: '收货时间', dataIndex: 'created_at', width: 150 }]} />;
}

export function SuppliersPage() {
  return <CrudTable resource="suppliers" useStore={false} searchPlaceholder="供应商名称 / 编码 / 联系人" canCreate canEdit canDelete formTitle="供应商" createText="新增供应商"
    filters={[{ name: 'rating', label: '评级', type: 'select', options: opt(['A', 'B', 'C']) }, { name: 'status', label: '状态', type: 'select', options: opt(['合作中', '暂停合作']) }]}
    formFields={[{ name: 'code', label: '供应商编码', required: true }, { name: 'name', label: '供应商名称', required: true }, { name: 'contact', label: '联系人' }, { name: 'phone', label: '电话' }, { name: 'address', label: '地址', span: 24 }, { name: 'lead_days', label: '交期(天)', type: 'number' }, { name: 'settle_method', label: '结算方式', type: 'select', options: opt(['月结30天', '月结60天', '款到发货', '30%定金']) }, { name: 'rating', label: '评级', type: 'select', options: opt(['A', 'B', 'C']) }, { name: 'status', label: '状态', type: 'select', options: opt(['合作中', '暂停合作']) }]}
    columns={[{ title: '编码', dataIndex: 'code', width: 90 }, { title: '供应商名称', dataIndex: 'name', width: 200 }, { title: '联系人', dataIndex: 'contact', width: 80 }, { title: '电话', dataIndex: 'phone', width: 130 }, { title: '地址', dataIndex: 'address', ellipsis: true }, { title: '交期', dataIndex: 'lead_days', width: 70, render: v => v + '天' }, { title: '结算方式', dataIndex: 'settle_method', width: 100 }, { title: '评级', dataIndex: 'rating', width: 60, render: v => <Tag color={v === 'A' ? 'green' : v === 'B' ? 'blue' : 'orange'}>{v}</Tag> }, { title: 'SKU数', dataIndex: 'sku_count', width: 70, align: 'right' }, { title: '采购单数', dataIndex: 'po_count', width: 80, align: 'right' }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }]} scrollX={1400} />;
}
