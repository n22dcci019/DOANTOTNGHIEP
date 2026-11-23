// @vitest-environment jsdom
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { CustomerProvider } from '../../services/CustomerContext';
import { createMockAdminService } from '../../services/adminService';
import { createCustomerService } from '../../services/customerService';
import { AppLayout } from '../../components/layout/AppLayout';
import { CustomerShipmentsPage } from './CustomerShipmentsPage';
import { CreateShipmentPage } from './CreateShipmentPage';
import { CustomerSettingsPage } from './CustomerSettingsPage';
import { CustomerHistoryPage } from './CustomerHistoryPage';
import { MOCK_USERS } from '../../mock/data';
import { AUTH_MOCK } from '../../mock/auth';
import { App } from '../../App';
configure({ asyncUtilTimeout: 4000 });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Identity({ children }: { children: ReactNode }) { const { setUser } = useAuth(); useEffect(() => { setUser(MOCK_USERS.khachHang); }, []); return children; }
function setup(path: string, scenario: 'data' | 'empty' | 'error' = 'data') {
  const source = createMockAdminService({ demo: true, delayMs: 0 }); const service = createCustomerService(MOCK_USERS.khachHang, source, { demo: true }); service.setDemoState!(scenario);
  render(<AuthProvider><Identity><CustomerProvider service={service}><MemoryRouter initialEntries={[path]}><Routes><Route path="/kh" element={<AppLayout />}><Route index element={<Navigate to="/kh/lo-hang" replace />} /><Route path="lo-hang" element={<CustomerShipmentsPage />} /><Route path="tao-lo-hang" element={<CreateShipmentPage />} /><Route path="tao-lo-hang/xem-lai" element={<CreateShipmentPage preview />} /><Route path="lich-su" element={<CustomerHistoryPage />} /><Route path="cai-dat" element={<CustomerSettingsPage />} /></Route></Routes></MemoryRouter></CustomerProvider></Identity></AuthProvider>);
  return { source, service };
}
const change = (name: RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
function fillValid() {
  change(/^Điểm lấy hàng/, 'hcm'); change(/^Điểm giao hàng/, 'ct'); change(/^Loại hàng hóa/, 'frozen-food');
  change(/^Khối lượng/, '1500'); change(/^Quy cách đóng gói/, 'Thùng xốp bảo ôn tiêu chuẩn'); change(/^Ngày khởi hành/, '2026-10-30'); change(/^Giờ khởi hành/, '16:00');
}
describe('B3 customer UI', () => {
  it('uses four customer menu items and hides internal shipment fields', async () => {
    setup('/kh'); await screen.findByRole('heading', { name: 'Danh sách lô hàng của tôi' });
    const menu = screen.getByRole('navigation', { name: 'Menu chính' }); expect(within(menu).getAllByRole('link')).toHaveLength(4);
    expect(within(menu).getByRole('link', { name: 'Lô hàng của tôi' }).getAttribute('aria-current')).toBe('page');
    expect(within(menu).queryByRole('link', { name: 'Xe' })).toBeNull(); expect(screen.queryByRole('columnheader', { name: /Tài xế|Biển số|Thiết bị/ })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /^CT-2026-0156$/ }));
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getByText('Đang vận chuyển')).toBeTruthy(); expect(within(dialog).queryByText(/Trần Minh Khoa|51D-800/)).toBeNull();
  });
  it('does not expose another customer shipment by URL', async () => { setup('/kh/lo-hang?ma=CT-2026-0148'); const dialog = await screen.findByRole('dialog'); expect(within(dialog).getByText('Không tìm thấy lô hàng thuộc tài khoản của bạn.')).toBeTruthy(); });
  it('shows required validation near fields without calling service', async () => {
    const { service } = setup('/kh/tao-lo-hang'); const create = vi.spyOn(service, 'createShipment'); await screen.findByLabelText(/^Điểm lấy hàng/);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tạo lô hàng' }));
    expect(screen.getByText('Vui lòng chọn điểm lấy hàng.')).toBeTruthy(); expect(screen.getByText('Dung sai phải là số dương.')).toBeTruthy(); expect(create).not.toHaveBeenCalled();
  });
  it('fills defaults for selected product, permits edits and prevents invalid tolerance', async () => {
    setup('/kh/tao-lo-hang'); await screen.findByLabelText(/^Loại hàng hóa/); change(/^Loại hàng hóa/, 'ice-cream');
    expect((screen.getByLabelText(/^Nhiệt độ mục tiêu/) as HTMLInputElement).value).toBe('-22'); expect((screen.getByLabelText(/^Dung sai/) as HTMLInputElement).value).toBe('2');
    change(/^Nhiệt độ mục tiêu/, '-21'); expect((screen.getByLabelText(/^Nhiệt độ mục tiêu/) as HTMLInputElement).value).toBe('-21');
    fillValid(); change(/^Dung sai/, '0'); fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tạo lô hàng' })); expect(screen.getByText('Dung sai phải là số dương.')).toBeTruthy();
  });
  it('shows creation success and navigates to owned shipment list', async () => {
    setup('/kh/tao-lo-hang'); await screen.findByLabelText(/^Loại hàng hóa/); fillValid(); fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu tạo lô hàng' }));
    await screen.findByRole('heading', { name: 'Danh sách lô hàng của tôi' }); expect(screen.getByText(/Đã gửi yêu cầu tạo lô hàng thành công!/)).toBeTruthy(); expect(screen.getByRole('link', { name: /^CT-2026-0403$/ })).toBeTruthy();
  });
  it('saves incomplete draft and restores it for editing', async () => {
    setup('/kh/tao-lo-hang'); await screen.findByLabelText(/^Loại hàng hóa/); change(/^Loại hàng hóa/, 'seafood');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' })); await screen.findByRole('dialog', { name: 'Tóm tắt bản nháp' });
    fireEvent.click(screen.getByRole('link', { name: 'Tiếp tục chỉnh sửa' })); expect((screen.getByLabelText(/^Loại hàng hóa/) as HTMLSelectElement).value).toBe('seafood');
  });
  it('renders loading, empty configuration and recovers error', async () => {
    const view = setup('/kh/tao-lo-hang', 'empty'); expect(screen.getByText('Đang tải dữ liệu…')).toBeTruthy(); await screen.findByText('Chưa có cấu hình loại hàng và nhiệt độ để tạo lô hàng.'); cleanup();
    const failed = setup('/kh/lo-hang', 'error'); await screen.findByRole('button', { name: 'Thử lại' }); failed.service.setDemoState!('data'); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('heading', { name: 'Danh sách lô hàng của tôi' }); expect(view.service).toBeTruthy();
  });
  it('renders customer history with no vehicle/driver columns', async () => { setup('/kh/lich-su'); await screen.findByRole('heading', { name: 'Lịch sử lô hàng của tôi' }); expect(screen.queryByRole('columnheader', { name: /Biển số|Tài xế/ })).toBeNull(); change(/^Tìm kiếm$/, 'khong-ton-tai'); expect(screen.getByText('Không tìm thấy dữ liệu')).toBeTruthy(); });
  it('has only account/notification settings and saves customer profile', async () => {
    setup('/kh/cai-dat?tab=thresholds'); await screen.findByRole('heading', { name: 'Thông tin tài khoản' }); expect(screen.getAllByRole('tab')).toHaveLength(2); expect(screen.queryByRole('tab', { name: /Ngưỡng/ })).toBeNull();
    change(/^Họ và tên/, 'Khách hàng cập nhật'); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText('Thông tin tài khoản đã được cập nhật thành công!'); expect(screen.getByText('Khách hàng cập nhật')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Thông báo' })); fireEvent.click(screen.getByRole('switch', { name: 'SMS' })); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })); await screen.findByText('Đã lưu cài đặt thông báo.');
  });
  it('logs in through B1 and denies direct admin route access', async () => {
    window.history.replaceState({}, '', '/login'); render(<App />); change(/^Email hoặc tên đăng nhập/, MOCK_USERS.khachHang.email); change(/^Mật khẩu/, AUTH_MOCK.password); fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ }));
    await screen.findByRole('heading', { name: 'Danh sách lô hàng của tôi' }); expect(window.location.pathname).toBe('/kh/lo-hang');
    window.history.pushState({}, '', '/admin'); fireEvent.popState(window); await screen.findByRole('heading', { name: 'Không có quyền truy cập' }); expect(screen.queryByRole('heading', { name: 'Tổng quan' })).toBeNull();
  });
});

