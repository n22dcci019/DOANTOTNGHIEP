// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { AUTH_MOCK } from '../mock/auth';
import { MOCK_USERS } from '../mock/data';
configure({ asyncUtilTimeout: 5000 }); vi.setConfig({ testTimeout: 15000 }); afterEach(cleanup);
const visit = (path: string) => { window.history.pushState({}, '', path); fireEvent.popState(window); };
function open(path: string) { window.history.replaceState({}, '', path); render(<App />); }
async function login(key: string) { await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }); fireEvent.change(screen.getByLabelText(/^Email hoặc tên đăng nhập/), { target: { value: MOCK_USERS[key].email } }); fireEvent.change(screen.getByLabelText(/^Mật khẩu/), { target: { value: AUTH_MOCK.password } }); fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ })); }
describe('B0/B1 auth routing', () => {
  it('keeps root public and navigates to existing login', async () => { open('/'); await screen.findByRole('heading', { name: 'Vận chuyển thực phẩm lạnh, kiểm soát từng độ C' }); fireEvent.click(screen.getByRole('link', { name: 'Đăng nhập' })); await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }); });
  it.each([{ key: 'admin', route: '/admin' }, { key: 'khachHang', route: '/kh/lo-hang' }, { key: 'taiXe', route: '/tx/chuyen' }])('redirects logged-in $key away from guest forms', async item => { open('/login'); await login(item.key); await waitFor(() => expect(window.location.pathname).toBe(item.route)); for (const path of ['/login', '/register', '/forgot-password']) { visit(path); await waitFor(() => expect(window.location.pathname).toBe(item.route)); expect(screen.queryByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeNull(); expect(screen.queryByRole('heading', { name: 'Tạo tài khoản' })).toBeNull(); } });
  it.each([{ key: 'admin', route: '/admin/lo-hang?status=Hoàn+thành#danh-sach' }, { key: 'khachHang', route: '/kh/lich-su?ma=CT-2026-0301' }, { key: 'taiXe', route: '/tx/canh-bao?muc-do=nghiem-trong' }])('returns $key to protected URL after login', async item => { open(item.route); await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }); expect(window.location.pathname).toBe('/login'); await login(item.key); await waitFor(() => { const expected = new URL(item.route, window.location.origin); expect(window.location.pathname + window.location.search + window.location.hash).toBe(expected.pathname + expected.search + expected.hash); }); });
  it('falls back to own role when opening an internal URL for another role', async () => { open('/admin/xe'); await login('khachHang'); await waitFor(() => expect(window.location.pathname).toBe('/kh/lo-hang')); });
  it('supports protected /tong-quan alias with return navigation', async () => { open('/tong-quan?view=demo'); await login('admin'); await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/admin?view=demo')); });
});

