import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { adminService } from './adminService';
import type { AdminData, AdminService, DemoState } from './adminTypes';
interface AdminContextValue { data: AdminData | null; loading: boolean; error: string; refresh: () => Promise<void>; service: AdminService; demoState: (state: DemoState) => void }
const AdminContext = createContext<AdminContextValue | null>(null);
export function AdminProvider({ children, service = adminService }: { children: ReactNode; service?: AdminService }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current; setLoading(true); setError('');
    try { const result = await service.load(); if (version === request.current) setData(result); }
    catch (failure) { if (version === request.current) { setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu.'); setData(null); } }
    finally { if (version === request.current) setLoading(false); }
  }, [service]);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
  return <AdminContext.Provider value={{ data, loading, error, refresh, service, demoState: state => { service.setDemoState?.(state); void refresh(); } }}>{children}</AdminContext.Provider>;
}
export function useAdmin() { const value = useContext(AdminContext); if (!value) throw new Error('AdminProvider is required'); return value; }
export function useOptionalAdmin() { return useContext(AdminContext); }
