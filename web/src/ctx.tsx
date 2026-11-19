import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from './api';
type Opts = { stores: any[]; warehouses: any[]; suppliers: any[]; skus: any[]; products: any[]; channels: any[]; providers: any[]; roles: any[]; currencies: any[]; categories: string[] };
type Ctx = { user: any; setUser: (u: any) => void; storeId?: number; setStoreId: (v?: number) => void; opts: Opts; reloadOpts: () => void };
const C = createContext<Ctx>(null as any);
const empty: Opts = { stores: [], warehouses: [], suppliers: [], skus: [], products: [], channels: [], providers: [], roles: [], currencies: [], categories: [] };
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(() => { try { return JSON.parse(localStorage.getItem('erp_user') || 'null'); } catch { return null; } });
  const [storeId, setStoreIdS] = useState<number | undefined>(() => Number(localStorage.getItem('erp_store')) || undefined);
  const [opts, setOpts] = useState<Opts>(empty);
  const reloadOpts = useCallback(() => { if (localStorage.getItem('erp_token')) api('/options', { silent: true }).then(setOpts).catch(() => {}); }, []);
  useEffect(() => { if (user) reloadOpts(); }, [user, reloadOpts]);
  useEffect(() => { const h = () => reloadOpts(); window.addEventListener('erp:opts-changed', h); return () => window.removeEventListener('erp:opts-changed', h); }, [reloadOpts]);
  const setStoreId = (v?: number) => { setStoreIdS(v); v ? localStorage.setItem('erp_store', String(v)) : localStorage.removeItem('erp_store'); };
  return <C.Provider value={{ user, setUser, storeId, setStoreId, opts, reloadOpts }}>{children}</C.Provider>;
}
export const useApp = () => useContext(C);
export const useOptions = () => {
  const { opts } = useApp();
  return {
    ...opts,
    storeOpts: opts.stores.map(s => ({ label: `${s.name}（${s.platform}·${s.site}）`, value: s.id })),
    whOpts: opts.warehouses.map(w => ({ label: `${w.name}`, value: w.id })),
    supOpts: opts.suppliers.map(s => ({ label: s.name, value: s.id })),
    skuOpts: opts.skus.map(s => ({ label: `${s.sku}  ${s.name}`, value: s.id })),
    productOpts: opts.products.map(p => ({ label: `${p.spu} ${p.name}`, value: p.id })),
    channelOpts: opts.channels.map(c => ({ label: c.name, value: c.id })),
    providerOpts: opts.providers.map(c => ({ label: c.name, value: c.id })),
    roleOpts: opts.roles.map(c => ({ label: c.name, value: c.id })),
    curOpts: opts.currencies.map(c => ({ label: `${c.currency} ${c.name}`, value: c.currency })),
    catOpts: opts.categories.map(c => ({ label: c, value: c })),
  };
};
