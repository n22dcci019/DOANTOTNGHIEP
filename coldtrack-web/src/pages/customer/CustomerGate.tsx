import type { ReactNode } from 'react';
import { useCustomer } from '../../services/CustomerContext';
import type { CustomerData } from '../../services/customerTypes';
import { StatePanel } from '../../components/admin/AdminUI';
export function CustomerGate({ children }: { children: (data: CustomerData) => ReactNode }) { const { data, loading, error, refresh } = useCustomer(); if (error) return <StatePanel type="error" message={error} retry={() => void refresh()} />; if (!data) return <StatePanel type={loading ? 'loading' : 'empty'} />; return <div aria-busy={loading}>{children(data)}</div>; }
