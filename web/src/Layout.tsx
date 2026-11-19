import { useEffect, useMemo, useState } from 'react';
import { Layout, Menu, Breadcrumb, Select, Input, Badge, Dropdown, Avatar, Tabs, Space, Popover, List, Tooltip, Button, theme } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, SearchOutlined, UserOutlined, LogoutOutlined, ReloadOutlined, QuestionCircleOutlined, ShopOutlined, FullscreenOutlined, HomeOutlined, LockOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MENU, findMenu } from './menu';
import { useApp } from './ctx';
import { api, post } from './api';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation(); const nav = useNavigate();
  const { user, setUser, storeId, setStoreId, opts } = useApp();
  const [tabs, setTabs] = useState<{ key: string; label: string }[]>(() => { try { return JSON.parse(sessionStorage.getItem('erp_tabs') || '[]'); } catch { return []; } });
  const [todo, setTodo] = useState<any>({});
  const [reloadKey, setReloadKey] = useState(0);
  const { token } = theme.useToken();
  const path = loc.pathname;
  const { node, parent } = findMenu(path);

  useEffect(() => {
    if (!node) return;
    setTabs(t => {
      const base = t.some(x => x.key === '/dashboard') ? t : [{ key: '/dashboard', label: '仪表盘' }, ...t];
      const n = base.some(x => x.key === path) ? base : [...base, { key: path, label: node.label }];
      sessionStorage.setItem('erp_tabs', JSON.stringify(n)); return n;
    });
  }, [path]);
  useEffect(() => { api('/dashboard', { params: { days: 1 }, silent: true }).then(d => setTodo(d.todo)).catch(() => {}); }, [path]);

  const perms: string[] = user?.permissions || [];
  const items = useMemo(() => MENU.filter(m => !m.perm || perms.includes(m.perm)).map(m => ({ key: m.key, icon: m.icon, label: m.label, children: m.children?.map(c => ({ key: c.key, label: c.label })) })), [perms.join()]);
  const [openKeys, setOpenKeys] = useState<string[]>(parent ? [parent.key] : []);
  useEffect(() => { if (parent && !collapsed) setOpenKeys(k => k.includes(parent.key) ? k : [...k, parent.key]); }, [parent?.key]);

  const closeTab = (key: string) => {
    const idx = tabs.findIndex(t => t.key === key); const n = tabs.filter(t => t.key !== key);
    setTabs(n); sessionStorage.setItem('erp_tabs', JSON.stringify(n));
    if (key === path) nav(n[Math.max(0, idx - 1)]?.key || '/dashboard');
  };
  const notices = [
    { t: `待审核订单 ${todo.pendingReview ?? 0} 个`, to: '/order/list?status=待审核', c: todo.pendingReview },
    { t: `异常订单 ${todo.abnormal ?? 0} 个`, to: '/order/list?status=异常', c: todo.abnormal },
    { t: `待处理售后 ${todo.afterSales ?? 0} 个`, to: '/order/after-sales', c: todo.afterSales },
    { t: `待审核采购单 ${todo.poPending ?? 0} 个`, to: '/purchase/orders', c: todo.poPending },
    { t: `未配对 MSKU ${todo.unpaired ?? 0} 个`, to: '/product/msku?paired=0', c: todo.unpaired },
    { t: `店铺授权异常 ${todo.authExpired ?? 0} 个`, to: '/system/stores', c: todo.authExpired },
  ].filter(n => n.c);
  const noticeCount = notices.reduce((a, n) => a + (n.c || 0), 0);
  const [kw, setKw] = useState('');
  const doSearch = () => { if (kw.trim()) nav('/order/list?q=' + encodeURIComponent(kw.trim())); };

  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Sider collapsible collapsed={collapsed} trigger={null} width={216} collapsedWidth={56} theme="dark" style={{ background: '#001a33', overflow: 'auto' }}>
        <div className="logo" onClick={() => nav('/dashboard')}>
          <div className="logo-mark">E</div>{!collapsed && <div><div className="logo-title">VivaHome ERP</div><div className="logo-sub">跨境电商管理系统</div></div>}
        </div>
        <Menu theme="dark" mode="inline" items={items} selectedKeys={[path]} openKeys={collapsed ? undefined : openKeys} onOpenChange={k => setOpenKeys(k as string[])} onClick={e => nav(e.key)} style={{ background: 'transparent', borderInlineEnd: 0, fontSize: 13 }} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="topbar">
          <Space size={12} align="center">
            <span className="icon-btn" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}</span>
            <Breadcrumb items={[{ title: <HomeOutlined /> }, ...(parent ? [{ title: parent.label }] : []), { title: node?.label || '' }]} />
          </Space>
          <Space size={14} align="center">
            <Select value={storeId ?? 0} onChange={v => setStoreId(v || undefined)} style={{ width: 250 }} size="small" suffixIcon={<ShopOutlined />} popupMatchSelectWidth={300} showSearch optionFilterProp="label"
              options={[{ label: '全部店铺 / 全部站点', value: 0 }, ...opts.stores.map(s => ({ label: `${s.name} · ${s.platform} · ${s.site}`, value: s.id }))]} />
            <Input size="small" prefix={<SearchOutlined style={{ color: '#999' }} />} placeholder="搜索订单号/买家/跟踪号" style={{ width: 220 }} value={kw} onChange={e => setKw(e.target.value)} onPressEnter={doSearch} allowClear />
            <Tooltip title="刷新页面"><span className="icon-btn" onClick={() => setReloadKey(k => k + 1)}><ReloadOutlined /></span></Tooltip>
            <Tooltip title="全屏"><span className="icon-btn" onClick={() => document.documentElement.requestFullscreen?.()}><FullscreenOutlined /></span></Tooltip>
            <Tooltip title="帮助文档"><span className="icon-btn"><QuestionCircleOutlined /></span></Tooltip>
            <Popover placement="bottomRight" trigger="click" title="待办提醒" content={<List size="small" style={{ width: 260 }} dataSource={notices} locale={{ emptyText: '暂无待办' }} renderItem={n => <List.Item style={{ cursor: 'pointer' }} onClick={() => nav(n.to)}><Badge status="processing" text={n.t} /></List.Item>} />}>
              <Badge count={noticeCount} size="small" overflowCount={99}><span className="icon-btn"><BellOutlined /></span></Badge>
            </Popover>
            <Dropdown menu={{ items: [{ key: 'u', label: `${user?.name}（${user?.role_name}）`, disabled: true }, { type: 'divider' }, { key: 'pwd', icon: <LockOutlined />, label: '个人中心' }, { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }], onClick: async e => { if (e.key === 'logout') { await post('/logout').catch(() => {}); localStorage.removeItem('erp_token'); localStorage.removeItem('erp_user'); setUser(null); nav('/login'); } } }}>
              <Space size={6} style={{ cursor: 'pointer' }}><Avatar size={26} style={{ background: token.colorPrimary }} icon={<UserOutlined />} /><span style={{ fontSize: 13 }}>{user?.name}</span></Space>
            </Dropdown>
          </Space>
        </Layout.Header>
        <div className="tabbar">
          <Tabs size="small" type="editable-card" hideAdd activeKey={path} onChange={k => nav(k)} onEdit={(k, a) => a === 'remove' && closeTab(k as string)}
            items={tabs.map(t => ({ key: t.key, label: t.label, closable: t.key !== '/dashboard' }))}
            tabBarExtraContent={<Dropdown menu={{ items: [{ key: 'others', label: '关闭其他' }, { key: 'all', label: '关闭全部' }], onClick: e => { const n = e.key === 'all' ? [{ key: '/dashboard', label: '仪表盘' }] : tabs.filter(t => t.key === '/dashboard' || t.key === path); setTabs(n); sessionStorage.setItem('erp_tabs', JSON.stringify(n)); if (e.key === 'all') nav('/dashboard'); } }}><Button size="small" type="text">标签操作 ▾</Button></Dropdown>} />
        </div>
        <Layout.Content className="content" key={reloadKey + path}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
