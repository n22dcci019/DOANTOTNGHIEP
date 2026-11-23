import { describe, expect, it } from 'vitest';
import { postLoginDestination } from './navigation';
import { roleHome } from './service';
import type { VaiTro } from '../mock/types';
describe('post-login destination', () => {
  it.each([
    { role: 'dieu-phoi', path: '/admin/lo-hang/CT-2026-0156?view=map#nhiet-do' },
    { role: 'khach-hang', path: '/kh/lo-hang?ma=CT-2026-0156#trang-thai' },
    { role: 'tai-xe', path: '/tx/lich-su?ma=CT-2026-0301' },
    { role: 'dieu-phoi', path: '/tong-quan?q=demo' },
  ])('preserves allowed role route $path', item => expect(postLoginDestination(item.role as VaiTro, item.path)).toBe(item.path));
  it.each([undefined, null, 0, {}, 'https://example.com', '//example.com', '/\\example.com', '/login', '/register', '/forgot-password', '/unknown', '/admin/../kh/lo-hang'])('rejects unsupported or unsafe target %j', path => expect(postLoginDestination('dieu-phoi', path)).toBe('/admin'));
  it.each(['dieu-phoi', 'khach-hang', 'tai-xe'] as VaiTro[])('returns own home for wrong-role target %s', role => { const target = role === 'dieu-phoi' ? '/kh/lo-hang' : '/admin/lo-hang'; expect(postLoginDestination(role, target)).toBe(roleHome(role)); });
});
