import { MOCK_USERS, MOCK_THONG_KE } from './data';
export const AUTH_MOCK = {
  password: 'ColdTrack2026', latencyMs: 300, resetLifetimeMs: 15 * 60 * 1000,
  telemetry: [
    { label: 'Nhiệt độ buồng lạnh', value: '-19.2°C', status: 'Trong ngưỡng' },
    { label: 'Độ ẩm tương đối', value: '58.2%' },
    { label: 'Tỷ lệ chuyến đạt chuẩn', value: MOCK_THONG_KE.tyLeDungNhietDo },
  ],
  placeholders: { email: 'name@company.com', name: 'Nguyễn Văn A', phone: '0912 345 678' },
  supportEmail: 'support@coldtrack.vn',
  users: Object.values(MOCK_USERS),
};
