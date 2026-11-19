import { useRef, useState } from 'react';
import { Modal, Form, Select, InputNumber, Input, message, Tag, Button, Row, Col, Alert, Popconfirm, Segmented } from 'antd';
import { ImportOutlined, ExportOutlined, SwapOutlined, AuditOutlined } from '@ant-design/icons';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { api, post, put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, opt, num } from '../utils';

export function StockPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null); const [ss, setSs] = useState<any>(null); const [val, setVal] = useState<number>(0);
  return <>
    <CrudTable ref={ref} resource="inventory" useStore={false} searchPlaceholder="SKU / 品名"
      filters={[{ name: 'warehouse_id', label: '仓库', type: 'select', options: o.whOpts }, { name: 'warehouse_type', label: '仓库类型', type: 'select', options: opt(['本地仓', '海外仓', 'FBA仓']) }, { name: 'below_safety', label: '库存状态', type: 'select', options: [{ label: '低于安全库存', value: '1' }, { label: '正常', value: '0' }] }]}
      rowActions={r => <a onClick={() => { setSs(r); setVal(r.safety_stock); }}>安全库存</a>} actionWidth={90}
      columns={[{ title: 'SKU', dataIndex: 'sku', width: 150, render: v => <span className="mono">{v}</span> }, { title: '品名', dataIndex: 'sku_name', width: 220, ellipsis: true }, { title: '仓库', dataIndex: 'warehouse_name', width: 150 }, { title: '仓库类型', dataIndex: 'warehouse_type', width: 90, render: v => <StatusTag v={v} /> },
        { title: '可用', dataIndex: 'qty_available', width: 80, align: 'right', sorter: true, render: (v, r) => <b style={{ color: r.below_safety ? '#cf1322' : undefined }}>{num(v)}</b> }, { title: '锁定', dataIndex: 'qty_locked', width: 70, align: 'right' }, { title: '在途', dataIndex: 'qty_transit', width: 70, align: 'right', render: v => v ? <span style={{ color: '#1668dc' }}>{v}</span> : 0 },
        { title: '安全库存', dataIndex: 'safety_stock', width: 80, align: 'right' }, { title: '单位成本', dataIndex: 'unit_cost', width: 90, align: 'right', render: v => money(v) }, { title: '库存货值', dataIndex: 'stock_value', width: 110, align: 'right', sorter: true, render: v => money(v) },
        { title: '预警', dataIndex: 'below_safety', width: 100, render: v => v ? <Tag color="red">低于安全库存</Tag> : <Tag color="green">正常</Tag> }]} scrollX={1400} />
    <Modal title={`设置安全库存 · ${ss?.sku}`} open={!!ss} onCancel={() => setSs(null)} onOk={async () => { await put(`/r/inventory/${ss.id}`, { safety_stock: val }); message.success('已更新'); setSs(null); ref.current?.reload(); }}>
      <InputNumber min={0} value={val} onChange={v => setVal(v || 0)} style={{ width: '100%' }} addonAfter="件" />
    </Modal>
  </>;
}

export function MovesPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null); const [open, setOpen] = useState<string | null>(null); const [form] = Form.useForm();
  const skuId = Form.useWatch('sku_id', form); const fromWh = Form.useWatch('from_wh', form);
  const [avail, setAvail] = useState<number | null>(null);
  const check = async (s?: number, w?: number) => { if (!s || !w) return setAvail(null); const r = await api('/r/inventory', { params: { sku_id: s, warehouse_id: w } }); setAvail(r.list[0]?.qty_available ?? 0); };
  const openNew = (t: string) => { form.resetFields(); form.setFieldsValue({ type: t }); setAvail(null); setOpen(t); };
  return <>
    <CrudTable ref={ref} resource="stock_moves" useStore={false} searchPlaceholder="单号 / SKU" statusTabs={{ field: 'type', items: ['入库', '出库', '调拨'] }}
      filters={[{ name: 'status', label: '状态', type: 'select', options: opt(['已完成', '在途']) }, { name: 'date', label: '日期', type: 'dateRange', span: 6 }]}
      toolbar={() => <><Button type="primary" icon={<ImportOutlined />} onClick={() => openNew('入库')}>其他入库</Button><Button icon={<ExportOutlined />} onClick={() => openNew('出库')}>其他出库</Button><Button icon={<SwapOutlined />} onClick={() => openNew('调拨')}>新建调拨单</Button></>}
      rowActions={r => r.status === '在途' ? <Popconfirm title="确认调拨货物已到达目的仓？" onConfirm={async () => { await post(`/stock-moves/${r.id}/receive`); message.success('调拨入库完成'); ref.current?.reload(); }}><a>到货入库</a></Popconfirm> : null} actionWidth={90}
      columns={[{ title: '单号', dataIndex: 'move_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '类型', dataIndex: 'type', width: 70, render: v => <Tag color={v === '入库' ? 'green' : v === '出库' ? 'orange' : 'blue'}>{v}</Tag> }, { title: 'SKU', dataIndex: 'sku', width: 140 }, { title: '品名', dataIndex: 'sku_name', ellipsis: true, width: 200 }, { title: '数量', dataIndex: 'qty', width: 70, align: 'right' }, { title: '调出仓', dataIndex: 'from_wh_name', width: 140, render: v => v || '-' }, { title: '调入仓', dataIndex: 'to_wh_name', width: 140, render: v => v || '-' }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '备注', dataIndex: 'remark', ellipsis: true, width: 150 }, { title: '操作人', dataIndex: 'operator', width: 80 }, { title: '时间', dataIndex: 'created_at', width: 150 }]} scrollX={1500} />
    <Modal title={open === '调拨' ? '新建调拨单' : `其他${open}`} open={!!open} onCancel={() => setOpen(null)} width={620} onOk={async () => { const v = await form.validateFields(); const r = await post('/stock-moves', v); message.success(`${r.move_no} 已创建` + (open === '调拨' ? '，货物在途，目的仓到货后请点击「到货入库」' : '，库存已更新')); setOpen(null); ref.current?.reload(); }}>
      <Form form={form} layout="vertical">
        <Form.Item name="type" hidden><Input /></Form.Item>
        <Row gutter={12}>
          {open !== '入库' && <Col span={open === '调拨' ? 12 : 24}><Form.Item name="from_wh" label={open === '调拨' ? '调出仓库' : '出库仓库'} rules={[{ required: true }]}><Select options={o.whOpts} onChange={w => check(skuId, w)} /></Form.Item></Col>}
          {open !== '出库' && <Col span={open === '调拨' ? 12 : 24}><Form.Item name="to_wh" label={open === '调拨' ? '调入仓库' : '入库仓库'} rules={[{ required: true }]}><Select options={o.whOpts} /></Form.Item></Col>}
          <Col span={16}><Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={o.skuOpts.filter(s => !o.skus.find(k => k.id === s.value)?.is_combo)} onChange={s => check(s, fromWh)} /></Form.Item></Col>
          <Col span={8}><Form.Item name="qty" label="数量" rules={[{ required: true }]} extra={avail !== null && open !== '入库' ? `当前可用：${avail}` : undefined}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={24}><Form.Item name="remark" label="备注"><Input placeholder={open === '入库' ? '如：样品退回、其他入库' : open === '出库' ? '如：样品领用、报损' : '如：补货至海外仓'} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  </>;
}

export function StocktakePage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null); const [open, setOpen] = useState(false); const [form] = Form.useForm(); const [book, setBook] = useState<number | null>(null);
  const wh = Form.useWatch('warehouse_id', form); const sku = Form.useWatch('sku_id', form);
  const check = async (w?: number, s?: number) => { if (!w || !s) return setBook(null); const r = await api('/r/inventory', { params: { sku_id: s, warehouse_id: w } }); setBook(r.list[0]?.qty_available ?? 0); };
  return <>
    <CrudTable ref={ref} resource="stocktakes" useStore={false} searchPlaceholder="盘点单号 / SKU" statusTabs={{ field: 'status', items: ['待确认', '已确认'] }}
      filters={[{ name: 'warehouse_id', label: '仓库', type: 'select', options: o.whOpts }]}
      toolbar={() => <Button type="primary" icon={<AuditOutlined />} onClick={() => { form.resetFields(); setBook(null); setOpen(true); }}>新建盘点单</Button>}
      rowActions={r => r.status === '待确认' ? <Popconfirm title={`确认盘点结果？差异 ${r.diff > 0 ? '+' : ''}${r.diff} 将自动调整库存`} onConfirm={async () => { const x = await post(`/stocktakes/${r.id}/confirm`); message.success(`已确认，库存调整 ${x.diff}`); ref.current?.reload(); }}><a>确认盘点</a></Popconfirm> : null} actionWidth={90}
      columns={[{ title: '盘点单号', dataIndex: 'st_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '仓库', dataIndex: 'warehouse_name', width: 150 }, { title: 'SKU', dataIndex: 'sku', width: 140 }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '账面数量', dataIndex: 'book_qty', width: 90, align: 'right' }, { title: '实盘数量', dataIndex: 'actual_qty', width: 90, align: 'right' }, { title: '差异', dataIndex: 'diff', width: 80, align: 'right', render: v => <b style={{ color: v > 0 ? '#389e0d' : v < 0 ? '#cf1322' : undefined }}>{v > 0 ? '+' : ''}{v}</b> }, { title: '状态', dataIndex: 'status', width: 80, render: v => <StatusTag v={v} /> }, { title: '盘点人', dataIndex: 'operator', width: 80 }, { title: '时间', dataIndex: 'created_at', width: 150 }]} />
    <Modal title="新建盘点单" open={open} onCancel={() => setOpen(false)} onOk={async () => { const v = await form.validateFields(); const r = await post('/stocktakes', v); message.success(`盘点单 ${r.st_no} 已创建，待确认`); setOpen(false); ref.current?.reload(); }}>
      <Form form={form} layout="vertical">
        <Form.Item name="warehouse_id" label="仓库" rules={[{ required: true }]}><Select options={o.whOpts} onChange={w => check(w, sku)} /></Form.Item>
        <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={o.skuOpts} onChange={s => check(wh, s)} /></Form.Item>
        {book !== null && <Alert type="info" message={`账面可用数量：${book}`} style={{ marginBottom: 12 }} />}
        <Form.Item name="actual_qty" label="实盘数量" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

export function LedgerPage() {
  const o = useOptions();
  return <CrudTable resource="inventory_ledger" useStore={false} searchPlaceholder="SKU / 关联单号"
    filters={[{ name: 'warehouse_id', label: '仓库', type: 'select', options: o.whOpts }, { name: 'type', label: '流水类型', type: 'select', options: opt(['采购入库', '销售出库', '调拨出库', '调拨入库', '退货入库', '盘盈', '盘亏', '其他入库', '其他出库']) }, { name: 'date', label: '日期', type: 'dateRange', span: 6 }]}
    columns={[{ title: '时间', dataIndex: 'created_at', width: 150 }, { title: '仓库', dataIndex: 'warehouse_name', width: 150 }, { title: 'SKU', dataIndex: 'sku', width: 140, render: v => <span className="mono">{v}</span> }, { title: '品名', dataIndex: 'sku_name', ellipsis: true }, { title: '类型', dataIndex: 'type', width: 90, render: v => <Tag color={/入|盘盈/.test(v) ? 'green' : 'orange'}>{v}</Tag> }, { title: '变动数量', dataIndex: 'qty', width: 90, align: 'right', render: v => <b style={{ color: v > 0 ? '#389e0d' : '#cf1322' }}>{v > 0 ? '+' : ''}{v}</b> }, { title: '变动前', dataIndex: 'before_qty', width: 80, align: 'right' }, { title: '变动后', dataIndex: 'after_qty', width: 80, align: 'right' }, { title: '关联单号', dataIndex: 'ref_no', width: 170, render: v => <span className="mono">{v}</span> }, { title: '备注', dataIndex: 'remark', width: 140, ellipsis: true }, { title: '操作人', dataIndex: 'operator', width: 80 }]} scrollX={1500} />;
}

export function WarehousesPage() {
  const o = useOptions();
  return <CrudTable resource="warehouses" useStore={false} searchPlaceholder="仓库名称 / 编码" statusTabs={{ field: 'type', items: ['本地仓', '海外仓', 'FBA仓'] }} canCreate canEdit formTitle="仓库" createText="新增仓库"
    formFields={[{ name: 'code', label: '仓库编码', required: true }, { name: 'name', label: '仓库名称', required: true }, { name: 'type', label: '仓库类型', type: 'select', options: opt(['本地仓', '海外仓', 'FBA仓']), required: true }, { name: 'country', label: '国家/地区' }, { name: 'store_id', label: '关联店铺(FBA仓)', type: 'select', options: o.storeOpts }, { name: 'status', label: '状态', type: 'select', options: opt(['启用', '停用']) }, { name: 'address', label: '地址', span: 24 }]}
    columns={[{ title: '编码', dataIndex: 'code', width: 90, render: v => <b className="mono">{v}</b> }, { title: '仓库名称', dataIndex: 'name', width: 180 }, { title: '类型', dataIndex: 'type', width: 90, render: v => <StatusTag v={v} /> }, { title: '国家', dataIndex: 'country', width: 80 }, { title: '关联店铺', dataIndex: 'store_name', width: 160, render: v => v || '-' }, { title: '地址', dataIndex: 'address', ellipsis: true }, { title: '在库SKU', dataIndex: 'sku_count', width: 90, align: 'right' }, { title: '可用库存', dataIndex: 'stock_total', width: 100, align: 'right', render: v => num(v) }, { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> }]} />;
}
