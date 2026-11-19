import { Tag, Badge } from 'antd';
export const CUR_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: 'JP¥', CAD: 'C$', AUD: 'A$', MXN: 'MX$' };
export const money = (v: any, cur = 'CNY', digits = 2) => v === null || v === undefined || v === '' ? '-' : (CUR_SYMBOL[cur] ?? '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: cur === 'JPY' ? 0 : digits, maximumFractionDigits: cur === 'JPY' ? 0 : digits });
export const num = (v: any) => v === null || v === undefined ? '-' : Number(v).toLocaleString('en-US');
export const pct = (v: any, d = 1) => v === null || v === undefined ? '-' : (Number(v) * 100).toFixed(d) + '%';
export const profitText = (v: number, cur = 'CNY') => <span style={{ color: v < 0 ? '#cf1322' : '#389e0d', fontWeight: 500 }}>{money(v, cur)}</span>;

const COLORS: Record<string, string> = {
  待审核: 'orange', 待发货: 'blue', 已发货: 'cyan', 已完成: 'green', 已取消: 'default', 异常: 'red',
  草稿: 'default', 已下单: 'blue', 部分到货: 'gold', 已付款: 'green', 未付款: 'default', 已付定金: 'gold',
  计划中: 'default', 已装箱: 'purple', 运输中: 'geekblue', 已签收: 'cyan', 已上架: 'green',
  在售: 'green', 停售: 'default', 启用: 'green', 停用: 'default', 已授权: 'green', 授权过期: 'red', 未授权: 'orange',
  待处理: 'orange', 处理中: 'blue', 已拒绝: 'default', 在途: 'geekblue', 待确认: 'orange', 已确认: 'green',
  投放中: 'green', 已暂停: 'default', 已到账: 'green', 结算中: 'blue', 紧急: 'red', 建议补货: 'orange', 充足: 'green',
  合作中: 'green', FBA: 'orange', FBM: 'blue', 本地仓: 'blue', 海外仓: 'purple', FBA仓: 'orange',
};
export const StatusTag = ({ v }: { v: any }) => v == null || v === '' ? <span>-</span> : <Tag color={COLORS[v] || 'default'} style={{ marginInlineEnd: 0 }}>{v}</Tag>;
export const Dot = ({ v }: { v: string }) => <Badge status={(({ 已完成: 'success', 已发货: 'processing', 待审核: 'warning', 异常: 'error', 已取消: 'default', 待发货: 'processing' } as any)[v]) || 'default'} text={v} />;
const PCOLOR: Record<string, string> = { Amazon: '#ff9900', Shopify: '#5e8e3e', 'TikTok Shop': '#111', Temu: '#fb7701', eBay: '#0064d2', Walmart: '#0071dc' };
export const PlatformTag = ({ v }: { v: string }) => v ? <Tag color={PCOLOR[v]} style={{ marginInlineEnd: 0 }}>{v}</Tag> : null;
export const PLATFORMS = ['Amazon', 'Shopify', 'TikTok Shop', 'Temu', 'eBay', 'Walmart'];
export const SITES = ['美国', '英国', '德国', '日本', '法国', '意大利', '加拿大'];
export const opt = (arr: string[]) => arr.map(v => ({ label: v, value: v }));
