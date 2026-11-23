import { describe, expect, it } from 'vitest';
import { createMockAuthService, roleHome } from './service';
import { AUTH_MOCK } from '../mock/auth';
const setup = (demo = true, now = () => Date.now()) => createMockAuthService({ demo, delayMs: 0, now });
const email = AUTH_MOCK.users[0].email;
describe('Mock AuthService contract', () => {
  it('requires exact email and correct password', async () => {
    const service = setup();
    await expect(service.login(email, 'Wrong123')).rejects.toThrow('không chính xác');
    await expect(service.login('fake.khang@example.com', AUTH_MOCK.password)).rejects.toThrow();
    expect((await service.login(` ${email.toUpperCase()} `, AUTH_MOCK.password)).vaiTro).toBe('dieu-phoi');
  });
  it('registers only customers and rejects duplicate email', async () => {
    const service = setup();
    const input = { name: 'Khách mới', email: 'new@example.com', phone: '0912345678', password: 'NewPass123' };
    await service.register(input);
    expect((await service.login(input.email, input.password)).vaiTro).toBe('khach-hang');
    await expect(service.register(input)).rejects.toThrow('đã được sử dụng');
  });
  it('resets password and invalidates every issued token for the account', async () => {
    const service = setup();
    const first = await service.requestReset(email);
    const second = await service.requestReset(email);
    const token = new URL(first.previewUrl!, 'http://localhost').searchParams.get('token')!;
    const other = new URL(second.previewUrl!, 'http://localhost').searchParams.get('token')!;
    expect(await service.inspectToken(token)).toEqual({ email });
    await service.resetPassword(token, 'Changed123');
    await expect(service.login(email, AUTH_MOCK.password)).rejects.toThrow();
    await expect(service.login(email, 'Changed123')).resolves.toMatchObject({ email });
    await expect(service.inspectToken(token)).rejects.toThrow();
    await expect(service.inspectToken(other)).rejects.toThrow();
  });
  it('rejects missing, unknown and expired tokens, including expiry boundary', async () => {
    let now = 0; const service = setup(true, () => now);
    const request = await service.requestReset(email);
    const token = new URL(request.previewUrl!, 'http://localhost').searchParams.get('token')!;
    await expect(service.inspectToken('')).rejects.toThrow();
    await expect(service.inspectToken('unknown')).rejects.toThrow();
    now = AUTH_MOCK.resetLifetimeMs;
    await expect(service.resetPassword(token, 'Changed123')).rejects.toThrow();
  });
  it('hides preview with demo off and rejects unknown reset email', async () => {
    const service = setup(false);
    expect((await service.requestReset(email)).previewUrl).toBeUndefined();
    await expect(service.requestReset('unknown@example.com')).rejects.toThrow('chưa được đăng ký');
  });
  it('maps each role to its permitted landing page', () => {
    expect(['dieu-phoi', 'khach-hang', 'tai-xe'].map(role => roleHome(role as Parameters<typeof roleHome>[0]))).toEqual(['/admin', '/kh/lo-hang', '/tx/chuyen']);
  });
});
