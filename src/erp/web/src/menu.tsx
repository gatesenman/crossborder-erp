import { DashboardOutlined, AppstoreOutlined, ProfileOutlined, ShoppingCartOutlined, DatabaseOutlined, RocketOutlined, CarOutlined, AccountBookOutlined, FundOutlined, SettingOutlined } from '@ant-design/icons';
export type MenuNode = { key: string; label: string; icon?: any; children?: MenuNode[]; perm?: string };
export const MENU: MenuNode[] = [
  { key: '/dashboard', label: '仪表盘', icon: <DashboardOutlined />, perm: 'dashboard' },
  { key: 'product', label: '商品管理', icon: <AppstoreOutlined />, perm: 'product', children: [
    { key: '/product/sku', label: 'SKU 管理' }, { key: '/product/spu', label: 'SPU 商品' }, { key: '/product/msku', label: 'MSKU 配对' }, { key: '/product/combo', label: '组合 SKU' }] },
  { key: 'order', label: '订单管理', icon: <ProfileOutlined />, perm: 'order', children: [
    { key: '/order/list', label: '订单处理' }, { key: '/order/after-sales', label: '售后管理' }, { key: '/order/rules', label: '审单规则' }] },
  { key: 'purchase', label: '采购管理', icon: <ShoppingCartOutlined />, perm: 'purchase', children: [
    { key: '/purchase/plan', label: '采购计划' }, { key: '/purchase/orders', label: '采购单' }, { key: '/purchase/receipts', label: '收货记录' }, { key: '/purchase/suppliers', label: '供应商' }] },
  { key: 'inventory', label: '仓储库存', icon: <DatabaseOutlined />, perm: 'inventory', children: [
    { key: '/inventory/stock', label: '库存查询' }, { key: '/inventory/moves', label: '出入库 / 调拨' }, { key: '/inventory/stocktake', label: '库存盘点' }, { key: '/inventory/ledger', label: '库存流水' }, { key: '/inventory/warehouses', label: '仓库管理' }] },
  { key: 'fba', label: 'FBA与头程', icon: <RocketOutlined />, perm: 'fba', children: [
    { key: '/fba/shipments', label: 'FBA 货件' }, { key: '/fba/providers', label: '头程物流商' }] },
  { key: 'logistics', label: '物流管理', icon: <CarOutlined />, perm: 'logistics', children: [
    { key: '/logistics/channels', label: '物流渠道' }, { key: '/logistics/rules', label: '物流规则' }, { key: '/logistics/tracking', label: '物流跟踪' }, { key: '/logistics/providers', label: '物流商' }] },
  { key: 'finance', label: '财务管理', icon: <AccountBookOutlined />, perm: 'finance', children: [
    { key: '/finance/profit', label: '利润报表' }, { key: '/finance/order-profit', label: '订单利润' }, { key: '/finance/settlements', label: '平台结算' }, { key: '/finance/rates', label: '汇率管理' }] },
  { key: 'ads', label: '广告概览', icon: <FundOutlined />, perm: 'ads', children: [{ key: '/ads/overview', label: '广告看板' }, { key: '/ads/campaigns', label: '广告活动' }] },
  { key: 'system', label: '系统设置', icon: <SettingOutlined />, perm: 'system', children: [
    { key: '/system/stores', label: '店铺授权' }, { key: '/system/users', label: '用户管理' }, { key: '/system/roles', label: '角色权限' }, { key: '/system/logs', label: '操作日志' }] },
];
export const findMenu = (path: string): { node?: MenuNode; parent?: MenuNode } => {
  for (const m of MENU) {
    if (m.key === path) return { node: m };
    for (const c of m.children || []) if (c.key === path) return { node: c, parent: m };
  }
  return {};
};
