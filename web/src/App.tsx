import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useApp } from './ctx';
import MainLayout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { SkuPage, SpuPage, MskuPage } from './pages/Product';
import OrderPage, { AfterSalesPage, ReviewRulesPage } from './pages/Order';
import { PlanPage, PoPage, ReceiptsPage, SuppliersPage } from './pages/Purchase';
import { StockPage, MovesPage, StocktakePage, LedgerPage, WarehousesPage } from './pages/Inventory';
import { FbaPage, ProvidersPage } from './pages/Fba';
import { ChannelsPage, RulesPage, TrackingPage } from './pages/Logistics';
import { ProfitPage, OrderProfitPage, SettlementsPage, RatesPage } from './pages/Finance';
import { AdsOverview, CampaignsPage } from './pages/Ads';
import { StoresPage, UsersPage, RolesPage, LogsPage } from './pages/System';

function Guard({ perm, children }: { perm: string; children: JSX.Element }) {
  const { user } = useApp();
  if (user && !(user.permissions || []).includes(perm)) return <Result status="403" title="无访问权限" subTitle="当前角色未开通该模块，请联系管理员在「角色权限」中授权" extra={<Button type="primary" href="/dashboard">返回首页</Button>} />;
  return children;
}
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user } = useApp(); const loc = useLocation();
  if (!user || !localStorage.getItem('erp_token')) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}
const R: [string, string, JSX.Element][] = [
  ['/dashboard', 'dashboard', <Dashboard />],
  ['/product/sku', 'product', <SkuPage />], ['/product/spu', 'product', <SpuPage />], ['/product/msku', 'product', <MskuPage />], ['/product/combo', 'product', <SkuPage combo />],
  ['/order/list', 'order', <OrderPage />], ['/order/after-sales', 'order', <AfterSalesPage />], ['/order/rules', 'order', <ReviewRulesPage />],
  ['/purchase/plan', 'purchase', <PlanPage />], ['/purchase/orders', 'purchase', <PoPage />], ['/purchase/receipts', 'purchase', <ReceiptsPage />], ['/purchase/suppliers', 'purchase', <SuppliersPage />],
  ['/inventory/stock', 'inventory', <StockPage />], ['/inventory/moves', 'inventory', <MovesPage />], ['/inventory/stocktake', 'inventory', <StocktakePage />], ['/inventory/ledger', 'inventory', <LedgerPage />], ['/inventory/warehouses', 'inventory', <WarehousesPage />],
  ['/fba/shipments', 'fba', <FbaPage />], ['/fba/providers', 'fba', <ProvidersPage type="头程" />],
  ['/logistics/channels', 'logistics', <ChannelsPage />], ['/logistics/rules', 'logistics', <RulesPage />], ['/logistics/tracking', 'logistics', <TrackingPage />], ['/logistics/providers', 'logistics', <ProvidersPage type="尾程/小包,尾程/快递" />],
  ['/finance/profit', 'finance', <ProfitPage />], ['/finance/order-profit', 'finance', <OrderProfitPage />], ['/finance/settlements', 'finance', <SettlementsPage />], ['/finance/rates', 'finance', <RatesPage />],
  ['/ads/overview', 'ads', <AdsOverview />], ['/ads/campaigns', 'ads', <CampaignsPage />],
  ['/system/stores', 'system', <StoresPage />], ['/system/users', 'system', <UsersPage />], ['/system/roles', 'system', <RolesPage />], ['/system/logs', 'system', <LogsPage />],
];
export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
      {R.map(([p, perm, el]) => <Route key={p} path={p} element={<Guard perm={perm}>{el}</Guard>} />)}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Result status="404" title="页面不存在" extra={<Button type="primary" href="/dashboard">返回首页</Button>} />} />
    </Route>
  </Routes>;
}
