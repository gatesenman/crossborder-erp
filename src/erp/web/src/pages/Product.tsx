import { useEffect, useRef, useState } from 'react';
import { Drawer, Descriptions, Table, Tabs, Modal, Form, Row, Col, Input, InputNumber, Select, Button, Space, message, Tag, Statistic, Card } from 'antd';
import { PlusOutlined, MinusCircleOutlined, LinkOutlined } from '@ant-design/icons';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { api, post, put } from '../api';
import { useOptions } from '../ctx';
import { money, StatusTag, PlatformTag, opt, num } from '../utils';

export function SkuDetail({ id, onClose }: { id?: number; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { setD(null); if (id) api(`/skus/${id}/detail`).then(setD); }, [id]);
  return (
    <Drawer title={d ? `SKU 详情 · ${d.sku}` : 'SKU 详情'} width={860} open={!!id} onClose={onClose} destroyOnClose>
      {d && <>
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}><Card size="small"><Statistic title="采购成本" value={d.purchase_cost} precision={2} prefix="¥" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="头程运费/件" value={d.freight_cost} precision={2} prefix="¥" /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="单位落地成本" value={d.unit} precision={2} prefix="¥" valueStyle={{ color: '#1668dc' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="近30天销量" value={d.sales30} suffix="件" /></Card></Col>
        </Row>
        <Descriptions className="desc-small" bordered size="small" column={3} items={[
          { label: 'SKU', children: <b className="mono">{d.sku}</b> }, { label: 'SPU', children: d.spu }, { label: '状态', children: <StatusTag v={d.status} /> },
          { label: '品名', children: d.name, span: 2 }, { label: '类型', children: d.is_combo ? <Tag color="purple">组合SKU</Tag> : '普通SKU' },
          { label: '颜色', children: d.color || '-' }, { label: '尺码/规格', children: d.size || '-' }, { label: '供应商', children: d.supplier_name || '-' },
          { label: '重量', children: `${d.weight} kg` }, { label: '尺寸', children: `${d.length}×${d.width}×${d.height} cm` }, { label: '安全库存', children: d.safety_stock },
          { label: '包材成本', children: money(d.packaging_cost) }, { label: '创建时间', children: d.created_at, span: 2 },
        ]} />
        <Tabs style={{ marginTop: 12 }} items={[
          { key: 'inv', label: `库存分布 (${d.inventory.length})`, children: <Table size="small" rowKey="id" pagination={false} dataSource={d.inventory} columns={[{ title: '仓库', dataIndex: 'warehouse_name' }, { title: '类型', dataIndex: 'type', render: v => <StatusTag v={v} /> }, { title: '可用', dataIndex: 'qty_available', align: 'right' }, { title: '锁定', dataIndex: 'qty_locked', align: 'right' }, { title: '在途', dataIndex: 'qty_transit', align: 'right' }]} summary={r => <Table.Summary.Row><Table.Summary.Cell index={0} colSpan={2}><b>合计</b></Table.Summary.Cell><Table.Summary.Cell index={2} align="right"><b>{r.reduce((a: number, x: any) => a + x.qty_available, 0)}</b></Table.Summary.Cell><Table.Summary.Cell index={3} align="right">{r.reduce((a: number, x: any) => a + x.qty_locked, 0)}</Table.Summary.Cell><Table.Summary.Cell index={4} align="right">{r.reduce((a: number, x: any) => a + x.qty_transit, 0)}</Table.Summary.Cell></Table.Summary.Row>} /> },
          { key: 'msku', label: `平台 MSKU (${d.mskus.length})`, children: <Table size="small" rowKey="id" pagination={false} dataSource={d.mskus} columns={[{ title: 'MSKU', dataIndex: 'msku', render: v => <span className="mono">{v}</span> }, { title: '店铺', dataIndex: 'store_name' }, { title: '平台', dataIndex: 'platform', render: v => <PlatformTag v={v} /> }, { title: 'ASIN/Item ID', dataIndex: 'asin' }, { title: 'FNSKU', dataIndex: 'fnsku' }, { title: '售价', dataIndex: 'price', align: 'right' }]} /> },
          ...(d.is_combo ? [{ key: 'combo', label: `组合明细 (${d.combo_items.length})`, children: <Table size="small" rowKey="id" pagination={false} dataSource={d.combo_items} columns={[{ title: '子SKU', dataIndex: 'sku' }, { title: '品名', dataIndex: 'name' }, { title: '数量', dataIndex: 'qty' }]} /> }] : []),
        ]} />
      </>}
    </Drawer>
  );
}

export function SkuForm({ row, open, onClose, onOk, combo }: { row?: any; open: boolean; onClose: () => void; onOk: () => void; combo?: boolean }) {
  const [form] = Form.useForm(); const o = useOptions(); const [saving, setSaving] = useState(false);
  const isCombo = Form.useWatch('is_combo', form);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (row) api(`/skus/${row.id}/detail`).then(d => form.setFieldsValue({ ...d, combo_items: d.combo_items.map((c: any) => ({ sku_id: c.sku_id, qty: c.qty })) }));
    else form.setFieldsValue({ status: '在售', is_combo: combo ? 1 : 0, safety_stock: 50, packaging_cost: 1.5, freight_cost: 0, combo_items: combo ? [{ qty: 1 }, { qty: 1 }] : [] });
  }, [open, row?.id]);
  const submit = async () => {
    const v = await form.validateFields(); setSaving(true);
    try { if (row) await put(`/r/skus/${row.id}`, v); else await post('/r/skus', v); message.success('保存成功'); onOk(); } finally { setSaving(false); }
  };
  return (
    <Modal title={row ? `编辑 SKU · ${row.sku}` : combo ? '新增组合 SKU' : '新增 SKU'} open={open} width={820} onOk={submit} confirmLoading={saving} onCancel={onClose} forceRender maskClosable={false}>
      <Form form={form} layout="vertical">
        <div className="panel-title" style={{ fontSize: 13 }}>基础信息</div>
        <Row gutter={14}>
          <Col span={8}><Form.Item name="sku" label="SKU 编码" rules={[{ required: true }]}><Input placeholder="如 VH1001-BK-L" /></Form.Item></Col>
          <Col span={8}><Form.Item name="product_id" label="所属 SPU"><Select showSearch optionFilterProp="label" options={o.productOpts} allowClear /></Form.Item></Col>
          <Col span={8}><Form.Item name="is_combo" label="SKU 类型"><Select options={[{ label: '普通SKU', value: 0 }, { label: '组合SKU', value: 1 }]} /></Form.Item></Col>
          <Col span={16}><Form.Item name="name" label="品名" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="status" label="状态"><Select options={opt(['在售', '停售', '清仓'])} /></Form.Item></Col>
          <Col span={6}><Form.Item name="color" label="颜色"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="size" label="规格/尺码"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="supplier_id" label="默认供应商"><Select showSearch optionFilterProp="label" options={o.supOpts} allowClear /></Form.Item></Col>
        </Row>
        <div className="panel-title" style={{ fontSize: 13 }}>成本与物流属性</div>
        <Row gutter={14}>
          <Col span={6}><Form.Item name="purchase_cost" label="采购成本(¥)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="freight_cost" label="头程运费/件(¥)" tooltip="FBA货件分摊后自动回写"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="packaging_cost" label="包材成本(¥)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="safety_stock" label="安全库存"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="weight" label="重量(kg)"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="length" label="长(cm)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="width" label="宽(cm)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="height" label="高(cm)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        {!!isCombo && <>
          <div className="panel-title" style={{ fontSize: 13 }}>组合明细（发货时按子SKU扣减库存，成本按子SKU汇总）</div>
          <Form.List name="combo_items">{(fields, { add, remove }) => <>
            {fields.map(f => <Row gutter={8} key={f.key}><Col span={16}><Form.Item name={[f.name, 'sku_id']} rules={[{ required: true, message: '选择子SKU' }]}><Select showSearch optionFilterProp="label" options={o.skuOpts.filter(s => !o.skus.find(k => k.id === s.value)?.is_combo)} placeholder="选择子SKU" /></Form.Item></Col><Col span={5}><Form.Item name={[f.name, 'qty']}><InputNumber min={1} addonBefore="×" style={{ width: '100%' }} /></Form.Item></Col><Col span={3}><Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(f.name)} /></Col></Row>)}
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ qty: 1 })}>添加子SKU</Button>
          </>}</Form.List>
        </>}
      </Form>
    </Modal>
  );
}

export function SkuPage({ combo }: { combo?: boolean }) {
  const ref = useRef<CrudRef>(null); const o = useOptions();
  const [detail, setDetail] = useState<number>(); const [edit, setEdit] = useState<{ open: boolean; row?: any }>({ open: false });
  return <>
    <CrudTable ref={ref} resource="skus" extraParams={combo ? { is_combo: 1 } : undefined} searchPlaceholder="SKU / 品名 / SPU" useStore={false} selectable
      filters={[{ name: 'category', label: '品类', type: 'select', options: o.catOpts }, { name: 'status', label: '状态', type: 'select', options: opt(['在售', '停售', '清仓']) }, { name: 'supplier_id', label: '供应商', type: 'select', options: o.supOpts }, ...(combo ? [] : [{ name: 'is_combo', label: 'SKU类型', type: 'select' as const, options: [{ label: '普通SKU', value: '0' }, { label: '组合SKU', value: '1' }] }])]}
      canCreate createText={combo ? '新增组合SKU' : '新增SKU'} onCreate={() => setEdit({ open: true })} canEdit onEdit={r => setEdit({ open: true, row: r })} canDelete
      toolbar={c => <><Button disabled={!c.selected.length} onClick={async () => { for (const r of c.selected) await put(`/r/skus/${r.id}`, { status: '停售' }); message.success('已批量停售'); c.clearSelected(); c.reload(); }}>批量停售</Button><Button onClick={() => message.info('请下载模板后导入（演示环境）')}>导入SKU</Button></>}
      columns={[
        { title: 'SKU', dataIndex: 'sku', width: 150, fixed: 'left', sorter: true, render: (v, r) => <a className="mono" onClick={() => setDetail(r.id)}>{v}</a> },
        { title: '品名', dataIndex: 'name', width: 220, ellipsis: true },
        { title: 'SPU', dataIndex: 'spu', width: 80 }, { title: '品类', dataIndex: 'category', width: 90 },
        { title: '属性', width: 110, render: (_, r) => [r.color, r.size].filter(Boolean).join(' / ') || '-' },
        { title: '类型', dataIndex: 'is_combo', width: 70, render: v => v ? <Tag color="purple">组合</Tag> : <Tag>普通</Tag> },
        { title: '采购价', dataIndex: 'purchase_cost', width: 80, align: 'right', sorter: true, render: v => money(v) },
        { title: '头程/件', dataIndex: 'freight_cost', width: 80, align: 'right', render: v => money(v) },
        { title: '落地成本', dataIndex: 'landed_cost', width: 90, align: 'right', sorter: true, render: v => <b>{money(v)}</b> },
        { title: '重量kg', dataIndex: 'weight', width: 70, align: 'right' },
        { title: '总可用库存', dataIndex: 'stock_total', width: 90, align: 'right', sorter: true, render: (v, r) => <span style={{ color: v < r.safety_stock ? '#cf1322' : undefined }}>{num(v)}</span> },
        { title: 'MSKU数', dataIndex: 'msku_count', width: 70, align: 'right', render: v => <><LinkOutlined /> {v}</> },
        { title: '供应商', dataIndex: 'supplier_name', width: 140, ellipsis: true },
        { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> },
      ]} scrollX={1700} actionWidth={110} />
    <SkuDetail id={detail} onClose={() => setDetail(undefined)} />
    <SkuForm open={edit.open} row={edit.row} combo={combo} onClose={() => setEdit({ open: false })} onOk={() => { setEdit({ open: false }); ref.current?.reload(); }} />
  </>;
}

export function SpuPage() {
  const o = useOptions();
  return <CrudTable resource="products" searchPlaceholder="SPU / 中文名 / 英文名" useStore={false}
    filters={[{ name: 'category', label: '品类', type: 'select', options: o.catOpts }, { name: 'status', label: '状态', type: 'select', options: opt(['在售', '停售']) }]}
    canCreate createText="新增SPU" canEdit canDelete formTitle="SPU"
    formFields={[{ name: 'spu', label: 'SPU编码', required: true }, { name: 'name', label: '中文名', required: true }, { name: 'name_en', label: '英文名', span: 24 }, { name: 'category', label: '品类', type: 'select', options: o.catOpts }, { name: 'brand', label: '品牌' }, { name: 'developer', label: '开发人员' }, { name: 'status', label: '状态', type: 'select', options: opt(['在售', '停售']) }]}
    columns={[{ title: 'SPU', dataIndex: 'spu', width: 90, render: v => <b className="mono">{v}</b> }, { title: '中文名', dataIndex: 'name', width: 180 }, { title: '英文名', dataIndex: 'name_en', width: 240, ellipsis: true }, { title: '品类', dataIndex: 'category', width: 90 }, { title: '品牌', dataIndex: 'brand', width: 90 }, { title: '开发', dataIndex: 'developer', width: 70 }, { title: '变体数', dataIndex: 'sku_count', width: 70, align: 'right' }, { title: '变体SKU', dataIndex: 'sku_list', ellipsis: true, width: 300, render: v => <span className="mono">{v}</span> }, { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> }, { title: '创建时间', dataIndex: 'created_at', width: 150 }]} />;
}

export function MskuPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null);
  const [pair, setPair] = useState<any>(null); const [skuId, setSkuId] = useState<number>();
  return <>
    <CrudTable ref={ref} resource="mskus" searchPlaceholder="MSKU / ASIN / FNSKU / SKU" selectable
      filters={[{ name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts }, { name: 'platform', label: '平台', type: 'select', options: opt(['Amazon', 'Shopify', 'TikTok Shop', 'Temu', 'eBay', 'Walmart']) }, { name: 'paired', label: '配对状态', type: 'select', options: [{ label: '已配对', value: '1' }, { label: '未配对', value: '0' }] }]}
      canCreate createText="新增Listing" canEdit canDelete formTitle="MSKU"
      formFields={[{ name: 'msku', label: 'MSKU（平台SKU）', required: true }, { name: 'store_id', label: '店铺', type: 'select', options: o.storeOpts, required: true }, { name: 'sku_id', label: '配对本地SKU', type: 'select', options: o.skuOpts }, { name: 'asin', label: 'ASIN / Item ID' }, { name: 'fnsku', label: 'FNSKU' }, { name: 'price', label: '售价', type: 'number' }, { name: 'title', label: 'Listing 标题', span: 24 }, { name: 'status', label: '状态', type: 'select', options: opt(['在售', '停售']) }]}
      rowActions={r => <a onClick={() => { setPair(r); setSkuId(r.sku_id); }}>{r.sku_id ? '换绑' : '配对'}</a>} actionWidth={140}
      toolbar={c => <Button onClick={async () => { const un = c.selected.filter(r => !r.sku_id); let n = 0; for (const r of un) { const m = o.skus.find(s => r.msku.toUpperCase().includes(s.sku.toUpperCase())); if (m) { await put(`/r/mskus/${r.id}`, { sku_id: m.id }); n++; } } message.success(`智能配对完成：${n}/${un.length} 条`); c.reload(); }} disabled={!c.selected.length}>智能配对所选</Button>}
      columns={[{ title: 'MSKU', dataIndex: 'msku', width: 180, render: v => <span className="mono">{v}</span> }, { title: '店铺', dataIndex: 'store_name', width: 150 }, { title: '平台', dataIndex: 'platform', width: 100, render: v => <PlatformTag v={v} /> }, { title: '站点', dataIndex: 'site', width: 60 }, { title: 'ASIN/Item ID', dataIndex: 'asin', width: 120 }, { title: 'FNSKU', dataIndex: 'fnsku', width: 110 }, { title: '标题', dataIndex: 'title', ellipsis: true, width: 260 }, { title: '售价', dataIndex: 'price', width: 80, align: 'right', render: (v, r) => money(v, r.currency) },
        { title: '本地SKU', dataIndex: 'sku', width: 150, render: v => v ? <Tag color="blue" className="mono">{v}</Tag> : <Tag color="red">未配对</Tag> }, { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> }]} scrollX={1600} />
    <Modal title={`MSKU 配对 · ${pair?.msku}`} open={!!pair} onCancel={() => setPair(null)} onOk={async () => { await put(`/r/mskus/${pair.id}`, { sku_id: skuId || null }); message.success('配对成功，后续订单将自动映射到本地SKU'); setPair(null); ref.current?.reload(); }}>
      <p style={{ color: '#888' }}>店铺：{pair?.store_name}　ASIN：{pair?.asin || '-'}</p>
      <Select style={{ width: '100%' }} showSearch optionFilterProp="label" value={skuId} onChange={setSkuId} options={o.skuOpts} placeholder="选择本地 SKU" allowClear />
    </Modal>
  </>;
}
