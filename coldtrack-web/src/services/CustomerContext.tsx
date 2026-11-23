import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createCustomerService } from './customerService';
import type { CustomerData, CustomerService } from './customerTypes';
import type { DemoState } from './adminTypes';
interface Value { data: CustomerData | null; loading: boolean; error: string; service: CustomerService; refresh: () => Promise<void>; demoState: (state: DemoState) => void }
const CustomerContext = createContext<Value | null>(null);
export function CustomerProvider({ children, service: supplied }: { children: ReactNode; service?: CustomerService }) {
  const { currentUser } = useAuth();
  const service = useMemo(() => supplied ?? createCustomerService(currentUser), [supplied, currentUser.id]);
  const [data, setData] = useState<CustomerData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const request = useRef(0);
  const refresh = useCallback(async () => { const id = ++request.current; setLoading(true); setError(''); try { const result = await service.load(); if (id === request.current) setData(result); } catch (failure) { if (id === request.current) { setError(failure instanceof Error ? failure.message : 'Không thể tải dữ liệu.'); setData(null); } } finally { if (id === request.current) setLoading(false); } }, [service]);
  useEffect(() => { setData(null); void refresh(); return () => { request.current++; }; }, [refresh]);
  return <CustomerContext.Provider value={{ data, loading, error, service, refresh, demoState: state => { service.setDemoState?.(state); void refresh(); } }}>{children}</CustomerContext.Provider>;
}
export function useCustomer() { const context = useContext(CustomerContext); if (!context) throw new Error('CustomerProvider is required'); return context; }
export function useOptionalCustomer() { return useContext(CustomerContext); }
