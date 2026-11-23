import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, RefreshCw, Menu } from 'lucide-react';
import { useOptionalAdmin } from '../../services/AdminContext';
import { useOptionalCustomer } from '../../services/CustomerContext';
import { useOptionalDriver } from '../../services/DriverContext';
import { useAuth } from '../../auth/AuthContext';
import { MOCK_USERS } from '../../mock/data';
import { roleHome } from '../../auth/service';
export function Header({ title, subtitle, onMenu }: { title?: string; subtitle?: string; onMenu?: () => void }) {
  const { pathname } = useLocation(); const navigate = useNavigate(); const admin = useOptionalAdmin(); const customer = useOptionalCustomer(); const driver = useOptionalDriver(); const context = admin ?? customer ?? driver; const { setRole } = useAuth();
  const [query, setQuery] = useState(''); const [help, setHelp] = useState(false);
  const section = pathname.split('/')[2] ?? '';
  const titles: Record<string, string> = { '': 'Tổng quan', 'lo-hang': customer ? 'Lô hàng của tôi' : 'Lô hàng', 'tao-lo-hang': 'Tạo lô hàng', chuyen: 'Chuyến hiện tại', xe: 'Xe', 'tai-xe': 'Tài xế', 'canh-bao': driver ? 'Cảnh báo của chuyến' : 'Cảnh báo', 'lich-su': driver ? 'Lịch sử chuyến' : 'Lịch sử', 'nhat-ky': 'Nhật ký hoạt động', 'cai-dat': 'Cài đặt' };
  const time = context?.data?.now ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(context.data.now)) : '—';
  return <header className="admin-header"><button className="admin-icon admin-menu-toggle" aria-label="Mở menu chính" onClick={onMenu}><Menu size={21} /></button><div className="admin-header-title"><strong>{context ? titles[section] : title}</strong>{subtitle && !context && <small>{subtitle}</small>}</div>{context && !driver && <form role="search" className="admin-header-search" onSubmit={event => { event.preventDefault(); navigate((customer ? '/kh' : '/admin') + '/lo-hang?q=' + encodeURIComponent(query)); }}><Search size={16} /><input aria-label="Tìm kiếm toàn cục" placeholder={customer ? 'Tìm mã lô hàng, sản phẩm…' : 'Tìm mã lô hàng, biển số xe…'} value={query} onChange={event => setQuery(event.target.value)} /></form>}<div className="admin-header-actions">{context && <button className="admin-secondary admin-sync" disabled={context.loading} onClick={() => void context.refresh()}><RefreshCw size={14} /><span>Cập nhật lúc {time}</span></button>}<button className="admin-icon" aria-label="Thông báo hệ thống" onClick={() => navigate(driver ? '/tx/canh-bao' : customer ? '/kh/lo-hang' : '/admin/canh-bao')}><Bell size={18} /><i /></button><button className="admin-icon" aria-label="Trợ giúp" aria-expanded={help} onClick={() => setHelp(!help)}><HelpCircle size={18} /></button>{import.meta.env.VITE_DEMO === 'true' && <select aria-label="Đổi vai trò demo" defaultValue="" onChange={event => { const user = MOCK_USERS[event.target.value]; if (user) { setRole(user.vaiTro); navigate(roleHome(user.vaiTro)); } }}><option value="" disabled>Vai trò demo</option>{Object.entries(MOCK_USERS).map(([key, user]) => <option key={key} value={key}>{user.nhanHienThi}</option>)}</select>}</div>{help && <div className="admin-help" role="status">{driver ? 'Chọn Chuyến hiện tại để xem cảm biến và đặt nhiệt độ khi máy lạnh đã kết nối. Cảnh báo chỉ hiển thị cho chuyến được phân công.' : customer ? 'Chọn Lô hàng của tôi để theo dõi trạng thái; chọn Tạo lô hàng để gửi yêu cầu đến Điều phối.' : 'Chọn Lô hàng để tra cứu hành trình; mở Cảnh báo để xử lý sự cố. Các bộ lọc giúp thu hẹp danh sách.'}</div>}</header>;
}




