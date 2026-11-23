import type { NguoiDung, VaiTro } from '../mock/types';
import { AUTH_MOCK } from '../mock/auth';
import { validateEmail, validatePassword } from './validation';

export interface RegisterInput { name: string; email: string; phone: string; password: string }
export interface ResetRequest { expiresInMinutes: number; previewUrl?: string }
export interface AuthService {
  login(email: string, password: string): Promise<NguoiDung>;
  register(input: RegisterInput): Promise<void>;
  requestReset(email: string): Promise<ResetRequest>;
  inspectToken(token: string): Promise<{ email: string }>;
  resetPassword(token: string, password: string): Promise<void>;
}
export class AuthError extends Error {
  field?: string;
  constructor(message: string, field?: string) { super(message); this.field = field; }
}
export const roleHome = (role: VaiTro) => role === 'dieu-phoi' ? '/admin' : role === 'khach-hang' ? '/kh/lo-hang' : '/tx/chuyen';
const normalize = (email: string) => email.trim().toLowerCase();

// In-memory development adapter. Credentials never enter browser storage.
export function createMockAuthService(options = { demo: false, delayMs: AUTH_MOCK.latencyMs, now: () => Date.now() }): AuthService {
  const users = AUTH_MOCK.users.map(user => ({ user, password: AUTH_MOCK.password }));
  const tokens = new Map<string, { email: string; expires: number }>();
  const pause = () => new Promise(resolve => setTimeout(resolve, options.delayMs));
  const inspect = (token: string) => {
    const record = tokens.get(token);
    if (!record || record.expires <= options.now()) throw new AuthError('Liên kết đã hết hạn hoặc đã được sử dụng.', 'token');
    return record;
  };
  return {
    async login(email, password) {
      await pause();
      const account = users.find(item => item.user.email === normalize(email) && item.password === password);
      if (!account) throw new AuthError('Email hoặc mật khẩu không chính xác.', 'password');
      return account.user;
    },
    async register(input) {
      await pause();
      const email = normalize(input.email);
      if (validateEmail(email) || validatePassword(input.password)) throw new AuthError('Thông tin đăng ký không hợp lệ.');
      if (users.some(item => item.user.email === email)) throw new AuthError('Email này đã được sử dụng.', 'email');
      users.push({ password: input.password, user: { id: crypto.randomUUID(), ten: input.name.trim(), email, soDienThoai: input.phone, vaiTro: 'khach-hang', nhanHienThi: 'Khách hàng' } });
    },
    async requestReset(email) {
      await pause();
      if (!users.some(item => item.user.email === normalize(email))) throw new AuthError('Email này chưa được đăng ký trong hệ thống.', 'email');
      const token = crypto.randomUUID();
      tokens.set(token, { email: normalize(email), expires: options.now() + AUTH_MOCK.resetLifetimeMs });
      return { expiresInMinutes: AUTH_MOCK.resetLifetimeMs / 60000, ...(options.demo ? { previewUrl: `/reset?token=${encodeURIComponent(token)}` } : {}) };
    },
    async inspectToken(token) { await pause(); return { email: inspect(token).email }; },
    async resetPassword(token, password) {
      await pause();
      const record = inspect(token);
      if (validatePassword(password)) throw new AuthError(validatePassword(password), 'password');
      const account = users.find(item => item.user.email === record.email)!;
      account.password = password;
      for (const [key, value] of tokens) if (value.email === record.email) tokens.delete(key);
    },
  };
}
// Replace this adapter with an HTTP implementation of AuthService when the API is available.
// VITE_DEMO keeps its existing meaning: expose development shortcuts only when true.
export const authService: AuthService = createMockAuthService({ demo: import.meta.env.VITE_DEMO === 'true', delayMs: AUTH_MOCK.latencyMs, now: () => Date.now() });
