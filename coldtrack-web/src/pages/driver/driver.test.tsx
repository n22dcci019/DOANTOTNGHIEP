// @vitest-environment jsdom
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { DriverProvider } from '../../services/DriverContext';
import { createMockAdminService } from '../../services/adminService';
import { createDriverService } from '../../services/driverService';
import { AppLayout } from '../../components/layout/AppLayout';
import { DriverCurrentPage } from './DriverCurrentPage';
import { DriverHistoryPage } from './DriverHistoryPage';
import { DriverAlertsPage } from './DriverAlertsPage';
import { DriverSettingsPage } from './DriverSettingsPage';
import { MOCK_USERS } from '../../mock/data';
import { AUTH_MOCK } from '../../mock/auth';
import { App } from '../../App';
configure({ asyncUtilTimeout: 5000 }); afterEach(cleanup);
function Identity({ children }: { children: ReactNode }) { const { setUser } = useAuth(); useEffect(() => { setUser(MOCK_USERS.taiXe); }, []); return children; }
function setup(path = '/tx/chuyen', scenario: 'data' | 'empty' | 'error' = 'data') {
  const source = createMockAdminService({ demo: true, delayMs: 0 }); const service = createDriverService(MOCK_USERS.taiXe, source, { demo: true }); service.setDemoState!(scenario);
  render(<AuthProvider><Identity><DriverProvider service={service}><MemoryRouter initialEntries={[path]}><Routes><Route path="/tx" element={<AppLayout />}><Route index element={<Navigate to="/tx/chuyen" replace />} /><Route path="chuyen" element={<DriverCurrentPage />} /><Route path="lich-su" element={<DriverHistoryPage />} /><Route path="canh-bao" element={<DriverAlertsPage />} /><Route path="cai-dat" element={<DriverSettingsPage />} /></Route></Routes></MemoryRouter></DriverProvider></Identity></AuthProvider>);
  return { source, service };
}
describe('B4 driver screens', () => {
  it('renders all three alert levels with shared B2 badge colors', async () => {
    const { source } = setup('/tx/canh-bao'); await screen.findByRole('table');
    await source.reportManagedIncident('CT-2026-0156', 'door', 'Kiểm tra cửa thùng');
    await source.reportManagedIncident('CT-2026-0156', 'other', 'Thông tin bổ sung cho điều phối');
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật lúc/ }));
    await screen.findByText('Điều phối báo sự cố: sự cố khác'); const table = screen.getByRole('table');
    expect(within(table).getByText('Nghiêm trọng').parentElement?.className).toContain('text-red-700');
    expect(within(table).getByText('Cảnh báo').parentElement?.className).toContain('text-amber-800');
    expect(within(table).getByText('Thông tin').parentElement?.className).toContain('text-sky-700');
  });
  it('renders assigned trip, temperature, door and position in shared four-item layout', async () => {
    setup('/tx'); await screen.findByRole('heading', { name: 'Giám sát chuyến xe CT-2026-0156' }); const menu = screen.getByRole('navigation', { name: 'Menu chính' }); expect(within(menu).getAllByRole('link')).toHaveLength(4); expect(within(menu).getByRole('link', { name: 'Chuyến hiện tại' }).getAttribute('aria-current')).toBe('page'); expect(screen.getByText('Đã đóng')).toBeTruthy(); expect(screen.getAllByText('QL1A, Đồng Nai').length).toBeGreaterThan(0); expect(screen.getByRole('img', { name: /Nhiệt độ hiện tại -15,8/ })).toBeTruthy(); expect(screen.queryByText('CB-2026-002')).toBeNull();
  });
  it.each([
    { path: '/tx/chuyen', message: 'Bạn chưa có chuyến đang vận chuyển được phân công.' },
    { path: '/tx/canh-bao', message: 'Bạn chưa có chuyến đang vận chuyển để xem cảnh báo.' },
    { path: '/tx/lich-su', message: 'Không tìm thấy dữ liệu' },
    { path: '/tx/cai-dat', message: 'Chưa có thông tin cài đặt tài khoản tài xế.' },
  ])('renders empty state at $path', async item => { setup(item.path, 'empty'); await screen.findByText(item.message); });
  it('renders loading and recovers error on retry', async () => {
    const { service } = setup('/tx/chuyen', 'error'); expect(screen.getByText('Đang tải dữ liệu…')).toBeTruthy(); await screen.findByRole('button', { name: 'Thử lại' }); service.setDemoState!('data'); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('heading', { name: 'Giám sát chuyến xe CT-2026-0156' });
  });

  it('renders configured alert severity and acknowledges receipt with a note', async () => {
    setup('/tx/canh-bao'); await screen.findByRole('heading', { name: 'Danh sách cảnh báo của chuyến' }); const table = screen.getByRole('table'); expect(within(table).getByText('Nghiêm trọng')).toBeTruthy(); expect(within(table).getByText('CT-2026-0156')).toBeTruthy(); expect(within(table).queryByText('CT-2026-0148')).toBeNull();
    fireEvent.click(within(table).getByRole('button', { name: 'Xác nhận' })); const dialog = await screen.findByRole('dialog', { name: 'Xác nhận cảnh báo' }); expect(within(dialog).getByRole('button', { name: /^Xác nhận$/ }).hasAttribute('disabled')).toBe(true); fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ghi chú xác nhận' }), { target: { value: 'Đã nhận, đang kiểm tra.' } }); fireEvent.click(within(dialog).getByRole('button', { name: /^Xác nhận$/ })); await screen.findByRole('button', { name: 'Đã xác nhận' }); expect(within(table).getByText('Đang mở')).toBeTruthy();
  });


  it('shows only account/notification settings and keeps driver role read-only', async () => {
    setup('/tx/cai-dat?tab=thresholds'); await screen.findByRole('heading', { name: 'Thông tin tài khoản' }); expect(screen.getAllByRole('tab')).toHaveLength(2); expect((screen.getByLabelText('Vai trò') as HTMLInputElement).readOnly).toBe(true); expect(screen.queryByRole('tab', { name: /Ngưỡng/ })).toBeNull(); fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Tài xế cập nhật' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText('Thông tin tài khoản đã được cập nhật thành công!'); expect(screen.getByText('Tài xế cập nhật')).toBeTruthy();
  });
  it('logs in as driver through B1 and denies both admin and customer routes', async () => {
    window.history.replaceState({}, '', '/login'); render(<App />); fireEvent.change(screen.getByLabelText(/^Email hoặc tên đăng nhập/), { target: { value: MOCK_USERS.taiXe.email } }); fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: AUTH_MOCK.password } }); fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ })); await screen.findByRole('heading', { name: 'Giám sát chuyến xe CT-2026-0156' }); expect(window.location.pathname).toBe('/tx/chuyen');
    for (const path of ['/admin', '/kh/lo-hang']) { window.history.pushState({}, '', path); fireEvent.popState(window); await screen.findByRole('heading', { name: 'Không có quyền truy cập' }); expect(screen.queryByRole('navigation', { name: 'Menu chính' })).toBeNull(); }
  });
});

