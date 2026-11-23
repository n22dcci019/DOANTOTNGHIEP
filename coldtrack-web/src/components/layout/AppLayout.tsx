import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar';
import { Header } from '../common/Header';
import { useOptionalAdmin } from '../../services/AdminContext';
import { useOptionalCustomer } from '../../services/CustomerContext';
import { useOptionalDriver } from '../../services/DriverContext';
import '../admin/admin.css';
export function AppLayout({ title, subtitle }: { title?: string; subtitle?: string }) {
  const [open, setOpen] = useState(false); const admin = useOptionalAdmin(); const customer = useOptionalCustomer(); const driver = useOptionalDriver(); const context = admin ?? customer ?? driver;
  const { pathname } = useLocation(); const content = useRef<HTMLElement>(null);
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [pathname]);
  return <div className="admin-shell"><Sidebar open={open} onClose={() => setOpen(false)} /><div className="admin-workspace"><Header title={title} subtitle={subtitle} onMenu={() => setOpen(true)} /><main ref={content} className="admin-content">{context && import.meta.env.VITE_DEMO === 'true' && <div className="admin-demo"><span>Dữ liệu demo</span><button onClick={() => context.demoState('data')}>Có dữ liệu</button><button onClick={() => context.demoState('empty')}>Rỗng</button><button onClick={() => context.demoState('error')}>Lỗi kết nối</button></div>}<Outlet /></main></div></div>;
}



