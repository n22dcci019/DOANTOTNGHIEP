import type { ReactNode } from 'react';
import { StatePanel } from '../../components/admin/AdminUI';
import { useDriver } from '../../services/DriverContext';
import type { DriverData } from '../../services/driverTypes';
import './driver.css';
export function DriverGate({ children }: { children: (data: DriverData) => ReactNode }) { const { data, loading, error, refresh } = useDriver(); if (error) return <StatePanel type="error" message={error} retry={() => void refresh()} />; if (!data) return <StatePanel type={loading ? 'loading' : 'empty'} />; return <div className="driver-scope" aria-busy={loading}>{children(data)}</div>; }
