import type { VaiTro } from '../mock/types';
import { roleHome } from './service';
const allowedPaths: Record<VaiTro, RegExp[]> = {
  'dieu-phoi': [/^\/admin\/?$/, /^\/admin\/lo-hang(?:\/[^/]+(?:\/duyet)?)?\/?$/, /^\/admin\/(?:xe|canh-bao|lich-su)(?:\/[^/]+)?\/?$/, /^\/admin\/(?:tai-xe|nhat-ky|cai-dat)\/?$/, /^\/tong-quan\/?$/],
  'khach-hang': [/^\/kh\/?$/, /^\/kh\/lo-hang\/?$/, /^\/kh\/tao-lo-hang(?:\/xem-lai)?\/?$/, /^\/kh\/lo-hang\/[^/]+\/da-gui\/?$/, /^\/kh\/(?:lich-su|cai-dat)\/?$/],
  'tai-xe': [/^\/tx\/?$/, /^\/tx\/(?:chuyen|lich-su|canh-bao|cai-dat)\/?$/],
};
export function postLoginDestination(role: VaiTro, from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || /[\\\u0000-\u0020]/.test(from)) return roleHome(role);
  try { const url = new URL(from, 'https://coldtrack.local'); if (url.origin !== 'https://coldtrack.local' || !allowedPaths[role].some(pattern => pattern.test(url.pathname))) return roleHome(role); return url.pathname + url.search + url.hash; } catch { return roleHome(role); }
}
