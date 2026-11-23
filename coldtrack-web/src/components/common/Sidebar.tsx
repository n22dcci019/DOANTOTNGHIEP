import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, PlusCircle, Truck, Users, AlertTriangle, History, FileText, Settings, PanelLeftClose, PanelLeftOpen, Snowflake, LogOut, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useOptionalAdmin } from '../../services/AdminContext';
import { useOptionalCustomer } from '../../services/CustomerContext';
import { useOptionalDriver } from '../../services/DriverContext';
import { MOCK_THONG_KE } from '../../mock/data';
export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { currentUser, logout } = useAuth(); const context = useOptionalAdmin(); const customer = useOptionalCustomer(); const driver = useOptionalDriver();
  const [collapsed, setCollapsed] = useState(false); const navigate = useNavigate();
  const sidebar = useRef<HTMLElement>(null);
  const closeMenu = useRef(onClose);
  useEffect(() => { closeMenu.current = onClose; }, [onClose]);
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 900px)').matches ?? false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    const container = sidebar.current;
    const workspace = document.querySelector<HTMLElement>('.admin-workspace');
    const wasInert = workspace?.inert ?? false;
    if (workspace) workspace.inert = true;
    container?.querySelector<HTMLElement>('.sidebar-mobile-close')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu.current?.(); }
      if (event.key !== 'Tab' || !container) return;
      const items = [...container.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')].filter(item => item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); if (workspace) workspace.inert = wasInert; if (previous?.isConnected) previous.focus(); };
  }, [mobile, open]);
  const profile = context?.data?.settings?.profile ?? customer?.data?.settings?.profile ?? driver?.data?.settings?.profile ?? currentUser;
  const badge = context?.data ? context.data.alerts.filter(item => !item.daXuLy && item.mucDo !== 'Thông tin').length : MOCK_THONG_KE.canhBaoBadgeMenu;
  const items = currentUser.vaiTro === 'dieu-phoi' ? [
    { name: 'Tổng quan', path: '/admin', icon: LayoutDashboard }, { name: 'Lô hàng', path: '/admin/lo-hang', icon: Package },
    { name: 'Xe', path: '/admin/xe', icon: Truck }, { name: 'Tài xế', path: '/admin/tai-xe', icon: Users },
    { name: 'Cảnh báo', path: '/admin/canh-bao', icon: AlertTriangle, badge }, { name: 'Lịch sử', path: '/admin/lich-su', icon: History },
    { name: 'Nhật ký hoạt động', path: '/admin/nhat-ky', icon: FileText }, { name: 'Cài đặt', path: '/admin/cai-dat', icon: Settings },
  ] : currentUser.vaiTro === 'khach-hang' ? [
    { name: 'Lô hàng của tôi', path: '/kh/lo-hang', icon: Package }, { name: 'Tạo lô hàng', path: '/kh/tao-lo-hang', icon: PlusCircle }, { name: 'Lịch sử', path: '/kh/lich-su', icon: History }, { name: 'Cài đặt', path: '/kh/cai-dat', icon: Settings },
  ] : [ { name: 'Chuyến hiện tại', path: '/tx/chuyen', icon: Truck }, { name: 'Lịch sử chuyến', path: '/tx/lich-su', icon: History }, { name: 'Cảnh báo của chuyến', path: '/tx/canh-bao', icon: AlertTriangle, badge: driver?.data?.alerts.filter(item => !item.daXuLy && item.mucDo !== 'Thông tin').length ?? 0 }, { name: 'Cài đặt', path: '/tx/cai-dat', icon: Settings } ];
  return <>{open && <button className="admin-menu-backdrop" aria-label="Đóng menu" onClick={onClose} />}<aside ref={sidebar} inert={mobile && !open} aria-hidden={mobile && !open ? true : undefined} className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'mobile-open' : ''}`}><div className="admin-brand"><div className="admin-brand-logo"><Snowflake size={20} /></div><div className="admin-brand-text"><strong>Cold<span>Track</span></strong><small>LOGISTICS INTELLIGENCE</small></div><button className="admin-icon sidebar-collapse" aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="admin-icon sidebar-mobile-close" aria-label="Đóng thanh bên" onClick={onClose}><X size={18} /></button></div><nav aria-label="Menu chính">{items.map(item => <NavLink key={item.path} to={item.path} end={item.path === '/admin'} aria-label={item.name} title={item.name} onClick={onClose}><item.icon size={19} /><span className="admin-nav-label">{item.name}</span>{'badge' in item && item.badge != null && <span className="admin-nav-badge">{item.badge}</span>}</NavLink>)}</nav><div className="admin-sidebar-user"><span className="admin-avatar">{profile.ten.split(' ').map(word => word[0]).slice(-2).join('')}</span><div className="admin-brand-text"><strong>{profile.ten}</strong><small>{profile.nhanHienThi}</small></div><button className="admin-icon" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => { logout(); navigate('/login'); }}><LogOut size={18} /></button></div></aside></>;
}


