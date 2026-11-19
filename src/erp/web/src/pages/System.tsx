import { useRef, useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, message, Popconfirm, Tag, Button, Alert, Space } from 'antd';
import { ApiOutlined, KeyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import CrudTable, { CrudRef } from '../components/CrudTable';
import { post, put } from '../api';
import { useOptions } from '../ctx';
import { StatusTag, PlatformTag, opt, PLATFORMS, SITES } from '../utils';
import { MENU } from '../menu';

export function StoresPage() {
  const ref = useRef<CrudRef>(null); const [auth, setAuth] = useState<any>(null); const [step, setStep] = useState(0);
  return <>
    <CrudTable ref={ref} resource="stores" useStore={false} searchPlaceholder="店铺名称 / Seller ID" canCreate canEdit formTitle="店铺" createText="添加店铺"
      statusTabs={{ field: 'auth_status', items: ['已授权', '授权过期', '未授权'] }}
      filters={[{ name: 'platform', label: '平台', type: 'select', options: opt(PLATFORMS) }, { name: 'site', label: '站点', type: 'select', options: opt(SITES) }]}
      formFields={[{ name: 'name', label: '店铺名称', required: true }, { name: 'platform', label: '平台', type: 'select', options: opt(PLATFORMS), required: true }, { name: 'site', label: '站点', type: 'select', options: opt(SITES), required: true }, { name: 'currency', label: '币种', type: 'select', options: opt(['USD', 'GBP', 'EUR', 'JPY', 'CAD']), required: true }, { name: 'seller_id', label: 'Seller ID / 店铺ID' }, { name: 'status', label: '状态', type: 'select', options: opt(['启用', '停用']) }]}
      fromForm={(v, row) => row ? v : { ...v, auth_status: '未授权', status: v.status || '启用' }}
      rowActions={r => <a onClick={() => { setAuth(r); setStep(0); }}>{r.auth_status === '已授权' ? '重新授权' : '授权'}</a>} actionWidth={120}
      columns={[{ title: '店铺名称', dataIndex: 'name', width: 170 }, { title: '平台', dataIndex: 'platform', width: 110, render: v => <PlatformTag v={v} /> }, { title: '站点', dataIndex: 'site', width: 70 }, { title: '币种', dataIndex: 'currency', width: 60 }, { title: 'Seller ID', dataIndex: 'seller_id', width: 160, render: v => <span className="mono">{v}</span> }, { title: '授权状态', dataIndex: 'auth_status', width: 90, render: v => <StatusTag v={v} /> }, { title: '授权到期', dataIndex: 'auth_expire', width: 110, render: v => v ? <span style={{ color: dayjs(v).diff(dayjs(), 'day') < 30 ? '#cf1322' : undefined }}>{v}</span> : '-' }, { title: '在线Listing', dataIndex: 'listing_count', width: 90, align: 'right' }, { title: '订单数', dataIndex: 'order_count', width: 80, align: 'right' }, { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> }]} scrollX={1300} />
    <Modal title={<Space><ApiOutlined />店铺授权 · {auth?.name}</Space>} open={!!auth} onCancel={() => setAuth(null)} okText={step === 0 ? '前往授权' : '完成授权'}
      onOk={async () => { if (step === 0) { setStep(1); return; } await post(`/stores/${auth.id}/authorize`); message.success('授权成功，已开始同步订单、Listing、库存与广告数据'); setAuth(null); ref.current?.reload(); }}>
      {step === 0 ? <><Alert type="info" showIcon message={`将跳转至 ${auth?.platform} 卖家后台进行 OAuth 授权（演示环境为模拟授权，不会访问外部平台）`} style={{ marginBottom: 12 }} />
        <p>授权范围：订单读取、Listing 管理、库存与 FBA 货件、广告报表、结算报告。</p><p>授权有效期：365 天，到期前 30 天提醒续期。</p></> :
        <Alert type="success" showIcon message="已在平台侧完成授权（模拟），点击「完成授权」保存授权令牌。" />}
    </Modal>
  </>;
}

export function UsersPage() {
  const o = useOptions(); const ref = useRef<CrudRef>(null); const [open, setOpen] = useState(false); const [form] = Form.useForm();
  return <>
    <CrudTable ref={ref} resource="users" useStore={false} searchPlaceholder="用户名 / 姓名" canEdit canDelete formTitle="用户"
      toolbar={() => <Button type="primary" onClick={() => { form.resetFields(); form.setFieldsValue({ status: '启用', password: '123456' }); setOpen(true); }}>新增用户</Button>}
      filters={[{ name: 'role_id', label: '角色', type: 'select', options: o.roleOpts }, { name: 'status', label: '状态', type: 'select', options: opt(['启用', '停用']) }]}
      formFields={[{ name: 'username', label: '用户名', disabled: true }, { name: 'name', label: '姓名', required: true }, { name: 'email', label: '邮箱' }, { name: 'phone', label: '手机' }, { name: 'role_id', label: '角色', type: 'select', options: o.roleOpts, required: true }, { name: 'status', label: '状态', type: 'select', options: opt(['启用', '停用']) }]}
      fromForm={v => { const { username, ...rest } = v; return rest; }}
      rowActions={r => <Popconfirm title={`将 ${r.username} 的密码重置为 123456？`} onConfirm={async () => { await post(`/users/${r.id}/reset-password`, { password: '123456' }); message.success('密码已重置为 123456'); }}><a><KeyOutlined /> 重置密码</a></Popconfirm>} actionWidth={200}
      columns={[{ title: '用户名', dataIndex: 'username', width: 110, render: v => <b>{v}</b> }, { title: '姓名', dataIndex: 'name', width: 90 }, { title: '角色', dataIndex: 'role_name', width: 110, render: v => <Tag color="blue">{v}</Tag> }, { title: '邮箱', dataIndex: 'email', width: 200 }, { title: '手机', dataIndex: 'phone', width: 130 }, { title: '状态', dataIndex: 'status', width: 70, render: v => <StatusTag v={v} /> }, { title: '最近登录', dataIndex: 'last_login', width: 150, render: v => v || '-' }, { title: '创建时间', dataIndex: 'created_at', width: 150 }]} scrollX={1300} />
    <Modal title="新增用户" open={open} onCancel={() => setOpen(false)} onOk={async () => { const v = await form.validateFields(); await post('/users', v); message.success('用户已创建'); setOpen(false); ref.current?.reload(); }}>
      <Form form={form} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: true }, { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '3-20位字母数字下划线' }]}><Input /></Form.Item>
        <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="role_id" label="角色" rules={[{ required: true }]}><Select options={o.roleOpts} /></Form.Item>
        <Form.Item name="email" label="邮箱"><Input /></Form.Item><Form.Item name="phone" label="手机"><Input /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={opt(['启用', '停用'])} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

const PERMS = MENU.map(m => ({ label: m.label, value: m.perm! }));
export function RolesPage() {
  const ref = useRef<CrudRef>(null); const [edit, setEdit] = useState<any>(null); const [perms, setPerms] = useState<string[]>([]);
  const parse = (s: string) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
  return <>
    <CrudTable ref={ref} resource="roles" useStore={false} searchPlaceholder="角色名称" canCreate canEdit canDelete formTitle="角色" createText="新增角色"
      formFields={[{ name: 'name', label: '角色名称', required: true }, { name: 'code', label: '角色编码', required: true }, { name: 'remark', label: '说明', span: 24 }]}
      fromForm={(v, row) => row ? v : { ...v, permissions: '["dashboard"]' }}
      rowActions={r => <a onClick={() => { setEdit(r); setPerms(parse(r.permissions)); }}>功能权限</a>} actionWidth={170}
      columns={[{ title: '角色名称', dataIndex: 'name', width: 130, render: v => <b>{v}</b> }, { title: '编码', dataIndex: 'code', width: 110, render: v => <span className="mono">{v}</span> }, { title: '菜单权限', dataIndex: 'permissions', render: v => { const p = parse(v); return p.length === PERMS.length ? <Tag color="gold">全部权限</Tag> : p.map((k: string) => <Tag key={k}>{PERMS.find(x => x.value === k)?.label || k}</Tag>); } }, { title: '用户数', dataIndex: 'user_count', width: 80, align: 'right' }, { title: '说明', dataIndex: 'remark', width: 220, ellipsis: true }]} />
    <Modal title={`功能权限 · ${edit?.name}`} open={!!edit} onCancel={() => setEdit(null)} onOk={async () => { await put(`/r/roles/${edit.id}`, { permissions: JSON.stringify(perms) }); message.success('权限已保存，用户重新登录后生效'); setEdit(null); ref.current?.reload(); }}>
      <div style={{ marginBottom: 8 }}><Checkbox checked={perms.length === PERMS.length} indeterminate={perms.length > 0 && perms.length < PERMS.length} onChange={e => setPerms(e.target.checked ? PERMS.map(p => p.value) : [])}>全选</Checkbox></div>
      <Checkbox.Group value={perms} onChange={v => setPerms(v as string[])} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }} options={PERMS} />
    </Modal>
  </>;
}

export function LogsPage() {
  return <CrudTable resource="operation_logs" useStore={false} searchPlaceholder="操作人 / 操作 / 详情"
    filters={[{ name: 'module', label: '模块', type: 'select', options: opt(['商品管理', '订单管理', '采购管理', '仓储库存', 'FBA与头程', '物流管理', '财务管理', '广告概览', '系统设置', '系统']) }, { name: 'date', label: '日期', type: 'dateRange', span: 6 }]}
    columns={[{ title: '时间', dataIndex: 'created_at', width: 160 }, { title: '操作人', dataIndex: 'user', width: 100 }, { title: '模块', dataIndex: 'module', width: 110, render: v => <Tag>{v}</Tag> }, { title: '操作', dataIndex: 'action', width: 140 }, { title: '详情', dataIndex: 'detail', ellipsis: true }, { title: 'IP', dataIndex: 'ip', width: 120, render: v => <span className="mono">{v}</span> }]} />;
}
