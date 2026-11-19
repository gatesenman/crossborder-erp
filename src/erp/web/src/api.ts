import { message } from 'antd';
export const getToken = () => localStorage.getItem('erp_token') || '';
export async function api<T = any>(url: string, opts: { method?: string; body?: any; params?: Record<string, any>; silent?: boolean } = {}): Promise<T> {
  let u = '/api' + url;
  if (opts.params) {
    const sp = new URLSearchParams();
    Object.entries(opts.params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') sp.set(k, Array.isArray(v) ? v.join(',') : String(v)); });
    const s = sp.toString(); if (s) u += (u.includes('?') ? '&' : '?') + s;
  }
  const res = await fetch(u, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401 && !url.startsWith('/login')) { localStorage.removeItem('erp_token'); window.location.href = '/login'; throw new Error('未登录'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (!opts.silent) message.error(data.message || '请求失败'); throw new Error(data.message || '请求失败'); }
  // 主数据变更后通知全局刷新下拉选项（店铺/仓库/SKU/供应商等）
  if (opts.method && opts.method !== 'GET' && /^\/r\/(skus|stores|warehouses|suppliers|products|logistics_channels|logistics_providers|roles|exchange_rates)\b/.test(url)) window.dispatchEvent(new Event('erp:opts-changed'));
  return data as T;
}
export const post = (url: string, body?: any) => api(url, { method: 'POST', body });
export const put = (url: string, body?: any) => api(url, { method: 'PUT', body });
export const del = (url: string) => api(url, { method: 'DELETE' });
