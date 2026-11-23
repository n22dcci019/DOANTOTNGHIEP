// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext';
import { AdminProvider } from '../../services/AdminContext';
import { createMockAdminService } from '../../services/adminService';
import { AppLayout } from '../../components/layout/AppLayout';
import { OverviewPage, ShipmentsPage } from './ShipmentPages';
import { AlertsPage } from './AlertsPage';
import { ApprovalPage } from './ApprovalPage';
import { SettingsPage } from './SettingsPage';
// Allow asynchronous navigation and redraws on shared Windows test runners.
configure({ asyncUtilTimeout: 3000 });
afterEach(cleanup);
function setup(path: string, scenario: 'data' | 'empty' | 'error' = 'data', noThreshold = false) {
  const service = createMockAdminService({ demo: true, delayMs: 0 }); service.setDemoState!(scenario);
  if (noThreshold) { const load = service.load.bind(service); service.load = async () => { const data = await load(); if (data.settings) delete data.settings.thresholdDesignId; return data; }; }
  render(<AuthProvider><AdminProvider service={service}><MemoryRouter initialEntries={[path]}><Routes><Route path="/admin" element={<AppLayout />}><Route index element={<OverviewPage />} /><Route path="lo-hang" element={<ShipmentsPage />} /><Route path="lo-hang/:ma" element={<ShipmentsPage detail />} /><Route path="lo-hang/:ma/duyet" element={<ApprovalPage />} /><Route path="canh-bao" element={<AlertsPage />} /><Route path="canh-bao/:id" element={<AlertsPage detail />} /><Route path="cai-dat" element={<SettingsPage />} /></Route></Routes></MemoryRouter></AdminProvider></AuthProvider>);
  return service;
}
describe('B2 navigation and data states', () => {
  it('shows eight sidebar links and highlights only the correct parent on detail route', async () => {
    setup('/admin/lo-hang/CT-2026-0156'); await screen.findByRole('dialog');
    const menu = screen.getByRole('navigation', { name: 'Menu chính' }); expect(within(menu).getAllByRole('link')).toHaveLength(8);
    expect(within(menu).getByRole('link', { name: 'Lô hàng' }).getAttribute('aria-current')).toBe('page');
    expect(within(menu).getByRole('link', { name: 'Tổng quan' }).hasAttribute('aria-current')).toBe(false);
    expect(within(menu).getByRole('link', { name: 'Tài xế' })).toBeTruthy();
  });
  it('navigates from shipment list to ID detail and closes with Escape', async () => {
    setup('/admin/lo-hang'); await screen.findByRole('heading', { name: 'Danh sách lô hàng' });
    fireEvent.click(screen.getByRole('link', { name: /^CT-2026-0156$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết lô hàng CT-2026-0156' });
    expect(within(dialog).getByText('Thịt bò đông lạnh Úc')).toBeTruthy(); expect(within(dialog).getByText('Cảm biến IoT thời gian thực')).toBeTruthy();
    expect(document.activeElement).toBe(dialog);
    fireEvent.keyDown(window, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Đóng chi tiết' }));
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true }); expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('shows empty table and recovers a search filter', async () => {
    setup('/admin/lo-hang'); await screen.findByRole('heading', { name: 'Danh sách lô hàng' });
    fireEvent.change(screen.getByRole('textbox', { name: /^Tìm kiếm$/ }), { target: { value: 'khong-ton-tai' } });
    expect(screen.getByText('Không tìm thấy dữ liệu')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' })); expect(screen.getByRole('link', { name: /^CT-2026-0156$/ })).toBeTruthy();
  });
  it('renders error state, then retries loading successfully', async () => {
    const service = setup('/admin/lo-hang', 'error'); await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    service.setDemoState!('data'); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('heading', { name: 'Danh sách lô hàng' });
  });
  it('renders empty mock table', async () => { setup('/admin/lo-hang', 'empty'); await screen.findByText('Không tìm thấy dữ liệu'); expect(screen.queryByRole('table')).toBeNull(); });
  it('loads initial state before data', async () => { setup('/admin'); expect(screen.getByText('Đang tải dữ liệu…')).toBeTruthy(); await screen.findByRole('heading', { name: 'Tổng quan' }); });
  it('shows unknown shipment as empty inside its route drawer', async () => { setup('/admin/lo-hang/unknown'); await screen.findByText('Lô hàng không tồn tại hoặc không còn được theo dõi.'); });
  it('validates mandatory note and updates alert and sidebar badge', async () => {
    setup('/admin/canh-bao/CB-2026-001'); const dialog = await screen.findByRole('dialog'); const submit = within(dialog).getByRole('button', { name: 'Đánh dấu đã xử lý' }); expect(submit.hasAttribute('disabled')).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Ghi chú xử lý/ }), { target: { value: 'Đã kiểm tra thiết bị và cửa thùng.' } }); fireEvent.click(submit);
    await within(dialog).findByText('Đã xử lý cảnh báo');
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Cảnh báo' }).textContent).toContain('2');
  });
  it('approves request after assigning a valid vehicle and available driver', async () => {
    setup('/admin/lo-hang/CT-2026-0401/duyet'); const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Duyệt & phân công' }).hasAttribute('disabled')).toBe(true);
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Xe chỉ định' }), { target: { value: 'xe-ranh-01' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Tài xế phụ trách' }), { target: { value: 'driver-free-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt & phân công' }));
    const detail = await screen.findByRole('dialog', { name: 'Chi tiết lô hàng CT-2026-0401' }); expect(within(detail).getByText('Chờ xuất phát')).toBeTruthy();
  });
  it('hides thresholds when design ID is absent', async () => { setup('/admin/cai-dat?tab=thresholds', 'data', true); await screen.findByRole('heading', { name: 'Thông tin tài khoản' }); expect(screen.queryByRole('tab', { name: 'Ngưỡng nhiệt độ hệ thống' })).toBeNull(); });
  it('requires threshold audit reason and saves with confirmation', async () => {
    setup('/admin/cai-dat?tab=thresholds'); await screen.findByRole('heading', { name: /^Ngưỡng nhiệt độ hệ thống$/ });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' })); expect(screen.getByText('Vui lòng nhập lý do thay đổi để lưu vết kiểm toán.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do thay đổi' }), { target: { value: 'Cập nhật dải mặc định cho đơn mới' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await screen.findByText('Đã lưu ngưỡng nhiệt độ. Áp dụng cho đơn tạo sau thời điểm này.');
  });
});



