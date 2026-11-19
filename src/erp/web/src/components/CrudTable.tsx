import { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Table, Button, Form, Input, Select, DatePicker, InputNumber, Modal, Space, Tabs, Popconfirm, message, Switch, Row, Col, Tooltip, Dropdown, Badge } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, ExportOutlined, ColumnHeightOutlined, UndoOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, post, put, del } from '../api';
import { useApp } from '../ctx';

export type Field = { name: string; label: string; type?: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'dateRange' | 'textarea' | 'switch' | 'password'; options?: { label: any; value: any }[]; required?: boolean; span?: number; placeholder?: string; width?: number; disabled?: boolean; min?: number; addonAfter?: string };
export type Ctx = { reload: () => void; selected: any[]; clearSelected: () => void; openEdit: (row?: any) => void; params: any };
export type CrudRef = Ctx;
type Props = {
  resource: string; columns: ColumnsType<any>; filters?: Field[]; formFields?: Field[]; searchPlaceholder?: string;
  statusTabs?: { field: string; items: string[] }; extraParams?: Record<string, any>;
  toolbar?: (c: Ctx) => ReactNode; rowActions?: (row: any, c: Ctx) => ReactNode; actionWidth?: number;
  canCreate?: boolean; canEdit?: boolean; canDelete?: boolean; createText?: string;
  onCreate?: (c: Ctx) => void; onEdit?: (row: any, c: Ctx) => void; selectable?: boolean; formWidth?: number;
  toForm?: (row: any) => any; fromForm?: (v: any, row?: any) => any; summary?: (data: any) => ReactNode; scrollX?: number; pageSize?: number; title?: ReactNode; useStore?: boolean;
  onRowClick?: (row: any) => void; formTitle?: string;
};

export function FieldInput({ f }: { f: Field }) {
  const w = { width: '100%' };
  switch (f.type) {
    case 'number': return <InputNumber style={w} min={f.min} addonAfter={f.addonAfter} disabled={f.disabled} />;
    case 'select': return <Select allowClear showSearch optionFilterProp="label" options={f.options} placeholder={f.placeholder || '请选择'} disabled={f.disabled} />;
    case 'multiselect': return <Select mode="multiple" allowClear showSearch optionFilterProp="label" options={f.options} placeholder={f.placeholder || '请选择'} maxTagCount="responsive" />;
    case 'date': return <DatePicker style={w} />;
    case 'dateRange': return <DatePicker.RangePicker style={w} />;
    case 'textarea': return <Input.TextArea rows={3} />;
    case 'switch': return <Switch />;
    case 'password': return <Input.Password />;
    default: return <Input placeholder={f.placeholder} disabled={f.disabled} allowClear />;
  }
}

const CrudTable = forwardRef<CrudRef, Props>(function CrudTable(p, ref) {
  const [sp] = useSearchParams();
  const { storeId } = useApp();
  const [form] = Form.useForm(); const [editForm] = Form.useForm();
  const init: any = {}; sp.forEach((v, k) => { init[k] = v; });
  const [params, setParams] = useState<any>({ ...init });
  const [tab, setTab] = useState<string>(p.statusTabs ? (init[p.statusTabs.field] || '') : '');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(p.pageSize || 20);
  const [sorter, setSorter] = useState<any>({});
  const [data, setData] = useState<any>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [size, setSize] = useState<'small' | 'middle'>('small');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const buildParams = useCallback(() => {
    const q: any = { ...p.extraParams, ...params };
    for (const [k, v] of Object.entries(q)) {
      if (Array.isArray(v) && v.length === 2 && dayjs.isDayjs(v[0])) { q.dateFrom = v[0].format('YYYY-MM-DD'); q.dateTo = v[1].format('YYYY-MM-DD'); delete q[k]; }
    }
    if (p.statusTabs) { if (tab) q[p.statusTabs.field] = tab; else delete q[p.statusTabs.field]; }
    if (p.useStore !== false && storeId) q.storeId = storeId;
    return q;
  }, [params, tab, storeId, JSON.stringify(p.extraParams)]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = buildParams();
      const d = await api(`/r/${p.resource}`, { params: { ...q, page, pageSize, sortField: sorter.field, sortOrder: sorter.order } });
      setData(d);
      if (p.statusTabs) {
        const base = { ...q }; delete base[p.statusTabs.field];
        const res = await Promise.all(['', ...p.statusTabs.items].map(s => api(`/r/${p.resource}`, { params: { ...base, [p.statusTabs!.field]: s, pageSize: 1 }, silent: true }).then(r => [s, r.total] as const).catch(() => [s, 0] as const)));
        setCounts(Object.fromEntries(res));
      }
    } finally { setLoading(false); }
  }, [buildParams, page, pageSize, sorter, p.resource]);
  useEffect(() => { load(); }, [load]);

  const openEdit = (row?: any) => {
    if (row && p.onEdit) return p.onEdit(row, ctx);
    if (!row && p.onCreate) return p.onCreate(ctx);
    setEditing(row || null); editForm.resetFields();
    const v = row ? (p.toForm ? p.toForm(row) : row) : {};
    (p.formFields || []).forEach(f => { if (f.type === 'date' && v[f.name]) v[f.name] = dayjs(v[f.name]); if (f.type === 'switch') v[f.name] = !!v[f.name]; });
    editForm.setFieldsValue(v); setOpen(true);
  };
  const ctx: Ctx = { reload: load, selected, clearSelected: () => setSelected([]), openEdit, params: buildParams() };
  useImperativeHandle(ref, () => ctx);

  const submit = async () => {
    const v = await editForm.validateFields();
    (p.formFields || []).forEach(f => { if (f.type === 'date' && v[f.name]) v[f.name] = v[f.name].format('YYYY-MM-DD'); if (f.type === 'switch') v[f.name] = v[f.name] ? 1 : 0; });
    const body = p.fromForm ? p.fromForm(v, editing) : v;
    setSaving(true);
    try {
      if (editing) await put(`/r/${p.resource}/${editing.id}`, body); else await post(`/r/${p.resource}`, body);
      message.success(editing ? '保存成功' : '新增成功'); setOpen(false); load();
    } finally { setSaving(false); }
  };

  const exportCsv = () => {
    const cols = p.columns.filter((c: any) => c.dataIndex && c.title);
    const rows = [cols.map((c: any) => String(c.title)), ...data.list.map((r: any) => cols.map((c: any) => r[c.dataIndex] ?? ''))];
    const csv = '\ufeff' + rows.map(r => r.map((x: any) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${p.resource}_${dayjs().format('YYYYMMDDHHmm')}.csv`; a.click();
    message.success(`已导出当前页 ${data.list.length} 条`);
  };

  const columns: ColumnsType<any> = [...p.columns];
  if (p.rowActions || p.canEdit || p.canDelete) columns.push({
    title: '操作', key: '_op', fixed: 'right', width: p.actionWidth || 120, render: (_, r) => (
      <Space size={4} onClick={e => e.stopPropagation()}>
        {p.canEdit && <a onClick={() => openEdit(r)}>编辑</a>}
        {p.rowActions?.(r, ctx)}
        {p.canDelete && <Popconfirm title="确认删除该记录？" onConfirm={async () => { await del(`/r/${p.resource}/${r.id}`); message.success('已删除'); load(); }}><a style={{ color: '#cf1322' }}>删除</a></Popconfirm>}
      </Space>),
  });

  return (
    <div>
      {(p.filters?.length || p.searchPlaceholder) ? (
        <div className="filter-bar">
          <Form form={form} initialValues={init} onFinish={v => { setPage(1); setParams(v); }}>
            <Row gutter={12}>
              {p.searchPlaceholder && <Col span={6}><Form.Item name="q"><Input prefix={<SearchOutlined />} placeholder={p.searchPlaceholder} allowClear /></Form.Item></Col>}
              {p.filters?.map(f => <Col key={f.name} span={f.span || 4}><Form.Item name={f.name}>{f.type === 'dateRange' ? <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['开始日期', '结束日期']} /> : f.type === 'select' ? <Select allowClear showSearch optionFilterProp="label" options={f.options} placeholder={f.label} /> : <Input placeholder={f.label} allowClear />}</Form.Item></Col>)}
              <Col flex="auto" style={{ textAlign: 'right' }}><Space><Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button><Button icon={<UndoOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue(Object.fromEntries(Object.keys(form.getFieldsValue()).map(k => [k, undefined]))); setParams({}); setPage(1); }}>重置</Button></Space></Col>
            </Row>
          </Form>
        </div>) : null}
      <div className="table-wrap">
        {p.statusTabs && <Tabs className="status-tabs" size="small" activeKey={tab} onChange={k => { setTab(k); setPage(1); setSelected([]); }}
          items={['', ...p.statusTabs.items].map(s => ({ key: s, label: <span>{s || '全部'} <Badge count={counts[s] ?? 0} overflowCount={9999} showZero size="small" color={s === '异常' ? '#ff4d4f' : s === '待审核' ? '#fa8c16' : '#bfbfbf'} /></span> }))} />}
        <div className="toolbar">
          <Space wrap>
            {p.title}
            {p.canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>{p.createText || '新增'}</Button>}
            {p.toolbar?.(ctx)}
            {p.selectable && selected.length > 0 && <span style={{ color: '#888', fontSize: 12 }}>已选 {selected.length} 项 <a onClick={() => setSelected([])}>清空</a></span>}
          </Space>
          <Space size={4}>
            {p.summary?.(data)}
            <Tooltip title="导出当前页"><Button size="small" icon={<ExportOutlined />} onClick={exportCsv}>导出</Button></Tooltip>
            <Tooltip title="刷新"><Button size="small" icon={<ReloadOutlined />} onClick={load} /></Tooltip>
            <Dropdown menu={{ items: [{ key: 'small', label: '紧凑' }, { key: 'middle', label: '默认' }], onClick: e => setSize(e.key as any), selectedKeys: [size] }}><Button size="small" icon={<ColumnHeightOutlined />} /></Dropdown>
          </Space>
        </div>
        <Table rowKey="id" size={size} bordered loading={loading} columns={columns} dataSource={data.list} scroll={{ x: p.scrollX || 1200 }} sticky
          rowSelection={p.selectable ? { selectedRowKeys: selected.map(r => r.id), onChange: (_k, rows) => setSelected(rows), preserveSelectedRowKeys: true } : undefined}
          onRow={r => ({ onClick: () => p.onRowClick?.(r), style: p.onRowClick ? { cursor: 'pointer' } : undefined })}
          onChange={(pg, _f, s: any) => { setPage(pg.current || 1); setPageSize(pg.pageSize || 20); setSorter(s.order ? { field: s.field, order: s.order } : {}); }}
          pagination={{ current: page, pageSize, total: data.total, showSizeChanger: true, showQuickJumper: true, pageSizeOptions: [10, 20, 50, 100], showTotal: t => `共 ${t} 条`, size: 'small' }} />
      </div>
      {p.formFields && <Modal title={(editing ? '编辑' : '新增') + (p.formTitle || '')} open={open} onCancel={() => setOpen(false)} onOk={submit} confirmLoading={saving} width={p.formWidth || 720} destroyOnClose maskClosable={false}>
        <Form form={editForm} layout="vertical" size="middle" preserve={false}>
          <Row gutter={16}>{p.formFields.map(f => <Col key={f.name} span={f.span || 12}><Form.Item name={f.name} label={f.label} rules={f.required ? [{ required: true, message: `请输入${f.label}` }] : undefined} valuePropName={f.type === 'switch' ? 'checked' : 'value'}><FieldInput f={f} /></Form.Item></Col>)}</Row>
        </Form>
      </Modal>}
    </div>
  );
});
export default CrudTable;
