import { describe, expect, it } from 'vitest';
import { validateAuthForm, validateEmail, validatePassword } from './validation';
const valid = { name: 'Nguyễn Văn An', email: 'an@example.com', phone: '0912345678', password: 'Strong123', confirm: 'Strong123', terms: true };
describe('Auth validation', () => {
  it.each(['', 'abc', 'a@', 'a@b', 'a b@example.com'])('rejects invalid email %s', email => expect(validateEmail(email)).toBeTruthy());
  it('normalizes surrounding whitespace', () => expect(validateEmail(' user@example.com ')).toBe(''));
  it.each(['', 'abc123', 'abcdefgh', '12345678'])('rejects weak password %s', password => expect(validatePassword(password)).toBeTruthy());
  it.each(['login', 'forgot', 'reset', 'register'] as const)('accepts valid %s form', kind => expect(validateAuthForm(kind, valid)).toEqual({}));
  it('returns errors next to all invalid registration fields', () => expect(Object.keys(validateAuthForm('register', { name: '', email: '', phone: '', password: '', confirm: '', terms: false }))).toEqual(['email', 'password', 'confirm', 'name', 'phone', 'terms']));
  it('checks confirmation and accepts formatted Vietnamese phone', () => {
    expect(validateAuthForm('reset', { ...valid, confirm: 'different' }).confirm).toBeTruthy();
    expect(validateAuthForm('register', { ...valid, phone: '+84 912 345 678' })).toEqual({});
  });
});
