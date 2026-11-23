export const PASSWORD_HELP = 'Tối thiểu 8 ký tự, gồm chữ và số';
export const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Vui lòng nhập email đúng định dạng.';
export const validatePassword = (value: string) => value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value) ? '' : PASSWORD_HELP;
export type AuthFormValues = { email: string; password: string; confirm: string; name: string; phone: string; terms: boolean };
export type AuthFormKind = 'login' | 'forgot' | 'reset' | 'register';
export function validateAuthForm(kind: AuthFormKind, values: AuthFormValues) {
  const errors: Record<string, string> = {};
  if (kind !== 'reset') errors.email = validateEmail(values.email);
  if (kind !== 'forgot') errors.password = validatePassword(values.password);
  if (kind === 'reset' || kind === 'register') errors.confirm = values.confirm && values.confirm === values.password ? '' : 'Mật khẩu xác nhận không khớp.';
  if (kind === 'register') {
    errors.name = values.name.trim() ? '' : 'Vui lòng nhập họ và tên.';
    errors.phone = /^(\+84|0)\d{9}$/.test(values.phone.replace(/\s/g, '')) ? '' : 'Vui lòng nhập số điện thoại hợp lệ.';
    errors.terms = values.terms ? '' : 'Vui lòng đồng ý với điều khoản và chính sách bảo mật.';
  }
  return Object.fromEntries(Object.entries(errors).filter(([, value]) => value));
}
