// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { authService } from './service';
import { AUTH_MOCK } from '../mock/auth';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function open(path: string) { window.history.replaceState({}, '', path); return render(<App />); }
function fill(label: RegExp, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
describe('Six auth routes and forms', () => {
  it('starts unauthenticated and links login, register and forgot', async () => {
    open('/login');
    await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' });
    fireEvent.click(screen.getByRole('link', { name: 'Đăng ký ngay' }));
    expect(screen.getByRole('heading', { name: 'Tạo tài khoản' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /^Đăng nhập$/ }));
    fireEvent.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(screen.getByRole('heading', { name: 'Quên mật khẩu?' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: 'Quay lại đăng nhập' })[0]);
    expect(window.location.pathname).toBe('/login');
  });
  it('shows local errors without calling service, then shows incorrect credentials', async () => {
    const login = vi.spyOn(authService, 'login');
    open('/login');
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByText('Vui lòng nhập email đúng định dạng.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
    fill(/Email hoặc tên đăng nhập/, AUTH_MOCK.users[0].email);
    fill(/^Mật khẩu/, 'Wrong123');
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByRole('button', { name: 'Đang xử lý…' }).hasAttribute('disabled')).toBe(true);
    await screen.findByText('Email hoặc mật khẩu không chính xác.');
  });
  it.each(AUTH_MOCK.users)('logs in $vaiTro to its own landing page', async user => {
    open('/login'); fill(/Email hoặc tên đăng nhập/, user.email); fill(/^Mật khẩu/, AUTH_MOCK.password);
    fireEvent.submit(screen.getByRole('form'));
    const destination = user.vaiTro === 'dieu-phoi' ? '/admin' : user.vaiTro === 'khach-hang' ? '/kh/lo-hang' : '/tx/chuyen';
    await waitFor(() => expect(window.location.pathname).toBe(destination));
  });
  it('requests reset and allows resending without exposing demo links', async () => {
    open('/forgot-password'); fill(/^Email/, AUTH_MOCK.users[0].email);
    fireEvent.submit(screen.getByRole('form'));
    await screen.findByRole('heading', { name: 'Kiểm tra email của bạn' });
    expect(screen.queryByText('Mô phỏng mở liên kết email')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Gửi lại email/ }));
    await screen.findByText('Đã gửi lại email.');
  });
  it('handles missing token, expired token and retry navigation', async () => {
    const view = open('/reset');
    await screen.findByRole('heading', { name: 'Liên kết đã hết hạn' });
    expect(window.location.pathname).toBe('/reset/expired');
    fireEvent.click(screen.getByRole('link', { name: 'Gửi lại yêu cầu' }));
    expect(window.location.pathname).toBe('/forgot-password');
    view.unmount(); open('/reset?token=expired');
    await screen.findByRole('heading', { name: 'Liên kết đã hết hạn' });
    expect(screen.getByText(/không còn hiệu lực/)).toBeTruthy();
  });
  it('validates reset confirmation and navigates reset → success → login', async () => {
    vi.spyOn(authService, 'inspectToken').mockResolvedValue({ email: AUTH_MOCK.users[0].email });
    const reset = vi.spyOn(authService, 'resetPassword').mockResolvedValue();
    open('/reset?token=valid');
    await screen.findByLabelText(/^Mật khẩu mới/);
    fill(/^Mật khẩu mới/, 'Changed123'); fill(/^Xác nhận mật khẩu mới/, 'Mismatch123');
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByText('Mật khẩu xác nhận không khớp.')).toBeTruthy(); expect(reset).not.toHaveBeenCalled();
    fill(/^Xác nhận mật khẩu mới/, 'Changed123'); fireEvent.submit(screen.getByRole('form'));
    await screen.findByRole('heading', { name: 'Đặt lại mật khẩu thành công' });
    expect(reset).toHaveBeenCalledWith('valid', 'Changed123');
    fireEvent.click(screen.getByRole('link', { name: 'Đăng nhập ngay' })); expect(window.location.pathname).toBe('/login');
  });
  it('redirects a valid token on expired route back to reset', async () => {
    vi.spyOn(authService, 'inspectToken').mockResolvedValue({ email: AUTH_MOCK.users[0].email });
    open('/reset/expired?token=valid'); await screen.findByLabelText(/^Mật khẩu mới/);
    expect(window.location.pathname).toBe('/reset');
  });
  it('registers a customer and returns to login', async () => {
    open('/register');
    expect(screen.queryByRole('checkbox')).toBeNull();
    fill(/^Họ và tên/, 'Khách mới'); fill(/^Email/, 'ui-new@example.com'); fill(/^Số điện thoại/, '0912345678');
    fill(/^Mật khẩu/, 'NewPass123'); fill(/^Xác nhận mật khẩu/, 'NewPass123');
    fireEvent.submit(screen.getByRole('form'));
    await screen.findByRole('heading', { name: 'Đăng ký thành công' });
    fireEvent.click(screen.getByRole('link', { name: 'Đăng nhập ngay' })); expect(window.location.pathname).toBe('/login');
  });
  it('toggles password visibility and hides unavailable Google SSO', () => {
    open('/login'); const input = screen.getByLabelText(/^Mật khẩu/) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' })); expect(input.type).toBe('text');
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
  });
});


